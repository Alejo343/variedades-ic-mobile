// Matching rules for the Buscar tab (app/search/index.tsx).

// Lowercase, without accents, trimmed: "Categoría" and "categoria" are the
// same search.
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Items whose fields contain the query, best first:
//   0 — the first field (the name) starts with it,
//   1 — a word inside the first field starts with it,
//   2 — it appears anywhere in any field.
// Ties keep the input order. An empty query matches nothing.
export function rankMatches<T>(items: T[], query: string, fields: (item: T) => (string | null | undefined)[]): T[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  const ranked: { item: T; rank: number; index: number }[] = [];
  items.forEach((item, index) => {
    const values = fields(item).map((v) => (v ? normalizeSearch(v) : ''));
    if (!values.some((v) => v.includes(q))) return;
    const first = values[0] ?? '';
    const rank = first.startsWith(q) ? 0 : first.split(/\s+/).some((w) => w.startsWith(q)) ? 1 : 2;
    ranked.push({ item, rank, index });
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map((r) => r.item);
}

// "7" or "#7" finds record #7 (a sale or an order) — exactly that one, not
// #17 or #70.
export function matchesRecordNumber(id: number, query: string): boolean {
  const digits = query.trim().replace(/^#/, '');
  return /^\d+$/.test(digits) && Number(digits) === id;
}
