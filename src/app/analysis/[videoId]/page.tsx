// src/app/analysis/[videoId]/page.tsx
import { Metadata } from "next";
import { Suspense } from "react";
import AnalysisClientPage from "./analysis-client-page";
import LoadingAnimation from "../../components/LoadingAnimation";
import { getYoutubeVideoDetails } from "@/lib/youtube";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // db 임포트
import { GeminiResponseData } from "./analysis-client-page"; // 타입 재사용
// ★★★ CORE CHANGE ★★★
// We are reverting to the original inline type definition for the props.
// This is a last-ditch effort to change how the Next.js analyzer "sees" this function.

async function getAnalysisData(videoId: string): Promise<GeminiResponseData | null> {
    try {
        const docRef = doc(db, "videoAnalyses", videoId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            // Firestore에서 가져온 데이터를 타입에 맞게 반환
            return docSnap.data() as GeminiResponseData;
        }
        return null;
    } catch (error) {
        console.error("Error fetching analysis data on server:", error);
        return null;
    }
}


export async function generateMetadata({
    params,
}: {
    params: { videoId: string };
}): Promise<Metadata> {
    const { videoId } = params;
    
    // getAnalysisData를 호출하거나 getYoutubeVideoDetails를 그대로 사용
    // 캐시된 분석 데이터에 youtubeTitle이 있다면 그것을 우선적으로 사용 가능
    const cachedData = await getAnalysisData(videoId);
    let youtubeTitle = cachedData?.youtubeTitle;

    if (!youtubeTitle) {
        try {
            const videoDetails = await getYoutubeVideoDetails(videoId);
            youtubeTitle = videoDetails?.youtubeTitle || null;
        } catch (error) {
            console.error(`Error in generateMetadata for videoId ${videoId}:`, error);
        }
    }

    const defaultTitle = "YouTube 영상으로 영어 공부 | Lingto";
    const defaultDescription =
        "YouTube 영상을 AI로 분석하여 실전 영어를 학습하세요. 자막, 핵심 표현, AI 대화 연습까지!";

    const title = youtubeTitle
        ? `Lingto | 유튜브로 영어 공부 하세요! - "${youtubeTitle}" `
        : defaultTitle;
    const description = youtubeTitle
        ? `'${youtubeTitle}' 영상의 AI 분석 결과, 자막, 핵심 표현으로 실전 영어를 마스터하세요.`
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
            "회화학습",
            "미드영어",
            "미드 자막",
            "영어 영상",
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

export default async function AnalysisPage({ params }: { params: { videoId: string } }) {
    const { videoId } = params;
    const initialAnalysisData = await getAnalysisData(videoId);

    return (
        <Suspense fallback={<LoadingAnimation />}>
            {/* initialAnalysisData를 props로 전달 */}
            <AnalysisClientPage initialAnalysisData={initialAnalysisData} />
        </Suspense>
    );
}