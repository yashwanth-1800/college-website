import { describe, expect, it } from "vitest";
import { applicationInputSchema, messageInputSchema, projectInputSchema } from "../lib/validation";

describe("mutation validation", () => {
  it("rejects blank and oversized chat content", () => {
    expect(messageInputSchema.safeParse("   ").success).toBe(false);
    expect(messageInputSchema.safeParse("x".repeat(501)).success).toBe(false);
  });

  it("rejects incomplete projects and excessive roles", () => {
    const base = { title: "Useful project", type: "Research", description: "A sufficiently detailed student project description.", commitment: "6 hrs/week", categories: ["IoT"], openRoles: ["Engineer"] };
    expect(projectInputSchema.safeParse(base).success).toBe(true);
    expect(projectInputSchema.safeParse({ ...base, openRoles: Array.from({ length: 13 }, (_, index) => "Role " + String(index)) }).success).toBe(false);
  });

  it("trims valid application input and rejects missing roles", () => {
    expect(applicationInputSchema.parse({ role: "  Designer ", note: " hello " })).toEqual({ role: "Designer", note: "hello" });
    expect(applicationInputSchema.safeParse({ role: "", note: "" }).success).toBe(false);
  });
});
