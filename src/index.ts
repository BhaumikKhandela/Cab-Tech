import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { decode, sign, verify } from "hono/jwt";
import { Context, Hono, Next } from "hono";
import {
  AccessTokenSchema,
  CategorySchema,
  CoordinatesSchema,
  ServiceTypeSchema,
  SignUpSchema,
} from "./zod-types/zodTypes";
import { generateOtp } from "./utils/otpUtils";
import { cors } from "hono/cors";
import { JwtTokenExpired } from "hono/utils/jwt/types";
import { string } from "zod";
import { KVGetWithMetaData, OlaResponse, RideDetails } from "./types/type";

interface MyContext extends Context {
  id?: string;
}

const app = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
    kv: KVNamespace;
    X_APP_TOKEN: string;
  };
  Context: MyContext;
}>();

app.use("*", cors());

const AuthMiddleware = async (c: MyContext, next: Next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        message: "Token missing or invalid format",
      },
      401
    );
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return c.json({
      message: "Token missing",
    });
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET);

    c.set("id", payload.sub);

    await next();
  } catch (error) {
    console.error("User not recognized", error);

    if (error instanceof JwtTokenExpired) {
      return c.json(
        {
          message: "Token has expired",
        },
        401
      );
    }
    return c.json(
      {
        message: "User not recognized",
      },
      403
    );
  }
};

app.post("/api/v1/signup", async (c) => {
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());

    const kv = c.env.kv;

    const body = await c.req.json();

    try {
      const result = SignUpSchema.safeParse(body);
      if (!result.success) {
        return c.json(
          { message: "Invalid signup data", error: result.error },
          400
        );
      }

      const signUpDetails = result.data;

      const user = await prisma.user.create({
        data: {
          email: signUpDetails.email,
          name: signUpDetails.name,
          phoneNumber: signUpDetails.phoneNumber,
        },
      });

      const otp = generateOtp();

      await kv.put(user.id, otp, { expirationTtl: 5 * 60 });

      // returned message
      return c.json(
        { message: "User created successfully. OTP sent to your phone." },
        201
      );
    } catch (error) {
      console.error("Phone number exists", error);

      // message updated
      return c.json(
        {
          message: "User with this phone number or email already exists",
        },
        409
      );
    }
  } catch (error) {
    console.error("Connection to Prisma Client failed", error);

    // returned message
    return c.json(
      { message: "Internal server error. Please try again later." },
      500
    );
  }
});

app.post("/api/v1/generate-otp", async (c) => {
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());

    const body = await c.req.json();

    const user = await prisma.user.findUnique({
      where: {
        phoneNumber: body.phoneNumber,
      },
    });

    if (!user) {
      return c.json(
        {
          message: "User not found, please sign up first",
        },
        404
      );
    }
    const kv = c.env.kv;

    const otp = generateOtp();

    // expire time added
    await kv.put(user?.id, otp, { expirationTtl: 5 * 60 });

    // returned message
    return c.json(
      {
        message: "OTP generated successfully and sent to the user.",
      },
      200
    );
  } catch (error) {
    return c.json(
      {
        message: "Can't connect to Prisma",
      },
      500
    );
  }
});

app.post("/api/v1/verify-otp", async (c) => {
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());

    const body = await c.req.json();

    const kv = c.env.kv;

    const otp = await kv.get(body.id);

    // check if otp is recieved
    if (!otp) {
      return c.json(
        {
          message: "OTP not found or expired. Please request a new OTP.",
        },
        404
      );
    }

    if (otp !== body.otp) {
      return c.json(
        {
          message: "Invalid OTP, please try again",
        },
        401
      );
    }

    const payload = {
      sub: body.id,
      role: "user",
      exp: Math.floor(Date.now() / 1000 + 30 * 24 * 60 * 60),
    };

    const token = await sign(payload, c.env.JWT_SECRET);

    return c.json(
      {
        message: "Phone number verified",
        token,
      },
      200
    );
  } catch (error) {
    console.error("An error occurred while verifying OTP", error);
    return c.json(
      {
        message: "An error occurred while verifying otp",
      },
      500
    );
  }
});

app.patch("/api/v1/set-accessToken", AuthMiddleware, async (c) => {
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());

    const body = await c.req.json();
    const id = c.get("id");

    if (!id) {
      return c.json(
        {
          message: "Can't get the id",
        },
        400
      );
    }
    const tokenDetails = AccessTokenSchema.safeParse(body);

    if (!tokenDetails.success) {
      return c.json(
        {
          message: "Invalid body",
        },
        400
      );
    }

    // tokenDetails.data.accessToken --> tokenDetails.data.name
    switch (tokenDetails.data.name) {
      case "UBER":
        await prisma.user.update({
          where: {
            id: id,
          },
          data: {
            UberAccessToken: tokenDetails.data.accessToken,
          },
        });
        break;

      case "OLA":
        await prisma.user.update({
          where: {
            id: id,
          },
          data: {
            OlaAccessToken: tokenDetails.data.accessToken,
          },
        });
        break;

      default:
        return c.json(
          {
            message: "Invalid access token",
          },
          400
        );
    }

    return c.json(
      {
        message: "Token updated successfully",
      },
      200
    );
  } catch (error) {
    console.error("An error occurred", error);
    return c.json(
      {
        message: "An error occurred while updating token",
      },
      500
    );
  }
});

app.patch("/api/v1/unlink-accessToken", AuthMiddleware, async (c) => {
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());

    const body = await c.req.json();

    const id = c.get("id");

    // check if id is recieved
    if (!id) {
      return c.json(
        {
          message: "User ID not found",
        },
        400
      );
    }

    switch (body.fieldToNull) {
      case "OLA":
        await prisma.user.update({
          where: {
            id: id,
          },
          data: {
            OlaAccessToken: "",
          },
        });
        break;

      case "UBER":
        await prisma.user.update({
          where: {
            id: id,
          },
          data: {
            UberAccessToken: "",
          },
        });
        break;

      default:
        return c.json(
          {
            message: "Can't find the field" + body.fieldToNull,
          },
          400
        );
    }

    return c.json(
      {
        message: "Unlinked successfully: " + body.fieldToNull,
      },
      200
    );
  } catch (error) {
    console.error("An error occurred while unlinking", error);

    return c.json(
      {
        message: "An error occurred while unlinking",
      },
      500
    );
  }
});

app.post("/api/v1/book-now/ola", AuthMiddleware, async (c) => {
  try {
    const service_type_schema_result = ServiceTypeSchema.safeParse(
      c.req.query("service_type")
    );

    if (!service_type_schema_result.success) {
      return c.json({
        message: "Invalid service type",
      });
    }

    const category_schema_result = CategorySchema.safeParse(
      c.req.query("category")
    );

    if (!category_schema_result.success) {
      return c.json({
        message: "Invalid category",
      });
    }
    const category = category_schema_result.data;
    const service_type = service_type_schema_result.data;

    const body = await c.req.json();
    const geoLocation = CoordinatesSchema.safeParse(body);

    if (!geoLocation.success) {
      return c.json(
        {
          message: "Invalid coordinates",
        },
        400
      );
    }

    const kv = c.env.kv;
    const id = c.get("id");

    const cachedResponse: KVGetWithMetaData = await kv.getWithMetadata(
      id,
      "json"
    );

    if (cachedResponse.value && cachedResponse.metadata) {
      const cachedData = cachedResponse.value as {
        pickup_lat: number;
        pickup_long: number;
        drop_lat: number;
        drop_long: number;
        service_type: string;
        category: string;
      };
      if (
        cachedData.pickup_lat === geoLocation.data.pickup_lat &&
        cachedData.pickup_long === geoLocation.data.drop_long &&
        cachedData.drop_lat === geoLocation.data.drop_lat &&
        cachedData.drop_long === geoLocation.data.drop_long &&
        cachedData.service_type === service_type &&
        cachedData.category === category
      ) {
        return c.json({
          message: "Cached response",
          data: cachedResponse.metadata,
        });
      }
    }

    const response = await fetch(
      `https://devapi.olacabs.com/v1/products?pickup_lat=${geoLocation.data.pickup_lat}&pickup_lng=${geoLocation.data.pickup_long}&drop_lat=${geoLocation.data.drop_lat}&drop_lng=${geoLocation.data.drop_long}&service_type=${service_type}&category=${category}`,
      {
        method: "GET",

        headers: {
          Authorization: `Bearer ${c.env.X_APP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data: OlaResponse | { message: string; code: string } =
      await response.json();

    if ("code" in data) {
      if (data.code === "INVALID_CITY") {
        return c.json(
          {
            message: "Ola do not serve in this city",
          },
          400
        );
      }

      if (data.code === "INVALID_CITY_CAR_CATEGORY") {
        return c.json(
          {
            message: "No service available for this category in this city",
          },
          400
        );
      }
    } else {
      const rideDetails: RideDetails = {
        category: "",
        eta: 0,
        fare: 0,
      };

      rideDetails["category"] = data.ride_estimate[0].category;
      rideDetails["eta"] = data.categories[0].eta;
      rideDetails["fare"] = data.ride_estimate[0].upfront.fare;

      const requestBodyDetails = {
        ...geoLocation.data,
        category: category,
        service_type: service_type,
      };
      const requestBodyDetailsStringified = JSON.stringify(requestBodyDetails);

      await kv.put(id, requestBodyDetailsStringified, {
        expirationTtl: 5 * 60,
        metadata: rideDetails,
      });

      return c.json(
        {
          message: "Ola ride details fetched successfully",
          data: rideDetails,
        },
        200
      );
    }
  } catch (error) {
    console.error("An error occurred while fetching Ola ride details", error);
    return c.json(
      {
        message: "An error occurred while fetching Ola ride details",
      },
      500
    );
  }
});

export default app;
