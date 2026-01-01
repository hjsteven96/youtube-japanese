import { NextResponse } from "next/server";
import path from "path";
import kuromoji from "kuromoji";

type SegmentInput = {
    time: number;
    text: string;
};

type FuriganaToken = {
    surface: string;
    reading: string | null;
    hasKanji: boolean;
};

let tokenizerPromise:
    | Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>>
    | null = null;

const buildTokenizer = () => {
    if (!tokenizerPromise) {
        tokenizerPromise = new Promise((resolve, reject) => {
            kuromoji
                .builder({
                    dicPath: path.join(process.cwd(), "node_modules/kuromoji/dict"),
                })
                .build((err, tokenizer) => {
                    if (err || !tokenizer) {
                        reject(err || new Error("Failed to build tokenizer"));
                        return;
                    }
                    resolve(tokenizer);
                });
        });
    }
    return tokenizerPromise;
};

const containsKanji = (text: string) => /[一-龯々]/.test(text);

const toHiragana = (katakana: string) =>
    katakana.replace(/[ァ-ン]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const segments: SegmentInput[] = Array.isArray(body?.segments)
            ? body.segments
            : [];

        if (segments.length === 0) {
            return NextResponse.json(
                { error: "segments is required" },
                { status: 400 }
            );
        }

        const tokenizer = await buildTokenizer();
        const processed = segments.map((segment) => {
            const tokens = tokenizer.tokenize(segment.text);
            const mapped: FuriganaToken[] = tokens.map((token) => {
                const surface = token.surface_form || "";
                const hasKanji = containsKanji(surface);
                const readingRaw =
                    token.reading && token.reading !== "*" ? token.reading : null;
                const reading =
                    hasKanji && readingRaw ? toHiragana(readingRaw) : null;
                return {
                    surface,
                    reading,
                    hasKanji: Boolean(hasKanji && reading),
                };
            });

            return {
                time: segment.time,
                tokens: mapped,
            };
        });

        return NextResponse.json({ segments: processed });
    } catch (error) {
        console.error("Furigana API error:", error);
        return NextResponse.json(
            { error: "Failed to generate furigana" },
            { status: 500 }
        );
    }
}
