// src/app/components/TrendingVideos.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import RecentVideoItem from "./RecentVideoItem"; // 기존 컴포넌트 재활용!

// Firestore에 저장된 영상 정보 타입
interface TrendingVideo {
    videoId: string;
    youtubeTitle: string;
    score: number;
}

export default function TrendingVideos() {
    const [trendingVideos, setTrendingVideos] = useState<TrendingVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchTrendingVideos = async () => {
            try {
                // 1. Firestore에서 계산된 'trendingVideos/global' 문서를 가져옵니다.
                const trendingDocRef = doc(db, "trendingVideos", "global");
                const docSnap = await getDoc(trendingDocRef);

                if (docSnap.exists()) {
                    // 2. 문서에서 'videos' 배열 데이터를 가져와 상태에 저장합니다.
                    const data = docSnap.data();
                    setTrendingVideos(data.videos || []);
                } else {
                    console.log("No trending videos document found!");
                }
            } catch (err) {
                console.error("Error fetching trending videos:", err);
                setError("인기 동영상 목록을 불러오는 데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchTrendingVideos();
    }, []); // 이 컴포넌트는 페이지 로드 시 한 번만 데이터를 가져옵니다.

    if (error) {
        return (
            <div className="mt-8 w-full text-center text-red-500">
                ⚠️ {error}
            </div>
        );
    }

    // 인기 동영상이 하나도 없을 경우 아무것도 표시하지 않음
    if (trendingVideos.length === 0) {
        return null;
    }

    return (
        <div className="mt-8 w-full max-w-3xl mx-auto px-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
                🔥 인기 학습 동영상
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {trendingVideos.map((video) => (
                    // 3. 각 영상 아이템은 'RecentVideoItem' 컴포넌트를 재활용하여 표시합니다.
                    <RecentVideoItem
                        key={video.videoId}
                        videoId={video.videoId}
                        title={video.youtubeTitle}
                    />
                ))}
            </div>
        </div>
    );
}
