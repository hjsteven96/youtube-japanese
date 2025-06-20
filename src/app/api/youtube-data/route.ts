import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
        return NextResponse.json(
            { error: "Video ID is required" },
            { status: 400 }
        );
    }

    const YOUTUBE_DATA_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_DATA_API_KEY;

    if (!YOUTUBE_DATA_API_KEY) {
        console.error("환경 변수 YOUTUBE_DATA_API_KEY가 설정되지 않았습니다.");
        return NextResponse.json(
            { error: "YouTube Data API Key not configured" },
            { status: 500 }
        );
    }

    try {
        const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_DATA_API_KEY}&part=snippet`;
        const youtubeApiResponse = await fetch(youtubeApiUrl);
        const youtubeApiData = await youtubeApiResponse.json();

        if (youtubeApiData.items && youtubeApiData.items.length > 0) {
            const snippet = youtubeApiData.items[0].snippet;
            return NextResponse.json({
                youtubeTitle: snippet.title,
                youtubeDescription: snippet.description,
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
