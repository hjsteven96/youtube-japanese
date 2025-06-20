"use client";

import React, { useState } from "react";

interface UrlInputFormProps {
    onSubmit: (url: string) => void;
    loading: boolean;
    onUrlChange: () => void; // URL 변경 시 분석 결과 초기화를 위한 콜백
}

const UrlInputForm = ({
    onSubmit,
    loading,
    onUrlChange,
}: UrlInputFormProps) => {
    const [url, setUrl] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(url);
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md mb-8 transition-all duration-300 hover:shadow-2xl"
        >
            <div className="mb-6">
                <label
                    htmlFor="youtubeUrl"
                    className="block text-gray-700 text-sm font-semibold mb-3 flex items-center"
                >
                    <span className="mr-2">🎬</span> YouTube URL 입력
                </label>
                <input
                    type="url"
                    id="youtubeUrl"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all duration-300 text-gray-700"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => {
                        setUrl(e.target.value);
                        onUrlChange(); // 부모의 상태를 초기화하도록 알림
                    }}
                />
            </div>
            <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !url}
            >
                {loading ? "분석 중..." : "AI로 영상 분석하기 ✨"}
            </button>
        </form>
    );
};

export default UrlInputForm;
