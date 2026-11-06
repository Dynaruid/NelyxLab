# work9-3 — 3부: 구현 순서·통합 검증·공급

작성: **2026-11-05 KST** · 갱신: **2026-11-06 KST** · 상태: **PAUSED / Windows·Web 1차 구현·검증 진행 / PARTIAL**

[전체 목차](work9.md) · [이전: 2부](work9-2.md) · [다음: 4부 Android·Linux](work9-4.md) · [후속: 5부 iOS·macOS](work9-5.md)

**범위:** 원문 §12–14. W9-00–14의 의존성·체크리스트, Windows/Web 검증·제품 수락, 공급·정리와 문서 운영을 다룬다.

**실행 순서:** Windows/Web 1차는 [3부 §12.2의 실행 묶음](work9-3.md#122-windowsweb-1차-실행-순서)을 따른다. 이후 **[4부의 Android·Linux 2차](work9-4.md) → [후속 5부의 iOS·macOS 3차](work9-5.md)**로 진행하며 후속 플랫폼을 Windows/Web 1차 완료의 선행 조건으로 두지 않는다.

§14의 기존 문서 검토 기록은 분할 전 결과다. 이번 분할 범위와 확인 결과는 [전체 목차의 문서 분할 기록](work9.md#문서-분할-기록)에 적는다.

## 12. 구현 단계와 완료 조건

현재 실행 상태는 [아래 구현·검증 기록](#현재-구현검증과-잔여-작업)을 따른다. Work8의 구현은 [§2](work9-1.md#2-work8에서-이어받는-기준점)의 PARTIAL 기반으로 재사용한다. ID는 기존 작업과의 연결을 위해 유지하며 **번호순이 아니라 아래 실행 묶음 순서**로 진행한다. `-A/-B`는 별도 새 ID가 아닌 해당 단계의 세부 범위다. W9-12-B(Android)·W9-12-B(iOS)는 같은 B 범위의 target별 적용이며 새 단계 ID가 아니다. 개발 차수는 Windows/Web 1차 → Android/Linux 2차(4부) → iOS/macOS 3차(후속 5부)다. W9-13/14는 대상별로 완료를 기록한다.

### 12.1 검토에서 수정한 선행 관계

- 전체 API gate의 입력 오류를 최종 통합까지 미루면 호환 여부를 판정할 수 없다. W9-00에서 Windows/Web의 선언 해석을 정상화하고 API별 미구현과 검사 입력 실패를 분리한다.
- 동기 custom hook·controller·Widget 수명의 실행 모델은 큰 이식 전에 확인해야 한다. W9-06-A를 앞당기고 전체 그래픽 구현을 그 선행 조건에서 뺀다.
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
| 4 | **W9-08**: 두 디자인·SDK 사용 흐름 | Windows와 두 Web profile에서 원래 import·theme·form·overlay·navigation·localization/service 동작. 미이식 항목은 API 의무로 계속 추적 |
| 5 | **W9-09-B/10-B·W9-11-A**: 재사용·pressure·frame·필수 콘텐츠 통합 | 재사용 전후 pixel/geometry와 실제 작업 수·단계 시간 대조. 필수 animated/texture/platform view는 W9-09-A와 해당 기능 준비 후 먼저 구현할 수 있으며 이 묶음에서 수명·기능을 최종 통합. 추가 raster cache/damage는 측정 근거가 있을 때만 적용 |
| 6 | **W9-12-A**: Windows/Web reload·복구 통합 | 최소 host 연결 뒤부터 개발하고 이때 기능 전체와 통합. 준비 실패·교체·context/device loss·새 session 정책·close/late callback·자원 회수 확인 |
| 7 | **W9-13 → W9-14**: Windows/Web 최종 통합·제품 수락 | 해당 target의 API/동작·전체 설치 조합·두 profile·공급/실행/종료 검증 후 실제 입력·frame/resize 성능과 기본값 전환을 대상별 판정 |

각 묶음에서 같은 공급의 작은 일반 앱과 관련 Testbed 흐름을 확인한다. API·자원·설치 검사는 마지막에 처음 실행하는 검사가 아니라 초기 연결부터 넓혀 가는 검사다. 물리 입력과 사용감도 실행 가능한 묶음에서 조기에 확인하되 최종 제품 수락은 W9-14에서 별도로 판정한다.

### 12.3 단계별 범위와 완료 조건

| ID | 차수·작업 | 선행·완료 조건 |
| --- | --- | --- |
| W9-00 | **1차** 기준선·공급·API 판정 입력 | 현재 diff/source/dist·원래 공개 표면·Windows/Web의 OS/ABI/toolchain/browser·배포/manifest/capability·corpus 확인. [§4.1](work9-1.md#41-windows-rnw-소스-선별-재사용) RNW 후보의 필요 사례·도입/참고 범위·출처/의존성 고정. 현재 공급으로 필요한 core/host/runner 기준선을 확인한 뒤 [§8.1](work9-2.md#81-검사-환경과-실행-모델의-선행-판정)의 실제 consumer 환경으로 검사 입력을 정상화하고 원래 표면의 target별 대응 합계 확인. `inputValid=true` 확보와 실제 호환 잔여 목록을 분리. 모바일 원본 고정·GTK/Apple 환경은 후속 |
| W9-06 | **1차 A** 실행 모델 검증 → **B** 원래 Widget/Element/Render API | A는 W9-00 후 기존 구현에서 State/Key/context·동기 controller/custom hook의 보존 가능 의미와 실행 분류를 실제 원래 consumer로 확인. 미해결 의무와 의존 기능은 미완료로 유지. B는 A에서 입증한 경계와 W9-01/02 후 수명·parent data·NACK/예외·재진입을 구현하고 필요한 W9-05 항목과 기능별 연결. UI/Content의 App 동기 대기·숨은 fallback으로 통과시키지 않음 |
| W9-01 | **1차** 최소 embedder·runtime/provider 경계 | W9-00와 W9-06-A의 설계 결과. Windows/Web에 필요한 owner·mailbox·provider·입력/mirror·generation·close와 선택한 RNW OS handler만 최소 분리. 새 Windows 경로의 RN 앱 객체 의존성을 제거하고 기존 ACK/NACK·snapshot/ledger·오류/cleanup 회귀 유지. 모바일 helper 추출이나 후속 OS 구현을 요구하지 않음 |
| W9-02 | **1차 A** Windows App SDK·**B** Web 수직 연결 | W9-01. A는 실제 AppWindow/dispatcher·Vulkan scene·TSF/UIA·DPI/resize·hide/restore·drain·unpackaged 소비 실행. B는 Chrome·Edge의 두 profile·DOM/ARIA·DPR/resize·실패/close corpus. 작은 공통 앱부터 시작하고 실제 C++ 작업과 host identity 확인 |
| W9-05 | **1차** Canvas/Paint·rich text/font | W9-01과 W9-06-A. 작은 scene의 protocol/provider부터 확장하고 Windows/Web에서 같은 API·pixel·UTF-16/RTL/placeholder/query·invalidation corpus 실행. W9-06-B/07에 필요한 항목부터 연결해 전체 표현력과 자원 거부/회수까지 완성 |
| W9-07 | **1차** Layout·scroll/gesture·editing·semantics·list | W9-06-B 및 해당 기능의 W9-05, 실제 peer는 W9-02. Intrinsic/dry/baseline·invalidation·motion·lazy focus·range/action·동기 controller 의미를 공통 core와 Windows UIA/TSF·Web DOM/ARIA에서 확인. GTK/AppKit/모바일 peer는 후속 |
| W9-08 | **1차** Material/Cupertino·SDK API | W9-06-B/07 및 필요한 W9-05. 원래 constructor/default/theme/icon/form/route/overlay·localization/service/platform API별 사례를 Windows/Web에 연결. 미이식 import 거부를 호환 구현으로 교체하고 원래 공개 분모 유지 |
| W9-10 | **1차 A** clock·관측 → **B** 전체 frame 일정 | A는 W9-02의 각 host 최소 실행과 함께 clock 단위/기준·ID 대응·단일 frame 수요/credit·input wake·idle·숨김/복귀·build/content/raster/submit 시간 관측. B는 기능 확장 후 연속 입력 watermark·연속 document 갱신·App/Content 지연 중 준비 scene 진행과 App animation의 한계를 통합 검증. GTK/AppKit clock은 해당 후속 host에서 연결 |
| W9-09 | **1차 A** 기본 예산/hold → **B** preparation 재사용·pressure | A는 W9-01/02부터 신규 자원·실패/교체/close를 ledger에 연결. B는 W9-05와 W9-10-A 후 실제 병목을 기준으로 Picture/paragraph/image 재사용·무효화·pressure 회복과 재기록/shaping/decode 수 감소 확인. RSS/VRAM 측정 한계 명시 |
| W9-11 | **1차 A** 원래 API의 animated/외부 콘텐츠·**추가 B** cache/damage | A는 필요한 W9-05/07와 W9-09-A/10-A 후 Windows/Web의 API별 필수 기능·texture/platform view 입력/semantics·수명 검증. W9-09-B 전체를 기다리지 않으며 최종 통합에서 재사용과 대조. 요구 기능 미지원은 호환 gate 실패. B는 W9-09-B/10-B 측정 근거가 있을 때 적용하고 full redraw pixel·무효화·회수 대조; 근거가 없으면 추가 최적화 보류로 기록 |
| W9-12 | **1차 A** Windows/Web reload·복구 / **2차 B(Android)** / **3차 B(iOS)** | A는 W9-01/02 후 시작, bundle 준비 실패·세대 교체·device/context loss·재생성/새 session·close를 기능 확장과 통합. B는 [§11](work9-2.md#11-web모바일에서-유지할-범위) M0/M1/M2의 RN 소스 분리·standalone 입력/편집/semantics·surface/clock·reload/복구·설치/drain을 대상별 수행. Android는 Windows/Web 1차 완료 후 4부에서, iOS는 Android/Linux 2차 완료 후 5부에서 진행. M3 Web helper는 A/07에서 독립 수행 |
| W9-13 | **대상별** 전체 API·host 통합·배포 | 초기 Windows/Web 설치 검사는 W9-02부터. 1차 최종 판정은 W9-05/06-B/07/08/09/10/11-A/12-A와 W9-02의 전체 corpus, 원래 공개 scope·동작 의무·installed compiler/CLI·두 디자인·전체 Windows/Web package 조합·출처/identity·손상 거부/정리를 요구. W9-03/04/12-B는 1차 선행 조건에서 제외 |
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
- [ ] W9-08: Windows/Web의 Material/Cupertino·SDK 전체 적용 의무 확인.
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

## 13. 검증과 판정

**1차 판정은 Windows와 Web 두 profile을 대상으로 한다.** 아래 판정은 현재 구현 기록이며 제품 물리·성능 gate의 통과와 구분한다. 원래 공개 API 의무의 target별 적용표를 보존하고 Windows/Web의 통과와 후속 플랫폼 미검증을 별도 기록한다.

| Gate | 차수·통과에 필요한 증거 | 현재 판정 |
| --- | --- | --- |
| 원래 공개 표면·동작 | **1차 Windows/Web**, 후속 대상은 별도. 원래 scope·overload/member/protected/non-code·target별 선언 해석과 installed runtime 동작. 입력·표면·동작을 각각 판정 | **inputValid=true / compatible=false**. 두 target 진단 0·원래 분모/hash 보존. 명시적 부분 bridge의 canonical Element/State→C++ 연결 통과. 전체 Widget·controller·custom hook·동기 geometry 미완료 |
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

제품 평가는 사용자의 평소 명령과 Gallery 양 열 전체 구간·Mixed 편집 복귀·ListView/Cupertino를 사용한다. 정지→시작→10초 이상 연속→반전→관성→재접촉·resize를 포함하고 물리 precision trackpad와 주입 wheel을 구분한다. 기준/후보 **3쌍**을 기본으로 하고 대부분의 검증은 **30회 이내**로 제한한다. Warm 일반 이동의 60fps 기준·lazy 준비 중 일시 jitter와 준비 뒤 지속 정지를 구분한다. [기존 제품 평가 조건](history/26/11/04/work8-3-summary.md#173-후속-제품-성능-비교--백엔드-완료와-별도-평가)

같은 장면·현재 공급을 Windows App SDK와 실제 Web browser에 연결해 비교하고 주사율·DPI·해상도는 바꾸지 않는다. Web 결과에는 browser·GPU·profile·격리 여부·tab 가시성을 포함한다. Single-worker의 Content 점유 한계와 입력 보존/회복을 threaded와 구별하며 profile 간 동일 성능을 전제하지 않는다.

비교 시작 전에 평소 실행 명령·Release/optimized/VM cohort·창 크기·콘텐츠/physics·예열/coverage·입력 구간과 관측 방법을 고정한다. 실제 이동 상태가 바뀐 surface frame의 수·간격과 p95/p99/max 지연·지속 정지·CPU/GPU·ledger/process 관측을 구별한다. 같은 화면의 반복 submit은 이동 FPS로 세지 않으며 빌드·다른 성능 검사를 동시에 돌리지 않는다. 미수락 구간과 물리 입력 결과를 평균 수치로 덮지 않는다.

Surface 갱신·GPU 완료·host publication·물리 display/scanout은 각각 기록한다. 관측하지 않은 scanout은 `unobserved`다. 실제 일반 사용의 체감 수락은 관측된 범위로 판정할 수 있으며 모든 내부 시각을 알아야만 사용자 수락을 기록할 수 있는 것은 아니다.

### 변경 범위별 필수 회귀

아래 사례를 관련 단계의 기존 suite에 연결하거나 새 host/adapter 검사로 추가한다. 현재 존재하는 suite가 새 host를 이미 검증한다고 보고하지 않는다.

| 변경 범위 | 필요한 성공·실패 사례 |
| --- | --- |
| API 입력·실행 경계 W9-00/06 | Target별 실제 설치 import·overload/member/protected/non-code 대응, 잘못된 export condition·누락·해석 실패·표면 축소의 거부. 동기 getter/setter/listener·재진입·NACK와 실제 C++ 작업 대조 |
| 공통 wire·owner W9-01/05/07 | 세 실행 경로의 schema/capability 불일치·유실 ACK/재시도·준비 실패/자원 회수. 입력·App 이벤트 포화·연속 document 변경·다중 view에서도 bounded 상태와 frame/terminal 진행 |
| App SDK W9-02-A | 개발 runtime 없는 앱 로컬 배포·필수 파일 손상/누락의 거부, AppWindow/dispatcher 실제 실행·DPI·TSF/UIA·live resize/최소화·마지막 창 닫기·시작 도중 종료. 기존 HWND host는 별도 control |
| Web W9-02-B/07/12-A | Chrome·Edge의 두 profile, 격리 환경의 forced single-worker·비격리 강제 threaded 실패, 잘못된 worker/Wasm·권한 거부, base URL/배포 자원, context loss·새 canvas 재시작·reload/close와 late event 차단 |
| Provider·복구 W9-09–12 | Retained/full redraw pixel·text/clip/hit/semantics, 자원 무효화·예산 거부·pressure·detach/restore·device/context loss·dispose 무응답·close 중 reload. GPU/OS consumer hold·pending·callback이 회수되고 다음 정상 scene이 진행 |

물리 IME/reader/precision trackpad와 GPU 실제 browser 검사는 위 자동 회귀와 별도다. GTK/Android·Apple 관련 사례는 해당 후속 차수의 실제 환경에서 같은 gate에 연결하며 Windows cross-build나 simulator 결과로 device/OS 입력 수락을 대신하지 않는다.

### 구현 시 사용할 기존 검사 명령

아래는 **현재 존재하는 명령**이다. 이번 문서 검토에서는 실행하지 않았다. 변경한 공개 패키지와 engine 공급을 갱신한 뒤 필요한 범위만 실행하며 host 검사는 현재 소스/공급 identity를 확인한 후 수행한다. W9-00의 기준선은 현재 core/host/runner와 API 입력·audit 상태를 확인하고 이후에는 변경한 기능과 소비 경로에 필요한 검사만 추가한다. 아래 목록을 파일 수정마다 전부 반복하지 않는다.

고수준 API만 변경한 개발 중에는 아래 전체 목록 대신 해당 통합 사례를 선택한다. C++를 수정하지 않았다면 현재 공급을 재사용한다. 예를 들어 ListView 연결 확인은 다음 명령만 사용한다.

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

선별 도입하는 RN/RNW/RN Web 코드는 원본 repository·tag/commit 또는 검증한 package integrity·파일 hash·도입/변경 범위·필수 의존성·license/notice를 현재 소스의 고정된 출처 정보로 관리한다. 원래 저작권·license와 해당 파일의 제3자 고지도 공급에 포함한다. 업데이트는 필요한 OS 수정과 실제 corpus를 대조해 진행하며 전체 checkout·이전 source/package 사본·실행별 조사 기록을 누적하지 않는다.

검증용 consumer·archive·browser profile·server/process·GPU/native 임시 자원은 한 실행에 필요한 범위로만 만들고 성공·실패·중단 시 finally에서 정리한다. 현재 dist/package만 남기며 이전 출력·receipt·로그·checkpoint/history JSON·설치본을 누적하지 않는다. `Nelyx/docs/plans/`와 `Nelyx/docs/migrations/`를 생성·복구하지 않는다.

진행 상태·짧은 증거·남은 작업은 해당 분할 문서에 갱신하고 전체 현황·다음 시작점은 [전체 목차](work9.md)에 반영한다. 제품 사용법은 기존 한국어/영어 README에 반영한다. 현재 작업 기록에는 **차수·대상/profile·수행한 검사·남은 의무·다음 시작점**을 적는다. Windows/Web 1차 완료 시 2차 Android/Linux와 3차 iOS/macOS는 계속 DEFERRED로 보존한다. 2차 대상에 착수해도 3차 상태를 올리지 않으며, 각 대상의 W9-03/04/12-B·W9-13/14 결과를 별도로 갱신한다. 닫힌 work8의 과거 수치·실패·공급 경계를 새 결과로 덮어쓰지 않는다. 기술 단계가 끝나도 대상별 API·물리 입력·성능 gate를 따로 남기며, 기본값 변경·기존 host/v1 제거는 검증한 대상과 사용 경로를 확인한 뒤 진행한다.

### 이번 문서 작업의 검증과 다음 시작점

**앞선 검토 기록 — 2026-11-05 KST / Windows·Web 우선·RNW 선별 재검토:** 당시 work9만 수정했다. 기존 W9-00–14 **15단계**와 1차 순서를 유지하고 RNW 0.83.2의 설치 소스·기존 Nelyx Windows helper·공식 구조 설명을 대조해 [§4.1](work9-1.md#41-windows-rnw-소스-선별-재사용)의 재사용 후보·의존성·실행 gate를 추가했다. 당시 관련 문서 **14개**의 로컬 링크 **288개**·앵커 참조 **46개**·표 **47개**, 코드 fence·공백·ID/단계 연결과 문서에 적은 루트 npm 명령 **20개**의 존재를 확인했다. `git diff --check`를 통과했다. 해당 검토 시작 시 이미 있던 다른 파일 **13개**의 내용 hash와 work8 원문 **5개**의 삭제 상태를 유지했다. 이 수치·dirty 상태는 앞선 실행의 기록이며 현재 검토의 재검증 결과가 아니다.

**이번 재검토 — 2026-11-06 KST:** 지정한 계획 **6개**만 수정했다. 현재 소스·공식 계약과 대조해 GTK 4.22 최소 버전, API 실행 모델·검사 환경, 기술/제품 gate·의존성, host 초기화/입력/frame·자원/복구·후속 공급 조건을 보완했다. 주요 절 **14개**·W9 단계 **15개**, 로컬 링크 **131개**·앵커 참조 **76개**·표 **21개**·code fence/공백과 루트 npm 명령 **20개**의 존재를 확인했고 `git diff --check`를 통과했다. 제품 소스·공급 변경, 빌드·API audit·runtime·물리 입력·성능 재검증은 수행하지 않았다. 기존 API FAIL·구현 PARTIAL·후속 DEFERRED와 수락 미검증을 유지한다.

**위 문서 검토 당시의 구현 시작점은 W9-00의 공급/기준선·API 입력과 RNW 출처 선정이었다. 현재 시작점과 미완료 범위는 아래 기록을 따른다.**
## 현재 구현·검증과 잔여 작업

**2026-11-06 KST / PAUSED / Windows·Web 1차 PARTIAL.** 1~3부를 구현 중이며 W9-13/14 완료가 아니다. Android/Linux 4부와 iOS/macOS 5부는 DEFERRED다.

마지막 전체 검증 공급은 **`90649c3d73d5d34837aaa332a6e62bf293fcf1de04a9d1b6ab9a22057664d11f`**, ABI **2**, schema **4122515473**다. 아래 전체 host/runner 결과는 이 공급의 결과이며, 이후 고수준 API 변경의 완료로 복사하지 않는다.

직전 기능 검증 공급은 **`9fa78a98c10fdff3679f08e3975729df5d402ab20c1eba296df5f0edfde35488`**, ABI **2**, schema **4120097723**다. `build:engine-v2`에서 Core·두 디자인·SDK, Native·Wasm 두 profile·Windows 두 host를 빌드했고 source identity 일치를 확인했다. 이 공급의 선택 통합은 **2/2**다. Web 대표 통합 **1/1**은 single-worker/threaded 두 profile의 실제 입력·hover·animation pixel·종료를 검증하고, Native 목록 통합 **1/1**은 controller 교체를 포함한다. 앞선 `7a2922c8…` 공급의 Native 선택 통합은 원래 CupertinoButton·GestureDetector·ListView/ScrollController **3/3**이다. 이후 변경은 Web canvas/DOM peer 입력 경계와 원래 목록 controller 교체다. Web 입력 경계 변경 후 필수 geometry 검사는 **2/2·7/7**을 통과했고 이후 geometry 소스 변경은 없다. 전체 Core/API/host/runner/reload suite는 반복하지 않았다. 아래 전체 수치는 앞선 `90649c3d…` 공급의 범위로 유지한다.

**검증 축소·개발 우선순위:** 사용자 지시에 따라 TS reference만 실행하던 기초 사례 **4개**를 `execution-model.test.mjs`에서 제거했다. 미이식 import가 fallback으로 통과하지 않는 통합 사례는 유지한다. 고수준 API 기능마다 Core/API/host/runner/reload 전체 suite를 반복하지 않는다. 해당 기능의 통합 사례 **1개**, 필요한 타입·빌드와 실제 앱 연결을 확인한다. C++/ABI 변경이 없을 때 contract harness는 `NELYX_ENGINE_V2_PREBUILT`로 manifest ABI/schema·driver/Wasm hash를 확인한 현재 공급을 재사용할 수 있다. C++ 변경 검증은 rebuild 경로를 유지한다. 미실행 검사를 PASS로 기록하지 않는다.

| 범위 | 검증한 결과와 경계 |
| --- | --- |
| W9-00 API | Windows/Web `inputValid=true`, 오류·선언 진단 0. 원래 4 package·834 subpath·4541 hash 보존, 추가 entry 포함 실제 836 subpath·4544 항목. Windows 802 적용/34 비적용, Web 788/48. 기초 4개 제거 전 API/실행 모델 **21/21**, 이후 전체 재실행 생략. 전체 `compatible=false`, strict exit **1** |
| W9-01/02 Windows | 고정 App SDK·앱 로컬 DLL/CRT·실제 AppWindow/dispatcher·Vulkan/TSF/UIA·DirectManipulation 연결. 기본 HWND와 명시 App SDK 후보를 구분. 전체 host **17/17**에 두 Windows host의 시작 중 close·UIA 편집·drain 포함 |
| W9-02 Web | Chromium/Chrome/Edge 기본 headless 두 profile과 실제 Chrome/Edge DPR 2 숨김·복귀 4개 통과. Native/Web 실제 Testbed **C++ 1251 = SDK ACK 1251**, 관측 true·TS fallback 0 |
| W9-06-B/05 | Canonical Element/State/Inherited/GlobalKey·metrics reader, RTL/up Flex·Align/Center·비 positioned Stack·plain Text·basic ClipRect/affine Transform의 부분 연결. Core **283/283**, 원래 bridge **42/42**. State 이동 ACK **61 = C++ 61**, layout **54**, TS layout fallback 0 |
| Text 확장 | 정렬 6종·RTL·locale·nowrap·maxLines/ellipsis·height/spacing·leading/height behavior·manual/hidden hyphen을 C++ wire와 두 provider에 연결. 문단 paint 폭과 constrained box 폭을 구분. 굵기 400의 실제 변수 typeface를 공개 paragraph API로 재구성하며 글꼴 파일을 변환하지 않음 |
| 실제 pixel | Graphics **6/6**, 앞선 glyph **3/3**. 현재 owned binary의 두 모듈 구성에서 canonical text adapter와 일치하며, fractional translation/clip·원점+중심 회전·flip·singular 미표시도 실제 CanvasKit pixel과 대조. 아래 Native 표시 관측과 구분 |
| Native 실제 표시 | 표준 rect·비대칭 타원 RRect/saveLayer·Oval·Clip.none overflow와 basic clip·원점/중심 회전·flip·한글/이모지를 HWND/App SDK에서 직접 관측 **2/2**. 각각 **C++ 586 = SDK ACK 586**, fallback 0. 두 창 close 뒤 worker join·memoryTotal 0, 임시 앱 삭제. 정량 pixel 동등성·물리 입력·성능/scanout 시각 판정은 아님 |
| W9-09-B | 한 세대·16 MiB preparation cache와 lease/ref count. Native **95**·Web **96** 재사용, image decode 추가 **0**. 압력·eviction·실패·close 회수, 실제 DPR 2 숨김/복귀 통과. 실제 OS low-memory 신호는 미관측 |
| W9-10-A | Native DWM composition QPC, 일반 Web worker rAF / pthread Main rAF port. 단일 수요·입력 wake·idle/숨김/종료를 연결. 앞선 actor **6/6** 유지, per-monitor/scanout·전체 frame 최적화는 미완료 |
| W9-12-A | 파일 감시·최신 candidate 합치기·세대 자산·이전 VM/worker/provider drain. 준비 실패 시 기존 App 유지, 교체 실패 terminal·시작 중 close·close/rebuild 경합. 현재 개발 runner **7/7** |
| 설치/소비 | 일반 runner **19/19**. 독립 archive/local strict compiler·설치 CLI·두 디자인·앱 로컬 CRT/손상 거부 포함. 원래 API 앱 **4/4**는 Native 두 host/Web 두 profile에서 cache가 비어 있는 첫 이모지/soft-hyphen 장면과 ready callback의 두 번째 장면, 정렬·RTL·maxLines·height/spacing·semantics·clip/flip·resize를 확인하고 Web glyph pixel도 관측 |
| 공통 회귀 | Input geometry **2/2**, retained geometry **7/7**, 앞선 native scroll **58/58**. Workspace/CLI types·boundaries(**970 files/530 facades/7687 edges**)·design ownership·lint·format/diff 통과 |
| W9-06-A/B·05·08–12 잔여 | 동기 controller/custom hook/geometry, 전체 Widget·graphics/rich text/font·Material/Cupertino·필수 외부/animated 콘텐츠·loss 복구·전체 cache/frame 일정은 미완료 |
| W9-13/14 | 전체 설치/호환 gate 미완료. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 IME/reader/trackpad·display/scanout `notVerified` |

이번 Text 확장에서 보존한 실패와 수정:

- 첫 canonical pixel 대조는 변수 글꼴 기본 굵기 **100** 재사용과 nowrap 정렬 폭 차이를 드러냈다. 굵기 **400** typeface의 재구성과 TextPainter의 box 제약 전 폭을 적용했다. Hinting을 꺼서 layout하더라도 원래 TextStyle의 raster hinting은 **Slight**였으며 이를 분리해 최종 pixel 일치를 확인했다.
- 새 측정 ABI에서 Native host만 옛 **80/128-byte** 응답을 보내 원래 앱 두 host가 실패했다. 생성된 **88/136-byte** 크기·offset과 maxLines flag로 producer를 갱신한 뒤 두 host **2/2**, 전체 host **17/17**·runner **19/19**를 통과했다.
- 앞선 공급의 HWND UIA SetValue **0x8000FFFF/E_UNEXPECTED** 1회와 이전 headless plain 클릭 간헐 실패는 원인 미확정으로 보존한다. 현재 통과로 소급 취소하지 않는다. 편집 재준비의 같은-document publication 교체 및 queued down/up stale 문제는 별도로 재현해 관측/capture를 각각 8개로 제한하고 동일 대상·조상 geometry 증명 아래 수락하도록 수정했다. 이동·가림·만료·App document 교체·terminal/close의 거부/회수를 유지한다.
- 원래 미지원 Text가 ErrorWidget에 잡힌 뒤 빈 native 성공이 되던 문제는 commit 전 bridge 실패로 보존한다. 이른 TS layout/query/paint/hit-test도 실행 전에 거부하며 다음 지원 tree로 회복한다.

**Owned paragraph 공급:** 준비된 **m153-nelyx-paragraph.1 / API 1**을 manifest·JS/Wasm hash와 함께 v2에 연결했다. [고정 manifest](Nelyx/skia/packages/web/native-manifest.json)와 일치하지 않으면 빌드/시작을 거부하며 npm binary로 변경하지 않는다. Web 엔진 타입 검사도 공급 빌드의 선행 검사다. UTF-16 line query·unscaled ascent·실제 typeface를 검사했고 manual/hidden hyphen을 두 provider에 연결했다. 원문에 없는 생성 hyphen glyph의 fallback font가 cache 없는 첫 문단에서 실패하는 문제를 재현했다. 해당 scalar도 font 참조 준비에 포함해 현재 graphics **6/6**과 실제 첫 장면 소비자 **4/4**를 통과했다. Full dependency notice qualification은 공급 manifest의 PARTIAL을 유지한다.

첫 장면 뒤 ready callback에서 정상 tree로 바꾸는 검사에서는 SDK가 callback 이전 native work **37**과 이후 SDK ACK **199**를 함께 보고해 네 경로가 **0/4**였다. Callback 뒤 ordered App port를 다시 관측하고 close를 재확인하며 그 관측 시간도 따로 보고하도록 수정했다. 최종 공급의 원래 앱 **4/4**·전체 설치 runner **19/19**·host **17/17**·개발 재시작 **7/7**을 통과했다. Queue가 전역으로 비기를 기다리는 새 frame 장벽을 추가하지 않았다.

**ClipRect·Transform:** `framework/widgets/basic`의 ClipRect와 translate/rotate/scale/flip을 연결했다. Graphics wire header **136 bytes**에 원점·정렬의 presence를 전달하고 C++가 최종 layout 크기로 pivot을 계산한다. Resize 때 App geometry 질의 없이 새 pivot이 적용된다. 상속 additionalConstraints·RTL 방향 정렬·reset·작은 invertible scale의 hit-test·singular 미표시와 malformed wire rollback을 검사했다. 3D/perspective·filterQuality·transformHitTests=false는 명시적으로 거부하며 전체 Transform 호환으로 올리지 않는다.

**표준 clip 완료 범위:** ClipRect/RRect/Oval/Path의 기본 모양·네 clipBehavior·방향별 타원 반경·resize/reset을 연결했다. saveLayer는 draw 전에 통합 GPU 예산을 예약하고 draw 뒤 반환한다. Canonical CanvasKit pixel 대조와 별도 예산 거부/반환 사례 **1/1**을 통과했다. Custom clipper와 전체 graphics/painting API는 미완료다.

**고수준 ListView/ScrollController:** 원래 owner별 adapter로 세로 고정 extent·유한 delegate·bounded 목록을 C++ lazy list에 연결했다. Canonical controller/position·즉시 listener 재진입·key/keep-alive와 기본 wrapper를 유지한다. Native 통합 **1/1**에서 15,007px seek·정확한 offset, 짧은 linear animation future와 detach, 실제 C++ 작업/TS layout fallback 0을 확인했다. 현재 Core와 위 C++ 공급을 사용한 일반 HWND 앱에서도 20,007→20,027px 이동·애니메이션과 500번대 행 표시를 직접 확인했다. **C++ 5,245 = SDK ACK 5,245**, App geometry/TS layout fallback/rejected fallback **0**, 종료 worker join·memoryTotal **0**, 임시 앱 삭제다. 전체 host/runner suite는 반복하지 않았다. Controller 교체·가변 extent·reverse/padding/restoration·추가 physics/curve·긴 애니메이션·keyboard/reader는 미완료다.

**고수준 GestureDetector:** 동일한 owner adapter로 원래 tap down/up/move/cancel·onTap/onDoubleTap, primary long-press와 pan·수평/수직 drag callback을 C++ 인식과 연결했다. Callback 인수는 원래 Tap/LongPress/Drag details와 Offset/Velocity 객체다. C++는 DOWN의 변환을 capture해 global/local 위치·원점·delta·시각·device kind와 bounded velocity를 전달한다. dragStartBehavior·onlyAcceptDragOnThreshold, pressed State의 ACK 뒤 up/cancel, primary button·touch/mouse threshold·timer와 tap/longPress semantics를 연결했다. Event는 생성된 **160-byte** layout과 새 **gestureDetails** capability를 요구하며 누락된 정보를 App geometry로 합성하지 않는다. 기본 deferToChild·opaque/translucent 및 painted child/빈 proxy 구분을 유지한다.

기존 Native 통합 **1개** 안에서 canonical details 객체·(80,20) global/(60,10) local 위치, pressed-state ACK 뒤 up/tap·cancel, drag delta **25/20**과 알려진 입력의 종료 속도 **1,750px/s**를 확인했다. 현재 공급에서도 이 통합을 통과했다. 최초 MSVC의 멤버 이름 가림 경고를 수정한 뒤 Native/Wasm·host 공급을 빌드했다. 앞선 `9636ac07…` 공급의 실제 HWND에서는 tap **1**, down **2**, up **1**, cancel **1**, 수직 drag **1**·누적 delta **100px**와 원래 State의 화면 갱신을 직접 확인했다. 해당 **C++ 295 = SDK ACK 295**, gesture work **25**, App geometry/TS layout fallback/rejected fallback **0**이다. End details의 전달은 확인했지만 자동 drag의 속도를 물리 성능 기준으로 사용하지 않는다. Close 뒤 workersJoined=true·memoryTotal **0**, 임시 앱 삭제와 창 종료를 확인했다.

보조 버튼·double-tap details·scale/force·custom settings/장치 필터, pan과 방향 drag의 동시 등록, 전체 중첩 arena·overflow 조상 경계와 다중 pointer/이중 tap의 전체 계약은 미완료다. Source reference/permutation 검사를 추가하거나 전체 suite를 반복하지 않았다. 앞선 `e77c1205…` 공급에서 실제 tap/double State 갱신 **179/179**, long press는 통합 사례에서 확인했으며 실제 hold 입력 관측으로 확대하지 않는다.

실제 callback 앱은 처음에 C++ **179**와 시작 시 SDK 보고 **175**의 차이를 드러냈다. 알려진 ACK를 adopt한 직후 원래 host/base host의 execution 관측을 알리고 SDK가 `app-execution`을 보내도록 연결했다. 최종 **177/177 → 179/179**로 상태 변경 후 집계도 확인했다. 초기 app-ready 관측과 동적 ACK 관측을 구분하며 frame 게시나 전체 queue-empty 장벽을 추가하지 않았다.

**원래 CupertinoButton·App animation:** plain/filled/tinted의 기존 theme·ControlInteraction·WidgetStatesController·FocusNode와 press animation을 유지한다. Canonical Semantics/MouseRegion의 일부, 균일한 rounded background·Opacity layer를 연결했고 zero-opacity hit와 semantics 포함 여부를 구분했다. CupertinoSystemText는 provider의 번들 font cohort를 사용하며 음수 자간/어간과 decoration none을 연결했다. 직접 embedder의 platform 옵션과 SDK Native/browser 환경 구성을 추가했다. 원래 디자인 import와 필요한 private 값 의존성은 명시적 original-elements 앱에서 연결하며 기본 v2 앱의 원래 디자인 Widget 혼용은 계속 거부한다.

Source AnimationController·post-frame callback은 한 개의 미처리 수요로 host frame 시각을 요청한다. App clock 원점으로 구간을 옮겨 원래 FrameScheduler를 진행하며 전역 queue-empty나 App callback 대기를 추가하지 않는다. 즉시 실행하던 postFrame이 build 도중 다른 State를 변경하던 문제를 실제 버튼에서 발견해 frame callback으로 옮겼다. 첫 App SDK 실행은 버튼 tap은 성공했지만 opacity가 **1**에 머물렀다. 새 requestAppFrame이 Windows render worker를 깨우지 않던 누락을 수정했다. Headless 통합만으로 host wake 성공을 인정하지 않았다.

`7a2922c8…` 공급의 Native 통합은 **3/3**이며 새 버튼 사례는 fake font 측정으로 State·theme 설정·semantics·Tab/Enter·disable·hover/press controller·AnimationController 진행을 확인한다. 같은 공급의 실제 App SDK 창에서는 세 버튼의 기본 표시와 plain **2**·filled **1**·tinted **1**, disabled 비활성, Tab→Enter 활성화, 원래 AnimationController의 opacity **1.00 → 0.50 → 1.00**과 표시 변화를 확인했다. 최종 **C++ 788 = SDK ACK 788**, gesture work **36**, App geometry/TS layout fallback/rejected fallback **0**이다. Close 뒤 workersJoined=true·memoryTotal **0**, dispatcher 종료·임시 앱 삭제·창 종료를 확인했다. Frame cadence/scanout·물리 입력이나 전체 디자인 호환 수락으로 확대하지 않는다.

**Web의 같은 고수준 소비:** `9fa78a98…` 공급에서 `original-controls-browser.test.mjs`의 대표 통합 **1/1**을 통과했다. 일반 CLI로 canonical API 앱을 bundle하고 Chromium의 single-worker/threaded에서 plain/filled/tinted·disabled·Enter와 원래 AnimationController를 실행했다. 실제 CanvasKit pixel은 두 profile 모두 **[68,136,204,255] → [156,191,227,255] → [68,136,204,255]**로 변했다. C++ 명령 = SDK ACK는 각각 **794/795**, gesture work는 각각 **34**, App geometry/TS layout/rejected fallback은 **0**이다. WorkersStopped=true·reservedBytes **0**, browser/server·임시 앱 정리를 확인했다. Chrome·Edge headful/물리 입력·cadence 수락을 뜻하지 않는다.

Web 실제 입력에서 capture가 canvas에서 semantic DOM peer로 돌아올 때 같은 버튼의 hover가 풀리는 문제를 발견했다. 소유한 canvas와 DOM peer를 하나의 입력 surface로 처리하고 실제 surface 이탈에서만 mouse exit를 보낸다. Document의 peer 입력도 해당 interaction이 소유한 target에만 전달하며 종료 시 capture listener를 제거한다. 대표 통합은 capture 뒤 hover 유지와 surface 밖 이동의 exit를 함께 확인한다.

**원래 ScrollController 교체:** 같은 ListView의 외부 controller 교체와 내부 fallback controller 왕복을 연결했다. Position 객체·현재 offset·진행 중 native 요청을 유지하고 canonical detach/attach callback·listener를 사용한다. 새 controller의 initialScrollOffset으로 기존 화면을 초기화하지 않는다. Callback 실패 시 이전 등록을 callback 재호출 없이 복원하고 소유한 임시 controller를 정리한다. `9fa78a98…` 공급의 기존 목록 통합 **1/1**에서 외부→외부→내부→외부 전환 뒤 **15047px** 이동, 같은 position 유지·close 뒤 detach를 확인했다. **C++ 6285 = SDK ACK 6285**, App geometry/TS layout fallback **0**이다. 별도 기초 suite는 추가하지 않았다.

Material 버튼의 다음 연결 지점은 `InkResponse.startSplash`의 `RenderBox.hasSize/globalToLocal/size`, canonical physical shape와 ink paint다. 현재 Source에서 동기 geometry가 필요하므로 렌더 설정만 허용하거나 splash factory를 바꾸는 것으로 완료 처리하지 않는다. Source State·theme/controller를 유지하는 native ink 경계를 연결해야 한다.

**현재 다음 작업:** Material·선택 컨트롤 등 고수준 API와 필요한 controller·gesture 잔여를 우선 구현한다. OS cursor 변경·전체 focus/shortcut/semantics 및 복잡한 장식은 미완료다. 기초 permutation 검사를 늘리지 않는다. 동기 custom hook/geometry, rich text·다른 font weight/italic·strut·전체 디자인·콘텐츠/복구·frame 일정은 계속 미완료다. 기본 Windows host 변경·기존 host/v1 제거·물리/성능 수락을 앞당기지 않는다.


## 외출 일시정지 기록

**2026-11-06 KST / 사용자 요청 / PAUSED / PARTIAL.** 새 구현·긴 검증과 자동 계속 실행을 중단한다. W9-01–14는 완료 처리하지 않았다. 물리 IME/reader/trackpad·frame/resize 성능·scanout은 미수락이며 후속 플랫폼은 DEFERRED다.

- **직전 기능 통과:** `9fa78a98…`의 Web Cupertino 대표 앱과 Native controller 교체 **2/2**. 위 기록은 그 공급에만 적용한다.
- **이번 구현:** canonical metadata reader, native render paint/layout invalidation 통지, 32개 상한의 nativePaint 명령/scene blob, C++ shape·reference transform·ripple 반경 계산, Windows/Web의 shape·border·highlight/ripple·physical shadow 경로를 추가했다. 원래 Source State·theme·animation controller는 App에 남긴다. TS paint/layout·custom shape/ink의 자동 fallback은 허용하지 않는다.
- **font weight:** paragraph wire의 weight·provider variation 설정과 Web 준비 glyph의 weight 전달을 추가했다. 번들 NotoSansKR의 실제 wght 축 **100–900**을 확인했다. 픽셀·font matching 수락은 아직 하지 않았다. Variation typeface cache의 상한/예산 처리도 후속 확인이 필요하다.
- **빌드:** 공급 **`68b9fdc172cf0da777f0fd60d1adac6788b9e664bc399f03eee8f9373b408ad9`**, ABI **2**, schema **486707000**으로 Core·두 디자인·SDK·Native·두 Wasm·Windows 두 host 전체 빌드를 통과했다. 이후 CLI의 canonical 디자인 값 의존성·기본 MediaQuery·예외 원인 전달을 보완했고 Core 단독 빌드도 통과했다. 마지막 형식/선택 lint와 diff 공백 검사는 통과했다.
- **중요한 공급 상태:** 중단 시 source SHA-256은 **`5738ff95967dfd8cff2a571ee5a4217af222775b2ad7d27bac5adf7701b55ad2`**, dist manifest는 위 **`68b9fdc1…`**다. **identity=false**이며 dist를 최신 소스의 검증 공급으로 쓰지 않는다. 이전 dist 사본은 보관하지 않았다.
- **필수 geometry:** 이번 C++ geometry 변경 후 `test:input-geometry` **2/2**, `test:retained-input-geometry` **7/7**을 통과했다. 이후 변경은 App/CLI와 형식이며 C++ geometry는 그대로다. 전체 Core/API/host/runner suite는 반복하지 않았다.
- **실제 Material 소비는 미통과:** 일반 CLI 앱의 최초 실행은 private 값/helper import 거부였고 필요한 순수 dependency를 연결했다. 다음 실행은 여섯 버튼에서 `Missing inherited data above _*Button`을 보고했다. SDK로 원인이 빈 문자열로 전달되던 진단도 수정했다. Original AppRoot에 canonical `MediaQuery(mediaFromView(context), child)`를 추가하여 Core 빌드는 통과했으나 **그 뒤 앱을 다시 실행하기 전에 외출 중단 요청이 왔다. 해결됐다고 인정하지 않는다.**
- **남은 범위:** `original-material-browser.test.mjs`의 첫 실행 결과부터 이어간다. 기본 Filled/tonal/Text/Outlined/Elevated·disabled·hover·keyboard와 animation pixel·C++/SDK ACK·종료를 두 profile에서 확인해야 한다. 실제 ink의 C++ geometry 및 화면 변화, Native App SDK의 같은 앱도 미검증이다. Padded input target, custom rect/shape, InkSplash/Sparkle, 전체 focus/semantics/cursor·typography는 미완료다.
- **정리:** 모든 이번 exec/build handle이 종료됐고 Native 창·빌드 프로세스와 `engine-controls-web-*`/`engine-material-compile-*` 임시 디렉터리의 잔류가 없음을 확인했다. 새 archive·로그·receipt·이전 dist를 만들지 않았다. 모니터 설정은 변경하지 않았다.

재개할 때 현재 소스로 공급을 먼저 갱신하고 Material 대표 통합 하나만 실행한다. 테스트의 source identity 검사를 우회하지 않는다.

```powershell
Set-Location C:\Users\parti\Labo\NelyxLab
npm.cmd run build:engine-v2
if ($LASTEXITCODE -ne 0) { throw 'Engine v2 build failed' }
node --test --test-timeout=1200000 Nelyx/engine/tests/original-material-browser.test.mjs
```

첫 실패를 수정한 뒤 관련 Cupertino/목록 통합과 실제 Native 소비로 이어간다. 기능마다 전체 suite를 반복하지 않는 정책과 기초 reference 4개 제거는 유지한다. 외출 중 자동으로 구현·검증을 재개하지 않는다.
