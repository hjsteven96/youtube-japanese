import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDxHrclNqOoYlHzH5V0kjglFbmHZcsHyRc",
    authDomain: "english-timetobe.firebaseapp.com",
    projectId: "english-timetobe",
    storageBucket: "english-timetobe.firebasestorage.app",
    messagingSenderId: "465516919779",
    appId: "1:465516919779:web:cf5b102602fe8e9bbd7ed6",
    measurementId: "G-XX95PNCEWL",
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase services
let auth: Auth;
let analytics: Analytics;
let db: Firestore;

// Check if window is defined to ensure client-side initialization
if (typeof window !== "undefined") {
    auth = getAuth(app);
    analytics = getAnalytics(app);
    db = getFirestore(app);
}

export { app, auth, analytics, db };
