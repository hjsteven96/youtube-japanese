"use client";
import { useState, useRef, useEffect } from "react";
import ReactPlayer from "react-player";
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    User,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc, collection, updateDoc } from "firebase/firestore";
import { useGeminiLiveConversation } from "../lib/useGeminiLiveConversation";
import { handleUrlSubmit as processUrl } from "../lib/handleUrlSubmit"; //

// --- 분리된 컴포넌트 import ---
import LoadingAnimation from "./components/LoadingAnimation";
import ConversationModal from "./components/ConversationModal";
import UrlInputForm from "./components/UrlInputForm";
import VideoPlayer from "./components/VideoPlayer";
import AnalysisTabs from "./components/AnalysisTabs";

// --- 타입 정의 (별도 파일로 분리 추천) ---
interface SlangExpression {
    expression: string;
    meaning: string;
}
interface VideoAnalysis {
    summary: string;
    keywords: string[];
    slang_expressions: SlangExpression[];
    main_questions: string[];
}
interface GeminiResponseData {
    analysis: VideoAnalysis;
    transcript_text: string;
    youtubeTitle?: string;
    youtubeDescription?: string;
}

// --- 메인 페이지 컴포넌트 ---
export default function Home() {
    const [activeTab, setActiveTab] = useState<
        "analysis" | "transcript" | "questions"
    >("analysis");
    // --- 최상위 상태 관리 ---
    const [user, setUser] = useState<User | null>(null);
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [analysisData, setAnalysisData] = useState<GeminiResponseData | null>(
        null
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // 비디오 플레이어 관련 상태
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const playerRef = useRef<ReactPlayer>(null);

    // AI 대화 관련 상태
    const [isConversationModeActive, setIsConversationModeActive] =
        useState(false);

    // --- 커스텀 훅 및 로직 ---
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

    // --- useEffect 훅 ---
    // Firebase 인증 상태 감시
    useEffect(() => {
        if (auth) {
            const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                setUser(currentUser);
            });
            return () => unsubscribe();
        }
    }, []);

    // 사용자별 영상 학습 진행 상황 저장 (디바운스)
    useEffect(() => {
        if (!user || !youtubeUrl || !analysisData?.youtubeTitle) return;

        const videoId = youtubeUrl.match(
            /(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        )?.[1];
        if (!videoId) return;

        const handler = setTimeout(async () => {
            try {
                const historyDocRef = doc(
                    db,
                    "users",
                    user.uid,
                    "learningHistory",
                    videoId
                );
                await setDoc(
                    historyDocRef,
                    {
                        youtubeUrl: youtubeUrl,
                        lastPlayedTime: currentTime,
                        timestamp: new Date().toISOString(),
                        youtubeTitle: analysisData.youtubeTitle,
                        youtubeDescription: analysisData.youtubeDescription,
                    },
                    { merge: true }
                );
            } catch (error) {
                console.error("Error saving playback progress:", error);
            }
        }, 3000);

        return () => clearTimeout(handler);
    }, [
        currentTime,
        youtubeUrl,
        user,
        analysisData?.youtubeTitle,
        analysisData?.youtubeDescription,
    ]);

    // --- 이벤트 핸들러 ---
    const handleGoogleSignIn = async () => {
        if (!auth) return;
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (err) {
            setError("Google Sign-In failed.");
        }
    };

    const handleGoogleSignOut = async () => {
        if (!auth) return;
        await signOut(auth);
        setYoutubeUrl("");
        setAnalysisData(null);
        setError("");
    };

    const onUrlSubmit = (submittedUrl: string) => {
        processUrl({
            submittedUrl,
            user,
            setYoutubeUrl,
            setLoading,
            setError,
            setAnalysisData,
            setCurrentTime,
            setActiveTab,
        });
    };

    const handleUrlChange = () => {
        setError("");
        setAnalysisData(null);
        setYoutubeUrl("");
    };

    const handleSeek = (seconds: number) => {
        playerRef.current?.seekTo(seconds, "seconds");
        setIsPlaying(true);
    };

    const startConversation = (question: string) => {
        // useGeminiLiveConversation 훅을 직접 호출
        handleStartConversation(question);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col items-center py-10 px-4">
            <header className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
                    YouTube로 배우는 영어
                </h1>
                <p className="text-gray-600 text-lg">
                    AI와 함께 영상을 분석하고 실전 영어를 학습해보세요 🎓
                </p>
            </header>

            <div className="mb-6">
                {user ? (
                    <div className="flex items-center space-x-3 bg-white rounded-full px-5 py-2 shadow-md">
                        {user.photoURL && (
                            <img
                                src={user.photoURL}
                                alt="User Avatar"
                                className="w-10 h-10 rounded-full border-2 border-purple-400"
                            />
                        )}
                        <p className="text-gray-700 font-medium">
                            안녕하세요, {user.displayName || user.email}님! 👋
                        </p>
                        <button
                            onClick={handleGoogleSignOut}
                            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-2 px-4 rounded-full transition-transform transform hover:scale-105"
                        >
                            로그아웃
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleGoogleSignIn}
                        className="bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-full shadow-lg flex items-center space-x-3 transition-transform transform hover:scale-105"
                    >
                        {/* Google Icon SVG */}
                        <span>Google로 시작하기</span>
                    </button>
                )}
            </div>

            <UrlInputForm
                onSubmit={onUrlSubmit}
                loading={loading}
                onUrlChange={handleUrlChange}
            />

            {error && (
                <p className="text-red-500 text-sm mt-4 text-center">
                    ⚠️ {error}
                </p>
            )}

            {loading && !analysisData && <LoadingAnimation />}

            {analysisData && youtubeUrl && (
                <div className="w-full max-w-6xl bg-white p-4 md:p-8 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:space-x-8 mt-4">
                    <VideoPlayer
                        url={youtubeUrl}
                        title={analysisData.youtubeTitle || null}
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
                        onStartConversation={startConversation}
                        isConversationPending={isRecording || isPlayingAudio}
                        user={user}
                        youtubeUrl={youtubeUrl}
                        activeTab={activeTab} // <-- prop 추가
                        setActiveTab={setActiveTab} // <-- prop 추가
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
