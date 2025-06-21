// src/app/analysis/[videoId]/layout.tsx

import { Metadata } from "next";
import type { ReactNode } from "react";

// YouTube 영상 정보를 가져오는 함수 (서버 컴포넌트에서 직접 호출)
async function getYouTubeVideoTitle(videoId: string): Promise<string | null> {
    // ... (이 함수는 변경할 필요가 없습니다)
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube-data?videoId=${videoId}`,
            {
                next: { revalidate: 3600 },
            }
        );

        if (!res.ok) {
            console.error(
                `Failed to fetch YouTube data: ${res.status} ${res.statusText}`
            );
            return null;
        }

        const data = await res.json();
        return data.youtubeTitle || null;
    } catch (error) {
        console.error("Error fetching YouTube video title for SEO:", error);
        return null;
    }
}

// 1. generateMetadata를 위한 Props 타입 정의
type Props = {
    params: { videoId: string };
};

// generateMetadata 함수는 이 Props 타입을 사용합니다.
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
        title: title,
        description: description,
        keywords: [
            "영어학습",
            "YouTube 영어",
            "AI 영어교육",
            "영어회화",
            "영상학습",
            youtubeTitle || "",
        ].filter(Boolean),
        openGraph: {
            title: title,
            description: description,
            url: `https://your-domain.com/analysis/${videoId}`, // 실제 배포 도메인으로 변경
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
            title: title,
            description: description,
            images: [imageUrl],
        },
    };
}

// 2. AnalysisLayout 컴포넌트는 필요한 props만 직접 인라인으로 정의합니다.
// 이 컴포넌트는 params를 사용하지 않으므로 children만 받도록 수정합니다.
export default function AnalysisLayout({ children }: { children: ReactNode }) {
    // page.tsx의 내용이 그대로 children으로 전달됩니다.
    // 레이아웃 자체는 특별한 구조가 필요 없으므로 children만 렌더링합니다.
    return <>{children}</>;
}
