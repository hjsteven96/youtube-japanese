'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import ReactPlayer from 'react-player';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { GoogleGenAI, Modality, Session, LiveServerMessage } from '@google/genai';

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

// Blob_2 타입 가드를 위한 임시 인터페이스 정의 (실제 Blob_2는 genai.d.ts에 있음)
interface Blob_2_temp {
  mimeType?: string;
  data?: string;
}

// message.data가 Blob_2 타입인지 확인하는 타입 가드 함수
function isBlob2(data: any): data is Blob_2_temp {
  return data && typeof data === 'object' && 'mimeType' in data && 'data' in data;
}

// Image 컴포넌트는 사용되지 않으므로 제거했습니다.
// import Image from "next/image";

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [geminiAnalysis, setGeminiAnalysis] = useState<VideoAnalysis | null>(null);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'analysis' | 'transcript' | 'questions'>('analysis');
  const [user, setUser] = useState<User | null>(null);

  // New states for live audio conversation
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [geminiLiveSession, setGeminiLiveSession] = useState<Session | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  const playerRef = useRef<ReactPlayer>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null); // To store the MediaStream for cleanup

  // For Gemini Live Audio Playback
  const audioQueue = useRef<string[]>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const parsedTranscript = useMemo(() => {
    const safeTranscript = String(transcript || '');

    const lines = safeTranscript.split('\n').filter(line => line.trim() !== '');

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
        (currentSegment as VideoSegment).text += ' ' + line.trim();
      }
    });

    if (currentSegment) {
      parsed.push(currentSegment as VideoSegment);
    }

    if (parsed.length === 0 && safeTranscript.trim() !== '') {
      const cleanedText = safeTranscript.trim().replace(/^\[(\d{2}):(\d{2})\]/g, '').trim();
      if (cleanedText) {
        parsed.push({ time: 0, text: cleanedText });
      }
    }
    return parsed;
  }, [transcript]);

  const activeSegmentIndex = useMemo(() => {
    return parsedTranscript.findIndex((segment, index) => {
      const nextSegment = parsedTranscript[index + 1];
      const isActive = currentTime >= segment.time && (!nextSegment || currentTime < nextSegment.time);
      return isActive;
    });
  }, [currentTime, parsedTranscript]);

  useEffect(() => {
    if (activeSegmentIndex === -1 || !transcriptContainerRef.current) {
      return;
    }

    const activeSegmentElement = transcriptContainerRef.current.children[activeSegmentIndex] as HTMLElement;

    if (activeSegmentElement) {
      activeSegmentElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSegmentIndex]);

  const handleSeek = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, 'seconds');
      setIsPlaying(true);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setError('Firebase Auth not initialized.');
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      let errorMessage = 'Google Sign-In failed.';
      if (err instanceof Error) {
        errorMessage += `: ${err.message}`;
      }
      setError(errorMessage);
    }
  };

  const handleGoogleSignOut = async () => {
    if (!auth) {
      setError('Firebase Auth not initialized.');
      return;
    }
    try {
      await signOut(auth);
      setGeminiAnalysis(null);
      setTranscript('');
      setYoutubeUrl('');
      setCurrentTime(0);
      setActiveTab('analysis');
    } catch (err: unknown) {
      let errorMessage = 'Google Sign-Out failed.';
      if (err instanceof Error) {
        errorMessage += `: ${err.message}`;
      }
      setError(errorMessage);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeminiAnalysis(null);
    setTranscript('');
    setError('');
    setCurrentTime(0);
    setActiveTab('analysis'); // Reset to analysis tab on new submission

    try {
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ youtubeUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch analysis');
      }

      const data: GeminiResponseData = await response.json();
      setGeminiAnalysis(data.analysis);
      if (typeof data.transcript_text === 'string') {
        setTranscript(data.transcript_text);
        console.log("Received transcript_text:", data.transcript_text);
      } else {
        setTranscript('');
        console.log("Received non-string transcript_text:", data.transcript_text);
      }
    } catch (err: unknown) {
      let errorMessage = 'An unknown error occurred';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleStopConversation = () => {
    console.log("handleStopConversation called.");
    console.log("Current mediaRecorder state:", mediaRecorder);
    console.log("Current mediaStreamRef.current state:", mediaStreamRef.current);

    audioChunks.current = [];
    setIsRecording(false);
    setSelectedQuestion(null);
    setIsSpeaking(false); // Stop AI speaking indicator

    // MediaRecorder와 MediaStream 트랙을 명시적으로 중지
    console.log("Attempting to stop MediaRecorder and MediaStream.");
    if (mediaRecorder) {
      console.log("Stopping MediaRecorder instance...");
      mediaRecorder.stop(); // This should stop the MediaRecorder
      // The onstop callback will also be triggered, which sends audioStreamEnd.
      // Moved audioStreamEnd to be sent directly in handleStopConversation
      // if (geminiLiveSession) {
      //   console.log("Sending audioStreamEnd to Gemini Live.");
      //   geminiLiveSession.sendRealtimeInput({ audioStreamEnd: true });
      // }
      setMediaRecorder(null); // Nullify recorder state immediately after stopping
    }
    
    // Ensure MediaStream tracks are stopped.
    // This is crucial for releasing microphone access.
    if (mediaStreamRef.current) {
        console.log("Stopping MediaStream tracks...");
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null; // Nullify stream ref
    }

    // Close Gemini Live session
    if (geminiLiveSession) {
        console.log("Closing Gemini Live session...");
        geminiLiveSession.close(); // Explicitly close the session
        setGeminiLiveSession(null); // Nullify session state
        // Send audioStreamEnd when conversation explicitly stopped by user
        // This needs to be sent before closing the session to ensure it's received.
        console.log("Sending audioStreamEnd to Gemini Live due to explicit stop.");
        geminiLiveSession.sendRealtimeInput({ audioStreamEnd: true });
    }

    // Close AudioContext
    if (audioContext.current) {
        console.log("Closing AudioContext...");
        audioContext.current.close();
        audioContext.current = null;
    }
    
    audioQueue.current = []; // Clear any pending audio in queue
    setIsPlayingAudio(false); // Stop audio playback indicator
    console.log("Conversation stopped and all resources cleaned up.");
  };

  const handleStartConversation = async (question: string) => {
    setSelectedQuestion(question);
    setActiveTab('questions'); // Ensure questions tab is active
    setError('');
    setIsSpeaking(false);
    if (!transcript || !geminiAnalysis) {
      console.error("Transcript or Gemini Analysis not available.");
      return;
    }

    try {
      // 1. Get ephemeral token from backend
      console.log("Fetching ephemeral token...");
      const tokenRes = await fetch("/api/gemini-live-token");
      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        throw new Error(`Failed to fetch ephemeral token: ${tokenRes.status} ${errorText}`);
      }
      const { token } = await tokenRes.json();
      console.log("Ephemeral token fetched.");

      // 2. Request microphone access
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      console.log("Microphone access granted.");

      // 3. Initialize MediaRecorder and start recording
      console.log("Initializing MediaRecorder...");
      // Use audio/webm as it's a common format for MediaRecorder, but we'll convert to PCM before sending.
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      setMediaRecorder(recorder);

      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log(`Audio data available from MediaRecorder: ${event.data.size} bytes, mimeType: ${event.data.type}`);
          if (geminiLiveSession) {
            try {
              // Create an AudioContext if not already created (for input processing too)
              // Ensure audioContext.current is not closed by playback
              if (!audioContext.current || audioContext.current.state === 'closed') {
                audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                console.log("AudioContext created for audio input processing.");
              }

              // Decode the audio blob from MediaRecorder (e.g., webm/opus)
              const arrayBuffer = await event.data.arrayBuffer();
              const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);

              // Resample and convert to 16-bit PCM at 16kHz
              const targetSampleRate = 16000;
              const numberOfChannels = audioBuffer.numberOfChannels; // Maintain original channels
              
              // Create an OfflineAudioContext for resampling
              const offlineContext = new OfflineAudioContext(
                numberOfChannels,
                audioBuffer.duration * targetSampleRate,
                targetSampleRate
              );

              const source = offlineContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(offlineContext.destination);
              source.start();

              const renderedBuffer = await offlineContext.startRendering();

              // Get raw PCM data (Float32Array) and convert to Int16Array
              const pcmData = renderedBuffer.getChannelData(0); // Get data from the first channel (assuming mono if only one channel needed)
              
              // Convert Float32 to Int16
              const int16Array = new Int16Array(pcmData.length);
              for (let i = 0; i < pcmData.length; i++) {
                int16Array[i] = Math.max(-1, Math.min(1, pcmData[i])) * 0x7FFF; // Scale float to int16 range
              }

              // Convert Int16Array to Base64 string
              // Using a DataView to handle byte order (little-endian for PCM)
              const dataView = new DataView(new ArrayBuffer(int16Array.length * 2));
              for (let i = 0; i < int16Array.length; i++) {
                  dataView.setInt16(i * 2, int16Array[i], true); // true for little-endian
              }
              const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(dataView.buffer))));

              await geminiLiveSession.sendRealtimeInput({
                audio: { data: base64Audio, mimeType: `audio/pcm;rate=${targetSampleRate}` }, // Send as PCM
              });
              console.log("Sent converted PCM audio data to Gemini Live API. Base64 Length:", base64Audio.length, "bytes.");

            } catch (conversionError) {
              console.error("Error converting or sending audio data to Gemini Live:", conversionError);
            }
          }
        }
      };

      recorder.onstop = () => {
        console.log("MediaRecorder stopped.");
        // Optional: Send audioStreamEnd when recording stops for good (e.g., if user clicks stop)
        if (geminiLiveSession) {
          console.log("Sending audioStreamEnd to Gemini Live.");
          geminiLiveSession.sendRealtimeInput({ audioStreamEnd: true });
        }
      };

      // 4. Connect to Gemini Live API
      console.log("Connecting to Gemini Live API...");
      const genai = new GoogleGenAI({ apiKey: token, apiVersion: "v1alpha" });
      const newSession = await genai.live.connect({
        model: "gemini-2.5-flash-preview-native-audio-dialog", // Changed model for native audio output
        callbacks: {
          onopen: () => {
            console.log("Gemini Live session opened.");
            setIsRecording(true);
            recorder.start(1000); // Start recording and collect 1-second chunks
            console.log("Recording started for Gemini Live.");
          },
          onmessage: async (message: LiveServerMessage) => {
            console.log("Gemini raw message:", message);

            if (message.serverContent) {
              console.log("Received serverContent:", JSON.stringify(message.serverContent, null, 2));

              if (message.serverContent.outputTranscription && message.serverContent.outputTranscription.text) {
                console.log("Received output transcription:", message.serverContent.outputTranscription.text);
              }

              // Hypothesis: modelTurn might contain audio data directly, or provide context
              if (message.serverContent.modelTurn) {
                console.log("Received server content (modelTurn):", JSON.stringify(message.serverContent.modelTurn, null, 2));
                // If modelTurn also contains audio data (e.g., as a direct 'audio' property)
                // This is a speculative check, based on the log {modelTurn: {…}}
                const modelTurnAudio = (message.serverContent.modelTurn as any)?.audio; // Use 'any' for now to inspect structure
                if (modelTurnAudio && modelTurnAudio.mimeType?.startsWith("audio/") && modelTurnAudio.data) {
                  audioQueue.current.push(modelTurnAudio.data);
                  console.log("Audio data from modelTurn pushed to queue. Current queue size:", audioQueue.current.length);
                  if (!isPlayingAudio) {
                    console.log("Not currently playing audio, initiating playback from modelTurn.");
                    playNextAudio();
                  } else {
                    console.log("Audio already playing, queuing audio chunk from modelTurn.");
                  }
                } else {
                  console.log("ModelTurn does not contain audio data or incomplete audio data:", modelTurnAudio);
                }
              }

              if (message.serverContent.turnComplete) {
                console.log("Turn complete. Is speaking:", isSpeaking);
                if (audioQueue.current.length > 0) {
                  console.log("Audio queue not empty. Attempting to play next audio.");
                  playNextAudio();
                } else {
                  console.log("Audio queue empty after turn complete, stopping playback.");
                  setIsPlayingAudio(false);
                }
              }

            } else if (message.data) {
              console.log("Received data type:", typeof message.data);
              // This is the expected path for audio blobs from the general API guide.
              if (isBlob2(message.data)) { // Using the type guard function
                const audioBlob = message.data as Blob_2_temp;
                if (audioBlob.mimeType?.startsWith("audio/")) {
                  console.log("Received audio blob data (mimeType):", audioBlob.mimeType);
                  console.log("Received audio blob data (base64 length):", audioBlob.data?.length);
                  if (audioBlob.data) {
                    audioQueue.current.push(audioBlob.data);
                    console.log("Audio data pushed to queue. Current queue size:", audioQueue.current.length);
                    if (!isPlayingAudio) { // Use state variable directly
                      console.log("Not currently playing audio, initiating playback.");
                      playNextAudio();
                    } else {
                      console.log("Audio already playing, queuing audio chunk.");
                    }
                  }
                } else {
                  console.log("Received non-audio blob data with mimeType:", audioBlob.mimeType);
                }
              } else {
                console.log("Received unhandled message data format (not Blob2):", message.data);
              }
            } else if (message.setupComplete) {
                console.log("Gemini Live session setup complete.");
            } else if (message.goAway) {
                console.log("GoAway message received. Time left:", message.goAway.timeLeft);
            } else if (message.sessionResumptionUpdate) {
                console.log("Session Resumption Update:", message.sessionResumptionUpdate);
            }
            else {
              console.log("Received unhandled message type:", message);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error("Gemini Live Error:", e);
            handleStopConversation();
          },
          onclose: (e: CloseEvent) => {
            console.log("Gemini Live session closed:", e.reason);
            // Do not call handleStopConversation here to avoid redundant cleanup and potential issues
            // Resources are cleaned up when the user explicitly stops the conversation, or when an error occurs
            // If the close event is due to a GoAway message, the session will be resumed if implemented.
          },
        },
        config: {
          responseModalities: [Modality.AUDIO], // Set to AUDIO for audio responses
          outputAudioTranscription: {},
          // You might want to add inputAudioTranscription if you want to receive transcriptions of user's audio input
          // inputAudioTranscription: {},
        },
      });
      setGeminiLiveSession(newSession);
      setSelectedQuestion(question);

      // 5. Send initial system instruction and question here, after session is open and newSession is initialized
      newSession.sendClientContent({
        turns: [{
          role: "user",
          parts: [{ text: `You are a helpful assistant summarizing YouTube videos. Here is the full transcript of the video: ${transcript}. The user\'s main question is: \"${question}\". Based on the video transcript and the main question, engage in an audio conversation with the user, providing your responses as spoken audio. Provide concise and helpful answers.` }],
        }]
      });

    } catch (error) {
      console.error("Error starting conversation:", error);
      handleStopConversation();
    }
  };

  const playNextAudio = async () => {
    console.log("Attempting to play next audio. Queue size:", audioQueue.current.length, "Is playing:", isPlayingAudio);
    if (audioQueue.current.length > 0 && !isPlayingAudio) { // Use state variable directly
      setIsPlayingAudio(true);
      const audioDataB64 = audioQueue.current.shift();
      if (audioDataB64) {
        console.log("Playing next audio chunk (base64 length):", audioDataB64.length);
        try {
          // Decode Base64 string to ArrayBuffer
          const binaryString = atob(audioDataB64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const arrayBuffer = bytes.buffer;

          if (!audioContext.current) {
            audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            console.log("AudioContext created.");
          }

          // Create AudioBuffer from ArrayBuffer
          const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);
          const source = audioContext.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.current.destination);

          source.onended = () => {
            console.log("Audio chunk finished playing.");
            playNextAudio(); // Play next chunk
          };

          source.start();
          console.log("Audio playback started.");
        } catch (playError) {
          console.error("Error playing audio chunk:", playError);
          setIsPlayingAudio(false); // Reset playback state on error
        }
      } else {
        console.log("No audio data in queue to play or audioDataB64 is null/undefined.");
        setIsPlayingAudio(false); // No more audio, stop playback indicator
      }
    } else if (audioQueue.current.length === 0 && isPlayingAudio) {
      console.log("Audio queue empty, stopping playback indicator.");
      setIsPlayingAudio(false);
    } else {
      console.log("playNextAudio: No audio in queue or already playing. Queue size:", audioQueue.current.length, "Is playing:", isPlayingAudio);
    }
  };

  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    // Clean up on component unmount
    return () => {
      handleStopConversation();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">YouTube 영상 분석기</h1>
      
      <div className="mb-4 text-center">
        {user ? (
          <div className="flex items-center space-x-2">
            {user.photoURL && (
              <img src={user.photoURL} alt="User Avatar" className="w-8 h-8 rounded-full" />
            )}
            <p className="text-gray-700">환영합니다, {user.displayName || user.email}!</p>
            <button
              onClick={handleGoogleSignOut}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded focus:outline-none focus:shadow-outline"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <button
            onClick={handleGoogleSignIn}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Google 계정으로 로그인
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-md mb-8">
        <div className="mb-4">
          <label htmlFor="youtubeUrl" className="block text-gray-700 text-sm font-bold mb-2">
            YouTube URL:
          </label>
          <input
            type="url"
            id="youtubeUrl"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="예: https://www.youtube.com/watch?v=xxxxxxxxxxx"
            value={youtubeUrl}
            onChange={(e) => {
              setYoutubeUrl(e.target.value);
              setGeminiAnalysis(null);
              setTranscript('');
              setError('');
            }}
            required
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
          disabled={loading}
        >
          {loading ? '분석 중...' : '영상 분석하기'}
        </button>
        {error && <p className="text-red-500 text-sm mt-4">에러: {error}</p>}
      </form>

      <div className="flex flex-col lg:flex-row w-full max-w-6xl gap-8">
        <div className="lg:w-1/2 bg-white p-4 rounded-lg shadow-md flex justify-center items-center aspect-video">
          {youtubeUrl ? (
            <ReactPlayer
              ref={playerRef}
              url={youtubeUrl}
              controls
              width="100%"
              height="100%"
              playing={isPlaying}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
            />
          ) : (
            <p className="text-gray-500">내용이 없습니다. YouTube URL을 입력하고 분석을 시작하세요.</p>
          )}
        </div>

        <div className="lg:w-1/2 bg-white p-8 rounded-lg shadow-md flex flex-col h-full min-h-[500px]">
          <div className="flex space-x-4 mb-4">
            <button
              className={`px-4 py-2 rounded-md ${activeTab === 'analysis' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => setActiveTab('analysis')}
            >
              분석 결과
            </button>
            <button
              className={`px-4 py-2 rounded-md ${activeTab === 'transcript' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
              onClick={() => setActiveTab('transcript')}
            >
              트랜스크립트
            </button>
            {geminiAnalysis?.main_questions && geminiAnalysis.main_questions.length > 0 && (
              <button
                className={`px-4 py-2 rounded-md ${activeTab === 'questions' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
                onClick={() => setActiveTab('questions')}
              >
                주요 질문
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-white rounded-md shadow-inner">
            {activeTab === 'analysis' && geminiAnalysis ? (
              <div className="text-gray-700">
                <h3 className="text-xl font-semibold mb-2">요약:</h3>
                <p className="mb-4">{geminiAnalysis.summary}</p>

                {geminiAnalysis.keywords && geminiAnalysis.keywords.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold mb-2">주요 단어:</h3>
                    <div className="flex flex-wrap gap-2">
                      {geminiAnalysis.keywords.map((keyword, index) => (
                        <span key={index} className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {geminiAnalysis.slang_expressions && geminiAnalysis.slang_expressions.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold mb-2">구어체 표현:</h3>
                    <ul>
                      {geminiAnalysis.slang_expressions.map((slang, index) => (
                        <li key={index} className="mb-1">
                          <strong>{slang.expression}:</strong> {slang.meaning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : activeTab === 'transcript' && parsedTranscript.length > 0 ? (
              <div ref={transcriptContainerRef} className="text-gray-700">
                {parsedTranscript.map((segment: VideoSegment, index) => {
                  const isCurrent = index === activeSegmentIndex;
                  return (
                    <p
                      key={index}
                      className={`mb-2 cursor-pointer transition-colors duration-200 ${isCurrent ? 'highlighted-segment' : 'hover:text-blue-600'}`}
                      onClick={() => handleSeek(segment.time)}
                    >
                      <span className="font-semibold text-blue-500">[{String(Math.floor(segment.time / 60)).padStart(2, '0')}:{String(Math.floor(segment.time % 60)).padStart(2, '0')}]</span>
                      {' '}{segment.text}
                    </p>
                  );
                })}
              </div>
            ) : activeTab === 'questions' && geminiAnalysis?.main_questions && geminiAnalysis.main_questions.length > 0 ? (
              <div className="text-gray-700">
                <h3 className="text-xl font-semibold mb-2">주요 질문:</h3>
                <ul className="list-disc list-inside pl-4">
                  {geminiAnalysis.main_questions.map((question, index) => (
                    <li key={index} className="mb-1">{question}</li>
                  ))}
                </ul>
              </div>
            ) : activeTab === 'questions' && !geminiAnalysis?.main_questions?.length ? (
              <p className="text-gray-500">주요 질문이 없습니다.</p>
            ) : null}

            {activeTab === 'questions' && geminiAnalysis?.main_questions && geminiAnalysis.main_questions.length > 0 && (
              <div className="text-gray-700 mt-4">
                <h3 className="text-xl font-semibold mb-2">AI와 대화하기:</h3>
                <ul className="list-disc list-inside pl-4">
                  {geminiAnalysis.main_questions.map((question, index) => (
                    <li key={index} className="mb-2 flex items-center justify-between">
                      <span>{question}</span>
                      <button
                        onClick={() => handleStartConversation(question)}
                        className="ml-4 bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded focus:outline-none focus:shadow-outline"
                        disabled={isRecording || isSpeaking}
                      >
                        대화하기
                      </button>
                    </li>
                  ))}
                </ul>
                {isRecording ? (
                  <button
                    onClick={handleStopConversation}
                    className="mt-4 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
                  >
                    녹음 중지
                  </button>
                ) : (
                  <> {/* Render nothing if not recording, or if button is disabled */}</>
                )}
                {isRecording && <p className="mt-2 text-green-600">녹음 중...</p>}
                {isSpeaking && <p className="mt-2 text-blue-600">AI 응답 재생 중...</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}