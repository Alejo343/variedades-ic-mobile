import { describe, expect, it, vi } from "vitest";
import { bumpDataVersion, dataVersionStore } from "./data-version";

// The counter open screens watch to reload after a background sync: it only
// moves forward, and every subscriber hears each bump until it unsubscribes.

describe("dataVersionStore", () => {
  it("bumpDataVersion sube la versión y avisa a los suscriptores", () => {
    const before = dataVersionStore.getSnapshot();
    const listener = vi.fn();
    const unsubscribe = dataVersionStore.subscribe(listener);

    bumpDataVersion();
    expect(dataVersionStore.getSnapshot()).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    bumpDataVersion();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
