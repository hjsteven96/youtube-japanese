import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
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
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    // [수정] 기존 프로필이 있을 때의 로직 강화
    if (userDocSnap.exists()) {
        const profile = userDocSnap.data() as UserProfile;
        const updates: { [key: string]: any } = {};

        // 1. 일일 분석 횟수 리셋
        const today = new Date().toISOString().split("T")[0];
        if (profile.usage?.lastAnalysisDate !== today) {
            updates["usage.analysisCount"] = 0;
            updates["usage.lastAnalysisDate"] = today;
            profile.usage.analysisCount = 0; // 즉각적인 UI 반영을 위해
            profile.usage.lastAnalysisDate = today;
        }

        // 2. [추가] 월간 대화 사용량 리셋
        const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
        if (profile.usage?.conversationUsageLastReset !== currentMonth) {
            updates["usage.monthlyConversationUsed"] = 0;
            updates["usage.conversationUsageLastReset"] = currentMonth;
            profile.usage.monthlyConversationUsed = 0; // 즉각적인 UI 반영을 위해
            profile.usage.conversationUsageLastReset = currentMonth;
        }

        // 업데이트가 필요할 경우에만 Firestore에 쓰기 작업 수행
        if (Object.keys(updates).length > 0) {
            await updateDoc(userDocRef, updates);
        }

        return profile;
    }

    // [수정] 신규 사용자 프로필 생성 로직
    const newUserProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        plan: "free",
        createdAt: serverTimestamp(),
        usage: {
            analysisCount: 0,
            lastAnalysisDate: new Date().toISOString().split("T")[0],
            // [추가] 신규 사용자의 대화 시간 초기값
            monthlyConversationUsed: 0,
            conversationUsageLastReset: new Date().toISOString().slice(0, 7), // "YYYY-MM"
        },
    };

 
    await setDoc(userDocRef, newUserProfile);
    return newUserProfile;
}
