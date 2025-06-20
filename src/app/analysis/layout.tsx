// src/app/analysis/[videoId]/layout.tsx
import { Metadata } from "next";

// YouTube 영상 정보를 가져오는 함수 (서버 컴포넌트에서 직접 호출)
async function getYouTubeVideoTitle(videoId: string): Promise<string | null> {
    try {
        // 기존 api/youtube-data 라우트를 직접 fetch하여 사용
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube-data?videoId=${videoId}`,
            {
                // revalidate 옵션으로 캐싱 전략 설정 (예: 1시간마다 갱신)
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

interface AnalysisLayoutProps {
    children: React.ReactNode;
    params: { videoId: string };
}

// generateMetadata 함수는 서버 컴포넌트에서만 사용 가능합니다.
// 이 레이아웃은 기본적으로 서버 컴포넌트입니다.
export async function generateMetadata({
    params,
}: AnalysisLayoutProps): Promise<Metadata> {
    const videoId = params.videoId;
    const youtubeTitle = await getYouTubeVideoTitle(videoId);

    const title = youtubeTitle
        ? `YouTube 영상 ${youtubeTitle}으로 영어 공부하자! | AI English`
        : "YouTube 영상으로 영어 공부하자! | AI English";
    const description = youtubeTitle
        ? `${youtubeTitle} 영상을 AI로 분석하여 자막, 핵심 표현, AI 대화 연습까지! 효과적인 영어 학습을 시작해보세요.`
        : "YouTube 영상을 AI로 분석하여 실전 영어를 학습하세요. 자막, 핵심 표현, AI 대화 연습까지!";
    const imageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`; // YouTube 썸네일 사용

    return {
        title: title,
        description: description,
        keywords: [
            "영어학습",
            "YouTube 영어",
            "AI 영어교육",
            "영어회화",
            "영상학습",
            youtubeTitle || "", // 영상 제목도 키워드에 포함
        ].filter(Boolean), // null 또는 빈 문자열 제거
        openGraph: {
            title: title,
            description: description,
            url: `https://your-domain.com/analysis/${videoId}`, // 실제 배포 도메인으로 변경
            type: "website",
            images: [
                {
                    url: imageUrl,
                    width: 1280, // maxresdefault의 일반적인 너비
                    height: 720, // maxresdefault의 일반적인 높이
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

export default function AnalysisLayout({ children }: AnalysisLayoutProps) {
    return <>{children}</>; // page.tsx의 내용이 그대로 children으로 전달됩니다.
}
