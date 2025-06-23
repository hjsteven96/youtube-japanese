// src/app/components/AuthHeader.tsx
"use client";

import { useState, useEffect } from "react";
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    User,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import Link from "next/link"; // 로고 클릭 시 홈으로 이동

export default function AuthHeader() {
    const [user, setUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true); // 인증 초기화 로딩 상태
    const [visible, setVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // 로그인 성공 시 별도 처리 불필요 (onAuthStateChanged가 알아서 user 상태 업데이트)
        } catch (error: any) {
            console.error("Google 로그인 실패:", error);
            alert(`로그인 중 오류 발생: ${error.message}`);
        }
    };

     // --- 스크롤 이벤트 핸들러 추가 ---
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // 스크롤을 아래로 내릴 때, 그리고 스크롤이 헤더 높이보다 많이 내려갔을 때
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                setVisible(false);
            } else { // 스크롤을 위로 올릴 때
                setVisible(true);
            }
            // 마지막 스크롤 위치 업데이트
            setLastScrollY(currentScrollY);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [lastScrollY]);


    const handleGoogleSignOut = async () => {
        try {
            await signOut(auth);
            // 로그아웃 성공 시 별도 처리 불필요 (onAuthStateChanged가 알아서 user 상태 업데이트)
        } catch (error: any) {
            console.error("로그아웃 실패:", error);
            alert(`로그아웃 중 오류 발생: ${error.message}`);
        }
    };

    return (
        <header
            className={`w-full bg-white bg-opacity-90 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-40 p-4 border-b border-gray-100 transform transition-transform duration-300 ease-in-out ${
                visible ? "translate-y-0" : "-translate-y-full"
            }`}
        >     <nav className="max-w-7xl mx-auto flex justify-between items-center">
                <Link href="/" className="flex items-center space-x-2">
                    <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Ling:to
                    </span>
                    <span className="hidden sm:inline text-gray-500 text-sm">
                        유튜브로 배우는 영어
                    </span>
                </Link>

                <div className="flex items-center space-x-4">
                    {loadingAuth ? (
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                    ) : user ? (
                        <>
                            <span className="text-gray-700 text-sm md:text-base">
                                안녕하세요,{" "}
                                <span className="font-semibold text-blue-600">
                                    {user.displayName || user.email}
                                </span>{" "}
                                님!
                            </span>
                            <button
                                onClick={handleGoogleSignOut}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
                            >
                                로그아웃
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleGoogleSignIn}
                            className="btn-primary text-sm py-2 px-4"
                        >
                            Google로 시작하기
                        </button>
                    )}
                </div>
            </nav>
        </header>
    );
}
