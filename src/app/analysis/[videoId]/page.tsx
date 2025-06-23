// src/app/analysis/[videoId]/page.tsx

import { Metadata } from "next";
import { Suspense } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getYoutubeVideoDetails } from "@/lib/youtube";

import AnalysisPageWrapper, { GeminiResponseData } from "./analysis-client-page";
import LoadingAnimation from "../../components/LoadingAnimation";

/**
 * 서버에서 Firestore에 캐시된 분석 데이터를 가져옵니다.
 */
async function getAnalysisData(videoId: string): Promise<GeminiResponseData | null> {
    try {
        const docRef = doc(db, "videoAnalyses", videoId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as GeminiResponseData;
        }
        return null;
    } catch (error) {
        console.error("Error fetching analysis data on server:", error);
        return null;
    }
}

/**
 * 페이지 메타데이터를 동적으로 생성합니다.
 */
export async function generateMetadata({
    params,
}: {
    params: { videoId: string };
}): Promise<Metadata> {
    const { videoId } = params;
    const cachedData = await getAnalysisData(videoId);
    
    let youtubeTitle = cachedData?.youtubeTitle;

    // 캐시된 데이터에 제목이 없으면 YouTube API에서 다시 가져옵니다.
    if (!youtubeTitle) {
        try {
            const videoDetails = await getYoutubeVideoDetails(videoId);
            youtubeTitle = videoDetails?.youtubeTitle || null;
        } catch (error) {
            console.error(`Error in generateMetadata for videoId ${videoId}:`, error);
        }
    }

    const title = youtubeTitle
        ? `${youtubeTitle} - AI 영어 분석 노트 | Ling:to`
        : "AI 영어 학습 | Ling:to";
        
    const description = youtubeTitle
        ? `'${youtubeTitle}' 영상의 AI 분석 결과, 전체 자막, 핵심 표현으로 실전 영어를 마스터하세요.`
        : "YouTube 영상을 AI로 분석하여 실전 영어를 학습하세요. 자막, 핵심 표현, AI 대화 연습까지!";
    
    const imageUrl = cachedData?.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || "https://your-domain.com";

    return {
        title,
        description,
        keywords: [
            "영어학습", "YouTube 영어", "AI 영어교육", "영어회화", "미드 영어",
            "영어 쉐도잉", "영어 자막", youtubeTitle || "", ...(cachedData?.analysis?.keywords || [])
        ].filter(Boolean),
        openGraph: {
            title,
            description,
            url: `${appUrl}/analysis/${videoId}`,
            type: "website",
            images: [{ url: imageUrl, width: 1280, height: 720, alt: youtubeTitle || "Video Thumbnail" }],
            siteName: "Ling:to - AI English Learning",
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [imageUrl],
        },
    };
}

/**
 * 페이지 컴포넌트: 데이터를 가져와 클라이언트 컴포넌트에 props로 전달합니다.
 */
export default async function AnalysisPage({ params }: { params: { videoId: string } }) {
    const { videoId } = params;
    const initialAnalysisData = await getAnalysisData(videoId);

    /**
     * LearningResource 스키마 JSON-LD를 생성합니다.
     */
    const generateLearningResourceSchema = (data: GeminiResponseData | null) => {
        if (!data || !data.youtubeTitle) return null;

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`;
        const pageUrl = `${appUrl}/analysis/${videoId}`;
        const learningKeywords = data.analysis.keywords.join(', ');
        const learningExpressions = data.analysis.slang_expressions.map(e => e.expression).join(', ');
        const timeRequired = data.duration ? `PT${Math.floor(data.duration / 60)}M${data.duration % 60}S` : undefined;

        return {
            "@context": "https://schema.org",
            "@type": "LearningResource",
            "name": `${data.youtubeTitle} - AI 영어 학습 노트`,
            "description": `"${data.youtubeTitle}" 유튜브 영상으로 배우는 실전 영어. AI가 분석한 핵심 표현(${learningExpressions})과 단어(${learningKeywords}), 전체 자막을 제공합니다.`,
            "url": pageUrl,
            "image": data.thumbnailUrl,
            "author": { "@type": "Organization", "name": "Ling:to" },
            "publisher": { "@type": "Organization", "name": "Ling:to" },
            "inLanguage": "ko",
            "learningResourceType": "자막 분석",
            "educationalUse": "언어 학습, 영어 회화, 듣기 연습",
            "timeRequired": timeRequired,
            "isBasedOn": {
                "@type": "VideoObject",
                "name": data.youtubeTitle,
                "url": `https://www.youtube.com/watch?v=${videoId}`,
                "description": data.youtubeDescription || data.analysis.summary,
                "thumbnailUrl": data.thumbnailUrl,
                "duration": timeRequired
            }
        };
    };

    const learningResourceSchema = generateLearningResourceSchema(initialAnalysisData);

    return (
        <>
            {/* 생성된 JSON-LD 스크립트를 페이지에 삽입 */}
            {learningResourceSchema && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(learningResourceSchema) }}
                />
            )}

            <Suspense fallback={<LoadingAnimation />}>
                <AnalysisPageWrapper initialAnalysisData={initialAnalysisData} />
            </Suspense>
        </>
    );
}