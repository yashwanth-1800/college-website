import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/", "/projects", "/people", "/u/", "/t/"], disallow: ["/dashboard", "/messages", "/onboarding"] }, sitemap: `${env.NEXT_PUBLIC_APP_URL}/sitemap.xml` };
}

