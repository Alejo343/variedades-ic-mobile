// Avoids Intl.NumberFormat currency style, whose ICU data isn't reliably
// bundled with Hermes on Android — plain grouping is enough for COP (no decimals).
export function formatCOP(amount: number): string {
  const rounded = Math.round(amount);
  const grouped = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${rounded < 0 ? '-' : ''}$${grouped}`;
}

export function stockLabel(stock: number, minStock: number): string {
  if (stock === 0) return ' · agotado';
  if (minStock > 0 && stock <= minStock) return ' · stock bajo';
  return '';
}
