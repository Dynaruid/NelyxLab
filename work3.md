# C++ 입력 geometry 모듈과 JSI 연동 작업계획

작성·갱신: **2026-11-02 KST** · 상태: **ACTIVE / READY — work2 종료·이관 완료, C0부터 실행 예정**

**현재 유일한 실행·진행 관리 문서는 work3.md다.** work2는 `CLOSED / SUPERSEDED`로 종료했으며, [work2.md §6](work2.md#6-실행-상태--2026-11-02)은 미커밋 후보·공급 식별·실패·미수락 결과를 확인하는 종료 기록이다. 앞으로 구현·검증·채택/철회·미완료 상태는 이 문서에 갱신하고 work2의 P0~P7을 별도로 재개하지 않는다. `performanceAccepted=false`, `resizePerformanceAccepted=false`와 물리 트랙패드·실제 한국어 IME·scanout의 `notVerified`를 이어받는다. 종료·이관을 구현이나 성능 수락 완료로 해석하지 않는다.

**첫 구현은 입력 geometry의 transform·clip·caret/selection 투영을 처리하는 C++20 모듈과 얇은 JSI 배치 API다.** TS의 Widget/Element/RenderObject·layout·사용자 hook을 유지하고, 숫자로 표현되는 반복 작업부터 옮긴다. C++ 모듈 구현, 일반 제품 적용, 실제 성능 수락을 각각 판정한다. C++로 작성했다는 사실만으로 성능 개선을 수락하지 않는다.

## 1. 출발점과 해결할 문제

### 1.1 현재 근거

아래 수치는 **work2에서 이미 관찰한 기록**이며 이번 계획 작성 중 재측정하지 않았다. 일반 제품과 서로 다른 진단 제품의 값을 같은 실행 결과로 합치지 않는다.

| 관찰 | 기록과 의미 |
| --- | --- |
| 실제 RNW 일반 제품 | 최대화 입력 페이지/focus에서 두 10초 구간 `45.59 / 41.48 surface FPS`. Gallery 좌열 `55.17 / 51.54`, 우열 `50.28 / 51.36`. 모두 좁은 packet-defined 반전이며 전체 범위·기준/후보 3쌍 비교가 아니다. 일반 사용 60fps 미수락 |
| JS callback 진단 | 별도 RNW 진단의 owned callback 중앙값/p95 `17.199 / 35.489ms`. 여러 작은 작업·순회·객체 구성의 기여가 남아 있다. 이 wall time을 순수 연산 CPU 시간으로 해석하지 않는다 |
| 입력 geometry 진단 | 앞선 RNW 진단에서 capture `2.28 / 3.29ms`, publication `1.40 / 1.82ms` 중앙값/p95. 현재 코드에는 공유 조상 변환 캐시와 빈 입력 subtree 생략이 이미 있다. 새 모듈의 예상 절감량으로 이 전체 시간을 계산하지 않는다 |
| native producer | 후속 진단의 완료 대기 중앙값 `7.719ms`. 이미 C++에 있는 worker wall 구간이며 독립 GPU 시간은 미관찰이다. JS 작업과 겹칠 수 있으므로 callback 시간에 더하지 않는다 |
| clock | timer wake lateness 중앙값/p95 `0.333 / 0.647ms`. clock 정밀도·credit 변경을 이번 첫 개선으로 삼을 근거가 없다 |
| 최대화 Gallery 실패 | maximize/restore/maximize 후 우열 선택 픽셀 영역에서 최대 `751.40ms` 정지. 선택 영역이 정적이었던 것인지 전체 surface가 멈췄는지 미분리다. lazy load나 GC로 원인을 확정하지 않는다 |

현재 자료는 **JS 반복 처리 비용을 줄일 이유**를 제공하지만, 산술 연산·GC·JSI 중 하나가 끊김의 단독 원인이라는 증거는 아니다. native producer 병목도 남을 수 있으므로 입력 geometry 하나로 60fps가 된다고 약속하지 않는다.

### 1.2 이어받는 일반 제품

작업 트리 HEAD는 `b2a9b70a49848224af13c0e281e7a84ce2abed15`이고 work2의 소스 변경은 미커밋·성능 미수락 후보다. 이 상태를 C++ 변경 전 기준으로 식별하고, 기존 변경을 정리한다며 원복하거나 새 모듈의 성과로 합산하지 않는다.

| work2에 기록된 식별 | SHA-256 / 정책 |
| --- | --- |
| package manifest | `e40950929ba44af59fa70c2bfcb1503e0f5040667b457c48cb5bfbcce4de98dd` |
| EXE | `8d0789050a3edf481d60ee61f4180fef26f1abc17147ed3de192ae45479a8666` |
| bytecode bundle | `2612e8d3fd082a963b2d5cb8b1be80c4344367e0f901a042f1f7f5ef831f48e8` |
| native inputs | `264631e86c363796511abc2d6de4920050c32cea3ef8b2b73c8a6ebacb81badd` |
| SDK inputs | `91800de8aefc10219e276c2bf1d7c56d1e07f96a22046e413058de068a5cbcca` |
| 원본 Windows App source | `92d045b43f1316023328f5f2f0922f94e8f7395b9f499e29a84983eabb261bfb` |
| compiler policy | `windows-hermes-94aa5e1d-no-cfg-v1` |

실행 착수 때 최신 locator·설치본·실행 파일과 대조한다. 문서의 SHA를 현재 실행 제품 확인으로 대신하지 않는다.

## 2. 모듈 경계와 소스 배치

### 2.1 맡길 작업

| 계층 | 책임 |
| --- | --- |
| TS framework | UI 상태·layout·scroll offset·트리 수명·사용자 hook 평가·입력/semantics 의미·frame 유효성·commit/discard·알림 순서 |
| C++ geometry kernel | 검증된 숫자 snapshot의 조상 transform 합성, bounds·조상 clip 교차, caret/selection rect·baseline 투영, 결과와 변경 여부 계산 |
| JSI adapter | capability/version 확인, 배치 입력의 소유 복사·길이/범위 검증, kernel 호출, 버전이 있는 결과 반환. JS 객체 모델을 kernel에 노출하지 않는다 |
| 기존 native renderer | Skia/Graphite recording·GPU 제출·producer/consumer·retirement. 기존 역할을 유지한다 |

Nelyx에는 이미 [ScenePacket 배치 전송](Nelyx/skia/packages/native/src/scene.ts)과 [C++ display-list 검증·실행](Nelyx/skia/native/adapters/jsi/cpp/api/JsiDisplayList.h)이 있다. 새 비동기 bridge를 제거하는 작업으로 설명하지 않는다. 기존 JSI 설치와 native 공급 경로를 확장하며 별도 DLL·Node addon·다른 VM을 신설하지 않는다.

첫 호출은 **JS owner thread에서 실행하는 동기 배치 호출**이다. 노드·rect·속성마다 JSI를 호출하지 않고 한 geometry transaction의 숫자 작업을 묶는다. 동기 C++ 호출은 JS thread를 점유하므로 “C++이어서 병렬화됐다”고 보고하지 않는다. worker는 독립 native 작업의 이득이 확인될 때만 별도로 검토한다.

### 2.2 수정·신설 위치

아래 신설 경로는 제안이며 아직 파일이 없다. C0에서 명칭을 확정하되 canonical source를 하나만 둔다.

| 위치 | 계획 |
| --- | --- |
| `Nelyx/skia/native/core/input_geometry.cpp`, `Nelyx/skia/native/core/nelyx_skia/input_geometry.h` **신설** | RN·JSI·WinUI·Skia 객체에 의존하지 않는 순수 C++20 숫자 kernel. 현재 core 공급 디렉터리를 사용한다 |
| [core CMakeLists](Nelyx/skia/native/core/CMakeLists.txt), [JSI engine.cmake](Nelyx/skia/native/adapters/jsi/engine.cmake) | 새 translation unit을 core 링크 경로와 `NELYX_BINDING_EMBED_CORE` 경로에 모두 포함. 누락·중복 정의를 검사한다 |
| `Nelyx/skia/native/adapters/jsi/cpp/api/JsiInputGeometry.h` **신설**, [JsiSkApi.h](Nelyx/skia/native/adapters/jsi/cpp/api/JsiSkApi.h) | 기존 runtime 설치 경계에서 내부 capability와 batch API 제공 |
| `Nelyx/src/hosting/input-geometry.ts`, `Nelyx/skia/packages/native/src/input-geometry.ts` **신설** | 중립 서비스 계약과 native adapter. framework가 RN/Skia 패키지를 직접 import하지 않게 한다 |
| [hosting services](Nelyx/src/hosting/services.ts), [hosting runtime](Nelyx/src/hosting/runtime.ts), [SDK bootstrap](Nelyx/sdk/src/runtime/bootstrap.ts), [native-engine](Nelyx/sdk/src/runtime/native-engine.ts) | 선택적 서비스 주입·view별 owner·명시적 disposal. 기존 export와 Skia API 타입도 함께 갱신한다 |
| [rendering/object.ts](Nelyx/src/framework/rendering/object.ts), [widgets/root.ts](Nelyx/src/framework/widgets/root.ts) | `captureInputGeometry`·`commitTextInputGeometries`의 표준 경로 연동, 기존 publication fence 보존 |
| [semantics-pipeline](Nelyx/src/framework/rendering/semantics-pipeline.ts), [semantics-transport](Nelyx/src/framework/rendering/semantics-transport.ts) | 입력 geometry 통합에 따른 token·epoch 정합성 회귀 확인. semantics 전체 이관은 후속 조건부 범위 |
| [prepare-native](Nelyx/skia/eng/prepare-native.mjs), [native-source-inputs](Nelyx/skia/eng/native-source-inputs.mjs), [package-source-inputs](Nelyx/eng/package-source-inputs.mjs) | canonical → generated → dist/설치본 → native/SDK/package 입력에 새 파일·타입·설정이 모두 반영되는지 검증 |

생성된 `generated/core`, `generated/jsi`, 패키지의 binding 사본을 별도 구현 원본으로 편집하지 않는다. Android는 [기존 core CMake 연동](Nelyx/skia/packages/rn/android/CMakeLists.txt), Apple은 [podspec의 core source 포함](Nelyx/skia/packages/rn/react-native-skia.podspec)을 확인한다. Windows 전용 헤더를 공통 kernel에 추가하지 않는다.

### 2.3 이번 1차 범위 밖의 변경

- Widget/Element·reconciliation·layout 엔진 전체 이관, 텍스트 shaping·OS IME·GPU renderer 교체.
- Rust/Cargo/CXX·새 Wasm toolchain, 별도 direct Hermes host·compiler 정책 변경.
- native 전용 scroll offset, compositor만 움직이고 hit-test/layout이 뒤따르는 이중 좌표 체계.
- 새로운 GPU raster/import cache, 큐·Picture·keep-alive 예산 확대, 고정 60fps cap.
- work2에서 철회한 Gallery/Form 분할·전체 Column 캐시·반복문 geometry·compiler·executor/transport 후보의 동시 재도입.

## 3. 데이터·정합성·수명 계약

### 3.1 배치 형식

1. C0에서 입력/출력 schema를 확정한다. header에는 protocol version, view/session 식별, frame 또는 transaction revision, viewport/surface generation, scale, 레코드 수·byte 길이를 둔다. 숫자 본문에는 parent index, transform, local bounds/clip, 편집 geometry epoch, caret·selection·baseline과 출력 index를 둔다. JS 객체·문자열 전체 tree를 직렬화하지 않는다.
2. `double`로 TS Number 정밀도를 유지한다. 행렬 저장 순서·곱셈 순서·좌표 단위·perspective division·clip 경계·빈 rect·비유한 결과의 처리와 기존 epoch 재사용 조건을 TS 기준 구현에 맞춘다. `fast-math`나 임의 float 축소를 사용하지 않는다. 기존 의미가 같은 `-0/+0`을 불필요한 epoch 변경으로 만들지 않는다.
3. 모든 길이·count·offset·index·ID는 정수성·범위·overflow를 cast/allocation 전에 확인한다. C0에서 packet bytes, node/selection 수, depth, view별 보유량의 구체 상한과 초과 시 동작을 정한다. renderer의 display-list 상한을 geometry 상한으로 그대로 복사하지 않는다.
4. JSI 입력은 호출 중 안전하게 native 소유 메모리로 복사한다. 이후 JS getter·재진입·buffer detach/mutation의 영향을 받는 포인터를 저장하지 않는다. 반환 후 JS ArrayBuffer 포인터·`jsi::Value/Object/Function/Runtime&`를 보유하지 않는다. 기존 display-list의 안전 복사를 성능 명목으로 제거하지 않는다.
5. packet 전체 검증 뒤 계산·결과 생성을 수행한다. retained 상태가 있다면 검증된 transaction을 원자적으로 적용한다. 일부 update 적용 후의 실패를 TS fallback으로 덮지 않는다. 잘못된 protocol/owner/length와 지원하지 않는 custom 경로를 구분한다.

### 3.2 TS 동작과 공개 시점

- 내부 소유 표준 경로만 native 대상으로 증명한다. `Object.freeze`만으로 안전하다고 판단하지 않는다. custom `getTransformTo`, `childTransform`, `visitChildren`, `isDisplayed`, `paintsChild`, `describeApproximatePaintClip`, provider/getter·prototype 교체는 기존 TS 경로를 사용한다. mixed subtree의 평가 순서나 조상 정합성을 보장하기 어렵다면 해당 transaction 전체를 TS로 처리한다.
- custom hook의 호출 횟수·순서·예외·재시도를 바꾸지 않는다. fallback 판별을 위해 부작용 있는 getter를 추가 평가하거나, native 실패 후 같은 hook을 다시 실행하지 않는다. 현재 live child 순회·offscreen 조기 종료·빈 subtree 생략을 보존한다.
- 입력 geometry의 기준은 TS layout과 같은 scroll offset이다. native 결과는 frame token·owner/view·paint version·layout epoch·viewport/surface generation·scale이 현재일 때만 사용할 수 있다. 이전 frame 결과를 최신 caret·hit-test로 공개하지 않는다.
- 현재 post-frame의 `geometryCommit.commit()/discard()`와 그 뒤 semantics publication 순서를 유지한다. frame seal·capture 실패·재진입·stale frame·context loss 때 폐기하며 `didCommitTextInputGeometry` 알림과 오류 전달을 보존한다. pending token으로 읽는 기존 경로도 유지한다.
- GPU admission이 막혀도 필요한 입력/geometry 질의가 기존보다 늦어지지 않아야 한다. semantics 간격을 늘리거나 편집 상태를 미뤄 성능을 얻지 않는다. fully clipped editor의 State/connection은 보존하고 native 입력 surface만 기존 조건대로 철회한다.
- capability가 없는 Web/custom backend는 기존 TS 구현을 계속 사용한다. capability를 선언한 native 제품의 protocol 불일치·stale 공급·잘못된 packet 오류를 조용히 fallback으로 감추지 않는다.

### 3.3 유지 상태와 종료

초기 kernel은 전달된 snapshot만 계산한다. 매 frame 전체 트리를 다시 추출·복사해 kernel만 빨라지는 후보는 총비용 비교에서 걸러낸다. 반복 packet 준비가 이득을 상쇄할 때 C3에서 다음 조건의 retained 숫자 metadata를 도입한다.

- 소유자는 view/session 하나다. TS RenderObject는 계속 authoritative하며 native는 parent 관계·transform·clip·epoch 같은 파생 숫자만 보유한다. 재부모화·detach/dispose·ID 재사용·view 교체·context loss·resize/DPI·visibility·clip/scroll 변경을 모두 무효화 조건으로 정의한다.
- attach/remove/reparent와 dirty 값 변경을 배치로 전송한다. layout/paint 종료 시 이미 아는 변경을 기록하고, 매 frame JS 전체 tree 재순회·C++ 전체 mirror 재구축을 숨기지 않는다. custom 영역을 잘못 재사용하지 않는다.
- ID는 session과 세대로 구분하고 범위 소진을 검사한다. parent cycle·dangling reference·duplicate update·삭제 순서·중간 실패를 검증한다. 예산 초과는 명시한 기존 TS 경로/오류 정책으로 처리하며 상한을 자동 확장하지 않는다.
- native metadata는 JS 객체·RenderObject·callback·GPU resource hold를 소유하지 않는다. 명시적 view/session close에서 해제하고, HostObject GC destructor 실행 시점에 의존하지 않는다. close 후 호출은 거부한다.
- worker 도입은 필수가 아니다. 도입한다면 native snapshot과 native 소유 결과만 사용하고 generation fence·취소·drain·retirement를 추가 검증한다. JS 접근이나 Graphite context의 thread affinity를 넘기지 않는다.

현재 Picture **64-entry / 32MiB**, optional child **16 / Element 2,048**, Gallery capacity **2**, CPU pending **1**·native recording **2**는 유지한다. 새 metadata의 목적·보유량·peak·해제 시점을 별도로 관찰한다.

## 4. 실행 단계와 통과 조건

순서는 **C0 → C1 → C2 → 필요한 C3 → C4 → C5**다. 첫 실행 요청이 오면 분석만 반복하지 않고 C1/C2의 실제 모듈과 통합까지 진행한다. 조건부 확장은 측정 근거가 있을 때만 수행한다.

| 단계 | 작업 | 통과·보류 기준 |
| --- | --- | --- |
| C0 기준·계약 확정 | 현재 dirty state와 일반 제품을 대조한다. 표준 입력 경로의 노드/조상/clip/selection 수와 hook fallback 비율을 확인하고 schema·상한·소유자·초과 정책을 확정한다. 기존 계측에 batch 준비·복사/검증·kernel·반영을 구분할 최소 항목만 보강한다 | 이동 대상과 TS에 남는 작업, 기준 제품·대표 장면·최대화 실패 재현 조건이 이 문서에 명확해야 한다. 언어 속도 추측만으로 후보 범위를 넓히지 않는다 |
| C1 순수 C++ kernel | transform/clip/editor 투영 kernel과 TS 기준 differential harness를 구현한다. 행렬·투영·clip·변경 판정의 의미를 고정한다 | 실제 C++ 결과와 TS 결과의 differential 통과. 수치뿐 아니라 비유한/빈 결과·출력 순서·epoch 유지 조건까지 일치. native fixture 성능만으로 채택하지 않는다 |
| C2 JSI·표준 경로 통합 | 기존 runtime에 batch capability를 설치하고 중립 서비스로 주입한다. 표준 경로의 packet 생성·native 계산·TS 공개를 연결한다. 테스트용 TS/native 선택과 비교 경로는 내부 진단으로 제한한다 | 실제 pinned Hermes/RNW에서 API 실행·TS/native 결과 일치·custom fallback·commit/discard·입력/semantics 수명·종료 통과. packet 준비를 포함한 총비용을 측정할 수 있어야 한다 |
| C3 반복 전송·할당 축소 — 조건부 | C2에서 전체 추출/복사 비용이 이득을 상쇄하면 §3.3의 retained 숫자 metadata·dirty batch를 작은 범위로 추가한다. semantics의 공유 조상 계산이나 scene packet 준비는 남은 기여가 확인될 때 별도 후보로 비교한다 | 각 후보를 분리해 비교한다. native 상태가 틀리거나 총비용/일반 앱 이득이 없으면 해당 확장을 철회한다. scene 전송의 handle 검증·독립 hold·rollback 계약을 훼손하지 않는다 |
| C4 실제 공급·플랫폼 회귀 | canonical/native manifests·현재 dist·runner 설치본·native/SDK 입력·실행 package를 갱신하고 일반 명령의 자동 재빌드를 확인한다. Windows 실제 입력·화면·close, 같은 공통 소스의 Web/Android를 검사한다 | source·설치본·delivered binary가 일치하고 일반 제품에 probe가 없다. Web의 TS fallback과 Android 실제 서비스 경로가 통과해야 한다. Apple/Linux는 소스/공급 확인과 실제 runtime 미검증을 구분한다 |
| C5 RNW 비교·최종 판정 | 동일 조건의 TS 기준/후보 대표 3쌍, 전체 범위 왕복·hover/focus·재클릭 없는 입력·최대화 Gallery 정지를 검증한다. 최종 일반 제품과 철회·미완료 상태를 기록한다 | §5를 충족하면 적용·성능 수락. 모듈만 구현됐거나 지속 60fps 미달·원인 미분리 정지가 남으면 `PARTIAL / performanceAccepted=false`. 이득이 없으면 native 기본 적용을 철회하고 TS 경로를 유지한다 |

C++ 입력 모듈의 구현 완료와 전체 스크롤 문제 해결을 혼동하지 않는다. C3에 진입하지 않은 이유, 철회된 후보, 남은 native producer 비용을 명시한다. 남은 병목이 입력 geometry 밖에 있으면 근거를 기록해 다음 후보를 결정하며 임의의 전체 엔진 이관으로 확장하지 않는다.

## 5. 실제 제품 비교와 수락

### 5.1 같은 조건의 비교

- **Hermes bytecode / optimized / Release만** 사용한다. Static AOT 준비·빌드·실행·전용 검사·성능 비교는 수행하지 않는다. RNW의 현재 Node-API JSI host와 pinned cohort를 유지하며 direct Hermes ABI로 cast하거나 다른 VM/header/compiler/CRT를 섞지 않는다.
- 모니터 주사율·해상도·DPI·동적 주사율·adapter를 변경하지 않는다. work2 최대화 기준은 2560×1459 physical / DPI 192였으며 주 디스플레이 보고 주사율은 165Hz다. 실행 때 실제 조건을 읽고 일치 여부를 적는다. 모든 디스플레이가 같은 설정이라고 가정하지 않는다.
- 같은 샘플 source·화면·버튼 배경/테두리/그림자를 사용한다. 입력 페이지의 단일 eager Column, **편집기 12개·버튼 36개**와 수명을 유지한다. 비교 중 sample 축소·Gallery 분할·기존 후보 on/off를 함께 바꾸지 않는다.
- 새 프로세스의 대표 기준/후보 **3쌍**을 기본으로 하되 동일 제품 조건의 유효한 기존 기준은 재사용할 수 있다. 장면·입력 패턴·관찰 시간·포인터 위치·hover/focus·최대화/복원 조건을 맞춘다. 미수락인 work2의 두 번 좁은 반전 기록은 완료된 3쌍으로 계산하지 않는다.
- 최종 FPS 구간에는 source probe·상세 native 로그·GDI 캡처를 끈다. 기존 bounded surface counter의 필요한 관찰만 사용하고, 빌드·다른 검사·비교 경로 이중 실행을 timed phase와 겹치지 않는다. 진단 실행은 별도로 한다.
- `TS 추출/준비 → JSI 복사/검증 → C++ 계산 → TS 결과 반영/공개`의 전체 비용·할당·보유량과 실제 surface FPS를 비교한다. kernel microbenchmark·direct native FPS·줄어든 객체 수만으로 RNW 개선을 확정하지 않는다. 겹치는 stage를 합산하지 않는다.

### 5.2 필수 장면

| 장면 | 확인 내용 |
| --- | --- |
| 입력·버튼 페이지 | 최대화 상태의 전체 위↔아래·빠른 반전·반복 이동, no-hover/button-hover/field-focus, 첫/마지막 편집기까지 왕복. 재클릭 없이 후속 입력·전송·횟수·초기화·Back 상태 확인 |
| Gallery | 최대화 좌/우열, button-hover/field-focus, lazy 영역 통과·전체 범위 복귀. 폭·포인터 위치를 기록하고 입력이 실제 해당 scroll 영역에 전달됐는지 확인 |
| 최대화 정지 재현 | work2의 maximize/restore/maximize와 우열 X 약 66.7% 조건을 유지해 별도 진단한다. scroll offset·frame identity·surface counter·여러 움직이는 영역을 연결해 정적 표본과 전체 정지를 분리한다. 기존 실패를 기본 회귀에서 제외했다는 사실로 해결 처리하지 않는다 |
| 편집·IME·접근성 | 선택/caret/clip·스크롤 뒤 편집·화면 밖 native 입력 surface 철회/복귀·semantics/action revision·DPI/resize/visibility. 실제 한국어 IME 조합을 에이전트가 시도하고 Unicode 삽입과 구분한다 |
| 정상 종료·오래된 결과 | minimize/restore·context loss·빠른 close, late semantics·미완료 transaction·detach/reparent·view 교체. native drain·정상 exit·metadata 해제와 기존 shadow 연속성을 확인 |
| 다른 backend | Web catalog·route/편집 상태와 TS fallback, Android 최신 Release 설치본의 전체 이동·입력·Home/복원·close. Android 빌드는 작업 프로세스의 Temurin 21.0.11을 사용하고 환경을 복원한다 |

### 5.3 판정

**현재 모니터 설정에서 일반 사용의 지속 이동·hover/focus가 60 surface FPS 이상**이어야 한다. lazy load 중의 일시적 jitter는 허용하며 해당 구간과 이유를 별도 기록한다. 최대 주사율의 매 주기를 채우거나 60fps cap을 추가하지 않는다. 대표 반복 결과가 지속적으로 60fps 미만인 장면을 전체 평균으로 가리지 않는다.

FPS는 실제 관측한 surface 갱신 수/이동 시간으로 표기한다. callback·제출·producer·스크린샷 수를 표시 FPS로 사용하지 않는다. 정지·숨김·누락 구간과 전체 범위/좁은 반전을 구분한다. surface FPS 수락이 물리 trackpad·scanout 확인을 뜻하지 않으며, scanout 추가 입증이나 사용자의 추가 체감 승인을 완료 조건으로 요구하지 않는다.

최대화 Gallery의 751.40ms 관찰은 원인과 재현 여부를 판정할 때까지 열린 실패다. 실제 정지면 수정·재검증하고, 정적 영역 표본 문제면 같은 조건의 다른 움직임 증거로 설명한 뒤 검사 자체를 보정한다. 근거 없이 lazy jitter 허용 항목으로 옮기지 않는다.

정확성·수명·입력 회귀가 있거나, 전송/반영까지 포함한 이득이 없거나, 일반 앱 성능을 악화시키면 해당 C++ 적용 후보를 철회한다. 개선됐어도 60fps 미달이면 수치와 병목을 남기고 `PARTIAL`로 둔다. 기존 `resizePerformanceAccepted=false`, 물리 입력·실제 IME·scanout의 미관찰을 문서 수정으로 통과시키지 않는다.

## 6. 검증 명령과 실행 규칙

일반 제품 실행은 다음 명령을 기준으로 한다.

```powershell
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

`run:windows`는 마지막 package 설정을 유지한다. C0에서 locator가 bytecode / optimized / Release인지 확인하고 다르면 아래 명시적 설정으로 빌드한 뒤 일반 명령으로 재검증한다.

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run build -- --engine hermes --hermes-mode bytecode --hermes-profile optimized --configuration Release
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

C1에는 실제 C++ kernel을 호출하는 differential fixture를 추가한다. identity/translation/scale/rotation·중첩 clip·perspective·빈/완전 clip·큰 유한 값·비유한 값·selection 복수 rect·epoch 재사용·잘린 packet·overflow·owner/version 오류를 포함한다. C2/C3에는 getter/재진입·custom fallback·stale frame·부분 실패·detach/reparent/dispose·late close 회귀를 추가한다. TS 결과를 다시 TS로 계산하는 mock만으로 native 검증을 대신하지 않는다.

기존 검사는 변경 범위에 맞춰 선택하고, 겹치는 fixture는 작은 묶음과 전체 묶음에서 불필요하게 반복하지 않는다. 다음은 실행 단계에서 사용할 명령이며 **이번 문서 작성에서는 실행하지 않는다.**

```powershell
# geometry·painting·frame 계약
npm.cmd run test:paint-recording
npm.cmd run test:windows-animation
npm.cmd run test:scroll-engine
npm.cmd run test:native-paint-replay

# 편집 geometry·semantics·종료와 native 시각 회귀
npm.cmd run test:windows-input
npm.cmd run test:windows-semantics
npm.cmd run test:native-shadows
npm.cmd run test:windows-continuous-scroll

# 타입·현재 공급
npm.cmd run check:types
npm.cmd run test:runner-supply
```

`check:types`의 기존 workspace metadata 검사와 Static AOT 실행/전용 검사를 구분한다. 최대화 Gallery 확장 실패를 기본 연속 스크롤 검사 통과로 대체하지 않는다. 새 kernel 검사 명령은 C1에서 실제 harness와 함께 등록하며, 현재 존재하는 명령처럼 문서에 가정하지 않는다.

[저장소 지침](.github/copilot-instructions.md)에 따라 테스트 timeout은 **1,200,000ms**, 반복은 대부분 **30회 이내**로 유지한다. 실행 소유 임시 디렉터리·스크립트·진단 산출물·staging은 성공/실패/중단 모두 `finally`에서 정리한다. 이전 package/SDK/cache 복제·검증 로그·immutable receipt·checkpoint/history JSON·browser profile을 누적하지 않는다. 현재 dist와 필요한 최신 공급만 유지하고 기존 사용자 소유 산출물을 광범위하게 삭제하지 않는다. 계획·상태는 이 문서에 짧게 갱신하며 `Nelyx/docs/plans/`·`Nelyx/docs/migrations/`를 만들지 않는다.

## 7. 현재 상태와 다음 시작점

- [x] work2를 `CLOSED / SUPERSEDED`로 종료하고 이후 실행·진행 관리를 work3으로 전환했다. 종료 당시 실패·미수락 결과는 work2에 보존했다.
- [x] work2의 최종 일반 제품·미수락·최대화 Gallery 실패를 이관하고 C++ 모듈 범위·JSI/수명·수락/철회 기준을 작성했다.
- [ ] C0: 현재 작업 트리·일반 제품 대조, schema·상한·owner 확정.
- [ ] C1: 순수 C++ 입력 geometry kernel과 실제 native differential 검사.
- [ ] C2: 기존 JSI·중립 서비스·TS 표준 경로 통합.
- [ ] C3: 측정으로 필요성이 확인된 retained 숫자 metadata·dirty batch 또는 후속 확장. 비진입 이유도 기록.
- [ ] C4: 현재 source/dist/설치본/native/SDK/package 공급과 Windows/Web/Android 회귀.
- [ ] C5: 실제 RNW 대표 3쌍·전체 범위·입력·최대화 정지 판정과 최종 일반 제품 수락.

**다음 실행은 work3의 C0 → C1 → C2 순서로 진행한다. 현재는 문서 종료·이관만 반영했으며 C++/TS 구현, native 준비·빌드·앱 실행·성능 측정은 아직 시작하지 않았다.**
