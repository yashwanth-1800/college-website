import { describe, expect, it } from "vitest";
import { isGoogleAuthEnabled } from "../lib/env";

describe("environment", () => {
  it("exposes a boolean Google configuration state", () => {
    expect(typeof isGoogleAuthEnabled).toBe("boolean");
  });
});
