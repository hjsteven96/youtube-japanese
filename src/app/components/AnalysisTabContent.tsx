"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import TranscriptViewer from "./TranscriptViewer";
import TranslationTab from "./TranslationTab";
import { User } from "firebase/auth";
import SavedExpressions, { SavedExpression } from "./SavedExpressions";
import { UserProfile } from "@/lib/plans";

type FuriganaToken = {
    surface: string;
    reading: string | null;
    hasKanji: boolean;
};

const parseTranscriptSegments = (rawTranscript: string) => {
    const safeTranscript = String(rawTranscript || "");
    if (!safeTranscript.trim()) return [];

    const parsed: { time: number; text: string }[] = [];
    const regex = /\[(?:(\d{1,2}):)?(\d{2}):(\d{2})\]([^\[]*)/g;
    const matches = [...safeTranscript.matchAll(regex)];

    for (const match of matches) {
        const hours = match[1] ? parseInt(match[1], 10) : 0;
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const timeInSeconds = hours * 3600 + minutes * 60 + seconds;
        const text = match[4].trim();
        if (text) parsed.push({ time: timeInSeconds, text });
    }

    if (parsed.length === 0 && safeTranscript.trim()) {
        parsed.push({ time: 0, text: safeTranscript.trim() });
    }

    return parsed;
};

interface AnalysisTabContentProps {
    activeTab: "analysis" | "subtitles" | "questions";
    analysis: any;
    transcript: string;
    currentTime: number;
    onSeek: (time: number) => void;
    onStartConversation: (question: string) => void;
    isConversationPending: boolean;
    user: User | null;
    youtubeUrl: string;
    savedExpressions: SavedExpression[];
    onDeleteExpression: (id: string) => void;
    onAddExpression: (expression: Omit<SavedExpression, "id">) => Promise<void>;
    onLoopToggle: (startTime: number, endTime: number) => void;
    isLooping: boolean;
    currentLoopStartTime: number | null;
    currentLoopEndTime: number | null;
    videoDuration: number | null;
    onShowToast: (message: string) => void;
    isAnalysisLoading: boolean;
    userProfile: UserProfile | null;
    onShowAlert: (config: any) => void;
    maxSavedWords: number;
    savedExpressionsCount: number;
    videoId?: string;
    initialTranslationData?: any;
    onTranslationReady?: (data: any) => void;
}

const AnalysisSkeleton = () => (
    <div className="p-4 space-y-4 animate-pulse">
        {/* 저장한 표현 스켈레톤 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
        </div>
        {/* 핵심 단어 스켈레톤 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="flex flex-wrap gap-2">
                <div className="h-8 bg-gray-200 rounded-full w-24"></div>
                <div className="h-8 bg-gray-200 rounded-full w-32"></div>
                <div className="h-8 bg-gray-200 rounded-full w-28"></div>
            </div>
        </div>
        {/* 실전 표현 스켈레톤 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
                <div className="h-12 bg-gray-200 rounded-lg w-full"></div>
                <div className="h-12 bg-gray-200 rounded-lg w-full"></div>
            </div>
        </div>
    </div>
);

const AnalysisTabContent = ({
    activeTab,
    analysis,
    transcript,
    isAnalysisLoading,
    ...props
}: AnalysisTabContentProps) => {
    const { parsedTranscript, activeSegmentIndex } = useMemo(() => {
        const parsed = parseTranscriptSegments(transcript);

        const activeIndex = parsed.findIndex((segment, index) => {
            const nextSegment = parsed[index + 1];
            return (
                props.currentTime >= segment.time &&
                (!nextSegment || props.currentTime < nextSegment.time)
            );
        });

        return { parsedTranscript: parsed, activeSegmentIndex: activeIndex };
    }, [transcript, props.currentTime]);

    const [showJapaneseSubtitle, setShowJapaneseSubtitle] = useState(true);
    const [showKoreanSubtitle, setShowKoreanSubtitle] = useState(false);
    const [isTranslationLoading, setIsTranslationLoading] = useState(false);
    const [showFurigana, setShowFurigana] = useState(false);
    const [furiganaByTime, setFuriganaByTime] = useState<
        Map<number, FuriganaToken[]>
    >(new Map());
    const [isFuriganaLoading, setIsFuriganaLoading] = useState(false);
    const [furiganaError, setFuriganaError] = useState("");
    const [translationData, setTranslationData] = useState(
        props.initialTranslationData || null
    );

    const furiganaSegments = useMemo(
        () => parseTranscriptSegments(transcript),
        [transcript]
    );

    useEffect(() => {
        if (props.initialTranslationData) {
            setTranslationData(props.initialTranslationData);
        }
    }, [props.initialTranslationData]);

    useEffect(() => {
        if (!showJapaneseSubtitle && showFurigana) {
            setShowFurigana(false);
        }
    }, [showJapaneseSubtitle, showFurigana]);

    useEffect(() => {
        setFuriganaByTime(new Map());
    }, [transcript]);

    useEffect(() => {
        if (!showFurigana || furiganaSegments.length === 0) return;
        if (furiganaByTime.size > 0) return;

        let isCancelled = false;

        const fetchFurigana = async () => {
            setIsFuriganaLoading(true);
            setFuriganaError("");
            try {
                const response = await fetch("/api/furigana", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ segments: furiganaSegments }),
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch furigana");
                }

                const data = await response.json();
                if (isCancelled) return;

                const map = new Map<number, FuriganaToken[]>();
                (data.segments || []).forEach(
                    (segment: { time: number; tokens: FuriganaToken[] }) => {
                        map.set(segment.time, segment.tokens || []);
                    }
                );
                setFuriganaByTime(map);
            } catch (error) {
                console.error("Furigana fetch error:", error);
                if (!isCancelled) {
                    setFuriganaError("후리가나 로딩에 실패했습니다.");
                }
            } finally {
                if (!isCancelled) {
                    setIsFuriganaLoading(false);
                }
            }
        };

        fetchFurigana();

        return () => {
            isCancelled = true;
        };
    }, [showFurigana, furiganaSegments, furiganaByTime.size]);

    const handleTranslationReady = useCallback(
        (data: any) => {
            setTranslationData(data);
            if (props.onTranslationReady) {
                props.onTranslationReady(data);
            }
        },
        [props.onTranslationReady]
    );

    const translationByTime = useMemo(() => {
        const map = new Map<number, string>();
        if (!translationData?.timelineTranslation) return map;
        translationData.timelineTranslation.forEach((item: any) => {
            const match = item.timestamp.match(
                /\[(?:(\d{1,2}):)?(\d{2}):(\d{2})\]/
            );
            if (!match) return;
            const hours = match[1] ? parseInt(match[1], 10) : 0;
            const minutes = parseInt(match[2], 10);
            const seconds = parseInt(match[3], 10);
            const timeInSeconds = hours * 3600 + minutes * 60 + seconds;
            map.set(timeInSeconds, item.koreanTranslation);
        });
        return map;
    }, [translationData]);

    if (activeTab === "analysis") {
        return (
            <div className="md:p-2 space-y-2 text-gray-700">
                {props.user && props.savedExpressions.length > 0 && (
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h2 className="text-xl font-bold mb-3 flex items-center text-green-600">
                            📌 내가 저장한 표현
                        </h2>
                        <SavedExpressions
                            expressions={props.savedExpressions}
                            onDelete={props.onDeleteExpression}
                        />
                    </div>
                )}

                {analysis.keywords?.length > 0 && (
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h2 className="text-xl font-bold mb-3 flex items-center text-purple-600">
                            🔑 핵심 단어
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {analysis.keywords.map((keyword: string) => (
                                <span
                                    key={keyword}
                                    className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full"
                                >
                                    {keyword}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {analysis.slang_expressions?.length > 0 && (
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <h2 className="text-xl font-bold mb-3 flex items-center text-blue-600">
                            🗣️ 실전 표현
                        </h2>
                        <div className="space-y-3">
                            {analysis.slang_expressions.map(
                                (
                                    exp: {
                                        expression: string;
                                        meaning: string;
                                    },
                                    index: number
                                ) => (
                                    <div
                                        key={index}
                                        className="bg-blue-50 p-4 rounded-lg flex items-center justify-between shadow-sm"
                                    >
                                        <div>
                                            <p className="font-semibold text-gray-800">
                                                {exp.expression}
                                            </p>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {exp.meaning}
                                            </p>
                                        </div>
                                        {/* <button
                                            onClick={async () => {
                                                if (!props.user) {
                                                    props.onShowAlert({
                                                        title: "로그인이 필요합니다",
                                                        subtitle:
                                                            "표현을 저장하려면 로그인해주세요.",
                                                        buttons: [
                                                            {
                                                                text: "로그인",
                                                                onClick: () => {
                                                                    window.location.href =
                                                                        "/login";
                                                                },
                                                                isPrimary: true,
                                                            },
                                                            {
                                                                text: "취소",
                                                                onClick:
                                                                    () => {},
                                                                isPrimary:
                                                                    false,
                                                            },
                                                        ],
                                                    });
                                                    return;
                                                }

                                                if (
                                                    props.savedExpressionsCount >=
                                                    props.maxSavedWords
                                                ) {
                                                    props.onShowAlert({
                                                        title: "저장 공간 부족",
                                                        subtitle: `표현은 최대 ${props.maxSavedWords}개까지 저장할 수 있습니다. 기존 표현을 삭제하거나, 등급 업그레이드를 고려해주세요.`,
                                                        buttons: [
                                                            {
                                                                text: "등급 업그레이드",
                                                                onClick: () => {
                                                                    window.location.href =
                                                                        "/plans";
                                                                },
                                                                isPrimary: true,
                                                            },
                                                            {
                                                                text: "나중에",
                                                                onClick:
                                                                    () => {},
                                                                isPrimary:
                                                                    false,
                                                            },
                                                        ],
                                                    });
                                                    return;
                                                }
                                                await props.onAddExpression({
                                                    expression: exp.expression,
                                                    meaning: exp.meaning,
                                                    videoId:
                                                        props.youtubeUrl.split(
                                                            "v="
                                                        )[1],
                                                    source: "analysis",
                                                    timestamp: new Date(),
                                                });
                                            }}
                                            className="ml-4 p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                                            title="이 표현 저장"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                strokeWidth="2"
                                                stroke="currentColor"
                                                className="w-5 h-5"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21.75a2.25 2.25 0 002.25-2.25V15M12 9.75l-3 3m0 0l-3-3m3 3V3m6 12.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0"
                                                />
                                            </svg>
                                        </button> */}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }
    if (activeTab === "subtitles") {
        return (
            <div className="md:p-2 space-y-4 text-gray-700">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h2 className="text-base font-semibold text-gray-700 mb-3">
                        자막 표시
                    </h2>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={showJapaneseSubtitle}
                                onChange={(e) =>
                                    setShowJapaneseSubtitle(e.target.checked)
                                }
                            />
                            일어
                        </label>
                        <label
                            className={`flex items-center gap-2 text-sm ${
                                isTranslationLoading
                                    ? "text-gray-400"
                                    : "text-gray-700"
                            }`}
                        >
                            <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={showKoreanSubtitle}
                                disabled={isTranslationLoading}
                                onChange={(e) =>
                                    setShowKoreanSubtitle(e.target.checked)
                                }
                            />
                            한국어
                            {isTranslationLoading && (
                                <span className="text-xs text-gray-400">
                                    (번역 중...)
                                </span>
                            )}
                        </label>
                        <label
                            className={`flex items-center gap-2 text-sm ${
                                showJapaneseSubtitle
                                    ? "text-gray-700"
                                    : "text-gray-400"
                            }`}
                        >
                            <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={showFurigana}
                                disabled={!showJapaneseSubtitle}
                                onChange={(e) =>
                                    setShowFurigana(e.target.checked)
                                }
                            />
                            후리가나
                            {showFurigana && isFuriganaLoading && (
                                <span className="text-xs text-gray-400">
                                    (준비 중...)
                                </span>
                            )}
                        </label>
                    </div>
                    {furiganaError && (
                        <p className="text-xs text-red-500 mt-2">
                            {furiganaError}
                        </p>
                    )}
                </div>

                {!showJapaneseSubtitle && !showKoreanSubtitle && (
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-sm text-gray-600">
                        표시할 자막을 선택해주세요.
                    </div>
                )}

                {showJapaneseSubtitle && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-600 px-2">
                            {showKoreanSubtitle
                                ? "자막 (일어 + 한국어)"
                                : "일어 자막"}
                        </h3>
                        <TranscriptViewer
                            parsedTranscript={parsedTranscript}
                            activeSegmentIndex={activeSegmentIndex}
                            onSeek={props.onSeek}
                            videoSummary={analysis.summary} // 추가: analysis.summary 전달
                            user={props.user} // 추가: user 전달
                            youtubeUrl={props.youtubeUrl} // 추가: youtubeUrl 전달
                            onSave={props.onAddExpression} // 추가: onAddExpression 전달
                            onLoopToggle={props.onLoopToggle}
                            isLooping={props.isLooping}
                            currentLoopStartTime={props.currentLoopStartTime}
                            currentLoopEndTime={props.currentLoopEndTime}
                            videoDuration={props.videoDuration}
                            onShowToast={props.onShowToast}
                            maxSavedWords={props.maxSavedWords} // 추가: maxSavedWords 전달
                            savedExpressionsCount={props.savedExpressionsCount} // 추가: savedExpressionsCount 전달
                            onShowAlert={props.onShowAlert} // 추가: onShowAlert 전달
                            savedExpressions={props.savedExpressions || []} // 추가: savedExpressions 전달 (방어 로직 포함)
                            secondaryTextByTime={
                                showKoreanSubtitle
                                    ? translationByTime
                                    : undefined
                            }
                            secondaryFallbackText={
                                showKoreanSubtitle && isTranslationLoading
                                    ? "번역 중..."
                                    : undefined
                            }
                            showFurigana={showFurigana}
                            furiganaByTime={furiganaByTime}
                        />
                    </div>
                )}

                {showKoreanSubtitle && !showJapaneseSubtitle && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-600 px-2">
                            한국어 자막
                        </h3>
                        <TranslationTab
                            transcript={transcript}
                            analysis={analysis}
                            videoId={props.videoId || ""}
                            onSeek={props.onSeek}
                            initialTranslationData={translationData}
                            currentTime={props.currentTime}
                            onTranslationReady={handleTranslationReady}
                            onLoadingChange={setIsTranslationLoading}
                        />
                    </div>
                )}

                {showKoreanSubtitle && showJapaneseSubtitle && (
                    <div className="hidden">
                        <TranslationTab
                            transcript={transcript}
                            analysis={analysis}
                            videoId={props.videoId || ""}
                            onSeek={props.onSeek}
                            initialTranslationData={translationData}
                            currentTime={props.currentTime}
                            onTranslationReady={handleTranslationReady}
                            onLoadingChange={setIsTranslationLoading}
                        />
                    </div>
                )}
            </div>
        );
    }
    if (activeTab === "questions") {
        return (
            <div className="md:p-2 space-y-4 text-gray-700">
                {isAnalysisLoading ? (
                    <AnalysisSkeleton />
                ) : (
                    analysis.main_questions?.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <h2 className="text-xl font-bold mb-3 flex items-center text-orange-600">
                                💬 AI와 대화해보기
                            </h2>
                            <p className="mb-4 text-sm text-gray-600">
                                아래 질문을 클릭하여 AI와 바로 대화를
                                시작하거나, 직접 질문할 수 있습니다.
                            </p>
                            <div className="space-y-3">
                                {analysis.main_questions.map(
                                    (question: string, index: number) => (
                                        <button
                                            key={index}
                                            onClick={() =>
                                                props.onStartConversation(
                                                    question
                                                )
                                            }
                                            disabled={
                                                props.isConversationPending
                                            }
                                            className="w-full text-left bg-orange-50 p-4 rounded-lg shadow-sm hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between" // flex 추가
                                        >
                                            <p className="font-semibold text-gray-800 flex-1">
                                                {question}
                                            </p>
                                            {/* 꺾쇠 아이콘 추가 */}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                strokeWidth="2.5"
                                                stroke="currentColor"
                                                className="w-5 h-5 text-gray-400"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                                                />
                                            </svg>
                                        </button>
                                    )
                                )}
                            </div>
                            <p className="mt-4 text-sm text-gray-500">
                                <span className="font-bold">팁:</span> 문장
                                전체를 말하는 대신, 핵심 키워드나 질문을
                                사용하여 간결하게 대화해 보세요!
                            </p>
                        </div>
                    )
                )}
            </div>
        );
    }

    return null;
};

export default AnalysisTabContent;
