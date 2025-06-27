"use client";

import { useState, useEffect } from "react";
import RecentVideoItem from "./RecentVideoItem";
import { db, auth } from "@/lib/firebase"; // Firebase 임포트
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface VideoInfo {
    url: string;
    videoId: string;
    title: string;
    duration: number; // 초 단위
}

export default function RecentVideos() {
    const [recentVideos, setRecentVideos] = useState<VideoInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null); // 사용자 상태 추가

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            console.log("[RecentVideos] Auth state changed, currentUser:", currentUser?.uid);
            if (currentUser) {
                const fetchRecentVideos = async () => {
                    setLoading(true);
                    try {
                        const q = query(
                            collection(
                                db,
                                `users/${currentUser.uid}/learningHistory`
                            ),
                            orderBy("timestamp", "desc"),
                            limit(4)
                        );
                        console.log("[RecentVideos] Fetching learning history for user:", currentUser.uid);
                        const querySnapshot = await getDocs(q);
                        console.log("[RecentVideos] Fetched documents count:", querySnapshot.docs.length);
                        const videos: VideoInfo[] = [];
                        querySnapshot.forEach((doc) => {
                            const data = doc.data();
                            console.log("[RecentVideos] Raw Firestore data for doc.id", doc.id, ":", data);
                            // Firestore에서 가져온 데이터 형식에 맞춰 VideoInfo 구성
                            videos.push({
                                url: data.youtubeUrl,
                                videoId: doc.id, // 문서 ID를 videoId로 사용
                                title: data.title || "제목 없음", // Firestore에 title 필드 추가 필요
                                duration: data.duration || 0, // Firestore에 duration 필드 추가 필요
                            });
                            console.log("[RecentVideos] Mapped video data:", videos[videos.length - 1]);
                        });
                        setRecentVideos(videos);
                        console.log("[RecentVideos] Final recentVideos state:", videos);
                    } catch (error) {
                        console.error("Error fetching recent videos:", error);
                    }
                    setLoading(false);
                };
                fetchRecentVideos();
            } else {
                console.log("[RecentVideos] User logged out, clearing recent videos.");
                setRecentVideos([]); // 로그아웃 상태면 목록 비우기
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    if (loading || !user || recentVideos.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 w-full max-w-3xl mx-auto px-2 pt-16">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
                🕐최근 본 영상
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {recentVideos.slice(0, 4).map((video) => (
                    <RecentVideoItem
                        key={video.videoId}
                        videoId={video.videoId}
                        title={video.title}
                    />
                ))}
            </div>
        </div>
    );
}
