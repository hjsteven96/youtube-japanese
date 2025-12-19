// src/app/api/analyze-transcript/route.ts
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export async function POST(req: NextRequest) {
    const { transcript_text } = await req.json();

    if (!transcript_text) {
        return NextResponse.json(
            { error: "Transcript text is required" },
            { status: 400 }
        );
    }

    // [수정] 따옴표 이스케이프 규칙을 명시적으로 추가하여 JSON 오류 가능성 감소
    const prompt = `
    Based on the provided Japanese transcript, generate a structured JSON object for a Korean-speaking Japanese learner.

    **CRITICAL RULE:** All string values within the JSON output MUST have internal double quotes properly escaped with a backslash (e.g., "He said, \\"Hi!\\""). This is essential for valid JSON.

    The JSON object must contain the following keys:
    - 'summary': A concise summary of the video content in KOREAN (1-2 sentences).
    - 'keywords': An array of 5 key Japanese terms that would be useful for a learner.
    - 'slang_expressions': An array of objects, where each object has an 'expression' (the Japanese slang/idiom) and a 'meaning' (its explanation in KOREAN).
    - 'main_questions': An array of 2 main questions in JAPANESE based on the video's content, designed to encourage speaking practice. Each question must be a single, distinct question. Ensure they are concise, simple, and easy to understand, focusing on comprehension rather than rote memorization.
    `;

    try {
        const geminiRequestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        { text: `Transcript: """${transcript_text}"""` },
                    ],
                },
            ],
            generationConfig: {
                responseMimeType: "application/json",
                // 기존 스키마를 그대로 활용합니다.
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        summary: { type: "STRING" },
                        keywords: { type: "ARRAY", items: { type: "STRING" } },
                        slang_expressions: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    expression: { type: "STRING" },
                                    meaning: { type: "STRING" },
                                },
                                required: ["expression", "meaning"],
                            },
                        },
                        main_questions: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                        },
                    },
                    required: [
                        "summary",
                        "keywords",
                        "slang_expressions",
                        "main_questions",
                    ],
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
            throw new Error(
                `Gemini API error: ${
                    errorData?.error?.message || response.statusText
                }`
            );
        }

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textContent) {
            throw new Error("No analysis content received from Gemini API.");
        }

        // [수정] 안전한 파싱을 위한 try-catch 블록 추가
        let analysis;
        try {
            // API가 ```json``` 마크다운을 포함할 경우를 대비해 제거
            const cleanedText = textContent.replace(/```json|```/g, "").trim();
            analysis = JSON.parse(cleanedText);
        } catch (parseError: any) {
            // 파싱 실패 시, 오류와 원본 텍스트를 로그로 남깁니다.
            console.error(
                "[ANALYZE_TRANSCRIPT_PARSE_ERROR] Failed to parse Gemini JSON response:",
                parseError.message
            );
            console.error(
                "[ANALYZE_TRANSCRIPT_PARSE_ERROR] Problematic textContent:",
                textContent
            );
            // 클라이언트에게 전송할 에러
            throw new Error(
                "AI가 생성한 분석 데이터의 형식이 올바르지 않습니다."
            );
        }

        return NextResponse.json({ analysis }, { status: 200 });
    } catch (error: any) {
        // 최상위 에러 핸들러
        console.error("[ANALYZE_TRANSCRIPT_API_ERROR]", error);
        return NextResponse.json(
            {
                error:
                    error.message ||
                    "An unknown internal server error occurred.",
            },
            { status: 500 }
        );
    }
}
