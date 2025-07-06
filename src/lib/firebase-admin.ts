// src/lib/firebase-admin.ts
import admin from "firebase-admin";

// 앱이 이미 초기화되었는지 확인하여 중복 초기화 방지
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(
            process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string
        );

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
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
