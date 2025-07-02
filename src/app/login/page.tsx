"use client";

import { useEffect, useState, useRef } from "react";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { AuroraText } from "@/components/magicui/aurora-text";
import { SparklesText } from "@/components/magicui/sparkles-text";
import { PlayIcon, PauseIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { motion, useInView } from "framer-motion";

// --- 사용자 후기 카드 컴포넌트 ---
const ReviewCard = ({ name, role, avatar, review }: { name: string, role: string, avatar: string, review: string }) => (
    <div className="relative w-72 h-64 shrink-0 overflow-hidden rounded-2xl border bg-white p-6 shadow-lg flex flex-col">
        <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-gray-100 text-2xl">{avatar}</div>
            <div className="flex-1">
                <p className="font-semibold text-gray-800">{name}</p>
                <p className="text-sm text-gray-500">{role}</p>
                <div className="flex gap-0.5 mt-1">
                    {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                    ))}
                </div>
            </div>
        </div>
        <p className="mt-4 text-gray-600 leading-relaxed flex-1 overflow-hidden">"{review}"</p>
    </div>
);

// --- Marquee(흘러가는) 효과 컴포넌트 ---
const Marquee = ({ children, speed = 60 }: { children: React.ReactNode, speed?: number }) => {
    const animationDuration = `${speed}s`;
    
    return (
        <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]">
            <div 
                className="flex w-max"
                style={{
                    animation: `scroll ${animationDuration} linear infinite`,
                }}
            >
                <div className="flex shrink-0 gap-4 pr-4">
                    {children}
                </div>
                <div className="flex shrink-0 gap-4 pr-4">
                    {children}
                </div>
            </div>
            <style jsx>{`
                @keyframes scroll {
                    0% {
                        transform: translateX(0);
                    }
                    100% {
                        transform: translateX(-50%);
                    }
                }
            `}</style>
        </div>
    );
};

// --- 스크롤 애니메이션을 위한 카드 컴포넌트 ---
const AnimatedFeatureCard = ({ title, children, delay = 0 }: { title: string, children: React.ReactNode, delay?: number }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, amount: 0.3 });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 50 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: delay }}
            className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center min-h-[450px]"
        >
            <h4 className="text-2xl font-semibold text-gray-800 mb-4 text-center">{title}</h4>
            {children}
        </motion.div>
    );
};

// --- 상단 고정 헤더 컴포넌트 ---
const FixedHeader = ({ onLoginClick }: { onLoginClick: () => void }) => (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
                <AuroraText className="text-2xl font-bold">Ling:to</AuroraText>
                <button
                    onClick={onLoginClick}
                    className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md font-medium hover:bg-gray-800 transition-colors"
                >
                    <img src="https://img.icons8.com/color/16/000000/google-logo.png" alt="Google logo" className="h-5 w-5" />
                    <span>시작하기</span>
                </button>
            </div>
        </div>
    </header>
);


export default function LoginPage() {
    const router = useRouter();

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            console.error("Google 로그인 실패:", error);
            alert(`로그인 중 오류 발생: ${error.message}`);
        }
    };
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) router.replace("/");
        });
        return () => unsubscribe();
    }, [router]);

    // === 데모 상태 및 핸들러들 ===
    const sampleTranscript = [
        { time: 0, text: "Hello, everyone. Welcome back to my channel." },
        { time: 5, text: "Today, we're going to talk about a very interesting topic." },
        { time: 10, text: "It's about learning English through YouTube videos." },
        { time: 15, text: "Ling:to helps you achieve that efficiently." },
    ];
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [isPlayingTranscript, setIsPlayingTranscript] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isPlayingTranscript) {
            timer = setInterval(() => {
                setCurrentSegmentIndex(prev => {
                    if (prev < sampleTranscript.length - 1) return prev + 1;
                    setIsPlayingTranscript(false);
                    return 0;
                });
            }, 2000);
        }
        return () => clearInterval(timer);
    }, [isPlayingTranscript, sampleTranscript.length]);
    
    const sampleSentence = "Ling:to provides interesting and challenging phrases for you.";
    const aiInterpretations: { [key: string]: string } = {
        "provides": "제공하다: 필요한 것을 주거나 이용할 수 있게 하다.",
        "interesting": "흥미로운: 호기심을 자극하거나 주의를 끄는.",
        "challenging": "도전적인: 어렵지만 성취감을 주는.",
        "phrases": "구문/표현: 둘 이상의 단어로 이루어진 말의 단위.",
    };
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
    
    const handleTextSelection = () => {
        const selection = window.getSelection();
        const text = selection?.toString().trim().replace(/[^a-zA-Z]/g, '').toLowerCase();
    
        if (text && aiInterpretations[text]) {
            const range = selection?.getRangeAt(0);
            const rect = range?.getBoundingClientRect();
            if (rect && rect.width > 0) {
                setSelectedText(text);
                setTooltipPosition({ top: rect.top, left: rect.left + rect.width / 2 });
            } else { setSelectedText(null); }
        } else { setSelectedText(null); }
    };
    
    useEffect(() => {
        const handleClickOutside = () => {
            if(window.getSelection()?.toString().trim() === '') { setSelectedText(null); }
        };
        document.addEventListener('mouseup', handleClickOutside);
        return () => document.removeEventListener('mouseup', handleClickOutside);
    }, []);

    const testimonials = [
        { name: "김민준", role: "대학생 (경영학과)", avatar: "🧑‍🎓", review: "전공 강의가 영어라 막막했는데, Ling:to로 관련 분야 유튜브 보면서 공부하니 배경지식이랑 영어가 한번에 잡혀요. AI 해석 기능은 진짜 신의 한 수!" },
        { name: "박서연", role: "마케터 (3년차)", avatar: "👩‍💼", review: "해외 컨퍼런스 영상 볼 때마다 자막 찾기 바빴는데, 이젠 그럴 필요가 없어요. AI 대화 기능으로 발표 연습까지 하니 자신감이 붙네요." },
        { name: "이현우", role: "소프트웨어 개발자", avatar: "👨‍💻", review: "기술 관련 해외 유튜브 채널을 자막 없이 바로 이해할 수 있다는 게 이렇게 편할 줄 몰랐습니다. 개발자에게 영어는 필수인데, 최고의 툴이에요." },
        { name: "최지아", role: "취업 준비생", avatar: "👩‍🎓", review: "영어 면접 때문에 스트레스가 많았는데, 관심있는 TED 영상으로 공부하고 AI랑 모의 면접처럼 대화하니 두려움이 많이 사라졌어요. 강추합니다!" },
        { name: "정은경", role: "프리랜서 번역가", avatar: "✍️", review: "아이들 재우고 미드 보는 게 낙이었는데, 이제는 그냥 보는 게 아니라 영어 공부까지 되네요. 하루 30분, 저를 위한 최고의 투자입니다." }
    ];

    return (
        <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12">
            <FixedHeader onLoginClick={handleGoogleSignIn} />

            <main className="w-full space-y-24 pt-24">
                {/* 1. Hero Section */}
                <section className="text-center max-w-6xl mx-auto px-4">
                    <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 leading-tight">
                        <span className="block">당신이 좋아하는 YouTube 영상이</span>
                        <span className="block mt-2"><AuroraText>최고의 영어 교재</AuroraText>가 됩니다.</span>
                    </h1>
                    <button
                        onClick={handleGoogleSignIn}
                        className="mt-12 group relative inline-flex items-center justify-center py-3 px-8 border border-transparent text-lg font-medium rounded-md text-white bg-black hover:bg-gray-800 transition-colors"
                    >
                        <img src="https://img.icons8.com/color/16/000000/google-logo.png" alt="Google logo" className="h-6 w-6 mr-3" />
                        3초만에 Google로 시작하기
                        <ChevronRightIcon className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" />
                    </button>
                </section>

                {/* 2. Social Proof Section (사용자 후기) */}
                <section className="space-y-8 max-w-7xl mx-auto">
                    <div className="text-center px-4">
                        <p className="font-semibold text-blue-600">이미 많은 분들이 Ling:to와 함께 성장하고 있습니다.</p>
                    </div>
                    <style jsx>{`
                        @keyframes marquee {
                            0% {
                                transform: translateX(0%);
                            }
                            100% {
                                transform: translateX(-50%);
                            }
                        }
                        .animate-marquee {
                            animation: marquee 60s linear infinite;
                        }
                    `}</style>
                    <div className="w-full">
                        <Marquee speed={60}>
                            {testimonials.concat(testimonials).map((item, i) => <ReviewCard key={i} {...item} />)}
                        </Marquee>
                    </div>
                </section>

                {/* 3. Feature Demo Section */}
                <section className="space-y-12 max-w-6xl mx-auto px-4">
                     <div className="text-center">
                        <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900">
                            <SparklesText>Ling:to 주요 기능 미리보기</SparklesText>
                        </h3>
                        <p className="mt-4 text-gray-600 text-lg max-w-3xl mx-auto">
                            실제 화면처럼 동작하는 데모를 통해 Ling:to의 강력한 기능들을 경험해보세요.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
                        <AnimatedFeatureCard title="📊 실시간 자막 분석" delay={0}>
                            <p className="text-gray-600 mb-6 text-center leading-relaxed">영상 재생에 맞춰 자막이 하이라이트되어, 듣기와 읽기를 동시에 훈련할 수 있습니다.</p>
                            <div className="w-full bg-gray-50 p-4 rounded-2xl shadow-inner text-sm font-mono overflow-y-auto h-48 border border-gray-200 relative">
                                {sampleTranscript.map((segment, index) => (
                                    <p key={index} className={`py-1 px-2 rounded-md transition-colors duration-300 ${currentSegmentIndex === index ? "bg-blue-100 text-blue-800" : "text-gray-700"}`}>
                                        [{new Date(segment.time * 1000).toISOString().substr(14, 5)}] {segment.text}
                                    </p>
                                ))}
                                <div className="absolute bottom-2 right-2">
                                    <button onClick={() => setIsPlayingTranscript(p => !p)} className="p-2 rounded-full bg-blue-500 text-white shadow-md hover:bg-blue-600">
                                        {isPlayingTranscript ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                        </AnimatedFeatureCard>

                        <AnimatedFeatureCard title="💡 문맥을 파고드는 AI 해석" delay={0.2}>
                            <p className="text-gray-600 mb-6 text-center leading-relaxed">모르는 표현을 드래그하여 문맥에 맞는 가장 자연스러운 뜻을 즉시 확인하세요.</p>
                            <div
                                onMouseUp={handleTextSelection}
                                className="w-full bg-gray-50 p-6 rounded-2xl shadow-inner text-lg border border-gray-200 select-text cursor-text"
                            >
                                <p>{sampleSentence}</p>
                            </div>
                            <p className="mt-4 text-xs text-gray-400">↑ 위 문장에서 단어를 드래그해보세요.</p>
                            {selectedText && tooltipPosition && (
                                <div
                                    className="fixed z-50 bg-gray-800 text-white text-sm rounded-lg shadow-xl py-2 px-3 max-w-xs transform -translate-x-1/2 -translate-y-full mb-2"
                                    style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
                                >
                                    <strong className="capitalize">{selectedText}:</strong> {aiInterpretations[selectedText] || "해석을 찾을 수 없습니다."}
                                </div>
                            )}
                        </AnimatedFeatureCard>

                        <AnimatedFeatureCard title="💬 AI와 실전 스피킹" delay={0.4}>
                            <p className="text-gray-600 mb-6 text-center leading-relaxed">영상 내용에 대해 AI와 자유롭게 대화하며 배운 표현을 직접 사용하고 연습하세요.</p>
                            <div className="w-full bg-gray-50 p-6 rounded-2xl shadow-inner border border-gray-200 flex flex-col items-center justify-center flex-grow">
                                <p className="text-gray-500 text-center mb-4">"What was the main point of this video?"</p>
                                <div className="flex justify-center space-x-1 my-4">
                                    {[8, 12, 10, 14, 9].map((h, i) => (
                                        <div key={i} style={{ height: `${h}px`, animationDelay: `${i * 100}ms` }} className={`w-1.5 bg-blue-400 rounded-full animate-pulse`} />
                                    ))}
                                </div>
                                <p className="text-blue-600 font-medium text-sm">AI가 듣고 있어요...</p>
                            </div>
                        </AnimatedFeatureCard>
                    </div>
                </section>

                 <section className="text-center pt-12 pb-4 max-w-6xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-gray-800">
                        이제, 당신의 영어 학습을 업그레이드할 시간입니다.
                    </h2>
                    <p className="mt-4 text-lg text-gray-600">
                        망설일 필요 없어요. 지금 바로 시작해보세요!
                    </p>
                    <button
                        onClick={handleGoogleSignIn}
                        className="mt-8 group relative inline-flex items-center justify-center py-3 px-8 border border-transparent text-lg font-medium rounded-md text-white bg-black hover:bg-gray-800 transition-colors"
                    >
                         <img src="https://img.icons8.com/color/16/000000/google-logo.png" alt="Google logo" className="h-6 w-6 mr-3" />
                        지금 무료로 시작하기
                        <ChevronRightIcon className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" />
                    </button>
                </section>
            </main>
        </div>
    );
}