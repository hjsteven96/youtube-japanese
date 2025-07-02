// src/app/api/generate-transcript/route.ts
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const DOWNSUB_API_KEY = process.env.DOWNSUB_API_KEY; // DownSub API 키 추가

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

    // DownSub API에서 자막 가져오기 시도
    try {
        if (!DOWNSUB_API_KEY) {
            throw new Error("DOWNSUB_API_KEY is not set.");
        }

        const downsubResponse = await fetch('https://api.downsub.com/download', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DOWNSUB_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: youtubeUrl })
        });

        if (!downsubResponse.ok) {
            const errorData = await downsubResponse.json();
            throw new Error(`DownSub API error: ${downsubResponse.status} - ${errorData?.message || 'Unknown error'}`);
        }

        const downsubData = await downsubResponse.json();

        if (downsubData.status === "success" && downsubData.data && downsubData.data.subtitles) {
            // 영어 자막 또는 첫 번째 사용 가능한 자막 찾기
            const englishSubtitle = downsubData.data.subtitles.find((sub: any) => sub.language === "English") || downsubData.data.subtitles[0];

            if (englishSubtitle) {
                const srtFormat = englishSubtitle.formats.find((format: any) => format.format === "srt"); // .srt 형식 찾기
                if (srtFormat && srtFormat.url) {
                    const subtitleTextResponse = await fetch(srtFormat.url);
                    if (!subtitleTextResponse.ok) {
                        throw new Error(`Failed to fetch subtitle text from ${srtFormat.url}`);
                    }
                    const srtContent = await subtitleTextResponse.text();

                    // SRT 내용을 [HH:MM:SS] Text 또는 [MM:SS] Text 형식으로 파싱
                    const srtSegments = srtContent.split(/\n\s*\n/);
                    transcript_text = srtSegments.map(segment => {
                        const lines = segment.trim().split('\n');
                        if (lines.length >= 2) {
                            const timeLine = lines[1]; // 시간 정보 라인
                            const textLines = lines.slice(2); // 자막 텍스트 라인

                            // SRT 시간 형식 (HH:MM:SS,ms)에서 HH:MM:SS 추출
                            const timeMatch = timeLine.match(/^(\d{2}):(\d{2}):(\d{2})/);
                            if (timeMatch) {
                                const hours = parseInt(timeMatch[1], 10);
                                const minutes = parseInt(timeMatch[2], 10);
                                const seconds = parseInt(timeMatch[3], 10);

                                let formattedTime = '';
                                if (hours > 0) {
                                    formattedTime = `[${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;
                                } else {
                                    formattedTime = `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;
                                }
                                return `${formattedTime} ${textLines.join(' ').replace(/\s+/g, ' ').trim()}`;
                            }
                        }
                        return null; // 파싱 실패 시 null 반환
                    }).filter(Boolean).join('\n'); // null 값 제거 및 줄바꿈으로 연결

                } else {
                    throw new Error("No .srt subtitle format found.");
                }
            } else {
                throw new Error("No subtitles found for the specified video.");
            }
        } else {
            throw new Error(`DownSub API returned an error or no data: ${downsubData.message || 'Unknown error'}`);
        }
    } catch (error: any) {
        console.error("[GET_DOWNSUB_TRANSCRIPT_API_ERROR] Fallback to Gemini API:", error.message);
        // Fallback to Gemini API if DownSub API fails or returns no data
        const prompt = `
        Generate a detailed, timestamped transcript for the provided video.
        Rules:
        1. Each segment must begin with a timestamp in the format [HH:MM:SS] if the time is 1 hour or more, or [MM:SS] if less than 1 hour. Always use two digits for minutes and seconds.
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
                    maxOutputTokens: 100000,
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
