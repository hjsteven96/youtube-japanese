// src/app/analysis/[videoId]/page.tsx

import { Metadata } from "next";
import { Suspense } from "react";
import AnalysisClientPage from "./analysis-client-page";
import LoadingAnimation from "../../components/LoadingAnimation";

// ★ 1. 직접 호출할 함수를 lib 폴더에서 임포트합니다.
// (이 파일을 먼저 생성해야 합니다. 이전 답변 내용을 참고하세요.)
import { getYoutubeVideoDetails } from "@/lib/youtube";

// generateMetadata 함수의 타입을 직접 명시합니다.
export async function generateMetadata({
    params,
}: {
    params: { videoId: string };
}): Promise<Metadata> {
    const { videoId } = params;
    let youtubeTitle: string | null = null;
    let youtubeDescription: string | null = null;

    try {
        // ★ 2. fetch 대신, 분리된 함수를 직접 호출합니다.
        const videoDetails = await getYoutubeVideoDetails(videoId);
        if (videoDetails) {
            youtubeTitle = videoDetails.youtubeTitle;
            youtubeDescription = videoDetails.youtubeDescription;
        }
    } catch (error) {
        console.error(
            `Error in generateMetadata for videoId ${videoId}:`,
            error
        );
        // 에러가 발생해도 기본적인 메타데이터를 제공할 수 있도록 null 값을 유지합니다.
    }

    // ★ 3. 가져온 youtubeTitle과 youtubeDescription을 사용하여 메타데이터를 동적으로 생성합니다.
    const defaultTitle = "YouTube 영상으로 영어 공부 | AI English";
    const defaultDescription =
        "YouTube 영상을 AI로 분석하여 실전 영어를 학습하세요. 자막, 핵심 표현, AI 대화 연습까지!";

    const title = youtubeTitle
        ? `"${youtubeTitle}"으로 영어 공부 | AI English`
        : defaultTitle;
    const description = youtubeTitle
        ? `'${youtubeTitle}' 영상을 AI로 분석하여 영어를 마스터하세요.`
        : defaultDescription;

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

// 페이지 컴포넌트의 타입도 직접 명시합니다.
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
