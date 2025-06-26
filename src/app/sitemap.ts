// src/app/sitemap.ts
import { MetadataRoute } from "next";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase"; // Firestore 인스턴스 경로 확인

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://ling-to.com`;

    // 1. 정적 페이지 추가
    const staticRoutes = ["", "/pricing"].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date().toISOString(),
        changeFrequency: "monthly" as "monthly",
        priority: route === "" ? 1.0 : 0.8,
    }));

    // 2. 동적 분석 페이지(videoAnalyses) 추가
    const analysesCollectionRef = collection(db, "videoAnalyses");
    const q = query(analysesCollectionRef, orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);

    const dynamicRoutes = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            url: `${baseUrl}/analysis/${doc.id}`,
            // Firestore에 timestamp가 있으면 사용, 없으면 현재 날짜
            lastModified: data.timestamp
                ? new Date(data.timestamp).toISOString()
                : new Date().toISOString(),
            changeFrequency: "weekly" as "weekly",
            priority: 0.7,
        };
    });

    return [...staticRoutes, ...dynamicRoutes];
}
