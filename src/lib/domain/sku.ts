export function getSkuPrefix(categoryName?: string | null): string {
  if (!categoryName || !categoryName.trim()) {
    return "GEN";
  }
  const letters = categoryName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return letters.slice(0, 4) || "GEN";
}

export function formatSku(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(5, "0")}`;
}
