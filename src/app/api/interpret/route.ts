import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const { selectedText, summary, fullSentence } = await request.json();

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return NextResponse.json(
            { error: "Google API Key not configured." },
            { status: 500 }
        );
    }

    try {
        const geminiRequestBody = JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: `영상 요약: "${summary}" 및 전체 문장: "${fullSentence}"의 맥락에서, 드래그된 텍스트 "${selectedText}"의 의미를 가장 자연스러운 한국어로 해석해줘. 해석 외에 다른 설명은 일절 포함하지 마. 순수 텍스트만 제공하고 마크다운 형식은 사용하지 마.`,
                        },
                    ],
                },
            ],
        });

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${GEMINI_API_KEY}`,
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
        const interpretation =
            data.candidates?.[0]?.content?.parts?.[0]?.text ||
            "No interpretation found.";

        return NextResponse.json({ interpretation }, { status: 200 });
    } catch (error: any) {
        console.error("Error calling Gemini API:", error);
        return NextResponse.json(
            { error: "Failed to interpret text with AI." },
            { status: 500 }
        );
    }
}
