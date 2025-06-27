// src/app/components/TranscriptViewer.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
    maxSavedWords: number;
    savedExpressionsCount: number;
    onShowAlert: (config: {
        title: string;
        subtitle: string;
        buttons: { text: string; onClick: () => void; isPrimary?: boolean }[];
    }) => void;
}

// --- 유틸리티 함수 (변경 없음) ---
const extractVideoId = (url: string): string | null => {
    const youtubeRegex = /(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);
    return match ? match[1] : null;
};

// --- 컴포넌트 본문 (최종 수정 완료) ---
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
    maxSavedWords,
    savedExpressionsCount,
    onShowAlert,
}: TranscriptViewerProps) => {
    const transcriptContainerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const segmentRefs = useRef<(HTMLParagraphElement | null)[]>([]);

    // 모바일에서 버튼 자동 숨김을 위한 타이머 참조
    const hideButtonTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [selectedForActionIndex, setSelectedForActionIndex] = useState<
        number | null
    >(null);
    const isInitialRender = useRef(true);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipText, setTooltipText] = useState("");
    const [tooltipStyles, setTooltipStyles] = useState<React.CSSProperties>({});
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
            isInitialRender.current = false;
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

    // 컴포넌트 언마운트 시 타이머 정리
    useEffect(() => {
        return () => {
            if (hideButtonTimerRef.current) {
                clearTimeout(hideButtonTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (
            !showTooltip ||
            !transcriptContainerRef.current ||
            !tooltipRef.current
        ) {
            return; // 툴팁이 표시되지 않거나 DOM 요소가 없으면 실행 안 함
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !tooltipRef.current)
            return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect(); // 선택 영역의 뷰포트 기준 위치 및 크기
        const containerRect =
            transcriptContainerRef.current.getBoundingClientRect(); // 스크롤 컨테이너의 뷰포트 기준 위치 및 크기

        // 툴팁의 현재 렌더링된 크기 (중요!)
        const tooltipWidth = tooltipRef.current.offsetWidth;
        const tooltipHeight = tooltipRef.current.offsetHeight;

        // 선택 영역의 중심점(X)과 상단/하단(Y)을 컨테이너 기준으로 계산
        const selectionCenterXInContainer =
            rect.left + rect.width / 2 - containerRect.left;
        const selectionTopYInContainer = rect.top - containerRect.top;
        const selectionBottomYInContainer = rect.bottom - containerRect.top;

        let finalTop: number;
        let finalLeft: number;
        let transformParts: string[] = [];

        // 1. 수직 위치 결정
        const padding = 10; // 툴팁과 선택 영역 사이의 간격

        const spaceAbove = selectionTopYInContainer; // 선택 영역 상단까지의 컨테이너 공간
        const spaceBelow = containerRect.height - selectionBottomYInContainer; // 선택 영역 하단부터 컨테이너 하단까지의 공간

        // 툴팁을 위에 배치할 충분한 공간이 있는지 확인
        if (spaceAbove >= tooltipHeight + padding) {
            finalTop = selectionTopYInContainer;
            transformParts.push("translateY(-100%)"); // 툴팁 높이만큼 위로 이동
        } else if (spaceBelow >= tooltipHeight + padding) {
            // 위에 공간이 부족하고, 아래에 충분한 공간이 있으면 아래에 배치
            finalTop = selectionBottomYInContainer + padding; // 선택 영역 아래 10px 위치
            transformParts.push("translateY(0%)"); // 수직 변환 없음
        } else {
            // 위아래 모두 공간이 부족할 경우, 일단 위에 배치 (잘릴 수 있음)
            // 또는 컨테이너의 맨 위/아래에 강제 고정하는 로직 추가 가능
            finalTop = selectionTopYInContainer;
            transformParts.push("translateY(-100%)");
            // 이 경우, 툴팁이 컨테이너 상단을 넘어간다면 컨테이너 상단에 고정
            if (finalTop - tooltipHeight < 0) {
                finalTop = 0;
                transformParts[0] = "translateY(0%)"; // 이미 translateY(-100%)가 있다면 교체
            }
        }

        // 2. 수평 위치 결정
        // 툴팁을 선택 영역의 중앙에 오도록 초기 left 값 설정
        let desiredLeft = selectionCenterXInContainer - tooltipWidth / 2;

        // 툴팁이 컨테이너의 왼쪽 경계를 넘어가는지 확인
        if (desiredLeft < 0) {
            finalLeft = 0; // 컨테이너 왼쪽 경계에 툴팁 왼쪽을 맞춤
            transformParts = transformParts.filter(
                (p) => !p.startsWith("translateX")
            ); // 수평 translateX 제거
            transformParts.push("translateX(0%)"); // 왼쪽 끝에 고정
        }
        // 툴팁이 컨테이너의 오른쪽 경계를 넘어가는지 확인
        else if (desiredLeft + tooltipWidth > containerRect.width) {
            finalLeft = containerRect.width - tooltipWidth; // 컨테이너 오른쪽 경계에 툴팁 오른쪽을 맞춤
            transformParts = transformParts.filter(
                (p) => !p.startsWith("translateX")
            );
            transformParts.push("translateX(0%)"); // 오른쪽 끝에 고정
        } else {
            // 컨테이너 범위 내에 있으면 중앙에 배치
            finalLeft = selectionCenterXInContainer;
            transformParts = transformParts.filter(
                (p) => !p.startsWith("translateX")
            ); // 기존 translateX 제거
            transformParts.push("translateX(-50%)"); // 중앙 정렬
        }

        // 스타일 업데이트
        setTooltipStyles({
            top: finalTop,
            left: finalLeft,
            transform: transformParts.join(" "), // 모든 transform 속성을 하나의 문자열로 결합
            zIndex: 55, // 다른 UI보다 위에 표시되도록 Z-index 설정
            // tooltip-appear 애니메이션을 위해 opacity는 CSS 클래스에 맡김
            opacity: showTooltip ? 1 : 0, // 툴팁 가시성 상태에 따라 투명도 조정
            visibility: showTooltip ? "visible" : "hidden", // 툴팁 가시성 상태에 따라 표시 여부 조정
        });
    }, [showTooltip, interpretationResult]); // showTooltip, interpretationResult 변경 시 재실행

    // 텍스트 선택 시 툴팁 표시를 위한 useEffect
    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (!selection || !transcriptContainerRef.current) {
                setShowTooltip(false);
                return;
            }

            const selectedText = selection.toString().trim();
            const containerNode = transcriptContainerRef.current;

            if (
                selectedText &&
                selectedText.length > 0 &&
                containerNode.contains(selection.anchorNode!)
            ) {
                // 툴팁 표시 관련 상태만 업데이트
                setInterpretationResult(null);
                setTooltipText(selectedText);

                const parentElement = selection.anchorNode?.parentElement;
                const fullSentence =
                    parentElement?.textContent
                        ?.replace(/\[\d{2}:\d{2}\]\s*/g, "")
                        .trim() || "";
                setSelectedFullSentenceContext(fullSentence || selectedText);

                setShowTooltip(true); // 툴팁 표시 요청
            } else {
                // 선택 해제 시 툴팁 숨김
                if (!isInterpreting) {
                    setShowTooltip(false);
                    setTooltipText("");
                    setInterpretationResult(null);
                }
            }
        };

        const container = transcriptContainerRef.current;
        if (container) {
            container.addEventListener("mouseup", handleSelection);
            document.addEventListener("selectionchange", handleSelection);
        }

        return () => {
            if (container) {
                container.removeEventListener("mouseup", handleSelection);
            }
            document.removeEventListener("selectionchange", handleSelection);
        };
    }, [isInterpreting]); // isInterpreting이 변경될 때만 이 useEffect를 다시 실행
    // 모바일 환경을 위한 타이머 로직이 포함된 라인 클릭 핸들러
    const handleLineClick = (index: number) => {
        if (hideButtonTimerRef.current) {
            clearTimeout(hideButtonTimerRef.current);
        }

        if (selectedForActionIndex === index) {
            setSelectedForActionIndex(null);
        } else {
            setSelectedForActionIndex(index);
            hideButtonTimerRef.current = setTimeout(() => {
                setSelectedForActionIndex(null);
            }, 3000);
        }
    };

    // 저장 및 해석 관련 함수
    const handleSaveInterpretation = async () => {
        if (!user || !tooltipText || !interpretationResult || !youtubeUrl) {
            setAlertMessage({
                title: "저장 오류",
                subtitle: "저장할 데이터가 부족합니다.",
            });
            setShowAlert(true);
            return;
        }

        // [추가] 저장 가능한 단어 수 제한
        if (savedExpressionsCount >= maxSavedWords) {
            onShowAlert({
                title: "저장 한도 초과",
                subtitle: `저장 가능한 단어(${maxSavedWords}개)를 초과했습니다. 더 많은 단어를 저장하려면 플랜을 업그레이드해주세요.`,
                buttons: [
                    {
                        text: "요금제 보기",
                        onClick: () => {
                            window.location.href = "/pricing";
                        },
                        isPrimary: true,
                    },
                    {
                        text: "닫기",
                        onClick: () => {},
                        isPrimary: false,
                    },
                ],
            });
            setShowTooltip(false);
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
            onShowToast("표현이 성공적으로 저장되었습니다.");
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
            className="text-gray-700 relative select-text"
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
                        // 라인 전체 클릭 시 핸들러 호출
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
                        {/* 자식 span의 onClick을 제거하여 이벤트가 부모 p 태그로 전파되게 함 */}
                        <span>
                            <span
                                className="text-blue-500 hover:text-purple-600 transition-colors duration-300"
                                // 타임스탬프 클릭은 seek만 하고, 이벤트 전파를 막아 handleLineClick이 호출되지 않게 함
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSeek(segment.time);
                                }}
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
                                // 버튼 클릭 시 자동 숨김 타이머가 있다면 취소
                                if (hideButtonTimerRef.current) {
                                    clearTimeout(hideButtonTimerRef.current);
                                }
                                onLoopToggle(segment.time, segmentEndTime);
                            }}
                            className={`
                                absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-all duration-300
                                ${
                                    isLoopingThisSegment
                                        ? "bg-blue-100 bg-opacity-50 text-blue-500"
                                        : "bg-gray-200 bg-opacity-50 text-gray-500 hover:bg-blue-200"
                                }
                                ${
                                    isButtonVisible
                                        ? "opacity-100 pointer-events-auto"
                                        : "opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto"
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
                    style={tooltipStyles}
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
