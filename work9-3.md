# work9-3 — 3부: 구현 순서·통합 검증·공급

작성·검토: **2026-11-05 KST** · 상태: **ACTIVE / Windows·Web 우선 계획, 신규 구현 미착수, 기존 구현 PARTIAL**

[전체 목차](work9.md) · [이전: 2부](work9-2.md) · [다음: 4부 Android·Linux](work9-4.md) · [후속: 5부 iOS·macOS](work9-5.md)

**범위:** 원문 §12–14. W9-00–14의 의존성·체크리스트, Windows/Web 검증·제품 수락, 공급·정리와 문서 운영을 다룬다.

**실행 순서:** Windows/Web 1차는 [3부 §12.2의 실행 묶음](work9-3.md#122-windowsweb-1차-실행-순서)을 따른다. 이후 **[4부의 Android·Linux 2차](work9-4.md) → [후속 5부의 iOS·macOS 3차](work9-5.md)**로 진행하며 후속 플랫폼을 Windows/Web 1차 완료의 선행 조건으로 두지 않는다.

§14의 기존 문서 검토 기록은 분할 전 결과다. 이번 분할 범위와 확인 결과는 [전체 목차의 문서 분할 기록](work9.md#문서-분할-기록)에 적는다.

## 12. 구현 단계와 완료 조건

각 단계의 상태는 **신규 구현 미착수**다. Work8의 구현은 [§2](work9-1.md#2-work8에서-이어받는-기준점)의 PARTIAL 기반으로 재사용한다. ID는 기존 작업과의 연결을 위해 유지하며 **번호순이 아니라 아래 실행 묶음 순서**로 진행한다. `-A/-B`는 별도 새 ID가 아닌 해당 단계의 세부 범위다. W9-12-B(Android)·W9-12-B(iOS)는 같은 B 범위의 target별 적용이며 새 단계 ID가 아니다. 개발 차수는 Windows/Web 1차 → Android/Linux 2차(4부) → iOS/macOS 3차(후속 5부)다. W9-13/14는 대상별로 완료를 기록한다.

### 12.1 검토에서 수정한 선행 관계

- 전체 API gate의 입력 오류를 최종 통합까지 미루면 호환 여부를 판정할 수 없다. W9-00에서 Windows/Web의 선언 해석을 정상화하고 API별 미구현과 검사 입력 실패를 분리한다.
- 동기 custom hook·controller·Widget 수명의 실행 모델은 큰 이식 전에 확인해야 한다. W9-06-A를 앞당기고 전체 그래픽 구현을 그 선행 조건에서 뺀다.
- Windows host 변경 중 Web 회귀를 늦게 발견하지 않도록 W9-02를 Windows App SDK와 Web 두 profile의 동등한 최소 수직 연결로 나눈다. 공통 계약 변경은 세 실행 경로에서 같은 묶음으로 검증한다.
- 공통 계층 추출·모바일 RN 분리·GTK/AppKit prototype을 한 선행 단계로 묶지 않는다. 1차에서는 Windows RNW의 필요한 OS handler와 Windows/Web 공통 경계만 최소 분리하고 후속 플랫폼은 해당 차수에서 연결한다.
- Clock·기본 예산/hold·일반 앱 배포는 초기부터 확인한다. 광범위 cache 최적화는 실제 단계 시간과 재사용 수치를 얻은 뒤 수행하고 reload/복구는 모바일 이식과 분리한다.

### 12.2 Windows/Web 1차 실행 순서

| 순서 | 실행 묶음 | 다음 묶음으로 넘어갈 기준 |
| --- | --- | --- |
| 1 | **W9-00 → W9-06-A**: 현재 공급·API 입력·동기 실행 모델 | 현재 Windows/Web 기준선과 두 target의 유효한 API 검사 입력 확보. 원래 API의 보존 방식·실패 사례·남은 의무를 확인. 호환 실패를 숨기지 않고 실행 모델의 한계를 기록 |
| 2 | **W9-01 → W9-02-A/B**: 최소 공통 경계와 Windows/Web 실행 | 같은 작은 일반 앱이 App SDK host·Web threaded·single-worker에서 실제 C++ 작업·화면·입력·resize·close를 수행. **W9-09-A/10-A**의 기본 예산·clock/시간 계측, **W9-13의 초기 설치·배포 검사**도 이때 연결 |
| 3 | **W9-06-B·W9-05 → W9-07**: 원래 API·그래픽·interaction | Widget 수명·기본 render 연결부터 시작해 각 기능에 필요한 paint/text를 보강하고 layout·gesture·scroll·editing·semantics·list까지 같은 consumer/corpus로 확장. 전체 W9-05 완료를 기다려 Widget 수명부터 막지 않음 |
| 4 | **W9-08**: 두 디자인·SDK 사용 흐름 | Windows와 두 Web profile에서 원래 import·theme·form·overlay·navigation·localization/service 동작. 미이식 항목은 API 의무로 계속 추적 |
| 5 | **W9-09-B/10-B → W9-11-A**: 재사용·pressure·frame·필수 콘텐츠 | 재사용 전후 pixel/geometry와 실제 작업 수·단계 시간 대조. 원래 API에 필요한 animated/texture/platform view와 수명 확인. 추가 raster cache/damage는 측정 근거가 있을 때만 적용 |
| 6 | **W9-12-A**: Windows/Web reload·복구 통합 | 최소 host 연결 뒤부터 개발하고 이때 기능 전체와 통합. 준비 실패·교체·context/device loss·새 session 정책·close/late callback·자원 회수 확인 |
| 7 | **W9-13 → W9-14**: Windows/Web 최종 통합·제품 수락 | 해당 target의 API/동작·전체 설치 조합·두 profile·공급/실행/종료 검증 후 실제 입력·frame/resize 성능과 기본값 전환을 대상별 판정 |

각 묶음에서 같은 공급의 작은 일반 앱과 관련 Testbed 흐름을 확인한다. API·자원·설치 검사는 마지막에 처음 실행하는 검사가 아니라 초기 연결부터 넓혀 가는 검사다. 물리 입력과 사용감도 실행 가능한 묶음에서 조기에 확인하되 최종 제품 수락은 W9-14에서 별도로 판정한다.

### 12.3 단계별 범위와 완료 조건

| ID | 차수·작업 | 선행·완료 조건 |
| --- | --- | --- |
| W9-00 | **1차** 기준선·공급·API 판정 입력 | 현재 diff/source/dist·원래 공개 표면·Windows/Web의 OS/ABI/toolchain/browser·배포/manifest/capability·corpus 확인. [§4.1](work9-1.md#41-windows-rnw-소스-선별-재사용) RNW 후보의 필요 사례·도입/참고 범위·출처/의존성 고정. 현재 공급으로 필요한 core/host/runner 기준선을 확인한 뒤 검사 입력을 target별 정상화. `inputValid=true` 확보와 실제 호환 잔여 목록을 분리. 모바일 원본 고정·GTK/Apple 환경은 후속 |
| W9-06 | **1차 A** 실행 모델 검증 → **B** 원래 Widget/Element/Render API | A는 W9-00 후 기존 구현에서 State/Key/context·동기 controller/custom hook의 보존 가능 의미를 증명. B는 A와 W9-01/02 후 수명·parent data·NACK/예외·재진입을 구현하고 필요한 W9-05 항목과 기능별 연결. UI/Content의 App 동기 대기·숨은 fallback으로 통과시키지 않음 |
| W9-01 | **1차** 최소 embedder·runtime/provider 경계 | W9-00와 W9-06-A의 설계 결과. Windows/Web에 필요한 owner·mailbox·provider·입력/mirror·generation·close와 선택한 RNW OS handler만 최소 분리. 새 Windows 경로의 RN 앱 객체 의존성을 제거하고 기존 ACK/NACK·snapshot/ledger·오류/cleanup 회귀 유지. 모바일 helper 추출이나 후속 OS 구현을 요구하지 않음 |
| W9-02 | **1차 A** Windows App SDK·**B** Web 수직 연결 | W9-01. A는 실제 AppWindow/dispatcher·Vulkan scene·TSF/UIA·DPI/resize·hide/restore·drain·unpackaged 소비 실행. B는 Chrome·Edge의 두 profile·DOM/ARIA·DPR/resize·실패/close corpus. 작은 공통 앱부터 시작하고 실제 C++ 작업과 host identity 확인 |
| W9-05 | **1차** Canvas/Paint·rich text/font | W9-01과 W9-06-A. 작은 scene의 protocol/provider부터 확장하고 Windows/Web에서 같은 API·pixel·UTF-16/RTL/placeholder/query·invalidation corpus 실행. W9-06-B/07에 필요한 항목부터 연결해 전체 표현력과 자원 거부/회수까지 완성 |
| W9-07 | **1차** Layout·scroll/gesture·editing·semantics·list | W9-06-B 및 해당 기능의 W9-05, 실제 peer는 W9-02. Intrinsic/dry/baseline·invalidation·motion·lazy focus·range/action·동기 controller 의미를 공통 core와 Windows UIA/TSF·Web DOM/ARIA에서 확인. GTK/AppKit/모바일 peer는 후속 |
| W9-08 | **1차** Material/Cupertino·SDK API | W9-06-B/07 및 필요한 W9-05. 원래 constructor/default/theme/icon/form/route/overlay·localization/service/platform API별 사례를 Windows/Web에 연결. 미이식 import 거부를 호환 구현으로 교체하고 원래 공개 분모 유지 |
| W9-10 | **1차 A** clock·관측 → **B** 전체 frame 일정 | A는 W9-02의 각 host 최소 실행과 함께 display 수요·input wake·idle·숨김/복귀·build/content/raster/submit 시간 관측. B는 기능 확장 후 같은 조건의 frame/credit·지연 중 진행을 통합 검증. GTK/AppKit clock은 해당 후속 host에서 연결 |
| W9-09 | **1차 A** 기본 예산/hold → **B** preparation 재사용·pressure | A는 W9-01/02부터 신규 자원·실패/교체/close를 ledger에 연결. B는 W9-05와 W9-10-A 후 실제 병목을 기준으로 Picture/paragraph/image 재사용·무효화·pressure 회복과 재기록/shaping/decode 수 감소 확인. RSS/VRAM 측정 한계 명시 |
| W9-11 | **1차 A** 원래 API의 animated/외부 콘텐츠·**추가 B** cache/damage | A는 W9-05/09-B/10-A와 필요한 W9-07 후 Windows/Web의 API별 필수 기능·texture/platform view 입력/semantics·수명 검증. 요구 기능 미지원은 호환 gate 실패. B는 측정 근거가 있을 때 적용하고 full redraw pixel·무효화·회수 대조; 근거가 없으면 추가 최적화 보류로 기록 |
| W9-12 | **1차 A** Windows/Web reload·복구 / **2차 B(Android)** / **3차 B(iOS)** | A는 W9-01/02 후 시작, bundle 준비 실패·세대 교체·device/context loss·재생성/새 session·close를 기능 확장과 통합. B는 [§11](work9-2.md#11-web모바일에서-유지할-범위) M0/M1/M2의 RN 소스 분리·standalone 입력/편집/semantics·surface/clock·설치/drain을 대상별 수행. Android는 Windows/Web 1차 완료 후 4부에서, iOS는 Android/Linux 2차 완료 후 5부에서 진행. M3 Web helper는 A/07에서 독립 수행 |
| W9-13 | **대상별** 전체 API·host 통합·배포 | 초기 Windows/Web 설치 검사는 W9-02부터. 1차 최종 판정은 W9-05/06-B/07/08/09/10/11-A/12-A와 W9-02의 전체 corpus, 원래 공개 scope·동작 의무·installed compiler/CLI·두 디자인·전체 Windows/Web package 조합·출처/identity·손상 거부/정리를 요구. W9-03/04/12-B는 1차 선행 조건에서 제외 |
| W9-14 | **대상별** 물리 입력·성능·기본값 전환 | W9-13을 통과한 대상부터 평소 명령·실제 사용자 입력·동일 측정 조건으로 판정. Windows/Web의 결과와 profile별 한계를 기록하고 후속 플랫폼의 flag를 올리지 않음. V1 정리는 해당 제품 gate 후 사용 경로·제거 목록을 확인하는 별도 단계 |
| W9-03 | **2차 / 4부 / DEFERRED** GTK4 수직 연결 | Windows/Web 1차 완료 후 Android와 같은 차수로 W9-01의 계약을 사용해 Linux 공급을 고정. DMA-BUF capability/동기화/FD·게시/geometry·IM/AT-SPI·Wayland/X11·일반 앱/drain. Prototype 실패면 Linux gate 미완료 |
| W9-04 | **3차 / 후속 5부 / DEFERRED** AppKit 수직 연결 | Android/Linux 2차 완료 후 iOS와 같은 차수로 W9-01의 계약을 사용해 Apple 공급을 고정. AppKit/Metal·point/pixel·marked text·NSAccessibility·display/resize·.app 공급/drain을 실제 macOS에서 검증 |

Windows/Web 1차 이후 **2차는 W9-12-B(Android)·W9-03**, 그다음 **3차는 W9-12-B(iOS)·W9-04**로 진행한다. 각 차수의 API·host·공급 통합 완료 뒤 다음 차수에 착수하고, 물리 입력·성능 수락은 W9-14에서 대상별로 구분한다. 해당 host의 W9-05–11 corpus와 W9-13/14를 다시 연결한다. **후속 host에 Windows/Web의 통과를 그대로 복사하지 않는다.** Windows/Web 1차 기술 완료는 해당 API·host·공급 gate의 통과이며 전체 플랫폼 완료나 물리·성능 수락을 뜻하지 않는다.

### 12.4 실행 체크리스트

- [ ] W9-00: 현재 Windows/Web 기준선·고정 공급·원래 API 검사 입력 정상화, RNW 후보의 필요 사례·출처/의존성 고정.
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

## 13. 검증과 판정

**1차 판정은 Windows와 Web 두 profile을 대상으로 한다.** 아래 현재 판정은 이월 상태이며 이번 문서 검토에서 새로 통과시킨 제품 gate는 없다. 원래 공개 API 의무의 target별 적용표를 보존하고 Windows/Web의 통과와 후속 플랫폼 미검증을 별도 기록한다.

| Gate | 차수·통과에 필요한 증거 | 현재 판정 |
| --- | --- | --- |
| 원래 공개 표면·동작 | **1차 Windows/Web**, 후속 대상은 별도. 원래 scope·overload/member/protected/non-code·target별 선언 해석과 installed runtime 동작. 입력·표면·동작을 각각 판정 | **FAIL / 미완료 이월**. Target별 입력 정상화·전체 호환 재판정 미착수 |
| Windows App SDK | **1차** 실제 App SDK 창/dispatcher·Skia 실행·TSF/UIA·입력/resize/종료·배포 identity | **미착수**. 이전 HWND host 구간 통과와 구분 |
| Web | **1차** Windows Chrome·Edge의 두 profile·같은 기능 corpus·비격리 auto·강제 요구/공급 실패·DPR/숨김·재생성/close | **기존 구간 구현 / 전체 PARTIAL**. 새 browser matrix와 최종 통합 미검증 |
| 그래픽·메모리·clock·복구 | **1차 Windows/Web**의 provider 공통 corpus·실제 작업 수·무효화/pressure·bounded hold·clock/credit·단계 시간·reload/loss/close | **기존 구간 구현 / 추가 작업 미착수** |
| 제품 물리·성능 | **1차 Windows/Web**, 후속 대상은 별도. 관측된 장면/입력 source의 실제 조작과 같은 조건의 이동/resize·frame/메모리 측정 | **notVerified**, 두 acceptance flag **false** |
| GTK4 | **2차 / 4부** Wayland/X11 각각 GPU import·게시/geometry·IM/AT-SPI·회수/소비자 실행 | **DEFERRED / 미착수 / notVerified** |
| AppKit | **3차 / 후속 5부** macOS의 AppKit/Metal·IME/NSAccessibility·display/resize·회수/.app 공급 | **DEFERRED / 미착수 / notVerified** |
| Android | **2차 / 4부** arm64-v8a standalone host·[§11.4](work9-4.md#114-android--기존-nelyx-os-코드를-먼저-분리)와 공통 입력/mirror/semantics corpus·surface 수명·설치/실행·drain | **DEFERRED / 소스 검토 / 구현 미착수 / notVerified** |
| iOS | **3차 / 후속 5부** 지정 ABI의 UIKit host·[§11.5](work9-5.md#115-ios--uikit-입력-endpoint와-rn-예외-처리-이식)와 공통 입력/mirror/semantics corpus·scene 수명·설치/실행·drain | **DEFERRED / 소스 검토 / 구현 미착수 / notVerified** |
| RN/RNW 소스 분리·도입 | **1차 Windows RNW·필요한 Web helper**, 모바일은 후속. 고정한 출처·의존성·native/link/bundle graph, RN 앱 runtime 없이 실제 실행. 기존 구현으로 해결한 범위와 실제 도입을 구분 | **RNW 소스 검토 / 추출·실행 미착수**, 모바일 DEFERRED, Web 기존 host 유지 |

1차 Windows와 Web threaded는 App/Content 50/100/200 ms 지연 중 준비 scene의 입력/합성·게시 진행을 확인한다. Web single-worker는 App 독립·Content 유한 분할/동기 점유 후 회복을 따로 판정한다. 무한 동기 작업·lost wake·무제한 queue·scene 역전·미회수 terminal은 어느 profile에서도 허용하지 않는다.

실행 경로는 SDK ACK 명령/transaction·App geometry·거부/fallback 이유와 실제 C++ layout/text/paint/compose 작업을 대조한다. `observed=false`, 작업 0·관측 누락, 수요 없는 control을 성공 수치로 바꾸지 않는다. Build graph나 패키지 이름만으로 C++ 경로의 실행/성능을 인정하지 않는다.

제품 평가는 사용자의 평소 명령과 Gallery 양 열 전체 구간·Mixed 편집 복귀·ListView/Cupertino를 사용한다. 정지→시작→10초 이상 연속→반전→관성→재접촉·resize를 포함하고 물리 precision trackpad와 주입 wheel을 구분한다. 기준/후보 **3쌍**을 기본으로 하고 대부분의 검증은 **30회 이내**로 제한한다. Warm 일반 이동의 60fps 기준·lazy 준비 중 일시 jitter와 준비 뒤 지속 정지를 구분한다. [기존 제품 평가 조건](history/26/11/04/work8-3-summary.md#173-후속-제품-성능-비교--백엔드-완료와-별도-평가)

같은 장면·현재 공급을 Windows App SDK와 실제 Web browser에 연결해 비교하고 주사율·DPI·해상도는 바꾸지 않는다. Web 결과에는 browser·GPU·profile·격리 여부·tab 가시성을 포함한다. Single-worker의 Content 점유 한계와 입력 보존/회복을 threaded와 구별하며 profile 간 동일 성능을 전제하지 않는다.

Surface 갱신·GPU 완료·host publication·물리 display/scanout은 각각 기록한다. 관측하지 않은 scanout은 `unobserved`다. 실제 일반 사용의 체감 수락은 관측된 범위로 판정할 수 있으며 모든 내부 시각을 알아야만 사용자 수락을 기록할 수 있는 것은 아니다.

### 구현 시 사용할 기존 검사 명령

아래는 **현재 존재하는 명령**이다. 이번 문서 검토에서는 실행하지 않았다. 변경한 공개 패키지와 engine 공급을 갱신한 뒤 필요한 범위만 실행하며 host 검사는 현재 소스/공급 identity를 확인한 후 수행한다. W9-00의 기준선은 현재 core/host/runner와 API 입력·audit 상태를 확인하고 이후에는 변경한 기능과 소비 경로에 필요한 검사만 추가한다. 아래 목록을 파일 수정마다 전부 반복하지 않는다.

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

모든 테스트 timeout은 [저장소 지침](.github/copilot-instructions.md)의 **20분**이다. Geometry 변경은 두 입력 geometry 검사를 함께 실행한다. Linux/macOS·모바일 host 검사와 target별 build/doctor/pack 명령은 아직 없으므로 각 host 단계에서 구현하고 도움말·성공/실패 사례를 함께 추가한다. 현재 `build:engine-v2`나 host suite가 새 OS를 검증한다고 보고하지 않는다.

현재 v2 host를 눈으로 확인할 때 쓰는 저장소 명령은 `npm.cmd run run:engine-v2:windows`와 `npm.cmd run run:engine-v2:web`이다. Web 서버의 `/isolated/`·`/plain/`을 각각 확인한다. 이 명령은 현재 Testbed 공급의 실행 경로이며 **App SDK host·원래 API 호환의 완료 증거는 아니다.** 일반 설치 앱의 명령과 배포 검사는 [기존 v2 프로젝트 안내](Nelyx/sdk/README.ko.md#일반-v2-프로젝트)에서 시작하고 W9-02/13에서 새 host에 맞춰 검증·갱신한다.

기존 RNW 기준/후보를 비교할 때는 [저장소 지침](.github/copilot-instructions.md)의 평소 명령·현재 native/SDK 공급과 `run-rnw-cadence.mjs --input-geometry=ts|retained`의 해당 실행 검증을 따른다. Retained 비교에는 Mixed 편집기 작업이 필요하다. Snapshot/Path/clip-Paint/Scene/Semantics 후보의 별도 비교도 지정 audit·3회 functional 실험을 유지한다. **해당 RNW 도구가 새 standalone App SDK host를 측정한다고 가정하지 않는다.** W9-10/14에서 새 host의 동등한 장면·물리 입력·frame/resize 측정 경로를 연결하고 host 변경 효과와 engine 효과를 구분한다.

npm 0xC0000409가 재발할 때만 [기존 한정 조사 절차](history/26/11/05/work8-2a-summary.md#73-재발할-경우의-한정된-조사)를 적용한다. Node/npm real path·version·status와 실패 지점의 근거를 소수 대조로 확인하고 원인 미확정을 통과 기록으로 취소하지 않는다.

## 14. 공급·정리와 문서 운영

현재 source·engine/host ABI·VM/compiler·Skia/CanvasKit·App bundle·설치본의 identity를 연결한다. Host 요구 capability가 없으면 시작 실패로 보고하며 다른 host/TS renderer로 자동 변경하지 않는다. 독립 설치 compiler·설치 CLI·두 디자인·빈 module/non-code 자산까지 검사 분모를 유지한다.

선별 도입하는 RN/RNW/RN Web 코드는 원본 repository·tag/commit 또는 검증한 package integrity·파일 hash·도입/변경 범위·필수 의존성·license/notice를 현재 소스의 고정된 출처 정보로 관리한다. 원래 저작권·license와 해당 파일의 제3자 고지도 공급에 포함한다. 업데이트는 필요한 OS 수정과 실제 corpus를 대조해 진행하며 전체 checkout·이전 source/package 사본·실행별 조사 기록을 누적하지 않는다.

검증용 consumer·archive·browser profile·server/process·GPU/native 임시 자원은 한 실행에 필요한 범위로만 만들고 성공·실패·중단 시 finally에서 정리한다. 현재 dist/package만 남기며 이전 출력·receipt·로그·checkpoint/history JSON·설치본을 누적하지 않는다. `Nelyx/docs/plans/`와 `Nelyx/docs/migrations/`를 생성·복구하지 않는다.

진행 상태·짧은 증거·남은 작업은 해당 분할 문서에 갱신하고 전체 현황·다음 시작점은 [전체 목차](work9.md)에 반영한다. 제품 사용법은 기존 한국어/영어 README에 반영한다. 현재 작업 기록에는 **차수·대상/profile·수행한 검사·남은 의무·다음 시작점**을 적는다. Windows/Web 1차 완료 시 2차 Android/Linux와 3차 iOS/macOS는 계속 DEFERRED로 보존한다. 2차 대상에 착수해도 3차 상태를 올리지 않으며, 각 대상의 W9-03/04/12-B·W9-13/14 결과를 별도로 갱신한다. 닫힌 work8의 과거 수치·실패·공급 경계를 새 결과로 덮어쓰지 않는다. 기술 단계가 끝나도 대상별 API·물리 입력·성능 gate를 따로 남기며, 기본값 변경·기존 host/v1 제거는 검증한 대상과 사용 경로를 확인한 뒤 진행한다.

### 이번 문서 작업의 검증과 다음 시작점

**2026-11-05 KST / Windows·Web 우선·RNW 선별 재검토:** work9만 수정했다. 기존 W9-00–14 **15단계**와 1차 순서를 유지하고 RNW 0.83.2의 설치 소스·기존 Nelyx Windows helper·공식 구조 설명을 대조해 [§4.1](work9-1.md#41-windows-rnw-소스-선별-재사용)의 재사용 후보·의존성·실행 gate를 추가했다. 관련 문서 **14개**의 로컬 링크 **288개**·앵커 참조 **46개**·표 **47개**, 코드 fence·공백·ID/단계 연결과 문서에 적은 루트 npm 명령 **20개**의 존재를 확인했다. `git diff --check`를 통과했다. 시작 시 이미 있던 다른 파일 **13개**의 내용 hash와 work8 원문 **5개**의 삭제 상태를 유지했다.

앞선 work8 이관의 작성일별 요약 5개와 RN 선별 재사용 방침·미완료 경계는 보존했다. 이번에는 RNW 코드 추출을 포함한 제품 소스·공급 변경, 빌드·API audit·runtime·물리 입력·성능 재검증을 수행하지 않았다. **다음 구현 시작점은 W9-00의 현재 공급/기준선·Windows/Web API 검사 입력 정상화와 필요한 RNW 사례/출처 선정이며, 이어 W9-06-A의 동기 실행 모델을 확인한다.**
