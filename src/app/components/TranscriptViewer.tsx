// src/app/components/TranscriptViewer.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
    savedExpressions: SavedExpression[];
}

// --- 유틸리티 함수 (변경 없음) ---
const extractVideoId = (url: string): string | null => {
    const youtubeRegex = /(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);
    return match ? match[1] : null;
};

// --- 컴포넌트 본문 (수정 완료) ---
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
    savedExpressions,
}: TranscriptViewerProps) => {
    const transcriptContainerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null); // 텍스트 선택(드래그) 툴팁 ref
    // [수정 1] 하이라이트 클릭 툴팁을 위한 ref 추가
    const highlightTooltipRef = useRef<HTMLDivElement>(null); 
    const segmentRefs = useRef<(HTMLParagraphElement | null)[]>([]);

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
    
    const [tooltipInfo, setTooltipInfo] = useState<{ 
        visible: boolean; 
        content: string; 
        x: number; 
        y: number; 
    } | null>(null);

    // 저장된 표현 목록을 렌더링 최적화를 위해 Set으로 변환
    const savedTexts = useMemo(() => 
        new Set(savedExpressions.map(exp => exp.originalText.toLowerCase())),
        [savedExpressions]
    );

    // [추가] savedExpressions 데이터 확인용 로그
    useEffect(() => {
        console.log('Saved expressions:', savedExpressions);
    }, [savedExpressions]);

    // 하이라이트 클릭 핸들러
    const handleHighlightClick = useCallback(
        (event: React.MouseEvent<HTMLSpanElement>,
        expression: SavedExpression
    ) => {
        event.stopPropagation();
        event.preventDefault(); // [추가] 이벤트의 기본 동작 방지
        
        console.log('Highlight clicked:', expression); // [디버깅] 클릭된 표현 로깅

        const rect = event.currentTarget.getBoundingClientRect();
        const newTooltipInfo = {
            visible: true,
            content: expression.interpretation,
            x: rect.left + rect.width / 2 + window.scrollX,
            y: rect.bottom + window.scrollY + 5,
        };
        setTooltipInfo(newTooltipInfo);
        console.log('Setting tooltip info:', newTooltipInfo); // [디버깅] 툴팁 정보 설정 로깅
    }, []);
    
    // [수정 3] 하이라이트 클릭 툴팁을 숨기는 useEffect 재수정 (setTimeout 재추가)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (highlightTooltipRef.current && !highlightTooltipRef.current.contains(event.target as Node)) {
                setTooltipInfo(null);
            }
        };

        if (tooltipInfo?.visible) {
            // 툴크가 나타나는 직후에 이벤트 리스너를 추가하여, 동일한 클릭 이벤트로 인해 닫히는 것을 방지
            const timer = setTimeout(() => {
                document.addEventListener("mousedown", handleClickOutside);
            }, 100); // 짧은 지연 추가 (재추가)
            return () => {
                clearTimeout(timer); // 타이머 정리
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
        return () => {};
    }, [tooltipInfo]);

    const renderHighlightedText = useCallback((text: string) => {
        if (savedExpressions.length === 0) {
            return <span>{text}</span>;
        }
        const regex = new RegExp(
            savedExpressions
                .map(exp => exp.originalText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
                .join('|'),
            'gi'
        );
        
        const parts = text.split(regex);
        const matches = text.match(regex) || [];

        return (
            <span>
                {parts.map((part, index) => (
                    <React.Fragment key={index}>
                        {part}
                        {matches[index] && (() => {
                            const matchedExpression = savedExpressions.find(
                                exp => exp.originalText.toLowerCase() === matches[index].toLowerCase()
                            );
                            if (matchedExpression) {
                                return (
                                    <span
                                        className="bg-yellow-200/70 rounded px-1 py-0.5 cursor-pointer hover:bg-yellow-300/70"
                                        onClick={(e) => handleHighlightClick(e, matchedExpression)}
                                    >
                                        {matches[index]}
                                    </span>
                                );
                            }
                            return <span>{matches[index]}</span>;
                        })()}
                    </React.Fragment>
                ))}
            </span>
        );
    }, [savedExpressions, handleHighlightClick]);

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
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !tooltipRef.current)
            return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect =
            transcriptContainerRef.current.getBoundingClientRect();

        const tooltipWidth = tooltipRef.current.offsetWidth;
        const tooltipHeight = tooltipRef.current.offsetHeight;

        const selectionCenterXInContainer =
            rect.left + rect.width / 2 - containerRect.left;
        const selectionTopYInContainer = rect.top - containerRect.top;
        const selectionBottomYInContainer = rect.bottom - containerRect.top;

        let finalTop: number;
        let finalLeft: number;
        let transformParts: string[] = [];
        const padding = 10;
        const spaceAbove = selectionTopYInContainer;
        const spaceBelow = containerRect.height - selectionBottomYInContainer;

        if (spaceAbove >= tooltipHeight + padding) {
            finalTop = selectionTopYInContainer;
            transformParts.push("translateY(-100%)");
        } else if (spaceBelow >= tooltipHeight + padding) {
            finalTop = selectionBottomYInContainer + padding;
            transformParts.push("translateY(0%)");
        } else {
            finalTop = selectionTopYInContainer;
            transformParts.push("translateY(-100%)");
            if (finalTop - tooltipHeight < 0) {
                finalTop = 0;
                transformParts[0] = "translateY(0%)";
            }
        }

        let desiredLeft = selectionCenterXInContainer - tooltipWidth / 2;

        if (desiredLeft < 0) {
            finalLeft = 0; 
            transformParts = transformParts.filter(
                (p) => !p.startsWith("translateX")
            ); 
            transformParts.push("translateX(0%)");
        }
        else if (desiredLeft + tooltipWidth > containerRect.width) {
            finalLeft = containerRect.width - tooltipWidth;
            transformParts = transformParts.filter(
                (p) => !p.startsWith("translateX")
            );
            transformParts.push("translateX(0%)");
        } else {
            finalLeft = selectionCenterXInContainer;
            transformParts = transformParts.filter(
                (p) => !p.startsWith("translateX")
            );
            transformParts.push("translateX(-50%)");
        }
        
        setTooltipStyles({
            top: finalTop,
            left: finalLeft,
            transform: transformParts.join(" "),
            zIndex: 55,
            opacity: showTooltip ? 1 : 0,
            visibility: showTooltip ? "visible" : "hidden",
        });
    }, [showTooltip, interpretationResult]);

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
                setInterpretationResult(null);
                setTooltipText(selectedText);

                const parentElement = selection.anchorNode?.parentElement;
                const fullSentence =
                    parentElement?.textContent
                        ?.replace(/\[\d{2}:\d{2}\]\s*/g, "")
                        .trim() || "";
                setSelectedFullSentenceContext(fullSentence || selectedText);

                setShowTooltip(true);
            } else {
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
    }, [isInterpreting]);
    
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
    
    const handleSaveInterpretation = async () => {
        if (!user || !tooltipText || !interpretationResult || !youtubeUrl) {
            setAlertMessage({
                title: "저장 오류",
                subtitle: "저장할 데이터가 부족합니다.",
            });
            setShowAlert(true);
            return;
        }

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
        <>
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
                            onClick={() => handleLineClick(index)}
                            className={`relative group flex items-start min-h-[44px] cursor-pointer transition-all duration-300 pl-2 pr-2 py-2
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
                            <span
                                className="text-blue-500 hover:text-purple-600 transition-colors duration-300 mr-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSeek(segment.time);
                                }}
                            >
                                [
                                {(() => {
                                    const hours = Math.floor(segment.time / 3600);
                                    const minutes = Math.floor((segment.time % 3600) / 60);
                                    const seconds = Math.floor(segment.time % 60);

                                    return `${
                                        hours > 0 ? `${String(hours).padStart(2, '0')}:` : ''
                                    }${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
                                })()}
                                ]
                            </span>{" "}
                            <span
                                className={`${
                                    isCurrent ? "font-medium" : "text-gray-600"
                                } whitespace-pre-wrap flex-1`}
                            >
                                {renderHighlightedText(segment.text)}
                            </span>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
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
            </div>

            {/* [수정 2] 하이라이트 클릭 툴팁에 ref 할당 및 pointer-events-auto 추가 */}
            {tooltipInfo?.visible && (
                <div
                    ref={highlightTooltipRef} // 올바른 ref 사용
                    className="fixed z-50 bg-gray-800 text-white text-sm rounded-lg shadow-xl py-2 px-4 max-w-xs pointer-events-auto" // [수정] absolute -> fixed
                    style={{
                        top: `${tooltipInfo.y}px`,
                        left: `${tooltipInfo.x}px`,
                        transform: 'translateX(-50%)', // 중앙 정렬
                        pointerEvents: 'auto', // [추가] 명시적으로 pointer-events: auto 설정
                    }}
                    onClick={e => e.stopPropagation()} // 툴팁 클릭 시 닫히지 않도록 함
                >
                    {tooltipInfo.content}
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
        </>
    );
};

export default TranscriptViewer;