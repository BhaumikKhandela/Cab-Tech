import { z } from "zod";

export const SignUpSchema = z.object({
  name: z.string(),
  email: z.string(),
  phoneNumber: z.string(),
});

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
