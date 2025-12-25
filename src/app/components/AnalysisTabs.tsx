"use client";

import React, { useMemo, useState } from "react"; // useState import 추가
// import TranscriptViewer from "./TranscriptViewer"; // 제거
// import { User } from "firebase/auth"; // 제거
// import SavedExpressions, { SavedExpression } from "./SavedExpressions"; // 제거
import AnalysisTabBar from "./AnalysisTabBar"; // 추가
import AnalysisTabContent from "./AnalysisTabContent"; // 추가
import { User } from "firebase/auth"; // User 타입은 필요하므로 유지
import { SavedExpression } from "./SavedExpressions"; // SavedExpression 타입은 필요하므로 유지
import { UserProfile } from "@/lib/plans"; // UserProfile 타입은 필요하므로 유지

// --- 타입 정의 ---
// interface SlangExpression { /* ... */ } // 제거 (AnalysisTabContent로 이동)
// interface VideoAnalysis { /* ... */ } // 제거 (AnalysisTabContent로 이동)
// interface VideoSegment { /* ... */ } // 제거 (AnalysisTabContent로 이동)

// Props 인터페이스는 AnalysisTabContent와 거의 동일하게 유지
interface AnalysisTabsProps {
    analysis: any;
    transcript: string;
    currentTime: number;
    onSeek: (time: number) => void;
    onStartConversation: (question: string) => void;
    isConversationPending: boolean;
    user: User | null;
    youtubeUrl: string;
    // activeTab: "analysis" | "transcript" | "questions"; // 제거 (내부 상태로 관리)
    // setActiveTab: (tab: "analysis" | "transcript" | "questions") => void; // 제거 (내부 상태로 관리)
    savedExpressions: SavedExpression[];
    onDeleteExpression: (id: string) => void;
    onAddExpression: (expression: Omit<SavedExpression, "id">) => Promise<void>;
    onLoopToggle: (startTime: number, endTime: number) => void;
    isLooping: boolean;
    currentLoopStartTime: number | null;
    currentLoopEndTime: number | null;
    videoDuration: number | null;
    onShowToast: (message: string) => void;
    isAnalysisLoading: boolean; // 분석 내용 로딩 상태
    userProfile: UserProfile | null; // [추가] 사용자 프로필
    onShowAlert: (config: {
        title: string;
        subtitle: string;
        buttons: { text: string; onClick: () => void; isPrimary?: boolean }[];
    }) => void; // [추가] Alert 모달 표시 함수
    // videoPlayerHeight: number; // 제거 (PC 레이아웃에서는 불필요)
    maxSavedWords: number; // AnalysisTabContent로 전달
    savedExpressionsCount: number; // AnalysisTabContent로 전달
    videoId?: string;
    initialTranslationData?: any;
}

// AnalysisSkeleton 제거 (AnalysisTabContent로 이동)
// const AnalysisSkeleton = () => ( /* ... */ );

const AnalysisTabs = (props: AnalysisTabsProps) => {
    // activeTab 상태만 여기서 관리
    const [activeTab, setActiveTab] = useState<
        "analysis" | "subtitles" | "questions"
    >("subtitles");

    // 기존 useMemo 로직들 제거 (AnalysisTabContent로 이동)
    // const maxSavedWords = useMemo(() => { /* ... */ });
    // const savedExpressionsCount = savedExpressions.length;
    // const parsedTranscript = useMemo(() => { /* ... */ });
    // const activeSegmentIndex = useMemo(() => { /* ... */ });

    // TabButton 제거 (AnalysisTabBar로 이동)
    // const TabButton = ({ /* ... */ });

    return (
        // PC 전용 레이아웃: 고정 높이와 내부 스크롤
        <div className="w-full lg:w-1/2 flex flex-col h-[650px]">
            <AnalysisTabBar activeTab={activeTab} setActiveTab={setActiveTab} />
            <div className="flex-1 overflow-y-auto rounded-b-2xl hide-scrollbar p-3">
                <AnalysisTabContent {...props} activeTab={activeTab} />
            </div>
        </div>
    );
};

export default AnalysisTabs;
