// src/app/analysis/[videoId]/page.tsx

// 서버 컴포넌트에는 "use client"가 없습니다.

import { Metadata } from "next";
import { Suspense } from "react";
import AnalysisClientPage from "./analysis-client-page"; // 클라이언트 컴포넌트를 import 합니다.
import LoadingAnimation from "../../components/LoadingAnimation";

// ★★★ 핵심 수정 부분 ★★★
// 1. 직접 정의했던 'Props' 타입을 제거합니다.
// 2. generateMetadata 함수의 인자에 직접 타입을 명시합니다.
export async function generateMetadata({
    params,
}: {
    params: { videoId: string };
}): Promise<Metadata> {
    const videoId = params.videoId;

    // 이 부분은 기존 로직을 그대로 사용합니다.
    async function getYouTubeVideoTitle(
        videoId: string
    ): Promise<string | null> {
        try {
            // NEXT_PUBLIC_APP_URL이 설정되지 않은 경우를 대비하여 기본 URL을 제공합니다.
            const baseUrl =
                process.env.NEXT_PUBLIC_APP_URL ||
                process.env.VERCEL_URL ||
                "http://localhost:3000";
            const res = await fetch(
                `${baseUrl}/api/youtube-data?videoId=${videoId}`,
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

    // NEXT_PUBLIC_APP_URL이 설정되지 않은 경우를 대비하여 기본 URL을 제공합니다.
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

// 페이지 기본 컴포넌트 - 실제 UI는 클라이언트 컴포넌트에 위임합니다.
// ★★★ 이름 충돌을 피하기 위해 클라이언트 컴포넌트의 export default 이름을 변경했습니다.
// analysis-client-page.tsx 파일에서 export default function AnalysisPage() -> export default function AnalysisPageWrapper() 로 변경해주세요.
// 하지만 지금은 이 파일만 수정해도 빌드는 통과될 것입니다.
export default function AnalysisPage() {
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <AnalysisClientPage />
        </Suspense>
    );
}
