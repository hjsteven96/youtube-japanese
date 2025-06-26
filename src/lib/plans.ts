// src/lib/plans.ts

export const PLANS = {
    free: {
        name: "무료 사용자",
        dailyAnalysisLimit: 2, // 하루 분석 3회 제한
        maxVideoDuration: 600, // 10분 (600초)
        aiConversation: true, // AI 대화 기능 제한
        price: "무료",
        sessionTimeLimit: 60,   // 5분
        monthlyTimeLimit: 300,  // 30분
    },
    plus: {
        name: "Plus 사용자",
        dailyAnalysisLimit: 5, // 하루 분석 20회 제한
        maxVideoDuration: 1200, // 30분 (1800초)
        aiConversation: true, // AI 대화 기능 사용 가능
        price: "₩0",
        sessionTimeLimit: 300,   // 5분
        monthlyTimeLimit: 3000,  // 30분
    },
    pro: {
        name: "Pro 사용자",
        dailyAnalysisLimit: 10, // 무제한
        maxVideoDuration: 3600, // 2시간 (7200초)
        aiConversation: true, // AI 대화 기능 사용 가능
        price: "₩19,900",
        sessionTimeLimit: 600,   // 5분
        monthlyTimeLimit: 12000,  // 30분
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
        monthlyConversationUsed: number; // 이번 달에 사용한 총 대화 시간 (초)
        conversationUsageLastReset: string; // 마지막으로 월간 사용량을 리셋한 날짜 (YYYY-MM)

        
    };
}
