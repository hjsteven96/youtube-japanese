"use client";

import React, { useState } from "react";

interface VideoInfoProps {
    title: string | null;
    summary: string;
    isAnalysisLoading: boolean;
}

const VideoInfo = ({ title, summary, isAnalysisLoading }: VideoInfoProps) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="bg-white p-4 lg:p-0 lg:bg-transparent">
            {title && (
                <div className="mb-2 lg:mt-3">
                    <h1 className="text-lg lg:text-xl font-bold text-gray-800">
                        {title} 자막으로 영어 공부하기
                    </h1>
                </div>
            )}
            <div className="mt-2 bg-gray-50 md:p-6 p-4 rounded-xl">
                <button
                    onClick={() => setOpen(!open)}
                    className="md:hidden w-full flex items-center justify-between"
                >
                    <span className="flex items-center text-base font-semibold text-blue-600">
                        <span className="mr-1">📋</span>영상 요약
                    </span>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`h-5 w-5 text-blue-600 transition-transform duration-300 ${
                            open ? "rotate-180" : ""
                        }`}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
                <h3 className="hidden md:flex items-center text-lg font-semibold mb-3 text-blue-600">
                    <span className="mr-2">📋</span>영상 요약
                </h3>
                <div
                    className={`whitespace-pre-line ${
                        open ? "mt-4" : "hidden"
                    } md:block`}
                >
                    {isAnalysisLoading ? (
                        <div className="space-y-2 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    ) : (
                        <p className="leading-relaxed text-gray-700">
                            {summary}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoInfo;
