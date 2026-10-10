import { describe, expect, it } from 'vitest';

import { matchesRecordNumber, normalizeSearch, rankMatches } from './search';

describe('normalizeSearch', () => {
  it('lowercases, drops accents and trims', () => {
    expect(normalizeSearch('  Categoría ÑANDÚ ')).toBe('categoria nandu');
  });
});

describe('rankMatches', () => {
  const items = [
    { name: 'Cepillo de baño', sku: 'BAN-0001', code: null },
    { name: 'Baño portátil', sku: 'BAN-0002', code: 'X-77' },
    { name: 'Jabón', sku: 'ASE-0003', code: 'bano-9' },
    { name: 'Rana', sku: 'JUG-0004', code: null },
  ];
  const fields = (i: (typeof items)[number]) => [i.name, i.sku, i.code];

  it('finds a query in any field, ignoring accents and case', () => {
    expect(rankMatches(items, 'BANO', fields).map((i) => i.name)).toEqual(['Baño portátil', 'Cepillo de baño', 'Jabón']);
    expect(rankMatches(items, 'x-77', fields).map((i) => i.name)).toEqual(['Baño portátil']);
  });

  it('puts a match at the start of the first field first, then a word start, then anywhere', () => {
    const words = [{ n: 'Portabaños' }, { n: 'Kit de baño' }, { n: 'Baño' }];
    expect(rankMatches(words, 'baño', (w) => [w.n]).map((w) => w.n)).toEqual(['Baño', 'Kit de baño', 'Portabaños']);
  });

  it('keeps the original order between equally ranked items', () => {
    const list = [{ n: 'Rana verde' }, { n: 'Rana azul' }];
    expect(rankMatches(list, 'rana', (w) => [w.n]).map((w) => w.n)).toEqual(['Rana verde', 'Rana azul']);
  });

  it('returns nothing for an empty query', () => {
    expect(rankMatches(items, '   ', fields)).toEqual([]);
  });
});

describe('matchesRecordNumber', () => {
  it('matches "7" or "#7" to record 7 only, not 17 or 70', () => {
    expect(matchesRecordNumber(7, '7')).toBe(true);
    expect(matchesRecordNumber(7, '#7')).toBe(true);
    expect(matchesRecordNumber(17, '7')).toBe(false);
    expect(matchesRecordNumber(70, '#7')).toBe(false);
  });

  it('ignores queries that are not a number', () => {
    expect(matchesRecordNumber(7, 'rana')).toBe(false);
    expect(matchesRecordNumber(7, '#')).toBe(false);
  });
});
