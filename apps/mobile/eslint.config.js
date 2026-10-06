// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Screens load their data in an effect and set it when it arrives;
    // that is the pattern, not a cascade.
    rules: { "react-hooks/set-state-in-effect": "off" },
  }
]);
