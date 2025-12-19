// scripts/generate-sitemap.mjs
import fs from "fs";
import path from "path";

// firebase-admin의 모듈을 개별적으로 가져옵니다. 이것이 표준 방식입니다.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// 서비스 계정 정보를 가져오는 함수 (이전과 동일)
function getServiceAccount() {
    if (process.env.VERCEL) {
        console.log("Running in Vercel environment. Using Base64 credentials.");
        const serviceAccountBase64 =
            process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        if (!serviceAccountBase64) {
            throw new Error(
                "Vercel: FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set."
            );
        }
        const serviceAccountJson = Buffer.from(
            serviceAccountBase64,
            "base64"
        ).toString("utf-8");
        return JSON.parse(serviceAccountJson);
    } else {
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
        return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    }
}

// Firebase Admin 초기화 (앱 인스턴스를 반환하도록 수정)
function initializeFirebaseAdminApp() {
    if (getApps().length > 0) {
        return getApps()[0]; // 이미 초기화된 앱 반환
    }
    try {
        console.log("Initializing Firebase Admin SDK...");
        const serviceAccount = getServiceAccount();
        const app = initializeApp({
            credential: cert(serviceAccount),
        });
        console.log("Firebase Admin SDK initialized successfully.");
        return app;
    } catch (e) {
        console.error("CRITICAL: Firebase Admin SDK initialization failed.", e);
        process.exit(1);
    }
}

// --- 메인 로직 ---
async function generateSitemap() {
    const app = initializeFirebaseAdminApp();

    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    // 핵심: getFirestore 함수를 사용하여 선택한 데이터베이스를 명시적으로 지정합니다.
    const dbId = process.env.FIREBASE_DB_ID;
    const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    const baseUrl = "https://lingto.xyz";

    console.log(
        `Fetching data for sitemap from '${dbId || "(default)"}' database...`
    );
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
