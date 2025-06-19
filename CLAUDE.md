# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a YouTube English Learning Application built with Next.js 15, React 19, and TypeScript. The app allows users to input YouTube URLs, analyze video content using Google's Gemini AI, and engage in real-time voice conversations about the video content using Gemini Live API.

## Key Architecture Components

### Main Application Flow
1. **Authentication**: Google OAuth via Firebase Auth
2. **Video Analysis**: YouTube URLs are processed through Gemini API to extract transcripts, summaries, keywords, and slang expressions
3. **Real-time Conversation**: Gemini Live API enables voice conversations about video content using native audio models
4. **Caching**: Firestore is used to cache video analysis results to avoid re-processing

### Core Technologies
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend APIs**: Next.js API routes for Gemini integration
- **Audio Processing**: Web Audio API with custom AudioWorklet processors
- **Database**: Firebase Firestore for caching
- **Authentication**: Firebase Auth with Google provider
- **AI Integration**: Google Gemini API (2.5-flash for analysis, native audio models for live conversation)

## Development Commands

### Primary Commands
```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint
```

### Environment Setup
Ensure these environment variables are configured:
- `GOOGLE_API_KEY`: For Gemini video analysis API
- `GEMINI_LIVE_API_KEY`: For Gemini Live conversation features
- Firebase configuration is hardcoded in `src/lib/firebase.ts`

## Key File Structure

### Main Application Components
- `src/app/page.tsx`: Main application interface with video player, analysis display, and conversation controls
- `src/app/layout.tsx`: Root layout with font configuration
- `src/app/api/transcript/route.ts`: API endpoint for video analysis using Gemini API
- `src/app/api/gemini-live-token/route.ts`: Generates ephemeral tokens for Gemini Live API

### Audio Processing System
- `src/lib/useGeminiLiveConversation.ts`: Custom hook managing live conversation state and audio processing
- `src/lib/AudioPlaybackScheduler.ts`: Handles seamless audio playback using Web Audio API
- `src/lib/AudioInputProcessor.ts`: Processes microphone input to 16kHz PCM format
- `public/pcm-processor.js`: AudioWorklet processor for real-time audio processing

### Firebase Integration
- `src/lib/firebase.ts`: Firebase configuration and service initialization

## Architecture Patterns

### State Management
- React hooks for local state management
- Custom hooks for complex logic (conversation handling)
- Firebase for persistent data and authentication state

### Audio Processing Pipeline
1. **Input**: Microphone → MediaStream
2. **Processing**: AudioWorklet (pcm-processor.js) converts to 16kHz PCM
3. **Transmission**: Base64-encoded PCM sent to Gemini Live API
4. **Output**: Received audio chunks scheduled via AudioPlaybackScheduler

### API Integration
- **Video Analysis**: Direct Gemini API calls with structured JSON prompts
- **Live Conversation**: Gemini Live API with ephemeral tokens for security
- **Caching Strategy**: Firestore documents keyed by encoded YouTube URLs

## Important Implementation Details

### Audio Format Requirements
- **Input Audio**: 16kHz, 16-bit PCM, mono
- **Output Audio**: 24kHz, 16-bit PCM (from Gemini Live API)
- AudioWorklet handles real-time sample rate conversion

### Type Safety Workarounds
The codebase includes `@ts-ignore` comments for Gemini Live API due to TypeScript definition mismatches in the Google GenAI library, specifically around mimeType requirements.

### Firebase Security
- Client-side Firebase configuration is exposed (typical for web apps)
- Firestore security rules should be configured separately
- Authentication is required for video analysis features

### Next.js Configuration
- Custom webpack configuration in `next.config.ts` handles fluent-ffmpeg path resolution
- TypeScript paths configured for `@/*` imports

## Testing and Quality

### Available Scripts
- `npm run lint`: Runs Next.js ESLint configuration
- No test scripts are currently configured

### Code Style
- TypeScript strict mode enabled
- ESLint with Next.js configuration
- Tailwind CSS for styling

## Development Workflow

1. **New Features**: Implement in appropriate component/hook structure
2. **API Changes**: Update both client-side hooks and API route handlers
3. **Audio Features**: Test with different browser environments due to Web Audio API variations
4. **Firebase Changes**: Ensure proper client-side initialization checks

## Common Tasks

### Adding New Video Analysis Features
1. Update the Gemini API prompt in `src/app/api/transcript/route.ts`
2. Modify TypeScript interfaces in `src/app/page.tsx`
3. Update UI components to display new data

### Modifying Audio Processing
1. Edit `public/pcm-processor.js` for input processing changes
2. Update `src/lib/AudioPlaybackScheduler.ts` for output changes
3. Modify `src/lib/useGeminiLiveConversation.ts` for integration logic

### Authentication Flow Changes
1. Update Firebase configuration in `src/lib/firebase.ts`
2. Modify authentication logic in `src/app/page.tsx`
3. Ensure proper client-side initialization checks