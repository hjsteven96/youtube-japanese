// src/app/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
// useRouter 대신 Link 컴포넌트나 a 태그를 사용할 것이므로 제거해도 무방
// import { useRouter } from "next/navigation";

import ReactPlayer from "react-player";
import Link from "next/link"; // Next.js의 Link 컴포넌트 사용
import RecentVideos from "./components/RecentVideos"; // RecentVideos 컴포넌트 임포트
import { db, auth } from "@/lib/firebase"; // Firebase 임포트
import { doc, setDoc, collection, addDoc } from "firebase/firestore"; // collection과 addDoc 임포트
import TrendingVideos from "./components/TrendingVideos";
import { onAuthStateChanged } from "firebase/auth"; // onAuthStateChanged 임포트
import Alert from "./components/Alert"; // Alert 컴포넌트 임포트

interface VideoInfo {
    url: string;
    videoId: string;
    title: string;
    duration: number; // 초 단위
}

export default function Home() {
    const [urlInput, setUrlInput] = useState("");
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [user, setUser] = useState<any>(null); // 사용자 상태 추가
    const [showLoginAlert, setShowLoginAlert] = useState(false); // 로그인 얼럿 상태 추가

    // Firebase Auth 상태 변경 리스너
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const extractVideoId = (url: string): string | null => {
        const youtubeRegex = /(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(youtubeRegex);
        return match ? match[1] : null;
    };

    useEffect(() => {
        const handler = setTimeout(() => {
            const videoId = extractVideoId(urlInput);
            if (videoId) {
                if (videoInfo?.videoId !== videoId) {
                    setVideoInfo(null);
                    setIsLoading(true);
                    setError("");
                }
            } else {
                setVideoInfo(null);
                setError("");
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [urlInput, videoInfo?.videoId]);

    const handlePlayerReady = useCallback(
        async (player: any) => {
            const videoId = extractVideoId(urlInput);
            if (player && videoId) {
                const duration = player.getDuration();
                const internalPlayer = player.getInternalPlayer();
                const title =
                    internalPlayer?.videoTitle || "제목을 불러올 수 없습니다.";
                setVideoInfo({
                    url: urlInput,
                    videoId: videoId,
                    title: title,
                    duration: duration,
                });
                setIsLoading(false);

                // Firebase에 최근 본 영상 정보 저장
                if (auth.currentUser) {
                    const userUid = auth.currentUser.uid;
                    const docRef = doc(
                        db,
                        "users",
                        userUid,
                        "learningHistory",
                        videoId
                    );
                    await setDoc(
                        docRef,
                        {
                            youtubeUrl: urlInput,
                            timestamp: new Date().toISOString(), // 현재 시간 ISO 8601 형식
                            lastPlayedTime: 0,
                            title: title,
                            duration: duration,
                        },
                        { merge: true } // 기존 필드는 유지하고 새 필드만 추가/업데이트
                    );

                    // Add activity log for REVISIT
                    await addDoc(collection(db, "videoActivityLogs"), {
                        videoId: videoId,
                        activityType: "REVISIT",
                        userId: userUid,
                        timestamp: new Date().toISOString(),
                        youtubeTitle: title,
                        duration: duration,
                    });
                }
            }
        },
        [urlInput]
    );

    const isTooLong = videoInfo ? videoInfo.duration > 600 : false;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center py-10 px-4">
            <div className="w-full max-w-2xl">
                <header className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
                        Lin:cue
                    </h1>
                    <p className="text-gray-600 text-lg">
                        YouTube 링크로 배우는 영어 🎓
                    </p>
                </header>
                <div className="mb-6">{/* User-info or sign-in button */}</div>

                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl transition-all duration-300">
                    <div className="mb-6">
                        <label
                            htmlFor="youtubeUrl"
                            className="block text-gray-700 text-sm font-semibold mb-3 flex items-center"
                        >
                            <span className="mr-2">🎬</span> YouTube 링크 입력
                        </label>
                        <input
                            type="url"
                            id="youtubeUrl"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all duration-300 text-gray-700"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ display: "none" }}>
                    {extractVideoId(urlInput) && (
                        <ReactPlayer
                            url={urlInput}
                            onReady={handlePlayerReady}
                        />
                    )}
                </div>

                {isLoading && (
                    <div className="text-center py-4">
                        <p className="text-gray-500">
                            영상 정보를 불러오는 중...
                        </p>
                    </div>
                )}

                {error && (
                    <p className="text-red-500 text-sm mt-4 text-center">
                        ⚠️ {error}
                    </p>
                )}

                {videoInfo && (
                    <div className="mt-8 animate-slide-up">
                        <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden shadow-lg mb-4">
                            <ReactPlayer
                                url={videoInfo.url}
                                controls={true}
                                width="100%"
                                height="100%"
                                className="absolute inset-0"
                            />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">
                            {videoInfo.title}
                        </h2>
                        <p className="text-gray-600 mb-4">
                            영상 길이: {Math.floor(videoInfo.duration / 60)}분{" "}
                            {Math.floor(videoInfo.duration % 60)}초
                        </p>

                        {/* ★★★ 핵심 변경: 버튼을 Link 컴포넌트로 변경 ★★★ */}
                        <Link
                            href={user ? `/analysis/${videoInfo.videoId}` : "#"} // 로그인 상태에 따라 href 변경
                            passHref
                            onClick={(e) => {
                                if (!user) {
                                    e.preventDefault(); // 링크 이동 방지
                                    setShowLoginAlert(true); // Alert 컴포넌트 표시
                                }
                            }}
                            // isTooLong일 경우 클릭 이벤트를 막기 위해 pointer-events-none 사용
                            className={`block text-center w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 ${
                                isTooLong
                                    ? "opacity-50 cursor-not-allowed pointer-events-none"
                                    : ""
                            }`}
                            aria-disabled={isTooLong}
                        >
                            {isTooLong
                                ? "10분 이하의 영상만 분석 가능합니다"
                                : "AI로 영상 분석하기 ✨"}
                        </Link>
                    </div>
                )}
            </div>
            <div className="w-full max-w-3xl mt-8 px-4 space-y-8">
                <RecentVideos />
                <TrendingVideos />
            </div>

            {/* 로그인 필요 Alert 컴포넌트 */}
            {showLoginAlert && (
                <Alert
                    title="로그인 필요"
                    subtitle="이 기능을 사용하려면 로그인이 필요합니다."
                    buttons={[
                        {
                            text: "확인",
                            onClick: () => setShowLoginAlert(false),
                            isPrimary: true,
                        },
                        {
                            text: "닫기",
                            onClick: () => setShowLoginAlert(false),
                            isPrimary: false,
                        },
                    ]}
                    onClose={() => setShowLoginAlert(false)} // 배경 클릭 시 닫기
                />
            )}
        </div>
    );
}
