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
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ArrowLeftIcon, ShareIcon } from '@heroicons/react/24/solid';

export default function AuthHeader() {
    const [user, setUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [visible, setVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    const pathname = usePathname();
    const isMainPage = pathname === '/';
    const isAnalysisPage = pathname.startsWith('/analysis/');

    // 인증 및 스크롤 관련 useEffect 훅 (기존과 동일)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                setVisible(false);
            } else {
                setVisible(true);
            }
            setLastScrollY(currentScrollY);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [lastScrollY]);

    // 핸들러 함수들 (기존과 동일)
    const handleGoogleSignIn = async () => { /* ... */ };
    const handleGoogleSignOut = async () => { /* ... */ };
    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'Ling:to에서 영어 공부하기',
                text: '이 유튜브 영상으로 영어를 배워보세요!',
                url: window.location.href,
            }).catch((error) => console.log('공유 실패', error));
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert('링크가 클립보드에 복사되었습니다.');
        }
    };

    // 헤더 클래스 정의 (기존과 동일)
    const headerClasses = clsx(
        'w-full fixed top-0 left-0 right-0 z-40 p-4 border-b transition-all duration-300 ease-in-out',
        {
            'bg-white/90 backdrop-blur-md shadow-sm border-gray-100': isMainPage,
            'bg-white shadow-md border-gray-200': isAnalysisPage,
            'bg-white shadow-sm border-gray-100': !isMainPage && !isAnalysisPage,
            'translate-y-0': visible,
            '-translate-y-full': !visible,
        }
    );

    return (
        <header className={headerClasses}>
            <nav className="max-w-7xl mx-auto flex justify-between items-center">
                {/* --- 헤더 왼쪽 영역 --- */}
                {isAnalysisPage ? (
                    // 분석 페이지: 뒤로가기 링크
                    <Link href="/" className="flex items-center text-gray-600 hover:text-blue-600 transition-colors">
                        <ArrowLeftIcon className="h-5 w-5 mr-2" />
                        <span className="font-medium text-sm sm:text-base">다른 영상 공부하기</span>
                    </Link>
                ) : (
                    // 그 외 페이지: 로고
                    <Link href="/" className="flex items-center space-x-2">
                        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Ling:to
                        </span>
                        <span className="hidden sm:inline text-gray-500 text-sm">
                            유튜브로 배우는 영어
                        </span>
                    </Link>
                )}

                {/* --- 헤더 오른쪽 영역 (수정된 부분) --- */}
                {isAnalysisPage ? (
                    // 분석 페이지: 공유하기 버튼
                    <button onClick={handleShare} className="text-gray-500 hover:text-blue-600 transition-colors p-2 rounded-full hover:bg-gray-100">
                        <ShareIcon className="h-4 w-4" />
                    </button>
                ) : (
                    // 그 외 페이지: 인증 관련 UI
                    <div className="flex items-center space-x-4">
                        {loadingAuth ? (
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                        ) : user ? (
                            <>
                                <span className="hidden sm:inline text-gray-700 text-sm md:text-base">
                                    안녕하세요,{" "}
                                    <span className="font-semibold text-blue-600">
                                        {user.displayName || user.email}
                                    </span>{" "}
                                    님!
                                </span>
                                <button
                                    onClick={handleGoogleSignOut}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-3 rounded-lg transition-colors duration-200 text-sm"
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
                )}
            </nav>
        </header>
    );
}