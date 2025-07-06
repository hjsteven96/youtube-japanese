// src/app/sitemap.ts
import { MetadataRoute } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore"; // Timestamp 타입을 import
import fs from "fs";
import path from "path";

// ... getServiceAccount() 와 initializeFirebaseAdmin() 함수는 이전과 동일하게 둡니다 ...
function getServiceAccount() {
    if (process.env.VERCEL) {
        const serviceAccountBase64 =
            process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        if (!serviceAccountBase64)
            throw new Error(
                "Vercel: FIREBASE_SERVICE_ACCOUNT_BASE64 is not set."
            );
        return JSON.parse(
            Buffer.from(serviceAccountBase64, "base64").toString("utf-8")
        );
    } else {
        const serviceAccountPath = path.join(
            process.cwd(),
            "service-account.json"
        );
        if (!fs.existsSync(serviceAccountPath))
            throw new Error("Local: service-account.json not found.");
        return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    }
}

function initializeFirebaseAdmin() {
    if (getApps().length > 0) return getApps()[0];
    try {
        const serviceAccount = getServiceAccount();
        console.log(
            `Initializing Admin SDK for project: ${serviceAccount.project_id}`
        );
        return initializeApp({ credential: cert(serviceAccount) });
    } catch (e: any) {
        console.error(
            "CRITICAL: Failed to initialize Firebase Admin SDK.",
            e.message
        );
        throw e;
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    noStore();

    try {
        const app = initializeFirebaseAdmin();
        const dbAdmin = getFirestore(app, "youtube-english");

        const baseUrl = (
            process.env.NEXT_PUBLIC_APP_URL || `https://lingto.xyz`
        ).replace(/\/$/, "");

        const staticRoutes: MetadataRoute.Sitemap = [
            {
                url: `${baseUrl}/`,
                lastModified: new Date().toISOString(),
                changeFrequency: "monthly",
                priority: 1.0,
            },
            {
                url: `${baseUrl}/pricing`,
                lastModified: new Date().toISOString(),
                changeFrequency: "monthly",
                priority: 0.7,
            },
        ];

        console.log(
            `[sitemap.ts] Attempting to fetch collection 'videoAnalyses' from database 'youtube-english'.`
        );

        const analysesSnapshot = await dbAdmin
            .collection("videoAnalyses")
            .orderBy("timestamp", "desc")
            .get();
        console.log(
            `[sitemap.ts] Successfully fetched ${analysesSnapshot.docs.length} documents.`
        );

        const dynamicRoutes: MetadataRoute.Sitemap = analysesSnapshot.docs.map(
            (doc) => {
                const data = doc.data();
                const timestamp = data.timestamp;

                // 핵심 수정: timestamp가 Firestore Timestamp 객체인지 확인하고 처리
                let lastModified: string;
                if (timestamp instanceof Timestamp) {
                    // 정식 Timestamp 객체일 경우 .toDate() 사용
                    lastModified = timestamp.toDate().toISOString();
                } else {
                    // 그 외의 경우 (문자열, 숫자 등)에는 현재 시간으로 대체 (안전장치)
                    console.warn(
                        `Document ${doc.id} has an invalid timestamp. Using current time as fallback.`
                    );
                    lastModified = new Date().toISOString();
                }

                return {
                    url: `${baseUrl}/analysis/${doc.id}`,
                    lastModified,
                    changeFrequency: "weekly",
                    priority: 0.8,
                };
            }
        );

        return [...staticRoutes, ...dynamicRoutes];
    } catch (error: any) {
        console.error("FATAL: Sitemap generation failed.", error.message);
        return [];
    }
}
