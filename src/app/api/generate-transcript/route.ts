// src/app/api/generate-transcript/route.ts
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export async function POST(req: NextRequest) {
    let requestBody;
    try {
        const rawBody = await req.text(); // 본문을 텍스트로 먼저 읽습니다.
        console.log("[GENERATE_TRANSCRIPT_API] Received raw body:", rawBody);
        requestBody = JSON.parse(rawBody);
    } catch (parseError: any) {
        console.error("[GENERATE_TRANSCRIPT_API_ERROR] Failed to parse request body:", parseError.message);
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { youtubeUrl } = requestBody;

    if (!youtubeUrl) {
        return NextResponse.json(
            { error: "YouTube URL is required" },
            { status: 400 }
        );
    }

    let transcript_text: string | undefined;

    // Try fetching from the external transcript API first
    try {
        const url = new URL(youtubeUrl);
        const videoId = url.searchParams.get("v");

        if (!videoId) {
            console.error("[GENERATE_TRANSCRIPT_API_ERROR] Invalid YouTube URL: video ID not found.", youtubeUrl);
            return NextResponse.json(
                { error: "Invalid YouTube URL: video ID not found." },
                { status: 400 }
            );
        }

        const externalApiUrl = `https://yotube-caption-production.up.railway.app/transcript?video_id=${videoId}`;
        const externalResponse = await fetch(externalApiUrl);

        if (!externalResponse.ok) {
            const errorText = await externalResponse.text();
            throw new Error(`External API error: ${externalResponse.status} ${externalResponse.statusText} - ${errorText}`);
        }

        const externalData: { text: string; start: number; duration: number }[] = await externalResponse.json();

        if (externalData && externalData.length > 0) {
            transcript_text = externalData.map(segment => {
                const minutes = Math.floor(segment.start / 60);
                const seconds = Math.floor(segment.start % 60);
                const formattedTime = `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;
                return `${formattedTime} ${segment.text}`;
            }).join('\n');
        } else {
            throw new Error("No transcript content received from external API.");
        }
    } catch (error: any) {
        console.error("[GET_EXTERNAL_TRANSCRIPT_API_ERROR] Fallback to Gemini API:", error.message);
        // Fallback to Gemini API if external API fails or returns no data
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
            transcript_text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!transcript_text) {
                throw new Error("No transcript content received from Gemini API.");
            }
        } catch (geminiError: any) {
            console.error("[GENERATE_TRANSCRIPT_API_ERROR] All transcript sources failed:", geminiError);
            return NextResponse.json({ error: `Failed to generate transcript: ${geminiError.message}` }, { status: 500 });
        }
    }

    if (transcript_text) {
        console.log("[GENERATE_TRANSCRIPT_API] Final transcript_text:", transcript_text);
        return NextResponse.json({ transcript_text }, { status: 200 });
    } else {
        return NextResponse.json({ error: "Failed to retrieve transcript from all sources." }, { status: 500 });
    }
}
