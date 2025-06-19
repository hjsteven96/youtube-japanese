import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function GET(req: NextRequest) {
  // Changed to use GEMINI_LIVE_API_KEY for live features
  const GEMINI_LIVE_API_KEY = process.env.GEMINI_LIVE_API_KEY;

  if (!GEMINI_LIVE_API_KEY) {
    console.error('Server Error: GEMINI_LIVE_API_KEY not configured');
    return NextResponse.json({ error: 'GEMINI_LIVE_API_KEY not configured' }, { status: 500 });
  }

  try {
    console.log('Attempting to create ephemeral token with GEMINI_LIVE_API_KEY...');
    const client = new GoogleGenAI({ apiKey: GEMINI_LIVE_API_KEY });
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const token = await client.authTokens.create({
      config: {
        uses: 1, // The default
        expireTime: expireTime, // Default is 30 mins
        newSessionExpireTime: new Date(Date.now() + (1 * 60 * 1000)).toISOString(), // Default 1 minute in the future
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    console.log('Ephemeral token created successfully.');
    // You'll need to pass the value under token.name back to your client to use it
    return NextResponse.json({ token: token.name });
  } catch (error: unknown) {
    console.error('Error generating ephemeral token (server-side):', error);
    let errorMessage = 'Failed to generate ephemeral token.';
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 