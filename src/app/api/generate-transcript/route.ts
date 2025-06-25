// src/app/api/generate-transcript/route.ts
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export async function POST(req: NextRequest) {
    const { youtubeUrl } = await req.json();

    if (!youtubeUrl) {
        return NextResponse.json(
            { error: "YouTube URL is required" },
            { status: 400 }
        );
    }

    const prompt = `
    Generate a detailed, timestamped transcript for the provided video.
    Rules:
    1. Each segment must begin with a timestamp in the EXACT format [MM:SS].
    2. Create new timestamped segments for speaker changes or natural pauses.
    3. Ensure no single segment is longer than 30 seconds. Aim for shorter, frequent segments (10-15 seconds).
    4. The output must be ONLY the transcript text, without any JSON structure or other text.
    `;

    try {
        const geminiRequestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            file_data: {
                                file_uri: youtubeUrl,
                                mime_type: "video/mp4",
                            },
                        },
                    ],
                },
            ],
            generationConfig: {
                maxOutputTokens: 8192,
                // JSON 모드를 사용하지 않고 순수 텍스트를 받습니다.
                responseMimeType: "text/plain",
            },
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(geminiRequestBody),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${errorData?.error?.message}`);
        }

        const data = await response.json();
        const transcript_text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!transcript_text) {
            throw new Error("No transcript content received from Gemini API.");
        }

        return NextResponse.json({ transcript_text }, { status: 200 });
    } catch (error: any) {
        console.error("[GENERATE_TRANSCRIPT_API_ERROR]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
