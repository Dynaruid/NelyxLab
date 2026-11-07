# work9-3 — 3부: 구현 순서·통합 검증·공급

작성: **2026-11-05 KST** · 갱신: **2026-11-07 KST** · 상태: **IN_PROGRESS / 사용자 요청 재개 / Windows·Web 1차 PARTIAL**

[전체 목차](work9.md) · [이전: 2부](work9-2.md) · [다음: 4부 Android·Linux](work9-4.md) · [후속: 5부 iOS·macOS](work9-5.md)

**범위:** 원문 §12–14. W9-00–14의 의존성·체크리스트, Windows/Web 검증·제품 수락, 공급·정리와 문서 운영을 다룬다.

**실행 순서:** Windows/Web 1차는 [3부 §12.2의 실행 묶음](work9-3.md#122-windowsweb-1차-실행-순서)을 따른다. 이후 **[4부의 Android·Linux 2차](work9-4.md) → [후속 5부의 iOS·macOS 3차](work9-5.md)**로 진행하며 후속 플랫폼을 Windows/Web 1차 완료의 선행 조건으로 두지 않는다.

§14의 기존 문서 검토 기록은 분할 전 결과다. 이번 분할 범위와 확인 결과는 [전체 목차의 문서 분할 기록](work9.md#문서-분할-기록)에 적는다.

## 12. 구현 단계와 완료 조건

현재 실행 상태는 [아래 구현·검증 기록](#현재-구현검증과-잔여-작업)을 따른다. Work8의 구현은 [§2](work9-1.md#2-work8에서-이어받는-기준점)의 PARTIAL 기반으로 재사용한다. ID는 기존 작업과의 연결을 위해 유지하며 **번호순이 아니라 아래 실행 묶음 순서**로 진행한다. `-A/-B`는 별도 새 ID가 아닌 해당 단계의 세부 범위다. W9-12-B(Android)·W9-12-B(iOS)는 같은 B 범위의 target별 적용이며 새 단계 ID가 아니다. 개발 차수는 Windows/Web 1차 → Android/Linux 2차(4부) → iOS/macOS 3차(후속 5부)다. W9-13/14는 대상별로 완료를 기록한다.

### 12.1 검토에서 수정한 선행 관계

- 전체 API gate의 입력 오류를 최종 통합까지 미루면 호환 여부를 판정할 수 없다. W9-00에서 Windows/Web의 선언 해석을 정상화하고 API별 미구현과 검사 입력 실패를 분리한다.
- 동기 custom hook·controller·Widget 수명의 실행 모델은 큰 이식 전에 확인해야 한다. W9-06-A를 앞당기고 전체 그래픽 구현을 그 선행 조건에서 뺀다.
- `packages/cupertino`·`packages/material`은 [1부 §1.1](work9-1.md#11-typescript-디자인-패키지와-c-엔진의-책임)의 TypeScript 구현으로 유지한다. W9-06/08은 원래 구현의 engine 연결과 필요한 공통 연산 확장이며, 디자인 Widget·State·theme를 C++로 이식하는 단계를 두지 않는다.
- Windows host 변경 중 Web 회귀를 늦게 발견하지 않도록 W9-02를 Windows App SDK와 Web 두 profile의 동등한 최소 수직 연결로 나눈다. 공통 계약 변경은 세 실행 경로에서 같은 묶음으로 검증한다.
- 공통 계층 추출·모바일 RN 분리·GTK/AppKit prototype을 한 선행 단계로 묶지 않는다. 1차에서는 Windows RNW의 필요한 OS handler와 Windows/Web 공통 경계만 최소 분리하고 후속 플랫폼은 해당 차수에서 연결한다.
- Clock·기본 예산/hold·일반 앱 배포는 초기부터 확인한다. 광범위 cache 최적화는 실제 단계 시간과 재사용 수치를 얻은 뒤 수행하고 reload/복구는 모바일 이식과 분리한다.
- 필수 animated/외부 콘텐츠는 W9-09-A의 기본 수명·예산과 필요한 paint/interaction이 준비되면 시작한다. W9-09-B의 재사용 최적화 전체를 기능 구현의 선행 조건으로 두지 않는다. 차수 전환은 [§12.5](#125-차수-전환과-완료-판정)의 W9-13 기술 완료를 기준으로 통일한다.

### 12.2 Windows/Web 1차 실행 순서

| 순서 | 실행 묶음                                                        | 다음 묶음으로 넘어갈 기준                                                                                                                                                                                                                                          |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | **W9-00 → W9-06-A**: 현재 공급·API 입력·동기 실행 모델           | 현재 Windows/Web 기준선과 두 target의 유효한 API 검사 입력 확보. [§8.1](work9-2.md#81-검사-환경과-실행-모델의-선행-판정)의 원래 consumer로 보존 가능·명시 경계 필요·미해결을 구분. 통과한 계약만 다음 API 이식의 근거로 삼고 미해결 의무·의존 기능은 미완료로 유지 |
| 2    | **W9-01 → W9-02-A/B**: 최소 공통 경계와 Windows/Web 실행         | 같은 작은 일반 앱이 App SDK host·Web threaded·single-worker에서 실제 C++ 작업·화면·입력·resize·close를 수행. **W9-09-A/10-A**의 기본 예산·clock/시간 계측, **W9-13의 초기 설치·배포 검사**도 이때 연결                                                             |
| 3    | **W9-06-B·W9-05 → W9-07**: 원래 API·그래픽·interaction           | Widget 수명·기본 render 연결부터 시작해 각 기능에 필요한 paint/text를 보강하고 layout·gesture·scroll·editing·semantics·list까지 같은 consumer/corpus로 확장. 전체 W9-05 완료를 기다려 Widget 수명부터 막지 않음                                                    |
| 4    | **W9-08**: 두 TypeScript 디자인·SDK 사용 흐름                    | Windows와 두 Web profile에서 원래 TypeScript Widget/State·import·theme·form·overlay·navigation·localization/service 동작과 C++ engine 사용을 함께 검증. 컴포넌트의 C++ 재구현을 완료 조건으로 두지 않으며 미연결 API 의무는 계속 추적                              |
| 5    | **W9-09-B/10-B·W9-11-A**: 재사용·pressure·frame·필수 콘텐츠 통합 | 재사용 전후 pixel/geometry와 실제 작업 수·단계 시간 대조. 필수 animated/texture/platform view는 W9-09-A와 해당 기능 준비 후 먼저 구현할 수 있으며 이 묶음에서 수명·기능을 최종 통합. 추가 raster cache/damage는 측정 근거가 있을 때만 적용                         |
| 6    | **W9-12-A**: Windows/Web reload·복구 통합                        | 최소 host 연결 뒤부터 개발하고 이때 기능 전체와 통합. 준비 실패·교체·context/device loss·새 session 정책·close/late callback·자원 회수 확인                                                                                                                        |
| 7    | **W9-13 → W9-14**: Windows/Web 최종 통합·제품 수락               | 해당 target의 API/동작·전체 설치 조합·두 profile·공급/실행/종료 검증 후 실제 입력·frame/resize 성능과 기본값 전환을 대상별 판정                                                                                                                                    |

각 묶음에서 같은 공급의 작은 일반 앱과 관련 Testbed 흐름을 확인한다. API·자원·설치 검사는 마지막에 처음 실행하는 검사가 아니라 초기 연결부터 넓혀 가는 검사다. 물리 입력과 사용감도 실행 가능한 묶음에서 조기에 확인하되 최종 제품 수락은 W9-14에서 별도로 판정한다.

### 12.3 단계별 범위와 완료 조건

| ID    | 차수·작업                                                                       | 선행·완료 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W9-00 | **1차** 기준선·공급·API 판정 입력                                               | 현재 diff/source/dist·원래 공개 표면·Windows/Web의 OS/ABI/toolchain/browser·배포/manifest/capability·corpus 확인. [§4.1](work9-1.md#41-windows-rnw-소스-선별-재사용) RNW 후보의 필요 사례·도입/참고 범위·출처/의존성 고정. 현재 공급으로 필요한 core/host/runner 기준선을 확인한 뒤 [§8.1](work9-2.md#81-검사-환경과-실행-모델의-선행-판정)의 실제 consumer 환경으로 검사 입력을 정상화하고 원래 표면의 target별 대응 합계 확인. `inputValid=true` 확보와 실제 호환 잔여 목록을 분리. 모바일 원본 고정·GTK/Apple 환경은 후속 |
| W9-06 | **1차 A** 실행 모델 검증 → **B** 원래 TypeScript Widget/Element/Render API 연결 | A는 W9-00 후 State/Key/context·동기 controller/custom hook의 보존 의미와 실행 owner를 원래 consumer로 확인. B는 원래 TypeScript 구현을 유지하며 W9-01/02·필요한 W9-05와 수명·parent data·NACK/예외·재진입을 연결. 미해결 의무는 미완료. C++ Widget 사본·adapter의 대체 State·UI/Content의 App 동기 대기·숨은 fallback으로 통과시키지 않음                                                                                                                                                                                    |
| W9-01 | **1차** 최소 embedder·runtime/provider 경계                                     | W9-00와 W9-06-A의 설계 결과. Windows/Web의 owner·mailbox·provider·입력/mirror·generation·close와 선택한 RNW OS handler만 최소 분리. TypeScript 디자인 → framework/adapter → C++ engine의 의존 방향 유지. 새 Windows 경로의 RN 앱 객체 의존성을 제거하고 ACK/NACK·snapshot/ledger·오류/cleanup 회귀 유지. 모바일 helper 추출이나 후속 OS 구현을 요구하지 않음                                                                                                                                                                 |
| W9-02 | **1차 A** Windows App SDK·**B** Web 수직 연결                                   | W9-01. A는 실제 AppWindow/dispatcher·Vulkan scene·TSF/UIA·DPI/resize·hide/restore·drain·unpackaged 소비 실행. B는 Chrome·Edge의 두 profile·DOM/ARIA·DPR/resize·실패/close corpus. 작은 공통 앱부터 시작하고 실제 C++ 작업과 host identity 확인                                                                                                                                                                                                                                                                               |
| W9-05 | **1차** Canvas/Paint·rich text/font                                             | W9-01과 W9-06-A. 작은 scene의 protocol/provider부터 확장하고 Windows/Web에서 같은 API·pixel·UTF-16/RTL/placeholder/query·invalidation corpus 실행. W9-06-B/07에 필요한 항목부터 연결해 전체 표현력과 자원 거부/회수까지 완성                                                                                                                                                                                                                                                                                                 |
| W9-07 | **1차** Layout·scroll/gesture·editing·semantics·list                            | W9-06-B 및 해당 기능의 W9-05, 실제 peer는 W9-02. Intrinsic/dry/baseline·invalidation·motion·lazy focus·range/action·동기 controller 의미를 공통 core와 Windows UIA/TSF·Web DOM/ARIA에서 확인. GTK/AppKit/모바일 peer는 후속                                                                                                                                                                                                                                                                                                  |
| W9-08 | **1차** TypeScript Material/Cupertino·SDK API의 engine 연결                     | W9-06-B/07 및 필요한 W9-05. [2부 §8.2](work9-2.md#82-디자인-패키지의-typescript-구현-유지)에 따라 원래 TypeScript constructor/State/default/theme/icon/form/route/overlay·localization과 callback/controller를 유지. 공통 engine 연산·SDK service/platform API를 Windows/Web에 연결. 설치본의 원래 구현 실행·controlled 값/NACK·스타일 변경·package 경계와 C++ 실제 작업을 검증. C++ 컴포넌트 사본이나 API 분모 축소로 통과시키지 않음                                                                                       |
| W9-10 | **1차 A** clock·관측 → **B** 전체 frame 일정                                    | A는 W9-02의 각 host 최소 실행과 함께 clock 단위/기준·ID 대응·단일 frame 수요/credit·input wake·idle·숨김/복귀·build/content/raster/submit 시간 관측. B는 기능 확장 후 연속 입력 watermark·연속 document 갱신·App/Content 지연 중 준비 scene 진행과 App animation의 한계를 통합 검증. GTK/AppKit clock은 해당 후속 host에서 연결                                                                                                                                                                                              |
| W9-09 | **1차 A** 기본 예산/hold → **B** preparation 재사용·pressure                    | A는 W9-01/02부터 신규 자원·실패/교체/close를 ledger에 연결. B는 W9-05와 W9-10-A 후 실제 병목을 기준으로 Picture/paragraph/image 재사용·무효화·pressure 회복과 재기록/shaping/decode 수 감소 확인. RSS/VRAM 측정 한계 명시                                                                                                                                                                                                                                                                                                    |
| W9-11 | **1차 A** 원래 API의 animated/외부 콘텐츠·**추가 B** cache/damage               | A는 필요한 W9-05/07와 W9-09-A/10-A 후 Windows/Web의 API별 필수 기능·texture/platform view 입력/semantics·수명 검증. W9-09-B 전체를 기다리지 않으며 최종 통합에서 재사용과 대조. 요구 기능 미지원은 호환 gate 실패. B는 W9-09-B/10-B 측정 근거가 있을 때 적용하고 full redraw pixel·무효화·회수 대조; 근거가 없으면 추가 최적화 보류로 기록                                                                                                                                                                                   |
| W9-12 | **1차 A** Windows/Web reload·복구 / **2차 B(Android)** / **3차 B(iOS)**         | A는 W9-01/02 후 시작, bundle 준비 실패·세대 교체·device/context loss·재생성/새 session·close를 기능 확장과 통합. B는 [§11](work9-2.md#11-web모바일에서-유지할-범위) M0/M1/M2의 RN 소스 분리·standalone 입력/편집/semantics·surface/clock·reload/복구·설치/drain을 대상별 수행. Android는 Windows/Web 1차 완료 후 4부에서, iOS는 Android/Linux 2차 완료 후 5부에서 진행. M3 Web helper는 A/07에서 독립 수행                                                                                                                   |
| W9-13 | **대상별** 전체 API·host 통합·배포                                              | 초기 Windows/Web 설치 검사는 W9-02부터. 1차 최종 판정은 W9-05/06-B/07/08/09/10/11-A/12-A와 W9-02의 전체 corpus, 원래 scope·동작·installed compiler/CLI·두 TypeScript 디자인 패키지의 실제 구현과 engine 의존 경계·전체 package 조합·출처/identity·손상 거부/정리를 요구. 디자인 패키지 내 native Widget 구현/target·엔진 binary를 추가하지 않음. W9-03/04/12-B는 1차 선행 조건에서 제외                                                                                                                                      |
| W9-14 | **대상별** 물리 입력·성능·기본값 전환                                           | W9-13을 통과한 대상부터 평소 명령·실제 사용자 입력·동일 측정 조건으로 판정. Windows/Web의 결과와 profile별 한계를 기록하고 후속 플랫폼의 flag를 올리지 않음. V1 정리는 해당 제품 gate 후 사용 경로·제거 목록을 확인하는 별도 단계                                                                                                                                                                                                                                                                                            |
| W9-03 | **2차 / 4부 / DEFERRED** GTK4 수직 연결                                         | Windows/Web W9-13 기술 완료 후 Android와 같은 차수로 W9-01의 계약을 사용해 Linux 공급을 고정. GTK 4.22 이상·DMA-BUF capability/동기화/FD·게시/geometry·IM/AT-SPI의 caret/selection 변경·Wayland/X11·일반 앱/reload/loss/drain. Prototype 실패면 Linux gate 미완료                                                                                                                                                                                                                                                            |
| W9-04 | **3차 / 후속 5부 / DEFERRED** AppKit 수직 연결                                  | Android/Linux W9-13 기술 완료 후 iOS와 같은 차수로 W9-01의 계약을 사용해 Apple 공급을 고정. AppKit/Metal·point/pixel·marked text·NSAccessibility·display/resize·.app 공급/reload/loss/drain을 실제 macOS에서 검증                                                                                                                                                                                                                                                                                                            |

Windows/Web 1차 이후 **2차는 W9-12-B(Android)·W9-03**, 그다음 **3차는 W9-12-B(iOS)·W9-04**로 진행한다. 각 차수의 API·host·공급 통합 완료 뒤 다음 차수에 착수하고, 물리 입력·성능 수락은 W9-14에서 대상별로 구분한다. 해당 host의 W9-05–11 corpus와 W9-13/14를 다시 연결한다. **후속 host에 Windows/Web의 통과를 그대로 복사하지 않는다.** Windows/Web 1차 기술 완료는 해당 API·host·공급 gate의 통과이며 전체 플랫폼 완료나 물리·성능 수락을 뜻하지 않는다.

### 12.4 실행 체크리스트

- [x] W9-00: 기준선·고정 공급·RNW 출처의 선행 결과를 유지. Ink 공개 helper 추가와 타입 출력 순서를 구별해 원래 분모/hash를 보존한 API 입력 gate를 복구하고 최신 source/dist·설치 identity를 확인했다. 전체 동작 호환은 미완료다.
- [ ] W9-06-A: 원래 Widget 수명·동기 controller/custom hook의 실행 모델과 미보존 계약 확인.
- [ ] W9-01/02-A/B: 최소 공통 경계·App SDK·Web 두 profile의 같은 일반 앱 실행과 초기 설치 검증.
- [ ] W9-09-A/10-A: 최소 실행부터 예산/hold·clock·단계 시간 관측 연결.
- [ ] W9-06-B/05/07: 원래 Widget·paint/text·layout/scroll/gesture·editing/semantics/list를 기능별 통합.
- [ ] W9-08: Windows/Web의 원래 TypeScript Material/Cupertino·SDK 전체 동작과 C++ engine 연결·구현/배포 경계 확인.
- [ ] W9-09-B/10-B/11-A: 재사용·pressure/frame·필수 animated/외부 콘텐츠 검증. W9-11-B 추가 최적화는 근거에 따라 별도 판정.
- [ ] W9-12-A: Windows/Web generation reload·loss/재시작·실패/close와 전체 기능 통합.
- [ ] W9-13: Windows/Web의 전체 API/동작·설치 compiler/CLI·package 조합·공급/회수 gate 통과.
- [ ] W9-14: 실제 Windows/Web 입력·이동/resize 성능을 확인하고 검증한 대상의 기본값 전환 판정.
- [ ] 2차 / 4부: W9-12-B(Android)·W9-03의 Android·GTK4 구현과 각 대상 W9-05–11 corpus·W9-13/14를 수행. iOS/macOS를 완료 조건에 포함하지 않음.
- [ ] 3차 / 후속 5부: Android/Linux 2차 통합 완료 후 W9-12-B(iOS)·W9-04의 UIKit·AppKit 구현과 각 대상 W9-05–11 corpus·W9-13/14를 별도 수행.

### 12.5 차수 전환과 완료 판정

**1차 → 2차는 Windows와 Web의 W9-13 기술 완료, 2차 → 3차는 Android와 Linux 각각의 W9-13 기술 완료가 조건이다.** Web은 초기 대상인 Chrome·Edge에서 threaded/single-worker 모두를 포함한다. 문서에서 별도 수식 없이 앞선 차수의 ‘완료’ 또는 ‘통합 완료’라고 한 것은 이 기술 gate를 뜻한다. 물리 입력·성능 수락을 기다리며 독립된 다음 플랫폼 작업을 막지 않는다.

| 판정                       | 완료 의미와 상태 기록                                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API 검사 입력 유효         | W9-00의 `inputValid=true`. 아직 동작 호환이나 W9-06/13 완료를 뜻하지 않음                                                                                                                             |
| 대상별 기술 완료           | 해당 차수에 적용되는 W9-01/02 또는 W9-03/04/12-B, W9-05–10·11-A·복구/공급과 W9-13의 API/host/설치 gate 통과. 미해결 공통 API를 비적용으로 빼지 않음. 선택적 W9-11-B는 근거 있는 보류가 가능           |
| 물리 입력·성능 수락        | W9-14에서 실제 대상/profile·입력 source·장면별로 판정. `performanceAccepted`·`resizePerformanceAccepted`와 IME/reader/trackpad·표시 관측을 따로 기록. 기술 완료만으로 false/notVerified를 올리지 않음 |
| 제품 기본값·기존 경로 정리 | 해당 대상의 W9-13과 W9-14 제품 gate 이후에만 기본값 전환. 기존 host/v1 제거는 사용 경로·제거 목록 확인 후 별도 수행. 다른 플랫폼의 기본값·미완료 상태를 함께 바꾸지 않음                              |

W9-12의 A·B(Android)·B(iOS)와 W9-13/14의 상태는 대상별로 유지한다. Windows/Web 완료만으로 W9-12 전체나 전체 플랫폼을 체크하지 않으며, **전체 기술 완료와 전체 제품 수락도 각각** 모든 계획 대상의 해당 gate가 통과해야 한다. 필수 corpus를 실행할 환경이 없으면 미검증/DEFERRED 또는 해당 작업의 차단 사유를 남기고 성공으로 간주하지 않는다.

모든 차수의 기술 gate는 같은 TypeScript 디자인 구현이 해당 C++ engine/host에서 동작하는지를 판정한다. C++ 컴포넌트로 바꾼 화면이나 OS 기본 control만으로 두 패키지의 API/State/theme 호환을 통과시키지 않는다. 후속 플랫폼에서 필요한 변경은 공통 engine/provider·OS adapter와 명시적인 TypeScript 플랫폼 분기에 반영한다.

## 13. 검증과 판정

**1차 판정은 Windows와 Web 두 profile을 대상으로 한다.** 아래 판정은 현재 구현 기록이며 제품 물리·성능 gate의 통과와 구분한다. 원래 공개 API 의무의 target별 적용표를 보존하고 Windows/Web의 통과와 후속 플랫폼 미검증을 별도 기록한다.

| Gate                     | 차수·통과에 필요한 증거                                                                                                                                                                                                                 | 현재 판정                                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 원래 공개 표면·동작      | **1차 Windows/Web**, 후속 대상은 별도. 원래 scope·overload/member/protected/non-code·target별 선언 해석과 installed runtime 동작. 입력·표면·동작을 각각 판정                                                                            | **inputValid=true / compatible=false**. 원래 분모/hash와 두 target 선언 해석 유지. loadBuffer 추가 두 클래스는 signatureChanged / structuralCompatibility=notApproved. 전체 동작 의무는 미완료이며 부분 회귀의 성공을 전체 호환으로 확대하지 않음                                                      |
| 디자인 구현 경계         | **모든 차수** 두 패키지의 TypeScript Widget/State/theme·callback/controller 실행, 공통 C++ 연산과 package/build/link 경계. [§8.2](work9-2.md#82-디자인-패키지의-typescript-구현-유지)의 스타일 변경·controlled update/NACK·dispose 사례 | **구간 검증 PASS / 전체 PARTIAL**. 현재 Source Radio·Checkbox·Switch·Slider 등의 TypeScript 정책과 C++ 공통 연산을 부분 연결했다. 실제 callback·controlled 값·스타일·권한/수명과 설치 소비를 확인했으며 전체 디자인 API/설치 조합은 미완료다. |
| Windows App SDK          | **1차** 실제 App SDK 창/dispatcher·Skia 실행·TSF/UIA·입력/resize/종료·배포 identity                                                                                                                                                     | **구현 구간 PASS / 전체 PARTIAL**. AppWindow/dispatcher·Vulkan·자동 TSF/UIA·resize/hide/restore·앱 로컬 배포 통과. 원래 API·물리 입력·최종 통합 별도                                                                                          |
| Web                      | **1차** Windows Chrome·Edge의 두 profile·같은 기능 corpus·비격리 auto·강제 요구/공급 실패·DPR/숨김·재생성/close                                                                                                                         | **구현 구간 PASS / 전체 PARTIAL**. 실제 Chrome/Edge headful 두 profile의 기존 corpus·실패/close matrix 통과. 원래 API·전체 기능 통합은 미완료                                                                                                 |
| 그래픽·메모리·clock·복구 | **1차 Windows/Web**의 provider 공통 corpus·실제 작업 수·무효화/pressure·bounded hold·clock/credit·단계 시간·reload/loss/close                                                                                                           | **PARTIAL**. 기존 공통 구간과 publication race 수정 통과. 일반 앱 generation reload 통합 중이며 display clock·추가 graphics/reuse/pressure·복구 의무 유지                                                                                     |
| 제품 물리·성능           | **1차 Windows/Web**, 후속 대상은 별도. 관측된 장면/입력 source의 실제 조작과 같은 조건의 이동/resize·frame/메모리 측정                                                                                                                  | **notVerified**, 두 acceptance flag **false**                                                                                                                                                                                                 |
| GTK4                     | **2차 / 4부** Wayland/X11 각각 GPU import·게시/geometry·IM/AT-SPI·회수/소비자 실행                                                                                                                                                      | **DEFERRED / 미착수 / notVerified**                                                                                                                                                                                                           |
| AppKit                   | **3차 / 후속 5부** macOS의 AppKit/Metal·IME/NSAccessibility·display/resize·회수/.app 공급                                                                                                                                               | **DEFERRED / 미착수 / notVerified**                                                                                                                                                                                                           |
| Android                  | **2차 / 4부** arm64-v8a standalone host·[§11.4](work9-4.md#114-android--기존-nelyx-os-코드를-먼저-분리)와 공통 입력/mirror/semantics corpus·surface 수명·설치/실행·drain                                                                | **DEFERRED / 소스 검토 / 구현 미착수 / notVerified**                                                                                                                                                                                          |
| iOS                      | **3차 / 후속 5부** 지정 ABI의 UIKit host·[§11.5](work9-5.md#115-ios--uikit-입력-endpoint와-rn-예외-처리-이식)와 공통 입력/mirror/semantics corpus·scene 수명·설치/실행·drain                                                            | **DEFERRED / 소스 검토 / 구현 미착수 / notVerified**                                                                                                                                                                                          |
| RN/RNW 소스 분리·도입    | **1차 Windows RNW·필요한 Web helper**, 모바일은 후속. 고정한 출처·의존성·native/link/bundle graph, RN 앱 runtime 없이 실제 실행. 기존 구현으로 해결한 범위와 실제 도입을 구분                                                           | **Nelyx OS helper 실행 / RNW는 참고만**. DirectManipulation callback·고정 source hash·standalone link 확인. 물리 trackpad 관측은 0/notVerified. 모바일 DEFERRED, Web 기존 host 유지                                                           |

1차 Windows와 Web threaded는 App/Content 50/100/200 ms 지연 중 준비 scene의 입력/합성·게시 진행을 확인한다. Web single-worker는 App 독립·Content 유한 분할/동기 점유 후 회복을 따로 판정한다. 무한 동기 작업·lost wake·무제한 queue·scene 역전·미회수 terminal은 어느 profile에서도 허용하지 않는다.

실행 경로는 SDK ACK 명령/transaction·App geometry·거부/fallback 이유와 실제 C++ layout/text/paint/compose 작업을 대조한다. `observed=false`, 작업 0·관측 누락, 수요 없는 control을 성공 수치로 바꾸지 않는다. Build graph나 패키지 이름만으로 C++ 경로의 실행/성능을 인정하지 않는다.

원래 TypeScript 디자인의 build·theme 해석·State/controller·callback·paint 명령 구성은 정상적인 App 작업이다. 이를 TS renderer fallback에 합산하거나 `fallbacks=0`을 위해 C++로 옮기지 않는다. C++ engine 연산의 실제 실행과 원래 TypeScript 동작의 보존을 각각 계측/검증하며, 최종 layout/hit-test/raster를 우회하는 숨은 TS 경로에는 기존 거부 정책을 적용한다.

제품 평가는 사용자의 평소 명령과 Gallery 양 열 전체 구간·Mixed 편집 복귀·ListView/Cupertino를 사용한다. 정지→시작→10초 이상 연속→반전→관성→재접촉·resize를 포함하고 물리 precision trackpad와 주입 wheel을 구분한다. 기준/후보 **3쌍**을 기본으로 하고 대부분의 검증은 **30회 이내**로 제한한다. Warm 일반 이동의 60fps 기준·lazy 준비 중 일시 jitter와 준비 뒤 지속 정지를 구분한다. [기존 제품 평가 조건](history/26/11/04/work8-3-summary.md#173-후속-제품-성능-비교--백엔드-완료와-별도-평가)

같은 장면·현재 공급을 Windows App SDK와 실제 Web browser에 연결해 비교하고 주사율·DPI·해상도는 바꾸지 않는다. Web 결과에는 browser·GPU·profile·격리 여부·tab 가시성을 포함한다. Single-worker의 Content 점유 한계와 입력 보존/회복을 threaded와 구별하며 profile 간 동일 성능을 전제하지 않는다.

비교 시작 전에 평소 실행 명령·Release/optimized/VM cohort·창 크기·콘텐츠/physics·예열/coverage·입력 구간과 관측 방법을 고정한다. 실제 이동 상태가 바뀐 surface frame의 수·간격과 p95/p99/max 지연·지속 정지·CPU/GPU·ledger/process 관측을 구별한다. 같은 화면의 반복 submit은 이동 FPS로 세지 않으며 빌드·다른 성능 검사를 동시에 돌리지 않는다. 미수락 구간과 물리 입력 결과를 평균 수치로 덮지 않는다.

Surface 갱신·GPU 완료·host publication·물리 display/scanout은 각각 기록한다. 관측하지 않은 scanout은 `unobserved`다. 실제 일반 사용의 체감 수락은 관측된 범위로 판정할 수 있으며 모든 내부 시각을 알아야만 사용자 수락을 기록할 수 있는 것은 아니다.

### 변경 범위별 필수 회귀

아래 사례를 관련 단계의 기존 suite에 연결하거나 새 host/adapter 검사로 추가한다. 현재 존재하는 suite가 새 host를 이미 검증한다고 보고하지 않는다.

| 변경 범위                     | 필요한 성공·실패 사례                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API 입력·실행 경계 W9-00/06   | Target별 실제 설치 import·overload/member/protected/non-code 대응, 잘못된 export condition·누락·해석 실패·표면 축소의 거부. 동기 getter/setter/listener·재진입·NACK와 실제 C++ 작업 대조                                                                                                                                                                                                  |
| TypeScript 디자인 W9-06/08/13 | 원래 Widget/State/theme·사용자 callback/controller가 실제 실행되고 engine 이벤트와 중복 상태 변경을 만들지 않음. Controlled update 거부·NACK·disable/cancel·dispose 순서와 원래 확장 지점 확인. 기존 capability 안의 theme/스타일 변경은 C++ 디자인 코드 수정 없이 반영. 두 패키지에 native Widget 소스/target·엔진 binary가 없고 공통 engine이 디자인 구현을 역으로 포함하지 않는지 확인 |
| 공통 wire·owner W9-01/05/07   | 세 실행 경로의 schema/capability 불일치·유실 ACK/재시도·준비 실패/자원 회수. 입력·App 이벤트 포화·연속 document 변경·다중 view에서도 bounded 상태와 frame/terminal 진행                                                                                                                                                                                                                   |
| App SDK W9-02-A               | 개발 runtime 없는 앱 로컬 배포·필수 파일 손상/누락의 거부, AppWindow/dispatcher 실제 실행·DPI·TSF/UIA·live resize/최소화·마지막 창 닫기·시작 도중 종료. 기존 HWND host는 별도 control                                                                                                                                                                                                     |
| Web W9-02-B/07/12-A           | Chrome·Edge의 두 profile, 격리 환경의 forced single-worker·비격리 강제 threaded 실패, 잘못된 worker/Wasm·권한 거부, base URL/배포 자원, context loss·새 canvas 재시작·reload/close와 late event 차단                                                                                                                                                                                      |
| Provider·복구 W9-09–12        | Retained/full redraw pixel·text/clip/hit/semantics, 자원 무효화·예산 거부·pressure·detach/restore·device/context loss·dispose 무응답·close 중 reload. GPU/OS consumer hold·pending·callback이 회수되고 다음 정상 scene이 진행                                                                                                                                                             |

물리 IME/reader/precision trackpad와 GPU 실제 browser 검사는 위 자동 회귀와 별도다. GTK/Android·Apple 관련 사례는 해당 후속 차수의 실제 환경에서 같은 gate에 연결하며 Windows cross-build나 simulator 결과로 device/OS 입력 수락을 대신하지 않는다.

### 구현 시 사용할 기존 검사 명령

아래는 **현재 존재하는 명령**이다. 이번 문서 검토에서는 실행하지 않았다. 변경한 공개 패키지와 engine 공급을 갱신한 뒤 필요한 범위만 실행하며 host 검사는 현재 소스/공급 identity를 확인한 후 수행한다. W9-00의 기준선은 현재 core/host/runner와 API 입력·audit 상태를 확인하고 이후에는 변경한 기능과 소비 경로에 필요한 검사만 추가한다. 아래 목록을 파일 수정마다 전부 반복하지 않는다.

TypeScript 디자인/framework API만 변경한 개발 중에는 해당 패키지·adapter를 빌드/공급하고 관련 통합 사례를 선택한다. 공통 C++/wire/ABI를 바꾸지 않았고 공급 호환/identity를 확인했다면 기존 native engine binary를 재사용한다. TypeScript source 변경의 package identity 갱신과 native 재컴파일을 구별한다. 예를 들어 ListView 연결 확인은 다음 명령만 사용한다.

```powershell
$env:NELYX_ENGINE_V2_PREBUILT = (Resolve-Path Nelyx/engine/dist).Path
$env:NELYX_ENGINE_V2_TEST_PROFILES = 'native'
node --experimental-transform-types --test --test-timeout=1200000 --test-name-pattern='native: original ListView and ScrollController' Nelyx/engine/tests/contracts.test.mjs
Remove-Item Env:NELYX_ENGINE_V2_PREBUILT
Remove-Item Env:NELYX_ENGINE_V2_TEST_PROFILES
```

Web의 같은 고수준 버튼·animation 소비는 다음 대표 통합 하나를 선택한다. 이 한 사례에서 두 profile을 확인한다.

```powershell
node --test --test-timeout=1200000 Nelyx/engine/tests/original-controls-browser.test.mjs
```

아래는 wire·provider·host·공급 등 해당 영역을 변경했을 때 선택하는 회귀 목록이다.

```powershell
npm.cmd run build:engine-v2
npm.cmd run test:engine-v2
npm.cmd run test:engine-v2:app-text
npm.cmd run test:engine-v2:api
npm.cmd run test:engine-v2:lifecycle
npm.cmd run audit:engine-v2:api
npm.cmd run test:engine-v2:glyphs
npm.cmd run test:engine-v2:actors
npm.cmd run test:engine-v2:graphics
npm.cmd run test:engine-v2:hosts
npm.cmd run test:engine-v2:runner
npm.cmd run test:engine-v2:development
npm.cmd run test:input-geometry
npm.cmd run test:retained-input-geometry
npm.cmd run check:types
npm.cmd run check:cli-types
npm.cmd run check:package-boundaries
npm.cmd run check:design-ownership
npm.cmd run lint
npm.cmd run format:check
git diff --check
```

모든 테스트 timeout은 [저장소 지침](.github/copilot-instructions.md)의 **20분**이다. Geometry 변경은 두 입력 geometry 검사를 함께 실행한다. 새 Windows App SDK host의 검사·배포 연결과 Linux/macOS·모바일 host 검사·target별 build/doctor/pack 지원은 각 host 단계에서 구현하고 도움말·성공/실패 사례를 함께 추가한다. 현재 App SDK는 Windows 공급·host·runner 검사에 포함한다. 후속 Linux/macOS·모바일 host의 검증으로 확대하지 않는다.

현재 v2 host를 눈으로 확인할 때 쓰는 저장소 명령은 `npm.cmd run run:engine-v2:windows`와 `npm.cmd run run:engine-v2:web`이다. Web 서버의 `/isolated/`·`/plain/`을 각각 확인한다. 이 명령은 현재 Testbed 공급의 실행 경로이며 **App SDK host·원래 API 호환의 완료 증거는 아니다.** 일반 설치 앱의 명령과 배포 검사는 [기존 v2 프로젝트 안내](Nelyx/sdk/README.ko.md#일반-v2-프로젝트)에서 시작하고 W9-02/13에서 새 host에 맞춰 검증·갱신한다.

기존 RNW 기준/후보를 비교할 때는 [저장소 지침](.github/copilot-instructions.md)의 평소 명령·현재 native/SDK 공급과 `run-rnw-cadence.mjs --input-geometry=ts|retained`의 해당 실행 검증을 따른다. Retained 비교에는 Mixed 편집기 작업이 필요하다. Snapshot/Path/clip-Paint/Scene/Semantics 후보의 별도 비교도 지정 audit·3회 functional 실험을 유지한다. **해당 RNW 도구가 새 standalone App SDK host를 측정한다고 가정하지 않는다.** W9-10/14에서 새 host의 동등한 장면·물리 입력·frame/resize 측정 경로를 연결하고 host 변경 효과와 engine 효과를 구분한다.

npm 0xC0000409가 재발할 때만 [기존 한정 조사 절차](history/26/11/05/work8-2a-summary.md#73-재발할-경우의-한정된-조사)를 적용한다. Node/npm real path·version·status와 실패 지점의 근거를 소수 대조로 확인하고 원인 미확정을 통과 기록으로 취소하지 않는다.

## 14. 공급·정리와 문서 운영

현재 source·engine/host ABI·VM/compiler·Skia/CanvasKit·App bundle·설치본의 identity를 연결한다. Host 요구 capability가 없으면 시작 실패로 보고하며 다른 host/TS renderer로 자동 변경하지 않는다. 독립 설치 compiler·설치 CLI·두 디자인·빈 module/non-code 자산까지 검사 분모를 유지한다.

두 디자인 패키지는 TypeScript/JS·선언·자산으로 배포하고 native engine/provider/host 공급은 공통 경계에서 관리한다. 디자인만 바꾸는 작업은 해당 package/adapter와 관련 consumer를 갱신한다. 엔진/provider/host 구현·ABI 또는 native 공급 입력이 바뀔 때 해당 native 공급을 함께 갱신하며, 디자인 패키지 설치·빌드에 자체 C++ Widget compile 단계를 추가하지 않는다. Package archive·dependency/build/link graph와 실제 설치 entry에서 이 경계를 검증한다.

선별 도입하는 RN/RNW/RN Web 코드는 원본 repository·tag/commit 또는 검증한 package integrity·파일 hash·도입/변경 범위·필수 의존성·license/notice를 현재 소스의 고정된 출처 정보로 관리한다. 원래 저작권·license와 해당 파일의 제3자 고지도 공급에 포함한다. 업데이트는 필요한 OS 수정과 실제 corpus를 대조해 진행하며 전체 checkout·이전 source/package 사본·실행별 조사 기록을 누적하지 않는다.

검증용 consumer·archive·browser profile·server/process·GPU/native 임시 자원은 한 실행에 필요한 범위로만 만들고 성공·실패·중단 시 finally에서 정리한다. 현재 dist/package만 남기며 이전 출력·receipt·로그·checkpoint/history JSON·설치본을 누적하지 않는다. `Nelyx/docs/plans/`와 `Nelyx/docs/migrations/`를 생성·복구하지 않는다.

진행 상태·짧은 증거·남은 작업은 해당 분할 문서에 갱신하고 전체 현황·다음 시작점은 [전체 목차](work9.md)에 반영한다. 제품 사용법은 기존 한국어/영어 README에 반영한다. 현재 작업 기록에는 **차수·대상/profile·수행한 검사·남은 의무·다음 시작점**을 적는다. Windows/Web 1차 완료 시 2차 Android/Linux와 3차 iOS/macOS는 계속 DEFERRED로 보존한다. 2차 대상에 착수해도 3차 상태를 올리지 않으며, 각 대상의 W9-03/04/12-B·W9-13/14 결과를 별도로 갱신한다. 닫힌 work8의 과거 수치·실패·공급 경계를 새 결과로 덮어쓰지 않는다. 기술 단계가 끝나도 대상별 API·물리 입력·성능 gate를 따로 남기며, 기본값 변경·기존 host/v1 제거는 검증한 대상과 사용 경로를 확인한 뒤 진행한다.

### 이번 문서 작업의 검증과 다음 시작점

**앞선 검토 기록 — 2026-11-05 KST / Windows·Web 우선·RNW 선별 재검토:** 당시 work9만 수정했다. 기존 W9-00–14 **15단계**와 1차 순서를 유지하고 RNW 0.83.2의 설치 소스·기존 Nelyx Windows helper·공식 구조 설명을 대조해 [§4.1](work9-1.md#41-windows-rnw-소스-선별-재사용)의 재사용 후보·의존성·실행 gate를 추가했다. 당시 관련 문서 **14개**의 로컬 링크 **288개**·앵커 참조 **46개**·표 **47개**, 코드 fence·공백·ID/단계 연결과 문서에 적은 루트 npm 명령 **20개**의 존재를 확인했다. `git diff --check`를 통과했다. 해당 검토 시작 시 이미 있던 다른 파일 **13개**의 내용 hash와 work8 원문 **5개**의 삭제 상태를 유지했다. 이 수치·dirty 상태는 앞선 실행의 기록이며 현재 검토의 재검증 결과가 아니다.

**앞선 공통 계약 재검토 — 2026-11-06 KST:** 당시 지정한 계획 **6개**만 수정했다. 현재 소스·공식 계약과 대조해 GTK 4.22 최소 버전, API 실행 모델·검사 환경, 기술/제품 gate·의존성, host 초기화/입력/frame·자원/복구·후속 공급 조건을 보완했다. 주요 절 **14개**·W9 단계 **15개**, 로컬 링크 **131개**·앵커 참조 **76개**·표 **21개**·code fence/공백과 루트 npm 명령 **20개**의 존재를 확인했고 `git diff --check`를 통과했다. 제품 소스·공급 변경, 빌드·API audit·runtime·물리 입력·성능 재검증은 수행하지 않았다. 기존 API FAIL·구현 PARTIAL·후속 DEFERRED와 수락 미검증을 유지한다.

**디자인 패키지 경계 재검토 — 2026-11-06 KST:** 사용자 요청에 따라 **1~5부 5개만** 수정했다. `packages/cupertino`·`packages/material`의 TypeScript 구현 유지, 공통 C++ engine 사용, adapter/host·컴포넌트 정책의 소유권과 W9-06/08/13·후속 플랫폼·공급/회귀 조건을 맞췄다. 제품 소스/공급·기존 실행 결과는 변경하지 않았고 빌드/기능 검증을 새로 실행하지 않았다. 구현 목표는 계속 **PAUSED / PARTIAL**, 후속 플랫폼은 **DEFERRED**, 물리/성능 gate는 기존 미수락 상태다.

이 경계 재검토에서 로컬 링크 **107개**·그중 앵커 참조 **53개**, 표 **23개**·code fence/공백, 기존 주요 절 **14개**·W9 단계 **15개**, 루트/해당 workspace의 npm 명령 **23개**를 확인했고 `git diff --check`를 통과했다. 요청한 다섯 문서 외에 시작 시 있던 변경 파일 **61개**의 내용 hash를 유지했다. 문서 검증을 구현·설치·물리/성능 통과로 취급하지 않는다.

**앞선 공통 계약 검토 당시의 구현 시작점은 W9-00의 공급/기준선·API 입력과 RNW 출처 선정이었다. 이후 구현의 현재 상태와 미완료 범위는 아래 기록, 다음 구현의 디자인 소유권은 1부 §1.1·2부 §8.2를 따른다.**

## 현재 구현·검증과 잔여 작업

**2026-11-07 KST / IN_PROGRESS / Windows·Web 1차 PARTIAL.** Canonical root/PlatformAssetBundle을 두 SDK App 모델의 패키지 asset 소유자에 연결하고 서비스 bootstrap 중 취소·실패·종료와 loadBuffer/ImmutableBuffer·NetworkAssetBundle·ImageDescriptor/Codec의 buffer 소비·실제 decoder와 큰 encoded v2 ImageResource의 Scene 전달·Content/Render 표시와 canonical RawImage/RenderImage의 별도 snapshot·C++ 이미지 배치·표시/수명과 ImageProvider/ImageCache·실제 Core frame clock·HTTP header/cancel/progress를 연결했다. Source FontLoader·공개 ui.loadFontFromList·확정 font 알림과 불변 recording 수명은 유지한다. **이미지 stream visibility/복구·Canvas 연결·기존 클래스 타입 호환성·OS font 변경 알림과 전체 text/Canvas·디자인 API·W9-06/07/08/13/14는 미완료**다.

현재 공급은 **`175c55c60f565577f202650a44b127f67866e214b1ac24e736617e6996005114` / ABI 2·schema 2844160510 / App service 12·image service 2·HTTP header service 2**다. Native·두 Wasm·HWND/App SDK host와 Core·두 디자인·SDK를 빌드했다. Manifest **349파일**(manifest 포함 350)의 source/hash/exact set이 일치한다. App SDK **1.8.260508005**·C++/WinRT **2.0.250303.1**·Windows SDK **10.0.26100.0**·`/MD`·Graphite/Vulkan·Hermes를 유지한다.

### 구현과 책임 경계

- **NetworkAssetBundle·HTTP 소유권:** [Canonical API](Nelyx/src/services/asset-bundle.ts)를 [공통 App transport](Nelyx/sdk/src/runtime/engine-v2-network.ts)에 연결했다. Base URL 문자열에 상대 key·query·fragment·절대 HTTP(S) key를 해석하고 HTTP 200만 성공시킨다. Bundle 자체 cache는 두지 않는다. [Native 비동기 WinHTTP](Nelyx/engine/platform/windows/app_http.hpp)와 Web fetch stream은 HTTP 전에 metadata/callback 복사용 **512 KiB**를 확보한다. 공통 IO 대기 **32개**, data **32 MiB**와 App quota를 유지하며 길이 미상·압축 응답은 할당 전에 **3 × capacity + 65536 bytes**를 늘리고 실제 길이로 줄인다. Native는 가용 bytes를 확인한 뒤 최대 **64 KiB**를 읽고 마지막 HANDLE_CLOSING callback·빌린 JSI 복사 뒤에 요청 credit을 반환한다. 비동기 transport 해제 실패는 staging을 quarantine하며 정상 drain으로 바꾸지 않는다. OS/browser 내부 network buffering은 소유 ledger의 측정 대상이 아니다.
- **Native 선언 경계:** Data SDK entry의 browser 재수출이 Native에 DOM ambient type을 요구하던 문제를 [선언](Nelyx/sdk/src/runtime/engine-v2-browser.ts)에서 수정했다. 실제 TypeScript **7.0.2**로 두 모델 × 정상/시작 취소 × Windows/Web **8조합**을 strict 검사했다. Native는 ES2022·types=[]·skipLibCheck=false를 유지하고 Web은 정확한 Worker/MessagePort/Canvas/URL 타입을 보존한다. Runtime의 browser capability 요구와 실패 경계는 같다.
- **ImmutableBuffer·실제 소유권:** [Canonical API](Nelyx/src/ui/immutable-buffer.ts)와 `AssetBundle.loadBuffer()`를 연결했다. Native는 C++ SkData, Web은 CanvasKit 할당과 SDK byte upload/readback 복사를 사용한다. 입력 view는 Promise 반환 전 캡처하며 `fromAsset`·Native UTF-8 `fromFilePath`·길이·dispose를 제공한다. Public handle을 해제해도 engine holder와 진행 중인 읽기의 backing/credit은 마지막 참조까지 유지한다. 할당당 **2 × size + 65536 bytes**, live handle/할당 **64개**·data **32 MiB**·IO 대기 **32개**, 내부 chunk **256 KiB**를 제한한다. 불확정 해제·foreign/종류/중복·살아 있는 reader는 정상 drain으로 바꾸지 않는다. Buffer 전용 IO staging은 반환하며 caller ByteData의 realm credit과 구별한다.
- **Canonical bundle/cache:** [AssetBundle](Nelyx/src/services/asset-bundle.ts)의 PlatformAssetBundle/rootBundle을 [realm 소유자](Nelyx/src/services/asset-loader-binding.ts)에 연결했다. Structured cache miss는 string cache를 우회하고 parser 실패 뒤 새 bytes를 읽는다. Cache hit identity·evict/clear·late result 격리를 유지한다. [DefaultAssetBundle](Nelyx/src/framework/widgets/default-asset-bundle.ts)은 App root와 inherited override를 선택하며 ImageService 의존을 제거한다. Classic SDK의 기존 ImageService fallback은 유지한다. [고정 원본 선택](Nelyx/upstream/framework-imports.json)은 Flutter `71e4717a61786faab4c7aa39825989305ed29e8a`·`services/asset_bundle.dart` SHA `0c336cbe3a788e7a6b2864433a319aabd44669640f3d8e3eb9026d73966a974a`와 BSD notice를 유지한다.
- **두 SDK 모델·패키지 metadata:** [공통 bootstrap](Nelyx/sdk/src/runtime/engine-v2-app.ts)과 [asset owner](Nelyx/sdk/src/runtime/engine-v2-assets.ts)는 사용자 build 전에 root를 연결하고 backend를 공유한다. [CLI](Nelyx/sdk/tooling/cli/src/engine-v2-assets.mjs)는 canonical binary/Web manifest와 최대 **512 KiB** index를 만든다. UTF-8·공백·Nx variant를 지원하고 예약 manifest·파일/폴더 대소문자 충돌을 publish 전에 거부한다. 복사한 실제 크기로도 quota를 확인한다.
- **서비스 bootstrap 1:** [공통 SDK](Nelyx/sdk/src/runtime/engine-v2-app.ts)는 시작 실패·종료 때 quota 대기·검증 모듈·[provider](Nelyx/engine/render/canvaskit-web/provider.ts) 다운로드를 취소한다. 실패한 요청의 sibling도 모두 settle한 뒤 staging credit을 회수한다. 중단할 수 없는 실제 Wasm 초기화는 결과를 기다리고 늦은 backend를 Source/asset caller에 전달하지 않는다. Heap과 고정 host **320 MiB**는 실제 worker 종료까지 보유한다. 계약이 없는 이전 Web 공급은 provider 시작 전에 거부한다. Native C++ ABI/IO 작업은 이 변경의 대상이 아니다.
- **읽기 전 credit:** [Native](Nelyx/engine/platform/windows/app_text.hpp)는 크기 확인 뒤 reserve/read/copy, Web은 HEAD 또는 index 뒤 admit/stream/SHA-256을 수행한다. 일반 HTTP의 HEAD/hash header 없는 경로도 지원한다. IO 대기 **32개**, admit buffer **64개**, 누적 admit data **32 MiB**, 입력당 **3 × size + 65536 bytes**를 App quota 안에서 제한한다. Font/asset buffer는 공통 단조 token으로 owner·종류 혼동을 거부한다. 잘못된 backing storage·변조·초과 응답·중복 반환은 실패한다.
- **논리적 close와 실제 종료:** 새 IO와 pending read를 취소하고 미전달 credit을 반환한다. 반환 실패는 quarantine하며 drain 성공으로 바꾸지 않는다. Index의 내부 credit은 cache 참조를 비운 뒤 반환한다. Caller ByteData와 cache 문자열은 외부로 남을 수 있어 전달 credit을 **Native runtime/Web worker 종료까지** 유지한다. Clear/evict가 caller bytes를 회수했다고 간주하지 않는다. 임의 parser 결과는 caller 관리다. Native의 실제 ledger **0**과 Web의 worker 종료·host 예약 **0**을 별도로 확인한다.
- **Font/cohort·Source:** [FontLoader](Nelyx/src/services/font-loader.ts)·[공개 UI load](Nelyx/src/ui/fonts.ts)는 같은 App namespace를 사용한다. Optional family는 admit 후 캡처한 bytes의 실제 C++ decoder가 읽는다. 기존 family/fallback·순서/1회 hook과 font load **32개/캡처 16 MiB**를 유지한다. App 준비·bounded upload·Core begin·실제 App/Content/Render ACK **7**·활성화·watermark commit·Source 관측·finish를 조정한다. 불확정 ACK와 captured scene은 terminal/마지막 holder까지 producer·binding을 보호한다. Canonical systemFonts/mixin은 View scheduler의 frame coalescing·scope 교체·dispose/close 취소를 유지하며 Native 객체는 TS PipelineOwner에 attach하지 않는다.
- **Compiler·공급·예산:** 프로젝트·기존 runner·API 검사는 실제 **7.0.2**다. Shader/declaration 변환과 원래 inventory의 Microsoft 6 호환 API를 구별한다. Owned **m153-nelyx-paragraph.5 / paragraph 1·Picture 2·font 1**, JS SHA `86238bd83f85e71cb612ea07f51887445bfe226104909380bc86eaed4c73988b`, Wasm SHA `9541ea373dceb0d1dd5af584de1eca921599394953a1afb34ad44fa00e508aa6`를 유지한다. 사용자 허용의 CanvasKit **초기 128 MiB/최대 256 MiB**, App **320 MiB**, ledger **768 MiB/GPU 128 MiB**다. Canonical buffer API를 가져온 앱은 동기 복사를 위해 build 전에 서비스를 준비한다. 서비스 준비는 buildElapsedMs에 포함하고 servicesPreparationElapsedMs도 별도 보고한다. Font catalog **16 MiB/chunk 256 KiB**, packet **1 MiB/resource 32 MiB** 상한은 같다. Vendor binary는 다시 만들지 않았다. Owned build `/home/parti/.cache/nelyx/canvaskit-m153`, dependency `/home/parti/.cache/ozeli/w9-canvaskit-m153`·`--dependency-inputs`를 유지한다.

**ImageProvider·캐시·Core 시계:** [App decoder/IO](Nelyx/sdk/src/runtime/engine-v2-images.ts)를 Source ImageService·ImageProvider/ImageCache·Original Image Widget에 연결했다. Memory·Asset·Resize·Network와 Native FileImage가 같은 immutable buffer/descriptor 소유자를 사용하며 provider byte 캡처도 복사 전에 credit을 확보한다. [Core 시계](Nelyx/runtime/engine-client/app-image-clock.ts)는 실제 Core timestamp와 절대 deadline을 사용하고 frame/timer callback을 각각 **64개**로 제한한다. 새 state는 **744 bytes**, deadline 요청은 f64 초 단위이며 취소·동일 deadline ACK 재시도·숨김/복원은 [Native·두 Wasm 6조건](Nelyx/engine/tests/image-clock-contracts.mjs)으로 확인했다. [일반/기존 설치 Web](Nelyx/engine/tests/image-provider-render-contracts.mjs)은 두 profile 각각 **334명령 = SDK·C++ layout/image paint >0·Content 이미지 7·App geometry/TS fallback 0**이다. 실제 Memory/Asset/Network/resize 픽셀·동일 key 캐시의 동기 clone 공유·GIF 전환/TickerMode 정지·재개·404/손상 bytes 오류 대체·cache eviction·pending HTTP 중 close와 최종 worker 종료/예약 **0**을 확인했다. PNG **131155 bytes**의 중간 **65536 bytes** 진행률도 관찰했다. 제거 뒤 descriptor/Codec/frame/Scene credit은 **0**, public readback은 사용하지 않는다. [Native Hermes control](Nelyx/engine/tests/image-provider-native-contracts.mjs)은 **descriptor 8·Codec 7·decode 9·pixel read 6/48 bytes = SDK·TS fallback 0**, 실제 파일 **1읽기/71 bytes**·HTTP 요청 **7회**·최종 ledger **0**이다. Native의 이 control은 수동 App 시계이며 실제 Core deadline/일반 Web 표시와 구별한다. Native HTTP는 빈 key의 정확한 URL/query를 유지하고 같은 origin의 Authorization/Cookie는 보존하며 교차 origin에서는 제거한다. 기본 Original App은 사용자 build 전에 HTTP header service **2**를 요구하며 오래된 공급의 두 profile 시작 거부도 확인했다. Caller ByteData/readback credit은 realm까지 유지한다. Stream visibility·유한 반복 종료/복구·Canvas와 추가 형식 및 물리/성능 승인은 남는다.

### 검증 결과

| 범위 | 현재 증거와 판정 |
| --- | --- |
| HTTP/NetworkAssetBundle | [Native/Hermes](Nelyx/engine/tests/app-network.test.mjs)의 성공 구간 **16 HTTP 요청(redirect 포함)·89 bytes**를 확인했다. SDK 성공 load **15개(raw 14·buffer 1)**의 전달 **86 + 3 bytes**와 C++ 읽기 완료 bytes가 일치한다. 요청 32개 admission·foreign/종류·재진입 복사·실제 pending body 취소·마지막 callback 회수 뒤 network/buffer credit **0**, caller credit **917762 bytes**는 논리적 close 뒤 유지하고 runtime 종료 뒤 ledger **0**이다. [일반 SDK](Nelyx/engine/tests/original-network-browser.test.mjs)는 두 모델 × 두 profile의 정상/시작 취소 **8경로**, TypeScript 7 strict **8조합**을 통과했다. 정상 경로는 raw **14회/86 bytes**, buffer **1회/3 bytes**, Core **32/17명령 = SDK**, buffer/network credit **0**, caller credit **917762 bytes**, 실제 worker 종료/예약 **0**이다. Web HTTP는 JS transport이며 App paragraph 수요 **0** control이다. 실제 CanvasKit의 24 MiB 사전 quota 거부 뒤 다음 정상 buffer도 확인했다. |
| 이미지 descriptor/Codec | [실제 Native/Web](Nelyx/engine/tests/app-images.test.mjs) **3개**와 [일반 SDK](Nelyx/engine/tests/original-images-browser.test.mjs) 두 모델×두 profile은 public 범위 **descriptor 6·Codec 6·decode 10·pixel read 7/60 bytes = SDK·TS fallback 0**이다. Native 패키지 파일 **1읽기/71 bytes**, Web encoded transport copy **5회/325 bytes**이며 추가 borrowed-frame control·foreign/종류·quota도 통과했다. Caller pixel ByteData **7개/credit 458932 bytes**만 realm 종료까지 유지하고 불변 backing·descriptor/Codec/Image/read holder는 마지막 해제 뒤 **0**, 실제 Native runtime 뒤 ledger **0**이다. 일반 Core **32/17명령 = SDK**, 두 profile의 실제 worker 종료/예약 **0**. PNG·GIF duration/반복·RGBA/BGRA·resize·clone·행 padding·decoder/target/옵션 getter 실패를 확인했다. Frame 목록 sidecar는 자원 수명에 Paint/Path를 끌어오지 않고 실제 import edge는 사용자 private owner 우회를 거부한다. Scene/RenderImage/Canvas/provider·stream frame clock·float/추가 readback은 미완료이며 decoder control을 표시/성능 증거로 쓰지 않는다. |
| 큰 encoded 이미지 | [청크 계약](Nelyx/runtime/engine-client/image-resource.ts)·[Core 수명 검사](Nelyx/engine/tests/image-resource-contracts.mjs): Native·두 Wasm **15조건**, packet **1 MiB**·resource **32 MiB**·chunk **256 KiB**를 유지한다. 전체 upload 전 bind 거부·변경/부분 재전송·quota 선확보·중단/close·frame별 이전 backing·slot generation·chunk ACK 2회 유실·desired tree 교체를 확인했다. [실제 표시 검사](Nelyx/engine/tests/image-resource-render-contracts.mjs): **1,229,560 bytes PNG 2장/3상태**, 일반 SDK와 기존 설치 Web의 두 profile 각각 **33명령 = SDK·C++ layout 19·Content 이미지 기록 2·App geometry/TS fallback 0**, 실제 pixel 교체와 worker 종료/예약 **0**이다. 별도 Native Content CPU는 **측정 2·이미지 2·Picture 2**, producer backing 소멸 뒤 이전 Picture의 실제 픽셀과 최종 ledger **0**이다. Canonical RawImage/RenderImage는 별도 Scene 계약으로 연결했다. ImageProvider/Canvas·frame clock 연결과 물리/display/성능 승인은 미완료다. |
| 불변 buffer | [실제 Native/Web](Nelyx/engine/tests/app-buffers-probe.mjs): Native **10캡처/33554447 bytes·8 readback/21 bytes·파일 4회/9 bytes**, Web **8할당/25165836 bytes·7 SDK readback/18 bytes**. SDK 집계 일치·quota admit **4/3 × 8 MiB**, 마지막 holder 뒤 buffer credit **0**. 중간 read의 할당·credit과 admission/close 거부도 확인했다. [일반 SDK](Nelyx/engine/tests/original-buffers-browser.test.mjs) 두 모델×두 profile은 각각 **5캡처/12 bytes**, Core **32/17명령 = SDK**, 초기 credit **65542→0**·raw caller credit **65545**·최종 worker 종료/예약 **0**. App paragraph 수요 0인 control이며 Web 복사를 C++ 질의/성능으로 바꾸지 않는다. |
| 서비스 bootstrap | [일반 SDK](Nelyx/engine/tests/app-bootstrap-browser.test.mjs)의 두 모델·두 profile **28조건**: quota 대기·두 manifest·모듈·Wasm·폰트 중 취소, 공급 실패 시 sibling 중단, 이전 계약 거부, 늦은 실제 Wasm **128 MiB** 초기화. 완료 전 app-disposed 금지·최종 worker 종료/예약 **0**. [단위 검사](Nelyx/engine/tests/app-bootstrap.test.mjs) **2/2**는 staging 반환 순서·실패 뒤 heap credit 보존을 확인한다. 렌더 수요 없는 lifecycle control을 조판·성능 증거로 쓰지 않는다. |
| Canonical RawImage 표시·수명 | [일반/설치 SDK](Nelyx/engine/tests/raw-image-render-contracts.mjs)의 두 profile 각각 **574명령 = SDK·C++ layout 376·이미지 배치 148·Content 이미지 기록 24**, 12배치/프레임 2개/opacity·반전·repeat·nine-patch·박스 밖 픽셀. Snapshot **2개/524288 pixel bytes**, public readback **0**·제거 뒤 frame/Scene credit **0**·최종 worker 종료/예약 **0**. [Core 배치](Nelyx/engine/tests/image-style-contracts.mjs) **6조건**과 [Original ACK 수명](Nelyx/engine/tests/original-image-contracts.mjs) **9조건**은 세 경로에서 통과했다. Native CPU Raw 스타일 **8개**·Picture 마지막 참조까지 backing 보유·최종 ledger **0**. 실제 Native/Web App 캡처 실패·clone 공유·foreign/크기 거부·Source frame보다 긴 Scene 수명도 확인했다. ImageProvider/frame clock/Canvas는 미완료다. |
| ImageProvider·Core 시계 | Native·두 Wasm deadline/ACK/숨김·취소 **6조건**. 일반/설치 Web 두 profile은 각각 **334명령 = SDK·실제 C++ layout/image paint·Content 이미지 7·App geometry/TS fallback 0**, PNG **131155 bytes/중간 진행 65536**·Memory/Asset/Network/Resize·GIF TickerMode·동기 cache hit/evict·오류 대체·pending read close·Scene/worker 예약 **0**. Native 별도 decoder/IO control은 **8 descriptor·7 Codec·9 decode·6/48 pixel read = SDK**, 파일 **1/71**·HTTP **7**·마지막 ledger **0**. App 수동 clock과 실제 Core/표시 증거를 구별한다. |
| Core·Source·도구 | Core **419/419**, 통합 **53/53**, Source·수명·편집기·캐시·Frame **108/108**, compiler/API/supply·boundary **32/32**. Asset/cache **9개**·실제 HTTP stream/quota **1개**·ImmutableBuffer **3개**·FontLoader/UI **6개**·Native font 알림 **2개**를 포함한다. Workspace·CLI/Metro·lint·format **2006파일**, 경계 **1012파일·551 facade·7914 edge·cycle 8/design 0**, 디자인 소유권 PASS-scoped. |
| 실제 Native asset IO | [Hermes/C++ 검사](Nelyx/engine/tests/app-assets-probe.mjs)의 **7읽기·52 bytes = SDK**. UTF-8/공백·빈 파일·string/structured cache·fresh binary·실패·foreign/종류/중복 credit을 확인했다. 논리적 close 뒤 caller bytes와 **buffer 7개/458908 bytes**를 보유하고 실제 runtime 종료 뒤 ledger **0**이다. 내장 image alias도 같은 C++ credit 경로를 사용한다. 이 IO control은 App text layout 수요 **0**이며 조판 성능을 주장하지 않는다. |
| 일반 SDK root/HTTP | [실제 앱](Nelyx/engine/tests/original-assets-browser.test.mjs) **두 모델 × 두 profile + startup cancel 두 profile**. Original 각 **65명령 = SDK·9읽기/113450 bytes·credit 930174 bytes**, data 각 **17명령 = SDK·8읽기/810 bytes·전달 credit 526718 bytes**. HEAD/hash header 없는 경로는 index **3211264 bytes**를 별도 admit·close 때 반환한다. Default/inherited bundle·Nx·원래 cache·변조/초과·실행/시작 중 취소를 검증했다. 모든 실제 종료는 **worker 종료/예약 0**이다. |
| Source font·recording | 일반 SDK 두 profile × 9상태는 각 **167명령 = SDK·Core layout 596·App 19/0 = SDK·Content 조판 21**, App/Content decode **64/53**·capture **24**·Source 알림 **12**·TS fallback **0**. Family 측정 **131.776260/65.888123**, UI alias/intrinsic도 대응한다. Asset **9개/1013760 bytes·credit 3631104 bytes**는 actor 종료까지 유지한다. 예전 recording 픽셀·fallback·교체/reset/cancel/recover를 보존한다. |
| Source fault·전환 | [세 독립 heap](Nelyx/engine/tests/original-fonts.test.mjs) **227명령 = SDK·Core layout 448·App 16/0 = SDK·Content 조판 22·capture 57·Source 알림 11·pixel 차이 0**. Commit/document ACK·inspect/abort 유실·quota·caller 변경·queue·준비/대기 중 close와 해제된 Canvas 뒤 scene을 확인했다. 최종 binding/retiring·font credit/queue **0**이며 불확정 결과를 임의 회수하지 않는다. |
| App/Content/Render·입력 회귀 | 실제 App text/font **4/4**, Native/Web layout/query = SDK·TS fallback **0**. Font-only credit quota **20/4 × 16 MiB**와 세대 quota **27/7**, foreign/retired cohort·rollback·Picture/font-reference pixel·rich/inline·Material·layer·live/ordered paint·worker actor 회귀를 유지했다. Geometry **2/2·7/7**, Mixed **12 editor**·activation failure도 통과했다. |
| 전체 API | **inputValid=true / compatible=false**, strict exit **1**, 오류 목록 없음. 원래 **4 package/834 subpath·hash 16개**를 보존한다. 현재 **847/4629 occurrence**, Windows **813/34·4499/130**, Web **799/48·4442/187**, compiler **7.0.2**·NodeNext·types=[]·skipLibCheck=false·target 오류 **0**·등록 data **5/5**·Core v2 symbols **195**이다. Scoped asset/font 동작을 전체 API 승인으로 바꾸지 않는다. `loadBuffer` 추가 두 건은 원래 클래스의 모든 멤버를 고정 선언으로 대조한 뒤에도 **signatureChanged / structuralCompatibility=notApproved**로 남긴다. 원래 hash/분모를 바꾸지 않으며 기존 멤버 수정·삭제는 여전히 입력 실패다. 현재 동작 검사가 기존 구조적 타입 호환성을 승인하지 않는다. |
| 기존 설치 소비 | 기존 Windows/Web 설치본에서 각 Windows/Web target **847개** strict 입력·실제 compiler **7.0.2**·Root/PlatformAssetBundle·NetworkAssetBundle·ImmutableBuffer·ImageDescriptor/Codec·FontLoader/UI·App service **12** 타입·README FontLoader/assetByteLength/remoteAssetByteLength/firstImagePixels 예제·CLI build/verify를 통과했다. Core **687 module/2748 dist 파일**, SDK **123/492**, Material **259/1036**, Cupertino **64/256**, SDK native **63**·CLI **75**·Metro **34**·owned Web runtime **6**·Core/SDK EN/KO README의 exact set/hash/source-map 입력이 일치한다. 설치 Web 두 profile은 각각 **1067명령 = SDK·App 8/0 = SDK·Content 조판 17**, asset **4읽기/337923 bytes·credit 1275913 bytes**, buffer **13캡처/113208 bytes = SDK·asset buffer 읽기 2회/112643 bytes·최종 handle/credit 0**, 이미지 **descriptor/Codec 각 6·decode 10·pixel read 7/60 bytes = SDK·credit 458932 bytes·최종 이미지 handle 0**, network raw/buffer 각각 **1읽기/3 bytes·network credit 0**, font credit/queue **0**·실제 close 예약 **0/worker 종료**다. 세 기존 runner의 일반 check도 통과했다. Native 창/물리 검증과 구별한다. |
| 정리 | Windows **9개**·Web **8개**의 현재 archive·기존 설치본을 갱신했다. Android runtime은 DEFERRED이며 기존 공통 CLI·현재 archive **9개**를 유지한다. Source/manifest **349파일**(manifest 포함 350) 전체 hash/exact set이 일치하고 Engine/package cache·소유 임시 폴더·dist staging/previous·Native host는 **0**이다. 독립 소비자 설치·profile·로그를 누적하지 않았다. |

### 다음 실행 순서

1. **Image/Asset API:** 연결한 ImageProvider/ImageCache·실제 Core deadline 위에 stream visibility·유한 반복 종료·실패/취소/close·복구의 나머지 조건과 Canvas/Picture 이미지 명령·추가 형식을 진행한다. Floating-point raw/target·PNG/straight-alpha readback도 남는다. Caller ByteData와 Scene credit을 구별하며 부분 표시 지원을 전체 이미지/AssetBundle 완료로 바꾸지 않는다.
2. **OS font:** 실제 Native/Web 변경 알림·provider 준비·cohort commit·Source 무효화와 decode 실패/rollback/close를 이어서 검증한다. 기존 family/fallback·이전 recording과 physical gate를 유지한다.
3. **Text/API·디자인/입력:** 추가 text 스타일·interactive/selectable span·나머지 동기 RenderBox geometry·표시기/custom shape·recognizer/team·layer/SceneBuilder·annotation/raster·Canvas/Picture/custom hook·raw/character/IME/keyboard·focus/reader·semantics/cursor/service·가변 list·restoration/physics·필수 animated/외부 콘텐츠·상태 보존 reload/loss/OS low-memory 복구.
4. **최종 gate:** loadBuffer 추가의 기존 구조적 타입 변경 두 건을 해결하고, 원래 전체 API·설치 소비와 Windows/Web **W9-13 기술 완료** 뒤 **W9-14 대상/profile별 물리·성능·기본값 판정**을 진행한다. 기존 host/v1 제거와 후속 플랫폼 착수를 앞당기지 않는다.

**재개 확인:** source/manifest/hash·기존 설치본 identity를 확인하고 필요할 때만 `npm.cmd run build:engine-v2`로 갱신한다. Asset/font·App/worker 수명은 `npm.cmd run test:engine-v2:app-text`, 전체 Core는 `npm.cmd run test:engine-v2`, API는 `npm.cmd run audit:engine-v2:api`를 따른다. Strict exit 1은 compatible=false와 함께 보존한다. Geometry 변경은 두 지정 suite를 실행한다.

**Native UI 경계:** 물리 Escape로 중단한 Computer Use는 재개하지 않았다. UIA `E_UNEXPECTED`는 미해결이며 실제 Native font 전환 창·표시·입력·외부 reader·물리 IME/precision trackpad·display/scanout은 **notVerified**다. 강제 종료를 정상 drain으로 바꾸지 않는다.

목표는 **IN_PROGRESS / PARTIAL**이다. W9-06/07/08/13/14는 미완료이며 performanceAccepted=false·resizePerformanceAccepted=false, Android/Linux·iOS/macOS **DEFERRED**를 유지한다.
