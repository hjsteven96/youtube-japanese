import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import Link from "next/link";
import Image from "next/image";
import AuthHeader from "../components/AuthHeader";

// VideoInfo 타입은 src/app/page.tsx와 동일하게 유지
interface VideoInfo {
    videoId: string;
    title: string;
    duration: number;
    url: string;
    channelName?: string;
    summary?: string;
}

// 모든 추천 영상을 가져오는 서버 함수 (제한 없음)
async function getAllTrendingVideos(): Promise<VideoInfo[]> {
    try {
        const q = query(
            collection(db, "videoAnalyses"),
            orderBy("timestamp", "desc")
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
        console.error("Error fetching all trending videos on server:", err);
        return [];
    }
}

export default async function TrendingVideosPage() {
    const videos = await getAllTrendingVideos();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
            <AuthHeader />

            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <div className="max-w-7xl mx-auto px-4 pt-32 pb-16">
                    <div className="text-center">
                        <h1 className="text-5xl md:text-6xl font-extrabold mb-4">
                            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                                추천 영상 컬렉션
                            </span>
                        </h1>
                        <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto">
                            엄선된 YouTube 영상들을 한눈에 확인하고, AI가 분석한
                            인사이트를 만나보세요
                        </p>
                        <div className="mt-8 flex items-center justify-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-2">
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                </svg>
                                총 {videos.length}개의 영상
                            </span>
                            <span className="flex items-center gap-2">
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                실시간 업데이트
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-7xl mx-auto px-4 pb-20">
                {videos.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-100 mb-6">
                            <svg
                                className="w-12 h-12 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <p className="text-gray-600 text-lg mb-2">
                            아직 추천 영상이 없습니다
                        </p>
                        <p className="text-gray-500">
                            곧 새로운 영상이 추가될 예정입니다
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.map((video, index) => (
                            <Link
                                key={video.videoId}
                                href={`/analysis/${video.videoId}`}
                                className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden transform hover:-translate-y-2"
                            >
                                {/* Gradient Overlay on Hover */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10" />

                                {/* Thumbnail */}
                                <div className="relative w-full aspect-video overflow-hidden">
                                    <Image
                                        src={`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
                                        alt={video.title}
                                        layout="fill"
                                        objectFit="cover"
                                        className="group-hover:scale-110 transition-transform duration-700"
                                    />
                                    {/* Duration Badge */}
                                    <div className="absolute bottom-3 right-3 bg-black/80 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                                        {Math.floor(video.duration / 60)}:
                                        {(video.duration % 60)
                                            .toString()
                                            .padStart(2, "0")}
                                    </div>
                                    {/* Play Icon Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm group-hover:glass-morphism-strong transition-all duration-300">
                                            <svg
                                                className="w-6 h-6 text-gray-800 ml-1"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-5 relative z-20">
                                    {video.channelName && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                                {video.channelName
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>
                                            <p className="text-gray-600 text-sm font-medium">
                                                {video.channelName}
                                            </p>
                                        </div>
                                    )}
                                    <h2 className="text-lg font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                                        {video.title}
                                    </h2>
                                    {video.summary && (
                                        <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed">
                                            {video.summary}
                                        </p>
                                    )}

                                    {/* View Analysis Link */}
                                    <div className="mt-4 flex items-center text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <span>분석 보기</span>
                                        <svg
                                            className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 5l7 7-7 7"
                                            />
                                        </svg>
                                    </div>
                                </div>

                                {/* Index Badge */}
                                {index < 3 && (
                                    <div className="absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center text-gray-800 font-bold glass-morphism-strong opacity-100 group-hover:opacity-0 transition-opacity duration-300">
                                        {index + 1}
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                )}

                {/* Bottom Navigation */}
                <div className="mt-16 flex flex-col items-center">
                    <div className="flex gap-4">
                        <Link
                            href="/"
                            className="group relative inline-flex items-center px-8 py-4 overflow-hidden rounded-full bg-white shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                            <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                            <svg
                                className="w-5 h-5 mr-2 text-gray-600 group-hover:text-blue-600 transition-colors"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                                />
                            </svg>
                            <span className="text-gray-700 font-medium group-hover:text-blue-600 transition-colors">
                                홈으로 돌아가기
                            </span>
                        </Link>
                    </div>

                    {videos.length > 0 && (
                        <p className="mt-6 text-sm text-gray-500">
                            더 많은 영상을 보고 싶으신가요? 홈에서 새로운 영상을
                            추가해보세요!
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
