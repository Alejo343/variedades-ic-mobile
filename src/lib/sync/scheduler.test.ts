import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncScheduler, type SchedulerOptions } from "./scheduler";

// createSyncScheduler decides WHEN a sync round runs (sync reactiva, Fase 10).
// Contract:
// - auto(): no-op without a session, and that no-op must not consume the
//   throttle (the bug that left a fresh login unsynced); throttled otherwise.
// - immediate(): always runs with a session (login), ignoring the throttle.
// - localWrite(): debounced (a burst of writes → one run), not throttled, and
//   retries later if a round is already running instead of piggybacking on it.

const OPTIONS: SchedulerOptions = { minIntervalMs: 30_000, localWriteDebounceMs: 2_000, busyRetryMs: 1_000 };

let authenticated: boolean;
let running: boolean;
let run: ReturnType<typeof vi.fn<() => Promise<unknown>>>;

function make() {
  return createSyncScheduler({ run, isAuthenticated: () => authenticated, isRunning: () => running, now: () => Date.now() }, OPTIONS);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
  authenticated = true;
  running = false;
  run = vi.fn(async () => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("auto()", () => {
  it("sin sesión no corre ni gasta la ventana del freno", () => {
    const s = make();
    authenticated = false;
    expect(s.auto()).toBe(false);
    authenticated = true;
    expect(s.auto()).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("no repite dentro de los 30 s, sí después", () => {
    const s = make();
    expect(s.auto()).toBe(true);
    vi.advanceTimersByTime(29_000);
    expect(s.auto()).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(s.auto()).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("un error de la corrida no se escapa como promesa rechazada", async () => {
    run = vi.fn(async () => { throw new Error("boom"); });
    const s = make();
    expect(s.auto()).toBe(true);
    await vi.runAllTimersAsync();
  });
});

describe("immediate()", () => {
  it("corre aunque una automática acabe de correr (login)", () => {
    const s = make();
    s.auto();
    s.immediate();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("sin sesión no corre", () => {
    authenticated = false;
    make().immediate();
    expect(run).not.toHaveBeenCalled();
  });

  it("cuenta para el freno: una automática justo después no repite", () => {
    const s = make();
    s.immediate();
    expect(s.auto()).toBe(false);
  });
});

describe("localWrite()", () => {
  it("espera el debounce y junta varias escrituras seguidas en una sola corrida", () => {
    const s = make();
    s.localWrite();
    vi.advanceTimersByTime(1_500);
    s.localWrite();
    vi.advanceTimersByTime(1_999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("no la frena una automática reciente", () => {
    const s = make();
    s.auto();
    s.localWrite();
    vi.advanceTimersByTime(2_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("si ya hay una corrida en curso, reintenta cuando termine", () => {
    const s = make();
    running = true;
    s.localWrite();
    vi.advanceTimersByTime(2_000);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(run).not.toHaveBeenCalled();
    running = false;
    vi.advanceTimersByTime(1_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("sin sesión al vencer el debounce no corre", () => {
    const s = make();
    s.localWrite();
    authenticated = false;
    vi.advanceTimersByTime(2_000);
    expect(run).not.toHaveBeenCalled();
  });

  it("dispose() cancela una escritura pendiente", () => {
    const s = make();
    s.localWrite();
    s.dispose();
    vi.advanceTimersByTime(5_000);
    expect(run).not.toHaveBeenCalled();
  });
});
