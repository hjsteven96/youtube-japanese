import { useState, useEffect } from "react";

const useIsMobile = (breakpoint: number = 768): boolean => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // 클라이언트 사이드에서만 window 객체에 접근
        if (typeof window !== "undefined") {
            const checkScreenSize = () => {
                setIsMobile(window.innerWidth < breakpoint);
            };

            // 초기 실행
            checkScreenSize();

            // 리사이즈 이벤트 리스너 추가
            window.addEventListener("resize", checkScreenSize);

            // 컴포넌트 언마운트 시 리스너 제거
            return () => window.removeEventListener("resize", checkScreenSize);
        }
    }, [breakpoint]);

    return isMobile;
};

export default useIsMobile;
