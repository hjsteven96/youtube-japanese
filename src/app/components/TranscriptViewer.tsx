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

// --- 컴포넌트 본문 (최종 수정) ---
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

    const [selectedForActionIndex, setSelectedForActionIndex] = useState<
        number | null
    >(null);
    const isInitialRender = useRef(true);
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

    // 스크롤 제어 로직 (변경 없음)
    useEffect(() => {
        if (activeSegmentIndex < 1) return;

        if (isInitialRender.current && activeSegmentIndex === 0) {
            isInitialRender.current = false; // 플래그를 false로 바꿔 다음부터는 정상 작동하도록 함
            return;
        }

        const activeElement = segmentRefs.current[activeSegmentIndex];
        if (activeElement) {
            activeElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [activeSegmentIndex]);

    // [핵심 수정] 툴팁을 표시/숨기는 공통 함수
    const showOrHideTooltip = () => {
        const selection = window.getSelection();
        if (!selection) return;

        const selectedText = selection.toString().trim();

        if (selectedText && selectedText.length > 0) {
            // 선택 영역이 현재 컴포넌트 내에 있는지 확인 (가장 안정적인 방법)
            const containerNode = transcriptContainerRef.current;
            if (
                !containerNode ||
                !selection.anchorNode ||
                !containerNode.contains(selection.anchorNode)
            ) {
                // 선택이 이 컴포넌트 밖에서 시작되었으면 무시
                return;
            }

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const containerRect = containerNode.getBoundingClientRect();

            const xPos = rect.left - containerRect.left + rect.width / 2;
            const yPos = rect.top - containerRect.top;

            setInterpretationResult(null);
            setTooltipText(selectedText);

            const parentElement = selection.anchorNode?.parentElement;
            const fullSentence =
                parentElement?.textContent
                    ?.replace(/\[\d{2}:\d{2}\]\s*/g, "")
                    .trim() || "";
            setSelectedFullSentenceContext(fullSentence || selectedText);

            setTooltipPosition({ x: xPos, y: yPos });
            setShowTooltip(true);
        } else {
            if (!isInterpreting) {
                setShowTooltip(false);
            }
        }
    };

    // [핵심 수정] 데스크톱과 모바일을 위한 이벤트 핸들러 분리 및 결합
    useEffect(() => {
        const handleSelection = () => {
            // setTimeout으로 감싸 모바일에서의 타이밍 이슈 해결
            setTimeout(showOrHideTooltip, 0);
        };

        const container = transcriptContainerRef.current;
        if (container) {
            // 데스크톱용 이벤트
            container.addEventListener("mouseup", handleSelection);
            // 모바일용 이벤트
            document.addEventListener("selectionchange", handleSelection);
        }

        return () => {
            if (container) {
                container.removeEventListener("mouseup", handleSelection);
            }
            document.removeEventListener("selectionchange", handleSelection);
        };
    }, [isInterpreting]); // isInterpreting이 변경될 때 리스너를 다시 설정하여 최신 상태 참조

    const handleLineClick = (index: number) => {
        if (selectedForActionIndex === index) {
            setSelectedForActionIndex(null);
        } else {
            setSelectedForActionIndex(index);
        }
    };

    const handleSaveInterpretation = async () => {
        if (!user || !tooltipText || !interpretationResult || !youtubeUrl) {
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

        try {
            await onSave(newExpressionData);
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

    return (
        <div
            ref={transcriptContainerRef}
            className="text-gray-700 relative select-text" // `select-text` 추가로 텍스트 선택 보장
            onContextMenu={(e) => e.preventDefault()}
        >
            {parsedTranscript.map((segment, index) => {
                const isCurrent = index === activeSegmentIndex;
                const nextSegment = parsedTranscript[index + 1];
                const segmentEndTime = nextSegment
                    ? nextSegment.time
                    : videoDuration || segment.time + 5;
                const isLoopingThisSegment =
                    isLooping && currentLoopStartTime === segment.time;
                const isSelectedForAction = selectedForActionIndex === index;

                const isButtonVisible =
                    isLoopingThisSegment || isSelectedForAction;

                return (
                    <p
                        key={index}
                        ref={(el) => {
                            if (segmentRefs.current)
                                segmentRefs.current[index] = el;
                        }}
                        onClick={() => handleLineClick(index)}
                        className={`relative group flex items-center min-h-[44px] cursor-pointer transition-all duration-300 pl-2 pr-2 p-2
                            ${
                                isCurrent
                                    ? "transform scale-103 bg-blue-50"
                                    : "bg-white"
                            }
                            ${
                                isLoopingThisSegment
                                    ? "ring-2 ring-purple-300"
                                    : ""
                            }
                        `}
                    >
                        <span onClick={(e) => e.stopPropagation()}>
                            <span
                                className="text-blue-500 hover:text-purple-600 transition-colors duration-300"
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
                                    isCurrent ? "font-medium" : "text-gray-600"
                                } whitespace-pre-wrap`}
                            >
                                {segment.text}
                            </span>
                        </span>

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
                                        ? "opacity-100 pointer-events-auto"
                                        : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                                }
                            `}
                            title={
                                isLoopingThisSegment
                                    ? "구간 반복 중지"
                                    : "구간 반복 시작"
                            }
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
