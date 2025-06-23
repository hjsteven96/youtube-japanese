"use client";

import ReactPlayer from "react-player";
import React, { useState } from "react";

interface VideoPlayerProps {
    url: string;
    title: string | null;
    summary: string;
    playerRef: React.RefObject<ReactPlayer | null>;
    isPlaying: boolean;
    onPlay: () => void;
    onPause: () => void;
    onEnded: () => void;
    onProgress: (state: { playedSeconds: number }) => void;
    playbackRate: number;
}

const VideoPlayer = ({
    url,
    title,
    summary,
    playerRef,
    isPlaying,
    playbackRate,
    onPlay,
    onPause,
    onEnded,
    onProgress,
}: VideoPlayerProps) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="w-full lg:w-1/2 mb-6 lg:mb-0">
            {/* ⬇︎ 모바일에서 sticky, 데스크톱(≥1024px) 기본 흐름 */}
            <div className="sticky top-0 z-40 bg-white lg:static lg:bg-transparent">
                <div className="relative w-full pt-[50.25%] rounded-xl overflow-hidden shadow-lg">
                    <ReactPlayer
                        ref={playerRef}
                        url={url}
                        controls
                        playing={isPlaying}
                        playbackRate={playbackRate}
                        width="100%"
                        height="100%"
                        className="absolute inset-0"
                        onPlay={onPlay}
                        onPause={onPause}
                        onEnded={onEnded}
                        onProgress={onProgress}
                    />
                </div>
            </div>

            {title && (
                <div className="mt-4 mb-2 m-3">
                    <h1 className="text-base md:text-xl lg:text-2xl font-bold text-gray-800">
                        {title} 자막으로 영어 공부하기
                    </h1>
                </div>
            )}

            {/* 영상 요약 ─ 모바일 접힘, 데스크톱 항상 펼침 */}
            <div className="mt-2 bg-gray-50 md:p-6 p-4 rounded-xl">
                {/* 모바일 헤더 (토글) */}
                <button
                    onClick={() => setOpen(!open)}
                    className="md:hidden w-full flex items-center justify-between"
                >
                    <span className="flex items-center text-base font-semibold text-blue-600">
                        <span className="mr-1">📋</span>영상&nbsp;요약
                    </span>

                    {/* ▼ 화살표 아이콘 (Heroicons outline/chevron-down) */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`h-5 w-5 text-blue-600 transition-transform duration-300 ${
                            open ? "rotate-180" : ""
                        }`}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>

                {/* 데스크톱 헤더 (항상 표시) */}
                <h3 className="hidden md:flex items-center text-xl font-bold mb-3 text-blue-600">
                    <span className="mr-2">📋</span>영상&nbsp;요약
                </h3>

                {/* 요약 본문 : 모바일 open일 때만, md 이상은 항상 */}
                <p
                    className={`leading-relaxed text-gray-700 whitespace-pre-line ${
                        open ? "mt-4" : "hidden"
                    } md:block`}
                >
                    {summary}
                </p>
            </div>
        </div>
    );
};

export default VideoPlayer;
