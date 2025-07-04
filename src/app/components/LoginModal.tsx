"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { XMarkIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { createPortal } from "react-dom";

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // 로그인 성공 시 모달 닫기
            onClose();
        } catch (error: any) {
            console.error("Google 로그인 실패:", error);
            alert(`로그인 중 오류 발생: ${error.message}`);
        }
    };

    if (!isOpen) return null;

    // createPortal을 사용하여 모달을 document.body에 렌더링합니다.
    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    // 배경 블러 효과를 강화하고, 모달이 중앙에 오도록 items-center로 변경
                    className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 backdrop-filter backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 50 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 50 }}
                        // mt-12 (margin-top)을 제거하여 수직 중앙 정렬이 되도록 함
                        className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full relative mx-auto"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                            aria-label="모달 닫기"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>

                        <div className="text-center mb-8 mt-4">
                            <h2 className="text-3xl font-extrabold text-blue-500 mb-2">
                                Ling:to
                            </h2>
                            <p className="text-base text-gray-600 mt-6">
                                5초만에 로그인하고 <span className="font-semibold text-blue-600">유튜브 영상</span>으로 재밌게 영어 공부하세요!
                            </p>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={handleGoogleSignIn}
                                className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray rounded-lg text-base font-medium text-gray-200 bg-black hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                <img src="https://img.icons8.com/color/16/000000/google-logo.png" alt="Google logo" className="h-5 w-5" />
                                <span>구글 계정으로 시작하기</span>
                            </button>
                            {/* 네이버 로그인 버튼은 임시로 주석 처리하거나 제거 (요청에 없었음) */}
                            {/* <button
                                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#03C75A] rounded-lg text-base font-medium text-white hover:bg-[#02B851] transition-colors shadow-sm"
                            >
                                <img src="https://img.icons8.com/color/16/000000/naver.png" alt="Naver logo" className="h-5 w-5" />
                                <span>네이버 계정으로 시작하기</span>
                            </button> */}
                          
                        </div>

                        <div className="mt-8 text-center text-xs text-gray-500">
                            <p>로그인하면 하단 정책에 모두 동의하는 것으로 간주합니다.</p>
                            <div className="flex justify-center gap-4 mt-2">
                                <Link href="#" className="underline hover:text-gray-700">이용약관</Link>
                                <Link href="#" className="underline hover:text-gray-700">개인정보처리방침</Link>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
        , document.body
    );
} 