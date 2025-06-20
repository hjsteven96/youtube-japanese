import React from "react";

const LoadingAnimation = () => (
    <div className="flex flex-col items-center justify-center p-8">
        <div className="relative w-32 h-32">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 animate-spin">
                <div className="absolute inset-2 bg-white rounded-full"></div>
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 opacity-50 blur-xl animate-pulse"></div>
        </div>
        <div className="mt-6 space-y-2">
            <div className="h-2 w-48 bg-gradient-to-r from-blue-300 to-purple-300 rounded-full animate-pulse"></div>
            <div className="h-2 w-36 bg-gradient-to-r from-purple-300 to-pink-300 rounded-full animate-pulse mx-auto"></div>
            <p className="text-gray-600 text-center mt-4 font-medium">
                AI가 영상을 분석하고 있어요...
            </p>
            <p className="text-gray-500 text-center text-sm">
                잠시만 기다려주세요 ✨
            </p>
        </div>
    </div>
);

export default LoadingAnimation;
