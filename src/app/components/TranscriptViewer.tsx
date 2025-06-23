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
    console.log("TranscriptViewer received user:", user);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipText, setTooltipText] = useState("");
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [interpretationResult, setInterpretationResult] = useState<
        string | null
    >(null);
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [selectedFullSentenceContext, setSelectedFullSentenceContext] =
        useState<string>("");
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState({
        title: "",
        subtitle: "",
    });

    const handleSaveInterpretation = async () => {
        console.log("!!! SAVE BUTTON ACTION TRIGGERED !!!");

        if (!user || !tooltipText || !interpretationResult || !youtubeUrl) {
            console.log("저장할 데이터 부족:", {
                user: !!user,
                tooltipText: !!tooltipText,
                interpretationResult: !!interpretationResult,
                youtubeUrl: !!youtubeUrl,
            });
            setAlertMessage({
                title: "저장 오류",
                subtitle: "저장할 데이터가 부족합니다.",
            });
            setShowAlert(true);
            return;
        }

        const videoId = extractVideoId(youtubeUrl);
        if (!videoId) {
            setAlertMessage({
                title: "저장 오류",
                subtitle: "유효한 YouTube 영상 ID를 찾을 수 없습니다.",
            });
            setShowAlert(true);
            return;
        }

        const newExpressionData = {
            originalText: tooltipText,
            interpretation: interpretationResult,
            youtubeUrl: youtubeUrl,
            videoId: videoId,
            timestamp: new Date(),
        };

        console.log(
            "TranscriptViewer: Calling onSave prop with data:",
            newExpressionData
        );
        try {
            await onSave(newExpressionData);

            // 저장이 완료된 후 툴팁을 닫습니다.
            setShowTooltip(false);
        } catch (error) {
            console.error("해석 결과 저장 중 오류 발생:", error);
            setAlertMessage({
                title: "저장 오류",
                subtitle: "해석 결과 저장에 실패했습니다.",
            });
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

    // [핵심 수정 2] 텍스트 드래그(선택) 핸들러 로직 단순화
    const handleTextSelection = () => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (selectedText && selectedText.length > 0) {
            // 새 텍스트가 선택되면, 기존 해석 결과를 초기화하고 툴팁을 다시 표시
            setInterpretationResult(null);
            setTooltipText(selectedText);

            const parentElement = selection?.anchorNode?.parentElement;
            const fullSentence =
                parentElement?.textContent
                    ?.replace(/\[\d{2}:\d{2}\]\s*/g, "")
                    .trim() || "";
            setSelectedFullSentenceContext(fullSentence || selectedText);

            const range = selection!.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            if (transcriptContainerRef.current) {
                const containerRect =
                    transcriptContainerRef.current.getBoundingClientRect();
                const xPos = rect.left - containerRect.left + rect.width / 2;
                const yPos = rect.top - containerRect.top - 10;

                setTooltipPosition({ x: xPos, y: yPos });
                setShowTooltip(true);
            }
        }
    };

    // 툴팁 외부 클릭 시 닫는 로직
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                tooltipRef.current &&
                !tooltipRef.current.contains(event.target as Node)
            ) {
                setShowTooltip(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // JSX 렌더링 부분
    return (
        <div
            ref={transcriptContainerRef}
            className="text-gray-700 relative"
            onMouseUp={handleTextSelection} // 마우스 놓을 때 텍스트 선택 감지
        >
            {parsedTranscript.map((segment, index) => {
                const isCurrent = index === activeSegmentIndex;
                const nextSegment = parsedTranscript[index + 1];
                const segmentEndTime = nextSegment
                    ? nextSegment.time
                    : videoDuration || segment.time + 5; // 다음 구간이 없으면 영상 끝 또는 5초 뒤
                const isLoopingThisSegment =
                    isLooping && currentLoopStartTime === segment.time;

                return (
                    <p
                        key={index}
                        className={`py-2 px-4 transition-all duration-300 flex justify-between items-center group
                            ${
                                isCurrent
                                    ? "transform scale-103"
                                    : "bg-white"
                            }
                            ${
                                isLoopingThisSegment
                                    ? "border-2 border-purple-500 ring-2 ring-purple-300"
                                    : ""
                            }
                        `}
                    >
                        <span className="flex-1">
                            <span
                                className="text-blue-500 cursor-pointer hover:text-purple-600 transition-colors duration-300"
                                onClick={() => onSeek(segment.time)}
                            >
                                [
                                {String(Math.floor(segment.time / 60)).padStart(
                                    2,
                                    "0"
                                )}
                                :
                                {String(Math.floor(segment.time % 60)).padStart(
                                    2,
                                    "0"
                                )}
                                ]
                            </span>{" "}
                            <span
                                className={`${
                                    isCurrent ? "font-medium" : ""
                                } whitespace-pre-wrap`}
                            >
                                {segment.text}
                            </span>
                        </span>
                        <button
                            onClick={() =>
                                onLoopToggle(segment.time, segmentEndTime)
                            }
                            className={`ml-4 p-2 rounded-full transition-all duration-300
                                ${
                                    isLoopingThisSegment
                                        ? "bg-purple-200 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 group-hover:opacity-100 opacity-0 lg:opacity-0"
                                }
                            `}
                            title={
                                isLoopingThisSegment
                                    ? "구간 반복 중지"
                                    : "구간 반복 시작"
                            }
                        >
                            {isLoopingThisSegment ? "⏹️" : "🔁"}
                        </button>
                    </p>
                );
            })}

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
                    buttons={[
                        {
                            text: "확인",
                            onClick: () => setShowAlert(false),
                            isPrimary: true,
                        },
                    ]}
                    onClose={() => setShowAlert(false)}
                />
            )}
        </div>
    );
};

export default TranscriptViewer;
