"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

const DeletedAccountPage = () => {
    const router = useRouter();

    useEffect(() => {
        // 5초 후 홈으로 자동 리디렉션
        const timer = setTimeout(() => {
            router.push("/");
        }, 5000);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
                회원 탈퇴 완료
            </h1>
            <p className="text-lg text-gray-600 mb-8">
                회원 탈퇴 처리가 완료되었으며, 모든 데이터가 안전하게
                삭제되었습니다.
            </p>
            <p className="text-md text-gray-500">
                잠시 후 홈 페이지로 이동합니다.
            </p>
            <button
                onClick={() => router.push("/")}
                className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-300"
            >
                홈으로 바로 이동
            </button>
        </div>
    );
};

export default DeletedAccountPage;
