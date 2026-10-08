import { describe, expect, it } from "vitest";
import { scopeNeedsFullPull, scopeOf } from "./scope-rules";

describe("alcance del pull", () => {
  it("resuelve el alcance por rol y tipo de vendedor", () => {
    expect(scopeOf("owner", undefined)).toBe("owner");
    expect(scopeOf("seller", "store")).toBe("seller:store");
    expect(scopeOf("seller", "consignment")).toBe("seller:consignment");
    expect(scopeOf("seller", null)).toBeNull(); // su ficha aún no llega
  });

  it("solo un cambio entre dos alcances conocidos pide traer todo de nuevo", () => {
    expect(scopeNeedsFullPull("seller:consignment", "seller:store")).toBe(true);
    expect(scopeNeedsFullPull("seller:store", "seller:store")).toBe(false);
    expect(scopeNeedsFullPull(null, "seller:store")).toBe(false); // primera sync: ya arranca de cero
    expect(scopeNeedsFullPull("seller:store", null)).toBe(false);
  });
});
