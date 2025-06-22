// src/app/pricing/page.tsx
"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { createUserProfile } from "@/lib/user";
import { PLANS, PlanId, UserProfile } from "@/lib/plans";
import Toast from "../components/Toast";
import Link from "next/link";

const CheckIcon = ({ className }: { className: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <path
            fillRule="evenodd"
            d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
            clipRule="evenodd"
        />
    </svg>
);

export default function PricingPage() {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<PlanId | null>(null);
    const [toast, setToast] = useState({
        show: false,
        message: "",
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const profile = await createUserProfile(currentUser);
                setUserProfile(profile);
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const showToast = (message: string) => {
        setToast({ show: true, message });
    };

    const handleUpgrade = async (planId: PlanId) => {
        if (!user || !userProfile || planId === userProfile.plan) {
            return;
        }

        setIsProcessing(planId);
        try {
            // --- 실제 결제 연동 시뮬레이션 ---
            // 1. 서버에 결제 세션 생성을 요청합니다.
            // 2. 반환된 URL로 사용자를 리디렉션합니다.
            // 3. 결제 완료 후, 웹훅을 통해 Firestore의 사용자 등급을 업데이트합니다.
            // 여기서는 이 과정을 생략하고 바로 Firestore를 업데이트합니다.
            console.log(`Upgrading user ${user.uid} to ${planId}...`);

            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                plan: planId,
            });

            // UI 즉시 반영
            setUserProfile((prev) => (prev ? { ...prev, plan: planId } : null));

            showToast(`${PLANS[planId].name}으로 업그레이드되었습니다!`);
        } catch (error) {
            console.error("Upgrade failed:", error);
            showToast("업그레이드 중 오류가 발생했습니다.");
        } finally {
            setIsProcessing(null);
        }
    };

    const planOrder: PlanId[] = ["free", "plus", "pro"];

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                        학습 잠재력을{" "}
                        <span className="bg-gradient-to-r from-blue-600 to-purple-500 bg-clip-text text-transparent">
                            100%
                        </span>{" "}
                        끌어올리세요
                    </h2>
                    <p className="mt-4 text-lg text-gray-600">
                        당신의 노력이 최고의 결과로 이어지도록, 가장 현명한
                        플랜을 선택하세요.
                    </p>
                </div>

                <div className="mt-16 space-y-8 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-x-8">
                    {planOrder.map((planId) => {
                        const plan = PLANS[planId];
                        const isCurrentPlan = userProfile?.plan === planId;

                        return (
                            <div
                                key={planId}
                                className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
                                    isCurrentPlan
                                        ? "border-blue-500 ring-2 ring-blue-500"
                                        : "border-gray-200"
                                } bg-white`}
                            >
                                {isCurrentPlan && (
                                    <div className="absolute top-0 -translate-y-1/2 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                                        현재 요금제
                                    </div>
                                )}
                                <h3 className="text-2xl font-semibold text-gray-900">
                                    {plan.name}
                                </h3>
                                <div className="mt-4">
                                    <span className="text-4xl font-bold text-gray-900">
                                        {plan.price}
                                    </span>
                                    {planId !== "free" && (
                                        <span className="text-base font-medium text-gray-500">
                                            /월
                                        </span>
                                    )}
                                    {planId === "plus" && (
                                        <p className="mt-2 text-sm text-blue-500 font-semibold">
                                            Beta 기간 한정 무료
                                        </p>
                                    )}
                                </div>
                                <p className="mt-6 text-gray-500">
                                    {
                                        {
                                            free: "기본 기능을 체험해보세요.",
                                            plus: "본격적인 학습자를 위한 플랜.",
                                            pro: "제한 없는 학습 경험을 원한다면.",
                                        }[planId]
                                    }
                                </p>

                                <ul className="mt-6 space-y-2">
                                    <li className="flex items-start">
                                        <CheckIcon className="flex-shrink-0 h-6 w-6 text-green-500" />
                                        <span className="ml-3 text-gray-700">
                                            하루 분석: {plan.dailyAnalysisLimit}
                                            회
                                        </span>
                                    </li>
                                    <li className="flex items-start">
                                        <CheckIcon className="flex-shrink-0 h-6 w-6 text-green-500" />
                                        <span className="ml-3 text-gray-700">
                                            영상 길이: 최대{" "}
                                            {plan.maxVideoDuration / 60}분
                                        </span>
                                    </li>
                                    {plan.aiConversation && (
                                        <li className="flex items-start">
                                            <CheckIcon
                                                className={`flex-shrink-0 h-6 w-6 text-gray-300`}
                                            />
                                            <span
                                                className={`ml-3 text-gray-400`}
                                            >
                                                AI 대화 연습 (준비 중)
                                            </span>
                                        </li>
                                    )}
                                </ul>

                                <div className="mt-auto pt-6">
                                    {user ? (
                                        isCurrentPlan ? (
                                            <button
                                                disabled
                                                className="w-full bg-gray-200 text-gray-500 font-semibold py-3 px-6 rounded-lg cursor-not-allowed"
                                            >
                                                {planId === "pro"
                                                    ? "준비 중"
                                                    : "현재 사용 중"}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (planId === "plus") {
                                                        window.open(
                                                            "https://open.kakao.com/o/sl0HG7Ch",
                                                            "_blank"
                                                        );
                                                    } else {
                                                        handleUpgrade(planId);
                                                    }
                                                }}
                                                disabled={
                                                    isProcessing === planId ||
                                                    planId === "pro"
                                                }
                                                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 hover:from-blue-600 hover:to-purple-600 focus:ring-4 focus:ring-purple-300 disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                {isProcessing === planId
                                                    ? "처리 중..."
                                                    : planId === "pro"
                                                    ? "준비 중"
                                                    : planId === "plus"
                                                    ? "신청하기"
                                                    : "구독하기"}
                                            </button>
                                        )
                                    ) : (
                                        <Link
                                            href="/"
                                            className="block w-full text-center bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 hover:from-blue-600 hover:to-purple-600"
                                        >
                                            시작하려면 로그인
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="text-center mt-12">
                    <Link
                        href="/"
                        className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                        ← 메인으로 돌아가기
                    </Link>
                </div>
            </div>

            <Toast
                message={toast.message}
                isVisible={toast.show}
                onClose={() => setToast({ ...toast, show: false })}
            />
        </div>
    );
}
