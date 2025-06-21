// src/app/analysis/[videoId]/page.tsx

import { Metadata } from "next";
import { Suspense } from "react";
import AnalysisClientPage from "./analysis-client-page";
import LoadingAnimation from "../../components/LoadingAnimation";

// 'Props' 타입을 Next.js의 PageProps에 더 가깝게 정의합니다.
interface Props {
    params: { videoId: string };
    searchParams: { [key: string]: string | string[] | undefined };
}

// 메타데이터 생성 함수
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const videoId = params.videoId;

    async function getYouTubeVideoTitle(vid: string): Promise<string | null> {
        try {
            const baseUrl =
                process.env.NEXT_PUBLIC_APP_URL ||
                `https://${process.env.VERCEL_URL}` ||
                "http://localhost:3000";
            const res = await fetch(
                `${baseUrl}/api/youtube-data?videoId=${vid}`,
                { next: { revalidate: 3600 } }
            );
            if (!res.ok) return null;
            const data = await res.json();
            return data.youtubeTitle || null;
        } catch (error) {
            console.error("Error fetching YouTube title for metadata:", error);
            return null;
        }
    }

    const youtubeTitle = await getYouTubeVideoTitle(videoId);

    const title = youtubeTitle
        ? `YouTube 영상 ${youtubeTitle}으로 영어 공부하자! | AI English`
        : "YouTube 영상으로 영어 공부하자! | AI English";
    const description = youtubeTitle
        ? `${youtubeTitle} 영상을 AI로 분석하여 자막, 핵심 표현, AI 대화 연습까지! 효과적인 영어 학습을 시작해보세요.`
        : "YouTube 영상을 AI로 분석하여 실전 영어를 학습하세요. 자막, 핵심 표현, AI 대화 연습까지!";
    const imageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        `https://${process.env.VERCEL_URL}` ||
        "https://your-domain.com";

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
            url: `${appUrl}/analysis/${videoId}`,
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

// 페이지 기본 컴포넌트
export default function AnalysisPage({ params }: Props) {
    // 이 페이지는 클라이언트 컴포넌트를 렌더링하는 껍데기 역할만 합니다.
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <AnalysisClientPage />
        </Suspense>
    );
}
