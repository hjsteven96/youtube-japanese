"use client";

import React from "react";

interface ConversationModalProps {
    isOpen: boolean;
    onClose: () => void;
    isRecording: boolean;
    isPlayingAudio: boolean;
    selectedQuestion: string | null;
    remainingTime: number | null; // 이 줄을 추가하세요.
}

// 초를 분:초 형식으로 변환하는 유틸리티 함수
const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0; // 남은 시간이 음수가 되지 않도록
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const ConversationModal = ({
    isOpen,
    onClose,
    isRecording,
    isPlayingAudio,
    selectedQuestion,
    remainingTime, // prop을 받습니다.
}: ConversationModalProps) => {
    if (!isOpen) return null;

    const getStatusText = () => {
        if (isRecording) return "🎙️ 듣고 있어요... 편하게 말씀해주세요!";
        if (isPlayingAudio) return "AI 선생님이 답변하고 있어요...";
        return "대화할 준비가 되었어요.";
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-between p-6 z-50 transition-opacity duration-300">
            <button
                onClick={onClose}
                className="absolute top-6 right-6 text-white text-5xl font-light hover:text-gray-400 transition-colors"
                aria-label="Close Conversation"
            >
                ×
            </button>

            <div className="w-full max-w-4xl text-center flex-grow flex flex-col justify-center overflow-y-auto pt-20 pb-10">
                <p className="text-gray-300 text-2xl md:text-3xl font-light mb-12">
                    {selectedQuestion || "자유롭게 대화를 시작해 보세요."}
                </p>

                {isRecording && (
                    <p className="text-2xl md:text-3xl text-white italic animate-pulse">
                        사용자 음성이 여기에 표시됩니다...
                    </p>
                )}
            </div>

            <div className="w-full flex flex-col items-center">
                <div className="relative w-28 h-28 md:w-32 md:h-32 mb-6">
                    <div
                        className={`absolute inset-0 bg-blue-600 rounded-full transition-all duration-300 ease-in-out ${
                            isRecording
                                ? "animate-pulse scale-110"
                                : "scale-100"
                        } ${isPlayingAudio ? "animate-ping" : ""}`}
                    ></div>
                    <div className="absolute inset-2 bg-gray-800 rounded-full"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                            className="w-12 h-12 md:w-14 md:h-14 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                fillRule="evenodd"
                                d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-1a6 6 0 11-12 0H3a7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                                clipRule="evenodd"
                            ></path>
                        </svg>
                    </div>
                </div>

                <p className="text-white text-lg h-7 mb-8">{getStatusText()}</p>

                <button
                    onClick={onClose}
                    className="w-20 h-20 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105"
                    aria-label="Stop Conversation"
                >
                    <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 10h6v4H9z"
                        ></path>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default ConversationModal;
