# work9-3 — 3부: 구현 순서·통합 검증·공급

작성: **2026-11-05 KST** · 갱신: **2026-11-06 KST** · 상태: **PAUSED / Windows·Web 1차 중간 정리 / PARTIAL**

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

| 순서 | 실행 묶음 | 다음 묶음으로 넘어갈 기준 |
| --- | --- | --- |
| 1 | **W9-00 → W9-06-A**: 현재 공급·API 입력·동기 실행 모델 | 현재 Windows/Web 기준선과 두 target의 유효한 API 검사 입력 확보. [§8.1](work9-2.md#81-검사-환경과-실행-모델의-선행-판정)의 원래 consumer로 보존 가능·명시 경계 필요·미해결을 구분. 통과한 계약만 다음 API 이식의 근거로 삼고 미해결 의무·의존 기능은 미완료로 유지 |
| 2 | **W9-01 → W9-02-A/B**: 최소 공통 경계와 Windows/Web 실행 | 같은 작은 일반 앱이 App SDK host·Web threaded·single-worker에서 실제 C++ 작업·화면·입력·resize·close를 수행. **W9-09-A/10-A**의 기본 예산·clock/시간 계측, **W9-13의 초기 설치·배포 검사**도 이때 연결 |
| 3 | **W9-06-B·W9-05 → W9-07**: 원래 API·그래픽·interaction | Widget 수명·기본 render 연결부터 시작해 각 기능에 필요한 paint/text를 보강하고 layout·gesture·scroll·editing·semantics·list까지 같은 consumer/corpus로 확장. 전체 W9-05 완료를 기다려 Widget 수명부터 막지 않음 |
| 4 | **W9-08**: 두 TypeScript 디자인·SDK 사용 흐름 | Windows와 두 Web profile에서 원래 TypeScript Widget/State·import·theme·form·overlay·navigation·localization/service 동작과 C++ engine 사용을 함께 검증. 컴포넌트의 C++ 재구현을 완료 조건으로 두지 않으며 미연결 API 의무는 계속 추적 |
| 5 | **W9-09-B/10-B·W9-11-A**: 재사용·pressure·frame·필수 콘텐츠 통합 | 재사용 전후 pixel/geometry와 실제 작업 수·단계 시간 대조. 필수 animated/texture/platform view는 W9-09-A와 해당 기능 준비 후 먼저 구현할 수 있으며 이 묶음에서 수명·기능을 최종 통합. 추가 raster cache/damage는 측정 근거가 있을 때만 적용 |
| 6 | **W9-12-A**: Windows/Web reload·복구 통합 | 최소 host 연결 뒤부터 개발하고 이때 기능 전체와 통합. 준비 실패·교체·context/device loss·새 session 정책·close/late callback·자원 회수 확인 |
| 7 | **W9-13 → W9-14**: Windows/Web 최종 통합·제품 수락 | 해당 target의 API/동작·전체 설치 조합·두 profile·공급/실행/종료 검증 후 실제 입력·frame/resize 성능과 기본값 전환을 대상별 판정 |

각 묶음에서 같은 공급의 작은 일반 앱과 관련 Testbed 흐름을 확인한다. API·자원·설치 검사는 마지막에 처음 실행하는 검사가 아니라 초기 연결부터 넓혀 가는 검사다. 물리 입력과 사용감도 실행 가능한 묶음에서 조기에 확인하되 최종 제품 수락은 W9-14에서 별도로 판정한다.

### 12.3 단계별 범위와 완료 조건

| ID | 차수·작업 | 선행·완료 조건 |
| --- | --- | --- |
| W9-00 | **1차** 기준선·공급·API 판정 입력 | 현재 diff/source/dist·원래 공개 표면·Windows/Web의 OS/ABI/toolchain/browser·배포/manifest/capability·corpus 확인. [§4.1](work9-1.md#41-windows-rnw-소스-선별-재사용) RNW 후보의 필요 사례·도입/참고 범위·출처/의존성 고정. 현재 공급으로 필요한 core/host/runner 기준선을 확인한 뒤 [§8.1](work9-2.md#81-검사-환경과-실행-모델의-선행-판정)의 실제 consumer 환경으로 검사 입력을 정상화하고 원래 표면의 target별 대응 합계 확인. `inputValid=true` 확보와 실제 호환 잔여 목록을 분리. 모바일 원본 고정·GTK/Apple 환경은 후속 |
| W9-06 | **1차 A** 실행 모델 검증 → **B** 원래 TypeScript Widget/Element/Render API 연결 | A는 W9-00 후 State/Key/context·동기 controller/custom hook의 보존 의미와 실행 owner를 원래 consumer로 확인. B는 원래 TypeScript 구현을 유지하며 W9-01/02·필요한 W9-05와 수명·parent data·NACK/예외·재진입을 연결. 미해결 의무는 미완료. C++ Widget 사본·adapter의 대체 State·UI/Content의 App 동기 대기·숨은 fallback으로 통과시키지 않음 |
| W9-01 | **1차** 최소 embedder·runtime/provider 경계 | W9-00와 W9-06-A의 설계 결과. Windows/Web의 owner·mailbox·provider·입력/mirror·generation·close와 선택한 RNW OS handler만 최소 분리. TypeScript 디자인 → framework/adapter → C++ engine의 의존 방향 유지. 새 Windows 경로의 RN 앱 객체 의존성을 제거하고 ACK/NACK·snapshot/ledger·오류/cleanup 회귀 유지. 모바일 helper 추출이나 후속 OS 구현을 요구하지 않음 |
| W9-02 | **1차 A** Windows App SDK·**B** Web 수직 연결 | W9-01. A는 실제 AppWindow/dispatcher·Vulkan scene·TSF/UIA·DPI/resize·hide/restore·drain·unpackaged 소비 실행. B는 Chrome·Edge의 두 profile·DOM/ARIA·DPR/resize·실패/close corpus. 작은 공통 앱부터 시작하고 실제 C++ 작업과 host identity 확인 |
| W9-05 | **1차** Canvas/Paint·rich text/font | W9-01과 W9-06-A. 작은 scene의 protocol/provider부터 확장하고 Windows/Web에서 같은 API·pixel·UTF-16/RTL/placeholder/query·invalidation corpus 실행. W9-06-B/07에 필요한 항목부터 연결해 전체 표현력과 자원 거부/회수까지 완성 |
| W9-07 | **1차** Layout·scroll/gesture·editing·semantics·list | W9-06-B 및 해당 기능의 W9-05, 실제 peer는 W9-02. Intrinsic/dry/baseline·invalidation·motion·lazy focus·range/action·동기 controller 의미를 공통 core와 Windows UIA/TSF·Web DOM/ARIA에서 확인. GTK/AppKit/모바일 peer는 후속 |
| W9-08 | **1차** TypeScript Material/Cupertino·SDK API의 engine 연결 | W9-06-B/07 및 필요한 W9-05. [2부 §8.2](work9-2.md#82-디자인-패키지의-typescript-구현-유지)에 따라 원래 TypeScript constructor/State/default/theme/icon/form/route/overlay·localization과 callback/controller를 유지. 공통 engine 연산·SDK service/platform API를 Windows/Web에 연결. 설치본의 원래 구현 실행·controlled 값/NACK·스타일 변경·package 경계와 C++ 실제 작업을 검증. C++ 컴포넌트 사본이나 API 분모 축소로 통과시키지 않음 |
| W9-10 | **1차 A** clock·관측 → **B** 전체 frame 일정 | A는 W9-02의 각 host 최소 실행과 함께 clock 단위/기준·ID 대응·단일 frame 수요/credit·input wake·idle·숨김/복귀·build/content/raster/submit 시간 관측. B는 기능 확장 후 연속 입력 watermark·연속 document 갱신·App/Content 지연 중 준비 scene 진행과 App animation의 한계를 통합 검증. GTK/AppKit clock은 해당 후속 host에서 연결 |
| W9-09 | **1차 A** 기본 예산/hold → **B** preparation 재사용·pressure | A는 W9-01/02부터 신규 자원·실패/교체/close를 ledger에 연결. B는 W9-05와 W9-10-A 후 실제 병목을 기준으로 Picture/paragraph/image 재사용·무효화·pressure 회복과 재기록/shaping/decode 수 감소 확인. RSS/VRAM 측정 한계 명시 |
| W9-11 | **1차 A** 원래 API의 animated/외부 콘텐츠·**추가 B** cache/damage | A는 필요한 W9-05/07와 W9-09-A/10-A 후 Windows/Web의 API별 필수 기능·texture/platform view 입력/semantics·수명 검증. W9-09-B 전체를 기다리지 않으며 최종 통합에서 재사용과 대조. 요구 기능 미지원은 호환 gate 실패. B는 W9-09-B/10-B 측정 근거가 있을 때 적용하고 full redraw pixel·무효화·회수 대조; 근거가 없으면 추가 최적화 보류로 기록 |
| W9-12 | **1차 A** Windows/Web reload·복구 / **2차 B(Android)** / **3차 B(iOS)** | A는 W9-01/02 후 시작, bundle 준비 실패·세대 교체·device/context loss·재생성/새 session·close를 기능 확장과 통합. B는 [§11](work9-2.md#11-web모바일에서-유지할-범위) M0/M1/M2의 RN 소스 분리·standalone 입력/편집/semantics·surface/clock·reload/복구·설치/drain을 대상별 수행. Android는 Windows/Web 1차 완료 후 4부에서, iOS는 Android/Linux 2차 완료 후 5부에서 진행. M3 Web helper는 A/07에서 독립 수행 |
| W9-13 | **대상별** 전체 API·host 통합·배포 | 초기 Windows/Web 설치 검사는 W9-02부터. 1차 최종 판정은 W9-05/06-B/07/08/09/10/11-A/12-A와 W9-02의 전체 corpus, 원래 scope·동작·installed compiler/CLI·두 TypeScript 디자인 패키지의 실제 구현과 engine 의존 경계·전체 package 조합·출처/identity·손상 거부/정리를 요구. 디자인 패키지 내 native Widget 구현/target·엔진 binary를 추가하지 않음. W9-03/04/12-B는 1차 선행 조건에서 제외 |
| W9-14 | **대상별** 물리 입력·성능·기본값 전환 | W9-13을 통과한 대상부터 평소 명령·실제 사용자 입력·동일 측정 조건으로 판정. Windows/Web의 결과와 profile별 한계를 기록하고 후속 플랫폼의 flag를 올리지 않음. V1 정리는 해당 제품 gate 후 사용 경로·제거 목록을 확인하는 별도 단계 |
| W9-03 | **2차 / 4부 / DEFERRED** GTK4 수직 연결 | Windows/Web W9-13 기술 완료 후 Android와 같은 차수로 W9-01의 계약을 사용해 Linux 공급을 고정. GTK 4.22 이상·DMA-BUF capability/동기화/FD·게시/geometry·IM/AT-SPI의 caret/selection 변경·Wayland/X11·일반 앱/reload/loss/drain. Prototype 실패면 Linux gate 미완료 |
| W9-04 | **3차 / 후속 5부 / DEFERRED** AppKit 수직 연결 | Android/Linux W9-13 기술 완료 후 iOS와 같은 차수로 W9-01의 계약을 사용해 Apple 공급을 고정. AppKit/Metal·point/pixel·marked text·NSAccessibility·display/resize·.app 공급/reload/loss/drain을 실제 macOS에서 검증 |

Windows/Web 1차 이후 **2차는 W9-12-B(Android)·W9-03**, 그다음 **3차는 W9-12-B(iOS)·W9-04**로 진행한다. 각 차수의 API·host·공급 통합 완료 뒤 다음 차수에 착수하고, 물리 입력·성능 수락은 W9-14에서 대상별로 구분한다. 해당 host의 W9-05–11 corpus와 W9-13/14를 다시 연결한다. **후속 host에 Windows/Web의 통과를 그대로 복사하지 않는다.** Windows/Web 1차 기술 완료는 해당 API·host·공급 gate의 통과이며 전체 플랫폼 완료나 물리·성능 수락을 뜻하지 않는다.

### 12.4 실행 체크리스트

- [x] W9-00: 현재 Windows/Web 기준선·고정 공급·원래 API 검사 입력 정상화, RNW 후보의 필요 사례·출처/의존성 고정. 전체 동작 호환과 후속 기능 회귀는 아래 미완료 단계로 유지.
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

| 판정 | 완료 의미와 상태 기록 |
| --- | --- |
| API 검사 입력 유효 | W9-00의 `inputValid=true`. 아직 동작 호환이나 W9-06/13 완료를 뜻하지 않음 |
| 대상별 기술 완료 | 해당 차수에 적용되는 W9-01/02 또는 W9-03/04/12-B, W9-05–10·11-A·복구/공급과 W9-13의 API/host/설치 gate 통과. 미해결 공통 API를 비적용으로 빼지 않음. 선택적 W9-11-B는 근거 있는 보류가 가능 |
| 물리 입력·성능 수락 | W9-14에서 실제 대상/profile·입력 source·장면별로 판정. `performanceAccepted`·`resizePerformanceAccepted`와 IME/reader/trackpad·표시 관측을 따로 기록. 기술 완료만으로 false/notVerified를 올리지 않음 |
| 제품 기본값·기존 경로 정리 | 해당 대상의 W9-13과 W9-14 제품 gate 이후에만 기본값 전환. 기존 host/v1 제거는 사용 경로·제거 목록 확인 후 별도 수행. 다른 플랫폼의 기본값·미완료 상태를 함께 바꾸지 않음 |

W9-12의 A·B(Android)·B(iOS)와 W9-13/14의 상태는 대상별로 유지한다. Windows/Web 완료만으로 W9-12 전체나 전체 플랫폼을 체크하지 않으며, **전체 기술 완료와 전체 제품 수락도 각각** 모든 계획 대상의 해당 gate가 통과해야 한다. 필수 corpus를 실행할 환경이 없으면 미검증/DEFERRED 또는 해당 작업의 차단 사유를 남기고 성공으로 간주하지 않는다.

모든 차수의 기술 gate는 같은 TypeScript 디자인 구현이 해당 C++ engine/host에서 동작하는지를 판정한다. C++ 컴포넌트로 바꾼 화면이나 OS 기본 control만으로 두 패키지의 API/State/theme 호환을 통과시키지 않는다. 후속 플랫폼에서 필요한 변경은 공통 engine/provider·OS adapter와 명시적인 TypeScript 플랫폼 분기에 반영한다.

## 13. 검증과 판정

**1차 판정은 Windows와 Web 두 profile을 대상으로 한다.** 아래 판정은 현재 구현 기록이며 제품 물리·성능 gate의 통과와 구분한다. 원래 공개 API 의무의 target별 적용표를 보존하고 Windows/Web의 통과와 후속 플랫폼 미검증을 별도 기록한다.

| Gate | 차수·통과에 필요한 증거 | 현재 판정 |
| --- | --- | --- |
| 원래 공개 표면·동작 | **1차 Windows/Web**, 후속 대상은 별도. 원래 scope·overload/member/protected/non-code·target별 선언 해석과 installed runtime 동작. 입력·표면·동작을 각각 판정 | **inputValid=true / compatible=false**. 두 target 진단 0·원래 분모/hash 보존. 명시적 부분 bridge의 canonical Element/State→C++ 연결 통과. 전체 Widget·controller·custom hook·동기 geometry 미완료 |
| 디자인 구현 경계 | **모든 차수** 두 패키지의 TypeScript Widget/State/theme·callback/controller 실행, 공통 C++ 연산과 package/build/link 경계. [§8.2](work9-2.md#82-디자인-패키지의-typescript-구현-유지)의 스타일 변경·controlled update/NACK·dispose 사례 | **계획 고정 / 구현 검증 미완료**. 기존 partial paint/control helper도 디자인 정책을 복제하지 않는지 재검토. 이번 문서 변경으로 runtime PASS를 추가하지 않음 |
| Windows App SDK | **1차** 실제 App SDK 창/dispatcher·Skia 실행·TSF/UIA·입력/resize/종료·배포 identity | **구현 구간 PASS / 전체 PARTIAL**. AppWindow/dispatcher·Vulkan·자동 TSF/UIA·resize/hide/restore·앱 로컬 배포 통과. 원래 API·물리 입력·최종 통합 별도 |
| Web | **1차** Windows Chrome·Edge의 두 profile·같은 기능 corpus·비격리 auto·강제 요구/공급 실패·DPR/숨김·재생성/close | **구현 구간 PASS / 전체 PARTIAL**. 실제 Chrome/Edge headful 두 profile의 기존 corpus·실패/close matrix 통과. 원래 API·전체 기능 통합은 미완료 |
| 그래픽·메모리·clock·복구 | **1차 Windows/Web**의 provider 공통 corpus·실제 작업 수·무효화/pressure·bounded hold·clock/credit·단계 시간·reload/loss/close | **PARTIAL**. 기존 공통 구간과 publication race 수정 통과. 일반 앱 generation reload 통합 중이며 display clock·추가 graphics/reuse/pressure·복구 의무 유지 |
| 제품 물리·성능 | **1차 Windows/Web**, 후속 대상은 별도. 관측된 장면/입력 source의 실제 조작과 같은 조건의 이동/resize·frame/메모리 측정 | **notVerified**, 두 acceptance flag **false** |
| GTK4 | **2차 / 4부** Wayland/X11 각각 GPU import·게시/geometry·IM/AT-SPI·회수/소비자 실행 | **DEFERRED / 미착수 / notVerified** |
| AppKit | **3차 / 후속 5부** macOS의 AppKit/Metal·IME/NSAccessibility·display/resize·회수/.app 공급 | **DEFERRED / 미착수 / notVerified** |
| Android | **2차 / 4부** arm64-v8a standalone host·[§11.4](work9-4.md#114-android--기존-nelyx-os-코드를-먼저-분리)와 공통 입력/mirror/semantics corpus·surface 수명·설치/실행·drain | **DEFERRED / 소스 검토 / 구현 미착수 / notVerified** |
| iOS | **3차 / 후속 5부** 지정 ABI의 UIKit host·[§11.5](work9-5.md#115-ios--uikit-입력-endpoint와-rn-예외-처리-이식)와 공통 입력/mirror/semantics corpus·scene 수명·설치/실행·drain | **DEFERRED / 소스 검토 / 구현 미착수 / notVerified** |
| RN/RNW 소스 분리·도입 | **1차 Windows RNW·필요한 Web helper**, 모바일은 후속. 고정한 출처·의존성·native/link/bundle graph, RN 앱 runtime 없이 실제 실행. 기존 구현으로 해결한 범위와 실제 도입을 구분 | **Nelyx OS helper 실행 / RNW는 참고만**. DirectManipulation callback·고정 source hash·standalone link 확인. 물리 trackpad 관측은 0/notVerified. 모바일 DEFERRED, Web 기존 host 유지 |

1차 Windows와 Web threaded는 App/Content 50/100/200 ms 지연 중 준비 scene의 입력/합성·게시 진행을 확인한다. Web single-worker는 App 독립·Content 유한 분할/동기 점유 후 회복을 따로 판정한다. 무한 동기 작업·lost wake·무제한 queue·scene 역전·미회수 terminal은 어느 profile에서도 허용하지 않는다.

실행 경로는 SDK ACK 명령/transaction·App geometry·거부/fallback 이유와 실제 C++ layout/text/paint/compose 작업을 대조한다. `observed=false`, 작업 0·관측 누락, 수요 없는 control을 성공 수치로 바꾸지 않는다. Build graph나 패키지 이름만으로 C++ 경로의 실행/성능을 인정하지 않는다.

원래 TypeScript 디자인의 build·theme 해석·State/controller·callback·paint 명령 구성은 정상적인 App 작업이다. 이를 TS renderer fallback에 합산하거나 `fallbacks=0`을 위해 C++로 옮기지 않는다. C++ engine 연산의 실제 실행과 원래 TypeScript 동작의 보존을 각각 계측/검증하며, 최종 layout/hit-test/raster를 우회하는 숨은 TS 경로에는 기존 거부 정책을 적용한다.

제품 평가는 사용자의 평소 명령과 Gallery 양 열 전체 구간·Mixed 편집 복귀·ListView/Cupertino를 사용한다. 정지→시작→10초 이상 연속→반전→관성→재접촉·resize를 포함하고 물리 precision trackpad와 주입 wheel을 구분한다. 기준/후보 **3쌍**을 기본으로 하고 대부분의 검증은 **30회 이내**로 제한한다. Warm 일반 이동의 60fps 기준·lazy 준비 중 일시 jitter와 준비 뒤 지속 정지를 구분한다. [기존 제품 평가 조건](history/26/11/04/work8-3-summary.md#173-후속-제품-성능-비교--백엔드-완료와-별도-평가)

같은 장면·현재 공급을 Windows App SDK와 실제 Web browser에 연결해 비교하고 주사율·DPI·해상도는 바꾸지 않는다. Web 결과에는 browser·GPU·profile·격리 여부·tab 가시성을 포함한다. Single-worker의 Content 점유 한계와 입력 보존/회복을 threaded와 구별하며 profile 간 동일 성능을 전제하지 않는다.

비교 시작 전에 평소 실행 명령·Release/optimized/VM cohort·창 크기·콘텐츠/physics·예열/coverage·입력 구간과 관측 방법을 고정한다. 실제 이동 상태가 바뀐 surface frame의 수·간격과 p95/p99/max 지연·지속 정지·CPU/GPU·ledger/process 관측을 구별한다. 같은 화면의 반복 submit은 이동 FPS로 세지 않으며 빌드·다른 성능 검사를 동시에 돌리지 않는다. 미수락 구간과 물리 입력 결과를 평균 수치로 덮지 않는다.

Surface 갱신·GPU 완료·host publication·물리 display/scanout은 각각 기록한다. 관측하지 않은 scanout은 `unobserved`다. 실제 일반 사용의 체감 수락은 관측된 범위로 판정할 수 있으며 모든 내부 시각을 알아야만 사용자 수락을 기록할 수 있는 것은 아니다.

### 변경 범위별 필수 회귀

아래 사례를 관련 단계의 기존 suite에 연결하거나 새 host/adapter 검사로 추가한다. 현재 존재하는 suite가 새 host를 이미 검증한다고 보고하지 않는다.

| 변경 범위 | 필요한 성공·실패 사례 |
| --- | --- |
| API 입력·실행 경계 W9-00/06 | Target별 실제 설치 import·overload/member/protected/non-code 대응, 잘못된 export condition·누락·해석 실패·표면 축소의 거부. 동기 getter/setter/listener·재진입·NACK와 실제 C++ 작업 대조 |
| TypeScript 디자인 W9-06/08/13 | 원래 Widget/State/theme·사용자 callback/controller가 실제 실행되고 engine 이벤트와 중복 상태 변경을 만들지 않음. Controlled update 거부·NACK·disable/cancel·dispose 순서와 원래 확장 지점 확인. 기존 capability 안의 theme/스타일 변경은 C++ 디자인 코드 수정 없이 반영. 두 패키지에 native Widget 소스/target·엔진 binary가 없고 공통 engine이 디자인 구현을 역으로 포함하지 않는지 확인 |
| 공통 wire·owner W9-01/05/07 | 세 실행 경로의 schema/capability 불일치·유실 ACK/재시도·준비 실패/자원 회수. 입력·App 이벤트 포화·연속 document 변경·다중 view에서도 bounded 상태와 frame/terminal 진행 |
| App SDK W9-02-A | 개발 runtime 없는 앱 로컬 배포·필수 파일 손상/누락의 거부, AppWindow/dispatcher 실제 실행·DPI·TSF/UIA·live resize/최소화·마지막 창 닫기·시작 도중 종료. 기존 HWND host는 별도 control |
| Web W9-02-B/07/12-A | Chrome·Edge의 두 profile, 격리 환경의 forced single-worker·비격리 강제 threaded 실패, 잘못된 worker/Wasm·권한 거부, base URL/배포 자원, context loss·새 canvas 재시작·reload/close와 late event 차단 |
| Provider·복구 W9-09–12 | Retained/full redraw pixel·text/clip/hit/semantics, 자원 무효화·예산 거부·pressure·detach/restore·device/context loss·dispose 무응답·close 중 reload. GPU/OS consumer hold·pending·callback이 회수되고 다음 정상 scene이 진행 |

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

**2026-11-06 KST / PAUSED / Windows·Web 1차 PARTIAL.** 사용자의 “일단 중간 마무리” 요청으로 작업을 중단했다. 자동 재개하지 않는다. 현재 source/dist는 **`95fdfa430d85c605c84bb12435f886ee600f1405e48609b4d2a4c641f7ba9a2f`**, ABI **2**, schema **2901560100**으로 일치한다. Switch 연결을 포함한 Core·두 디자인·SDK·Native·Wasm 두 profile·Windows HWND/App SDK 두 host의 전체 빌드와 Web provider 타입 검사는 통과했지만, 대표 Web 입력 검증이 실패했으므로 현재 공급을 기능 검증 완료로 취급하지 않는다.

### 현재 연결한 기능

- 원래 Widget/Element/State/Inherited/GlobalKey·metrics와 표준 Flex/Align/Center/Stack·plain Text·clip/affine Transform을 부분 연결했다. 고정 extent ListView는 C++ lazy list·canonical controller/position과 외부→내부 controller 교체·offset/attach/detach를 유지한다. 기본 tap/long press·drag details, 원래 AnimationController와 post-frame callback은 App에 남고 native frame은 App을 기다리지 않는다.
- Material Text/Filled/tonal/Outlined/Elevated와 CupertinoButton은 원래 State·theme·controller를 유지한다. 기본 shape/border/shadow·highlight/InkRipple과 boolean/tristate Checkbox·Radio의 check/dash/원 geometry는 C++가 계산하고 Native/Web provider가 그린다. Paragraph fontFamily는 최대 256 UTF-8 bytes, weight는 100–900이며 Web variation wrapper는 16개 LRU와 항목당 64 KiB 예약을 사용한다. 대상·조상 geometry가 같은 paint 문서 교체에서 pointer up/cancel을 8개 게시 상한 안에 보존한다.
- **이번 focus/keyboard 연결:** 원래 FocusState/FocusNode·Actions/Shortcuts·Radio registry를 그대로 사용한다. C++는 native focus owner와 실제 semantic peer를 구별하며, Radio의 안쪽 Semantics와 Material 버튼의 바깥 Semantics를 모두 연결한다. Source callback은 올바른 focus 경로에서 실행하고 native 전달 중 불필요한 중간 root focus를 만들지 않는다. Main은 이전 focus 관측으로 새 focus를 덮어쓰지 않는다.
- FocusNode rect/offset/size는 관측한 게시 문서·metrics·device와 일치하는 C++ transform/크기를 읽는다. 회전에서는 원래 diagonal-corner 의미를 유지한다. 게시 전·알려진 stale geometry는 거부하며 TS layout을 실행하지 않는다. 이 연결을 임의 RenderBox/custom hook의 동기 geometry 완료로 확대하지 않는다.
- Key down/up/repeat와 modifiers를 bounded mailbox로 복사해 원래 source 키 처리에 전달한다. Focus 요청은 unfocused session 0도 정확하게 비교하여 오래된 요청이 새 사용자 focus를 덮어쓰지 못한다. Navigation/activation과 검증한 Shortcut 범위이며 scan/layout/raw message·전체 character/IME 계약은 미완료다. Windows Alt+F4의 OS 종료 경로는 유지한다.
- Windows UIA의 mixed/Indeterminate·RadioButton/SelectionItem·그룹 Selection과 Native/Web의 게시 peer focus를 연결했다. C++/SDK JSI CMake의 누락 Flex source와 정상 Windows 공급 갱신의 Core 두 emit program도 수정했다.

### 앞선 focus/선택 공급의 검증

아래 성공 결과는 **`c4be00de…` / schema 3147956808**의 범위다. 새 Switch 공급의 재검증 결과로 복사하지 않는다.

| 범위 | 결과와 한계 |
| --- | --- |
| Material 대표 Web 소비 | `original-material-browser.test.mjs` **1/1**, single-worker/threaded 모두 통과. 버튼·disabled·hover·ink·boolean/tristate·Radio 선택/해제·ARIA·방향키 wrap/disabled skip·그룹 Tab/Shift+Tab·Control+K와 Source focus callback/게시 좌표를 검사 |
| 실제 작업·종료 | **C++ 2852 = SDK ACK 2852 / C++ 2833 = SDK ACK 2833**. 각 key work **26**, focus work **28**, gesture work **113**. checks/mixes/choices/shortcuts **2/3/5/1**, App geometry·TS layout·rejected fallback **0**, workersStopped=true·reservedBytes **0** |
| 실제 Web pixel | 기존 opacity **[68,136,204,255] → [156,191,227,255] → [68,136,204,255]**, mark/radio·ink 표시를 유지. Headless Chromium 결과이며 물리 입력·scanout·cadence 수락은 아님 |
| 선택 계약 | **14/14**. Native/두 Wasm의 focus owner/peer 양방향 연결·정확한 session·key 복사/invalid repeat 거부·disable/rollback, 기존 modal·editing/composition/UTF-16/undo·semantics action 회귀. Native 원래 Focus는 회전 geometry·GlobalKey 이동·이동 뒤 blur/refocus·semantics callback 순서·down/repeat/up·disable/퇴역을 확인. Cupertino 통합은 native focus 전달 시 Source 경로가 한 번만 변경되는 것도 검사. Fake renderer/측정 기반 기능 증거 |
| 공통 경계 | Source focus **6/6**, package boundary **5/5**, 필수 input geometry **2/2**, retained geometry **7/7**, design ownership **PASS-scoped**. 전체 Core/API/host/runner suite는 기능마다 반복하지 않음 |

**평소 Windows 공급:** 앞선 `c4be00de…` 단계에서 `npm.cmd run run:windows --workspace @nelyx/testbed-2`가 사용하는 기존 runner의 **CLI/Core/SDK 3개**를 갱신하고 source/dist/installed 입력과 source seal을 확인했다. 중단 정리의 읽기 검사에서 세 패키지의 현재 source seal은 모두 유효하고, 기존 설치본은 **CLI만 일치·Core/SDK 불일치**임을 확인했다. 새 Switch 공급으로 기존 runner를 다시 갱신하지 않았다. 새 독립 설치본을 만들거나 창을 실행하지 않았다.

### 중단 시 Switch 상태와 재개 조건

- 원래 Material Switch·CupertinoSwitch의 State·theme·animation·controlled value는 유지한다. Source SwitchPainter가 track/thumb·reaction·outline·Cupertino clip/shadow/on-off label 설정을 전달하고 C++가 최종 좌표를 계산하도록 부분 연결했다. Shape/shadow/clip primitive, 336-byte paint wire, `canonicalSwitch` capability와 switch semantic role을 추가했다. Thumb image/icon은 명시적으로 미지원이며 Slider는 아직 연결하지 않았다.
- 첫 대표 Web 실행은 Material Switch click·Space·오른쪽 drag와 thumb 크기/위치·pixel 변화를 통과했지만 반대 방향 drag의 `switches=4`를 기다리다 실패했다. 후속 두 실행은 더 앞선 Checkbox 클릭에서 `checks=1` callback을 받지 못해 실패했다. 마지막 관측은 App 오류 없이 `checks=0`·SDK ACK 3019·fallback 0이며, 입력 성공이나 C++/SDK 집계 대조 통과를 뜻하지 않는다. 원인은 아직 확정하지 않았다. Cupertino·RTL Switch 단계와 두 profile 전체 완료/drain 성공도 현재 공급에서 승인하지 않았다.
- **재개 시 먼저 수정할 코드:** `Nelyx/engine/platform/windows/interaction.hpp`의 semantic `roles[]`는 아직 0–9만 갖고 새 switch role은 10이다. 해당 index 누락과 범위 처리를 보완한 뒤 rebuild한다. 현재 Windows Switch UIA 경로를 실행해 성공으로 취급하지 않는다.
- 새 Switch의 native geometry/paint malformed rollback·drag cancel/disable/퇴역 계약, 원래 Material/Cupertino 대표 회귀, lint/format과 필수 input geometry **2개 명령**은 아직 검증하지 않았다. 앞선 공급의 14/14·2/2·7/7을 새 schema 결과로 쓰지 않는다.
- 테스트는 자체 finally에서 server·browser·임시 앱을 닫았다. 중단 정리에서 해당 테스트/host 잔류 process와 `engine-controls-web-*` 임시 폴더가 없고 engine staging cache도 비어 있음을 확인했다. 임시 Source-state debug listener를 제거하고 실패 상태를 출력하는 bounded 진단만 남겼다. 현재 dist 하나를 유지하며 추가 빌드·런타임 검증·설치 갱신은 중단했다.

마무리 정리는 여섯 문서의 로컬 링크/앵커 **177개**, schema 생성 일치, 정리한 테스트 두 파일의 구문/format과 `git diff --check`를 확인했다. 이는 새 Switch 기능·전체 source lint/format·Native/UI 검증을 대체하지 않는다.

재개는 먼저 `git status --short`·위 source/dist identity와 [§8.2](work9-2.md#82-디자인-패키지의-typescript-구현-유지)의 TypeScript 디자인 소유권을 확인한다. 기존 control/paint helper가 공통 연산·geometry만 담당하고 디자인 State/theme/controlled value 정책을 복제하지 않는지 검토한 뒤 Windows role index와 paint 문서 교체 중 pointer admission/capture·Source drag 전달을 조사한다. 입력 누락을 재시도나 대기 시간 증가로 숨기지 않는다. 필요한 수정을 한 뒤 C++/wire 변경 여부에 맞춰 위 빌드 원칙을 적용하고 대표 Web·필요한 Native/두 Wasm 계약을 실행한다. Geometry 변경의 `npm.cmd run test:input-geometry`·`npm.cmd run test:retained-input-geometry`를 수행하고 성공 범위 뒤 기존 Windows runner의 필요한 패키지만 갱신한다. Native GUI는 아래 사용자 중단 경계를 유지한다.

**앞선 공급의 증거:** `90649c3d…`의 Core **283/283**·graphics **6/6**·host **17/17**·설치 runner **19/19**·reload **7/7**과 API `inputValid=true / compatible=false`는 선행 기준이다. 이번 전체 suite 재실행으로 표시하지 않는다. `b1e6c519…`에서 Material 버튼의 실제 App SDK 표시·입력·정상 drain을 확인했으며 최신 focus/선택 컨트롤 Native UI의 증거로 복사하지 않는다. `747a069d…`에서 비시각 UIA provider·Native CMake corpus, 실제 graphics **2/2**, installed Native Hermes **1/1**을 확인했다. 현재 변경된 Source focus와 이전 provider/설치 증거를 구별한다.

**Native UI 중단 경계:** 사용자가 Checkbox 관측 중 물리 Escape로 Computer Use를 중단했다. 당시 소유 프로세스·임시 앱을 회수했고 강제 종료를 정상 drain으로 기록하지 않았다. 사용자 UI 재개 전 추가 Computer Use를 자동 실행하지 않는다. 이번 검증은 shell·비시각 Native 계약과 headless Web이며 최신 Native 선택/focus 표시·사용자 입력·외부 reader는 **notVerified**다.

### 현재 잔여와 다음 순서

1. **TypeScript 디자인 소유권을 유지하며 Switch의 role index·입력 누락·반대 방향 drag와 새 paint 계약**을 먼저 해결하고 현재 공급을 검증한다. 그 뒤 원래 TypeScript Slider·나머지 고수준 디자인 API를 공통 paint·gesture/geometry·controller 경계에 연결한다. 컴포넌트별 C++ 재구현은 진행하지 않는다. Padded tap target·custom shape/rect·다른 ink factory와 전체 디자인 호환은 미완료다.
2. Focus/shortcut의 전체 physical/raw/character·IME·lifecycle 경합, lazy focus/reader·전체 semantics와 UIA toggleable Radio 해제, OS cursor·플랫폼 서비스가 남는다. 현재 FocusNode mirror를 일반 동기 geometry/custom hook 완료로 취급하지 않는다.
3. 가변 extent·reverse/padding/restoration·추가 physics, rich/selectable text·font fallback/italic/strut, graphics/reuse/frame 일정, 필수 콘텐츠와 상태 보존 reload/loss/low-memory 복구를 이어간다.
4. 최종 원래 API/설치 소비와 W9-13 기술 gate를 통과한 뒤 W9-14의 대상별 물리·성능·기본값 전환을 별도로 판정한다. 기본 Windows host 변경·기존 host/v1 제거를 앞당기지 않는다.

W9-06/07/08/13/14는 미완료다. 성능 두 flag는 **false**, 물리 IME/reader/trackpad·display/scanout은 **notVerified**, Android/Linux·iOS/macOS는 **DEFERRED**다. 앞선 차수의 W9-13 기술 완료와 W9-14 물리/성능 수락을 구별하는 §12.5를 유지한다.
