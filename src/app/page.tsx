"use client";
import { useState, useEffect, useCallback } from "react";
import ReactPlayer from "react-player";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, collection, addDoc } from "firebase/firestore";

import { db, auth } from "@/lib/firebase";
import { createUserProfile } from "@/lib/user";
import { PLANS, UserProfile } from "@/lib/plans";

import RecentVideos from "./components/RecentVideos";
import TrendingVideos from "./components/TrendingVideos";
import Alert from "./components/Alert";
import AuthHeader from "./components/AuthHeader"; // Import AuthHeader

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

    // --- ⭐️ 사용자 관련 상태 변경 ---
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // --- ⭐️ 알림(Alert) 관련 상태 변경 ---
    const [isAlertVisible, setIsAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        title: "",
        subtitle: "",
        buttons: [
            {
                text: "확인",
                onClick: () => setIsAlertVisible(false),
                isPrimary: true,
            },
        ],
    });

    // ⭐️ 사용자 인증 상태 변경 시 프로필 로드/생성
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const profile = await createUserProfile(currentUser);
                setUserProfile(profile);
            } else {
                setUserProfile(null);
            }
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

                if (auth.currentUser) {
                    // ... (최근 본 영상 저장 로직은 기존과 동일)
                }
            }
        },
        [urlInput]
    );

    // --- ⭐️ 버튼 클릭 이벤트 핸들러 ---
    const handleAnalysisClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault(); // 기본 링크 이동 동작을 일단 막습니다.

        if (!user || !userProfile) {
            setAlertConfig({
                title: "로그인 필요",
                subtitle: "영상 분석을 위해서는 로그인이 필요합니다.",
                buttons: [
                    {
                        text: "확인",
                        onClick: () => {
                            setIsAlertVisible(false);
                            window.location.href = "/pricing";
                        },
                        isPrimary: true,
                    },
                    {
                        text: "닫기",
                        onClick: () => setIsAlertVisible(false),
                        isPrimary: false,
                    },
                ],
            });
            setIsAlertVisible(true);
            return;
        }

        const plan = PLANS[userProfile.plan];

        // 1. 영상 길이 제한 체크
        if (videoInfo && videoInfo.duration > plan.maxVideoDuration) {
            setAlertConfig({
                title: "영상 길이 초과",
                subtitle: `${plan.name}는 ${Math.floor(
                    plan.maxVideoDuration / 60
                )}분 이하의 영상만 분석할 수 있습니다.`,
                buttons: [
                    {
                        text: "확인",
                        onClick: () => {
                            setIsAlertVisible(false);
                            window.location.href = "/pricing";
                        },
                        isPrimary: true,
                    },
                    {
                        text: "닫기",
                        onClick: () => setIsAlertVisible(false),
                        isPrimary: false,
                    },
                ],
            });
            setIsAlertVisible(true);
            return;
        }

        // 2. 일일 분석 횟수 제한 체크
        if (userProfile.usage.analysisCount >= plan.dailyAnalysisLimit) {
            setAlertConfig({
                title: "일일 분석 한도 초과",
                subtitle: `${plan.name}는 하루 ${plan.dailyAnalysisLimit}개의 영상만 분석할 수 있습니다. 추천 영상을 이용해 주세요.`,
                buttons: [
                    {
                        text: "확인",
                        onClick: () => {
                            setIsAlertVisible(false);
                            window.location.href = "/pricing";
                        },
                        isPrimary: true,
                    },
                    {
                        text: "닫기",
                        onClick: () => setIsAlertVisible(false),
                        isPrimary: false,
                    },
                ],
            });
            setIsAlertVisible(true);
            return;
        }

        // 모든 조건을 통과하면 분석 페이지로 이동
        if (videoInfo) {
            window.location.href = `/analysis/${videoInfo.videoId}`;
        }
    };

    // --- ⭐️ 버튼 상태 및 텍스트를 결정하는 로직 ---
    const getButtonState = () => {
        if (!videoInfo)
            return { disabled: true, text: "AI로 영상 분석하기 ✨" };

        const plan = userProfile ? PLANS[userProfile.plan] : PLANS.free;

        //분석한도초과 버튼 비활성화
        // if (
        //     userProfile &&
        //     userProfile.usage.analysisCount >= plan.dailyAnalysisLimit
        // ) {
        //     return {
        //         disabled: true,
        //         text: `오늘 분석 한도 초과 (${userProfile.usage.analysisCount}/${plan.dailyAnalysisLimit})`,
        //     };
        // }

        return { disabled: false, text: "AI로 영상 분석하기 ✨" };
    };

    const buttonState = getButtonState();

    return (
        <>
            <AuthHeader />
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center py-20 px-4 pt-20">
                {" "}
                {/* Added pt-20 for header spacing */}
                <div className="w-full max-w-2xl pt-10">
                    <header className="text-center mb-8">
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3 flex items-center justify-center">
                            Lin:cue
                            <span className="ml-2 text-base font-normal text-gray-400 opacity-80">
                                Beta
                            </span>
                        </h1>
                        <p className="text-gray-600 text-lg">
                            YouTube 링크로 배우는 영어 🎓
                        </p>
                    </header>

                    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl transition-all duration-300">
                        <div className="mb-6">
                            <label
                                htmlFor="youtubeUrl"
                                className="block text-gray-700 text-sm font-semibold mb-3 flex items-center"
                            >
                                <span className="mr-2">🎬</span> YouTube 링크
                                입력
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
                                영상 길이: {Math.floor(videoInfo.duration / 60)}
                                분 {Math.floor(videoInfo.duration % 60)}초
                            </p>

                            <Link
                                href={
                                    videoInfo
                                        ? `/analysis/${videoInfo.videoId}`
                                        : "#"
                                }
                                onClick={handleAnalysisClick}
                                className={`block text-center w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 ${
                                    buttonState.disabled
                                        ? "opacity-50 cursor-not-allowed"
                                        : ""
                                }`}
                                aria-disabled={buttonState.disabled}
                            >
                                {buttonState.text}
                            </Link>
                        </div>
                    )}
                </div>
                <div className="w-full max-w-3xl mt-8 px-4 space-y-12">
                    <RecentVideos />
                    <TrendingVideos />
                </div>
                {/* --- ⭐️ 통합된 Alert 컴포넌트 --- */}
                {isAlertVisible && (
                    <Alert
                        title={alertConfig.title}
                        subtitle={alertConfig.subtitle}
                        buttons={alertConfig.buttons}
                        onClose={() => setIsAlertVisible(false)}
                    />
                )}
                <div className="fixed bottom-6 right-6 z-50">
                    <button
                        onClick={() =>
                            window.open(
                                "https://open.kakao.com/o/sl0HG7Ch",
                                "_blank"
                            )
                        }
                        className="relative bg-gradient-to-r from-blue-300/80 to-white/30
               backdrop-blur-md border border-white/30
               text-gray-700 font-semibold py-3 px-6 rounded-full
               shadow-md transition-all duration-300
               hover:from-blue-300/60 hover:to-blue-100/40 hover:scale-105
               flex items-center space-x-2"
                    >
                        {/* 모바일: ‘문의하기’, 데스크탑: 긴 문구 */}
                        <span className="md:hidden">문의하기</span>
                        <span className="hidden md:inline">
                            문의나 요청사항이 있다면?
                        </span>

                        {/* 모바일에서 더 작은 아이콘, md 이상에서 기본 크기 */}
                        <svg
                            className="w-4 h-4 md:w-6 md:h-6"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                fillRule="evenodd"
                                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.111A8.933 8.933 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </>
    );
}
