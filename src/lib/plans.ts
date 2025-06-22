// src/lib/plans.ts

export const PLANS = {
    free: {
        name: "무료 사용자",
        dailyAnalysisLimit: 2, // 하루 분석 3회 제한
        maxVideoDuration: 600, // 10분 (600초)
        aiConversation: false, // AI 대화 기능 제한
        price: "무료",
    },
    plus: {
        name: "Plus 사용자",
        dailyAnalysisLimit: 5, // 하루 분석 20회 제한
        maxVideoDuration: 1200, // 30분 (1800초)
        aiConversation: true, // AI 대화 기능 사용 가능
        price: "₩0",
    },
    pro: {
        name: "Pro 사용자",
        dailyAnalysisLimit: 10, // 무제한
        maxVideoDuration: 3600, // 2시간 (7200초)
        aiConversation: true, // AI 대화 기능 사용 가능
        price: "₩19,900",
    },
};

export type PlanId = keyof typeof PLANS;

// 사용자의 프로필 타입을 정의합니다. Firestore에 이 구조로 저장됩니다.
export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    plan: PlanId; // 'free', 'plus', 'pro'
    createdAt: any; // Firestore Timestamp
    usage: {
        analysisCount: number;
        lastAnalysisDate: string; // "YYYY-MM-DD" 형식
    };
}
