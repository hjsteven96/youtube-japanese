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
import { doc, getDoc, setDoc, collection } from "firebase/firestore";
import { useGeminiLiveConversation } from "../lib/useGeminiLiveConversation";

// --- 인터페이스 정의 ---
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

// --- 로딩 애니메이션 컴포넌트 ---
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

// --- [수정] AI 대화 모달 컴포넌트 props 타입 정의 ---
interface ConversationModalProps {
    isOpen: boolean;
    onClose: () => void;
    isRecording: boolean;
    isPlayingAudio: boolean;
    selectedQuestion: string | null; // selectedQuestion의 타입에 맞게 조정
}

const ConversationModal = ({
    isOpen,
    onClose,
    isRecording,
    isPlayingAudio,
    selectedQuestion,
}: ConversationModalProps) => {
    // 여기에 타입 지정
    if (!isOpen) return null;

    const getStatusText = () => {
        if (isRecording) return "🎙️ 듣고 있어요... 편하게 말씀해주세요!";
        if (isPlayingAudio) return "AI 선생님이 답변하고 있어요...";
        return "대화할 준비가 되었어요.";
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 flex flex-col items-center justify-between p-6 z-50 transition-opacity duration-300">
            <button
                onClick={onClose}
                className="absolute top-6 right-6 text-white text-5xl font-light hover:text-gray-400 transition-colors"
                aria-label="Close Conversation"
            >
                ×
            </button>

            <div className="w-full max-w-4xl text-center flex-grow flex flex-col justify-center overflow-y-auto pt-20 pb-10">
                {/* 향후 대화 기록(log)을 표시할 영역 */}
                <p className="text-gray-300 text-2xl md:text-3xl font-light mb-12">
                    {selectedQuestion || "자유롭게 대화를 시작해 보세요."}
                </p>

                {isRecording && (
                    <p className="text-2xl md:text-3xl text-white italic animate-pulse">
                        사용자 음성이 여기에 표시됩니다...
                    </p>
                )}
            </div>

            <div className="w-full flex flex-col items-center">
                <div className="relative w-28 h-28 md:w-32 md:h-32 mb-6">
                    <div
                        className={`absolute inset-0 bg-blue-600 rounded-full transition-all duration-300 ease-in-out ${
                            isRecording
                                ? "animate-pulse scale-110"
                                : "scale-100"
                        } ${isPlayingAudio ? "animate-ping" : ""}`}
                    ></div>
                    <div className="absolute inset-2 bg-gray-800 rounded-full"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                            className="w-12 h-12 md:w-14 md:h-14 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                fillRule="evenodd"
                                d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-1a6 6 0 11-12 0H3a7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                                clipRule="evenodd"
                            ></path>
                        </svg>
                    </div>
                </div>

                <p className="text-white text-lg h-7 mb-8">{getStatusText()}</p>

                <button
                    onClick={onClose}
                    className="w-20 h-20 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105"
                    aria-label="Stop Conversation"
                >
                    <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 10h6v4H9z"
                        ></path>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default function Home() {
    // --- 상태 변수 ---
    const [isConversationModeActive, setIsConversationModeActive] =
        useState(false);
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
    >("analysis");
    const [user, setUser] = useState<User | null>(null);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipText, setTooltipText] = useState("");
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [interpretationResult, setInterpretationResult] = useState<
        string | null
    >(null);
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [selectedFullSentenceContext, setSelectedFullSentenceContext] =
        useState<string>("");
    const [youtubeTitle, setYoutubeTitle] = useState<string | null>(null);

    // --- Ref 변수 ---
    const playerRef = useRef<ReactPlayer>(null);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- 헬퍼 함수 및 Memoized 값 ---
    const parsedTranscript = useMemo(() => {
        const safeTranscript = String(transcript || "");
        if (!safeTranscript.trim()) {
            return [];
        }

        const parsed: VideoSegment[] = [];
        const regex = /\[(\d{2}):(\d{2})\]([^\[]*)/g; // 타임스탬프와 텍스트 파싱

        const matches = safeTranscript.matchAll(regex);

        for (const match of matches) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const timeInSeconds = minutes * 60 + seconds;
            const text = match[3].trim();

            if (text) {
                parsed.push({ time: timeInSeconds, text });
            }
        }

        // 만약 파싱된 세그먼트가 없지만 텍스트가 있다면, 전체 텍스트를 첫 번째 세그먼트로 처리
        if (parsed.length === 0 && safeTranscript.trim() !== "") {
            parsed.push({ time: 0, text: safeTranscript.trim() });
        }

        return parsed;
    }, [transcript]);

    const activeSegmentIndex = useMemo(() => {
        return parsedTranscript.findIndex((segment, index) => {
            const nextSegment = parsedTranscript[index + 1];
            // 현재 시간이 세그먼트 시작 시간보다 크거나 같고, 다음 세그먼트 시작 시간보다 작으면 활성 세그먼트
            const isActive =
                currentTime >= segment.time &&
                (!nextSegment || currentTime < nextSegment.time);
            return isActive;
        });
    }, [currentTime, parsedTranscript]);

    // --- Effect Hooks ---
    // 활성 자막 세그먼트 스크롤
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

    // Firebase 인증 상태 감시
    useEffect(() => {
        if (auth) {
            const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                setUser(currentUser);
            });
            return () => unsubscribe(); // 컴포넌트 언마운트 시 구독 해제
        }
    }, []);

    // 툴팁 외부 클릭 시 툴팁 숨기기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                tooltipRef.current &&
                !tooltipRef.current.contains(event.target as Node)
            ) {
                // Check if the click target is within the transcript container but not on the selection
                if (
                    transcriptContainerRef.current &&
                    transcriptContainerRef.current.contains(
                        event.target as Node
                    )
                ) {
                    const selection = window.getSelection();
                    if (selection && selection.toString().length === 0) {
                        setShowTooltip(false);
                    }
                } else {
                    setShowTooltip(false);
                }
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // 사용자별 영상 학습 진행 상황 저장 (디바운스 적용)
    useEffect(() => {
        if (!user || !youtubeUrl) return;

        const videoId = youtubeUrl.match(
            /(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        )?.[1];
        if (!videoId) return;

        const saveProgress = async () => {
            if (user && youtubeUrl && currentTime !== undefined) {
                try {
                    const userDocRef = doc(db, "users", user.uid);
                    const historyDocRef = doc(
                        userDocRef,
                        "learningHistory",
                        videoId
                    );
                    await setDoc(
                        historyDocRef,
                        {
                            youtubeUrl: youtubeUrl,
                            lastPlayedTime: currentTime,
                            timestamp: new Date(),
                        },
                        { merge: true }
                    ); // 기존 필드 유지하며 업데이트
                    console.log(
                        `Playback progress saved for ${user.uid} - ${videoId}: ${currentTime}s`
                    );
                } catch (error) {
                    console.error("Error saving playback progress:", error);
                }
            }
        };

        // Debounce saving to avoid excessive writes
        const handler = setTimeout(() => {
            saveProgress();
        }, 3000); // 3초 후에 저장

        return () => {
            clearTimeout(handler);
        };
    }, [currentTime, youtubeUrl, user]);

    // 페이지 떠날 때 마지막 재생 시간 저장 (onBeforeUnload)
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (user && youtubeUrl && currentTime !== undefined) {
                const videoId = youtubeUrl.match(
                    /(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
                )?.[1];
                if (!videoId) return;

                const userDocRef = doc(db, "users", user.uid);
                const historyDocRef = doc(
                    userDocRef,
                    "learningHistory",
                    videoId
                );
                // Use navigator.sendBeacon or a synchronous fetch to ensure data is sent before unload
                // sendBeacon is preferred for non-critical data on unload
                const dataToSave = JSON.stringify({
                    youtubeUrl: youtubeUrl,
                    lastPlayedTime: currentTime,
                    timestamp: new Date().toISOString(), // Convert Date to ISO string for sendBeacon
                });
                // For sendBeacon, we need a separate API route if Firestore direct write is not possible.
                // For simplicity, we'll make a final async save for now, understanding it might not always complete.
                // A dedicated API route for this would be better for reliability.
                setDoc(historyDocRef, JSON.parse(dataToSave), {
                    merge: true,
                }).catch((error) => {
                    console.error("Error saving on unload:", error);
                });
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [currentTime, youtubeUrl, user]);

    // --- 이벤트 핸들러 ---
    // 영상 시간 이동 핸들러
    const handleSeek = (seconds: number) => {
        if (playerRef.current) {
            playerRef.current.seekTo(seconds, "seconds");
            setIsPlaying(true); // 이동 후 재생 시작
        }
    };

    // 텍스트 선택 핸들러 (툴팁 표시 로직)
    const handleSelection = (e: React.MouseEvent) => {
        const selection = window.getSelection();

        // 이전에 설정된 타이머가 있다면 초기화
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
        }

        if (selection && selection.toString().length > 0) {
            const selectedText = selection.toString().trim();
            setTooltipText(selectedText);

            // Find the full sentence that contains the selectedText from the rendered elements
            let foundFullSentence: string = "";
            if (transcriptContainerRef.current) {
                for (
                    let i = 0;
                    i < transcriptContainerRef.current.children.length;
                    i++
                ) {
                    const pElement = transcriptContainerRef.current.children[
                        i
                    ] as HTMLElement;
                    const paragraphText = pElement.textContent || "";
                    if (paragraphText.includes(selectedText)) {
                        // Remove timestamp from the paragraph text for cleaner context
                        foundFullSentence = paragraphText
                            .replace(/\[\d{2}:\d{2}\]\s*/g, "")
                            .trim();
                        break;
                    }
                }
            }

            // Fallback if no specific paragraph found (should not happen if selection is valid within transcript)
            if (!foundFullSentence && activeSegmentIndex !== -1) {
                foundFullSentence =
                    parsedTranscript[activeSegmentIndex]?.text || selectedText;
            } else if (!foundFullSentence) {
                foundFullSentence = selectedText; // Final fallback
            }
            setSelectedFullSentenceContext(foundFullSentence);

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Calculate tooltip position relative to the transcript container
            if (transcriptContainerRef.current) {
                const containerRect =
                    transcriptContainerRef.current.getBoundingClientRect();
                const xPos = rect.left - containerRect.left + rect.width / 2;
                const yPos = rect.top - containerRect.top - 50;

                tooltipTimeoutRef.current = setTimeout(() => {
                    setTooltipPosition({
                        x: xPos,
                        y: yPos,
                    });
                    setShowTooltip(true);
                }, 500); // 0.5초 지연
            } else {
                setShowTooltip(false);
            }
        } else {
            setShowTooltip(false);
            setTooltipText("");
            setInterpretationResult(null); // 선택 해제 시 결과도 초기화
            setSelectedFullSentenceContext(""); // 선택 해제 시 문맥도 초기화
        }
    };

    // AI 해석 버튼 핸들러 (실제 API 호출로 변경)
    const handleAIInterpretation = async () => {
        if (!tooltipText || !geminiAnalysis || !selectedFullSentenceContext) {
            console.warn("Missing data for AI interpretation request.");
            // Optionally show a user-friendly error message or log.
            return;
        }

        setIsInterpreting(true);
        setShowTooltip(false); // 요청 시작과 함께 툴팁 숨기기
        setInterpretationResult(null); // 이전 결과 초기화

        try {
            const summary = geminiAnalysis.summary;
            const fullSentence = selectedFullSentenceContext; // 명시적으로 찾은 전체 문맥 사용

            const response = await fetch("/api/interpret", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    selectedText: tooltipText,
                    summary,
                    fullSentence,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to interpret text");
            }

            const data = await response.json();
            setInterpretationResult(data.interpretation);
            setTooltipPosition((prev) => ({ ...prev, y: prev.y + 60 })); // 해석 결과 표시를 위해 툴팁 위치 조정
            setShowTooltip(true); // 해석 결과와 함께 툴팁 다시 표시
        } catch (error: any) {
            console.error("AI Interpretation Error:", error);
            setInterpretationResult(`해석 실패: ${error.message}`);
            setTooltipPosition((prev) => ({ ...prev, y: prev.y + 60 })); // 에러 메시지 표시를 위해 툴팁 위치 조정
            setShowTooltip(true); // 에러 메시지와 함께 툴팁 다시 표시
        } finally {
            setIsInterpreting(false);
        }
    };

    // 툴팁 닫기 핸들러
    const handleCloseTooltip = () => {
        setShowTooltip(false);
        setTooltipText("");
        setInterpretationResult(null);
    };

    // 해석 결과 저장 핸들러
    const handleSaveInterpretation = async () => {
        if (!user || !tooltipText || !interpretationResult || !youtubeUrl) {
            alert("저장할 데이터가 부족합니다.");
            return;
        }

        try {
            const interpretationId = `interpret_${Date.now()}`;
            const userDocRef = doc(db, "users", user.uid);
            const savedInterpretationsCollectionRef = collection(
                userDocRef,
                "savedInterpretations"
            );
            const interpretationDocRef = doc(
                savedInterpretationsCollectionRef,
                interpretationId
            );

            await setDoc(interpretationDocRef, {
                originalText: tooltipText,
                interpretation: interpretationResult,
                youtubeUrl: youtubeUrl,
                timestamp: new Date(),
            });
            alert("해석 결과가 성공적으로 저장되었습니다!");
            setShowTooltip(false);
            setInterpretationResult(null);
            setTooltipText("");
        } catch (error) {
            console.error("해석 결과 저장 중 오류 발생:", error);
            alert("해석 결과 저장에 실패했습니다.");
        }
    };

    // Google 로그인
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

    // Google 로그아웃
    const handleGoogleSignOut = async () => {
        if (!auth) {
            setError("Firebase Auth not initialized.");
            return;
        }
        try {
            await signOut(auth);
            // 로그아웃 시 상태 초기화
            setGeminiAnalysis(null);
            setTranscript("");
            setYoutubeUrl("");
            setCurrentTime(0);
            setActiveTab("analysis");
            setIsConversationModeActive(false); // 모달 닫기
        } catch (err: unknown) {
            let errorMessage = "Google Sign-Out failed.";
            if (err instanceof Error) {
                errorMessage += `: ${err.message}`;
            }
            setError(errorMessage);
        }
    };

    // 영상 URL 제출 및 분석 요청
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (youtubeUrl.trim() === "") {
            setError(""); // URL이 비어있으면 에러 메시지 초기화
            setLoading(false);
            return;
        }

        // YouTube URL 유효성 검사
        const youtubeRegex =
            /^(https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S+)?)$/;
        if (!youtubeRegex.test(youtubeUrl)) {
            setError("유효한 YouTube 영상 URL을 입력해주세요.");
            setLoading(false);
            return;
        }

        // 상태 초기화 및 로딩 시작
        setLoading(true);
        setGeminiAnalysis(null);
        setTranscript("");
        setError("");
        setCurrentTime(0);
        setActiveTab("analysis");
        setIsConversationModeActive(false); // 분석 중에는 모달 비활성화
        setYoutubeTitle(null); // 새로운 분석 시작 시 제목 초기화

        // 로그인 확인
        if (!user) {
            window.alert("로그인 후 이용해주세요.");
            setLoading(false);
            return;
        }

        // Firestore 문서 ID 생성 (URL을 기반으로 고유하게)
        const docId = encodeURIComponent(youtubeUrl).replace(/\./g, "_");

        try {
            const docRef = doc(db, "videoAnalyses", docId);
            const docSnap = await getDoc(docRef);

            // 캐시된 데이터 확인
            if (docSnap.exists()) {
                console.log("Cached data found in Firestore.");
                const cachedData = docSnap.data() as GeminiResponseData;
                setGeminiAnalysis(cachedData.analysis);
                setTranscript(cachedData.transcript_text);
                setLoading(false); // 캐시된 데이터 사용 시 바로 로딩 종료
                return;
            }

            // 캐시된 데이터가 없으면 API 호출
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

            const data: GeminiResponseData & { youtubeTitle?: string } =
                await response.json();
            setGeminiAnalysis(data.analysis);
            if (typeof data.transcript_text === "string") {
                setTranscript(data.transcript_text);
            } else {
                setTranscript(""); // 비정상적인 경우 빈 문자열로 처리
            }
            if (data.youtubeTitle) {
                setYoutubeTitle(data.youtubeTitle);
            }

            // Firestore에 분석 결과 저장
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
        } finally {
            setLoading(false); // 로딩 상태 해제
        }
    };

    // Gemini Live Conversation Hook 사용
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

            {/* 로그인/로그아웃 버튼 */}
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

            {/* YouTube URL 입력 및 분석 버튼 */}
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
                            setGeminiAnalysis(null); // URL 변경 시 이전 분석 결과 초기화
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

            {/* 분석 결과 표시 영역 (URL이 있고, 분석 결과가 있거나 로딩 중일 때) */}
            {youtubeUrl && (geminiAnalysis || loading) && (
                <div className="w-full max-w-6xl bg-white p-8 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:space-x-8">
                    {/* 왼쪽 영역: 영상 플레이어 및 요약 */}
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
                        {youtubeTitle && (
                            <div className="mt-4 mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {youtubeTitle}
                                </h2>
                            </div>
                        )}
                        {geminiAnalysis && (
                            <div className="mt-6 bg-gray-50 p-6 rounded-xl">
                                <h3 className="text-xl font-bold mb-3 flex items-center text-blue-600">
                                    <span className="mr-2">📋</span> 영상 요약
                                </h3>
                                <p className="leading-relaxed text-gray-700">
                                    {geminiAnalysis.summary}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 오른쪽 영역: 분석 결과 상세 보기 또는 AI 대화 */}
                    <div className="w-full lg:w-1/2 flex flex-col h-[600px]">
                        {loading && !geminiAnalysis ? (
                            // 로딩 중일 때 로딩 애니메이션 표시
                            <div className="flex-1 flex justify-center items-center bg-gray-50 rounded-xl">
                                <LoadingAnimation />
                            </div>
                        ) : geminiAnalysis ? (
                            <>
                                {/* 탭 메뉴 */}
                                <div className="flex space-x-2 mb-4 border-b-2 border-gray-100">
                                    {/* 주요 표현 탭 */}
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
                                            📊 주요 표현
                                        </button>
                                    )}
                                    {/* 자막 탭 */}
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
                                    {/* AI 대화 탭 (모달 트리거) */}
                                    <button
                                        className={`px-6 py-3 font-semibold rounded-t-lg transition-all duration-300 ${
                                            activeTab === "questions"
                                                ? "text-white bg-gradient-to-r from-blue-500 to-purple-500 shadow-md transform scale-105"
                                                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                                        }`}
                                        onClick={() => {
                                            setActiveTab("questions");
                                            // AI 대화 모달을 열기 위한 준비
                                            // selectedQuestion은 handleStartConversation에서 설정됨
                                        }}
                                    >
                                        💬 AI 대화
                                    </button>
                                </div>

                                {/* 탭 콘텐츠 영역 */}
                                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 rounded-xl">
                                    {activeTab === "analysis" &&
                                    geminiAnalysis ? (
                                        // 주요 표현 탭 콘텐츠
                                        <div className="text-gray-700 space-y-6">
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
                                        // 자막 탭 콘텐츠
                                        <div
                                            ref={transcriptContainerRef}
                                            className="text-gray-700 space-y-2 relative"
                                            onMouseUp={handleSelection}
                                        >
                                            {parsedTranscript.map(
                                                (segment, index) => {
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
                                            {/* 툴팁 컴포넌트 */}
                                            {showTooltip && (
                                                <div
                                                    ref={tooltipRef}
                                                    className="absolute z-0 bg-black/50 backdrop-blur-lg border border-white/10 text-white text-sm rounded-lg shadow-lg py-2 px-3 flex flex-col space-y-2 max-w-xs min-w-[120px]"
                                                    style={{
                                                        left: tooltipPosition.x,
                                                        top: tooltipPosition.y,
                                                        transform:
                                                            "translateX(-50%)",
                                                    }}
                                                >
                                                    {isInterpreting ? (
                                                        <p>AI가 해석 중...</p>
                                                    ) : interpretationResult ? (
                                                        <div className="flex flex-col space-y-2">
                                                            <p className="text-sm font-bold">
                                                                AI해석
                                                            </p>
                                                            <p className="text-base">
                                                                {
                                                                    interpretationResult
                                                                }
                                                            </p>
                                                            <div className="flex justify-end space-x-2 mt-2">
                                                                <button
                                                                    onClick={
                                                                        handleSaveInterpretation
                                                                    }
                                                                    className="bg-blue-600/75 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-xs"
                                                                >
                                                                    저장
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex space-x-2">
                                                            <button
                                                                onClick={
                                                                    handleAIInterpretation
                                                                }
                                                                className="hover:bg-black/20 px-2 py-1 rounded-md"
                                                            >
                                                                AI 해석
                                                            </button>
                                                            <button
                                                                onClick={
                                                                    handleCloseTooltip
                                                                }
                                                                className="hover:bg-black/20 px-2 py-1 rounded-md"
                                                            >
                                                                X
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : activeTab === "questions" ? (
                                        // AI 대화 탭 콘텐츠 (모달을 띄우기 위한 버튼)
                                        <div className="text-gray-700">
                                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                                <h3 className="text-xl font-bold mb-4 flex items-center text-purple-600">
                                                    <span className="mr-2">
                                                        🤖
                                                    </span>{" "}
                                                    AI 영어 선생님과 대화하기
                                                </h3>
                                                {geminiAnalysis?.main_questions &&
                                                geminiAnalysis.main_questions
                                                    .length > 0 ? (
                                                    <div className="space-y-3">
                                                        <p className="text-gray-600 mb-4">
                                                            아래 주제로 대화를
                                                            시작해보세요:
                                                        </p>
                                                        {geminiAnalysis.main_questions.map(
                                                            (
                                                                question,
                                                                index
                                                            ) => (
                                                                <div
                                                                    key={index}
                                                                    className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg flex items-center justify-between transition-all duration-300 hover:shadow-md"
                                                                >
                                                                    <span className="flex-1 font-medium">
                                                                        {
                                                                            question
                                                                        }
                                                                    </span>
                                                                    <button
                                                                        onClick={() => {
                                                                            setIsConversationModeActive(
                                                                                true
                                                                            ); // 모달 활성화
                                                                            handleStartConversation(
                                                                                question
                                                                            ); // 대화 시작
                                                                        }}
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
                                                            영상을 분석하면 관련
                                                            대화 주제가
                                                            생성됩니다.
                                                        </p>
                                                        <button
                                                            onClick={() => {
                                                                setIsConversationModeActive(
                                                                    true
                                                                ); // 모달 활성화
                                                                handleStartConversation(
                                                                    "Hello! Let's practice English together."
                                                                ); // 자유 대화 시작
                                                            }}
                                                            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
                                                            disabled={
                                                                isRecording ||
                                                                isPlayingAudio
                                                            }
                                                        >
                                                            자유 대화 시작하기
                                                            🎤
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        ) : (
                            // 분석 결과가 없으면 표시되는 메시지
                            <div className="flex-1 flex justify-center items-center bg-gray-50 rounded-xl">
                                <p className="text-gray-500 text-center">
                                    분석 결과가 여기에 표시됩니다 📊
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- AI 대화 모달 렌더링 --- */}
            <ConversationModal
                isOpen={isConversationModeActive}
                onClose={() => {
                    setIsConversationModeActive(false); // 모달 닫기
                    handleStopConversation("modal_close"); // 대화 중지 함수 호출
                }}
                isRecording={isRecording}
                isPlayingAudio={isPlayingAudio}
                selectedQuestion={selectedQuestion}
            />
        </div>
    );
}
