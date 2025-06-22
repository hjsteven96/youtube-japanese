import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "./firebase";
import { UserProfile } from "./plans";

/**
 * Firestore에서 사용자 프로필을 가져옵니다.
 * 프로필이 없으면 null을 반환합니다.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        return userDocSnap.data() as UserProfile;
    }
    return null;
}

/**
 * 신규 사용자를 위한 프로필을 생성합니다.
 * 이미 프로필이 있다면 생성하지 않습니다.
 */
export async function createUserProfile(user: User): Promise<UserProfile> {
    const existingProfile = await getUserProfile(user.uid);
    if (existingProfile) {
        // 날짜가 바뀌었는지 확인하고 사용량을 초기화하는 로직을 추가할 수 있습니다.
        const today = new Date().toISOString().split("T")[0];
        if (existingProfile.usage?.lastAnalysisDate !== today) {
            const userDocRef = doc(db, "users", user.uid);
            await setDoc(
                userDocRef,
                {
                    usage: {
                        analysisCount: 0,
                        lastAnalysisDate: today,
                    },
                },
                { merge: true }
            );
            // 업데이트된 프로필을 반환하기 위해 existingProfile 객체를 수정합니다.
            existingProfile.usage.analysisCount = 0;
            existingProfile.usage.lastAnalysisDate = today;
        }
        return existingProfile;
    }

    const newUserProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        plan: "free", // 모든 신규 사용자는 'free' 플랜으로 시작
        createdAt: serverTimestamp(),
        usage: {
            analysisCount: 0,
            lastAnalysisDate: new Date().toISOString().split("T")[0], // YYYY-MM-DD
        },
    };

    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, newUserProfile);
    return newUserProfile;
}
