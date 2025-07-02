// src/lib/useGeminiLiveConversation.ts

import { useState, useRef, useEffect } from "react";
import {
    GoogleGenAI,
    Modality,
    Session,
    LiveServerMessage,
} from "@google/genai";
import { AudioPlaybackScheduler } from "./AudioPlaybackScheduler";
import { User } from "firebase/auth";

// 타입 정의
interface VideoAnalysis {
    summary: string;
    keywords: string[];
    slang_expressions: SlangExpression[];
    main_questions: string[];
}
interface SlangExpression {
    expression: string;
    meaning: string;
}

// [수정] UseGeminiLiveConversationProps 인터페이스 정리
interface UseGeminiLiveConversationProps {
    transcript: string;
    geminiAnalysis: VideoAnalysis | null;
    setError: (message: string) => void;
    setActiveTab: (tab: "analysis" | "transcript" | "questions") => void;
    videoId: string;
    onConversationStart: () => boolean; // 시작 가능 여부를 boolean으로 반환받는 콜백
    onConversationEnd: (durationInSeconds: number) => void; // 대화 종료 콜백
    sessionTimeLimit: number; // 1회 대화 제한 시간
    user: User | null;
    onShowAlert: (config: {
        title: string;
        subtitle: string;
        buttons: { text: string; onClick: () => void; isPrimary?: boolean }[];
    }) => void;
}

interface UseGeminiLiveConversationResult {
    isRecording: boolean;
    isConnecting: boolean; 
    isPlayingAudio: boolean;
    selectedQuestion: string | null;
    handleStartConversation: (question: string) => Promise<void>;
    handleStopConversation: (callerId?: string) => Promise<void>;
}

export const useGeminiLiveConversation = ({
    transcript,
    geminiAnalysis,
    setError,
    setActiveTab,
    onConversationEnd,
    sessionTimeLimit,
    onConversationStart,
    videoId,
    user,
    onShowAlert,
}: UseGeminiLiveConversationProps): UseGeminiLiveConversationResult => {
    const [isConnecting, setIsConnecting] = useState(false); 
    const [isRecording, setIsRecording] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [geminiLiveSession, setGeminiLiveSession] = useState<Session | null>(
        null
    );
    const [selectedQuestion, setSelectedQuestion] = useState<string | null>(
        null
    );

    const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
    const conversationStartTimeRef = useRef<number | null>(null);
    const isStoppingRef = useRef(false); // 중복 실행을 막기 위한 플래그
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);

    const playbackScheduler = useRef<AudioPlaybackScheduler | null>(null);
    const audioPlayingTimer = useRef<NodeJS.Timeout | null>(null);

    const handleStopConversation = (callerId?: string): Promise<void> => {
        return new Promise((resolve) => {
        if (isStoppingRef.current) {
            console.log(`Stop process already initiated. Called by: ${callerId}`);
            resolve();
            return;
        }
        isStoppingRef.current = true;
        console.log(`handleStopConversation called from: ${callerId || "unknown"}`);
        setIsRecording(false);
        setIsPlayingAudio(false);

        if (audioWorkletNodeRef.current) {
            audioWorkletNodeRef.current.port.onmessage = null;
            audioWorkletNodeRef.current.disconnect();
            audioWorkletNodeRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }

        if (
            audioContextRef.current &&
            audioContextRef.current.state !== "closed"
        ) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        // 타이머 및 시간 기록 정리 로직 순서 및 내용 확인
        if (sessionTimerRef.current) {
            clearTimeout(sessionTimerRef.current);
            sessionTimerRef.current = null;
        }

        if (conversationStartTimeRef.current) {
            const duration = (Date.now() - conversationStartTimeRef.current) / 1000;
            onConversationEnd(Math.round(duration));
            conversationStartTimeRef.current = null;
        }

        
       
        if (playbackScheduler.current) {
            playbackScheduler.current.stop();
            playbackScheduler.current = null;
        }
        if (geminiLiveSession) {
            try {
                geminiLiveSession.close();
            } catch (e) {
                console.warn("Session might be already closed.", e);
            }
            setGeminiLiveSession(null);
        }
        if (audioPlayingTimer.current) {
            clearTimeout(audioPlayingTimer.current);
        }


        setTimeout(() => {
           
            console.log("Stop process finished.");
                resolve();
                isStoppingRef.current = false;
        }, 100); 
    });
};

    const handleStartConversation = async (question: string) => {
       
        if (isConnecting || isRecording) {
            console.log("Conversation start requested, but already connecting or recording.");
            return;
        }

       
        try {
            setIsConnecting(true); // << 연결 시작 상태로 설정
            setSelectedQuestion(question);
            setActiveTab("questions");
            setError("");
    
            // [수정] onConversationStart 콜백의 반환값을 확인하여 시작 여부 결정
            if (onConversationStart) {
                const canStart = onConversationStart();
                if (!canStart) {
                    return; // 대화를 시작할 수 없으면 여기서 즉시 중단
                }
            }

            // [수정] 대화 시작 시간 기록 및 자동 종료 타이머 설정
            conversationStartTimeRef.current = Date.now();
            sessionTimerRef.current = setTimeout(() => {
                handleStopConversation('session_timeout');
            }, sessionTimeLimit * 1000); // 밀리초로 변환

            console.log("1. Fetching token...");
            const tokenRes = await fetch("/api/gemini-live-token");
            if (!tokenRes.ok)
                throw new Error("Failed to fetch ephemeral token");
            const { token } = await tokenRes.json();

            console.log("2. Requesting microphone...");
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            mediaStreamRef.current = stream;

            const genai = new GoogleGenAI({
                apiKey: token,
                httpOptions: { apiVersion: "v1alpha" },
            });
            const newSession = await genai.live.connect({
                model: "gemini-2.5-flash-preview-native-audio-dialog",
                config: {
                    responseModalities: [Modality.AUDIO],
                },
                callbacks: {
                    onopen: async () => {
                        console.log(
                            "4. Session opened. Initializing AudioWorklet..."
                        );
                        playbackScheduler.current =
                            new AudioPlaybackScheduler();

                        const context = new window.AudioContext();
                        audioContextRef.current = context;

                        try {
                            await context.audioWorklet.addModule(
                                "/pcm-processor.js"
                            );
                        } catch (e) {
                            console.error(
                                "Failed to load AudioWorklet module",
                                e
                            );
                            setError("오디오 처리 모듈 로드 실패.");
                            await handleStopConversation("worklet_load_error");
                            return;
                        }

                        const microphoneSource =
                            context.createMediaStreamSource(stream);
                        const pcmProcessorNode = new AudioWorkletNode(
                            context,
                            "pcm-processor",
                            {
                                processorOptions: { targetSampleRate: 16000 },
                            }
                        );
                        audioWorkletNodeRef.current = pcmProcessorNode;

                        pcmProcessorNode.port.onmessage = (event) => {
                            const pcmData = event.data as Int16Array;
                            if (pcmData.length > 0 && newSession) {
                                const base64Audio = btoa(
                                    String.fromCharCode(
                                        ...new Uint8Array(pcmData.buffer)
                                    )
                                );
                                // @ts-ignore
                                newSession.sendRealtimeInput({
                                    audio: {
                                        data: base64Audio,
                                        mimeType: "audio/pcm;rate=16000",
                                    },
                                });
                            }
                        };

                        microphoneSource.connect(pcmProcessorNode);
                        setIsRecording(true);
                        setIsConnecting(false); //
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const parts = message.serverContent?.modelTurn?.parts;
                        if (parts) {
                            for (const part of parts) {
                                if (part.inlineData?.data) {
                                    setIsPlayingAudio(true);
                                    playbackScheduler.current?.add(
                                        part.inlineData.data
                                    );

                                    if (audioPlayingTimer.current)
                                        clearTimeout(audioPlayingTimer.current);
                                    audioPlayingTimer.current = setTimeout(
                                        () => setIsPlayingAudio(false),
                                        1200
                                    );
                                }
                            }
                        }
                    },
                    onerror: (e) => {
                        console.error("Gemini Live Error:", e);
                        setError(`An error occurred: ${e.message}`);
                        handleStopConversation("gemini.onerror");
                        setIsConnecting(false);
                    },
                    onclose: (e) => {
                        console.log("Gemini Live session closed:", e.reason);
                        handleStopConversation("gemini.onclose");
                        setIsConnecting(false);
                    },
                },
            });

            console.log("3. Connecting to Gemini Live...");
            setGeminiLiveSession(newSession);

            const initialPromptText =
                transcript && geminiAnalysis
                    ? `Act as my English coach: start by asking me "${question}" based on the video "${transcript}, and then keep the conversation going with only follow-up questions, never answering the question yourself. KEEP ASKING question so that user can practice English speaking "`
                    : `You are an English learning assistant. Your role is to help the user learn English by having a conversation. The user will now answer this question: "${question}"`;

            newSession.sendClientContent({
                turns: [{ role: "user", parts: [{ text: initialPromptText }] }],
            });
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            console.error("Error starting conversation:", errorMessage);
            setError(errorMessage);
            await handleStopConversation("startConversation.catch");
        }finally {
            // [중요] 성공, 실패, 취소 등 모든 경우에 isConnecting을 false로 설정
            setIsConnecting(false);
        }
    };

  
    return {
        isConnecting,
        isRecording,
        isPlayingAudio,
        selectedQuestion,
        handleStartConversation,
        handleStopConversation,
    };
};