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
} from "firebase/firestore";

import LoadingAnimation from "../../components/LoadingAnimation";
import ConversationModal from "../../components/ConversationModal";
import VideoPlayer from "../../components/VideoPlayer";
import AnalysisTabs from "../../components/AnalysisTabs";
import { useGeminiLiveConversation } from "../../../lib/useGeminiLiveConversation";
import { SavedExpression } from "../../components/SavedExpressions";

// --- 타입 정의 ---
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
    const [authInitialized, setAuthInitialized] = useState(false);
    const [analysisData, setAnalysisData] = useState<GeminiResponseData | null>(
        null
    );
    const [videoTitle, setVideoTitle] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isRedirecting, setIsRedirecting] = useState(false);

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
        onConversationStart: () => setIsConversationModeActive(true),
        setActiveTab: setActiveTab,
        videoId: videoId,
        user: user,
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
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
            alert("표현을 저장하려면 로그인이 필요합니다.");
            return;
        }

        try {
            // Firestore에 데이터를 추가하고, 자동으로 생성된 ID를 가진 문서 참조를 받습니다.
            const docRef = await addDoc(
                collection(db, `users/${user.uid}/savedInterpretations`),
                newExpressionData
            );

            // 저장이 성공하면, 반환된 ID를 포함하여 화면에 표시할 객체를 만듭니다.
            const newSavedExpression: SavedExpression = {
                id: docRef.id,
                ...newExpressionData,
            };

            // 화면 상태(State)를 업데이트하여 저장된 표현을 즉시 목록 맨 위에 보여줍니다.
            setSavedExpressions((prev) => [newSavedExpression, ...prev]);
        } catch (error) {
            console.error("표현 저장 중 오류:", error);
            // 사용자에게 더 구체적인 에러 메시지를 보여줍니다.
            alert(
                "표현 저장에 실패했습니다. Firestore 보안 규칙이나 설정을 확인해주세요."
            );
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
                const docId = `${videoId}`;
                const docRef = doc(db, "videoAnalyses", docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const cachedData = processTranscript(
                        docSnap.data() as GeminiResponseData
                    );
                    if (isMounted) setAnalysisData(cachedData);
                    return;
                }

                if (!user) {
                    setIsRedirecting(true);
                    alert("이 영상은 로그인 후 분석할 수 있습니다.");
                    router.push("/");
                    return;
                }

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

                if (metaData.duration > 600) {
                    setError("10분 이하의 영상만 분석할 수 있습니다.");
                    return;
                }

                const transcriptRes = await fetch("/api/transcript", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
                    }),
                });

                if (!transcriptRes.ok) {
                    const errorData = await transcriptRes.json();
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

                await setDoc(docRef, {
                    ...finalData,
                    timestamp: new Date().toISOString(),
                });

                if (user) {
                    await addDoc(collection(db, "videoActivityLogs"), {
                        videoId: videoId,
                        activityType: "ANALYSIS",
                        userId: user.uid,
                        timestamp: new Date().toISOString(),
                        youtubeTitle: metaData.youtubeTitle,
                        duration: metaData.duration,
                    });
                }
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
    }, [videoId, user, authInitialized, router]);

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

        if (confirm("이 표현을 삭제하시겠습니까?")) {
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
            } catch (error) {
                console.error("표현 삭제 중 오류:", error);
                alert("삭제에 실패했습니다.");
            }
        }
    };

    const handleSeek = (seconds: number) => {
        if (playerRef.current) {
            playerRef.current.seekTo(seconds, "seconds");
            setIsPlaying(true);
        }
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col items-center py-10 px-4">
            <button
                onClick={() => router.push("/")}
                className="self-start mb-8 ml-4 text-blue-600 hover:text-blue-800 font-semibold"
            >
                ← 다른 영상 분석하기
            </button>

            {loading && <LoadingAnimation />}

            {error && !loading && authInitialized && !analysisData && (
                <p className="text-red-500 text-lg mt-4 text-center p-4 bg-red-100 rounded-lg">
                    ⚠️ {error}
                </p>
            )}

            {analysisData && !loading && authInitialized && !error && (
                <div className="w-full max-w-6xl bg-white p-4 md:p-8 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:space-x-8 mt-4">
                    <VideoPlayer
                        url={`https://www.youtube.com/watch?v=${videoId}`}
                        title={analysisData.youtubeTitle || videoTitle}
                        summary={analysisData.analysis.summary}
                        playerRef={playerRef}
                        isPlaying={isPlaying}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        onProgress={({ playedSeconds }) =>
                            setCurrentTime(playedSeconds)
                        }
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
