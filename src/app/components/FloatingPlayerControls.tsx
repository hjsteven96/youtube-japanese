"use client";

import React, { useState, useRef } from "react";
import ReactPlayer from "react-player";
import {
    PlayIcon,
    PauseIcon,
    BackwardIcon,
    ForwardIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    SpeakerWaveIcon,
} from "@heroicons/react/24/solid";

interface FloatingPlayerControlsProps {
    playerRef: React.RefObject<ReactPlayer | null>;
    isPlaying: boolean;
    onPlayPause: () => void;
    currentTime: number;
    playbackRate: number;
    onPlaybackRateChange: (rate: number) => void;
}

const FloatingPlayerControls: React.FC<FloatingPlayerControlsProps> = ({
    playerRef,
    isPlaying,
    onPlayPause,
    currentTime,
    playbackRate,
    onPlaybackRateChange,
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const speedOptions = [0.75, 0.9, 1.0, 1.25];
    const speedMenuRef = useRef<HTMLDivElement>(null);

    const handleSeek = (offset: number) => {
        const newTime = currentTime + offset;
        playerRef.current?.seekTo(newTime, "seconds");
    };

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                speedMenuRef.current &&
                !speedMenuRef.current.contains(event.target as Node)
            ) {
                setShowSpeedMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [speedMenuRef]);

    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-4 right-4 z-50 glass-morphism rounded-full p-3 shadow-lg"
                aria-label="플레이어 컨트롤러 열기"
            >
                <ChevronLeftIcon className="h-6 w-6 text-black/70" />
            </button>
        );
    }

    const buttonClass =
        "glass-button-white rounded-full w-12 h-12 flex items-center justify-center";

    return (
        // ✨ 변경된 부분: left-0를 제거하고 right-4를 사용하여 오른쪽 정렬
        <div className="fixed bottom-4 right-4 z-50">
            {/* ✨ 변경된 부분: mx-auto 제거 */}
            <div className="glass-morphism rounded-2xl p-2 shadow-xl flex flex-col">
                <div className="flex items-center justify-center gap-x-2">
                    {/* 1초 뒤로 */}
                    <button
                        onClick={() => handleSeek(-1)}
                        className={buttonClass}
                        aria-label="1초 뒤로"
                    >
                        {/* ✨ 아이콘을 사용하도록 변경하여 일관성 유지 */}
                        <span className="text-sm font-bold">-1s</span>
                    </button>

                    {/* 재생/일시정지 */}
                    <button
                        onClick={onPlayPause}
                        className={`${buttonClass} mx-2`}
                        aria-label={isPlaying ? "일시정지" : "재생"}
                    >
                        {isPlaying ? (
                            <PauseIcon className="h-6 w-6 " />
                        ) : (
                            <PlayIcon className="h-6 w-6 " />
                        )}
                    </button>

                    {/* 1초 앞으로 */}
                    <button
                        onClick={() => handleSeek(1)}
                        className={buttonClass}
                        aria-label="1초 앞으로"
                    >
                        <span className="text-sm font-bold">+1s</span>
                    </button>

                    {/* 재생 속도 */}
                    <div className="relative" ref={speedMenuRef}>
                        <button
                            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                            className={buttonClass}
                            aria-label={`현재 재생 속도: ${playbackRate}x`}
                        >
                            <span className="text-sm font-bold">
                                {playbackRate}x
                            </span>
                        </button>
                        {showSpeedMenu && (
                            <div className="absolute bottom-full right-0 mb-3 w-24 rounded-lg bg-gray-100/95 shadow-sm p-1 rigin-bottom-right  border ">
                                {speedOptions.map((speed) => (
                                    <button
                                        key={speed}
                                        onClick={() => {
                                            onPlaybackRateChange(speed);
                                            setShowSpeedMenu(false);
                                        }}
                                        className={`w-full text-center text-sm text-gray-600 p-2 rounded-md transition-colors ${
                                            playbackRate === speed
                                                ? "bg-black/10 font-bold"
                                                : "hover:bg-black/5"
                                        }`}
                                    >
                                        {speed.toFixed(2)}x
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* 가로모드 */}
                    <button
                        onClick={() => {
                            if (document.fullscreenElement) {
                                document.exitFullscreen();
                            } else {
                                document.documentElement.requestFullscreen();
                            }
                        }}
                        className={buttonClass}
                        aria-label="가로모드 전환"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>

                    {/* 최소화 */}
                    <button
                        onClick={() => setIsMinimized(true)}
                        className=" rounded-none w-8 h-12 flex items-center justify-center"
                        aria-label="컨트롤러 최소화"
                    >
                        <ChevronRightIcon className="h-6 w-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FloatingPlayerControls;
