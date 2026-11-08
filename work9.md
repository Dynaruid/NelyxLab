# work9 — Windows·Web 우선 엔진 v2 구현과 호스트 전환

> **2026-11-08 W9B-00-H:** Windows v2의 **App SDK 단일 host·CLI/공급/설치 graph**와 **RNW public clipboard 실제 소스 이식**을 구현했다. 플랫폼 API는 **Windows RNW / Android·iOS RN / macOS RNM / Linux RNL**의 필요한 소스를 수정·사용하며, [전체 원본/소비자 대응표](Nelyx/engine/platform/native-api-ports.md)에서 첫 이식과 나머지 직접 구현·미지원 범위를 구분한다. 현재 실행·공급·남은 수락은 [work9-b §3.4–3.5](work9-b.md#34-w9b-00-h--host-단일화플랫폼-소스-이식-착수)를 따른다. 이후 재개점은 **W9B-01**이다.

> **2026-11-08 구조 개편 문서 전환:** [work9-a.md](work9-a.md)는 **CLOSED / 후속 문서 이관**으로 종료했고 원래 계약·구현·검증 기록을 보존한다. W9B-00의 당시 기능 검증과 W9B-00-H의 새 결과를 구분하며 남은 실행은 [work9-b.md](work9-b.md)의 **W9B-01–08**을 따른다. 전체 구현은 **PARTIAL**이고 API·물리 입력·성능·기본값 전환 판정은 유지한다. 이전 공급/hash·두 Windows host의 검증을 이번 실행의 근거로 복사하지 않는다.

> **2026-11-07 사용자 요청 — 개발 검증 정리:** 독립 테스트·fixture, API/구조 감사·성능 실험 도구와 npm 진입점을 제거했다. Testbed의 숨은 측정 버튼·모드와 강제 App/Content 지연·합성 입력 제어도 정리했다. 아래 분할 문서의 과거 `test:*`·`audit:*`·`experiment:*`·`measure:*`·`probe:*`·`inspect:*` 명령은 종료된 검증 기록이며 현재 실행 지시가 아니다. 기존 PASS·PARTIAL·notVerified와 미완료 기능 판정은 유지한다. 현행 확인은 `check:types`·`lint`·`format:check`와 변경 대상 제품 빌드·실행으로 수행한다. 당시 잔여 임시 출력용 일회성 PS1은 현재 저장소에 남아 있지 않다.

개발 검증 정리 결과: **파일 504개 삭제**(테스트·fixture 478개, 감사·측정 도구 24개, Testbed 측정 모듈 2개), 루트 npm 명령 **107→20개**. 삭제 파일의 CMake 대상·공급 identity 입력·Android instrumentation·의존성과 현행 안내를 함께 정리했다. `check:types`·`lint`·`format:check`·`git diff --check`, Windows native·두 Wasm profile·Windows App SDK를 포함한 `build:engine-v2`와 현재 공급 identity/전체 파일 hash 확인 PASS. PS1의 미리보기·WhatIf·실제 삭제와 추적/미무시 파일·junction 보호를 임시 저장소에서 확인하고 임시 자료를 회수했으며, 실제 저장소의 잔여 빈 검증 폴더도 정리했다. 이번 정리는 제품 창·브라우저 UI·실기기·물리 입력·표시·성능의 재검증을 포함하지 않는다. 제품 오류·입력·ABI·자원 수명 검사와 내장 진단 API, 공급/build cache·변환 소유권 자료는 유지했다.

작성: **2026-11-05 KST** · 갱신: **2026-11-08 KST** · 상태: **host·플랫폼 API 계획 교정 / Windows·Web PARTIAL · Android PARTIAL**

[work8 종료 요약](history/26/11/04/work8-summary.md) · [종료 시 API·검증 기록](history/26/11/05/work8-2a-summary.md#현재-구현-현황) · [Flutter 엔진 비교](history/26/11/05/work8-2a-summary.md#flutter-엔진-c-비교)

`work9.md`는 전체 목차이며 본문은 **1~4부와 그 후속인 5부**로 나눴다. 원문의 절 번호와 **W9-00–14의 15단계**, 기존 구현·미완료 상태를 유지한다.

## 분할 문서

| 문서                                                     | 범위                                                                                                                                | 작업 차수                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [1부 — 범위·기준선·Windows 호스트·공통 경계](work9-1.md) | §1–4·§7: 우선 범위·work8 기준점·App SDK 단일 host·RNW 실제 소스 이식·최소 embedder                                                       | Windows/Web 1차 기반                                |
| [2부 — 공개 API·렌더링·입력·Web](work9-2.md)             | §8–11의 공통·Web 계약: API 호환·Widget/디자인·graphics/text·frame·입력·Web 두 profile·OS 코드 재사용. Android/iOS 상세 구현은 4·5부 | Windows/Web 1차 기능                                |
| [3부 — 구현 순서·통합 검증·공급](work9-3.md)             | §12–14: 실행 묶음·W9 단계/체크리스트·API/host/물리·성능 gate·공급/정리                                                              | Windows/Web 1차 통합·판정                           |
| [4부 — Android·Linux 호스트](work9-4.md)                 | §11.4·§5: RN Android API 소스 이식·standalone·InputConnection/접근성, RNL 소스의 GTK4/DMA-BUF·IM/AT-SPI 이식·배포                                            | **Android PARTIAL / RN 이식 잔여 · Linux DEFERRED** |
| [후속 5부 — iOS·macOS 호스트](work9-5.md)                | §11.5·§6: RN iOS → UIKit/UITextInput, RNM → AppKit/Metal·플랫폼 API·Apple 공급                                                                          | **3차 / Android/Linux 2차 통합 완료 후 / DEFERRED** |

**기본 개발 순서는 Windows/Web(threaded·single-worker) 1차 → Android/Linux 2차(4부) → iOS/macOS 3차(후속 5부)다.** 2026-11-07 사용자 지정으로 Android와 필요한 공통 영역을 먼저 구현했다. Android는 **API·복구·reload 구현 PARTIAL**, Linux·iOS/macOS는 **DEFERRED**다. Android 착수가 Windows/Web W9-13 통과나 전체 차수 완료를 뜻하지 않는다. 후속 플랫폼의 toolchain·prototype·입력 adapter·배포를 앞선 차수의 완료 조건에 포함하지 않는다.

차수 전환의 ‘완료’는 **앞선 차수 모든 대상의 W9-13 기술 gate 통과**다. W9-14의 물리 입력·성능 수락·기본값 전환은 대상/profile별로 따로 판정한다. 전체 플랫폼의 기술 완료와 제품 수락도 각각 구분한다. [완료·차수 전환 기준](work9-3.md#125-차수-전환과-완료-판정)

1~3부는 같은 Windows/Web 계획을 역할별로 나눈 문서다. W9-00–14의 원래 의무와 [3부 §12.2의 의존 관계](work9-3.md#122-windowsweb-1차-실행-순서)를 유지하되, 현재의 실제 재개는 **W9B-01–08**을 따른다. 파일 번호와 원문 절 번호를 W9 단계의 순번으로 해석하지 않는다.

**현재 Android 작업:** RN 없는 Activity/JNI·Hermes·Graphite/Dawn/Vulkan·독립 owner, ACK 기반 InputConnection/virtual accessibility·Choreographer/Activity 수명과 arm64-v8a/x86_64 공급·CLI create/build/doctor/run/pack에 Original 편집기·공개 asset/font/text/image/network 서비스와 실제 device loss 후 자동 복구·개발 generation reload를 연결했다. 전체 API 감사는 Android의 DOM 없는 strict 선언 검사도 포함한다. 실제 emulator/공통 회귀·현재 공급 identity·일반 실행 명령과 남은 Android W9-12-B/13/14는 [4부의 현재 구현](work9-4.md#현재-android-구현과-실행)에 기록한다. 전체 원래 API 호환성과 물리·성능 수락은 계속 미완료다.

위 Android standalone 기반의 성공은 **RN Android 플랫폼 API 소스 이식 완료와 별개**다. 기존 자체 OS 처리의 원본/소비자를 대조해 RN 수정 이식본으로 연결하고, iOS는 RN·macOS는 RNM·Linux는 RNL을 같은 방식으로 이식한다. Source 복사·수정·의존성 교체·실행 증거를 해당 target의 필수 완료 조건으로 삼는다.

**Android 착수 전 Windows/Web 검증 기준선 — PARTIAL:** 공급 **`7df40776…` / ABI 2·schema 1967912362 / App service 12**에서 canonical root/PlatformAssetBundle과 두 SDK App 모델의 공통 asset 소유권을 연결했다. Native C++ **7읽기·52 bytes = SDK**, Original/data 두 profile의 **65/17명령 = SDK**, HTTP metadata/index·취소·실제 actor 종료 뒤 예약 **0**을 검증했다. Source FontLoader·공개 UI load·불변 recording 수명을 유지하며 Core **382/382**, 통합 **44/44**, Source/수명 **46/46**, geometry **2/2·7/7**, 도구/API/supply **32/32** PASS다. TypeScript **7.0.2**, CanvasKit **128/256 MiB**, App **320 MiB**, ledger **768 MiB/GPU 128 MiB**를 유지한다. Web 서비스 bootstrap 취소·실패·늦은 실제 Wasm 초기화 **28조건**도 통과했다. Native/Web loadBuffer·ImmutableBuffer와 NetworkAssetBundle의 비동기 HTTP·마지막 holder/callback 회수도 검증했다. Native 성공 HTTP 16요청(redirect 포함)의 89 bytes는 SDK 전달 86 + 3 bytes와 일치한다. Data/Original Native 선언은 DOM 없이 TypeScript 7 strict 검사를 통과했다. 다음은 ImageDescriptor/Codec buffer 소비·OS font 알림과 기존 클래스 타입 호환성이다. 전체 API **inputValid=true / compatible=false**, Native 창·물리/display/scanout **notVerified**, 성능 flag **false**, W9-13/14 미완료다. 이후 Android 초기 port는 위 현재 작업/4부를 따르며 Linux·Apple은 **DEFERRED**다. [현재 증거와 다음 실행](work9-3.md#현재-구현검증과-잔여-작업)을 따른다.

## 원문 절 목차

기존 `work9.md#절-앵커` 링크도 아래 목차에서 해당 부의 본문으로 이동할 수 있다.

## 1. 이번 계획의 결정과 범위

[1부 본문으로 이동](work9-1.md#1-이번-계획의-결정과-범위)

## 2. work8에서 이어받는 기준점

[1부 본문으로 이동](work9-1.md#2-work8에서-이어받는-기준점)

- [이월 대응표](work9-1.md#이월-대응표)

## 3. 플랫폼별 채택 구조

[1부 본문으로 이동](work9-1.md#3-플랫폼별-채택-구조)

## 4. Windows — Windows App SDK 호스트

[1부 본문으로 이동](work9-1.md#4-windows--windows-app-sdk-호스트)

- [4.1 Windows RNW 소스 선별 재사용](work9-1.md#41-windows-rnw-소스-선별-재사용)

## 5. Linux — GTK4 호스트

[4부 본문으로 이동](work9-4.md#5-linux--gtk4-호스트)

## 6. macOS — AppKit 호스트

[후속 5부 본문으로 이동](work9-5.md#6-macos--appkit-호스트)

## 7. 공통 embedder·runtime 경계

[1부 본문으로 이동](work9-1.md#7-공통-embedderruntime-경계)

- [7.1 호스트 전환에서 보존할 공통 조건](work9-1.md#71-호스트-전환에서-보존할-공통-조건)

## 8. 기존 공개 API 호환 작업

[2부 본문으로 이동](work9-2.md#8-기존-공개-api-호환-작업)

- [8.1 검사 환경과 실행 모델의 선행 판정](work9-2.md#81-검사-환경과-실행-모델의-선행-판정)

## 9. 렌더링 표현력·재사용·frame 일정

[2부 본문으로 이동](work9-2.md#9-렌더링-표현력재사용frame-일정)

## 10. 입력·편집·semantics·가상화와 복구

[2부 본문으로 이동](work9-2.md#10-입력편집semantics가상화와-복구)

## 11. Web·모바일에서 유지할 범위

[2부 본문으로 이동](work9-2.md#11-web모바일에서-유지할-범위)

- [11.1 채택 방침과 앞선 소스 검토](work9-2.md#111-채택-방침과-앞선-소스-검토)
- [11.2 중립 adapter와 상태 계약](work9-2.md#112-중립-adapter와-상태-계약)
- [11.3 Web — 기존 DOM·Worker host 유지](work9-2.md#113-web--기존-domworker-host-유지)
- [11.4 Android — RN 플랫폼 API 소스 이식](work9-4.md#114-android--rn-플랫폼-api-소스-이식)
- [11.5 iOS — RN 플랫폼 API 소스 이식](work9-5.md#115-ios--rn-플랫폼-api-소스-이식)
- [11.6 도입 순서와 의존성 gate](work9-2.md#116-도입-순서와-의존성-gate)
- [11.7 공통 입력·수명 검증 corpus](work9-2.md#117-공통-입력수명-검증-corpus)

## 12. 구현 단계와 완료 조건

[3부 본문으로 이동](work9-3.md#12-구현-단계와-완료-조건)

- [12.1 검토에서 수정한 선행 관계](work9-3.md#121-검토에서-수정한-선행-관계)
- [12.2 Windows/Web 1차 실행 순서](work9-3.md#122-windowsweb-1차-실행-순서)
- [12.3 단계별 범위와 완료 조건](work9-3.md#123-단계별-범위와-완료-조건)
- [12.4 실행 체크리스트](work9-3.md#124-실행-체크리스트)
- [12.5 차수 전환과 완료 판정](work9-3.md#125-차수-전환과-완료-판정)

## 13. 검증과 판정

[3부 본문으로 이동](work9-3.md#13-검증과-판정)

- [변경 범위별 필수 회귀](work9-3.md#변경-범위별-필수-회귀)
- [구현 시 사용할 기존 검사 명령](work9-3.md#구현-시-사용할-기존-검사-명령)

## 14. 공급·정리와 문서 운영

[3부 본문으로 이동](work9-3.md#14-공급정리와-문서-운영)

- [이번 문서 작업의 검증과 다음 시작점](work9-3.md#이번-문서-작업의-검증과-다음-시작점)

## 문서 분할 기록

**2026-11-05 KST:** `work9.md`를 전체 목차로 두고 1~3부는 Windows/Web 1차, 4부는 Android/Linux 2차, 후속 5부는 iOS/macOS 3차로 정리했다. Android §11.4·Linux §5를 4부, iOS §11.5·macOS §6을 5부에 배치했다. 원문 14개 주요 절·W9-00–14의 15단계와 Windows/Web 1차 실행 순서를 유지했다. W9-12-B는 Android 2차·iOS 3차의 target별 범위로 나누고 각 플랫폼의 완료 조건·체크리스트·문서 링크를 맞췄다.

플랫폼 상세 설계 보존, 절·단계 누락/중복, 차수·선행 관계, 로컬 링크·앵커, 표·코드 fence·공백을 확인했다. 제품 소스·공급 변경, 빌드·API audit·runtime·물리 입력·성능 검증은 수행하지 않았다. 분할 전 문서 검토와 work8 실행 기록은 각 본문의 과거 근거로 유지한다.

## 이번 재검토 반영

**2026-11-06 KST:** 여섯 계획 문서를 현재 CMake·API audit·host/runner·protocol 및 Microsoft·GTK·HTML 공식 계약과 대조했다. Linux 최소 GTK를 **4.22**로 올려 접근성 caret/selection 변경 의무와 맞췄다. W9-13 기술 완료와 W9-14 제품 수락·차수 전환을 구분하고, API 검사 환경/분모·동기 실행 모델의 판정, App SDK 앱 로컬 초기화/종료, 연속 입력/scene 진행·wire/lease 회귀, frame clock·Web profile/새 canvas/reload·후속 플랫폼 공급 조건을 보완했다. 필수 콘텐츠 W9-11-A는 기본 수명 W9-09-A 뒤 시작할 수 있도록 불필요한 재사용 최적화 선행 조건을 해제했다.

원래 주요 절·W9-00–14의 15단계와 Windows/Web → Android/Linux → iOS/macOS 순서를 유지한다. 이 앞선 문서 재검토 단계에서는 제품 소스·공급 변경, 빌드·API audit·앱 실행·물리 입력·성능 검증을 수행하지 않았다. 이후 구현의 결과는 아래와 3부의 현재 상태에 구분한다. API **FAIL**, 구현 **PARTIAL**, 후속 플랫폼 **DEFERRED**, 두 성능 flag **false**·물리/display **notVerified** 경계는 유지한다.

로컬 링크·앵커·표·code fence/공백, 주요 절 14개·단계 15개와 문서의 npm 명령 존재 여부를 검사하고 `git diff --check`를 통과했다. 상세 검사 범위와 수치는 3부 §14에 기록했다.

**앞선 구현 상태 — 2026-11-07 KST / IN_PROGRESS / PARTIAL:** Root/PlatformAssetBundle·NetworkAssetBundle·공통 SDK asset IO·App service 12 credit·Web bootstrap 1 취소/종료·ImmutableBuffer와 Source font/cohort 수명을 연결했다. 현재 공급·검증 수치는 위 요약과 [3부의 현재 상태](work9-3.md#현재-구현검증과-잔여-작업)를 따른다. 전체 API·Native 창/물리/성능·W9-13/14는 미완료이며 Android/Linux·iOS/macOS는 DEFERRED다.
