// src/app/components/SavedExpressions.tsx
"use client";

import React from "react";

// 👇 [수정 확인] interface에 아래 필드들이 모두 포함되어 있는지 확인해주세요.
export interface SavedExpression {
    id: string; // Firestore 문서 ID
    originalText: string;
    interpretation: string;
    youtubeUrl: string;
    videoId: string;
    timestamp: any; // Date 객체와 Firestore Timestamp를 모두 다루기 위해 any로 설정
}

interface SavedExpressionsProps {
    expressions: SavedExpression[];
    onDelete: (id: string) => void;
}

const SavedExpressions: React.FC<SavedExpressionsProps> = ({
    expressions,
    onDelete,
}) => {
    if (expressions.length === 0) {
        return (
            <div className="text-center py-10 px-6 bg-gray-50 rounded-lg">
                <p className="text-gray-500">아직 저장한 표현이 없습니다.</p>
                <p className="text-sm text-gray-400 mt-2">
                    자막에서 단어나 문장을 드래그하여 AI 해석 후 저장해보세요!
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {expressions.map((exp) => (
                <div
                    key={exp.id}
                    className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between transition-all hover:shadow-md"
                >
                    <div className="flex-1">
                        <p className="font-semibold text-gray-800">
                            {exp.originalText}
                        </p>
                        <p className="text-blue-600 mt-1">
                            {exp.interpretation}
                        </p>
                    </div>
                    <button
                        onClick={() => onDelete(exp.id)}
                        className="ml-4 text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full"
                        title="삭제"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
};

export default SavedExpressions;
