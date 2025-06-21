### **DB 테이블 구조 및 기록 시점 명세**

이 문서는 AI English 프로젝트에서 사용하는 Firestore 데이터베이스의 구조와 데이터가 생성/수정되는 시점을 설명합니다.

#### **개요**

-   **데이터베이스**: Google Firestore (NoSQL Document Database)
-   **주요 컬렉션**:
    1.  `videoAnalyses`: YouTube 영상 분석 결과를 캐싱하기 위한 컬렉션
    2.  `users`: 사용자 정보 및 사용자별 학습 데이터를 저장하기 위한 컬렉션

---

### **1. `videoAnalyses` 컬렉션**

-   **목적**: 한 번 분석된 YouTube 영상의 결과를 저장하여, 동일 영상에 대한 재요청 시 Gemini API 호출 없이 캐시된 데이터를 빠르게 제공하기 위함입니다. 이를 통해 API 비용을 절감하고 사용자 경험을 향상시킵니다.
-   **경로**: `videoAnalyses/{documentId}`

#### **1.1. 문서 (Document) 구조**

-   **Document ID**: `yt_{videoId}` (예: `yt_dQw4w9WgXcQ`)
    -   YouTube 영상 ID 앞에 `yt_` 접두사를 붙여 생성합니다.
-   **필드 (Fields)**:

| 필드명                | 타입                | 설명                                                                                                     |
| --------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| `analysis`            | `Object (Map)`      | Gemini API를 통해 얻은 영상 분석 결과 객체. 아래의 하위 필드를 포함합니다.                               |
| ┣ `summary`           | `String`            | 영상 내용 요약 (1-2 문장)                                                                                |
| ┣ `keywords`          | `Array<String>`     | 영상의 핵심 단어 목록                                                                                    |
| ┣ `slang_expressions` | `Array<Object>`     | 영상에 나온 주요 표현(슬랭, 숙어 등)과 그 의미 목록. 각 객체는 `expression`과 `meaning` 필드를 가집니다. |
| ┣ `main_questions`    | `Array<String>`     | 영상 내용을 기반으로 생성된 AI 대화 시작 질문 목록                                                       |
| `transcript_text`     | `String`            | 타임스탬프(`[MM:SS]`)가 포함된 영상 전체 스크립트 텍스트                                                 |
| `youtubeTitle`        | `String`            | YouTube 영상의 원본 제목                                                                                 |
| `youtubeDescription`  | `String` (선택)     | YouTube 영상의 원본 설명                                                                                 |
| `timestamp`           | `String` (ISO 8601) | 이 분석 데이터가 Firestore에 저장된 시간                                                                 |

#### **1.2. 기록 시점 (When it's recorded)**

-   **파일**: `src/app/analysis/[videoId]/analysis-client-page.tsx`
-   **트리거**: 사용자가 분석 페이지 (`/analysis/[videoId]`)에 접속했을 때.
-   **로직**:
    1.  페이지에 진입하면 먼저 `videoAnalyses` 컬렉션에서 `yt_{videoId}` 문서를 조회합니다.
    2.  **문서가 존재하지 않을 경우에만** 다음을 수행합니다:
        -   `/api/transcript` API를 호출하여 Gemini로 새로운 영상 분석을 요청합니다.
        -   분석이 성공적으로 완료되면, 반환된 `analysis` 데이터와 `transcript_text`를 포함한 객체를 `videoAnalyses` 컬렉션에 `setDoc`을 사용하여 새로운 문서로 **생성(저장)**합니다.
    3.  문서가 이미 존재하는 경우에는 API를 호출하지 않고 Firestore의 데이터를 바로 사용합니다.

---

### **2. `users` 컬렉션**

-   **목적**: 사용자 인증 정보를 기반으로 개인화된 학습 기록(최근 본 영상, 저장한 표현 등)을 관리합니다.
-   **경로**: `users/{user.uid}`

#### **2.1. 문서 (Document) 구조**

-   **Document ID**: Firebase Authentication의 `user.uid`
-   **필드 (Fields)**: 현재 코드베이스에서는 이 문서 자체에 필드를 저장하지 않고, 하위 컬렉션(Subcollection)을 통해 데이터를 관리합니다.

#### **2.2. 하위 컬렉션 (Subcollections)**

##### **2.2.1. `learningHistory` 서브컬렉션**

-   **목적**: 사용자가 메인 페이지에서 분석을 시도한 영상의 기록을 저장합니다. "최근 본 영상" 기능에 사용됩니다.
-   **경로**: `users/{user.uid}/learningHistory/{videoId}`
-   **Document ID**: YouTube 영상의 `videoId` (예: `dQw4w9WgXcQ`)
-   **필드 (Fields)**:

| 필드명           | 타입                | 설명                                                 |
| ---------------- | ------------------- | ---------------------------------------------------- |
| `youtubeUrl`     | `String`            | 사용자가 입력한 원본 YouTube URL                     |
| `title`          | `String`            | 영상 제목                                            |
| `duration`       | `Number`            | 영상 총 길이 (초 단위)                               |
| `timestamp`      | `String` (ISO 8601) | 이 영상을 마지막으로 조회한 시간. 정렬에 사용됩니다. |
| `lastPlayedTime` | `Number`            | 마지막으로 재생한 시간 (초). 현재는 `0`으로 고정.    |

-   **기록 시점 (When it's recorded)**:
    -   **파일**: `src/app/page.tsx`
    -   **트리거**: 사용자가 메인 페이지에서 YouTube URL을 입력하고, `ReactPlayer`가 영상 정보를 성공적으로 불러왔을 때 (`handlePlayerReady` 함수 실행 시).
    -   **로직**:
        -   로그인된 사용자(`auth.currentUser`)가 있을 경우에만 실행됩니다.
        -   `setDoc`과 `{ merge: true }` 옵션을 사용하여 동일한 영상을 다시 조회하면 `timestamp`만 최신으로 업데이트됩니다.

##### **2.2.2. `savedInterpretations` 서브컬렉션**

-   **목적**: 사용자가 자막에서 특정 텍스트를 드래그하여 AI 해석을 받은 후, "저장" 버튼을 눌러 해당 해석을 개인적으로 보관하기 위함입니다.
-   **경로**: `users/{user.uid}/savedInterpretations/{interpretationId}`
-   **Document ID**: `interpret_{Date.now()}` (예: `interpret_1700000000000`)
    -   저장 시점의 타임스탬프를 기반으로 동적 생성됩니다.
-   **필드 (Fields)**:

| 필드명           | 타입        | 설명                                  |
| ---------------- | ----------- | ------------------------------------- |
| `originalText`   | `String`    | 사용자가 선택한 원본 텍스트           |
| `interpretation` | `String`    | AI가 제공한 한국어 해석               |
| `youtubeUrl`     | `String`    | 해석이 나온 영상의 URL                |
| `timestamp`      | `Timestamp` | 저장된 시간 (Firebase Timestamp 객체) |

-   **기록 시점 (When it's recorded)**:
    -   **파일**: `src/app/components/TranscriptViewer.tsx`
    -   **트리거**: 자막 뷰어에서 텍스트를 선택해 AI 해석을 본 후, 툴팁에 나타나는 "저장" 버튼을 클릭했을 때 (`handleSaveInterpretation` 함수 실행 시).
    -   **로직**:
        -   로그인된 사용자(`user`)가 있을 경우에만 저장 기능이 활성화됩니다.
        -   `setDoc`을 사용하여 새로운 해석 데이터를 문서로 **생성(저장)**합니다.
