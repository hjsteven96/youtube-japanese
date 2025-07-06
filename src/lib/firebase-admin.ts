// src/lib/firebase-admin.ts
import admin from "firebase-admin";

// 앱이 이미 초기화되었는지 확인하여 중복 초기화 방지
if (!admin.apps.length) {
    try {
        // 변경: FIREBASE_SERVICE_ACCOUNT_KEY 대신 개별 환경 변수 사용
        const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
        const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
            /\\n/g,
            "\n"
        ); // 줄바꿈 문자 처리
        const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

        if (!projectId || !privateKey || !clientEmail) {
            throw new Error("Missing Firebase Admin environment variables");
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: projectId,
                privateKey: privateKey,
                clientEmail: clientEmail,
            }),
        });
        console.log("Firebase Admin SDK initialized successfully.");
    } catch (error: any) {
        console.error(
            "Firebase Admin SDK initialization error: ",
            error.message
        );
    }
}

// 초기화된 admin 앱의 firestore 인스턴스를 export
const dbAdmin = admin.firestore();

export { dbAdmin };
