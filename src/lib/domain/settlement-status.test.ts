import { describe, expect, it } from "vitest";
import { canTransitionSettlement } from "./settlement-status";

describe("canTransitionSettlement", () => {
  it("permite pendiente -> liquidada", () => {
    expect(canTransitionSettlement("pendiente", "liquidada")).toBe(true);
  });

  it("rechaza liquidada -> cualquier estado (terminal)", () => {
    expect(canTransitionSettlement("liquidada", "pendiente")).toBe(false);
    expect(canTransitionSettlement("liquidada", "liquidada")).toBe(false);
  });

  it("rechaza pendiente -> pendiente (no-op)", () => {
    expect(canTransitionSettlement("pendiente", "pendiente")).toBe(false);
  });
});
