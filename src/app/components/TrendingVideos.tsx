// src/app/components/TrendingVideos.tsx

// 1. "use client" 선언은 더 이상 필요 없으므로 제거하거나 그대로 두어도 괜찮습니다.
//    이 컴포넌트는 더 이상 자체적인 상태(State)나 훅(Hook)을 사용하지 않기 때문입니다.

// 2. 기존의 useState, useEffect, db 관련 import는 모두 제거합니다.
import RecentVideoItem from "./RecentVideoItem";
import { VideoInfo } from "../page"; // page.tsx에서 export한 VideoInfo 타입을 가져옵니다.

// 3. 컴포넌트의 인자(props)로 videos를 받도록 수정합니다.
export default function TrendingVideos({ videos }: { videos: VideoInfo[] }) {
    // 4. 로딩이나 에러 상태가 없어졌으므로 관련 로직을 제거합니다.

    // 부모로부터 받은 데이터가 없으면 아무것도 렌더링하지 않습니다.
    if (!videos || videos.length === 0) {
        return null;
    }

    return (
        <div className="mt-8 w-full max-w-3xl mx-auto px-2">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
                ✨ 추천 동영상
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {/* 5. props로 받은 videos 배열을 사용해 목록을 렌더링합니다. */}
                {videos.map((video) => (
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
