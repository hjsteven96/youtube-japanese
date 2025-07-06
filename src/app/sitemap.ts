// src/app/sitemap.ts
import { MetadataRoute } from "next";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase"; // Firestore 인스턴스 경로 확인

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // ▼ 수정: baseUrl 끝에 슬래시 제거
    const baseUrl = (
        process.env.NEXT_PUBLIC_APP_URL || `https://ling-to.com`
    ).replace(/\/$/, "");

    // 1. 정적 페이지 추가
    const staticRoutes = ["/", "/pricing"].map((route) => ({
        // ▼ 수정: 경로 앞에 슬래시 추가
        url: `${baseUrl}${route}`,
        lastModified: new Date().toISOString(),
        changeFrequency: "monthly" as const,
        priority: route === "/" ? 1.0 : 0.8,
    }));

    let dynamicRoutes: MetadataRoute.Sitemap = [];

    try {
        // 2. 동적 분석 페이지(videoAnalyses) 추가
        const analysesCollectionRef = collection(db, "videoAnalyses");
        const q = query(analysesCollectionRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        console.log(
            `[sitemap.ts] Fetched ${querySnapshot.docs.length} documents from Firestore.`
        ); // 빌드 로그 확인용

        dynamicRoutes = querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                url: `${baseUrl}/analysis/${doc.id}`, // ▼ 수정: baseUrl과 경로 사이에 슬래시 하나만 있도록 보장
                lastModified:
                    data.timestamp?.toDate()?.toISOString() ||
                    new Date().toISOString(),
                changeFrequency: "weekly" as const,
                priority: 0.7,
            };
        });
    } catch (error) {
        // ▼ 빌드 시 Firestore 접근 실패 에러를 명확히 로깅
        console.error(
            "[sitemap.ts] Failed to fetch dynamic routes from Firestore:",
            error
        );
    }

    return [...staticRoutes, ...dynamicRoutes];
}
