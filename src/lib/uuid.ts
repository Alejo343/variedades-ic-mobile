// Random v4 UUID used as the sync identity of every row (see CLAUDE.md,
// "Fase 10"). Node (Vitest, drizzle-kit loading schema.ts) has a global
// crypto.randomUUID; React Native doesn't, so expo-crypto is only required
// there — importing it at the top would break schema.ts under plain Node.
export function newUuid(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (webCrypto?.randomUUID) return webCrypto.randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomUUID } = require("expo-crypto") as typeof import("expo-crypto");
  return randomUUID();
}
