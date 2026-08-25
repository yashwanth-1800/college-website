import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  AUTH_TRUST_HOST: z.enum(["true", "false"]).default("true"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DEV_AUTH_BYPASS: z.enum(["true", "false"]).default("false"),
});

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}. Check .env.example.`);
}

export const env = parsed.data;
export const isGoogleAuthEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
export const isDatabaseConfigured = Boolean(env.DATABASE_URL && env.DIRECT_URL);

export function assertProductionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") return;
  const required = ["DATABASE_URL", "DIRECT_URL", "AUTH_SECRET"] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variable(s): ${missing.join(", ")}. Add them in Vercel and redeploy.`);
  }
}
