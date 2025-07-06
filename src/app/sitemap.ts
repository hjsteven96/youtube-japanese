// src/app/sitemap.ts
import { MetadataRoute } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { dbAdmin } from "../lib/firebase-admin"; // ▼▼▼ Admin DB 인스턴스로 변경

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    noStore();

    const baseUrl = (
        process.env.NEXT_PUBLIC_APP_URL || `https://lingto.xyz`
    ).replace(/\/$/, "");

    const staticRoutes = ["/", "/pricing"].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date().toISOString(),
        changeFrequency: "monthly" as const,
        priority: route === "/" ? 1.0 : 0.8,
    }));

    let dynamicRoutes: MetadataRoute.Sitemap = [];

    try {
        // ▼▼▼ dbAdmin 사용 ▼▼▼
        const analysesSnapshot = await dbAdmin
            .collection("videoAnalyses")
            .orderBy("timestamp", "desc")
            .get();

        console.log(
            `[sitemap.ts - Admin] Fetched ${analysesSnapshot.docs.length} documents from Firestore.`
        );

        dynamicRoutes = analysesSnapshot.docs.map((doc) => {
            const data = doc.data();
            const timestamp = data.timestamp;
            // Admin SDK의 Timestamp는 toDate() 메서드를 가짐
            const lastModified =
                timestamp && typeof timestamp.toDate === "function"
                    ? timestamp.toDate().toISOString()
                    : new Date().toISOString();

            return {
                url: `${baseUrl}/analysis/${doc.id}`,
                lastModified,
                changeFrequency: "weekly" as const,
                priority: 0.7,
            };
        });
    } catch (error) {
        console.error(
            "[sitemap.ts - Admin] Failed to fetch dynamic routes:",
            error
        );
    }

    return [...staticRoutes, ...dynamicRoutes];
}
