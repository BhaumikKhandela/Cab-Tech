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

export const CategorySchema = z.enum([
  "micro",
  "mini",
  "share",
  "prime",
  "suv",
  "prime_play",
  "auto",
  "lux",
  "rental",
  "outstation",
  "sedan",
  "exec",
  "bike",
  "erick",
  "kp",
  "electric_vehicle",
  "cool_cab",
]);

export const ServiceTypeSchema = z.enum(["p2p", "rental", "outstation"]);

export const AccessTokenSchema = z.object({
  accessToken: z.string(),
  name: z.enum(["OLA", "UBER", "MERUCABS", "RAPIDO"]),
});

export type AccessTokenSchemaType = z.infer<typeof AccessTokenSchema>;

export const CoordinatesSchema = z.object({
  pickup_lat: z.number().min(-90).max(90),
  pickup_long: z.number().min(-180).max(180),
  drop_lat: z.number().min(-90).max(90),
  drop_long: z.number().min(-180).max(180),
});
