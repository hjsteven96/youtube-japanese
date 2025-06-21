// src/app/api/youtube-data/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getYoutubeVideoDetails } from "@/lib/youtube"; // ★ 1단계에서 만든 함수를 임포트

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
        return NextResponse.json(
            { error: "Video ID is required" },
            { status: 400 }
        );
    }

    try {
        const videoDetails = await getYoutubeVideoDetails(videoId);

        if (videoDetails) {
            return NextResponse.json(videoDetails);
        } else {
            return NextResponse.json(
                { error: "Video not found on YouTube" },
                { status: 404 }
            );
        }
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to fetch YouTube video data." },
            { status: 500 }
        );
    }
}
