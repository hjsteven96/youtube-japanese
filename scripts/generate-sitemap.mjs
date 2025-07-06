// scripts/generate-sitemap.mjs
import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

// ▼▼▼ 로컬과 Vercel 환경을 구분하여 서비스 계정 정보를 가져오는 함수 ▼▼▼
function getServiceAccount() {
    // Vercel 환경일 경우 (VERCEL 환경 변수가 '1'로 설정됨)
    if (process.env.VERCEL) {
        console.log("Running in Vercel environment. Using Base64 credentials.");
        const serviceAccountBase64 =
            process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        if (!serviceAccountBase64) {
            throw new Error(
                "Vercel: FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set."
            );
        }
        // Base64 디코딩
        const serviceAccountJson = Buffer.from(
            serviceAccountBase64,
            "base64"
        ).toString("utf-8");
        return JSON.parse(serviceAccountJson);
    }
    // 로컬 개발 환경일 경우
    else {
        console.log(
            "Running in local environment. Reading service-account.json file."
        );
        const serviceAccountPath = path.join(
            process.cwd(),
            "service-account.json"
        );
        if (!fs.existsSync(serviceAccountPath)) {
            throw new Error(
                "Local: service-account.json file not found in project root."
            );
        }
        // 파일을 직접 읽음
        return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    }
}

// Firebase Admin 초기화
if (!admin.apps.length) {
    try {
        console.log("Initializing Firebase Admin SDK...");
        const serviceAccount = getServiceAccount(); // 위에서 정의한 함수 사용
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin SDK initialized successfully.");
    } catch (e) {
        console.error("CRITICAL: Firebase Admin SDK initialization failed.", e);
        process.exit(1); // 초기화 실패 시 빌드 중단
    }
}

const db = admin.firestore();

// ... generateSitemap 함수는 이전과 동일하게 둡니다 ...
async function generateSitemap() {
    const baseUrl = "https://lingto.xyz";

    console.log("Fetching data for sitemap...");
    const analysesSnapshot = await db
        .collection("videoAnalyses")
        .orderBy("timestamp", "desc")
        .get();

    const dynamicUrls = analysesSnapshot.docs
        .map((doc) => {
            const data = doc.data();
            const lastModified =
                data.timestamp instanceof Timestamp
                    ? data.timestamp.toDate().toISOString()
                    : new Date().toISOString();

            return `
      <url>
        <loc>${baseUrl}/analysis/${doc.id}</loc>
        <lastmod>${lastModified}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>
    `;
        })
        .join("");

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>1.0</priority>
      </url>
      <url>
        <loc>${baseUrl}/pricing</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
      </url>
      ${dynamicUrls}
    </urlset>
  `;

    fs.writeFileSync(
        path.join(process.cwd(), "public", "sitemap.xml"),
        sitemap,
        "utf8"
    );

    console.log(
        `✅ 정적 sitemap.xml 파일이 public 폴더에 성공적으로 생성되었습니다. (${analysesSnapshot.docs.length}개의 동적 URL 포함)`
    );
}

generateSitemap();
