import { describe, expect, it, vi } from "vitest";
import { createMigratedTestDb } from "./test-db";

// A transfer between accounts: two cash movements (gasto in the origin,
// ingreso in the destination) with sourceType 'transferencia', and one
// createCashTransfer in the outbox carrying both rows' uuids — the server
// creates the same two rows (lib/sync/operations/cash-sales.ts in the web).

const { raw, db: proxy } = createMigratedTestDb();
raw.exec(`
  INSERT INTO cash_accounts (uuid, name) VALUES ('acc-caja', 'Caja');
  INSERT INTO cash_accounts (uuid, name, type) VALUES ('acc-nequi', 'Nequi', 'banco');
`);

vi.mock("./db", () => ({ get db() { return proxy; } }));

const id = (uuid: string) => (raw.prepare("SELECT id FROM cash_accounts WHERE uuid = ?").get(uuid) as { id: number }).id;
const movements = () =>
  raw.prepare("SELECT uuid, type, amount, concept, source_type AS sourceType, account_id AS accountId, notes FROM cash_movements ORDER BY id").all() as {
    uuid: string; type: string; amount: number; concept: string; sourceType: string; accountId: number; notes: string | null;
  }[];
const outbox = () => raw.prepare("SELECT type, payload FROM sync_outbox ORDER BY id").all() as { type: string; payload: string }[];

describe("localCashRepo.transfer", async () => {
  const { localCashRepo } = await import("./cash-repo");
  const caja = id("acc-caja");
  const nequi = id("acc-nequi");

  it("crea el gasto y el ingreso de la transferencia y encola una sola operación con sus uuid", async () => {
    await localCashRepo.transfer({ fromAccountId: caja, toAccountId: nequi, amount: 70000, notes: "Consignación" });

    const rows = movements();
    expect(rows.map(({ type, amount, concept, sourceType, accountId, notes }) => ({ type, amount, concept, sourceType, accountId, notes }))).toEqual([
      { type: "gasto", amount: 70000, concept: "Transferencia: Caja → Nequi", sourceType: "transferencia", accountId: caja, notes: "Consignación" },
      { type: "ingreso", amount: 70000, concept: "Transferencia: Caja → Nequi", sourceType: "transferencia", accountId: nequi, notes: "Consignación" },
    ]);
    expect(await localCashRepo.getBalance()).toBe(0);

    const ops = outbox();
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("createCashTransfer");
    const payload = JSON.parse(ops[0].payload);
    expect(payload).toMatchObject({
      fromAccountUuid: "acc-caja",
      toAccountUuid: "acc-nequi",
      amount: 70000,
      notes: "Consignación",
      outMovementUuid: rows[0].uuid,
      inMovementUuid: rows[1].uuid,
    });
    expect(payload.transferDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("rechaza la misma cuenta sin escribir nada", async () => {
    const before = movements().length;
    await expect(localCashRepo.transfer({ fromAccountId: caja, toAccountId: caja, amount: 10 })).rejects.toThrow("distintas");
    expect(movements()).toHaveLength(before);
    expect(outbox()).toHaveLength(1);
  });
});
