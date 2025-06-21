import type { Metadata, Viewport } from "next";

import { Inter, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import AuthHeader from "./components/AuthHeader"; // ★ 추가: AuthHeader 임포트

// 영어와 한국어에 최적화된 폰트 설정
const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
    display: "swap",
});

const notoSansKR = Noto_Sans_KR({
    variable: "--font-noto-sans-kr",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

// 1. Metadata 객체
export const metadata: Metadata = {
    // ★ metadataBase 추가: 환경 변수에 따라 동적으로 설정
    metadataBase: new URL(
        process.env.NEXT_PUBLIC_APP_URL ||
            `https://${process.env.VERCEL_URL}` ||
            "http://localhost:3000"
    ),
    title: "Lincue - 링크만 넣으면 영어로 큐! YouTube로 배우는 영어",
    description:
        "YouTube 영상을 AI로 분석하여 실전 영어를 학습하세요. 자막, 핵심 표현, AI 대화 연습까지!",
    keywords: [
        "영어학습",
        "YouTube 영어",
        "AI 영어교육",
        "영어회화",
        "영상학습",
    ],
    authors: [{ name: "Your Company Name" }],
    // PWA를 위한 manifest 경로
    manifest: "/manifest.json",
    openGraph: {
        title: "YouTube로 배우는 영어 - AI 영어학습 플랫폼",
        description:
            "YouTube 영상으로 실전 영어를 배우고 AI와 대화하며 연습하세요",
        type: "website",
        locale: "ko_KR",
        alternateLocale: "en_US",
        siteName: "YouTube English Learning",
        images: [
            {
                url: "/og-image.png", // metadataBase를 기준으로 절대 경로가 됨
                width: 1200,
                height: 630,
                alt: "YouTube로 배우는 영어",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "YouTube로 배우는 영어 | AI 영어학습",
        description: "YouTube 영상을 AI로 분석하여 실전 영어를 학습하세요",
        images: ["/twitter-image.png"], // metadataBase를 기준으로 절대 경로가 됨
    },
    icons: {
        icon: [
            { url: "/favicon.ico" },
            { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
            { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        ],
        apple: [{ url: "/apple-touch-icon.png" }],
    },
    // ★ viewport, themeColor는 여기서 제거
};

// 2. Viewport 객체 별도 export
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    themeColor: "#4F46E5", // 보라색 테마
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko" className={`${inter.variable} ${notoSansKR.variable}`}>
            <head>
                {/* 추가적인 메타 태그 */}
                <meta
                    name="application-name"
                    content="YouTube English Learning"
                />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta
                    name="apple-mobile-web-app-status-bar-style"
                    content="default"
                />
                <meta name="apple-mobile-web-app-title" content="영어학습" />
                <meta name="format-detection" content="telephone=no" />
                <meta name="mobile-web-app-capable" content="yes" />

                {/* 구글 폰트 프리커넥트로 성능 최적화 */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
            </head>
            <body
                className={`antialiased bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 min-h-screen`}
                style={{
                    fontFamily: `var(--font-inter), var(--font-noto-sans-kr), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
                }}
            >
                {/* 접근성을 위한 Skip to content 링크 */}
                <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
                >
                    메인 콘텐츠로 건너뛰기
                </a>

                {/* ★ 추가: AuthHeader 컴포넌트 포함 */}
                <AuthHeader />
                {/* header 높이만큼 콘텐츠 시작 위치 조정 (fixed header 때문에) */}
                <div className="pt-[76px]">
                    {/* Header의 예상 높이 64px + 여백 12px */}
                    <main id="main-content">{children}</main>
                </div>
            </body>
        </html>
    );
}
