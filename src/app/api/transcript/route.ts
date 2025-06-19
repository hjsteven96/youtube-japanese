import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  let requestBody;
  try {
    requestBody = await req.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const { youtubeUrl } = requestBody;

  if (!youtubeUrl) {
    return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
  }

  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

  if (!GOOGLE_API_KEY) {
    return NextResponse.json({ error: 'Google API Key not configured' }, { status: 500 });
  }

  try {

    const geminiRequestBody = JSON.stringify({
      contents: [{
        parts: [
          { text: "Analyze the provided video content and generate a structured JSON output. The JSON should contain two main fields: 'analysis' and 'transcript_text'. The 'analysis' field should be an object with 'summary' (a concise summary), 'keywords' (an array of key terms), and 'slang_expressions' (an array of objects, each with 'expression' and 'meaning'). The 'transcript_text' field should contain a detailed transcript of the video, with each segment starting with a timestamp in the exact format [MM:SS] followed immediately by the corresponding text. Do NOT include any other timestamps or time ranges within the transcript text itself, only at the beginning of each segment. Ensure the entire output is strictly valid JSON." },
          {
            file_data: {
              file_uri: youtubeUrl,
              mime_type: "video/mp4" // Although YouTube URL, API expects a mime type. This is a common one.
            }
          }
        ]
      }]
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: geminiRequestBody,
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: `Gemini API error: ${response.statusText}`, details: errorData }, { status: response.status });
    }

    const data = await response.json();
    let parsedContent;
    try {
      // Gemini API might return text that needs parsing to JSON
      let textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textContent) {
        // Remove markdown code block fences using a global replace
        textContent = textContent.replace(/```json|```/g, '').trim();
        parsedContent = JSON.parse(textContent);
      } else {
        parsedContent = { analysis: { summary: 'No content found.', keywords: [], slang_expressions: [] }, transcript_text: 'No transcript found.' };
      }
    } catch (parseError: unknown) {
      console.error("Failed to parse Gemini response as JSON:", parseError);
      let errorMessage = 'An unknown parsing error occurred.';
      if (parseError instanceof Error) {
        errorMessage = parseError.message;
      }
      return NextResponse.json({ error: 'Failed to parse Gemini API response as JSON', details: errorMessage }, { status: 500 });
    }

    return NextResponse.json(parsedContent);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 