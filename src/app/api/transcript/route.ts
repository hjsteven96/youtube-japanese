// src/app/api/transcript/route.ts
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.error("CRITICAL: GOOGLE_API_KEY environment variable is not set.");
}

export async function POST(req: NextRequest) {
    try {
        const { youtubeUrl } = await req.json();

        if (!youtubeUrl) {
            return NextResponse.json(
                { error: "YouTube URL is required" },
                { status: 400 }
            );
        }

        const prompt =
            "Analyze the provided video content and generate a structured JSON output. The JSON should contain two main fields: 'analysis' and 'transcript_text'. The ' analysis' field should be an object with 'summary' (a very concise summary, 1~2 sentences), 'keywords' (an array of 5 key terms that English learners might not know or find challenging), 'slang_expressions' (an array of objects, each with 'expression' and 'meaning'), and 'main_questions' (an array of 2 main questions based on the video content). The 'transcript_text' field should contain a detailed transcript of the video, with EACH segment starting with a timestamp in the EXACT format [MM:SS] followed immediately by the corresponding text. For example: '[00:05] This is the text at 5 seconds.' Do NOT include any other timestamps or time ranges within the transcript text itself, only at the beginning of each segment. Ensure the entire output is strictly valid JSON.";

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
                responseMimeType: "application/json",

                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        analysis: {
                            type: "OBJECT",
                            properties: {
                                summary: { type: "STRING" },
                                keywords: {
                                    type: "ARRAY",
                                    items: { type: "STRING" },
                                },
                                slang_expressions: {
                                    type: "ARRAY",
                                    items: {
                                        type: "OBJECT",
                                        properties: {
                                            expression: { type: "STRING" },
                                            meaning: { type: "STRING" },
                                        },
                                        propertyOrdering: [
                                            "expression",
                                            "meaning",
                                        ],
                                    },
                                },
                                main_questions: {
                                    type: "ARRAY",
                                    items: { type: "STRING" },
                                },
                            },
                            propertyOrdering: [
                                "summary",
                                "keywords",
                                "slang_expressions",
                                "main_questions",
                            ],
                        },
                        transcript_text: { type: "STRING" },
                    },
                    propertyOrdering: ["analysis", "transcript_text"],
                },
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
            const errorMessage =
                errorData?.error?.message || response.statusText;
            throw new Error(`Gemini API error: ${errorMessage}`);
        }

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textContent) {
            throw new Error("No content received from Gemini API.");
        }

        const cleanedText = textContent.replace(/```json|```/g, "").trim();
        const parsedContent = JSON.parse(cleanedText);

        return NextResponse.json(parsedContent, { status: 200 });
    } catch (error: unknown) {
        console.error("[TRANSCRIPT_API_ERROR]", error);
        const errorMessage =
            error instanceof Error
                ? error.message
                : "An unknown internal server error occurred.";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
