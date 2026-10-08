import { describe, expect, it } from 'vitest';
import { endOfLocalDayUtc, toSqliteUtcTimestamp } from './format';

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

describe('endOfLocalDayUtc', () => {
  it('es el primer instante del día local siguiente, en UTC', () => {
    expect(endOfLocalDayUtc('2026-10-07')).toBe(toSqliteUtcTimestamp(new Date(2026, 9, 8)));
  });

  it('una venta a las 23:50 hora local queda dentro de ese día aunque en UTC ya sea el siguiente', () => {
    const lateSale = toSqliteUtcTimestamp(new Date(2026, 9, 7, 23, 50));
    expect(lateSale < endOfLocalDayUtc('2026-10-07')).toBe(true);
    expect(toSqliteUtcTimestamp(new Date(2026, 9, 8, 0, 5)) < endOfLocalDayUtc('2026-10-07')).toBe(false);
  });
});
