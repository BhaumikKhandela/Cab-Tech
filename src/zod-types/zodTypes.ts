import { z } from "zod";

export const SignUpSchema = z.object({
  email: z
    .string()
    .email({ message: "Invalid email address" })
    .nonempty({ message: "Email is required" }),
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .max(100, { message: "Name must be less than 100 characters" }),
  phoneNumber: z
    .string()
    .regex(/^\d{10}$/, { message: "Phone number must be exactly 10 digits" }),
});

export const AccessTokenSchema = z.object({
  accessToken: z.string(),
  name: z.enum(["OLA", "UBER", "MERUCABS", "RAPIDO"]),
});

export type AccessTokenSchemaType = z.infer<typeof AccessTokenSchema>;
