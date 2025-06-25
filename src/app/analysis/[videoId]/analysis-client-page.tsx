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

    // [수정] State 초기화는 initialAnalysisData를 사용하되, 로딩 상태를 명확히 관리
    const [analysisData, setAnalysisData] = useState<GeminiResponseData | null>(
        null
    );
    const [isTranscriptLoading, setIsTranscriptLoading] = useState(true);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);
    const [error, setError] = useState("");

    // 나머지 state는 기존과 동일
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

    const canUseAIConversation = userProfile
        ? PLANS[userProfile.plan].aiConversation
        : false;

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
        onConversationStart: () => {
            if (!canUseAIConversation) {
                setToastMessage(
                    "AI 대화는 Plus 등급 이상부터 사용 가능합니다."
                );
                setShowToast(true);
                return;
            }
            setIsConversationModeActive(true);
        },
        setActiveTab: setActiveTab,
        videoId: videoId,
        user: user,
    });

    // [유지] 사용자 인증 상태 관리
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

    // [수정] 데이터 로딩 로직 전체 개편 (캐시 우선)
    useEffect(() => {
        let isMounted = true;

        const fetchAnalysisData = async () => {
            // 1순위: 서버에서 전달된 캐시 데이터(initialAnalysisData)가 있으면 사용
            if (initialAnalysisData) {
                if (isMounted) {
                    setAnalysisData(processTranscript(initialAnalysisData));
                    setIsTranscriptLoading(false);
                    setIsAnalysisLoading(false);
                }
                return;
            }

            // 필수 조건 (로그인 등) 확인
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
                // 2순위: 클라이언트에서 Firestore 캐시를 직접 확인
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
                    return; // 캐시 데이터 사용 후 함수 종료
                }

                // 3순위: 캐시가 없으면 새로운 분석 시작
                // 사용량 및 영상 길이 제한 확인
                const plan = PLANS[userProfile.plan];
                const today = new Date().toISOString().split("T")[0];
                if (
                    userProfile.usage.lastAnalysisDate === today &&
                    userProfile.usage.analysisCount >= plan.dailyAnalysisLimit
                ) {
                    throw new Error(
                        `오늘의 분석 횟수(${userProfile.usage.analysisCount}/${plan.dailyAnalysisLimit}회)를 모두 사용하셨습니다.`
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

                if (metaData.duration > plan.maxVideoDuration) {
                    throw new Error(
                        `${plan.name} 등급은 ${Math.floor(
                            plan.maxVideoDuration / 60
                        )}분 이하 영상만 분석 가능합니다.`
                    );
                }

                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, {
                    "usage.analysisCount": increment(1),
                    "usage.lastAnalysisDate": today,
                });

                // 1단계 API 호출: 자막 생성
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
                    setIsTranscriptLoading(false); // 자막 로딩 완료
                }

                // 2단계 API 호출: 자막 분석
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
                    // 최종 데이터 완성 및 캐시 저장
                    setAnalysisData((currentData) => {
                        const finalData = { ...currentData!, analysis };
                        setDoc(doc(db, "videoAnalyses", videoId), {
                            ...finalData,
                            timestamp: new Date().toISOString(),
                        });
                        // 로그 저장은 여기서도 가능
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
    }, [videoId, user, userProfile, authInitialized, router]);

    // 저장된 표현 불러오기 (변경 없음)
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

    // 구간 반복 로직 (변경 없음)
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

    // --- 핸들러 함수들 (기존과 거의 동일) ---
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

    // --- 렌더링 로직 ---
    const isLoading = isTranscriptLoading || !analysisData; // [수정] 전체 로딩 상태를 명확히 정의

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
                        setIsConversationModeActive(false);
                        handleStopConversation("modal_close");
                    }}
                    isRecording={isRecording}
                    isPlayingAudio={isPlayingAudio}
                    selectedQuestion={selectedQuestion}
                />

                <Toast
                    message={toastMessage}
                    isVisible={showToast}
                    onClose={() => setShowToast(false)}
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
