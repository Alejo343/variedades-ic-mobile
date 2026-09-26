import { describe, expect, it } from "vitest";
import { extractErrorMessage } from "./api";

// Pure parsing of the two error shapes the server sends (see the web's
// SellerAccessCard.tsx#errorMessage, ported here for the phone's login/push
// clients): a plain string, or a zod .flatten() object.
describe("extractErrorMessage", () => {
  it("devuelve el string tal cual", () => {
    expect(extractErrorMessage({ error: "Usuario o contraseña incorrectos" })).toBe("Usuario o contraseña incorrectos");
  });

  it("toma el primer formErrors de un flatten() de zod", () => {
    expect(extractErrorMessage({ error: { formErrors: ["El usuario es requerido"], fieldErrors: {} } })).toBe(
      "El usuario es requerido",
    );
  });

  it("si no hay formErrors, toma el primer fieldErrors", () => {
    expect(extractErrorMessage({ error: { formErrors: [], fieldErrors: { password: ["Muy corta"] } } })).toBe("Muy corta");
  });

  it("devuelve null si no hay nada reconocible", () => {
    expect(extractErrorMessage({})).toBeNull();
    expect(extractErrorMessage(null)).toBeNull();
    expect(extractErrorMessage({ error: {} })).toBeNull();
  });
});
