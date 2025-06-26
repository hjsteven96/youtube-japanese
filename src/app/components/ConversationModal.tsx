"use client";

import React from "react";

interface ConversationModalProps {
    isOpen: boolean;
    onClose: () => void;
    isRecording: boolean;
    isPlayingAudio: boolean;
    selectedQuestion: string | null;
    remainingTime: number | null;
}

const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const ConversationModal = ({
    isOpen,
    onClose,
    isRecording,
    isPlayingAudio,
    selectedQuestion,
    remainingTime,
}: ConversationModalProps) => {
    if (!isOpen) return null;

    const getStatusText = () => {
        if (isRecording) return "듣고 있어요... 편하게 말씀해주세요!";
        if (isPlayingAudio) return "AI 선생님이 답변하고 있어요...";
        return "대화할 준비가 되었어요.";
    };

    return (
        <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-between p-6 z-50 transition-all duration-500">
            {/* --- 수정된 부분 시작 --- */}
            {/* 최상단 헤더 (타이틀과 남은 시간) */}
            <div className="absolute top-6 left-0 right-0 flex flex-col items-center gap-2 z-20">
                {/* 로고 및 제목 */}
                <h1 className="text-xl font-semibold text-gray-700">
                    <span className="font-bold text-blue-500">Ling:to</span> AI
                    대화
                </h1>

                {/* 남은 시간 표시 */}
                {remainingTime !== null && (
                    <div className="bg-gray-100 px-4 py-2 rounded-full shadow-sm">
                        <p className="text-gray-700 text-sm font-light">
                            남은 시간:{" "}
                            <span className="font-medium text-blue-500">
                                {formatTime(remainingTime)}
                            </span>
                        </p>
                    </div>
                )}
            </div>
            {/* --- 수정된 부분 끝 --- */}

            {/* 메인 콘텐츠 영역 (상단 패딩 조정) */}
            <div className="w-full max-w-4xl text-center flex-grow flex flex-col justify-center overflow-y-auto pt-32 pb-10 relative z-10">
                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-lg border border-gray-200">
                    <p className="text-gray-800 text-xl md:text-2xl font-light mb-8 leading-relaxed">
                        {selectedQuestion || "자유롭게 대화를 시작해 보세요."}
                    </p>

                    {isPlayingAudio && (
                        <div className="mt-8">
                            <div className="flex justify-center space-x-2">
                                <div className="w-2 h-8 bg-blue-500 rounded-full animate-pulse"></div>
                                <div className="w-2 h-12 bg-blue-500 rounded-full animate-pulse delay-100"></div>
                                <div className="w-2 h-10 bg-blue-500 rounded-full animate-pulse delay-200"></div>
                                <div className="w-2 h-14 bg-blue-500 rounded-full animate-pulse delay-300"></div>
                                <div className="w-2 h-9 bg-blue-500 rounded-full animate-pulse delay-400"></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 상태 텍스트 */}
                <div className="mt-8 bg-gray-100 px-6 py-3 rounded-full inline-flex mx-auto shadow-sm">
                    <p className="text-gray-700 text-base md:text-lg font-light flex items-center space-x-2">
                        <span
                            className={`inline-block w-2 h-2 rounded-full ${
                                isRecording
                                    ? "bg-blue-500 animate-pulse"
                                    : isPlayingAudio
                                    ? "bg-blue-500 animate-pulse"
                                    : "bg-green-400"
                            }`}
                        ></span>
                        <span>{getStatusText()}</span>
                    </p>
                </div>
            </div>

            {/* 하단 종료 버튼 */}
            <div className="w-full flex justify-center relative z-10">
                <button
                    onClick={onClose}
                    className="group relative w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-red-500/25"
                    aria-label="Stop Conversation"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <svg
                        className="w-6 h-6 md:w-8 md:h-8 text-gray-700 relative z-10 group-hover:rotate-90 transition-transform duration-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                        ></path>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default ConversationModal;
