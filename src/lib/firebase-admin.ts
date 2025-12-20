import fs from "fs";
import path from "path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const adminDbId = process.env.FIREBASE_DB_ID;

function loadServiceAccount(): Record<string, any> | null {
    if (serviceAccountBase64) {
        const decoded = Buffer.from(serviceAccountBase64, "base64").toString(
            "utf-8"
        );
        const parsed = JSON.parse(decoded);
        console.log("[FIREBASE_ADMIN] Loaded service account from Base64.", {
            project_id: parsed?.project_id,
        });
        return parsed;
    }

    const serviceAccountPath = path.join(process.cwd(), "service-account.json");
    if (fs.existsSync(serviceAccountPath)) {
        const parsed = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
        console.log("[FIREBASE_ADMIN] Loaded service account from file.", {
            project_id: parsed?.project_id,
        });
        return parsed;
    }

    console.warn("[FIREBASE_ADMIN] No service account provided.");
    return null;
}

function initAdminApp() {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
        console.warn(
            "[FIREBASE_ADMIN] No service account found; admin Firestore disabled."
        );
        return null;
    }

    return initializeApp({
        credential: cert(serviceAccount),
    });
}

export function getAdminFirestore(): Firestore | null {
    const app = initAdminApp();
    if (!app) return null;
    return adminDbId ? getFirestore(app, adminDbId) : getFirestore(app);
}
