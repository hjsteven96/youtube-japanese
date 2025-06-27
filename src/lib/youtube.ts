// src/lib/youtube.ts

// parseDuration 함수는 여기서만 사용되므로 그대로 둡니다.
function parseDuration(duration: string): number {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
}

// 이 함수가 바로 분리된 핵심 로직입니다.
export async function getYoutubeVideoDetails(videoId: string) {
    const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY;

    if (!YOUTUBE_DATA_API_KEY) {
        console.error("환경 변수 YOUTUBE_DATA_API_KEY가 설정되지 않았습니다.");
        throw new Error("YouTube Data API Key not configured");
    }

    try {
        const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_DATA_API_KEY}&part=snippet,contentDetails`;
        // 외부 API 호출이므로 fetch를 그대로 사용합니다.
        const youtubeApiResponse = await fetch(youtubeApiUrl, {
            next: { revalidate: 3600 },
        });

        if (!youtubeApiResponse.ok) {
            const errorData = await youtubeApiResponse.json();
            throw new Error(
                errorData.error?.message || "Failed to fetch from YouTube API"
            );
        }

        const youtubeApiData = await youtubeApiResponse.json();

        if (youtubeApiData.items && youtubeApiData.items.length > 0) {
            const item = youtubeApiData.items[0];
            const snippet = item.snippet;
            const durationISO = item.contentDetails?.duration;
            const durationInSeconds = durationISO
                ? parseDuration(durationISO)
                : 0;

            // API 라우트가 반환하던 JSON 객체를 그대로 반환합니다.
            return {
                youtubeTitle: snippet.title,
                youtubeDescription: snippet.description,
                duration: durationInSeconds,
                thumbnailUrl: snippet.thumbnails?.high?.url || null,
                channelName: snippet.channelTitle || null,
            };
        } else {
            return null; // 비디오 없음
        }
    } catch (error) {
        console.error("YouTube Data API 오류:", error);
        throw error;
    }
}
