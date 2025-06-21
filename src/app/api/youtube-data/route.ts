// src/app/api/youtube-data/route.ts
import { NextRequest, NextResponse } from "next/server";

// ISO 8601 duration format (e.g., PT1M30S) to seconds
function parseDuration(duration: string): number {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
        return NextResponse.json(
            { error: "Video ID is required" },
            { status: 400 }
        );
    }

    // **중요**: 환경변수 이름이 YOUTUBE_DATA_API_KEY로 통일되어야 합니다.
    const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

    if (!YOUTUBE_DATA_API_KEY) {
        console.error("환경 변수 YOUTUBE_DATA_API_KEY가 설정되지 않았습니다.");
        return NextResponse.json(
            { error: "YouTube Data API Key not configured" },
            { status: 500 }
        );
    }

    try {
        // 'contentDetails' 파트를 추가하여 영상 길이를 가져옵니다.
        const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_DATA_API_KEY}&part=snippet,contentDetails`;
        const youtubeApiResponse = await fetch(youtubeApiUrl);
        const youtubeApiData = await youtubeApiResponse.json();

        if (youtubeApiData.items && youtubeApiData.items.length > 0) {
            const item = youtubeApiData.items[0];
            const snippet = item.snippet;
            const durationISO = item.contentDetails?.duration;
            const durationInSeconds = durationISO
                ? parseDuration(durationISO)
                : 0;

            return NextResponse.json({
                youtubeTitle: snippet.title,
                youtubeDescription: snippet.description,
                duration: durationInSeconds, // 초 단위 영상 길이 추가
            });
        } else {
            return NextResponse.json(
                { error: "Video not found on YouTube" },
                { status: 404 }
            );
        }
    } catch (error: unknown) {
        console.error("YouTube Data API 오류:", error);
        let errorMessage = "Failed to fetch YouTube video data.";
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
