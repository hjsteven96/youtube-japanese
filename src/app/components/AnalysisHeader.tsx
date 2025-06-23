// src/app/components/AnalysisHeader.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ShareIcon } from "@heroicons/react/24/solid";
import useIsMobile from "../../lib/useIsMobile";
import Toast from "./Toast";

// Toast 컴포넌트가 필요하므로 함께 가져옵니다.

export default function AnalysisHeader() {
    const router = useRouter();
    const isMobile = useIsMobile();

    const [isVisible, setIsVisible] = useState(true);
    const lastScrollY = useRef(0);

    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    // 스크롤 방향에 따라 헤더 보이기/숨기기 처리
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // 상단에서 약간의 스크롤에는 반응하지 않도록 임계값 설정
            if (currentScrollY < 80) {
                setIsVisible(true);
                lastScrollY.current = currentScrollY;
                return;
            }

            // 스크롤 다운
            if (currentScrollY > lastScrollY.current) {
                setIsVisible(false);
            }
            // 스크롤 업
            else {
                setIsVisible(true);
            }
            lastScrollY.current = currentScrollY;
        };

        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    // 뒤로가기 핸들러
    const handleBack = () => {
        router.push("/");
    };

    // 공유하기 핸들러
    const handleShare = async () => {
        const shareData = {
            title: document.title,
            text: "유튜브 영상으로 함께 영어 공부해요!",
            url: window.location.href,
        };

        // Web Share API 지원 여부 확인
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error("Share failed:", err);
            }
        } else {
            // 미지원 시 클립보드에 복사
            try {
                await navigator.clipboard.writeText(window.location.href);
                setToastMessage("링크가 복사되었어요!");
                setShowToast(true);
            } catch (err) {
                setToastMessage("링크 복사에 실패했어요");
                setShowToast(true);
                console.error("Copy failed:", err);
            }
        }
    };

    return (
        <>
            <header
                className={`fixed top-0 left-0 right-0 z-50 bg-white bg-opacity-70 backdrop-blur-md shadow-sm transition-transform duration-300 ease-in-out ${
                    isVisible ? "translate-y-0" : "-translate-y-full"
                }`}
            >
                <div className="max-w-6xl mx-auto flex justify-between items-center px-4 py-3">
                    {/* 좌측: 뒤로가기 */}
                    <button
                        onClick={handleBack}
                        className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
                    >
                        <ArrowLeftIcon className="h-6 w-6" />
                        <span className="font-semibold text-base">
                            다른 영상 공부하기
                        </span>
                    </button>

                    {/* 우측: 공유하기 */}
                    <button
                        onClick={handleShare}
                        className="flex items-center space-x-2 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        <ShareIcon className="h-5 w-5" />
                        {!isMobile && <span className="text-sm">공유하기</span>}
                    </button>
                </div>
            </header>
            <Toast
                message={toastMessage}
                isVisible={showToast}
                onClose={() => setShowToast(false)}
            />
        </>
    );
}
