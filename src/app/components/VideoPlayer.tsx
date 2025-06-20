"use client";

import React from "react";
import ReactPlayer from "react-player";

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
}

const VideoPlayer = ({
    url,
    title,
    summary,
    playerRef,
    isPlaying,
    onPlay,
    onPause,
    onEnded,
    onProgress,
}: VideoPlayerProps) => {
    return (
        <div className="w-full lg:w-1/2 mb-6 lg:mb-0">
            <div className="mb-4">
                <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden shadow-lg">
                    <ReactPlayer
                        ref={playerRef}
                        url={url}
                        controls={true}
                        playing={isPlaying}
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
                <div className="mt-4 mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {title}
                    </h2>
                </div>
            )}
            <div className="mt-6 bg-gray-50 p-6 rounded-xl">
                <h3 className="text-xl font-bold mb-3 flex items-center text-blue-600">
                    <span className="mr-2">📋</span> 영상 요약
                </h3>
                <p className="leading-relaxed text-gray-700">{summary}</p>
            </div>
        </div>
    );
};

export default VideoPlayer;
