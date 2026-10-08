import { afterEach, describe, expect, it, vi } from "vitest";
import { createSellerAccessRequest, getSellerAccessRequest, updateSellerAccessRequest } from "./api";

// The owner's phone managing a seller's login: online-only calls to
// /api/sync/sellers/[uuid]/access, never a thrown network error.

const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("acceso del vendedor desde el celular", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lee el acceso con el token y el uuid del vendedor", async () => {
    const fetchMock = respond(200, { user: { username: "ella", active: true } });
    vi.stubGlobal("fetch", fetchMock);
    expect(await getSellerAccessRequest("tok", "sel-1")).toEqual({ ok: true, data: { username: "ella", active: true } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/sync\/sellers\/sel-1\/access$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("crea y cambia la contraseña con el cuerpo esperado; los errores del servidor llegan como mensaje", async () => {
    const created = respond(201, { username: "ella", active: true });
    vi.stubGlobal("fetch", created);
    await createSellerAccessRequest("tok", "sel-1", "ella", "secreta123");
    expect(JSON.parse((created.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ username: "ella", password: "secreta123" });

    vi.stubGlobal("fetch", respond(409, { error: "Este vendedor ya tiene usuario" }));
    expect(await createSellerAccessRequest("tok", "sel-1", "ella", "secreta123")).toEqual({ ok: false, error: "Este vendedor ya tiene usuario" });

    const patched = respond(200, { username: "ella", active: true });
    vi.stubGlobal("fetch", patched);
    await updateSellerAccessRequest("tok", "sel-1", { password: "otraclave99" });
    const [, init] = patched.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ password: "otraclave99" });
  });

  it("sin conexión devuelve un mensaje, no lanza", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Network request failed"); }));
    const result = await getSellerAccessRequest("tok", "sel-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/internet/);
  });
});
