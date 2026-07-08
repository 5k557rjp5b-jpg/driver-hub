// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // Data-fetching hooks intentionally load state inside effects on mount.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
