import { describe, expect, it } from "vitest";
import { canAdvancePhase } from "@/server/auth/authorization";
import { isAdjacentPhaseTransition } from "@/server/gates/transition";

describe("phase transition policy", () => {
  it("allows only sequential phase changes", () => {
    expect(isAdjacentPhaseTransition("F0", "F1")).toBe(true);
    expect(isAdjacentPhaseTransition("F1", "F3")).toBe(false);
    expect(isAdjacentPhaseTransition("F2", "F2")).toBe(false);
  });

  it("allows advance only for Operations area", () => {
    expect(
      canAdvancePhase({
        id: "u1",
        email: "ops@vectus.local",
        role: "USER",
        area: "OPERATIONS",
      }),
    ).toBe(true);

    expect(
      canAdvancePhase({
        id: "u2",
        email: "comercial@vectus.local",
        role: "USER",
        area: "COMMERCIAL",
      }),
    ).toBe(false);
  });
});