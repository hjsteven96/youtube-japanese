// src/app/components/TranscriptViewer.tsx
// src/app/components/TranscriptViewer.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { User } from "firebase/auth";
import { SavedExpression } from "./SavedExpressions";
import Alert from "./Alert";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

// --- 타입 정의 (변경 없음) ---
interface VideoSegment {
    time: number;
    text: string;
}

interface TranscriptViewerProps {
    parsedTranscript: VideoSegment[];
    activeSegmentIndex: number;
    onSeek: (time: number) => void;
    videoSummary: string;
    user: User | null;
    youtubeUrl: string;
    onSave: (expression: Omit<SavedExpression, "id">) => Promise<void>;
    onLoopToggle: (startTime: number, endTime: number) => void;
    isLooping: boolean;
    currentLoopStartTime: number | null;
    currentLoopEndTime: number | null;
    videoDuration: number | null;
    onShowToast: (message: string) => void;
}

// --- 유틸리티 함수 (변경 없음) ---
const extractVideoId = (url: string): string | null => {
    const youtubeRegex = /(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);
    return match ? match[1] : null;
};

// --- 컴포넌트 본문 (수정됨) ---
const TranscriptViewer = ({
    parsedTranscript,
    activeSegmentIndex,
    onSeek,
    videoSummary,
    user,
    youtubeUrl,
    onSave,
    onLoopToggle,
    isLooping,
    currentLoopStartTime,
    currentLoopEndTime,
    videoDuration,
    onShowToast,
}: TranscriptViewerProps) => {
    const transcriptContainerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const segmentRefs = useRef<(HTMLParagraphElement | null)[]>([]);

    const [selectedForActionIndex, setSelectedForActionIndex] = useState<number | null>(null);

    // (나머지 상태 및 핸들러 함수는 변경 없음)
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipText, setTooltipText] = useState("");
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [interpretationResult, setInterpretationResult] = useState<string | null>(null);
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [selectedFullSentenceContext, setSelectedFullSentenceContext] = useState<string>("");
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState({ title: "", subtitle: "" });

    // *** 수정 1: 스크롤 위치를 정밀하게 제어하는 로직으로 변경 ***
    useEffect(() => {
        if (activeSegmentIndex === -1) return;

        const container = transcriptContainerRef.current;
        const activeElement = segmentRefs.current[activeSegmentIndex];

        if (container && activeElement) {
            // 목표: 활성 요소의 상단이 컨테이너의 상단에서 30% 지점에 위치하도록 스크롤
            const containerHeight = container.clientHeight;
            const elementOffsetTop = activeElement.offsetTop;

            // 최종 스크롤 위치 계산
            const newScrollTop = elementOffsetTop - (containerHeight * 0.3);

            container.scrollTo({
                top: newScrollTop,
                behavior: "smooth",
            });
        }
    }, [activeSegmentIndex]);

    const handleLineClick = (index: number) => {
        if (selectedForActionIndex === index) {
            setSelectedForActionIndex(null);
        } else {
            setSelectedForActionIndex(index);
        }
    };
    
    // (다른 핸들러 함수들은 변경 없음)
    const handleSaveInterpretation = async () => { /* ... */ };
    const handleAIInterpretation = async () => { /* ... */ };
    const handleTextSelection = () => { /* ... */ };
    useEffect(() => { /* ... */ }, [tooltipRef]);

    return (
        <div
            ref={transcriptContainerRef}
            className="text-gray-700 relative"
            onMouseUp={handleTextSelection}
            onTouchEnd={handleTextSelection}
        >
            {parsedTranscript.map((segment, index) => {
                const isCurrent = index === activeSegmentIndex;
                const nextSegment = parsedTranscript[index + 1];
                const segmentEndTime = nextSegment ? nextSegment.time : videoDuration || segment.time + 5;
                const isLoopingThisSegment = isLooping && currentLoopStartTime === segment.time;
                const isSelectedForAction = selectedForActionIndex === index;
                
                const isButtonVisible = isLoopingThisSegment || isSelectedForAction;

                return (
                    <p
                        key={index}
                        ref={(el) => { if (segmentRefs.current) segmentRefs.current[index] = el; }}
                        onClick={() => handleLineClick(index)}
                        className={`relative group flex items-center min-h-[44px] cursor-pointer transition-all duration-300 pl-4 pr-4
                            ${isCurrent ? "transform scale-103 bg-blue-50" : "bg-white"}
                            ${isLoopingThisSegment ? "ring-2 ring-purple-300" : ""}
                        `}
                    >
                        <span onClick={(e) => e.stopPropagation()}>
                            <span
                                className="text-blue-500 hover:text-purple-600 transition-colors duration-300"
                                onClick={() => onSeek(segment.time)}
                            >
                                [{String(Math.floor(segment.time / 60)).padStart(2, "0")}:
                                {String(Math.floor(segment.time % 60)).padStart(2, "0")}]
                            </span>{" "}
                            <span className={`${isCurrent ? "font-medium" : "text-gray-600"} whitespace-pre-wrap`}>
                                {segment.text}
                            </span>
                        </span>

                        {/* *** 수정 2: 버튼의 className 로직을 명확하고 간결하게 정리 *** */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); 
                                onLoopToggle(segment.time, segmentEndTime);
                            }}
                            className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-all duration-300
                                ${
                                    isLoopingThisSegment
                                        ? "bg-purple-500 text-white"
                                        : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                }
                                ${
                                    isButtonVisible
                                        ? 'opacity-100 pointer-events-auto'
                                        : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                                }
                            `}
                            title={isLoopingThisSegment ? "구간 반복 중지" : "구간 반복 시작"}
                        >
                            <ArrowPathIcon
                                className={`h-4 w-4 ${
                                    isLoopingThisSegment ? "animate-spin" : ""
                                }`}
                            />
                        </button>
                    </p>
                );
            })}
            {/* 이하 툴팁 및 Alert 컴포넌트는 변경 없음 */}
            {showTooltip && (
                <div
                    ref={tooltipRef}
                    className="absolute z-20 bg-black bg-opacity-80 text-white text-sm rounded-lg shadow-lg py-2 px-3 flex flex-col space-y-2 max-w-xs min-w-[120px]"
                    style={{
                        left: tooltipPosition.x,
                        top: tooltipPosition.y,
                        transform: "translateX(-50%) translateY(-100%)",
                    }}
                >
                    {isInterpreting ? (
                        <p>AI가 해석 중...</p>
                    ) : interpretationResult ? (
                        <div className="flex flex-col space-y-2">
                            <p className="font-bold">AI 해석:</p>
                            <p>{interpretationResult}</p>
                            <div className="flex justify-end space-x-2 mt-2">
                                {user && (
                                    <button
                                        onMouseDown={handleSaveInterpretation}
                                        className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded-md text-xs"
                                    >
                                        저장
                                    </button>
                                )}
                                <button
                                    onMouseDown={() => setShowTooltip(false)}
                                    className="bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded-md text-xs"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex space-x-2">
                            <button
                                onMouseDown={handleAIInterpretation}
                                className="hover:bg-gray-700 px-2 py-1 rounded-md"
                            >
                                AI 해석
                            </button>
                            <button
                                onClick={() => setShowTooltip(false)}
                                className="hover:bg-gray-700 px-2 py-1 rounded-md"
                            >
                                X
                            </button>
                        </div>
                    )}
                </div>
            )}

            {showAlert && (
                <Alert
                    title={alertMessage.title}
                    subtitle={alertMessage.subtitle}
                    buttons={[{ text: "확인", onClick: () => setShowAlert(false), isPrimary: true }]}
                    onClose={() => setShowAlert(false)}
                />
            )}
        </div>
    );
};

export default TranscriptViewer;