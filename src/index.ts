import { PrismaClient } from "@prisma/client";
import { decode, sign, verify } from "hono/jwt";
import { Context, Hono, Next } from "hono";
import { AccessTokenSchema, SignUpSchema } from "./zod-types/zodTypes";
import { generateOtp } from "./utils/otpUtils";
import { cors } from "hono/cors";
import { JwtTokenExpired } from "hono/utils/jwt/types";

interface MyContext extends Context {
  id?: string;
}

const app = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
    kv: KVNamespace;
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
      return c.json({
        message: "Token has expired",
      });
    }
    return c.json({
      message: "User not recognized",
    });
  }
};

app.post("/api/v1/signup", async (c) => {
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    });

    const kv = c.env.kv;

    const body = await c.req.json();

    try {
      const result = SignUpSchema.safeParse(body);
      if (!result.success) {
        return c.json({ message: "Invalid signup data", error: result.error });
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
    } catch (error) {
      console.error("Phone number exists", error);

      return c.json({
        message: "Can't create the user",
      });
    }
  } catch (error) {
    console.error("Connection to Prisma Client failed", error);
  }
});

app.post("/api/v1/generate-otp", async (c) => {
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    });

    const body = await c.req.json();

    const user = await prisma.user.findUnique({
      where: {
        phoneNumber: body.phoneNumber,
      },
    });

    if (!user) {
      return c.json({
        message: "User not found",
      });
    }
    const kv = c.env.kv;

    const otp = generateOtp();

    await kv.put(user?.id, otp);
  } catch (error) {
    return c.json({
      message: "Can't connect to Prisma",
    });
  }
});

app.post("/api/v1/verify-otp", async (c) => {
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    });

    const body = await c.req.json();

    const kv = c.env.kv;

    const otp = await kv.get(body.id);

    if (otp !== body.otp) {
      return c.json({
        message: "Invalid OTP, please try again",
      });
    }

    const payload = {
      sub: body.id,
      role: "user",
      exp: Math.floor(Date.now() / 1000 + 30 * 24 * 60 * 60),
    };

    const token = await sign(payload, c.env.JWT_SECRET);

    return c.json({
      message: "Phone number verified",
      token,
    });
  } catch (error) {
    console.error("An error occurred while verifying OTP", error);
    return c.json({
      message: "An error occurred while verifying otp",
    });
  }
});

app.patch("/api/v1/set-accessToken", AuthMiddleware, async (c) => {
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    });

    const body = await c.req.json();
    const id = c.get("id");

    if (!id) {
      return c.json({
        message: "Can't get the id",
      });
    }
    const tokenDetails = AccessTokenSchema.safeParse(body);

    if (!tokenDetails.success) {
      return c.json({
        message: "Invalid body",
      });
    }

    switch (tokenDetails.data.accessToken) {
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
        return c.json({
          message: "Invalid access token",
        });
    }

    return c.json({
      message: "Token updated successfully",
    });
  } catch (error) {
    console.error("An error occurred", error);
    return c.json({
      message: "An error occurred",
    });
  }
});

app.patch("/api/v1/unlink-accessToken", AuthMiddleware, async (c) => {
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    });

    const body = await c.req.json();

    const id = c.get("id");

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
        return c.json({
          message: "Can't find the field" + body.fieldToNull,
        });
    }

    return c.json({
      message: "Unlinked successfully: " + body.fieldToNull,
    });
  } catch (error) {
    console.error("An error occurred while unlinking", error);

    return c.json({
      message: "An error occurred while unlinking",
    });
  }
});

export default app;
