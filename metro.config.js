// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// drizzle-orm/expo-sqlite migrations are imported as raw .sql files —
// Metro needs to know to bundle them as source, not treat them as unknown assets.
config.resolver.sourceExts.push('sql');

module.exports = config;
