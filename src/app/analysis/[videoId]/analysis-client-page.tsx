"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactPlayer from "react-player";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import {
    doc, getDoc, setDoc, collection, addDoc, query,
    where, getDocs, deleteDoc, orderBy, updateDoc, increment
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

// 타입을 export하여 다른 파일(page.tsx)에서 재사용 가능하게 함
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

// 컴포넌트가 받을 props 타입 정의
interface AnalysisPageComponentProps {
    initialAnalysisData: GeminiResponseData | null;
}

const processTranscript = (data: GeminiResponseData): GeminiResponseData => {
    if (data.transcript_text && typeof data.transcript_text === "string") {
        data.transcript_text = data.transcript_text.replace(/\\n/g, "\n");
    }
    return data;
};

function AnalysisPageComponent({ initialAnalysisData }: AnalysisPageComponentProps) {
    const params = useParams();
    const router = useRouter();
    const videoId = params.videoId as string;

    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authInitialized, setAuthInitialized] = useState(false);
    
    // 1. [개선] state를 서버에서 받은 props로 초기화
    const [analysisData, setAnalysisData] = useState<GeminiResponseData | null>(
        initialAnalysisData ? processTranscript(initialAnalysisData) : null
    );
    // 2. [개선] 로딩 상태는 초기 데이터가 없을 때만 true
    const [loading, setLoading] = useState(!initialAnalysisData);
    const [error, setError] = useState("");

    // --- 나머지 state 선언 (기존과 동일) ---
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [alertModalContent, setAlertModalContent] = useState({ title: "", subtitle: "", buttons: [] as any[] });
    const playerRef = useRef<ReactPlayer>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isConversationModeActive, setIsConversationModeActive] = useState(false);
    const [activeTab, setActiveTab] = useState<"analysis" | "transcript" | "questions">("transcript");
    const [savedExpressions, setSavedExpressions] = useState<SavedExpression[]>([]);
    const [isLooping, setIsLooping] = useState(false);
    const [loopStartTime, setLoopStartTime] = useState<number | null>(null);
    const [loopEndTime, setLoopEndTime] = useState<number | null>(null);

    // AI 대화 기능 사용 가능 여부 확인
    const canUseAIConversation = userProfile ? PLANS[userProfile.plan].aiConversation : false;

    // --- Hooks (기존과 동일) ---
    const { isRecording, isPlayingAudio, selectedQuestion, handleStartConversation, handleStopConversation } = useGeminiLiveConversation({
        transcript: analysisData?.transcript_text || "",
        geminiAnalysis: analysisData?.analysis ?? null,
        setError,
        onConversationStart: () => {
            if (!canUseAIConversation) {
                setToastMessage("AI 대화는 Plus 등급 이상부터 사용 가능합니다.");
                setShowToast(true);
                return;
            }
            setIsConversationModeActive(true);
        },
        setActiveTab: setActiveTab,
        videoId: videoId,
        user: user,
    });
    
    // --- useEffect Hooks (로직 수정 및 분리) ---

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

    // 3. [개선] 새로운 분석 데이터 로딩 로직 (초기 데이터 없을 때만 실행)
    useEffect(() => {
        // 서버에서 데이터를 받아왔으면, 클라이언트에서 다시 fetch할 필요 없음
        if (initialAnalysisData) return;

        let isMounted = true;
        
        const loadNewAnalysis = async () => {
            // 필수 조건 확인
            if (!isMounted || !videoId || !authInitialized) return;

            // 로그인 상태가 아니면 더 이상 진행하지 않음 (프로필 필요)
            if (!user || !userProfile) {
                if(authInitialized) { // 인증 상태 확인이 끝난 후에만 리디렉션
                    setIsRedirecting(true);
                    setToastMessage("이 영상은 로그인 후 분석할 수 있습니다.");
                    setShowToast(true);
                    router.push("/");
                }
                return;
            }

            setLoading(true);
            setError("");

            try {
                // 사용량 및 영상 길이 제한 확인
                const plan = PLANS[userProfile.plan];
                const today = new Date().toISOString().split("T")[0];
                if (userProfile.usage.lastAnalysisDate === today && userProfile.usage.analysisCount >= plan.dailyAnalysisLimit) {
                    setError(`오늘의 분석 횟수(${userProfile.usage.analysisCount}/${plan.dailyAnalysisLimit}회)를 모두 사용하셨습니다.`);
                    return;
                }

                const metaRes = await fetch(`/api/youtube-data?videoId=${videoId}`);
                if (!metaRes.ok) throw new Error( (await metaRes.json()).error || "영상 정보 로딩 실패");
                const metaData = await metaRes.json();

                if (metaData.duration > plan.maxVideoDuration) {
                    setError(`${plan.name} 등급은 ${Math.floor(plan.maxVideoDuration / 60)}분 이하 영상만 분석 가능합니다.`);
                    return;
                }

                // 분석 횟수 차감 및 API 호출
                const userDocRef = doc(db, "users", user.uid);
                await updateDoc(userDocRef, { "usage.analysisCount": increment(1), "usage.lastAnalysisDate": today });

                const transcriptRes = await fetch("/api/transcript", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`, userId: user.uid }),
                });

                if (!transcriptRes.ok) {
                    await updateDoc(userDocRef, { "usage.analysisCount": increment(-1) });
                    throw new Error((await transcriptRes.json()).error || "영상 분석에 실패했습니다.");
                }

                const newAnalysisData = await transcriptRes.json();
                const finalData = processTranscript({ ...newAnalysisData, ...metaData });
                
                if (isMounted) setAnalysisData(finalData);

                // 결과 캐싱 및 로그 저장
                await setDoc(doc(db, "videoAnalyses", videoId), { ...finalData, timestamp: new Date().toISOString() });
                await addDoc(collection(db, "videoActivityLogs"), { videoId, activityType: "ANALYSIS_SUCCESS", userId: user.uid, timestamp: new Date().toISOString(), youtubeTitle: metaData.youtubeTitle, duration: metaData.duration });

            } catch (err: any) {
                if (isMounted) setError(err.message || "알 수 없는 오류가 발생했습니다.");
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        
        loadNewAnalysis();
        
        return () => { isMounted = false; };
    }, [videoId, user, userProfile, authInitialized, router, initialAnalysisData]);

    // [유지] 저장된 표현 불러오기
    useEffect(() => {
        if (!user || !videoId || !analysisData) {
            setSavedExpressions([]);
            return;
        }
        const fetchSavedExpressions = async () => {
            const q = query(collection(db, `users/${user.uid}/savedInterpretations`), where("videoId", "==", videoId), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            const expressions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SavedExpression[];
            setSavedExpressions(expressions);
        };
        fetchSavedExpressions();
    }, [user, videoId, analysisData]);

    // [유지] 구간 반복 로직
    useEffect(() => {
        if (isLooping && loopStartTime !== null && loopEndTime !== null && loopStartTime < loopEndTime) {
            if (currentTime >= loopEndTime || currentTime < loopStartTime) {
                playerRef.current?.seekTo(loopStartTime, "seconds");
            }
        }
    }, [currentTime, isLooping, loopStartTime, loopEndTime]);

    // --- 핸들러 함수들 (기존과 거의 동일) ---
    const handleAddExpression = async (newExpressionData: Omit<SavedExpression, "id">) => {
        if (!user) { setToastMessage("표현을 저장하려면 로그인이 필요합니다."); setShowToast(true); return; }
        try {
            const docRef = await addDoc(collection(db, `users/${user.uid}/savedInterpretations`), newExpressionData);
            setSavedExpressions(prev => [{ id: docRef.id, ...newExpressionData }, ...prev]);
            setToastMessage("표현이 성공적으로 저장되었습니다!");
            setShowToast(true);
        } catch (error) {
            console.error("표현 저장 중 오류:", error);
            setToastMessage("표현 저장에 실패했습니다.");
            setShowToast(true);
        }
    };
    
    const handleDeleteExpression = async (expressionId: string) => {
        // ... 기존 코드와 동일 ...
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

    // --- 렌더링 로직 ---
    if (isRedirecting) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <LoadingAnimation />
                <p className="text-gray-600 text-center mt-4">메인 페이지로 이동 중...</p>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen flex flex-col items-center py-4 bg-gradient-to-br from-blue-50 to-purple-50">
          
            {loading && <LoadingAnimation />}
            
            {error && !loading && (
                <p className="text-red-500 text-lg mt-4 text-center p-4 bg-red-100 rounded-lg w-full max-w-6xl mx-auto px-4">
                    ⚠️ {error}
                </p>
            )}

            {analysisData && !loading && (
                <div className="w-full max-w-6xl bg-white p-3 md:p-6 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:space-x-8 mt-4 mx-auto">
                    <VideoPlayer
                        url={`https://www.youtube.com/watch?v=${videoId}`}
                        title={analysisData.youtubeTitle || "영상 제목"}
                        summary={analysisData.analysis.summary}
                        playerRef={playerRef}
                        isPlaying={isPlaying}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        onProgress={(state) => setCurrentTime(state.playedSeconds)}
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
                onClose={() => { setIsConversationModeActive(false); handleStopConversation("modal_close"); }}
                isRecording={isRecording}
                isPlayingAudio={isPlayingAudio}
                selectedQuestion={selectedQuestion}
            />

            <Toast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />

            {showAlertModal && (
                <Alert title={alertModalContent.title} subtitle={alertModalContent.subtitle} buttons={alertModalContent.buttons} onClose={() => setShowAlertModal(false)} />
            )}
        </div>
    );
}

// Wrapper 컴포넌트는 props를 받아서 내부 컴포넌트로 전달하는 역할
export default function AnalysisPageWrapper({ initialAnalysisData }: AnalysisPageComponentProps) {
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <AnalysisPageComponent initialAnalysisData={initialAnalysisData} />
        </Suspense>
    );
}