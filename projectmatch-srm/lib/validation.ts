import { z } from "zod";

const safeText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);

export const projectInputSchema = z.object({
  title: safeText(3, 80),
  type: z.enum(["Hackathon", "Startup", "Research", "Coursework", "Club initiative", "Open Source"]),
  description: safeText(20, 500),
  commitment: safeText(1, 30),
  categories: z.array(safeText(1, 50)).min(1).max(12),
  openRoles: z.array(safeText(1, 80)).min(1).max(12),
});

export const messageInputSchema = safeText(1, 500);
export const applicationInputSchema = z.object({ role: safeText(1, 100), note: z.string().trim().max(400) });

export function parseStoredArray<T>(value: string | null, guard: (item: unknown) => item is T, limit = 100): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(guard).slice(-limit) : [];
  } catch { return []; }
}
