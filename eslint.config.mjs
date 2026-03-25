import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["coverage/**"],
  },
  {
    rules: {
      "linebreak-style": 0,
      indent: "off",
      "no-undef": "off",
      "no-console": "off",
      camelcase: "off",
      "object-curly-newline": "off",
      "no-use-before-define": "off",
      "no-restricted-syntax": "off",
      "no-await-in-loop": "off",
      "arrow-body-style": "off",
      "max-len": [
        "error",
        { code: 150, ignoreComments: true, ignoreUrls: true },
      ],
      "no-unused-vars": "off",
      "implicit-arrow-linebreak": "off",
      "function-paren-newline": "off",
      "react-hooks/static-components": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/component-hook-factories": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/immutability": "off",
      "react-hooks/globals": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/config": "off",
      "react-hooks/gating": "off",
    },
  },
];

export default eslintConfig;
