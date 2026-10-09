import { describe, expect, it } from 'vitest';
import { endOfLocalDayUtc, formatDateTime, isOnLocalDay, toSqliteUtcTimestamp } from './format';

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

describe('isOnLocalDay', () => {
  it('incluye una venta de las 23:50 hora local en ese día y excluye la de las 00:05 del siguiente', () => {
    expect(isOnLocalDay(toSqliteUtcTimestamp(new Date(2026, 9, 7, 23, 50)), '2026-10-07')).toBe(true);
    expect(isOnLocalDay(toSqliteUtcTimestamp(new Date(2026, 9, 7, 0, 0)), '2026-10-07')).toBe(true);
    expect(isOnLocalDay(toSqliteUtcTimestamp(new Date(2026, 9, 8, 0, 5)), '2026-10-07')).toBe(false);
    expect(isOnLocalDay(toSqliteUtcTimestamp(new Date(2026, 9, 6, 23, 59)), '2026-10-07')).toBe(false);
  });
});

describe('formatDateTime', () => {
  it('muestra la fecha y la hora locales en formato de 12 horas', () => {
    expect(formatDateTime(toSqliteUtcTimestamp(new Date(2026, 9, 8, 15, 40)))).toBe('8 oct · 3:40 p. m.');
    expect(formatDateTime(toSqliteUtcTimestamp(new Date(2026, 0, 2, 0, 5)))).toBe('2 ene · 12:05 a. m.');
    expect(formatDateTime(toSqliteUtcTimestamp(new Date(2026, 11, 31, 12, 0)))).toBe('31 dic · 12:00 p. m.');
  });
});
