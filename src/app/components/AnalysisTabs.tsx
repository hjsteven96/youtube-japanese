"use client";

import React, { useMemo } from "react";
import TranscriptViewer from "./TranscriptViewer";
import { User } from "firebase/auth";
import SavedExpressions, { SavedExpression } from "./SavedExpressions";

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
}

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
}: AnalysisTabsProps) => {
    const parsedTranscript = useMemo((): VideoSegment[] => {
        const safeTranscript = String(transcript || "");
        if (!safeTranscript.trim()) return [];
        const parsed: VideoSegment[] = [];
        const regex = /\[(\d{2}):(\d{2})\]([^\[]*)/g;
        const matches = safeTranscript.matchAll(regex);
        for (const match of matches) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const timeInSeconds = minutes * 60 + seconds;
            const text = match[3].trim();

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
            className={`px-6 py-3 font-semibold rounded-t-lg transition-all duration-300 ${
                activeTab === tabName
                    ? "text-white bg-gradient-to-r from-blue-500 to-purple-500 shadow-md transform scale-105"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab(tabName)}
        >
            {label}
        </button>
    );

    return (
        <div className="w-full lg:w-1/2 flex flex-col h-[600px]">
            <div className="flex space-x-2 mb-4 border-b-2 border-gray-100">
                <TabButton tabName="transcript" label="📝 자막" />
                <TabButton tabName="analysis" label="📊 주요 표현" />
                {/* <TabButton tabName="questions" label="💬 AI 대화" /> */}
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 rounded-xl">
                {activeTab === "analysis" && (
                    <div className="text-gray-700 space-y-6">
                        {user && savedExpressions.length > 0 && (
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <h3 className="text-xl font-bold mb-3 flex items-center text-green-600">
                                    📌 내가 저장한 표현
                                </h3>
                                <SavedExpressions
                                    expressions={savedExpressions}
                                    onDelete={onDeleteExpression}
                                />
                            </div>
                        )}

                        {analysis.keywords?.length > 0 && (
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <h3 className="text-xl font-bold mb-3 flex items-center text-purple-600">
                                    🔑 핵심 단어
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.keywords.map((keyword, index) => (
                                        <span
                                            key={index}
                                            className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 font-medium px-4 py-2 rounded-full transition-all duration-300 hover:shadow-md hover:scale-110"
                                        >
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {analysis.slang_expressions?.length > 0 && (
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <h3 className="text-xl font-bold mb-3 flex items-center text-green-600">
                                    💡 실전 표현
                                </h3>
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
                )}

                {activeTab === "transcript" && (
                    <TranscriptViewer
                        parsedTranscript={parsedTranscript}
                        activeSegmentIndex={activeSegmentIndex}
                        onSeek={onSeek}
                        videoSummary={analysis.summary}
                        user={user}
                        youtubeUrl={youtubeUrl}
                        onSave={onAddExpression}
                    />
                )}

                {activeTab === "questions" && (
                    <div className="text-gray-700">
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <h3 className="text-xl font-bold mb-4 flex items-center text-purple-600">
                                🤖 AI 영어 선생님과 대화하기
                            </h3>
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
                                                    className="ml-4 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
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
                                        자유롭게 대화를 시작해볼까요?
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
                )}
            </div>
        </div>
    );
};

export default AnalysisTabs;
