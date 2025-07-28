import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// 번역 세그먼트 인터페이스
interface TranslationSegment {
    timestamp: string;
    koreanTranslation: string;
}

// 파싱된 자막 세그먼트 인터페이스
interface ParsedSegment {
    timestamp: string;
    text: string;
    timeInSeconds: number;
}

/**
 * 짧은 한국어 번역 세그먼트들을 자동으로 병합합니다.
 * reduce를 사용한 간단하고 안정적인 구현
 * @param segments - 원본 번역 세그먼트 배열
 * @param minCharThreshold - 병합 기준이 되는 최소 글자 수
 * @returns 병합된 번역 세그먼트 배열
 */
function mergeShortTranslatedSegments(
    segments: TranslationSegment[],
    minCharThreshold: number = 5
): TranslationSegment[] {
    if (!segments || segments.length === 0) return [];

    // reduce를 사용하여 누산기(accumulator)에 병합된 결과를 쌓아갑니다.
    const mergedTimeline = segments.reduce<TranslationSegment[]>((acc, current) => {
        // 누산기의 마지막 요소를 가져옵니다.
        const lastSegment = acc.length > 0 ? acc[acc.length - 1] : null;

        // 현재 세그먼트가 짧고, 합칠 대상(lastSegment)이 있는 경우
        if (lastSegment && current.koreanTranslation.trim().length <= minCharThreshold) {
            // 마지막 세그먼트에 현재 세그먼트의 내용을 덧붙입니다.
            lastSegment.koreanTranslation += ` ${current.koreanTranslation.trim()}`;
        } else {
            // 현재 세그먼트가 길거나, 첫 번째 요소인 경우
            // 새로운 세그먼트로 누산기에 추가합니다. (원본 배열 수정을 방지하기 위해 복사)
            acc.push({ ...current });
        }
        
        return acc;
    }, []);

    return mergedTimeline;
}

/**
 * [HELPER 1] 자막을 겹치는 부분이 있는 여러 청크로 나눕니다.
 * @param segments - 전체 자막 세그먼트 배열
 * @param chunkSizeInSeconds - 각 청크의 기본 크기 (초). 120(2분)~180(3분)을 권장합니다.
 * @param overlapInSeconds - 청크 간 겹칠 시간 (초). 15초 정도가 적당합니다.
 * @returns 세그먼트 배열로 이루어진 2차원 배열 (청크 목록)
 */
function chunkSegmentsWithOverlap(
    segments: ParsedSegment[],
    chunkSizeInSeconds: number = 180,
    overlapInSeconds: number = 15
): ParsedSegment[][] {
    if (!segments.length) return [];

    const allChunks: ParsedSegment[][] = [];
    let currentStartIndex = 0;

    while (currentStartIndex < segments.length) {
        const startTime = segments[currentStartIndex].timeInSeconds;
        const endTime = startTime + chunkSizeInSeconds;

        // 현재 청크에 포함될 세그먼트 필터링
        const chunk = segments.filter(seg => 
            seg.timeInSeconds >= startTime && seg.timeInSeconds < endTime
        );
        
        if (chunk.length === 0) break;
        
        // 현재 청크의 시작 부분에 이전 청크의 끝부분을 겹치도록 추가 (첫 청크 제외)
        if (allChunks.length > 0) {
            const overlapStartTime = startTime - overlapInSeconds;
            const overlapSegments = segments.filter(seg => 
                seg.timeInSeconds >= overlapStartTime && seg.timeInSeconds < startTime
            );
            allChunks.push([...overlapSegments, ...chunk]);
        } else {
            allChunks.push(chunk);
        }

        // 다음 청크의 시작 인덱스 찾기
        const nextStartIndex = segments.findIndex(seg => seg.timeInSeconds >= endTime);
        if (nextStartIndex === -1) break; // 다음 청크가 없으면 종료
        
        currentStartIndex = nextStartIndex;
    }

    return allChunks;
}

/**
 * [HELPER 2] 타임스탬프 문자열 "[HH:MM:SS]" 또는 "[MM:SS]"를 초 단위 숫자로 변환합니다.
 * @param timestamp - 타임스탬프 문자열
 * @returns 초 단위 숫자
 */
function parseTimestampToSeconds(timestamp: string): number {
    const timeString = timestamp.replace(/\[|\]/g, '');
    const parts = timeString.split(':').map(Number);
    if (parts.length === 3) { // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) { // MM:SS
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { transcript, analysis, videoId } = body;

        if (!transcript || !videoId) {
            return NextResponse.json(
                { error: "Transcript and videoId are required" },
                { status: 400 }
            );
        }

        // 먼저 Firebase에서 기존 번역 데이터 확인
        try {
            const docRef = doc(db, "videoAnalyses", videoId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const existingData = docSnap.data();
                if (existingData.koreanTranslation) {
                    console.log(`[TRANSLATION_CACHE] 캐시된 번역 데이터 반환: ${videoId}`);
                    return NextResponse.json({ 
                        translation: existingData.koreanTranslation 
                    });
                }
            }
        } catch (firebaseError) {
            console.error("Firebase 캐시 확인 중 오류:", firebaseError);
            // Firebase 오류가 있어도 번역은 계속 진행
        }

        // 🔥 NEW WORKFLOW: 조립 라인(Assembly Line) 방식으로 변경
        console.log(`[TRANSLATION_NEW_WORKFLOW] 새로운 청킹 워크플로우 시작: ${videoId}`);

        // 1단계: 자막을 파싱하여 개별 타임스탬프 추출 (ParsedSegment 형태로)
        const parseTranscript = (transcript: string): ParsedSegment[] => {
            const regex = /\[(?:(\d{1,2}):)?(\d{2}):(\d{2})\]([^\[]*)/g;
            const matches = [...transcript.matchAll(regex)];
            const parsed: ParsedSegment[] = [];

            for (const match of matches) {
                const hours = match[1] ? parseInt(match[1], 10) : 0;
                const minutes = parseInt(match[2], 10);
                const seconds = parseInt(match[3], 10);
                const timeInSeconds = hours * 3600 + minutes * 60 + seconds;
                const text = match[4].trim();
                if (text) {
                    const timestamp = hours > 0 
                        ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                        : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    parsed.push({ 
                        timestamp: `[${timestamp}]`,
                        text,
                        timeInSeconds 
                    });
                }
            }
            return parsed;
        };

        const parsedSegments = parseTranscript(transcript);
        console.log(`[TRANSLATION_PARSING] 파싱된 세그먼트 수: ${parsedSegments.length}개`);

        // 2단계: 짧은 영상인지 긴 영상인지 판단 (3분 = 180초 기준)
        const totalDuration = parsedSegments.length > 0 
            ? parsedSegments[parsedSegments.length - 1].timeInSeconds 
            : 0;
        
        let finalTranslationData;
        
        if (totalDuration <= 180 || parsedSegments.length <= 20) {
            // 짧은 영상: 기존 방식 사용 (단일 요청)
            console.log(`[TRANSLATION_SHORT_VIDEO] 짧은 영상 감지 (${totalDuration}초), 단일 요청 방식 사용`);
            
            const prompt = `
당신은 전문 영상 자막 번역가입니다. 당신의 임무는 아래 영어 자막을 한국어로 번역하는 것입니다. 최종 결과물은 모든 타임스탬프가 유지되어야 하며, 각 줄의 번역을 모두 합쳤을 때 하나의 매우 자연스러운 문단이 되어야 합니다.

## 번역 규칙 (매우 중요):
1.  **문맥 예측 (Lookahead):** 한 줄을 번역하기 전에, 반드시 뒤따라오는 여러 줄을 먼저 읽어서 전체 문장의 완전한 의미를 파악하세요.
2.  **자연스러운 연결:** 각 타임스탬프의 번역 결과물이 다음 타임스탬프의 번역과 자연스럽게 연결되어야 합니다. 예를 들어, 문장이 끝나지 않았다면 "...했습니다. 그리고" 와 같이 번역하는 대신, "...했으며," 또는 "...했고," 처럼 연결되는 어미를 사용하세요.
3.  **구조 유지:** 절대 타임스탬프를 합치거나 누락하지 마세요. 입력으로 주어진 모든 타임스탬프에 대해 반드시 개별적인 한국어 번역을 제공해야 합니다.
4.  **의미 분배:** 파악한 전체 문장의 의미를 원본 영어 자막의 끊어진 위치에 맞게 한국어 번역에 자연스럽게 분배해주세요.

---

## 번역할 영어 자막 (타임스탬프별):
${parsedSegments.map(seg => `${seg.timestamp} ${seg.text}`).join('\n')}

---

## 응답 형식 (JSON):
응답은 반드시 다음 JSON 형식을 따라야 합니다.

{
  "timelineTranslation": [
    {
      "timestamp": "[00:15]",
      "koreanTranslation": "자연스러운 한국어 번역의 일부"
    }
  ]
}

중요: 모든 입력 타임스탬프에 대해 koreanTranslation을 제공해야 합니다.
`;

            const geminiRequestBody = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1008192,
                    responseMimeType: "application/json",
                },
            };

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(geminiRequestBody),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Gemini API error: ${errorData?.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!textContent) {
                throw new Error("No translation content received from Gemini API.");
            }

            try {
                const cleanedText = textContent.replace(/```json|```/g, "").trim();
                const translationData = JSON.parse(cleanedText);
                finalTranslationData = {
                    timelineTranslation: translationData.timelineTranslation || []
                };
            } catch (parseError: any) {
                console.error("Korean translation JSON 파싱 오류:", parseError.message);
                finalTranslationData = { timelineTranslation: [] };
            }
        } else {
            // 긴 영상: 새로운 청킹 방식 사용
            console.log(`[TRANSLATION_LONG_VIDEO] 긴 영상 감지 (${totalDuration}초), 청킹 방식 사용`);
            
            // 청킹별 번역 함수 (로컬 함수로 정의)
            const translateChunkLocal = async (chunk: ParsedSegment[], chunkIndex: number): Promise<TranslationSegment[]> => {
                const prompt = `
당신은 전문 영상 자막 번역가입니다. 당신의 임무는 아래 영어 자막을 한국어로 번역하는 것입니다. 최종 결과물은 모든 타임스탬프가 유지되어야 하며, 각 줄의 번역을 모두 합쳤을 때 하나의 매우 자연스러운 문단이 되어야 합니다.

## 번역 규칙 (매우 중요):
1.  **문맥 예측 (Lookahead):** 한 줄을 번역하기 전에, 반드시 뒤따라오는 여러 줄을 먼저 읽어서 전체 문장의 완전한 의미를 파악하세요.
2.  **자연스러운 연결:** 각 타임스탬프의 번역 결과물이 다음 타임스탬프의 번역과 자연스럽게 연결되어야 합니다. 예를 들어, 문장이 끝나지 않았다면 "...했습니다. 그리고" 와 같이 번역하는 대신, "...했으며," 또는 "...했고," 처럼 연결되는 어미를 사용하세요.
3.  **구조 유지:** 절대 타임스탬프를 합치거나 누락하지 마세요. 입력으로 주어진 모든 타임스탬프에 대해 반드시 개별적인 한국어 번역을 제공해야 합니다.
4.  **의미 분배:** 파악한 전체 문장의 의미를 원본 영어 자막의 끊어진 위치에 맞게 한국어 번역에 자연스럽게 분배해주세요.

---

## 번역할 영어 자막 (타임스탬프별):
${chunk.map(seg => `${seg.timestamp} ${seg.text}`).join('\\n')}

---

## 응답 형식 (JSON):
응답은 반드시 다음 JSON 형식을 따라야 합니다.

{
  "timelineTranslation": [
    {
      "timestamp": "[00:15]",
      "koreanTranslation": "자연스러운 한국어 번역의 일부"
    }
  ]
}

중요: 모든 입력 타임스탬프에 대해 koreanTranslation을 제공해야 합니다.
`;

                const geminiRequestBody = {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1008192,
                        responseMimeType: "application/json",
                    },
                };

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(geminiRequestBody),
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Gemini API error for chunk ${chunkIndex}: ${errorData?.error?.message || response.statusText}`);
                }

                const data = await response.json();
                const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

                if (!textContent) {
                    throw new Error(`No translation content received from Gemini API for chunk ${chunkIndex}.`);
                }

                try {
                    const cleanedText = textContent.replace(/```json|```/g, "").trim();
                    const translationData = JSON.parse(cleanedText);
                    return translationData.timelineTranslation || [];
                } catch (parseError: any) {
                    console.error(`Korean translation JSON 파싱 오류 for chunk ${chunkIndex}:`, parseError.message);
                    return [];
                }
            };

            // 재조합 함수 (로컬 함수로 정의)
            const stitchChunkResultsLocal = (chunkResults: TranslationSegment[][], originalSegments: ParsedSegment[]): TranslationSegment[] => {
                const stitched: TranslationSegment[] = [];
                const seenTimestamps = new Set<string>();

                // 모든 청크 결과를 순서대로 처리
                for (const chunkResult of chunkResults) {
                    for (const segment of chunkResult) {
                        // 중복 타임스탬프 제거 (overlap으로 인한 중복 처리)
                        if (!seenTimestamps.has(segment.timestamp)) {
                            seenTimestamps.add(segment.timestamp);
                            stitched.push(segment);
                        }
                    }
                }

                // 원본 세그먼트 순서와 일치하도록 정렬
                stitched.sort((a, b) => {
                    const timeA = parseTimestampToSeconds(a.timestamp);
                    const timeB = parseTimestampToSeconds(b.timestamp);
                    return timeA - timeB;
                });

                return stitched;
            };
            
            // 3단계: 청킹 (겹침 포함)
            const chunks = chunkSegmentsWithOverlap(parsedSegments, 180, 15); // 3분 청크, 15초 겹침
            console.log(`[TRANSLATION_CHUNKING] 생성된 청크 수: ${chunks.length}개`);
            
            // 4단계: 병렬 번역 (Promise.all 사용)
            console.log(`[TRANSLATION_PARALLEL] 병렬 번역 시작...`);
            const chunkTranslationPromises = chunks.map((chunk, index) => 
                translateChunkLocal(chunk, index)
            );
            
            const chunkResults = await Promise.all(chunkTranslationPromises);
            console.log(`[TRANSLATION_PARALLEL] 병렬 번역 완료. 결과 청크 수: ${chunkResults.length}개`);
            
            // 5단계: 재조합 (Stitching)
            const stitchedResults = stitchChunkResultsLocal(chunkResults, parsedSegments);
            console.log(`[TRANSLATION_STITCHING] 재조합 완료. 최종 세그먼트 수: ${stitchedResults.length}개`);
            
            finalTranslationData = {
                timelineTranslation: stitchedResults
            };
        }

        // 6단계: 후처리 - 짧은 세그먼트 병합
        if (finalTranslationData && finalTranslationData.timelineTranslation) {
            const originalLength = finalTranslationData.timelineTranslation.length;
            
            // 임계값(threshold)은 필요에 따라 조절할 수 있습니다 (예: 5글자, 7글자 등).
            const mergedTimeline = mergeShortTranslatedSegments(finalTranslationData.timelineTranslation, 5);

            // 가공된 데이터로 교체합니다.
            finalTranslationData.timelineTranslation = mergedTimeline;

            console.log(`[TRANSLATION_MERGE] 원본 세그먼트: ${originalLength}개 → 병합 후: ${mergedTimeline.length}개`);
        }

        const translationData = finalTranslationData;

        // Firebase에 번역 결과 저장
        try {
            const docRef = doc(db, "videoAnalyses", videoId);
            await setDoc(docRef, {
                koreanTranslation: translationData,
                translationTimestamp: serverTimestamp(),
            }, { merge: true }); // merge: true로 문서가 없으면 생성, 있으면 업데이트
            console.log(`[TRANSLATION_SAVE] 번역 결과 Firebase에 저장 완료: ${videoId}`);
        } catch (firebaseSaveError) {
            console.error("Firebase 번역 저장 중 오류:", firebaseSaveError);
            // 저장 실패해도 번역 결과는 반환
        }

        return NextResponse.json({ 
            translation: translationData 
        });

    } catch (error) {
        console.error("Korean translation error:", error);
        return NextResponse.json(
            { error: "한국어 번역 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}