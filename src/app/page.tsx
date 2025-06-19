"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import ReactPlayer from "react-player";
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    User,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useGeminiLiveConversation } from "../lib/useGeminiLiveConversation";

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
}

interface VideoSegment {
    time: number;
    text: string;
}

// Modern Loading Component
const LoadingAnimation = () => (
    <div className="flex flex-col items-center justify-center p-8">
        <div className="relative w-32 h-32">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 animate-spin">
                <div className="absolute inset-2 bg-white rounded-full"></div>
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 opacity-50 blur-xl animate-pulse"></div>
        </div>
        <div className="mt-6 space-y-2">
            <div className="h-2 w-48 bg-gradient-to-r from-blue-300 to-purple-300 rounded-full animate-pulse"></div>
            <div className="h-2 w-36 bg-gradient-to-r from-purple-300 to-pink-300 rounded-full animate-pulse mx-auto"></div>
            <p className="text-gray-600 text-center mt-4 font-medium">
                AI가 영상을 분석하고 있어요...
            </p>
            <p className="text-gray-500 text-center text-sm">
                잠시만 기다려주세요 ✨
            </p>
        </div>
    </div>
);

export default function Home() {
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [geminiAnalysis, setGeminiAnalysis] = useState<VideoAnalysis | null>(
        null
    );
    const [transcript, setTranscript] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeTab, setActiveTab] = useState<
        "analysis" | "transcript" | "questions"
    >("questions");
    const [user, setUser] = useState<User | null>(null);

    const playerRef = useRef<ReactPlayer>(null);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);

    const parsedTranscript = useMemo(() => {
        const safeTranscript = String(transcript || "");

        const lines = safeTranscript
            .split("\n")
            .filter((line) => line.trim() !== "");

        const parsed: VideoSegment[] = [];
        let currentSegment: VideoSegment | null = null;

        lines.forEach((line) => {
            const match = line.match(/^\[(\d{2}):(\d{2})\]\s*(.*)/);

            if (match) {
                if (currentSegment) {
                    parsed.push(currentSegment as VideoSegment);
                }
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const timeInSeconds = minutes * 60 + seconds;
                currentSegment = { time: timeInSeconds, text: match[3].trim() };
            } else if (currentSegment) {
                (currentSegment as VideoSegment).text += " " + line.trim();
            }
        });

        if (currentSegment) {
            parsed.push(currentSegment as VideoSegment);
        }

        if (parsed.length === 0 && safeTranscript.trim() !== "") {
            const cleanedText = safeTranscript
                .trim()
                .replace(/^\[(\d{2}):(\d{2})\]/g, "")
                .trim();
            if (cleanedText) {
                parsed.push({ time: 0, text: cleanedText });
            }
        }
        return parsed;
    }, [transcript]);

    const activeSegmentIndex = useMemo(() => {
        return parsedTranscript.findIndex((segment, index) => {
            const nextSegment = parsedTranscript[index + 1];
            const isActive =
                currentTime >= segment.time &&
                (!nextSegment || currentTime < nextSegment.time);
            return isActive;
        });
    }, [currentTime, parsedTranscript]);

    useEffect(() => {
        if (activeSegmentIndex === -1 || !transcriptContainerRef.current) {
            return;
        }

        const activeSegmentElement = transcriptContainerRef.current.children[
            activeSegmentIndex
        ] as HTMLElement;

        if (activeSegmentElement) {
            activeSegmentElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [activeSegmentIndex]);

    const handleSeek = (seconds: number) => {
        if (playerRef.current) {
            playerRef.current.seekTo(seconds, "seconds");
            setIsPlaying(true);
        }
    };

    const handleGoogleSignIn = async () => {
        if (!auth) {
            setError("Firebase Auth not initialized.");
            return;
        }
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (err: unknown) {
            let errorMessage = "Google Sign-In failed.";
            if (err instanceof Error) {
                errorMessage += `: ${err.message}`;
            }
            setError(errorMessage);
        }
    };

    const handleGoogleSignOut = async () => {
        if (!auth) {
            setError("Firebase Auth not initialized.");
            return;
        }
        try {
            await signOut(auth);
            setGeminiAnalysis(null);
            setTranscript("");
            setYoutubeUrl("");
            setCurrentTime(0);
            setActiveTab("analysis");
        } catch (err: unknown) {
            let errorMessage = "Google Sign-Out failed.";
            if (err instanceof Error) {
                errorMessage += `: ${err.message}`;
            }
            setError(errorMessage);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (youtubeUrl.trim() === "") {
            setError("");
            setLoading(false);
            return;
        }

        const youtubeRegex =
            /^(https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?)$/;
        if (!youtubeRegex.test(youtubeUrl)) {
            setError("유효한 YouTube 영상 URL을 입력해주세요.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setGeminiAnalysis(null);
        setTranscript("");
        setError("");
        setCurrentTime(0);
        setActiveTab("analysis");

        if (!user) {
            window.alert("로그인 후 이용해주세요.");
            setLoading(false);
            return;
        }

        const docId = encodeURIComponent(youtubeUrl).replace(/\./g, "_");

        try {
            const docRef = doc(db, "videoAnalyses", docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log("Cached data found in Firestore.");
                const cachedData = docSnap.data() as GeminiResponseData;
                setGeminiAnalysis(cachedData.analysis);
                setTranscript(cachedData.transcript_text);

                await new Promise((resolve) => setTimeout(resolve, 3000));

                setLoading(false);
                return;
            }

            console.log("No cached data found. Fetching from Gemini API.");
            const response = await fetch("/api/transcript", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ youtubeUrl }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to fetch analysis");
            }

            const data: GeminiResponseData = await response.json();
            setGeminiAnalysis(data.analysis);
            if (typeof data.transcript_text === "string") {
                setTranscript(data.transcript_text);
                console.log("Received transcript_text:", data.transcript_text);
            } else {
                setTranscript("");
                console.log(
                    "Received non-string transcript_text:",
                    data.transcript_text
                );
            }

            await setDoc(docRef, {
                youtubeUrl: youtubeUrl,
                analysis: data.analysis,
                transcript_text: data.transcript_text,
                timestamp: new Date().toISOString(),
            });
            console.log("Data saved to Firestore.");
        } catch (err: unknown) {
            let errorMessage = "An unknown error occurred";
            if (err instanceof Error) {
                errorMessage = err.message;
            }
            setError(errorMessage);
        }
        setLoading(false);
    };

    const {
        isRecording,
        isPlayingAudio,
        selectedQuestion,
        handleStartConversation,
        handleStopConversation,
    } = useGeminiLiveConversation({
        transcript,
        geminiAnalysis,
        setError,
        setActiveTab,
    });

    useEffect(() => {
        if (auth) {
            const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                setUser(currentUser);
            });
            return () => unsubscribe();
        }
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col items-center py-10">
            <div className="text-center mb-8">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
                    YouTube로 배우는 영어
                </h1>
                <p className="text-gray-600 text-lg">
                    AI와 함께 영상을 분석하고 실전 영어를 학습해보세요 🎓
                </p>
            </div>

            <div className="mb-6">
                {user ? (
                    <div className="flex items-center space-x-3 bg-white rounded-full px-5 py-2 shadow-md">
                        {user.photoURL && (
                            <img
                                src={user.photoURL}
                                alt="User Avatar"
                                className="w-10 h-10 rounded-full border-2 border-gradient-to-r from-blue-400 to-purple-400"
                            />
                        )}
                        <p className="text-gray-700 font-medium">
                            안녕하세요, {user.displayName || user.email}님! 👋
                        </p>
                        <button
                            onClick={handleGoogleSignOut}
                            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-2 px-4 rounded-full transition-all duration-300 transform hover:scale-105"
                        >
                            로그아웃
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleGoogleSignIn}
                        className="bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-full shadow-lg flex items-center space-x-3 transition-all duration-300 transform hover:scale-105"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        <span>Google로 시작하기</span>
                    </button>
                )}
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md mb-8 transition-all duration-300 hover:shadow-2xl">
                <div className="mb-6">
                    <label
                        htmlFor="youtubeUrl"
                        className="block text-gray-700 text-sm font-semibold mb-3 flex items-center"
                    >
                        <span className="mr-2">🎬</span> YouTube URL 입력
                    </label>
                    <input
                        type="url"
                        id="youtubeUrl"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all duration-300 text-gray-700"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={youtubeUrl}
                        onChange={(e) => {
                            setYoutubeUrl(e.target.value);
                            setGeminiAnalysis(null);
                            setTranscript("");
                            setError("");
                        }}
                        onKeyPress={(e) => {
                            if (e.key === "Enter") {
                                handleSubmit(e);
                            }
                        }}
                    />
                </div>
                <button
                    onClick={handleSubmit}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                >
                    {loading ? "분석 중..." : "AI로 영상 분석하기 ✨"}
                </button>
                {error && (
                    <p className="text-red-500 text-sm mt-4 flex items-center">
                        <span className="mr-2">⚠️</span> {error}
                    </p>
                )}
            </div>

            {youtubeUrl && (geminiAnalysis || loading) && (
                <div className="w-full max-w-6xl bg-white p-8 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:space-x-8">
                    <div className="w-full lg:w-1/2 mb-6 lg:mb-0">
                        <div className="mb-4">
                            {youtubeUrl ? (
                                <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden shadow-lg">
                                    <ReactPlayer
                                        ref={playerRef}
                                        url={youtubeUrl}
                                        controls={true}
                                        playing={isPlaying}
                                        width="100%"
                                        height="100%"
                                        className="absolute inset-0"
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onEnded={() => setIsPlaying(false)}
                                        onProgress={({ playedSeconds }) =>
                                            setCurrentTime(playedSeconds)
                                        }
                                    />
                                </div>
                            ) : (
                                <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
                                    <p className="text-gray-500">
                                        YouTube URL을 입력하고 분석을 시작하세요
                                        📺
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full lg:w-1/2 flex flex-col h-[600px]">
                        {loading && !geminiAnalysis ? (
                            <div className="flex-1 flex justify-center items-center bg-gray-50 rounded-xl">
                                <LoadingAnimation />
                            </div>
                        ) : geminiAnalysis ? (
                            <>
                                <div className="flex space-x-2 mb-4 border-b-2 border-gray-100">
                                    {youtubeUrl && (
                                        <button
                                            className={`px-6 py-3 font-semibold rounded-t-lg transition-all duration-300 ${
                                                activeTab === "analysis"
                                                    ? "text-white bg-gradient-to-r from-blue-500 to-purple-500 shadow-md transform scale-105"
                                                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                                            }`}
                                            onClick={() =>
                                                setActiveTab("analysis")
                                            }
                                        >
                                            📊 분석 결과
                                        </button>
                                    )}
                                    {youtubeUrl && (
                                        <button
                                            className={`px-6 py-3 font-semibold rounded-t-lg transition-all duration-300 ${
                                                activeTab === "transcript"
                                                    ? "text-white bg-gradient-to-r from-blue-500 to-purple-500 shadow-md transform scale-105"
                                                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                                            }`}
                                            onClick={() =>
                                                setActiveTab("transcript")
                                            }
                                        >
                                            📝 자막
                                        </button>
                                    )}
                                    <button
                                        className={`px-6 py-3 font-semibold rounded-t-lg transition-all duration-300 ${
                                            activeTab === "questions"
                                                ? "text-white bg-gradient-to-r from-blue-500 to-purple-500 shadow-md transform scale-105"
                                                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                                        }`}
                                        onClick={() =>
                                            setActiveTab("questions")
                                        }
                                    >
                                        💬 AI 대화
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 rounded-xl">
                                    {activeTab === "analysis" &&
                                    geminiAnalysis ? (
                                        <div className="text-gray-700 space-y-6">
                                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                                <h3 className="text-xl font-bold mb-3 flex items-center text-blue-600">
                                                    <span className="mr-2">
                                                        📋
                                                    </span>{" "}
                                                    영상 요약
                                                </h3>
                                                <p className="leading-relaxed">
                                                    {geminiAnalysis.summary}
                                                </p>
                                            </div>

                                            {geminiAnalysis.keywords &&
                                                geminiAnalysis.keywords.length >
                                                    0 && (
                                                    <div className="bg-white p-6 rounded-lg shadow-sm">
                                                        <h3 className="text-xl font-bold mb-3 flex items-center text-purple-600">
                                                            <span className="mr-2">
                                                                🔑
                                                            </span>{" "}
                                                            핵심 단어
                                                        </h3>
                                                        <div className="flex flex-wrap gap-2">
                                                            {geminiAnalysis.keywords.map(
                                                                (
                                                                    keyword,
                                                                    index
                                                                ) => (
                                                                    <span
                                                                        key={
                                                                            index
                                                                        }
                                                                        className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 font-medium px-4 py-2 rounded-full transition-all duration-300 hover:shadow-md hover:scale-110"
                                                                    >
                                                                        {
                                                                            keyword
                                                                        }
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                            {geminiAnalysis.slang_expressions &&
                                                geminiAnalysis.slang_expressions
                                                    .length > 0 && (
                                                    <div className="bg-white p-6 rounded-lg shadow-sm">
                                                        <h3 className="text-xl font-bold mb-3 flex items-center text-green-600">
                                                            <span className="mr-2">
                                                                💡
                                                            </span>{" "}
                                                            실전 표현
                                                        </h3>
                                                        <ul className="space-y-3">
                                                            {geminiAnalysis.slang_expressions.map(
                                                                (
                                                                    slang,
                                                                    index
                                                                ) => (
                                                                    <li
                                                                        key={
                                                                            index
                                                                        }
                                                                        className="bg-green-50 p-3 rounded-lg transition-all duration-300 hover:bg-green-100"
                                                                    >
                                                                        <strong className="text-green-700">
                                                                            "
                                                                            {
                                                                                slang.expression
                                                                            }
                                                                            "
                                                                        </strong>
                                                                        <span className="text-gray-600 ml-2">
                                                                            →{" "}
                                                                            {
                                                                                slang.meaning
                                                                            }
                                                                        </span>
                                                                    </li>
                                                                )
                                                            )}
                                                        </ul>
                                                    </div>
                                                )}
                                        </div>
                                    ) : activeTab === "transcript" &&
                                      parsedTranscript.length > 0 ? (
                                        <div
                                            ref={transcriptContainerRef}
                                            className="text-gray-700 space-y-2"
                                        >
                                            {parsedTranscript.map(
                                                (
                                                    segment: VideoSegment,
                                                    index
                                                ) => {
                                                    const isCurrent =
                                                        index ===
                                                        activeSegmentIndex;
                                                    return (
                                                        <p
                                                            key={index}
                                                            className={`py-1 px-4  rounded-lg transition-all duration-300 ${
                                                                isCurrent
                                                                    ? "bg-gradient-to-r from-blue-100 to-purple-100 shadow-md transform scale-105"
                                                                    : "bg-white hover:bg-gray-50"
                                                            }`}
                                                        >
                                                            <span
                                                                className="font-bold text-blue-600 cursor-pointer hover:text-purple-600 transition-colors duration-300"
                                                                onClick={() =>
                                                                    handleSeek(
                                                                        segment.time
                                                                    )
                                                                }
                                                            >
                                                                [
                                                                {String(
                                                                    Math.floor(
                                                                        segment.time /
                                                                            60
                                                                    )
                                                                ).padStart(
                                                                    2,
                                                                    "0"
                                                                )}
                                                                :
                                                                {String(
                                                                    Math.floor(
                                                                        segment.time %
                                                                            60
                                                                    )
                                                                ).padStart(
                                                                    2,
                                                                    "0"
                                                                )}
                                                                ]
                                                            </span>{" "}
                                                            <span
                                                                className={
                                                                    isCurrent
                                                                        ? "font-medium"
                                                                        : ""
                                                                }
                                                            >
                                                                {segment.text}
                                                            </span>
                                                        </p>
                                                    );
                                                }
                                            )}
                                        </div>
                                    ) : (
                                        activeTab === "questions" && (
                                            <div className="text-gray-700">
                                                <div className="bg-white p-6 rounded-lg shadow-sm">
                                                    <h3 className="text-xl font-bold mb-4 flex items-center text-purple-600">
                                                        <span className="mr-2">
                                                            🤖
                                                        </span>{" "}
                                                        AI 영어 선생님과
                                                        대화하기
                                                    </h3>
                                                    {geminiAnalysis?.main_questions &&
                                                    geminiAnalysis
                                                        .main_questions.length >
                                                        0 ? (
                                                        <div className="space-y-3">
                                                            <p className="text-gray-600 mb-4">
                                                                아래 주제로
                                                                대화를
                                                                시작해보세요:
                                                            </p>
                                                            {geminiAnalysis.main_questions.map(
                                                                (
                                                                    question,
                                                                    index
                                                                ) => (
                                                                    <div
                                                                        key={
                                                                            index
                                                                        }
                                                                        className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg flex items-center justify-between transition-all duration-300 hover:shadow-md"
                                                                    >
                                                                        <span className="flex-1 font-medium">
                                                                            {
                                                                                question
                                                                            }
                                                                        </span>
                                                                        <button
                                                                            onClick={() =>
                                                                                handleStartConversation(
                                                                                    question
                                                                                )
                                                                            }
                                                                            className="ml-4 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
                                                                            disabled={
                                                                                isRecording ||
                                                                                isPlayingAudio
                                                                            }
                                                                        >
                                                                            시작하기
                                                                        </button>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-8">
                                                            <p className="mb-4 text-gray-600">
                                                                영상을 분석하면
                                                                관련 대화 주제가
                                                                생성됩니다.
                                                            </p>
                                                            <button
                                                                onClick={() =>
                                                                    handleStartConversation(
                                                                        "Hello! Let's practice English together."
                                                                    )
                                                                }
                                                                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
                                                                disabled={
                                                                    isRecording ||
                                                                    isPlayingAudio
                                                                }
                                                            >
                                                                자유 대화
                                                                시작하기 🎤
                                                            </button>
                                                        </div>
                                                    )}

                                                    {isRecording && (
                                                        <div className="mt-6 text-center">
                                                            <button
                                                                className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-8 py-4 rounded-lg transition-all duration-300 transform hover:scale-105 animate-pulse"
                                                                onClick={() =>
                                                                    handleStopConversation(
                                                                        "stop_button"
                                                                    )
                                                                }
                                                            >
                                                                대화 중지 ⏹️
                                                            </button>
                                                            <p className="mt-3 text-green-600 font-medium animate-pulse">
                                                                🎙️ 녹음 중...
                                                                영어로
                                                                말해보세요!
                                                            </p>
                                                        </div>
                                                    )}
                                                    {isPlayingAudio && (
                                                        <p className="mt-4 text-center text-blue-600 font-medium animate-pulse">
                                                            🔊 AI 선생님이
                                                            응답하고 있어요...
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex justify-center items-center bg-gray-50 rounded-xl">
                                <p className="text-gray-500 text-center">
                                    분석 결과가 여기에 표시됩니다 📊
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
