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
            "Analyze the provided video content and generate a structured JSON output. The JSON must contain two main fields: 'analysis' and 'transcript_text'.\n\nThe 'analysis' field must be an object containing:\n- 'summary': A very concise summary of the video content (1-2 sentences).\n- 'keywords': An array of 5 key terms that English learners might not know or find challenging.\n- 'slang_expressions': An array of objects, where each object has 'expression' and 'meaning'.\n- 'main_questions': An array of 2 main questions based on the video content.\n\nThe 'transcript_text' field must contain a detailed transcript of the video, adhering strictly to the following segmentation rules:\n1.  Each segment must begin with a timestamp in the EXACT format [MM:SS], followed immediately by the text. Example: '[00:05] This is the text at 5 seconds.'\n2.  Create a new timestamped segment for every change in speaker.\n3.  If a single person speaks for an extended period, create a new timestamped segment after a natural pause or a shift in topic.\n4.  Crucially, ensure that no single segment represents more than 90 seconds of video time. Aim for shorter, more frequent segments (ideally every 20-40 seconds) for better readability.\n5.  Do NOT include any other timestamps or time ranges within the transcript text itself.\n\nEnsure the entire output is a single, strictly valid JSON object.";

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
