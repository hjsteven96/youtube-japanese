// src/lib/user.ts
import { NextRequest, NextResponse } from "next/server";
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
