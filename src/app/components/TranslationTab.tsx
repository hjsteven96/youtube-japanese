"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface TranslationData {
    fullTranslation?: string;
    timelineTranslation: Array<{
        timestamp: string;
        koreanTranslation: string;
    }>;
}

interface TranslationTabProps {
    transcript: string;
    analysis: any;
    videoId: string;
    onSeek?: (time: number) => void;
    initialTranslationData?: TranslationData | null;
    currentTime?: number;
    onTranslationReady?: (data: TranslationData) => void;
}

const TranslationSkeleton = () => (
    <div className="p-4 space-y-6 animate-pulse">
        {/* 전체 번역 스켈레톤 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
        </div>
        
        {/* 타임라인 번역 스켈레톤 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-4">
                {[...Array(3)].map((_, index) => (
                    <div key={index} className="border-l-4 border-blue-200 pl-4">
                        <div className="h-4 bg-gray-200 rounded w-1/6 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const TranslationTab: React.FC<TranslationTabProps> = ({
    transcript,
    analysis,
    videoId,
    onSeek,
    initialTranslationData,
    currentTime = 0,
    onTranslationReady,
}) => {
    const [translationData, setTranslationData] = useState<TranslationData | null>(initialTranslationData || null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const segmentRefs = useRef<(HTMLParagraphElement | null)[]>([]);
    const isInitialRender = useRef(true);
    const requestState = useRef({
        inFlight: false,
        retryUntilMs: 0,
        hadRateLimit: false,
    });

    useEffect(() => {
        if (initialTranslationData && !translationData) {
            setTranslationData(initialTranslationData);
        }
    }, [initialTranslationData, translationData]);

    useEffect(() => {
        const fetchTranslation = async () => {
            if (!transcript) return;
            
            // 이미 번역 데이터가 있으면 API 호출하지 않음
            if (translationData) return;
            if (!videoId) return;
            if (requestState.current.inFlight) return;
            if (
                requestState.current.hadRateLimit &&
                Date.now() < requestState.current.retryUntilMs
            ) {
                setError("요청이 많아 잠시 후 다시 시도해주세요.");
                return;
            }
            
            setIsLoading(true);
            setError("");
            requestState.current.inFlight = true;
            
            try {
                const docRef = doc(db, "videoAnalyses", videoId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const existingData = docSnap.data();
                    if (existingData.koreanTranslation) {
                        setTranslationData(existingData.koreanTranslation);
                        if (onTranslationReady) {
                            onTranslationReady(existingData.koreanTranslation);
                        }
                        return;
                    }
                }

                const response = await fetch("/api/korean-translation", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        transcript,
                        analysis,
                        videoId,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    console.error("[TRANSLATION_API_ERROR]", {
                        status: response.status,
                        data,
                    });
                    if (response.status === 429) {
                        requestState.current.hadRateLimit = true;
                        if (typeof data?.retryAfterSeconds === "number") {
                            requestState.current.retryUntilMs =
                                Date.now() + data.retryAfterSeconds * 1000;
                        }
                    } else {
                        requestState.current.hadRateLimit = false;
                        requestState.current.retryUntilMs = 0;
                    }
                    throw new Error(data?.error || "번역 요청에 실패했습니다.");
                }

                setTranslationData(data.translation);
                if (data.translation && onTranslationReady) {
                    onTranslationReady(data.translation);
                }
            } catch (err: any) {
                console.error("Translation error:", err);
                if (!requestState.current.hadRateLimit) {
                    requestState.current.retryUntilMs = 0;
                }
                setError(err.message || "번역 중 오류가 발생했습니다.");
            } finally {
                setIsLoading(false);
                requestState.current.inFlight = false;
            }
        };

        fetchTranslation();
    }, [analysis, transcript, videoId, translationData, onTranslationReady]);

    // 현재 재생 중인 세그먼트를 찾는 로직
    const { activeSegmentIndex } = useMemo(() => {
        if (!translationData || !translationData.timelineTranslation) {
            return { activeSegmentIndex: -1 };
        }

        const segments = translationData.timelineTranslation.map((item) => {
            const parseTimestamp = (timestamp: string): number => {
                const match = timestamp.match(/\[(?:(\d{1,2}):)?(\d{2}):(\d{2})\]/);
                if (match) {
                    const hours = match[1] ? parseInt(match[1], 10) : 0;
                    const minutes = parseInt(match[2], 10);
                    const seconds = parseInt(match[3], 10);
                    return hours * 3600 + minutes * 60 + seconds;
                }
                return 0;
            };
            return parseTimestamp(item.timestamp);
        });

        const activeIndex = segments.findIndex((time, index) => {
            const nextTime = segments[index + 1];
            return currentTime >= time && (!nextTime || currentTime < nextTime);
        });

        return { activeSegmentIndex: activeIndex };
    }, [translationData, currentTime]);

    // 자동 스크롤 로직
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

    if (isLoading) {
        return <TranslationSkeleton />;
    }

    if (error) {
        return (
            <div className="p-4">
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <p className="text-red-600 text-center">⚠️ {error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 w-full bg-red-100 hover:bg-red-200 text-red-700 font-medium py-2 px-4 rounded transition-colors"
                    >
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    if (!translationData) {
        return (
            <div className="p-4">
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                    <p className="text-gray-600 text-center">번역 데이터를 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="text-gray-700 relative">
            {/* 전체 번역 섹션 */}
            {translationData.fullTranslation && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg border-l-4 border-green-200">
                    <h3 className="text-lg font-bold mb-3 text-green-700 flex items-center">
                        📄 전체 요약
                    </h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                        {translationData.fullTranslation}
                    </p>
                </div>
            )}

            {/* 타임라인 번역 섹션 */}
            {translationData.timelineTranslation && translationData.timelineTranslation.length > 0 && (
                <>
                    {/* Tip 텍스트 */}
                    <p className="text-sm text-gray-500 mb-4 px-2">
                        타임스탬프를 클릭하여 해당 시간으로 이동할 수 있습니다.
                    </p>
                    {translationData.timelineTranslation.map((item, index) => {
                        // 타임스탬프에서 시간(초) 추출
                        const parseTimestamp = (timestamp: string): number => {
                            const match = timestamp.match(/\[(?:(\d{1,2}):)?(\d{2}):(\d{2})\]/);
                            if (match) {
                                const hours = match[1] ? parseInt(match[1], 10) : 0;
                                const minutes = parseInt(match[2], 10);
                                const seconds = parseInt(match[3], 10);
                                return hours * 3600 + minutes * 60 + seconds;
                            }
                            return 0;
                        };

                        const timeInSeconds = parseTimestamp(item.timestamp);
                        const isCurrent = index === activeSegmentIndex;

                        return (
                            <p
                                key={index}
                                ref={(el) => {
                                    if (segmentRefs.current)
                                        segmentRefs.current[index] = el;
                                }}
                                className={`relative group flex items-start min-h-[44px] cursor-pointer transition-all duration-300 pl-2 pr-2 py-2 ${
                                    isCurrent
                                        ? "transform scale-103 bg-blue-50"
                                        : "bg-white"
                                } hover:bg-blue-50`}
                            >
                                <span
                                    className="text-blue-500 hover:text-purple-600 transition-colors duration-300 mr-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onSeek) onSeek(timeInSeconds);
                                    }}
                                >
                                    {(() => {
                                        const hours = Math.floor(timeInSeconds / 3600);
                                        const minutes = Math.floor((timeInSeconds % 3600) / 60);
                                        const seconds = Math.floor(timeInSeconds % 60);

                                        return `[${
                                            hours > 0
                                                ? `${String(hours).padStart(2, "0")}:`
                                                : ""
                                        }${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}]`;
                                    })()}
                                </span>
                                <span className={`${
                                    isCurrent ? "font-normal text-gray-800" : "text-gray-700"
                                } whitespace-pre-wrap flex-1 text-base`}>
                                    {item.koreanTranslation}
                                </span>
                            </p>
                        );
                    })}
                </>
            )}
        </div>
    );
};

export default TranslationTab;
