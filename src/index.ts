import { PrismaClient } from "@prisma/client";
import { decode, sign, verify } from "hono/jwt";
import { Hono } from "hono";
import { SignUpSchema } from "./zod-types/zodTypes";

const app = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
}>();

app.post("/api/v1/signup", async (c) => {
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    });

    const body = c.req.json();

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

      const payload = {
        sub: user.id,
        role: "user",
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };

      const jwtToken = await sign(payload, c.env.JWT_SECRET);

      return c.json({
        message: "User created successfully",
        userId: user.id,
        token: jwtToken,
      });
    } catch (error) {
      console.error("Primsa error", error);

      return c.json({
        message: "Can't create the user",
      });
    }
  } catch (error) {
    console.error("Connection to Prisma Client failed", error);
  }
});

export default app;
