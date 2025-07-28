"use client";

import { useState, useRef, useEffect, Suspense, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactPlayer from "react-player";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import AnalysisHeader from "../../components/AnalysisHeader";
import {
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    deleteDoc,
    orderBy,
    updateDoc,
    increment,
    serverTimestamp,
} from "firebase/firestore";

import LoadingAnimation from "../../components/LoadingAnimation";
import ConversationModal from "../../components/ConversationModal";
import VideoPlayer from "../../components/VideoPlayer";
import VideoInfo from "../../components/VideoInfo";
import AnalysisTabBar from "../../components/AnalysisTabBar";
import AnalysisTabContent from "../../components/AnalysisTabContent";
import { useGeminiLiveConversation } from "../../../lib/useGeminiLiveConversation";
import { SavedExpression } from "../../components/SavedExpressions";
import Toast from "../../components/Toast";
import Alert from "../../components/Alert";

import { createUserProfile } from "../../../lib/user";
import { PLANS, UserProfile } from "../../../lib/plans";

import useIsMobile from "../../../lib/useIsMobile";
import FloatingPlayerControls from "../../components/FloatingPlayerControls";

export interface GeminiResponseData {
    analysis: {
        summary: string;
        keywords: string[];
        slang_expressions: { expression: string; meaning: string }[];
        main_questions: string[];
    };
    transcript_text: string;
    youtubeTitle?: string | null;
    youtubeDescription?: string | null;
    thumbnailUrl?: string | null;
    duration?: number | null;
    channelName?: string | null;
    koreanTranslation?: any;
}

interface AnalysisPageComponentProps {
    initialAnalysisData: GeminiResponseData | null;
}

const processTranscript = (data: GeminiResponseData): GeminiResponseData => {
    if (data.transcript_text && typeof data.transcript_text === "string") {
        data.transcript_text = data.transcript_text.replace(/\\n/g, "\n");
    }
    return data;
};

function AnalysisPageComponent({
    initialAnalysisData,
}: AnalysisPageComponentProps) {
    const params = useParams();
    const router = useRouter();
    const videoId = params.videoId as string;
    const isMobile = useIsMobile();
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authInitialized, setAuthInitialized] = useState(false);
    const [remainingTime, setRemainingTime] = useState<number | null>(null);
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showKoreanSubtitle, setShowKoreanSubtitle] = useState(false);

    const [analysisData, setAnalysisData] = useState<GeminiResponseData | null>(
        null
    );
    const [isTranscriptLoading, setIsTranscriptLoading] = useState(true);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);
    const [error, setError] = useState("");

    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertModalContent, setAlertModalContent] = useState({
        title: "",
        subtitle: "",
        buttons: [] as any[],
    });

    const handleShowAlert = (config: {
        title: string;
        subtitle: string;
        buttons: { text: string; onClick: () => void; isPrimary?: boolean }[];
    }) => {
        setAlertModalContent(config);
        setShowAlertModal(true);
    };

    const [isRedirecting, setIsRedirecting] = useState(false);
    const playerRef = useRef<ReactPlayer>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [isConversationModeActive, setIsConversationModeActive] =
        useState(false);
    const [activeTab, setActiveTab] = useState<
        "analysis" | "transcript" | "questions" | "translation"
    >("transcript");
    const [savedExpressions, setSavedExpressions] = useState<SavedExpression[]>(
        []
    );
    const [isLooping, setIsLooping] = useState(false);
    const [loopStartTime, setLoopStartTime] = useState<number | null>(null);
    const [loopEndTime, setLoopEndTime] = useState<number | null>(null);

    const plan = userProfile ? PLANS[userProfile.plan] : PLANS.free;

    const handleCloseToast = useCallback(() => {
        setShowToast(false);
    }, []);

    const saveLearningHistory = useCallback(
        async (
            currentUser: User,
            data: GeminiResponseData,
            currentVideoId: string
        ) => {
            try {
                const historyDocRef = doc(
                    db,
                    `users/${currentUser.uid}/learningHistory`,
                    currentVideoId
                );
                const youtubeUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
                const title = data.youtubeTitle || "제목 없음";
                const duration = data.duration || 0;
                const thumbnailUrl = data.thumbnailUrl || null;

                await setDoc(
                    historyDocRef,
                    {
                        youtubeUrl,
                        title,
                        duration,
                        timestamp: serverTimestamp(),
                        lastPlayedTime: 0,
                        thumbnailUrl,
                    },
                    { merge: true }
                );
            } catch (error) {
                console.error(
                    "[SAVE_LEARNING_HISTORY_ERROR] Failed to save learning history:",
                    error
                );
            }
        },
        []
    );

    const {
        isRecording,
        isPlayingAudio,
        selectedQuestion,
        handleStartConversation,
        handleStopConversation,
    } = useGeminiLiveConversation({
        transcript: analysisData?.transcript_text || "",
        geminiAnalysis: analysisData?.analysis ?? null,
        setError,
        setActiveTab: setActiveTab,
        videoId: videoId,
        user: user,
        sessionTimeLimit: plan.sessionTimeLimit, // ★ 수정: 분을 초로 변환
        onShowAlert: handleShowAlert,
        onConversationStart: () => {
            if (!userProfile) {
                handleShowAlert({
                    title: "로그인이 필요합니다",
                    subtitle: "AI 대화 기능을 사용하려면 먼저 로그인해주세요.",
                    buttons: [
                        {
                            text: "로그인",
                            onClick: () => {
                                router.push("/login");
                            },
                            isPrimary: true,
                        },
                        {
                            text: "취소",
                            onClick: () => {},
                            isPrimary: false,
                        },
                    ],
                });
                return false;
            }

            const monthlyLimit = plan.monthlyTimeLimit; // ★ 수정: 분을 초로 변환
            const monthlyUsed = userProfile.usage.monthlyConversationUsed || 0;

            if (monthlyUsed >= monthlyLimit) {
                setToastMessage("이번 달 AI 대화 시간을 모두 사용했어요.");
                setShowToast(true);
                return false;
            }

            if (!plan.aiConversation) {
                setToastMessage(
                    "AI 대화는 Plus 등급 이상부터 사용 가능합니다."
                );
                setShowToast(true);
                return false;
            }

            setIsConversationModeActive(true);
            const sessionLimitInSeconds = plan.sessionTimeLimit; // ★ 수정: 분을 초로 변환
            setRemainingTime(sessionLimitInSeconds);

            countdownTimerRef.current = setInterval(() => {
                setRemainingTime((prev) =>
                    prev !== null && prev > 0 ? prev - 1 : 0
                );
            }, 1000);

            return true;
        },
        onConversationEnd: async (durationInSeconds) => {
            setIsConversationModeActive(false);

            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
            }
            setRemainingTime(null);

            if (user && durationInSeconds > 0) {
                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, {
                    "usage.monthlyConversationUsed":
                        increment(durationInSeconds),
                });

                setUserProfile((prev) =>
                    prev
                        ? {
                              ...prev,
                              usage: {
                                  ...prev.usage,
                                  monthlyConversationUsed:
                                      (prev.usage.monthlyConversationUsed ||
                                          0) + durationInSeconds,
                              },
                          }
                        : null
                );

                const sessionLimitInSeconds = plan.sessionTimeLimit; // ★ 수정: 분을 초로 변환
                if (durationInSeconds >= sessionLimitInSeconds - 1) {
                    setToastMessage("대화 시간이 종료되었습니다.");
                    setShowToast(true);
                }
            }
        },
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const profile = await createUserProfile(currentUser);
                setUserProfile(profile);
            } else {
                setUserProfile(null);
            }
            setAuthInitialized(true);
        });
        return () => unsubscribe();
    }, []);

    // 전체화면 상태 감지
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const fetchAnalysisData = async () => {
            if (initialAnalysisData) {
                if (isMounted) {
                    setAnalysisData(processTranscript(initialAnalysisData));
                    setIsTranscriptLoading(false);
                    setIsAnalysisLoading(false);
                    if (user) {
                        await saveLearningHistory(
                            user,
                            initialAnalysisData,
                            videoId
                        );
                    }
                }
                return;
            }

            if (!videoId || !authInitialized) return;
            if (!user || !userProfile) {
                if (authInitialized) {
                    setIsRedirecting(true);
                    setToastMessage("이 영상은 로그인 후 분석할 수 있습니다.");
                    setShowToast(true);
                    router.push("/");
                }
                return;
            }

            setIsTranscriptLoading(true);
            setIsAnalysisLoading(true);
            setError("");

            try {
                const docRef = doc(db, "videoAnalyses", videoId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const cachedData = docSnap.data() as GeminiResponseData;
                    if (isMounted) {
                        setAnalysisData(processTranscript(cachedData));
                    }
                    setIsTranscriptLoading(false);
                    setIsAnalysisLoading(false);
                    if (user) {
                        await saveLearningHistory(user, cachedData, videoId);
                    }
                } else {
                    const response = await fetch("/api/generate-transcript", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(
                            `Failed to generate transcript: ${errorData.error}`
                        );
                    }

                    const data = await response.json();
                    const youtubeDetailsRes = await fetch(
                        `/api/youtube-data?videoId=${videoId}`
                    );
                    if (!youtubeDetailsRes.ok) {
                        const errorData = await youtubeDetailsRes.json();
                        throw new Error(
                            `Failed to fetch YouTube details: ${
                                errorData.error || youtubeDetailsRes.statusText
                            }`
                        );
                    }
                    const youtubeDetails = await youtubeDetailsRes.json(); // YouTube 상세 정보

                    const newAnalysisData: GeminiResponseData = {
                        transcript_text: data.transcript_text,
                        analysis: {
                            summary: "",
                            keywords: [],
                            slang_expressions: [],
                            main_questions: [],
                        },
                        youtubeTitle: youtubeDetails?.youtubeTitle || null,
                        youtubeDescription:
                            youtubeDetails?.youtubeDescription || null,
                        thumbnailUrl: youtubeDetails?.thumbnailUrl || null,
                        duration: youtubeDetails?.duration || null,
                        channelName: youtubeDetails?.channelName || null,
                    };

                    if (isMounted) {
                        setAnalysisData(processTranscript(newAnalysisData));
                        setIsTranscriptLoading(false);
                        if (user) {
                            await saveLearningHistory(
                                user,
                                newAnalysisData,
                                videoId
                            );
                        }
                    }

                    const analysisRes = await fetch("/api/analyze-transcript", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            transcript_text: data.transcript_text,
                        }),
                    });

                    if (!analysisRes.ok) {
                        throw new Error("AI 내용 분석 중 오류가 발생했습니다.");
                    }

                    const { analysis } = await analysisRes.json();

                    console.log(
                        "[ANALYSIS_CLIENT_PAGE] Received analysis data:",
                        analysis
                    );
                    console.log(
                        "[ANALYSIS_CLIENT_PAGE] isAnalysisLoading before update:",
                        isAnalysisLoading
                    );

                    if (isMounted) {
                        setAnalysisData((currentData) => {
                            const finalData = { ...currentData!, analysis };
                            setDoc(doc(db, "videoAnalyses", videoId), {
                                ...finalData,
                                thumbnailUrl:
                                    newAnalysisData.thumbnailUrl || null,
                                duration: newAnalysisData.duration || null,
                                channelName:
                                    newAnalysisData.channelName || null,
                                timestamp: serverTimestamp(),
                            });
                            console.log(
                                "[ANALYSIS_CLIENT_PAGE] analysisData updated:",
                                finalData
                            );
                            return finalData;
                        });
                        setIsAnalysisLoading(false);
                        console.log(
                            "[ANALYSIS_CLIENT_PAGE] isAnalysisLoading after update:",
                            false
                        );
                    }
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error("Error in fetchAnalysisData:", err);
                    setError(err.message || "Failed to load analysis.");
                    setIsTranscriptLoading(false);
                    setIsAnalysisLoading(false);
                }
            } finally {
                if (isMounted) {
                    if (isAnalysisLoading) {
                        setIsAnalysisLoading(false);
                    }
                }
            }
        };

        if (authInitialized) {
            fetchAnalysisData();
        }

        return () => {
            isMounted = false;
        };
    }, [
        videoId,
        authInitialized,
        user,
        userProfile,
        initialAnalysisData,
        router,
        saveLearningHistory,
    ]);

    useEffect(() => {
        if (!user || !videoId || !analysisData) {
            setSavedExpressions([]);
            return;
        }
        const fetchSavedExpressions = async () => {
            const q = query(
                collection(db, `users/${user.uid}/savedInterpretations`),
                where("videoId", "==", videoId),
                orderBy("timestamp", "desc")
            );
            const querySnapshot = await getDocs(q);
            const expressions = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as SavedExpression[];
            setSavedExpressions(expressions);
        };
        fetchSavedExpressions();
    }, [user, videoId, analysisData]);

    useEffect(() => {
        if (
            isLooping &&
            loopStartTime !== null &&
            loopEndTime !== null &&
            loopStartTime < loopEndTime
        ) {
            if (currentTime >= loopEndTime || currentTime < loopStartTime) {
                playerRef.current?.seekTo(loopStartTime, "seconds");
            }
        }
    }, [currentTime, isLooping, loopStartTime, loopEndTime]);

    useEffect(() => {
        return () => {
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
            }
        };
    }, []);

    const handleAddExpression = async (
        newExpressionData: Omit<SavedExpression, "id">
    ) => {
        if (!user) {
            setToastMessage("표현을 저장하려면 로그인이 필요합니다.");
            setShowToast(true);
            return;
        }
        try {
            const docRef = await addDoc(
                collection(db, `users/${user.uid}/savedInterpretations`),
                newExpressionData
            );
            setSavedExpressions((prev) => [
                { id: docRef.id, ...newExpressionData },
                ...prev,
            ]);
            setToastMessage("표현을 저장했어요!");
            setShowToast(true);
        } catch (error) {
            console.error("표현 저장 중 오류:", error);
            setToastMessage("표현 저장에 실패했습니다.");
            setShowToast(true);
        }
    };

    const handleDeleteExpression = async (expressionId: string) => {
        if (!user) return;

        setAlertModalContent({
            title: "표현 삭제 확인",
            subtitle: "이 표현을 정말로 삭제하시겠습니까?",
            buttons: [
                {
                    text: "취소",
                    onClick: () => setShowAlertModal(false),
                    isPrimary: false,
                },
                {
                    text: "삭제",
                    onClick: async () => {
                        setShowAlertModal(false);
                        try {
                            const docRef = doc(
                                db,
                                `users/${user.uid}/savedInterpretations`,
                                expressionId
                            );
                            await deleteDoc(docRef);
                            setSavedExpressions((prev) =>
                                prev.filter((exp) => exp.id !== expressionId)
                            );
                            handleShowToast("표현이 삭제되었습니다");
                        } catch (error) {
                            console.error("표현 삭제 중 오류:", error);
                            handleShowToast("삭제에 실패했습니다.");
                        }
                    },
                    isPrimary: true,
                },
            ],
        });
        setShowAlertModal(true);
    };

    const handleSeek = (seconds: number) => {
        playerRef.current?.seekTo(seconds, "seconds");
        setIsPlaying(true);
    };

    const handleLoopToggle = (startTime: number, endTime: number) => {
        if (isLooping && loopStartTime === startTime) {
            setIsLooping(false);
            setLoopStartTime(null);
            setLoopEndTime(null);
            playerRef.current?.seekTo(endTime, "seconds");
        } else {
            setIsLooping(true);
            setLoopStartTime(startTime);
            setLoopEndTime(endTime);
            playerRef.current?.seekTo(startTime, "seconds");
            setIsPlaying(true);
        }
    };

    const handleShowToast = (message: string) => {
        setToastMessage(message);
        setShowToast(true);
    };

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    const handlePlaybackRateChange = (rate: number) => {
        setPlaybackRate(rate);
    };

    const isLoading = isTranscriptLoading;

    // [추가] maxSavedWords, savedExpressionsCount 계산 로직
    const maxSavedWords = userProfile
        ? PLANS[userProfile.plan].maxSavedWords
        : PLANS.free.maxSavedWords;
    const savedExpressionsCount = savedExpressions.length;

    // 자막 파싱 및 현재 활성 세그먼트 찾기 (일반 모드용)
    const { parsedTranscript, activeSegmentIndex, currentSubtitle } = useMemo(() => {
        if (!analysisData?.transcript_text) {
            return { parsedTranscript: [], activeSegmentIndex: -1, currentSubtitle: "" };
        }

        const safeTranscript = String(analysisData.transcript_text || "");
        const parsed = [];
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
        
        // 현재 시간에 해당하는 활성 세그먼트 찾기
        const activeIndex = parsed.findIndex((segment, index) => {
            const nextSegment = parsed[index + 1];
            return (
                currentTime >= segment.time &&
                (!nextSegment || currentTime < nextSegment.time)
            );
        });

        const currentSubtitle = activeIndex >= 0 ? parsed[activeIndex].text : "";

        return { parsedTranscript: parsed, activeSegmentIndex: activeIndex, currentSubtitle };
    }, [analysisData?.transcript_text, currentTime]);

    // 전체화면 모드용 자막 (2개 세그먼트 합쳐서 표시, 2개 구간마다 변경)
    const fullscreenSubtitle = useMemo(() => {
        if (!isFullscreen || !analysisData?.transcript_text) {
            return "";
        }

        const safeTranscript = String(analysisData.transcript_text || "");
        const parsed = [];
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

        // 현재 시간에 해당하는 활성 세그먼트 찾기
        const activeIndex = parsed.findIndex((segment, index) => {
            const nextSegment = parsed[index + 1];
            return (
                currentTime >= segment.time &&
                (!nextSegment || currentTime < nextSegment.time)
            );
        });

        if (activeIndex >= 0) {
            // 짝수 인덱스(0, 2, 4...)에서 시작하는 2개 세그먼트 그룹 만들기
            const groupStartIndex = Math.floor(activeIndex / 2) * 2;
            const firstSegment = parsed[groupStartIndex];
            const secondSegment = parsed[groupStartIndex + 1];
            
            if (firstSegment && secondSegment) {
                return `${firstSegment.text} ${secondSegment.text}`;
            } else if (firstSegment) {
                return firstSegment.text;
            }
        }

        return "";
    }, [isFullscreen, analysisData?.transcript_text, currentTime]);

    // 전체화면 모드용 한국어 자막 (2개 세그먼트 합쳐서 표시)
    const fullscreenKoreanSubtitle = useMemo(() => {
        if (!isFullscreen || !showKoreanSubtitle || !analysisData?.koreanTranslation?.timelineTranslation) {
            return "";
        }

        const timelineTranslation = analysisData.koreanTranslation.timelineTranslation;
        
        // 현재 시간에 해당하는 활성 세그먼트 찾기
        const activeIndex = timelineTranslation.findIndex((item: any, index: number) => {
            const currentTimestamp = item.timestamp;
            const nextItem = timelineTranslation[index + 1];
            
            // 타임스탬프를 초로 변환
            const regex = /\[(?:(\d{1,2}):)?(\d{2}):(\d{2})\]/;
            const match = currentTimestamp.match(regex);
            if (!match) return false;
            
            const hours = match[1] ? parseInt(match[1], 10) : 0;
            const minutes = parseInt(match[2], 10);
            const seconds = parseInt(match[3], 10);
            const timeInSeconds = hours * 3600 + minutes * 60 + seconds;
            
            let nextTimeInSeconds = Infinity;
            if (nextItem) {
                const nextMatch = nextItem.timestamp.match(regex);
                if (nextMatch) {
                    const nextHours = nextMatch[1] ? parseInt(nextMatch[1], 10) : 0;
                    const nextMinutes = parseInt(nextMatch[2], 10);
                    const nextSeconds = parseInt(nextMatch[3], 10);
                    nextTimeInSeconds = nextHours * 3600 + nextMinutes * 60 + nextSeconds;
                }
            }
            
            return currentTime >= timeInSeconds && currentTime < nextTimeInSeconds;
        });

        if (activeIndex >= 0) {
            // 짝수 인덱스에서 시작하는 2개 세그먼트 그룹 만들기
            const groupStartIndex = Math.floor(activeIndex / 2) * 2;
            const firstSegment = timelineTranslation[groupStartIndex];
            const secondSegment = timelineTranslation[groupStartIndex + 1];
            
            if (firstSegment && secondSegment) {
                return `${firstSegment.koreanTranslation} ${secondSegment.koreanTranslation}`;
            } else if (firstSegment) {
                return firstSegment.koreanTranslation;
            }
        }

        return "";
    }, [isFullscreen, showKoreanSubtitle, analysisData?.koreanTranslation, currentTime]);

    if (isRedirecting) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <LoadingAnimation />
                <p className="text-gray-600 text-center mt-4">
                    메인 페이지로 이동 중...
                </p>
            </div>
        );
    }

    if (isLoading) {
        return <LoadingAnimation />;
    }

    // data가 없을 때 에러 표시
    if (error && !analysisData) {
        return (
            <p className="text-red-500 text-lg mt-4 text-center p-4 bg-red-100 rounded-lg w-full max-w-6xl mx-auto px-4">
                ⚠️ {error}
            </p>
        );
    }

    // 전체화면 모드일 때 플레이어와 컨트롤러만 표시
    if (isFullscreen && analysisData) {
        return (
            <div className="bg-black min-h-screen flex flex-col relative">
                {/* 비디오 플레이어 영역 - 화면 중앙에 */}
                <div className="flex-1 flex items-center justify-center">
                    <VideoPlayer
                        url={`https://www.youtube.com/watch?v=${videoId}`}
                        playerRef={playerRef}
                        isPlaying={isPlaying}
                        playbackRate={playbackRate}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        onProgress={(state) =>
                            setCurrentTime(state.playedSeconds)
                        }
                        isMobile={isMobile}
                    />
                </div>
                
                {/* 자막 표시 영역 - 배경 없음 */}
                {fullscreenSubtitle && (
                    <div className={`absolute left-0 right-0 flex justify-center px-4 z-40 ${
                        isMobile ? 'bottom-32' : 'bottom-24'
                    }`}>
                        <div className="max-w-4xl text-center">
                            <p className={`leading-relaxed break-words font-medium text-white ${
                                isMobile ? 'text-base' : 'text-xl'
                            }`} style={{
                                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                                lineHeight: '1.4'
                            }}>
                                {fullscreenSubtitle}
                            </p>
                        </div>
                    </div>
                )}
                
                {/* 전체화면에서도 모바일 컨트롤러 표시 */}
                {isMobile && (
                    <FloatingPlayerControls
                        playerRef={playerRef}
                        isPlaying={isPlaying}
                        onPlayPause={handlePlayPause}
                        currentTime={currentTime}
                        playbackRate={playbackRate}
                        onPlaybackRateChange={handlePlaybackRateChange}
                    />
                )}
            </div>
        );
    }

    // 메인 렌더링 로직
    return (
        <>
            <AnalysisHeader />
            <div className="bg-gradient-to-br from-blue-50 to-purple-50">
                {" "}
                {/* 수정: min-h-screen 제거 */}
                {analysisData && (
                    <div className="w-full max-w-6xl mx-auto">
                        {/* PC Layout */}
                        <div className="hidden lg:flex lg:flex-row lg:space-x-8 p-6 bg-white rounded-2xl shadow-xl pt-20 h-[calc(100vh-80px)] overflow-hidden">
                            {" "}
                            {/* 수정: mt-4 제거, pt-20 추가 */}
                            {/* Left Column - Make it sticky and scrollable if content overflows */}
                            <div className="lg:w-1/2 sticky top-0 max-h-full overflow-y-auto">
                                {" "}
                                {/* Adjusted top for header (64px) + mt-4 (16px) = 80px */}
                                {!isMobile && (
                                    <VideoPlayer
                                        url={`https://www.youtube.com/watch?v=${videoId}`}
                                        playerRef={playerRef}
                                        isPlaying={isPlaying}
                                        playbackRate={playbackRate}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onEnded={() => setIsPlaying(false)}
                                        onProgress={(state) =>
                                            setCurrentTime(state.playedSeconds)
                                        }
                                        isMobile={isMobile} // 추가
                                    />
                                )}
                                <VideoInfo
                                    title={analysisData.youtubeTitle ?? null} // || 대신 ?? 사용
                                    summary={analysisData.analysis.summary}
                                    isAnalysisLoading={isAnalysisLoading}
                                />
                            </div>
                            {/* Right Column - Make it sticky and its content already scrolls via AnalysisTabs */}
                            <div className="w-full lg:w-1/2 sticky top-20 max-h-[calc(100vh-80px)] overflow-y-auto">
                                {" "}
                                {/* Adjusted top for header (64px) + mt-4 (16px) = 80px */}
                                <AnalysisTabBar
                                    activeTab={activeTab}
                                    setActiveTab={setActiveTab}
                                    className="sticky top-0 z-10 bg-white" /* 추가: PC 탭바 상단 고정 */
                                />
                                <div className="flex-1 overflow-y-auto rounded-b-2xl hide-scrollbar p-3">
                                    <AnalysisTabContent
                                        activeTab={activeTab}
                                        analysis={analysisData.analysis}
                                        transcript={
                                            analysisData.transcript_text
                                        }
                                        currentTime={currentTime}
                                        onSeek={handleSeek}
                                        onStartConversation={
                                            handleStartConversation
                                        }
                                        isConversationPending={
                                            isRecording || isPlayingAudio
                                        }
                                        user={user}
                                        youtubeUrl={`https://www.youtube.com/watch?v=${videoId}`}
                                        savedExpressions={savedExpressions}
                                        onDeleteExpression={
                                            handleDeleteExpression
                                        }
                                        onAddExpression={handleAddExpression}
                                        onLoopToggle={handleLoopToggle}
                                        isLooping={isLooping}
                                        currentLoopStartTime={loopStartTime}
                                        currentLoopEndTime={loopEndTime}
                                        videoDuration={
                                            analysisData.duration || null
                                        }
                                        onShowToast={handleShowToast}
                                        isAnalysisLoading={isAnalysisLoading}
                                        userProfile={userProfile}
                                        onShowAlert={handleShowAlert}
                                        maxSavedWords={maxSavedWords}
                                        savedExpressionsCount={
                                            savedExpressionsCount
                                        }
                                        videoId={videoId}
                                        initialTranslationData={analysisData?.koreanTranslation}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Mobile Layout */}
                        <div className="lg:hidden flex flex-col">
                            {/* 1. 상단 고정 영역 */}
                            <div className="sticky top-0 bg-white z-20">
                                <div className="">
                                    {" "}
                                    {/* 수정: p-3 클래스 제거 */}
                                    {isMobile && (
                                        <VideoPlayer
                                            url={`https://www.youtube.com/watch?v=${videoId}`}
                                            playerRef={playerRef}
                                            isPlaying={isPlaying}
                                            playbackRate={playbackRate}
                                            onPlay={() => setIsPlaying(true)}
                                            onPause={() => setIsPlaying(false)}
                                            onEnded={() => setIsPlaying(false)}
                                            onProgress={(state) =>
                                                setCurrentTime(
                                                    state.playedSeconds
                                                )
                                            }
                                            isMobile={isMobile} // 추가
                                        />
                                    )}
                                </div>
                                <AnalysisTabBar
                                    activeTab={activeTab}
                                    setActiveTab={setActiveTab}
                                />
                            </div>

                            {/* 2. 스크롤 영역 */}
                            <div className="p-3 bg-white pb-24">
                                {" "}
                                {/* 수정: 하단 플로팅 컨트롤러 높이만큼 패딩 추가 */}
                                <VideoInfo
                                    title={analysisData.youtubeTitle ?? null} // || 대신 ?? 사용
                                    summary={analysisData.analysis.summary}
                                    isAnalysisLoading={isAnalysisLoading}
                                />
                                <div className="mt-4">
                                    <AnalysisTabContent
                                        activeTab={activeTab}
                                        analysis={analysisData.analysis}
                                        transcript={
                                            analysisData.transcript_text
                                        }
                                        currentTime={currentTime}
                                        onSeek={handleSeek}
                                        onStartConversation={
                                            handleStartConversation
                                        }
                                        isConversationPending={
                                            isRecording || isPlayingAudio
                                        }
                                        user={user}
                                        youtubeUrl={`https://www.youtube.com/watch?v=${videoId}`}
                                        savedExpressions={savedExpressions}
                                        onDeleteExpression={
                                            handleDeleteExpression
                                        }
                                        onAddExpression={handleAddExpression}
                                        onLoopToggle={handleLoopToggle}
                                        isLooping={isLooping}
                                        currentLoopStartTime={loopStartTime}
                                        currentLoopEndTime={loopEndTime}
                                        videoDuration={
                                            analysisData.duration || null
                                        }
                                        onShowToast={handleShowToast}
                                        isAnalysisLoading={isAnalysisLoading}
                                        userProfile={userProfile}
                                        onShowAlert={handleShowAlert}
                                        maxSavedWords={maxSavedWords}
                                        savedExpressionsCount={
                                            savedExpressionsCount
                                        }
                                        videoId={videoId}
                                        initialTranslationData={analysisData?.koreanTranslation}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* 나머지 모달, 토스트 등 */}
                {!isLoading && analysisData && isMobile && (
                    <FloatingPlayerControls
                        playerRef={playerRef}
                        isPlaying={isPlaying}
                        onPlayPause={handlePlayPause}
                        currentTime={currentTime}
                        playbackRate={playbackRate}
                        onPlaybackRateChange={handlePlaybackRateChange}
                    />
                )}
                <ConversationModal
                    isOpen={isConversationModeActive}
                    onClose={() => {
                        handleStopConversation("modal_close");
                    }}
                    isRecording={isRecording}
                    isPlayingAudio={isPlayingAudio}
                    selectedQuestion={selectedQuestion}
                    remainingTime={remainingTime}
                />
                <Toast
                    message={toastMessage}
                    isVisible={showToast}
                    onClose={handleCloseToast}
                    duration={3000}
                />
                {showAlertModal && (
                    <Alert
                        title={alertModalContent.title}
                        subtitle={alertModalContent.subtitle}
                        buttons={alertModalContent.buttons}
                        onClose={() => setShowAlertModal(false)}
                    />
                )}
            </div>
        </>
    );
}

export default function AnalysisPageWrapper({
    initialAnalysisData,
}: AnalysisPageComponentProps) {
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <AnalysisPageComponent initialAnalysisData={initialAnalysisData} />
        </Suspense>
    );
}
