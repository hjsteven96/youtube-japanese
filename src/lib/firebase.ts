import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app"; 
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";


// Initialize Firebase services
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, // 환경 변수 사용을 강력히 권장합니다.
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app, 'youtube-english');// 데이터베이스 이름 지정은 선택사항입니다.

// Check if window is defined to ensure client-side initialization
const getAnalytics = () => {
    if (typeof window !== "undefined") {
        const { getAnalytics: getClientAnalytics } = require("firebase/analytics");
        return getClientAnalytics(app);
    }
    return null;
};

export { app, auth, db, getAnalytics };


