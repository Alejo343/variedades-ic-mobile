// Only place to change where the phone syncs against. Production by default;
// override here for a local dev server while working on the sync engine
// (never commit a non-production value — no env var plumbing exists for this
// yet, and the project avoids adding it before it's actually needed).
export const SYNC_BASE_URL = 'https://icvariedades.com';
