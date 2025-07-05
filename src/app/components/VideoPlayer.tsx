"use client";

import ReactPlayer from "react-player";
// import React, { useState } from "react"; // 제거

// [수정] isAnalysisLoading prop 제거, title, summary 제거, containerRef 제거
interface VideoPlayerProps {
    url: string;
    // title: string | null; // 제거
    // summary: string; // 제거
    playerRef: React.RefObject<ReactPlayer | null>;
    isPlaying: boolean;
    onPlay: () => void;
    onPause: () => void;
    onEnded: () => void;
    onProgress: (state: { playedSeconds: number }) => void;
    playbackRate: number;
    isMobile: boolean; // 추가
    // isAnalysisLoading: boolean; // 제거
    // containerRef: React.RefObject<HTMLDivElement | null>; // 제거
}

const VideoPlayer = ({
    url,
    // title,
    // summary,
    playerRef,
    isPlaying,
    playbackRate,
    onPlay,
    onPause,
    onEnded,
    onProgress,
    isMobile, // 추가
}: // isAnalysisLoading, // 제거
// containerRef, // 제거
VideoPlayerProps) => {
    // const [open, setOpen] = useState(false); // 제거

    return (
        // 래퍼 div를 제거하고 순수 플레이어 영역만 남깁니다.
        // position, size, shadow 등은 부모 컴포넌트에서 제어합니다.
        <div
            className={`relative w-full pt-[56.25%] overflow-hidden shadow-lg ${
                isMobile ? "" : "rounded-xl"
            }`}
        >
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
    );
};

export default VideoPlayer;
