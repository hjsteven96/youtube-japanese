import { NextRequest, NextResponse } from "next/server";
import ytdl from "ytdl-core";

export async function POST(req: NextRequest) {
    let requestBody;
    try {
        requestBody = await req.json();
    } catch (_error: unknown) {
        let errorMessage = "Invalid JSON in request body.";
        if (_error instanceof Error) {
            errorMessage = _error.message;
        }
        return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { youtubeUrl } = requestBody;

    if (!youtubeUrl) {
        return NextResponse.json(
            { error: "YouTube URL is required" },
            { status: 400 }
        );
    }

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

    if (!GOOGLE_API_KEY) {
        console.error("환경 변수 GOOGLE_API_KEY가 설정되지 않았습니다.");
        return NextResponse.json(
            { error: "Google API Key not configured" },
            { status: 500 }
        );
    } else {
        console.log("GOOGLE_API_KEY가 로드되었습니다.");
    }

    let youtubeTitle: string | null = null;
    let youtubeDescription: string | null = null;

    // YouTube Data API를 사용하여 영상 제목과 설명 가져오기
    const videoIdMatch = youtubeUrl.match(
        /(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (videoIdMatch && videoIdMatch[1] && YOUTUBE_DATA_API_KEY) {
        const videoId = videoIdMatch[1];
        try {
            const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_DATA_API_KEY}&part=snippet`;
            const youtubeApiResponse = await fetch(youtubeApiUrl);
            const youtubeApiData = await youtubeApiResponse.json();

            if (youtubeApiData.items && youtubeApiData.items.length > 0) {
                youtubeTitle = youtubeApiData.items[0].snippet.title;
                youtubeDescription =
                    youtubeApiData.items[0].snippet.description;
                console.log(
                    "YouTube Data API를 통해 영상 제목 가져옴:",
                    youtubeTitle
                );
                console.log(
                    "YouTube Data API를 통해 영상 설명 가져옴:",
                    youtubeDescription
                );
            } else {
                console.warn(
                    "YouTube Data API에서 영상 제목을 찾을 수 없습니다."
                );
            }
        } catch (youtubeApiError: unknown) {
            console.error("YouTube Data API 오류:", youtubeApiError);
        }
    } else {
        console.warn(
            "YouTube Data API 키가 없거나 YouTube URL에서 videoId를 추출할 수 없습니다. 영상 제목을 가져오지 않습니다."
        );
    }

    try {
        const geminiRequestBody = JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: "Analyze the provided video content and generate a structured JSON output. The JSON should contain two main fields: 'analysis' and 'transcript_text'. The 'analysis' field should be an object with 'summary' (a very concise summary, 1~2 sentences), 'keywords' (an array of key terms that English learners might not know or find challenging), 'slang_expressions' (an array of objects, each with 'expression' and 'meaning'), and 'main_questions' (an array of 2 main questions based on the video content). The 'transcript_text' field should contain a detailed transcript of the video, with EACH segment starting with a timestamp in the EXACT format [MM:SS] followed immediately by the corresponding text. For example: '[00:05] This is the text at 5 seconds.' Do NOT include any other timestamps or time ranges within the transcript text itself, only at the beginning of each segment. Ensure the entire output is strictly valid JSON.",
                        },
                        {
                            file_data: {
                                file_uri: youtubeUrl,
                                mime_type: "video/mp4", // Although YouTube URL, API expects a mime type. This is a common one.
                            },
                        },
                    ],
                },
            ],
            responseMimeType: "application/json",
            generationConfig: {
                maxOutputTokens: 65536,
            },
        });

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: geminiRequestBody,
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json(
                {
                    error: `Gemini API error: ${response.statusText}`,
                    details: errorData,
                },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log("Gemini API 원시 응답:", JSON.stringify(data, null, 2)); // 원시 응답 로깅
        let parsedContent;
        try {
            // Gemini API might return text that needs parsing to JSON
            let textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textContent) {
                // Remove markdown code block fences using a global replace
                textContent = textContent.replace(/```json|```/g, "").trim();

                // "summary" 필드 뒤에 콤마가 누락된 경우 수정
                // 이 수정은 특정 JSON 구조에 의존하며, 다른 오류에는 적용되지 않을 수 있습니다.
                textContent = textContent.replace(
                    /("summary":\s*"[^"]*")\s*("keywords":)/,
                    "$1,$2"
                );
                console.log("JSON 콤마 누락 수정 시도됨.");

                parsedContent = JSON.parse(textContent);

                // Ensure transcript_text is a single string, even if it comes as an array
                if (Array.isArray(parsedContent.transcript_text)) {
                    parsedContent.transcript_text =
                        parsedContent.transcript_text.join("\n");
                }
                parsedContent.youtubeTitle = youtubeTitle;
                parsedContent.youtubeDescription = youtubeDescription;
            } else {
                parsedContent = {
                    analysis: {
                        summary: "No content found.",
                        keywords: [],
                        slang_expressions: [],
                    },
                    transcript_text: "No transcript found.",
                    youtubeTitle: youtubeTitle,
                    youtubeDescription: youtubeDescription,
                };
            }
        } catch (_parseError: unknown) {
            console.error(
                "Failed to parse Gemini response as JSON:",
                _parseError
            );
            let errorMessage = "An unknown parsing error occurred.";
            if (_parseError instanceof Error) {
                errorMessage = _parseError.message;
            }
            return NextResponse.json(
                {
                    error: "Failed to parse Gemini API response as JSON",
                    details: errorMessage,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(parsedContent);
    } catch (_error: unknown) {
        let errorMessage = "Internal server error.";
        if (_error instanceof Error) {
            errorMessage = _error.message;
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
