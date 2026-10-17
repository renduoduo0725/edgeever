const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// The DOM editor ships the same offline WOFF2 card fonts as the Web client.
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, "woff2"])];

module.exports = config;
