// 서버 컴포넌트에는 "use client"가 없습니다.

import { Metadata } from "next";
import { Suspense } from "react";
import AnalysisClientPage from "./analysis-client-page"; // 1단계에서 만든 파일을 import 합니다.
import LoadingAnimation from "../../components/LoadingAnimation";

// 1. 메타데이터 생성 로직 (서버에서 실행) - 이 부분은 그대로 둡니다.
type Props = {
    params: { videoId: string };
};

async function getYouTubeVideoTitle(videoId: string): Promise<string | null> {
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube-data?videoId=${videoId}`,
            { next: { revalidate: 3600 } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.youtubeTitle || null;
    } catch (error) {
        return null;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const videoId = params.videoId;
    const youtubeTitle = await getYouTubeVideoTitle(videoId);

    const title = youtubeTitle
        ? `YouTube 영상 ${youtubeTitle}으로 영어 공부하자! | AI English`
        : "YouTube 영상으로 영어 공부하자! | AI English";
    const description = youtubeTitle
        ? `${youtubeTitle} 영상을 AI로 분석하여 자막, 핵심 표현, AI 대화 연습까지! 효과적인 영어 학습을 시작해보세요.`
        : "YouTube 영상을 AI로 분석하여 실전 영어를 학습하세요. 자막, 핵심 표현, AI 대화 연습까지!";
    const imageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    return {
        title,
        description,
        keywords: [
            "영어학습",
            "YouTube 영어",
            "AI 영어교육",
            "영어회화",
            "영상학습",
            youtubeTitle || "",
        ].filter(Boolean),
        openGraph: {
            title,
            description,
            url: `https://your-domain.com/analysis/${videoId}`,
            type: "website",
            images: [
                {
                    url: imageUrl,
                    width: 1280,
                    height: 720,
                    alt: youtubeTitle || "YouTube Video Thumbnail",
                },
            ],
            siteName: "AI English by YouTube",
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [imageUrl],
        },
    };
}

// 2. 페이지 기본 컴포넌트 - 실제 UI는 클라이언트 컴포넌트에 위임합니다.
export default function AnalysisPage() {
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <AnalysisClientPage />
        </Suspense>
    );
}
