// scripts/generate-sitemap.mjs
import fs from "fs";
import path from "path";
// firebase-admin 전체를 'admin'으로 가져옵니다.
import admin from "firebase-admin";
// Timestamp 타입을 가져오기 위해 별도로 import 합니다.
import { Timestamp } from "firebase-admin/firestore";

// 서비스 계정 키 파일을 직접 읽어옵니다.
const serviceAccountPath = path.join(process.cwd(), "service-account.json");
if (!fs.existsSync(serviceAccountPath)) {
    console.error(
        "❌ service-account.json 파일을 찾을 수 없습니다! 빌드를 중단합니다."
    );
    process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

// ▼▼▼ 핵심 수정 부분 ▼▼▼
// Firebase Admin 초기화 (올바른 방법)
// admin.apps 배열의 길이를 확인하여 이미 초기화되었는지 체크합니다.
if (!admin.apps.length) {
    console.log("Initializing Firebase Admin SDK...");
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}
// ▲▲▲ 핵심 수정 부분 ▲▲▲

// 초기화가 보장된 상태에서 Firestore 인스턴스를 가져옵니다.
const db = admin.firestore();

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
            // data.timestamp가 Timestamp 객체인지 다시 한번 확인합니다.
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
