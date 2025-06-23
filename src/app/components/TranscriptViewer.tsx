// src/app/components/TranscriptViewer.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { User } from "firebase/auth";
import { SavedExpression } from "./SavedExpressions";
import Alert from "./Alert";

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

    // *** 수정 1: 사용자가 버튼을 표시하기 위해 선택한 줄의 인덱스를 저장할 상태 추가 ***
    const [selectedForActionIndex, setSelectedForActionIndex] = useState<number | null>(null);

    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipText, setTooltipText] = useState("");
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [interpretationResult, setInterpretationResult] = useState<string | null>(null);
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [selectedFullSentenceContext, setSelectedFullSentenceContext] = useState<string>("");
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState({
        title: "",
        subtitle: "",
    });

    useEffect(() => {
        if (activeSegmentIndex === -1) return;
        const activeElement = segmentRefs.current[activeSegmentIndex];
        if (activeElement) {
            activeElement.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    }, [activeSegmentIndex]);

    // *** 수정 2: 자막 줄을 클릭(탭)했을 때 호출될 핸들러 함수 ***
    const handleLineClick = (index: number) => {
        // 이미 선택된 줄을 다시 클릭하면 선택 해제, 다른 줄을 클릭하면 선택 변경
        if (selectedForActionIndex === index) {
            setSelectedForActionIndex(null);
        } else {
            setSelectedForActionIndex(index);
        }
    };
    
    // (이하 다른 핸들러 함수들은 변경 없음)
    const handleSaveInterpretation = async () => {
        if (!user || !tooltipText || !interpretationResult || !youtubeUrl) {
            setAlertMessage({ title: "저장 오류", subtitle: "저장할 데이터가 부족합니다." });
            setShowAlert(true);
            return;
        }
        const videoId = extractVideoId(youtubeUrl);
        if (!videoId) {
            setAlertMessage({ title: "저장 오류", subtitle: "유효한 YouTube 영상 ID를 찾을 수 없습니다." });
            setShowAlert(true);
            return;
        }
        try {
            await onSave({
                originalText: tooltipText,
                interpretation: interpretationResult,
                youtubeUrl,
                videoId,
                timestamp: new Date(),
            });
            setShowTooltip(false);
        } catch (error) {
            console.error("해석 결과 저장 중 오류 발생:", error);
            setAlertMessage({ title: "저장 오류", subtitle: "해석 결과 저장에 실패했습니다." });
            setShowAlert(true);
        }
    };

    const handleAIInterpretation = async () => {
        if (!tooltipText) return;
        setIsInterpreting(true);
        setInterpretationResult(null);
        try {
            const response = await fetch("/api/interpret", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    selectedText: tooltipText,
                    summary: videoSummary,
                    fullSentence: selectedFullSentenceContext,
                }),
            });
            if (!response.ok) throw new Error("Failed to interpret text");
            const data = await response.json();
            setInterpretationResult(data.interpretation);
        } catch (error) {
            setInterpretationResult("해석에 실패했습니다.");
        } finally {
            setIsInterpreting(false);
        }
    };

    const handleTextSelection = () => {
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection?.toString().trim();

            if (selectedText && selectedText.length > 0) {
                setInterpretationResult(null);
                setTooltipText(selectedText);
                const parentElement = selection?.anchorNode?.parentElement;
                const fullSentence = parentElement?.textContent?.replace(/\[\d{2}:\d{2}\]\s*/g, "").trim() || "";
                setSelectedFullSentenceContext(fullSentence || selectedText);
                const range = selection!.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                if (transcriptContainerRef.current) {
                    const containerRect = transcriptContainerRef.current.getBoundingClientRect();
                    const xPos = rect.left - containerRect.left + rect.width / 2;
                    const yPos = rect.top - containerRect.top - 10;
                    setTooltipPosition({ x: xPos, y: yPos });
                    setShowTooltip(true);
                    // 텍스트 선택 시에는 액션 버튼 선택 상태는 해제하여 UI 충돌 방지
                    setSelectedForActionIndex(null); 
                }
            }
        }, 10);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                setShowTooltip(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
                // *** 수정 3: 현재 줄이 사용자에 의해 클릭(탭)되었는지 확인 ***
                const isSelectedForAction = selectedForActionIndex === index;

                return (
                    <p
                        key={index}
                        ref={(el) => {
                            if (segmentRefs.current) {
                                segmentRefs.current[index] = el;
                            }
                        }}
                        // *** 수정 4: p 태그에 클릭 핸들러 추가 ***
                        onClick={() => handleLineClick(index)}
                        className={`py-2 pl-4 pr-14 transition-all duration-300 relative group cursor-pointer
                            ${isCurrent ? "transform scale-103 bg-blue-50" : "bg-white"}
                            ${isLoopingThisSegment ? "border-2 border-purple-500 ring-2 ring-purple-200" : ""}
                        `}
                    >
                        {/* 타임스탬프 클릭은 줄 전체 클릭과 다르게 동작해야 하므로 이벤트 전파를 막음 */}
                        <span className="flex-1" onClick={(e) => e.stopPropagation()}>
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
                        <button
                            // 버튼 클릭 시에는 부모 p 태그의 onClick이 실행되지 않도록 이벤트 전파 중단
                            onClick={(e) => {
                                e.stopPropagation(); 
                                onLoopToggle(segment.time, segmentEndTime);
                            }}
                            className={`absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-all duration-300
                                ${
                                    isLoopingThisSegment
                                        ? "opacity-100 bg-purple-500 text-white"
                                        : // *** 수정 5: 버튼 표시 로직 변경 ***
                                          `bg-gray-100 text-gray-600 hover:bg-gray-200
                                           ${isSelectedForAction ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`
                                }
                            `}
                            title={isLoopingThisSegment ? "구간 반복 중지" : "구간 반복 시작"}
                        >
                            {isLoopingThisSegment ? "⏹️" : "🔁"}
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