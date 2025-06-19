'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import ReactPlayer from 'react-player';

interface SlangExpression {
  expression: string;
  meaning: string;
}

interface VideoAnalysis {
  summary: string;
  keywords: string[];
  slang_expressions: SlangExpression[];
}

interface GeminiResponseData {
  analysis: VideoAnalysis;
  transcript_text: string;
}

interface VideoSegment {
  time: number;
  text: string;
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
  const [activeTab, setActiveTab] = useState<'analysis' | 'transcript'>('analysis');

  const playerRef = useRef<ReactPlayer>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  const parsedTranscript = useMemo(() => {
    if (!transcript) return [];

    const lines = transcript.split('\n').filter(line => line.trim() !== '');
    const parsed: VideoSegment[] = [];
    let currentSegment: VideoSegment | null = null;

    lines.forEach((line) => {
      const match = line.match(/^\\[(\d{2}):(\d{2})\\]\\s*(.*)/);

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

    if (parsed.length === 0 && transcript.trim() !== '') {
      const cleanedText = transcript.trim().replace(/\[(\d{2}):(\d{2})\]/g, '').trim();
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
      setTranscript(data.transcript_text);
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center py-10">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">YouTube 영상 분석기</h1>
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
            <p className="text-gray-500">YouTube URL을 입력하여 동영상을 재생하세요.</p>
          )}
        </div>

        <div className="lg:w-1/2 bg-white p-8 rounded-lg shadow-md">
          <div className="flex mb-4 border-b border-gray-200">
            <button
              className={`py-2 px-4 text-sm font-medium text-center ${activeTab === 'analysis' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'} focus:outline-none`}
              onClick={() => setActiveTab('analysis')}
            >
              분석 결과
            </button>
            <button
              className={`py-2 px-4 text-sm font-medium text-center ${activeTab === 'transcript' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'} focus:outline-none`}
              onClick={() => setActiveTab('transcript')}
            >
              트랜스크립트
            </button>
          </div>

          <div className="tab-content max-h-96 overflow-y-auto pr-2">
            {activeTab === 'analysis' && (geminiAnalysis ? (
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
                  <div>
                    <h3 className="text-xl font-semibold mb-2">구어체 표현:</h3>
                    <ul>
                      {geminiAnalysis.slang_expressions.map((slang, index) => (
                        <li key={index} className="mb-1">
                          <span className="font-medium">{slang.expression}:</span> {slang.meaning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">영상 분석 결과가 여기에 표시됩니다.</p>
            ))}

            {activeTab === 'transcript' && (transcript ? (
              <div ref={transcriptContainerRef} className="text-gray-700">
                {parsedTranscript.map((segment: VideoSegment, index) => {
                  const isCurrent = index === activeSegmentIndex;
                  return (
                    <p
                      key={index}
                      className={`mb-2 cursor-pointer transition-colors duration-200 ${isCurrent ? 'highlighted-segment' : 'hover:text-blue-600'}`}
                      onClick={() => handleSeek(segment.time)}
                    >
                      <span className="font-semibold text-blue-500">[{String(Math.floor(segment.time / 60)).padStart(2, '0')}:{String(segment.time % 60).padStart(2, '0')}]</span>
                      {' '}{segment.text}
                    </p>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500">트랜스크립트가 여기에 표시됩니다.</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}