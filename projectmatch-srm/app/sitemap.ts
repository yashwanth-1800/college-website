import type { MetadataRoute } from "next";
import { people, projects } from "@/lib/demo-data";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_APP_URL;
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/projects`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/people`, changeFrequency: "daily", priority: 0.8 },
    ...people.map((person) => ({ url: `${base}/u/${person.handle}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...projects.map((project) => ({ url: `${base}/t/${project.id}/dna`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}

