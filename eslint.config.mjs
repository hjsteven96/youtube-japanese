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
            // JSX 내에서 이스케이프되지 않은 HTML 엔티티 사용 허용
            "react/no-unescaped-entities": "off",
            // @ts-ignore 사용 허용
            "@typescript-eslint/ban-ts-comment": "off",
            // <img> 태그 사용 허용 (Next.js Image 컴포넌트 사용 권장 경고 비활성화)
            "@next/next/no-img-element": "off",
            // React Hook 종속성 경고 비활성화 (주의해서 사용)
            "react-hooks/exhaustive-deps": "off",
        },
    },
];

export default eslintConfig;
