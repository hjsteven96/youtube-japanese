// src/app/analysis/[videoId]/page.tsx
"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactPlayer from "react-player";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

import LoadingAnimation from "../../components/LoadingAnimation";
import ConversationModal from "../../components/ConversationModal";
import VideoPlayer from "../../components/VideoPlayer";
import AnalysisTabs from "../../components/AnalysisTabs";
import { useGeminiLiveConversation } from "../../../lib/useGeminiLiveConversation";

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
}

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
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthInitialized(true);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!videoId || !authInitialized) {
            if (videoId) setLoading(true);
            return;
        }

        let isMounted = true;

        const loadData = async () => {
            setLoading(true);
            setError("");
            setIsRedirecting(false);

            try {
                // 1. Firestore 캐시 확인 (로그인 여부와 관계없이 먼저 확인)
                const docId = `yt_${videoId}`;
                const docRef = doc(db, "videoAnalyses", docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    console.log("Firestore에서 캐시된 데이터를 사용합니다.");
                    if (isMounted)
                        setAnalysisData(docSnap.data() as GeminiResponseData);
                    setLoading(false);
                    return; // 캐시 데이터가 있으면 여기서 종료
                }

                // 2. 캐시된 데이터가 없는 경우, 로그인 여부 확인
                if (!user) {
                    console.log(
                        "로그인되지 않았으며, 캐시된 데이터가 없어 메인 페이지로 리다이렉트합니다."
                    );
                    setIsRedirecting(true);
                    alert("이 영상은 로그인 후 분석할 수 있습니다.");
                    router.push("/");
                    return; // 로그인 필요 시 여기서 종료
                }

                // 3. 로그인되었고 캐시된 데이터도 없는 경우, 메타데이터 가져오기 및 길이 제한 확인
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

                // 영상 길이 10분 초과 시 처리 (로그인 후 길이 체크)
                if (metaData.duration > 600) {
                    setError("10분 이하의 영상만 분석할 수 있습니다.");
                    setLoading(false);
                    return;
                }

                // 4. 모든 조건 통과 후, 신규 분석 요청 (Gemini 호출)
                console.log(
                    "캐시된 데이터가 없어 Gemini API로 분석을 요청합니다."
                );
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

                const finalData = {
                    ...newAnalysisData,
                    youtubeTitle: metaData.youtubeTitle,
                };
                if (isMounted) setAnalysisData(finalData);

                await setDoc(docRef, {
                    ...finalData,
                    timestamp: new Date().toISOString(),
                });
                console.log("새로운 분석 결과를 Firestore에 저장했습니다.");
                setLoading(false);
            } catch (err: any) {
                if (isMounted) {
                    console.error("데이터 로딩 중 에러 발생:", err);
                    setError(err.message || "알 수 없는 오류가 발생했습니다.");
                    setLoading(false);
                }
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, [videoId, user, authInitialized, router]);

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

            {(loading || !authInitialized) && <LoadingAnimation />}

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
                        youtubeUrl={`https://www.youtube.com/watch/v=${videoId}`}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
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

export default function AnalysisPage() {
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <AnalysisPageComponent />
        </Suspense>
    );
}
