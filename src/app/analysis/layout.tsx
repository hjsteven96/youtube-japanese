// src/app/analysis/layout.tsx

import type { ReactNode } from "react";

// 이 레이아웃은 자식들을 감싸는 역할만 합니다.
export default function AnalysisLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
