import js from "@eslint/js";
import babelParser from "@babel/eslint-parser";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  {
    files: ["src/**/*.{ts,tsx}", "app-roles.ts", "app-data.ts"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          parserOpts: { plugins: ["typescript", "jsx"] },
        },
      },
    },
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    settings: {
      "jsx-a11y": {
        components: {
          Button: "button",
          Input: "input",
          Link: "a",
          NavLink: "a",
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // Named scroll regions must remain reachable from the keyboard.
      "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["region"] }],
      // TypeScript checks bindings and unused symbols, including type-only names.
      "no-undef": "off",
      "no-unused-vars": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "jsx-a11y/anchor-is-valid": [
        "error",
        {
          components: ["Link", "NavLink"],
          specialLink: ["to"],
          aspects: ["invalidHref", "preferButton"],
        },
      ],
    },
  },
];
