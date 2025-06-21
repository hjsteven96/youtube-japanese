// src/app/analysis/[videoId]/page.tsx

import { Metadata } from "next";
import { Suspense } from "react";
import AnalysisClientPage from "./analysis-client-page";
import LoadingAnimation from "../../components/LoadingAnimation";

// generateMetadata 함수의 타입을 직접 명시합니다. (Props 인터페이스 사용 안 함)
export async function generateMetadata({
    params,
}: {
    params: { videoId: string };
}): Promise<Metadata> {
    const { videoId } = params;

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
            if (!res.ok) {
                console.error(
                    `YouTube API fetch failed for ${vid} with status: ${res.status}`
                );
                return null;
            }
            const data = await res.json();
            return data.youtubeTitle || null;
        } catch (error) {
            console.error("Error in getYouTubeVideoTitle:", error);
            return null;
        }
    }

    const youtubeTitle = await getYouTubeVideoTitle(videoId);

    const title = youtubeTitle
        ? `YouTube 영상 '${youtubeTitle}'으로 영어 공부 | AI English`
        : "YouTube 영상으로 영어 공부 | AI English";
    const description = youtubeTitle
        ? `'${youtubeTitle}' 영상을 AI로 분석하여 자막, 핵심 표현, AI 대화 연습으로 영어를 마스터하세요.`
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

// 페이지 컴포넌트의 타입도 직접 명시합니다. (Props 인터페이스 사용 안 함)
export default function AnalysisPage({
    params,
}: {
    params: { videoId: string };
}) {
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <AnalysisClientPage />
        </Suspense>
    );
}
