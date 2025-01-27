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
