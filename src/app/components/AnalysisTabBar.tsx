"use client";

import React from "react";

type ActiveTab = "analysis" | "transcript" | "questions";

interface AnalysisTabBarProps {
    activeTab: ActiveTab;
    setActiveTab: (tab: ActiveTab) => void;
    className?: string; // 추가: 외부에서 스타일을 받을 수 있도록 className prop 추가
}

const TabButton = ({
    tabName,
    label,
    activeTab,
    setActiveTab,
}: {
    tabName: ActiveTab;
    label: string;
    activeTab: ActiveTab;
    setActiveTab: (tab: ActiveTab) => void;
}) => (
    <button
        className={`px-6 py-3 font-semibold transition-all duration-300 ${
            activeTab === tabName
                ? "text-black border-b-2 border-blue-500"
                : "text-gray-400 hover:text-gray-600 border-b-2 border-transparent"
        }`}
        onClick={() => setActiveTab(tabName)}
    >
        {label}
    </button>
);

const AnalysisTabBar = ({
    activeTab,
    setActiveTab,
    className,
}: AnalysisTabBarProps) => {
    return (
        <div
            className={`flex space-x-2 border-b-2 border-gray-100 bg-white ${
                className || ""
            }`}
        >
            {" "}
            {/* className 적용 */}
            <TabButton
                tabName="transcript"
                label="자막"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />
            <TabButton
                tabName="analysis"
                label="주요 표현"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />
            <TabButton
                tabName="questions"
                label="AI 대화"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />
        </div>
    );
};

export default AnalysisTabBar;
