import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // 사용되지 않는 변수에 대한 경고 비활성화
      "@typescript-eslint/no-unused-vars": "off",
      // const 대신 let 사용에 대한 경고 비활성화
      "prefer-const": "off",
      // any 타입 사용에 대한 경고 비활성화
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
