네, 좋은 질문입니다. "인기 동영상(Trends)" 기능을 구현하기 위한 체계적인 설계를 제안해 드리겠습니다.

이 설계는 **확장성, 비용 효율성, 실시간성**을 모두 고려한 접근 방식입니다.

### **1. 목표 (Goals)**

-   단순 조회수가 아닌, 우리 서비스 내에서 **최근에 활발하게 학습되고 있는 영상**을 "인기"의 기준으로 삼는다.
-   사용자가 새로운 학습 콘텐츠를 쉽게 발견하도록 돕는다.
-   매번 실시간으로 계산하는 방식이 아닌, 비용 효율적인 방식으로 구현한다.

### **2. 핵심 아이디어**

"인기도"는 시간에 따라 감소하는 **가중치 점수(Weighted Score)**를 기반으로 계산합니다. 즉, 최근 활동일수록 높은 점수를 받습니다. 이 계산은 **주기적으로 실행되는 백그라운드 작업(Firebase Functions)**을 통해 처리하고, 결과만 별도의 컬렉션에 저장하여 프론트엔드에서는 이 결과만 읽어오도록 합니다.

---

### **3. 시스템 설계 (System Design)**

#### **Phase 1: 데이터 수집 (Activity Logging)**

사용자의 모든 주요 활동을 기록하는 새로운 컬렉션을 만듭니다.

-   **신규 컬렉션**: `videoActivityLogs`
-   **목적**: 사용자의 모든 유의미한 상호작용을 원시 데이터(raw data)로 기록합니다.
-   **문서 구조**: `videoActivityLogs/{activityId}` (ID는 자동 생성)

| 필드명         | 타입        | 설명                                                                              |
| -------------- | ----------- | --------------------------------------------------------------------------------- |
| `videoId`      | `String`    | 활동이 발생한 YouTube 영상 ID                                                     |
| `activityType` | `String`    | 활동 유형. 예: `ANALYSIS`, `REVISIT`, `SAVE_INTERPRETATION`, `START_CONVERSATION` |
| `userId`       | `String`    | 활동을 수행한 사용자 ID (익명/로그인)                                             |
| `timestamp`    | `Timestamp` | 활동이 발생한 시간 (Firestore Server Timestamp)                                   |

**구현 위치:**

1.  **신규 분석 (`ANALYSIS`)**: `analysis-client-page.tsx`에서 신규 분석 후 `videoAnalyses`에 저장할 때, `videoActivityLogs`에도 로그를 추가합니다.
2.  **재방문 (`REVISIT`)**: `page.tsx`의 `handlePlayerReady`에서 `learningHistory`를 업데이트할 때, `videoActivityLogs`에도 로그를 추가합니다.
3.  **해석 저장 (`SAVE_INTERPRETATION`)**: `TranscriptViewer.tsx`의 `handleSaveInterpretation`에서 `savedInterpretations`에 저장할 때, `videoActivityLogs`에도 로그를 추가합니다.
4.  **AI 대화 시작 (`START_CONVERSATION`)**: `useGeminiLiveConversation.ts`의 `handleStartConversation`에서 대화 세션이 성공적으로 시작될 때, `videoActivityLogs`에도 로그를 추가합니다.

#### **Phase 2: 인기도 계산 (Score Calculation via Firebase Functions)**

주기적으로 실행되는 서버리스 함수를 만들어 인기도를 계산합니다.

-   **사용 기술**: Firebase Functions (Scheduled functions)
-   **실행 주기**: 1시간마다 (혹은 6시간, 12시간 등 서비스 트래픽에 맞춰 조절)
-   **로직**:
    1.  **데이터 조회**: `videoActivityLogs` 컬렉션에서 최근 3일(72시간) 동안의 모든 로그를 가져옵니다.
    2.  **가중치 및 시간 감쇠(Time Decay) 적용**: 각 로그에 대해 점수를 계산합니다.
        -   **활동 가중치 (Base Score)**:
            -   `START_CONVERSATION`: 5점
            -   `SAVE_INTERPRETATION`: 4점
            -   `ANALYSIS`: 3점
            -   `REVISIT`: 1점
        -   **시간 감쇠 공식**:
            -   `Final Score = BaseScore * e^(-decayRate * hoursAgo)`
            -   `hoursAgo`: 현재 시간과 로그 시간의 차이 (시간 단위)
            -   `decayRate`: 점수가 감소하는 속도를 조절하는 상수 (예: 0.05)
            -   _이 공식을 통해 최근 활동일수록 기하급수적으로 높은 점수를 받게 됩니다._
    3.  **점수 합산**: `videoId` 별로 모든 점수를 합산하여 각 영상의 최종 인기도 점수를 구합니다.
    4.  **메타데이터 결합**: 상위 N개(예: 20개) 영상의 `videoId`를 사용하여 `videoAnalyses` 컬렉션에서 `youtubeTitle`과 같은 메타데이터를 가져옵니다.
    5.  **결과 저장**: 계산된 최종 결과를 `trendingVideos` 컬렉션에 덮어씁니다.

#### **Phase 3: 결과 저장 (Storing The Trend List)**

프론트엔드가 빠르고 저렴하게 읽을 수 있도록 최적화된 컬션을 만듭니다.

-   **신규 컬렉션**: `trendingVideos`
-   **목적**: 계산된 인기 동영상 목록을 저장합니다.
-   **문서 구조**: `trendingVideos/global` (단일 문서 사용)

| 필드명        | 타입            | 설명                                                                                                   |
| ------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| `videos`      | `Array<Object>` | 인기도 순으로 정렬된 상위 N개 영상 목록. 각 객체는 `{ videoId, youtubeTitle, score }` 형식을 가집니다. |
| `lastUpdated` | `Timestamp`     | 이 목록이 마지막으로 업데이트된 시간                                                                   |

-   이 `global` 문서는 Firebase Function에 의해 주기적으로 **완전히 덮어쓰기(overwrite)** 됩니다.

#### **Phase 4: 프론트엔드 구현 (Frontend Implementation)**

-   **신규 컴포넌트**: `TrendingVideos.tsx`
-   **로직**:
    1.  페이지 로드 시, `trendingVideos/global` 문서를 **단 한 번** 읽습니다. (`getDoc(doc(db, "trendingVideos", "global"))`)
    2.  가져온 `videos` 배열을 map 함수로 순회하며 UI를 렌더링합니다. (기존 `RecentVideoItem` 컴포넌트 재활용 가능)
-   **표시 위치**: `src/app/page.tsx`의 메인 URL 입력창 아래, 또는 `RecentVideos` 컴포넌트 위에 배치합니다.

---

### **4. 구현 단계 요약 (Implementation Steps)**

1.  **Firestore 설정**: `videoActivityLogs`, `trendingVideos` 컬렉션에 대한 보안 규칙을 설정합니다.
2.  **클라이언트 코드 수정**:
    -   `analysis-client-page.tsx`, `page.tsx`, `TranscriptViewer.tsx`, `useGeminiLiveConversation.ts`에 `videoActivityLogs`에 데이터를 추가하는 로직을 구현합니다.
3.  **Firebase Functions 개발**:
    -   `firebase-functions` 프로젝트를 설정합니다.
    -   1시간 주기로 실행되는 스케줄 함수를 작성합니다.
    -   함수 내부에 위에서 설명한 **Phase 2: 인기도 계산** 로직을 구현합니다.
    -   계산 결과를 `trendingVideos/global` 문서에 `setDoc`으로 저장합니다.
4.  **프론트엔드 컴포넌트 개발**:
    -   `TrendingVideos.tsx` 컴포넌트를 생성합니다.
    -   Firestore에서 `trendingVideos/global` 문서를 가져와 목록을 표시하는 로직을 작성합니다.
    -   `page.tsx`에 `TrendingVideos` 컴포넌트를 추가합니다.

### **5. 이 설계의 장점**

-   **비용 효율성**: 프론트엔드는 계산이 완료된 작은 문서 하나만 읽기 때문에 Firestore 읽기 비용이 매우 저렴합니다. 복잡한 쿼리와 계산은 저렴한 서버리스 함수에서 주기적으로 처리합니다.
-   **성능**: 사용자는 복잡한 계산을 기다릴 필요 없이 즉시 인기 동영상 목록을 볼 수 있습니다.
-   **확장성**: `activityType`이나 가중치를 변경하는 것이 용이하며, Firebase Function 로직만 수정하면 됩니다. 나중에 "사용자 맞춤형 추천"으로 확장하기도 좋습니다.
-   **정확성**: 단순 조회수가 아닌, 서비스 내에서의 실제 "학습 활동"을 기반으로 하므로 서비스의 목적에 더 부합하는 인기 순위를 제공할 수 있습니다.
