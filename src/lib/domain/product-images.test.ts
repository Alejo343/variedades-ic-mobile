import { describe, expect, it } from "vitest";
import {
  addImage,
  normalizeImages,
  primaryImageUrl,
  removeImage,
  setPrimaryImage,
  type ImageDraft,
} from "./product-images";

const a: ImageDraft = { url: "a.jpg", isPrimary: true };
const b: ImageDraft = { url: "b.jpg", isPrimary: false };
const c: ImageDraft = { url: "c.jpg", isPrimary: false };

describe("normalizeImages", () => {
  it("promueve la primera foto si ninguna es principal", () => {
    expect(normalizeImages([{ ...a, isPrimary: false }, b])).toEqual([
      { url: "a.jpg", isPrimary: true },
      { url: "b.jpg", isPrimary: false },
    ]);
  });

  it("deja solo la primera principal si hay varias marcadas", () => {
    expect(normalizeImages([b, { ...c, isPrimary: true }, a])).toEqual([
      { url: "b.jpg", isPrimary: false },
      { url: "c.jpg", isPrimary: true },
      { url: "a.jpg", isPrimary: false },
    ]);
  });

  it("una lista vacía sigue vacía", () => {
    expect(normalizeImages([])).toEqual([]);
  });
});

describe("addImage", () => {
  it("la primera foto agregada queda como principal", () => {
    expect(addImage([], "a.jpg")).toEqual([{ url: "a.jpg", isPrimary: true }]);
  });

  it("las siguientes se agregan al final sin cambiar la principal", () => {
    expect(addImage([a], "b.jpg")).toEqual([a, b]);
  });

  it("no muta la lista original", () => {
    const list = [a];
    addImage(list, "b.jpg");
    expect(list).toEqual([a]);
  });
});

describe("removeImage", () => {
  it("quitar una foto no principal mantiene la principal", () => {
    expect(removeImage([a, b, c], 1)).toEqual([a, c]);
  });

  it("quitar la principal promueve la primera restante", () => {
    expect(removeImage([a, b, c], 0)).toEqual([
      { url: "b.jpg", isPrimary: true },
      { url: "c.jpg", isPrimary: false },
    ]);
  });

  it("quitar la única foto deja la lista vacía", () => {
    expect(removeImage([a], 0)).toEqual([]);
  });

  it("un índice fuera de rango no cambia nada", () => {
    expect(removeImage([a, b], 5)).toEqual([a, b]);
  });
});

describe("setPrimaryImage", () => {
  it("marca la foto elegida como única principal", () => {
    expect(setPrimaryImage([a, b, c], 2)).toEqual([
      { url: "a.jpg", isPrimary: false },
      { url: "b.jpg", isPrimary: false },
      { url: "c.jpg", isPrimary: true },
    ]);
  });

  it("un índice fuera de rango no cambia nada", () => {
    expect(setPrimaryImage([a, b], -1)).toEqual([a, b]);
  });
});

describe("primaryImageUrl", () => {
  it("devuelve la principal aunque no sea la primera", () => {
    expect(primaryImageUrl([b, { ...c, isPrimary: true }])).toBe("c.jpg");
  });

  it("sin principal marcada, devuelve la primera", () => {
    expect(primaryImageUrl([b, c])).toBe("b.jpg");
  });

  it("sin fotos devuelve null", () => {
    expect(primaryImageUrl([])).toBeNull();
  });
});
