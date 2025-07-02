"use client";

import React, { useMemo } from "react";
import TranscriptViewer from "./TranscriptViewer";
import { User } from "firebase/auth";
import SavedExpressions, { SavedExpression } from "./SavedExpressions";
import { PLANS, UserProfile } from "@/lib/plans";

// --- 타입 정의 ---
interface SlangExpression {
    expression: string;
    meaning: string;
}
interface VideoAnalysis {
    summary: string;
    keywords: string[];
    slang_expressions: SlangExpression[];
    main_questions: string[];
}
interface VideoSegment {
    time: number;
    text: string;
}

// [수정] isAnalysisLoading prop 추가
interface AnalysisTabsProps {
    analysis: VideoAnalysis;
    transcript: string;
    currentTime: number;
    onSeek: (time: number) => void;
    onStartConversation: (question: string) => void;
    isConversationPending: boolean;
    user: User | null;
    youtubeUrl: string;
    activeTab: "analysis" | "transcript" | "questions";
    setActiveTab: (tab: "analysis" | "transcript" | "questions") => void;
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
}

// 스크롤바 숨김 CSS는 globals.css에 추가 필요
/*
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
*/

// [추가] 로딩 중 표시할 스켈레톤 컴포넌트
const AnalysisSkeleton = () => (
    <div className="md:p-2 space-y-4 animate-pulse">
        {/* 저장한 표현 스켈레톤 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
        </div>
        {/* 핵심 단어 스켈레톤 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="flex flex-wrap gap-2">
                <div className="h-8 bg-gray-200 rounded-full w-24"></div>
                <div className="h-8 bg-gray-200 rounded-full w-32"></div>
                <div className="h-8 bg-gray-200 rounded-full w-28"></div>
            </div>
        </div>
        {/* 실전 표현 스켈레톤 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
                <div className="h-12 bg-gray-200 rounded-lg w-full"></div>
                <div className="h-12 bg-gray-200 rounded-lg w-full"></div>
            </div>
        </div>
    </div>
);

const AnalysisTabs = ({
    analysis,
    transcript,
    currentTime,
    onSeek,
    onStartConversation,
    isConversationPending,
    user,
    youtubeUrl,
    activeTab,
    setActiveTab,
    savedExpressions,
    onDeleteExpression,
    onAddExpression,
    onLoopToggle,
    isLooping,
    currentLoopStartTime,
    currentLoopEndTime,
    videoDuration,
    onShowToast,
    isAnalysisLoading, // [수정] prop 받기
    userProfile, // [추가] prop 받기
    onShowAlert, // [추가] prop 받기
}: AnalysisTabsProps) => {
    // [추가] 저장 가능한 단어 수 계산
    const maxSavedWords = useMemo(() => {
        if (!userProfile) return PLANS.free.maxSavedWords; // 비로그인 시 무료 플랜 기준
        return PLANS[userProfile.plan].maxSavedWords;
    }, [userProfile]);

    const savedExpressionsCount = savedExpressions.length;

    const parsedTranscript = useMemo((): VideoSegment[] => {
        const safeTranscript = String(transcript || "");
        if (!safeTranscript.trim()) return [];
        const parsed: VideoSegment[] = [];
        const regex = /\[(?:(\d{1,2}):)?(\d{2}):(\d{2})\]([^\[]*)/g;
        const matches = safeTranscript.matchAll(regex);
        for (const match of matches) {
            const hours = match[1] ? parseInt(match[1], 10) : 0;
            const minutes = parseInt(match[2], 10);
            const seconds = parseInt(match[3], 10);
            const timeInSeconds = hours * 3600 + minutes * 60 + seconds;
            const text = match[4].trim();

            if (text) parsed.push({ time: timeInSeconds, text });
        }
        if (parsed.length === 0 && safeTranscript.trim()) {
            parsed.push({ time: 0, text: safeTranscript.trim() });
        }
        return parsed;
    }, [transcript]);

    const activeSegmentIndex = useMemo(() => {
        return parsedTranscript.findIndex((segment, index) => {
            const nextSegment = parsedTranscript[index + 1];
            return (
                currentTime >= segment.time &&
                (!nextSegment || currentTime < nextSegment.time)
            );
        });
    }, [currentTime, parsedTranscript]);

    const TabButton = ({
        tabName,
        label,
    }: {
        tabName: typeof activeTab;
        label: string;
    }) => (
        <button
            className={`px-6 py-2 font-semibold rounded-t-lg transition-all duration-300 ${
                activeTab === tabName
                    ? "text-black border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-600 border-b-2 border-transparent"
            }`}
            onClick={() => setActiveTab(tabName)}
        >
            {label}
        </button>
    );

    return (
        <div className="w-full lg:w-1/2 flex flex-col h-[650px]">
            <div className="flex space-x-2 mb-4 border-b-2 border-gray-100">
                <TabButton tabName="transcript" label="자막" />
                <TabButton tabName="analysis" label="주요 표현" />
                <TabButton tabName="questions" label="AI 대화" />
            </div>
            <div className="flex-1 overflow-y-auto rounded-b-2xl hide-scrollbar">
                {/* [수정] '주요 표현' 탭 로딩 상태 처리 */}
                {activeTab === "analysis" &&
                    (isAnalysisLoading ? (
                        <AnalysisSkeleton />
                    ) : (
                        <div className="md:p-2 space-y-2 text-gray-700">
                            {user && savedExpressions.length > 0 && (
                                <div className="bg-white p-6 rounded-lg shadow-sm">
                                    <h2 className="text-xl font-bold mb-3 flex items-center text-green-600">
                                        📌 내가 저장한 표현
                                    </h2>
                                    <SavedExpressions
                                        expressions={savedExpressions}
                                        onDelete={onDeleteExpression}
                                    />
                                </div>
                            )}

                            {analysis.keywords?.length > 0 && (
                                <div className="bg-white p-6 rounded-lg shadow-sm">
                                    <h2 className="text-xl font-bold mb-3 flex items-center text-purple-600">
                                        🔑 핵심 단어
                                    </h2>
                                    <div className="flex flex-wrap gap-2">
                                        {analysis.keywords.map(
                                            (keyword, index) => (
                                                <span
                                                    key={index}
                                                    className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 font-medium px-4 py-2 rounded-full transition-all duration-300 hover:shadow-md hover:scale-110"
                                                >
                                                    {keyword}
                                                </span>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                            {analysis.slang_expressions?.length > 0 && (
                                <div className="bg-white p-6 rounded-lg shadow-sm">
                                    <h2 className="text-xl font-bold mb-3 flex items-center text-green-600">
                                        💡 실전 표현
                                    </h2>
                                    <ul className="space-y-3">
                                        {analysis.slang_expressions.map(
                                            (slang, index) => (
                                                <li
                                                    key={index}
                                                    className="bg-green-50 p-3 rounded-lg transition-all duration-300 hover:bg-green-100"
                                                >
                                                    <strong className="text-green-700">
                                                        "{slang.expression}"
                                                    </strong>
                                                    <span className="text-gray-600 ml-2">
                                                        → {slang.meaning}
                                                    </span>
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}

                {activeTab === "transcript" && (
                    <TranscriptViewer
                        parsedTranscript={parsedTranscript}
                        activeSegmentIndex={activeSegmentIndex}
                        onSeek={onSeek}
                        videoSummary={analysis.summary}
                        user={user}
                        youtubeUrl={youtubeUrl}
                        onSave={onAddExpression}
                        onLoopToggle={onLoopToggle}
                        isLooping={isLooping}
                        currentLoopStartTime={currentLoopStartTime}
                        currentLoopEndTime={currentLoopEndTime}
                        videoDuration={videoDuration || null}
                        onShowToast={onShowToast}
                        maxSavedWords={maxSavedWords}
                        savedExpressionsCount={savedExpressionsCount}
                        onShowAlert={onShowAlert}
                        savedExpressions={savedExpressions}
                    />
                )}

                {/* [수정] 'AI 대화' 탭 로딩 상태 처리 */}
                {activeTab === "questions" &&
                    (isAnalysisLoading ? (
                        <div className="p-6 animate-pulse">
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                                <div className="h-4 bg-gray-200 rounded w-full mb-6"></div>
                                <div className="space-y-3">
                                    <div className="h-16 bg-gray-200 rounded-lg w-full"></div>
                                    <div className="h-16 bg-gray-200 rounded-lg w-full"></div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-700">
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <h2 className="text-xl font-bold mb-4 flex items-center text-purple-600">
                                    🤖 AI 영어 선생님과 대화하기
                                </h2>
                                {analysis.main_questions?.length > 0 ? (
                                    <div className="space-y-3">
                                        <p className="text-gray-600 mb-4">
                                            아래 주제로 대화를 시작해보세요:
                                        </p>
                                        {analysis.main_questions.map(
                                            (question, index) => (
                                                <div
                                                    key={index}
                                                    className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg flex items-center justify-between transition-all duration-300 hover:shadow-md"
                                                >
                                                    <span className="flex-1 font-medium">
                                                        {question}
                                                    </span>
                                                    <button
                                                        onClick={() =>
                                                            onStartConversation(
                                                                question
                                                            )
                                                        }
                                                        className="ml-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
                                                        disabled={
                                                            isConversationPending
                                                        }
                                                    >
                                                        시작하기
                                                    </button>
                                                </div>
                                            )
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="mb-4 text-gray-600">
                                            AI가 대화 주제를 생성하지 못했거나,
                                            자유롭게 대화를 시작할 수 있습니다.
                                        </p>
                                        <button
                                            onClick={() =>
                                                onStartConversation(
                                                    "Hello! Let's practice English together."
                                                )
                                            }
                                            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
                                            disabled={isConversationPending}
                                        >
                                            자유 대화 시작하기 🎤
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                {/* 스크롤 여유 공간을 위한 div */}
                <div className="h-16 flex-shrink-0"></div>
            </div>
        </div>
    );
};

export default AnalysisTabs;
