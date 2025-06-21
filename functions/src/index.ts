import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2/options"; // v1에서 임포트
import { onSchedule, ScheduledEvent } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions"; // 구조화된 로깅을 위해 임포트

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10 });

export const calculateTrendingVideos = onSchedule(
    {
        schedule: "every 1 hours",
        timeZone: "Asia/Seoul", // 한국 시간 기준
    },
    async (context: ScheduledEvent) => {
        logger.info("Starting trending videos calculation...");

        try {
            const now = admin.firestore.Timestamp.now();
            const threeDaysAgo = admin.firestore.Timestamp.fromMillis(
                now.toMillis() - 3 * 24 * 60 * 60 * 1000
            );

            // 1. Fetch relevant activity logs from Firestore
            const activityLogsRef = db.collection("videoActivityLogs");
            // ★ 개선 1: Timestamp 객체로 쿼리
            const q = activityLogsRef.where("timestamp", ">=", threeDaysAgo);
            const querySnapshot = await q.get();

            if (querySnapshot.empty) {
                logger.info("No recent activity logs found. Exiting.");
                return;
            }

            const videoScores: { [videoId: string]: number } = {};
            const activityWeights: { [key: string]: number } = {
                ANALYSIS: 1,
                REVISIT: 1,
            };
            const decayRate = 0.05;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const { videoId, activityType, timestamp } = data;

                if (
                    !videoId ||
                    !activityType ||
                    !activityWeights[activityType] ||
                    !(timestamp instanceof admin.firestore.Timestamp)
                ) {
                    return;
                }

                // ★ 개선 1: Timestamp 객체로 시간 차이 계산
                const hoursAgo =
                    (now.toMillis() - timestamp.toMillis()) / (1000 * 60 * 60);
                const baseScore = activityWeights[activityType];
                const finalScore = baseScore * Math.exp(-decayRate * hoursAgo);

                videoScores[videoId] = (videoScores[videoId] || 0) + finalScore;
            });

            const sortedVideos = Object.entries(videoScores)
                .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
                .slice(0, 20);

            // ★ 개선 3: N+1 문제 해결을 위한 배치 읽기
            if (sortedVideos.length === 0) {
                logger.info("No videos with scores. Exiting.");
                return;
            }

            const videoRefs = sortedVideos.map(([videoId]) =>
                db.collection("videoAnalyses").doc(`yt_${videoId}`)
            );
            const videoSnaps = await db.getAll(...videoRefs);

            const videoTitles: { [videoId: string]: string } = {};
            videoSnaps.forEach((snap) => {
                if (snap.exists) {
                    // yt_ 접두사를 제거하여 videoId를 키로 사용
                    const videoId = snap.id.replace("yt_", "");
                    videoTitles[videoId] =
                        snap.data()?.youtubeTitle || "제목 없음";
                }
            });

            const trendingVideoList = sortedVideos.map(([videoId, score]) => ({
                videoId,
                youtubeTitle: videoTitles[videoId] || "제목 없음",
                score: parseFloat(score.toFixed(2)),
            }));

            // 5. Save the calculated trending list
            const trendingDocRef = db
                .collection("trendingVideos")
                .doc("global");
            await trendingDocRef.set({
                videos: trendingVideoList,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            });

            logger.info(
                `Successfully calculated and updated trending videos. Found ${trendingVideoList.length} videos.`
            );
        } catch (error) {
            // ★ 개선 2: 에러 핸들링
            logger.error("Error calculating trending videos:", error);
        }
    }
);
