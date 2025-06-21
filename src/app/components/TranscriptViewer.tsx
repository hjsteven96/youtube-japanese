"use client";

import React, { useState, useRef, useEffect } from "react";
import { User } from "firebase/auth";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "../../lib/firebase"; // Firestore 인스턴스 경로 확인

interface VideoSegment {
    time: number;
    text: string;
}

interface TranscriptViewerProps {
    parsedTranscript: VideoSegment[];
    activeSegmentIndex: number;
    onSeek: (time: number) => void;
    videoSummary: string; // AI 해석에 필요한 전체 요약
    user: User | null; // 해석 저장에 필요
    youtubeUrl: string; // 해석 저장에 필요
}

const TranscriptViewer = ({
    parsedTranscript,
    activeSegmentIndex,
    onSeek,
    videoSummary,
    user,
    youtubeUrl,
}: TranscriptViewerProps) => {
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

    // 활성 자막으로 스크롤
    useEffect(() => {
        if (activeSegmentIndex === -1 || !transcriptContainerRef.current)
            return;
        const activeSegmentElement = transcriptContainerRef.current.children[
            activeSegmentIndex
        ] as HTMLElement;
        if (activeSegmentElement) {
            activeSegmentElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [activeSegmentIndex]);

    // 툴크 외부 클릭 시 숨기기
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
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelection = (e: React.MouseEvent) => {
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
        const selection = window.getSelection();

        if (selection && selection.toString().length > 0) {
            const selectedText = selection.toString().trim();
            setTooltipText(selectedText);
            setInterpretationResult(null);

            let foundFullSentence = "";
            const parentElement = selection.anchorNode?.parentElement;
            if (parentElement) {
                foundFullSentence =
                    parentElement.textContent
                        ?.replace(/\[\d{2}:\d{2}\]\s*/g, "")
                        .trim() || "";
            }
            setSelectedFullSentenceContext(foundFullSentence || selectedText);

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            if (transcriptContainerRef.current) {
                const containerRect =
                    transcriptContainerRef.current.getBoundingClientRect();
                const xPos = rect.left - containerRect.left + rect.width / 2;
                const yPos = rect.top - containerRect.top - 10;

                tooltipTimeoutRef.current = setTimeout(() => {
                    setTooltipPosition({ x: xPos, y: yPos });
                    setShowTooltip(true);
                }, 300);
            }
        } else {
            setShowTooltip(false);
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

    const handleSaveInterpretation = async () => {
        if (!user || !tooltipText || !interpretationResult || !youtubeUrl) {
            alert("저장할 데이터가 부족합니다.");
            return;
        }

        try {
            const interpretationId = `interpret_${Date.now()}`;
            const userDocRef = doc(db, "users", user.uid);
            const savedInterpretationsCollectionRef = collection(
                userDocRef,
                "savedInterpretations"
            );
            const interpretationDocRef = doc(
                savedInterpretationsCollectionRef,
                interpretationId
            );

            await setDoc(interpretationDocRef, {
                originalText: tooltipText,
                interpretation: interpretationResult,
                youtubeUrl: youtubeUrl,
                timestamp: new Date(),
            });
            alert("해석 결과가 성공적으로 저장되었습니다!");
            setShowTooltip(false);
        } catch (error) {
            console.error("해석 결과 저장 중 오류 발생:", error);
            alert("해석 결과 저장에 실패했습니다.");
        }
    };

    return (
        <div
            ref={transcriptContainerRef}
            className="text-gray-700 space-y-2 relative"
            onMouseUp={handleSelection}
        >
            {parsedTranscript.map((segment, index) => {
                const isCurrent = index === activeSegmentIndex;
                return (
                    <p
                        key={index}
                        className={`py-1 px-4 rounded-lg transition-all duration-300 ${
                            isCurrent
                                ? "bg-gradient-to-r from-blue-100 to-purple-100 shadow-md transform scale-105"
                                : "bg-white hover:bg-gray-50"
                        }`}
                    >
                        <span
                            className="font-bold text-blue-600 cursor-pointer hover:text-purple-600 transition-colors duration-300"
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
                    </p>
                );
            })}

            {showTooltip && (
                <div
                    ref={tooltipRef}
                    className="absolute z-10 bg-gray-800 text-white text-sm rounded-lg shadow-lg py-2 px-3 flex flex-col space-y-2 max-w-xs min-w-[120px]"
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
                                        onClick={handleSaveInterpretation}
                                        className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded-md text-xs"
                                    >
                                        저장
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowTooltip(false)}
                                    className="bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded-md text-xs"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex space-x-2">
                            <button
                                onClick={handleAIInterpretation}
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
    );
};

export default TranscriptViewer;
