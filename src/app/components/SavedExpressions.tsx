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
                        className="ml-4 text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
                        title="삭제"
                    >
                        <span className="text-xl font-bold leading-none">
                            ×
                        </span>
                    </button>
                </div>
            ))}
        </div>
    );
};

export default SavedExpressions;
