// src/app/HomeClientContent.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import ReactPlayer from "react-player";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import * as ChannelService from "@channel.io/channel-web-sdk-loader";

import { auth, logAnalyticsEvent } from "@/lib/firebase";
import { createUserProfile } from "@/lib/user";
import { PLANS, UserProfile } from "@/lib/plans";
import Alert from "./components/Alert";

import { BorderBeam } from "@/components/magicui/border-beam";
// 기존 page.tsx의 VideoInfo 타입을 그대로 사용합니다.
interface VideoInfo {
    url: string;
    videoId: string;
    title: string;
    duration: number;
}

export default function HomeClientContent() {
    const [urlInput, setUrlInput] = useState("");
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
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

    useEffect(() => {
        ChannelService.loadScript();
        ChannelService.boot({
            pluginKey: "5e180a54-27d8-4d1a-a885-52f777a61cea",
        });

        return () => {
            ChannelService.shutdown();
        };
    }, []);

    // Firebase Analytics 페이지 뷰 이벤트 로깅
    useEffect(() => {
        logAnalyticsEvent("page_view", { page_title: "Home Page" });
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
            }
        },
        [urlInput]
    );

    const handleAnalysisClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();

        if (!user || !userProfile) {
            setAlertConfig({
                title: "로그인 필요",
                subtitle: "영상 분석을 위해서는 로그인이 필요합니다.",
                buttons: [
                    {
                        text: "닫기",
                        onClick: () => setIsAlertVisible(false),
                        isPrimary: true,
                    },
                ],
            });
            setIsAlertVisible(true);
            return;
        }

        const plan = PLANS[userProfile.plan];

        if (videoInfo && videoInfo.duration > plan.maxVideoDuration) {
            setAlertConfig({
                title: "영상 길이 초과",
                subtitle: `${plan.name} 등급은 ${Math.floor(
                    plan.maxVideoDuration / 60
                )}분 이하 영상만 분석 가능합니다.`,
                buttons: [
                    {
                        text: "요금제 보기",
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

        if (userProfile.usage.analysisCount >= plan.dailyAnalysisLimit) {
            setAlertConfig({
                title: "일일 분석 한도 초과",
                subtitle: `오늘의 분석 횟수(${plan.dailyAnalysisLimit}회)를 모두 사용했습니다. 내일 다시 시도해주세요.`,
                buttons: [
                    {
                        text: "요금제 보기",
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

        if (videoInfo) {
            // 이벤트 로깅
            logAnalyticsEvent("analyze_button_click", {
                video_id: videoInfo.videoId,
                video_title: videoInfo.title,
                user_plan: userProfile?.plan,
            });
            window.location.href = `/analysis/${videoInfo.videoId}`;
        }
    };

    const getButtonState = () => {
        if (!videoInfo)
            return { disabled: true, text: "AI로 영상 분석하기 ✨" };

        return { disabled: false, text: "AI로 영상 분석하기 ✨" };
    };

    const buttonState = getButtonState();

    return (
        <div>
            <div style={{ display: "none" }}>
                {extractVideoId(urlInput) && (
                    <ReactPlayer url={urlInput} onReady={handlePlayerReady} />
                )}
            </div>

            {isLoading && (
                <div className="text-center py-4">
                    <p className="text-gray-500">영상 정보를 불러오는 중...</p>
                </div>
            )}

            {error && (
                <p className="text-red-500 text-sm mt-4 text-center">
                    ⚠️ {error}
                </p>
            )}

            {videoInfo && (
                <div className="max-w-xl mx-auto">
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

                        <Link
                            href={
                                videoInfo
                                    ? `/analysis/${videoInfo.videoId}`
                                    : "#"
                            }
                            onClick={handleAnalysisClick}
                            className={`block text-center w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 mb-8 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 ${
                                buttonState.disabled
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                            }`}
                            aria-disabled={buttonState.disabled}
                        >
                            {buttonState.text}
                        </Link>
                    </div>
                </div>
            )}

            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl transition-all duration-300">
                <div className="mb-6">
                    <label
                        htmlFor="youtubeUrl"
                        className="block text-gray-700 text-sm font-semibold mb-3 items-center"
                    >
                        <span className="mr-2">🎬</span> YouTube 링크 입력
                    </label>
                    <div className="relative rounded-lg overflow-hidden">
                        <input
                            type="url"
                            id="youtubeUrl"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all duration-300 text-gray-700"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                        />
                        <BorderBeam
                            duration={8}
                            size={500}
                            className="absolute inset-0 from-transparent via-purple-500 to-transparent"
                        />
                        <BorderBeam
                            duration={8}
                            delay={3}
                            size={500}
                            className="absolute inset-0 from-transparent via-blue-500 to-transparent"
                        />
                    </div>
                </div>
            </div>

            {isAlertVisible && (
                <Alert
                    title={alertConfig.title}
                    subtitle={alertConfig.subtitle}
                    buttons={alertConfig.buttons}
                    onClose={() => setIsAlertVisible(false)}
                />
            )}
        </div>
    );
}
