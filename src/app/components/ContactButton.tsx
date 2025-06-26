// src/app/components/ContactButton.tsx
"use client"; // 이 컴포넌트는 브라우저에서 상호작용해야 하므로 클라이언트 컴포넌트로 지정합니다.

import React from "react";

export default function ContactButton() {
    // onClick에 사용될 함수입니다.
    // window 객체를 사용하므로 클라이언트 컴포넌트 안에 있어야 안전합니다.
    const handleContactClick = () => {
        window.open("https://open.kakao.com/o/sl0HG7Ch", "_blank");
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <button
                onClick={handleContactClick}
                className="relative bg-gradient-to-r from-blue-300/80 to-white/30
                           backdrop-blur-md border border-white/30
                           text-gray-700 font-semibold py-3 px-6 rounded-full
                           shadow-md transition-all duration-300
                           hover:from-blue-300/60 hover:to-blue-100/40 hover:scale-105
                           flex items-center space-x-2"
            >
                <span className="md:hidden">문의하기</span>
                <span className="hidden md:inline">
                    문의나 요청사항이 있다면?
                </span>
                <svg
                    className="w-4 h-4 md:w-6 md:h-6"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        fillRule="evenodd"
                        d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.111A8.933 8.933 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7z"
                        clipRule="evenodd"
                    />
                </svg>
            </button>
        </div>
    );
}
