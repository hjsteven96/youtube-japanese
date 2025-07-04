// src/app/page.tsx

// 1. 서버-사이드 로직과 컴포넌트들을 임포트합니다.
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { unstable_noStore as noStore } from 'next/cache';

import AuthHeader from "./components/AuthHeader";
import RecentVideos from "./components/RecentVideos";
import TrendingVideos from "./components/TrendingVideos";
import HomeClientContent from "./HomeClientContent";
// import ContactButton from "./components/ContactButton"; // ContactButton import 제거
import { AuroraText } from "@/components/magicui/aurora-text";
// 2. 데이터 타입을 정의하고 다른 곳에서 쓸 수 있도록 export합니다.
export interface VideoInfo {
    videoId: string;
    title: string;
    duration: number;
    url: string;
    channelName?: string;
    summary?: string;
}

// 3. 서버에서 직접 데이터를 가져오는 비동기 함수입니다.
async function getTrendingVideos(): Promise<VideoInfo[]> {
    noStore(); // 캐싱 비활성화
    try {
        const q = query(
            collection(db, "videoAnalyses"),
            orderBy("timestamp", "desc"),
            limit(4)
        );
        const querySnapshot = await getDocs(q);

        const videos: VideoInfo[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
         
            const video = {
                videoId: doc.id,
                title: data.youtubeTitle || "제목 없음",
                duration: data.duration || 0,
                url:
                    data.youtubeUrl ||
                    `https://www.youtube.com/watch?v=${doc.id}`,
                channelName: data.channelName || null,
                summary: data.analysis?.summary || "요약 없음",
            };
         
            videos.push(video);
        });
        return videos;
    } catch (err) {
        console.error("Error fetching trending videos on server:", err);
        return []; // 에러 발생 시 빈 배열을 반환하여 페이지가 깨지지 않도록 합니다.
    }
}

// 4. 메인 페이지 컴포넌트입니다. "use client"가 없으므로 서버 컴포넌트로 동작합니다.
export default async function Home() {
    // 서버에서 렌더링하기 전에 미리 데이터를 가져옵니다.
    const trendingVideosData = await getTrendingVideos();

    return (
        <>
            <AuthHeader />
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col items-center justify-center py-20 px-4 pt-20">
                <div className="w-full max-w-2xl pt-10">
                    <header className="text-center mb-8">
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-1 flex items-center justify-center md:leading-loose">

                            <AuroraText>Ling:to</AuroraText>
                            <span className="ml-2 text-base font-normal text-gray-400 opacity-80">
                                Beta
                            </span>
                        </h1>
                        <p className="text-gray-600 text-lg">
                            YouTube로 시작하는 영어 🎓
                        </p>
                    </header>

                    {/* URL 입력, 미리보기 등 상호작용이 필요한 부분은 클라이언트 컴포넌트로 렌더링 */}
                    <HomeClientContent />
                </div>
                <div className="w-full max-w-3xl mt-2 px-1 space-y-10">
                    {/* 최근 본 영상은 사용자 로그인 상태에 따라 달라지므로 클라이언트 컴포넌트로 유지 */}
                    <RecentVideos />

                    {/* 서버에서 가져온 추천 영상 데이터를 props로 전달 */}
                    <TrendingVideos videos={trendingVideosData} />
                </div>

                {/* 문의하기 버튼 (정적 UI) */}
                {/* <div className="fixed bottom-6 right-6 z-50">
                    <ContactButton></ContactButton>
                </div> */}
            </div>
        </>
    );
}
