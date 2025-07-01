import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { youtubeUrl } = await req.json();

    if (!youtubeUrl) {
        return NextResponse.json(
            { error: "YouTube URL is required" },
            { status: 400 }
        );
    }

    try {
        const url = new URL(youtubeUrl);
        const videoId = url.searchParams.get("v");

        if (!videoId) {
            return NextResponse.json(
                { error: "Invalid YouTube URL: video ID not found" },
                { status: 400 }
            );
        }

        const externalApiUrl = `https://yotube-caption-production-2f1e.up.railway.app/transcript?video_id=${videoId}`;

        const response = await fetch(externalApiUrl);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Failed to fetch transcript from external API: ${response.status} ${response.statusText} - ${errorText}`
            );
        }

        const transcriptData = await response.json();
        return NextResponse.json(transcriptData, { status: 200 });
    } catch (error: any) {
        console.error("[GET_EXTERNAL_TRANSCRIPT_API_ERROR]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
