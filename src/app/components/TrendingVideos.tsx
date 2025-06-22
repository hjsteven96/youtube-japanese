// src/app/components/TrendingVideos.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import RecentVideoItem from "./RecentVideoItem"; // 기존 컴포넌트 재활용!

// Firestore에 저장된 영상 정보 타입
interface VideoInfo {
    url: string;
    videoId: string;
    title: string;
    duration: number; // 초 단위
}

export default function TrendingVideos() {
    const [recommendedVideos, setRecommendedVideos] = useState<VideoInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchRecommendedVideos = async () => {
            try {
                // 'recommendedVideos' 컬렉션에서 timestamp를 기준으로 최신순 4개를 가져옵니다.
                // 이 컬렉션은 미리 생성되어 있고, timestamp 필드를 가지고 있다고 가정합니다.
                // 실제 서비스에서는 admin SDK 등을 통해 미리 '추천 영상' 데이터를 넣어두어야 합니다.
                const q = query(
                    collection(db, "videoAnalyses"), // 예시 컬렉션 이름: "videos" (실제 데이터에 맞게 변경 필요)
                    orderBy("timestamp", "desc"), // 최신순 정렬
                    limit(4) // 4개만 가져오기
                );
                const querySnapshot = await getDocs(q);

                const videos: VideoInfo[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    videos.push({
                        url: data.youtubeUrl || "", // Firestore 필드명에 따라 조정
                        videoId: doc.id,
                        title: data.youtubeTitle || data.title || "제목 없음", // Firestore 필드명에 따라 조정
                        duration: data.duration || 0,
                    });
                });
                setRecommendedVideos(videos);
            } catch (err) {
                console.error("Error fetching recommended videos:", err);
                setError("추천 동영상 목록을 불러오는 데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendedVideos();
    }, []);

    if (error) {
        return (
            <div className="mt-8 w-full text-center text-red-500">
                ⚠️ {error}
            </div>
        );
    }

    // 추천 동영상이 하나도 없을 경우 아무것도 표시하지 않음
    if (recommendedVideos.length === 0) {
        return null;
    }

    return (
        <div className="mt-8 w-full max-w-3xl mx-auto px-2">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
                ✨ 추천 동영상
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {recommendedVideos.map((video) => (
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
