// src/app/analysis/[videoId]/page.tsx

import { Metadata } from "next";
import { Suspense } from "react";
import AnalysisClientPage from "./analysis-client-page";
import LoadingAnimation from "../../components/LoadingAnimation";
import { getYoutubeVideoDetails } from "@/lib/youtube";

// ★★★ CORE CHANGE ★★★
// We are reverting to the original inline type definition for the props.
// This is a last-ditch effort to change how the Next.js analyzer "sees" this function.
export async function generateMetadata({
    params,
}: {
    params: { videoId: string };
}): Promise<Metadata> {
    const { videoId } = params;
    let youtubeTitle: string | null = null;
    let youtubeDescription: string | null = null;

    try {
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
        // Continue with default metadata on error
    }

    const defaultTitle = "YouTube 영상으로 영어 공부 | lingto";
    const defaultDescription =
        "YouTube 영상을 AI로 분석하여 실전 영어를 학습하세요. 자막, 핵심 표현, AI 대화 연습까지!";

    const title = youtubeTitle
        ? `Lingto | 유튜브로 영어 공부 하세요! - "${youtubeTitle}" `
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

// The page component takes no props, as the client component gets the ID via useParams.
export default function AnalysisPage() {
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <AnalysisClientPage />
        </Suspense>
    );
}
