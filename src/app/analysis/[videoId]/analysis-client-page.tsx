"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactPlayer from "react-player";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
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
    updateDoc, // [추가] Firestore 문서 업데이트를 위해 추가
    increment, // [추가] 원자적 카운트 증가를 위해 추가
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

// --- 타입 정의 (변경 없음) ---
interface GeminiResponseData {
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

const processTranscript = (data: GeminiResponseData): GeminiResponseData => {
    if (data.transcript_text && typeof data.transcript_text === "string") {
        data.transcript_text = data.transcript_text.replace(/\\n/g, "\n");
    }
    return data;
};

function AnalysisPageComponent() {
    const params = useParams();
    const router = useRouter();
    const videoId = params.videoId as string;

    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authInitialized, setAuthInitialized] = useState(false);
    const [analysisData, setAnalysisData] = useState<GeminiResponseData | null>(
        null
    );
    const [videoTitle, setVideoTitle] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertModalContent, setAlertModalContent] = useState({
        title: "",
        subtitle: "",
        buttons: [] as {
            text: string;
            onClick: () => void;
            isPrimary?: boolean;
        }[],
    });

    const playerRef = useRef<ReactPlayer>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
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

    // AI 대화 기능 사용 가능 여부 확인
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

    const handleAddExpression = async (
        newExpressionData: Omit<SavedExpression, "id">
    ) => {
        console.log("handleAddExpression called with:", newExpressionData);
        console.log("Current user object:", user);

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

            const newSavedExpression: SavedExpression = {
                id: docRef.id,
                ...newExpressionData,
            };

            setSavedExpressions((prev) => [newSavedExpression, ...prev]);
            setToastMessage("표현이 성공적으로 저장되었습니다!");
            setShowToast(true);
        } catch (error) {
            console.error("표현 저장 중 오류:", error);
            setToastMessage("표현 저장에 실패했습니다. 다시 시도해주세요.");
            setShowToast(true);
        }
    };

    useEffect(() => {
        if (!videoId || !authInitialized) {
            if (videoId) setLoading(true);
            return;
        }

        let isMounted = true;
        const loadAnalysisData = async () => {
            setLoading(true);
            setError("");
            setAnalysisData(null);

            try {
                // 1. 캐시된 데이터 확인
                const docId = `${videoId}`;
                const docRef = doc(db, "videoAnalyses", docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const cachedData = processTranscript(
                        docSnap.data() as GeminiResponseData
                    );
                    if (isMounted) setAnalysisData(cachedData);
                    // 캐시 조회는 사용량에 포함시키지 않음
                    return;
                }

                // --- [수정] 이하 캐시가 없을 경우, 새로운 분석 로직 ---

                // 2. 사용자 로그인 및 프로필 확인
                if (!user || !userProfile) {
                    setIsRedirecting(true);
                    setToastMessage("이 영상은 로그인 후 분석할 수 있습니다.");
                    setShowToast(true);
                    router.push("/");
                    return;
                }

                // 3. [추가] 일일 분석 횟수 제한 확인
                const plan = PLANS[userProfile.plan];
                const today = new Date().toISOString().split("T")[0];
                if (
                    userProfile.usage.lastAnalysisDate === today &&
                    userProfile.usage.analysisCount >= plan.dailyAnalysisLimit
                ) {
                    setError(
                        `오늘의 분석 횟수(${userProfile.usage.analysisCount}/${plan.dailyAnalysisLimit}회)를 모두 사용하셨습니다. 내일 다시 시도해주세요.`
                    );
                    return;
                }

                // 4. 영상 메타데이터 가져오기 및 영상 길이 제한 확인
                const metaRes = await fetch(
                    `/api/youtube-data?videoId=${videoId}`
                );
                if (!metaRes.ok) {
                    const errorData = await metaRes.json();
                    throw new Error(
                        errorData.error ||
                            "영상 정보를 가져오는 데 실패했습니다."
                    );
                }
                const metaData = await metaRes.json();
                if (!isMounted) return;
                setVideoTitle(metaData.youtubeTitle);

                if (metaData.duration > plan.maxVideoDuration) {
                    setError(
                        `${plan.name} 등급은 ${Math.floor(
                            plan.maxVideoDuration / 60
                        )}분 이하의 영상만 분석할 수 있습니다.`
                    );
                    return;
                }

                // 5. [추가] 분석 횟수 차감 (API 호출 직전)
                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, {
                    "usage.analysisCount": increment(1),
                    "usage.lastAnalysisDate": today,
                });

                // 6. AI 분석 API 호출
                const transcriptRes = await fetch("/api/transcript", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
                        userId: user.uid,
                    }),
                });

                if (!transcriptRes.ok) {
                    const errorData = await transcriptRes.json();
                    // 분석 실패 시, 차감했던 횟수 복구
                    await updateDoc(userDocRef, {
                        "usage.analysisCount": increment(-1),
                    });
                    throw new Error(
                        errorData.error || "영상 분석에 실패했습니다."
                    );
                }

                const newAnalysisData = await transcriptRes.json();
                const finalData = processTranscript({
                    ...newAnalysisData,
                    youtubeTitle: metaData.youtubeTitle,
                    thumbnailUrl: metaData.thumbnailUrl,
                    duration: metaData.duration,
                });

                if (isMounted) setAnalysisData(finalData);

                // 7. 분석 결과 캐싱 및 로그 저장
                await setDoc(docRef, {
                    ...finalData,
                    timestamp: new Date().toISOString(),
                });

                await addDoc(collection(db, "videoActivityLogs"), {
                    videoId: videoId,
                    activityType: "ANALYSIS_SUCCESS",
                    userId: user.uid,
                    timestamp: new Date().toISOString(),
                    youtubeTitle: metaData.youtubeTitle,
                    duration: metaData.duration,
                });
            } catch (err: any) {
                if (isMounted) {
                    setError(err.message || "알 수 없는 오류가 발생했습니다.");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadAnalysisData();

        return () => {
            isMounted = false;
        };
    }, [videoId, user, userProfile, authInitialized, router]);

    // ... (이하 나머지 코드는 변경 없음) ...
    // ...
    // ... (handleDeleteExpression, handleSeek, handleLoopToggle 등) ...
    // ...

    // 이펙트 훅은 변경사항이 없습니다.
    useEffect(() => {
        if (!user || !videoId || !analysisData) {
            setSavedExpressions([]);
            return;
        }

        const fetchSavedExpressions = async () => {
            try {
                const expressionsCollectionRef = collection(
                    db,
                    `users/${user.uid}/savedInterpretations`
                );
                const q = query(
                    expressionsCollectionRef,
                    where("videoId", "==", videoId),
                    orderBy("timestamp", "desc")
                );

                const querySnapshot = await getDocs(q);
                const expressions = querySnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as SavedExpression[];

                setSavedExpressions(expressions);
            } catch (error) {
                console.warn(
                    "저장된 표현을 불러오는 중 오류 발생 (인덱스 필요할 수 있음):",
                    error
                );
            }
        };

        fetchSavedExpressions();
    }, [user, videoId, analysisData]);

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
                            handleShowToast("표현이 삭제되었습니다.");
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
        if (playerRef.current) {
            playerRef.current.seekTo(seconds, "seconds");
            setIsPlaying(true);
        }
    };

    const handleLoopToggle = (startTime: number, endTime: number) => {
        if (isLooping && loopStartTime === startTime) {
            console.log(
                "LOOP: Stopping loop for segment starting at",
                startTime
            );
            setIsLooping(false);
            setLoopStartTime(null);
            setLoopEndTime(null);
            playerRef.current?.seekTo(endTime, "seconds");
        } else {
            console.log(
                "LOOP: Starting loop for segment from",
                startTime,
                "to",
                endTime
            );
            setIsLooping(true);
            setLoopStartTime(startTime);
            setLoopEndTime(endTime);
            playerRef.current?.seekTo(startTime, "seconds");
            setIsPlaying(true);
        }
    };

    useEffect(() => {
        console.log(
            "LOOP EFFECT: Triggered. isLooping:",
            isLooping,
            "currentTime:",
            currentTime,
            "loopStartTime:",
            loopStartTime,
            "loopEndTime:",
            loopEndTime
        );
        if (
            isLooping &&
            loopStartTime !== null &&
            loopEndTime !== null &&
            loopStartTime < loopEndTime
        ) {
            if (currentTime >= loopEndTime || currentTime < loopStartTime) {
                console.log(
                    "LOOP EFFECT: Seeking to start time",
                    loopStartTime
                );
                if (playerRef.current) {
                    playerRef.current.seekTo(loopStartTime, "seconds");
                }
            }
        }
    }, [currentTime, isLooping, loopStartTime, loopEndTime]);

    const handleShowToast = (message: string) => {
        setToastMessage(message);
        setShowToast(true);
    };

    if (isRedirecting) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center py-10 px-4">
                <LoadingAnimation />
                <p className="text-gray-600 text-center mt-4">
                    메인 페이지로 이동 중...
                </p>
            </div>
        );
    }

    // JSX 렌더링 부분은 변경사항 없습니다.
    return (
        <div className="min-h-screen flex flex-col items-center py-4 bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="w-full max-w-6xl mx-auto px-4">
                <button
                    onClick={() => router.push("/")}
                    className="mb-2 text-blue-600 hover:text-blue-800 font-semibold"
                >
                    ← 다른 영상 공부하기
                </button>
            </div>

            {loading && <LoadingAnimation />}

            {error && !loading && authInitialized && !analysisData && (
                <p className="text-red-500 text-lg mt-4 text-center p-4 bg-red-100 rounded-lg w-full max-w-6xl mx-auto px-4">
                    ⚠️ {error}
                </p>
            )}

            {analysisData && !loading && authInitialized && !error && (
                <div className="w-full max-w-6xl bg-white p-3 md:p-18 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:space-x-8 mt-4 mx-auto">
                    <VideoPlayer
                        url={`https://www.youtube.com/watch?v=${videoId}`}
                        title={analysisData.youtubeTitle || videoTitle}
                        summary={analysisData.analysis.summary}
                        playerRef={playerRef}
                        isPlaying={isPlaying}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        onProgress={(state) => {
                            setCurrentTime(state.playedSeconds);
                            console.log(
                                "Player Progress:",
                                state.playedSeconds
                            );
                        }}
                    />
                    <AnalysisTabs
                        analysis={analysisData.analysis}
                        transcript={analysisData.transcript_text}
                        currentTime={currentTime}
                        onSeek={handleSeek}
                        onStartConversation={handleStartConversation}
                        isConversationPending={isRecording || isPlayingAudio}
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
                    />
                </div>
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
    );
}

export default function AnalysisPageWrapper() {
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <AnalysisPageComponent />
        </Suspense>
    );
}
