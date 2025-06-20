// src/lib/useGeminiLiveConversation.ts

import { useState, useRef, useEffect } from "react";
import {
    GoogleGenAI,
    Modality,
    Session,
    LiveServerMessage,
} from "@google/genai";
import { AudioPlaybackScheduler } from "./AudioPlaybackScheduler";

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
interface UseGeminiLiveConversationProps {
    transcript: string;
    geminiAnalysis: VideoAnalysis | null;
    setError: (message: string) => void;
    setActiveTab: (tab: "analysis" | "transcript" | "questions") => void;
}
interface UseGeminiLiveConversationResult {
    isRecording: boolean;
    isPlayingAudio: boolean;
    selectedQuestion: string | null;
    handleStartConversation: (question: string) => Promise<void>;
    handleStopConversation: (callerId?: string) => void;
}

export const useGeminiLiveConversation = ({
    transcript,
    geminiAnalysis,
    setError,
    setActiveTab,
}: UseGeminiLiveConversationProps): UseGeminiLiveConversationResult => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [geminiLiveSession, setGeminiLiveSession] = useState<Session | null>(
        null
    );
    const [selectedQuestion, setSelectedQuestion] = useState<string | null>(
        null
    );

    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);

    const playbackScheduler = useRef<AudioPlaybackScheduler | null>(null);
    const audioPlayingTimer = useRef<NodeJS.Timeout | null>(null);

    const handleStopConversation = (callerId?: string) => {
        console.log(
            `handleStopConversation called from: ${callerId || "unknown"}`
        );
        setIsRecording(false);
        setIsPlayingAudio(false);

        if (audioWorkletNodeRef.current) {
            audioWorkletNodeRef.current.disconnect();
            audioWorkletNodeRef.current.port.onmessage = null;
            audioWorkletNodeRef.current = null;
        }
        if (
            audioContextRef.current &&
            audioContextRef.current.state !== "closed"
        ) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
        if (playbackScheduler.current) {
            playbackScheduler.current.stop();
            playbackScheduler.current = null;
        }
        if (geminiLiveSession) {
            try {
                geminiLiveSession.sendRealtimeInput({ audioStreamEnd: true });
                geminiLiveSession.close();
            } catch (e) {
                console.warn("Session might be already closed.", e);
            }
            setGeminiLiveSession(null);
        }
        if (audioPlayingTimer.current) {
            clearTimeout(audioPlayingTimer.current);
        }
    };

    const handleStartConversation = async (question: string) => {
        if (isRecording) {
            handleStopConversation("startNewConversation");
        }
        setSelectedQuestion(question);
        setActiveTab("questions");
        setError("");

        try {
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
                apiVersion: "v1alpha",
            });
            const newSession = await genai.live.connect({
                model: "gemini-2.5-flash-preview-native-audio-dialog",
                // ★★★★★ 타입 오류 수정: 'inputAudio' 제거 ★★★★★
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
                            handleStopConversation("worklet_load_error");
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

                                // ★★★★★ 라이브러리 버그 우회: @ts-ignore를 사용하여 mimeType 강제 전송 ★★★★★
                                // @ts-ignore - The JS SDK requires mimeType, but the TS types are incorrect.
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
                    },
                    onclose: (e) => {
                        console.log("Gemini Live session closed:", e.reason);
                        handleStopConversation("gemini.onclose");
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
            handleStopConversation("startConversation.catch");
        }
    };

    useEffect(() => {
        return () => handleStopConversation("useEffect_cleanup");
    }, []);

    return {
        isRecording,
        isPlayingAudio,
        selectedQuestion,
        handleStartConversation,
        handleStopConversation,
    };
};
