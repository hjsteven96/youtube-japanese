"use client";

import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactPlayer from "react-player";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { getYoutubeVideoDetails } from "../../../lib/youtube";
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
import AnalysisTabs from "../../components/AnalysisTabs";
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

    const [analysisData, setAnalysisData] = useState<GeminiResponseData | null>(null);
    const [isTranscriptLoading, setIsTranscriptLoading] = useState(true);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);
    const [error, setError] = useState("");

    const [isRedirecting, setIsRedirecting] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertModalContent, setAlertModalContent] = useState({
        title: "",
        subtitle: "",
        buttons: [] as any[],
    });
    const playerRef = useRef<ReactPlayer>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [isConversationModeActive, setIsConversationModeActive] =
        useState(false);
    const [activeTab, setActiveTab] = useState<
        "analysis" | "transcript" | "questions"
    >("transcript");
    const [savedExpressions, setSavedExpressions] = useState<SavedExpression[]>(
        []
    );
    const [isLooping, setIsLooping] = useState(false);
    const [loopStartTime, setLoopStartTime] = useState<number | null>(null);
    const [loopEndTime, setLoopEndTime] = useState<number | null>(null);

    const plan = userProfile ? PLANS[userProfile.plan] : PLANS.free;

    const saveLearningHistory = useCallback(async (
        currentUser: User,
        data: GeminiResponseData,
        currentVideoId: string
    ) => {
        try {
            const historyDocRef = doc(db, `users/${currentUser.uid}/learningHistory`, currentVideoId);
            const youtubeUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
            const title = data.youtubeTitle || "제목 없음";
            const duration = data.duration || 0;
            const thumbnailUrl = data.thumbnailUrl || null;

            console.log("[SAVE_LEARNING_HISTORY] Saving learning history:", {
                videoId: currentVideoId,
                youtubeUrl,
                title,
                duration,
                thumbnailUrl,
                userUid: currentUser.uid,
            });

            await setDoc(historyDocRef, {
                youtubeUrl,
                title,
                duration,
                timestamp: serverTimestamp(),
                lastPlayedTime: 0,
                thumbnailUrl,
            }, { merge: true });
            console.log("[SAVE_LEARNING_HISTORY] Learning history saved successfully.");
        } catch (error) {
            console.error("[SAVE_LEARNING_HISTORY_ERROR] Failed to save learning history:", error);
        }
    }, []);

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
        onConversationStart: () => {
            if (!userProfile) return false;

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

    useEffect(() => {
        let isMounted = true;

        const fetchAnalysisData = async () => {
            if (initialAnalysisData) {
                if (isMounted) {
                    setAnalysisData(processTranscript(initialAnalysisData));
                    setIsTranscriptLoading(false);
                    setIsAnalysisLoading(false);
                    if (user) {
                        await saveLearningHistory(user, initialAnalysisData, videoId);
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
                        body: JSON.stringify({ youtubeUrl: `https://www.youtube.com/watch?v=${videoId}` }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(`Failed to generate transcript: ${errorData.error}`);
                    }

                    const data = await response.json();
                    const youtubeDetails = await getYoutubeVideoDetails(videoId);

                    const newAnalysisData: GeminiResponseData = {
                        transcript_text: data.transcript_text,
                        analysis: {
                            summary: "",
                            keywords: [],
                            slang_expressions: [],
                            main_questions: [],
                        },
                        youtubeTitle: youtubeDetails?.youtubeTitle || null,
                        youtubeDescription: youtubeDetails?.youtubeDescription || null,
                        thumbnailUrl: youtubeDetails?.thumbnailUrl || null,
                        duration: youtubeDetails?.duration || null,
                        channelName: youtubeDetails?.channelName || null,
                    };

                    if (isMounted) {
                        setAnalysisData(processTranscript(newAnalysisData));
                        setIsTranscriptLoading(false);
                        if (user) {
                            await saveLearningHistory(user, newAnalysisData, videoId);
                        }
                    }

                    const analysisRes = await fetch("/api/analyze-transcript", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ transcript_text: data.transcript_text }),
                    });

                    if (!analysisRes.ok) {
                        throw new Error("AI 내용 분석 중 오류가 발생했습니다.");
                    }

                    const { analysis } = await analysisRes.json();

                    console.log("[ANALYSIS_CLIENT_PAGE] Received analysis data:", analysis);
                    console.log("[ANALYSIS_CLIENT_PAGE] isAnalysisLoading before update:", isAnalysisLoading);

                    if (isMounted) {
                        setAnalysisData((currentData) => {
                            const finalData = { ...currentData!, analysis };
                            setDoc(doc(db, "videoAnalyses", videoId), {
                                ...finalData,
                                thumbnailUrl: newAnalysisData.thumbnailUrl || null,
                                duration: newAnalysisData.duration || null,
                                channelName: newAnalysisData.channelName || null,
                                timestamp: serverTimestamp(),
                            });
                            console.log("[ANALYSIS_CLIENT_PAGE] analysisData updated:", finalData);
                            return finalData;
                        });
                        setIsAnalysisLoading(false);
                        console.log("[ANALYSIS_CLIENT_PAGE] isAnalysisLoading after update:", false);
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
    }, [videoId, authInitialized, user, userProfile, initialAnalysisData, router, saveLearningHistory]);

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

    const handleShowAlert = (config: {
        title: string;
        subtitle: string;
        buttons: { text: string; onClick: () => void; isPrimary?: boolean }[];
    }) => {
        setAlertModalContent(config);
        setShowAlertModal(true);
    };

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

    return (
        <>
            <AnalysisHeader />
            <div className="min-h-screen flex flex-col items-center pt-16 py-4 bg-gradient-to-br from-blue-50 to-purple-50">
                {isLoading && <LoadingAnimation />}

                {error && !isLoading && (
                    <p className="text-red-500 text-lg mt-4 text-center p-4 bg-red-100 rounded-lg w-full max-w-6xl mx-auto px-4">
                        ⚠️ {error}
                    </p>
                )}

                {!isLoading && analysisData && (
                    <div className="w-full max-w-6xl bg-white p-3 md:p-6 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:space-x-8 mt-4 mx-auto">
                        <VideoPlayer
                            url={`https://www.youtube.com/watch?v=${videoId}`}
                            title={analysisData.youtubeTitle || "영상 제목"}
                            summary={analysisData.analysis.summary}
                            playerRef={playerRef}
                            isPlaying={isPlaying}
                            playbackRate={playbackRate}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onEnded={() => setIsPlaying(false)}
                            onProgress={(state) =>
                                setCurrentTime(state.playedSeconds)
                            }
                            isAnalysisLoading={isAnalysisLoading}
                        />
                        <AnalysisTabs
                            analysis={analysisData.analysis}
                            transcript={analysisData.transcript_text}
                            currentTime={currentTime}
                            onSeek={handleSeek}
                            onStartConversation={handleStartConversation}
                            isConversationPending={
                                isRecording || isPlayingAudio
                            }
                            user={user}
                            youtubeUrl={`https://www.youtube.com/watch?v=${videoId}`}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            savedExpressions={savedExpressions}
                            onDeleteExpression={handleDeleteExpression}
                            onAddExpression={handleAddExpression}
                            onLoopToggle={handleLoopToggle}
                            isLooping={isLooping}
                            currentLoopStartTime={loopStartTime}
                            currentLoopEndTime={loopEndTime}
                            videoDuration={analysisData.duration || null}
                            onShowToast={handleShowToast}
                            isAnalysisLoading={isAnalysisLoading}
                            userProfile={userProfile}
                            onShowAlert={handleShowAlert}
                        />
                    </div>
                )}

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
                    onClose={() => setShowToast(false)}
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
