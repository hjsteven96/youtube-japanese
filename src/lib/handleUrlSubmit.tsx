import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { User } from "firebase/auth";

// 함수에 필요한 모든 상태와 세터 함수들을 인자로 받기 위한 인터페이스
interface HandleUrlSubmitParams {
    submittedUrl: string;
    user: User | null;
    setYoutubeUrl: (url: string) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
    setAnalysisData: (data: any | null) => void; // GeminiResponseData 타입 사용 권장
    setCurrentTime: (time: number) => void;
    setActiveTab: (tab: "analysis" | "transcript" | "questions") => void;
}

// GeminiResponseData 타입을 여기서도 정의하거나, 별도의 types 파일에서 가져옵니다.
interface GeminiResponseData {
    analysis: any; // 실제 타입으로 교체 권장
    transcript_text: string;
    youtubeTitle?: string;
}

export const handleUrlSubmit = async ({
    submittedUrl,
    user,
    setYoutubeUrl,
    setLoading,
    setError,
    setAnalysisData,
    setCurrentTime,
    setActiveTab,
}: HandleUrlSubmitParams): Promise<void> => {
    // 1. 유효성 검사
    if (!submittedUrl || submittedUrl.trim() === "") {
        setError("URL을 입력해주세요.");
        return;
    }
    const youtubeRegex =
        /^(https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11}))/;
    if (!youtubeRegex.test(submittedUrl)) {
        setError("유효한 YouTube 영상 URL을 입력해주세요.");
        return;
    }

    // 2. 상태 초기화
    setYoutubeUrl(submittedUrl);
    setLoading(true);
    setError("");
    setAnalysisData(null);
    setCurrentTime(0);
    setActiveTab("analysis");

    if (!user) {
        alert("로그인 후 이용해주세요.");
        setLoading(false);
        return;
    }

    // 3. Firestore 캐시 확인
    const docId = encodeURIComponent(submittedUrl).replace(/\./g, "_");

    try {
        const docRef = doc(db, "videoAnalyses", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log("Firestore에서 캐시된 데이터를 찾았습니다.");
            const cachedData = docSnap.data() as GeminiResponseData;
            setAnalysisData(cachedData);
            return; // 캐시 사용 시 여기서 종료
        }

        // 4. 캐시가 없을 때 API 호출
        console.log(
            "캐시된 데이터가 없습니다. Gemini API로 분석을 요청합니다."
        );
        const response = await fetch("/api/transcript", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ youtubeUrl: submittedUrl }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
                errorData.error || "분석 데이터를 가져오는데 실패했습니다."
            );
        }

        const data: GeminiResponseData = await response.json();
        setAnalysisData(data);

        // 5. 새로운 분석 결과를 Firestore에 저장
        await setDoc(docRef, { ...data, timestamp: new Date().toISOString() });
        console.log("새로운 분석 결과를 Firestore에 저장했습니다.");
    } catch (err: any) {
        setError(err.message || "알 수 없는 오류가 발생했습니다.");
    } finally {
        setLoading(false); // 모든 작업이 끝나면 로딩 상태 해제
    }
};
