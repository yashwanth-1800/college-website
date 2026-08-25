import { NextResponse } from "next/server";
import { isDatabaseConfigured, isGoogleAuthEnabled } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    database: isDatabaseConfigured ? "configured" : "not-configured",
    migrations: "not-checked",
    googleAuthConfigured: isGoogleAuthEnabled,
    calendarIntegrationConfigured: isGoogleAuthEnabled,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
}
