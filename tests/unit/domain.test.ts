import { describe, expect, it } from "vitest";
import { PROJECT_PHASES, VERTICALS } from "@/types/domain";

describe("dominio base de Vectus Projects", () => {
  it("expone fases F0..F6", () => {
    expect(PROJECT_PHASES).toEqual(["F0", "F1", "F2", "F3", "F4", "F5", "F6"]);
  });

  it("expone verticales obligatorias", () => {
    expect(VERTICALS).toHaveLength(4);
  });
});