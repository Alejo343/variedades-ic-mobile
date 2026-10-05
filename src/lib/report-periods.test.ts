import { describe, expect, it } from 'vitest';

import { formatRangeLabel, periodRange } from './report-periods';

// Saturday 4 Oct 2026, local time.
const TODAY = new Date(2026, 9, 4, 15, 30);

describe('periodRange', () => {
  it('today is a single local day', () => {
    expect(periodRange('today', TODAY)).toEqual({ from: '2026-10-04', to: '2026-10-04' });
  });

  it('last7 includes today and the 6 days before it', () => {
    expect(periodRange('last7', TODAY)).toEqual({ from: '2026-09-28', to: '2026-10-04' });
  });

  it('thisMonth starts on the 1st', () => {
    expect(periodRange('thisMonth', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-04' });
  });

  it('lastMonth covers the whole previous month', () => {
    expect(periodRange('lastMonth', TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('lastMonth crosses the year boundary in January', () => {
    expect(periodRange('lastMonth', new Date(2027, 0, 15))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('thisYear starts on January 1st', () => {
    expect(periodRange('thisYear', TODAY)).toEqual({ from: '2026-01-01', to: '2026-10-04' });
  });

  it('all has no bounds', () => {
    expect(periodRange('all', TODAY)).toEqual({});
  });
});

describe('formatRangeLabel', () => {
  it('formats a single day, a same-year range, a cross-year range and all time', () => {
    expect(formatRangeLabel({ from: '2026-10-04', to: '2026-10-04' })).toBe('4 oct 2026');
    expect(formatRangeLabel({ from: '2026-09-28', to: '2026-10-04' })).toBe('28 sep – 4 oct 2026');
    expect(formatRangeLabel({ from: '2026-12-01', to: '2027-01-15' })).toBe('1 dic 2026 – 15 ene 2027');
    expect(formatRangeLabel({})).toBe('Todo el historial');
  });
});
