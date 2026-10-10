import { describe, expect, it } from 'vitest';

import { toSqliteUtcTimestamp } from './format';
import { changeVsPrevious, dailySalesTotals, topSoldProducts } from './home-summary';

// A sale at a local wall-clock time, stored as UTC text like the real rows.
function at(localDate: string, hour: number) {
  const [y, m, d] = localDate.split('-').map(Number);
  return toSqliteUtcTimestamp(new Date(y, m - 1, d, hour, 0, 0));
}

describe('dailySalesTotals', () => {
  it('returns one bucket per local day, oldest first, ending today', () => {
    const sales = [
      { saleDate: at('2026-10-09', 9), totalAmount: 1000 },
      { saleDate: at('2026-10-09', 22), totalAmount: 500 }, // after 7 p. m. still counts for the 9th
      { saleDate: at('2026-10-07', 12), totalAmount: 300 },
      { saleDate: at('2026-10-01', 12), totalAmount: 999 }, // outside the window
    ];
    expect(dailySalesTotals(sales, '2026-10-09', 3)).toEqual([
      { date: '2026-10-07', total: 300, count: 1 },
      { date: '2026-10-08', total: 0, count: 0 },
      { date: '2026-10-09', total: 1500, count: 2 },
    ]);
  });
});

describe('changeVsPrevious', () => {
  it('is the rounded percent change', () => {
    expect(changeVsPrevious(150, 100)).toBe(50);
    expect(changeVsPrevious(50, 100)).toBe(-50);
    expect(changeVsPrevious(100, 300)).toBe(-67);
  });

  it('is null when there is nothing to compare with', () => {
    expect(changeVsPrevious(100, 0)).toBeNull();
    expect(changeVsPrevious(0, 0)).toBeNull();
  });
});

describe('topSoldProducts', () => {
  const sales = [
    { saleDate: at('2026-10-09', 10), items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }] },
    { saleDate: at('2026-10-05', 10), items: [{ productId: 2, quantity: 4 }] },
    { saleDate: at('2026-09-01', 10), items: [{ productId: 3, quantity: 50 }] }, // before `since`
  ];

  it('adds units per product since a local day, most sold first', () => {
    expect(topSoldProducts(sales, '2026-10-01', 5)).toEqual([
      { productId: 2, quantity: 5 },
      { productId: 1, quantity: 2 },
    ]);
  });

  it('respects the limit', () => {
    expect(topSoldProducts(sales, '2026-10-01', 1)).toEqual([{ productId: 2, quantity: 5 }]);
  });
});
