"use client";

import { useState, useRef, useEffect, Suspense } from "react";
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

    const [analysisData, setAnalysisData] = useState<GeminiResponseData | null>(
        null
    );
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
                    if (isMounted) {
                        setAnalysisData(
                            processTranscript(
                                docSnap.data() as GeminiResponseData
                            )
                        );
                    }
                    // ★ 수정: 로딩 상태를 여기서 false로 설정해야 캐시 데이터 사용 시에도 화면이 제대로 표시됨
                    setIsTranscriptLoading(false);
                    setIsAnalysisLoading(false);
                    return;
                }

                const currentPlan = PLANS[userProfile.plan];
                const today = new Date().toISOString().split("T")[0];
                if (
                    userProfile.usage.lastAnalysisDate === today &&
                    userProfile.usage.analysisCount >=
                        currentPlan.dailyAnalysisLimit
                ) {
                    throw new Error(
                        `오늘의 분석 횟수(${userProfile.usage.analysisCount}/${currentPlan.dailyAnalysisLimit}회)를 모두 사용하셨습니다.`
                    );
                }

                const metaRes = await fetch(
                    `/api/youtube-data?videoId=${videoId}`
                );
                if (!metaRes.ok)
                    throw new Error(
                        (await metaRes.json()).error || "영상 정보 로딩 실패"
                    );
                const metaData = await metaRes.json();

                if (metaData.duration > currentPlan.maxVideoDuration) {
                    throw new Error(
                        `${currentPlan.name} 등급은 ${Math.floor(
                            currentPlan.maxVideoDuration / 60
                        )}분 이하 영상만 분석 가능합니다.`
                    );
                }

                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, {
                    "usage.analysisCount": increment(1),
                    "usage.lastAnalysisDate": today,
                });
                // ★ 수정: 로컬 상태도 업데이트하여 즉시 반영
                setUserProfile((prev) =>
                    prev
                        ? {
                              ...prev,
                              usage: {
                                  ...prev.usage,
                                  analysisCount: prev.usage.analysisCount + 1,
                                  lastAnalysisDate: today,
                              },
                          }
                        : null
                );

                const transcriptRes = await fetch("/api/generate-transcript", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
                    }),
                });

                if (!transcriptRes.ok) {
                    await updateDoc(userDocRef, {
                        "usage.analysisCount": increment(-1),
                    });
                    // ★ 수정: 로컬 상태도 롤백
                    setUserProfile((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  usage: {
                                      ...prev.usage,
                                      analysisCount:
                                          prev.usage.analysisCount - 1,
                                  },
                              }
                            : null
                    );
                    throw new Error(
                        (await transcriptRes.json()).error ||
                            "자막 생성에 실패했습니다."
                    );
                }

                const { transcript_text } = await transcriptRes.json();

                if (isMounted) {
                    setAnalysisData({
                        transcript_text,
                        analysis: {
                            summary: "AI가 영상 내용을 분석하고 있어요...",
                            keywords: [],
                            slang_expressions: [],
                            main_questions: [],
                        },
                        ...metaData,
                    });
                    setIsTranscriptLoading(false);
                }

                const analysisRes = await fetch("/api/analyze-transcript", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ transcript_text }),
                });

                if (!analysisRes.ok) {
                    throw new Error("AI 내용 분석 중 오류가 발생했습니다.");
                }

                const { analysis } = await analysisRes.json();

                if (isMounted) {
                    setAnalysisData((currentData) => {
                        const finalData = { ...currentData!, analysis };
                        setDoc(doc(db, "videoAnalyses", videoId), {
                            ...finalData,
                            thumbnailUrl: metaData.thumbnailUrl || null,
                            duration: metaData.duration || null,
                            channelName: metaData.channelName || null,
                            timestamp: new Date().toISOString(),
                        });
                        return finalData;
                    });
                }
            } catch (err: any) {
                if (isMounted)
                    setError(err.message || "알 수 없는 오류가 발생했습니다.");
            } finally {
                if (isMounted) {
                    setIsTranscriptLoading(false);
                    setIsAnalysisLoading(false);
                }
            }
        };

        fetchAnalysisData();

        return () => {
            isMounted = false;
        };
    }, [
        videoId,
        user,
        userProfile,
        authInitialized,
        router,
        initialAnalysisData,
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

    const isLoading = isTranscriptLoading || !analysisData;

    // [추가] Alert 모달 표시 함수
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
