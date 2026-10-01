import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/", "dice-demo/", "node_modules/"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
  },
];
