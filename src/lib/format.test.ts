import { describe, expect, it } from 'vitest';
import { toSqliteUtcTimestamp } from './format';

// Bug real (sesión 2026-10-03): markSettled enviaba settledAt con
// `new Date().toISOString()` ("...T...Z"), que el servidor rechazaba
// ("Fecha con formato inválido") porque su esquema exige el mismo formato
// que SQLite ya usa para createdAt: "YYYY-MM-DD HH:MM:SS".
describe('toSqliteUtcTimestamp', () => {
  it('convierte una fecha ISO con milisegundos y Z al formato de SQLite', () => {
    const date = new Date('2026-10-03T16:30:05.123Z');
    expect(toSqliteUtcTimestamp(date)).toBe('2026-10-03 16:30:05');
  });

  it('coincide con el regex del servidor (utcTimestamp)', () => {
    const formatted = toSqliteUtcTimestamp(new Date());
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
