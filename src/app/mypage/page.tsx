"use client";

import React, { useState, useEffect } from "react";
import {
    onAuthStateChanged,
    User,
    signOut,
    getAuth,
    EmailAuthProvider,
    reauthenticateWithCredential,
    GoogleAuthProvider,
    reauthenticateWithPopup,
} from "firebase/auth";
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    deleteDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getUserProfile } from "@/lib/user";
import { PLANS, UserProfile } from "@/lib/plans";
import type { SavedExpression } from "../components/SavedExpressions";
import Alert from "../components/Alert";
import Toast from "../components/Toast";
import { useRouter } from "next/navigation";
import AuthHeader from "../components/AuthHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Trash2, ExternalLink } from "lucide-react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface LearningHistoryItem {
    videoId: string;
    youtubeUrl: string;
    title: string;
    duration: number;
    timestamp: string; // ISO 8601 format
    lastPlayedTime: number;
    thumbnailUrl?: string; // 썸네일 URL 추가
}

const MyPage = () => {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [savedExpressions, setSavedExpressions] = useState<SavedExpression[]>(
        []
    );
    const [learningHistory, setLearningHistory] = useState<
        LearningHistoryItem[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [showToast, setShowToast] = useState(false);
    const [showReauthModal, setShowReauthModal] = useState(false);
    const [password, setPassword] = useState("");
    const [authMethod, setAuthMethod] = useState<"email" | "google" | null>(
        null
    );
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    const profile = await getUserProfile(currentUser.uid);
                    setUserProfile(profile);

                    // Fetch Saved Expressions
                    const savedExpressionsQuery = query(
                        collection(
                            db,
                            `users/${currentUser.uid}/savedInterpretations`
                        ),
                        orderBy("timestamp", "desc")
                    );
                    const savedExpressionsSnapshot = await getDocs(
                        savedExpressionsQuery
                    );
                    const expressions = savedExpressionsSnapshot.docs.map(
                        (doc) => ({
                            id: doc.id,
                            ...doc.data(),
                        })
                    ) as SavedExpression[];
                    setSavedExpressions(expressions);

                    // Fetch Learning History
                    const learningHistoryQuery = query(
                        collection(
                            db,
                            `users/${currentUser.uid}/learningHistory`
                        ),
                        orderBy("timestamp", "desc")
                    );
                    const learningHistorySnapshot = await getDocs(
                        learningHistoryQuery
                    );
                    const history = learningHistorySnapshot.docs.map((doc) => ({
                        videoId: doc.id,
                        ...doc.data(),
                        thumbnailUrl: `https://img.youtube.com/vi/${doc.id}/hqdefault.jpg`, // 썸네일 URL 추가
                    })) as LearningHistoryItem[];
                    setLearningHistory(history);
                } catch (err) {
                    console.error("Error fetching user data:", err);
                    setError("사용자 데이터를 불러오는 데 실패했습니다.");
                } finally {
                    setLoading(false);
                }
            } else {
                setUser(null);
                setUserProfile(null);
                setSavedExpressions([]);
                setLearningHistory([]);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const handleDeleteExpression = async (expressionId: string) => {
        if (!user) return;
        try {
            await deleteDoc(
                doc(db, `users/${user.uid}/savedInterpretations`, expressionId)
            );
            setSavedExpressions((prev) =>
                prev.filter((exp) => exp.id !== expressionId)
            );
            // Optionally, show a toast or message for successful deletion
        } catch (error) {
            console.error("Error deleting expression:", error);
            // Optionally, show an error message
        }
    };

    const handleDeleteAccount = async () => {
        setShowAlertModal(true);
    };

    const confirmDeleteAccount = async () => {
        if (!user) return;

        setLoading(true);
        try {
            // 1. Firestore에서 사용자 관련 데이터 삭제
            const savedExpressionsRef = collection(
                db,
                `users/${user.uid}/savedInterpretations`
            );
            const savedExpressionsSnapshot = await getDocs(savedExpressionsRef);
            const deleteSavedExpressionsPromises =
                savedExpressionsSnapshot.docs.map((doc) => deleteDoc(doc.ref));
            await Promise.all(deleteSavedExpressionsPromises);

            const learningHistoryRef = collection(
                db,
                `users/${user.uid}/learningHistory`
            );
            const learningHistorySnapshot = await getDocs(learningHistoryRef);
            const deleteLearningHistoryPromises =
                learningHistorySnapshot.docs.map((doc) => deleteDoc(doc.ref));
            await Promise.all(deleteLearningHistoryPromises);

            await deleteDoc(doc(db, "users", user.uid));

            // 2. Firebase Authentication에서 사용자 삭제
            // user.delete() 대신 재인증 로직을 통해 처리
            setShowAlertModal(false); // 기존 삭제 확인 모달 닫기
            // Determine authentication method
            const providerId = user.providerData[0]?.providerId;
            if (providerId === "google.com") {
                setAuthMethod("google");
            } else if (
                user.email &&
                user.providerData.some((p) => p.providerId === "password")
            ) {
                setAuthMethod("email");
            } else {
                // Fallback for other providers or unexpected scenarios
                setError(
                    "지원하지 않는 인증 방식입니다. 고객 지원팀에 문의해주세요."
                );
                setLoading(false);
                return;
            }
            setShowReauthModal(true); // 재인증 모달 열기
        } catch (error: any) {
            console.error("회원 탈퇴 중 오류:", error);
            // Firebase Error Codes for user deletion issues
            if (error.code === "auth/requires-recent-login") {
                setError("보안상의 이유로 다시 로그인해야 탈퇴할 수 있습니다.");
                setShowAlertModal(false); // 기존 삭제 확인 모달 닫기
                // Determine authentication method again for error case
                const providerId = user.providerData[0]?.providerId;
                if (providerId === "google.com") {
                    setAuthMethod("google");
                } else if (
                    user.email &&
                    user.providerData.some((p) => p.providerId === "password")
                ) {
                    setAuthMethod("email");
                } else {
                    setError(
                        "지원하지 않는 인증 방식입니다. 고객 지원팀에 문의해주세요."
                    );
                    setLoading(false);
                    return;
                }
                setShowReauthModal(true); // 재인증 모달 열기
            } else {
                setError(
                    "회원 탈퇴 중 오류가 발생했습니다. 다시 시도해주세요."
                );
            }
        } finally {
            setLoading(false);
            // 재인증 모달이 열린 경우에는 기존 모달을 닫지 않음
            if (!showReauthModal) {
                setShowAlertModal(false);
            }
        }
    };

    const handleReauthenticateAndDelete = async () => {
        if (!user) return;

        setLoading(true);
        try {
            if (authMethod === "email" && user.email) {
                const credential = EmailAuthProvider.credential(
                    user.email,
                    password
                );
                await reauthenticateWithCredential(user, credential);
            } else if (authMethod === "google") {
                const provider = new GoogleAuthProvider();
                await reauthenticateWithPopup(user, provider);
            } else {
                setError("알 수 없는 인증 방식입니다.");
                setLoading(false);
                setShowReauthModal(false);
                return;
            }

            // 재인증 성공 후 계정 삭제 진행
            await user.delete();

            // Firestore 데이터 삭제 (기존 confirmDeleteAccount 로직 재활용)
            const savedExpressionsRef = collection(
                db,
                `users/${user.uid}/savedInterpretations`
            );
            const savedExpressionsSnapshot = await getDocs(savedExpressionsRef);
            const deleteSavedExpressionsPromises =
                savedExpressionsSnapshot.docs.map((doc) => deleteDoc(doc.ref));
            await Promise.all(deleteSavedExpressionsPromises);

            const learningHistoryRef = collection(
                db,
                `users/${user.uid}/learningHistory`
            );
            const learningHistorySnapshot = await getDocs(learningHistoryRef);
            const deleteLearningHistoryPromises =
                learningHistorySnapshot.docs.map((doc) => deleteDoc(doc.ref));
            await Promise.all(deleteLearningHistoryPromises);

            await deleteDoc(doc(db, "users", user.uid));

            // 회원 탈퇴 완료 페이지로 리다이렉트
            router.push("/deleted");
        } catch (error: any) {
            console.error("재인증 및 회원 탈퇴 중 오류:", error);
            if (error.code === "auth/wrong-password") {
                setError("비밀번호가 올바르지 않습니다.");
            } else if (error.code === "auth/popup-closed-by-user") {
                setError("재인증 팝업이 닫혔습니다.");
            } else {
                setError("재인증에 실패했습니다. 다시 시도해주세요.");
            }
        } finally {
            setLoading(false);
            setShowReauthModal(false);
            setPassword(""); // 비밀번호 초기화
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push("/"); // 로그아웃 성공 시 홈으로 리디렉션
        } catch (error) {
            console.error("로그아웃 실패:", error);
            setError("로그아웃 중 오류가 발생했습니다.");
        }
    };

    if (loading) {
        return <div className="text-center p-8">로딩 중...</div>;
    }

    if (error) {
        return (
            <div className="text-center p-8 text-red-600">오류: {error}</div>
        );
    }

    if (!user) {
        return <div className="text-center p-8">로그인 후 이용해주세요.</div>;
    }

    const currentPlan = userProfile ? PLANS[userProfile.plan] : null;

    return (
        <div className="container mx-auto p-4 max-w-4xl pt-24 space-y-6">
            <AuthHeader />

            {/* 프로필 정보 */}
            <Card className="p-6 border border-gray-200">
                <div className="flex items-center space-x-6">
                    <Avatar className="w-20 h-20">
                        <AvatarImage
                            src={user?.photoURL || undefined}
                            alt={user?.displayName || "User Avatar"}
                        />
                        <AvatarFallback className="text-2xl font-semibold bg-blue-500 text-white">
                            {user?.displayName
                                ? user.displayName.charAt(0)
                                : user?.email?.charAt(0) || "U"}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">
                            {user?.displayName || "이름 없음"}
                        </h1>
                        <p className="text-gray-600">
                            {user?.email || "이메일 없음"}
                        </p>
                        {user?.metadata.creationTime && (
                            <p className="text-sm text-gray-500 mt-1">
                                가입일:{" "}
                                {format(
                                    new Date(user.metadata.creationTime),
                                    "yyyy년 MM월 dd일"
                                )}
                            </p>
                        )}
                    </div>
                </div>
            </Card>

            {/* 내 플랜 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">내 플랜</CardTitle>
                </CardHeader>
                <CardContent>
                    {currentPlan ? (
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="font-medium">플랜</span>
                                <span className="text-blue-500 font-semibold">
                                    {currentPlan.name}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>일일 분석 제한</span>
                                <span>
                                    {currentPlan.dailyAnalysisLimit === 100
                                        ? "무제한"
                                        : `${currentPlan.dailyAnalysisLimit}회`}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>최대 영상 길이</span>
                                <span>
                                    {currentPlan.maxVideoDuration / 60}분
                                </span>
                            </div>
                            <div className="flex justify-between"></div>

                            {userProfile?.usage && (
                                <div className="pt-3 mt-3 border-t border-gray-200">
                                    <div className="flex justify-between text-sm">
                                        <span>오늘 분석 사용</span>
                                        <span>
                                            {userProfile.usage.analysisCount}회
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>이번 달 대화 시간</span>
                                        <span>
                                            {Math.round(
                                                userProfile.usage
                                                    .monthlyConversationUsed /
                                                    60
                                            )}
                                            분
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-500">
                            플랜 정보를 불러오는 중...
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* 저장한 표현 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">저장한 표현</CardTitle>
                </CardHeader>
                <CardContent>
                    {savedExpressions.length > 0 ? (
                        <div className="space-y-4">
                            {savedExpressions.map((exp) => (
                                <div
                                    key={exp.id}
                                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900 mb-1">
                                                {exp.originalText}
                                            </p>
                                            <p className="text-blue-600 mb-2">
                                                {exp.interpretation}
                                            </p>
                                            <a
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    const url = new URL(exp.youtubeUrl);
                                                    const videoId = url.searchParams.get("v");
                                                    if (videoId) {
                                                        router.push(`/analysis/${videoId}`);
                                                    }
                                                }}
                                                className="inline-flex items-center text-sm text-gray-500 hover:text-blue-500 cursor-pointer"
                                            >
                                                <ExternalLink className="w-4 h-4 mr-1" />
                                                영상 보기
                                            </a>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                handleDeleteExpression(exp.id)
                                            }
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">
                            아직 저장한 표현이 없습니다.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* 시청 기록 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">최근 시청 영상</CardTitle>
                </CardHeader>
                <CardContent>
                    {learningHistory.length > 0 ? (
                        <div className="space-y-4">
                            {learningHistory.map((video) => (
                                <div
                                    key={video.videoId}
                                    className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >
                                    {video.thumbnailUrl && (
                                        <img
                                            src={video.thumbnailUrl}
                                            alt="Video Thumbnail"
                                            className="w-24 h-16 object-cover rounded"
                                        />
                                    )}
                                    <div className="flex-1">
                                        <h3 className="font-medium text-gray-900 mb-1">
                                            {video.title}
                                        </h3>
                                        <div className="text-sm text-gray-500">
                                            <span>
                                                {Math.round(
                                                    video.duration / 60
                                                )}
                                                분
                                            </span>
                                            <span className="mx-2">•</span>
                                            <span>
                                                {new Date(
                                                    video.timestamp
                                                ).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <a
                                            href={`/analysis/${video.videoId}`}
                                            className="inline-block mt-2 text-blue-500 hover:text-blue-600 text-sm"
                                        >
                                            영상 바로가기 →
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">
                            아직 시청한 영상이 없습니다.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* 하단 버튼 */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                    onClick={handleSignOut}
                    variant="outline"
                    className="flex-1"
                >
                    로그아웃
                </Button>
                <Button
                    onClick={handleDeleteAccount}
                    variant="destructive"
                    className="flex-1"
                >
                    회원 탈퇴
                </Button>
            </div>

            {showAlertModal && (
                <Alert
                    title="회원 탈퇴 확인"
                    subtitle="정말로 회원 탈퇴를 하시겠습니까? 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다."
                    buttons={[
                        {
                            text: "취소",
                            onClick: () => setShowAlertModal(false),
                            isPrimary: false,
                        },
                        {
                            text: "탈퇴",
                            onClick: confirmDeleteAccount,
                            isPrimary: true,
                        },
                    ]}
                    onClose={() => setShowAlertModal(false)}
                />
            )}

            {showToast && (
                <Toast
                    message={toastMessage}
                    isVisible={showToast}
                    onClose={() => setShowToast(false)}
                />
            )}

            <AlertDialog
                open={showReauthModal}
                onOpenChange={setShowReauthModal}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>재인증 필요</AlertDialogTitle>
                        <AlertDialogDescription>
                            {authMethod === "email"
                                ? "이 작업은 보안상의 이유로 다시 로그인이 필요합니다. 계속하려면 비밀번호를 입력해주세요."
                                : authMethod === "google"
                                ? "이 작업은 보안상의 이유로 구글 계정으로 다시 로그인해야 합니다."
                                : "이 작업은 보안상의 이유로 다시 로그인이 필요합니다."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {authMethod === "email" && (
                        <div className="py-4">
                            <Input
                                type="password"
                                placeholder="비밀번호"
                                value={password}
                                onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>
                                ) => setPassword(e.target.value)}
                                className="w-full"
                            />
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => {
                                setShowReauthModal(false);
                                setAuthMethod(null);
                            }}
                        >
                            취소
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleReauthenticateAndDelete}
                        >
                            {authMethod === "google" ? "구글로 재인증" : "확인"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default MyPage;
