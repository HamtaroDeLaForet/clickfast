import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.browser, ...globals.node, ...globals.jest },
    },
    rules: {
      semi: ["error", "always"],
    },
  },
];
