# C++ 배치 처리·Scene 합성·Semantics geometry 구현·평가

작성·갱신: **2026-11-02 KST** · 상태: **D0~D6 구현·후보 평가·정리 종료 / 제품 PARTIAL — 기본 적용 전부 철회. 지속 60fps·전체 범위 복귀 입력·최대화 Gallery 실패 미해결**

**후속 작업은 §11의 E0 기준 대조 → E1 Windows 입력 복귀 오류 → E2 최대화 Gallery 정지 → E3 결합 후보 GPU 할당 실패 순서다.** E4 공급·회귀·정리는 각 단계에 적용한다. 이번 갱신은 후속 계획 정리이며 E0~E4 구현·재검증은 아직 착수하지 않았다.

**현재 유일한 실행·진행 관리 문서는 work3.md다.** work2는 `CLOSED / SUPERSEDED`로 종료했으며, [work2.md §6](work2.md#6-실행-상태--2026-11-02)은 미커밋 후보·공급 식별·실패·미수락 결과를 확인하는 종료 기록이다. 앞으로 구현·검증·채택/철회·미완료 상태는 이 문서에 갱신하고 work2의 P0~P7을 별도로 재개하지 않는다. `performanceAccepted=false`, `resizePerformanceAccepted=false`와 물리 트랙패드·실제 한국어 IME·scanout의 `notVerified`를 이어받는다. 종료·이관을 구현이나 성능 수락 완료로 해석하지 않는다.

**§9의 D0 → D1 → D2 → D3 → D4 → D6 순서로 구현·검증·비교·철회를 마쳤다.** D5는 이미 C++인 producer 완료 대기의 비용을 별도로 확인했다. 모듈 구현·후보 평가 종료와 일반 제품·실제 성능 수락은 구분하며, 최종 근거·실패·잔여 작업은 §10을 따른다.

§1~§8은 1차 입력 geometry C++/JSI 구현의 계약·실행·철회 기록이다. 대표 화면이 TS fallback이어서 C++ kernel의 실제 성능을 비교하지 못한 결과를 보존한다. 입력 geometry 기본 주입은 계속 꺼 두고, 새 후보는 캡처된 숫자·명령을 넘기는 경계부터 구현한다. **현재 실행 결과는 §10에 갱신한다.**

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

문서 작성 당시 HEAD는 `b2a9b70a49848224af13c0e281e7a84ce2abed15`였다. 실행 착수 시 HEAD는 `86a1730cd494eb170d9d531fdc36eea23ffd17a2`, 작업 트리는 clean이었다. 이 최신 소스를 C++ 변경 전 기준으로 식별한다. work2의 성능 미수락은 계속 유효하며 기존 변경의 효과를 새 모듈 성과로 합산하지 않는다.

| work2에 기록된 식별 | SHA-256 / 정책 |
| --- | --- |
| package manifest | `e40950929ba44af59fa70c2bfcb1503e0f5040667b457c48cb5bfbcce4de98dd` |
| EXE | `8d0789050a3edf481d60ee61f4180fef26f1abc17147ed3de192ae45479a8666` |
| bytecode bundle | `2612e8d3fd082a963b2d5cb8b1be80c4344367e0f901a042f1f7f5ef831f48e8` |
| native inputs | `264631e86c363796511abc2d6de4920050c32cea3ef8b2b73c8a6ebacb81badd` |
| SDK inputs | `91800de8aefc10219e276c2bf1d7c56d1e07f96a22046e413058de068a5cbcca` |
| 원본 Windows App source | `92d045b43f1316023328f5f2f0922f94e8f7395b9f499e29a84983eabb261bfb` |
| compiler policy | `windows-hermes-94aa5e1d-no-cfg-v1` |

위 표는 1차 실행의 기준이다. D0의 출발 제품은 §8.3의 최종 일반 제품이며, 실행 착수 때 최신 HEAD·dirty state·locator·설치본·실행 파일과 다시 대조한다. 현재 미커밋 구현을 보존하고 문서의 SHA를 현재 실행 제품 확인으로 대신하지 않는다.

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

아래 신설 경로에 구현했다. canonical source는 하나만 두며 실제 공급·검사 결과는 §8에 기록한다.

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

## 4. 1차 C0~C5 실행 단계와 통과 조건

1차 실행은 **C0 → C1 → C2 → 필요한 C3 → C4 → C5**로 진행했으며 결과는 §8에 기록했다. 다음 구현 요청은 §9의 D0부터 시작한다. C0~C5의 완료한 구현을 다시 시작하거나 철회한 기본 주입을 자동 복원하지 않는다.

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

`run:windows`는 마지막 package 설정을 유지한다. D0에서 locator가 bytecode / optimized / Release인지 확인하고 다르면 아래 명시적 설정으로 빌드한 뒤 일반 명령으로 재검증한다.

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run build -- --engine hermes --hermes-mode bytecode --hermes-profile optimized --configuration Release
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

C1에는 실제 C++ kernel을 호출하는 differential fixture를 추가한다. identity/translation/scale/rotation·중첩 clip·perspective·빈/완전 clip·큰 유한 값·비유한 값·selection 복수 rect·epoch 재사용·잘린 packet·overflow·owner/version 오류를 포함한다. C2/C3에는 getter/재진입·custom fallback·stale frame·부분 실패·detach/reparent/dispose·late close 회귀를 추가한다. TS 결과를 다시 TS로 계산하는 mock만으로 native 검증을 대신하지 않는다.

기존 검사는 변경 범위에 맞춰 선택하고, 겹치는 fixture는 작은 묶음과 전체 묶음에서 불필요하게 반복하지 않는다. 아래는 선택 가능한 명령이며 실제로 실행한 검사와 그 한계는 §8에 기록했다.

```powershell
# geometry·painting·frame 계약
npm.cmd run test:input-geometry
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
- [x] C0: 현재 작업 트리·일반 제품 대조, schema·상한·owner 확정. 아래 실행 기록 참조.
- [x] C1: 순수 C++ 입력 geometry kernel과 실제 native differential 검사.
- [x] C2 구현: 기존 JSI·중립 서비스·증명 가능한 TS 표준 경로 통합. 실제 RNW API 실행, C++ 편집기 fixture 통과. 대표 제품의 기본 적용은 아래 사유로 철회했다.
- [x] C3 판정: 비진입. 대표 화면은 안전성 검사에서 전체 TS fallback이므로 반복 packet 준비가 현재 병목이라는 근거가 없다. retained mirror나 예산 확대를 추가하지 않았다.
- [x] C4 공급·회귀: 현재 source/dist/설치본/native/SDK/package 대조와 Windows/Web/Android 실제 실행·입력·종료. 기본 적용은 TS이며 Android C++ projection 직접 실행과 Apple/Linux runtime은 수락하지 않았다.
- [x] C5 후보 평가: 실제 RNW 대표 3쌍, 실제 입력 회귀, 최대화 정지 관측 및 기본 적용 철회 판정.
- [ ] C5 제품 수락: 지속 60fps·전체 범위 왕복·최대화 Gallery 시각 실패 미해결. Windows 실제 한국어 IME는 기본 화면의 한정 통과이며 범위 복귀를 포함한 전체 수락은 아니다. 물리 트랙패드·scanout은 별도 관측 상태로 기록하며 §5.3대로 추가 체감 승인·scanout 입증을 완료 조건으로 요구하지 않는다.
- [x] D0: 현재 제품·대상별 비용·실제 native 적용률과 새 protocol/상한 확정.
- [x] D1 모듈·평가: Path 숫자 명령의 C++ 일괄 생성, 실제 RNW 경로·3회 비교. 기본 적용 철회, 제품 성능 미수락.
- [x] D2 모듈·평가: clip·paint 숫자 명령의 C++ 일괄 생성, 실제 RNW 경로·3회 비교. 기본 적용 철회, 제품 성능 미수락.
- [x] D3 모듈·평가: 기존 Picture를 opaque leaf로 유지한 C++ Scene 합성·변경 배치·수명 검증과 3회 비교. TS source lookup 비용이 남고 입력 평균이 후퇴하여 기본 적용 철회. 장시간 결합 후보 GPU allocation 실패는 미해결.
- [x] D4 모듈·평가: 기존 hook 뒤 숫자 좌표·clip·가시성 suffix를 C++에 연결하고 실제 RNW·differential·3회 비교. endpoint당 한 query의 최소 경계이며 전체 tree 배치 완료가 아니다. 기본 적용 철회, 전체 범위 복귀 입력 FAIL 유지.
- [x] D5: 기존 C++ producer의 import·submit·완료 대기·finish 비용 측정. 독립 GPU/driver 원인 미분리, 안전한 수정 근거 없어 기존 fence 유지.
- [x] D6 평가·정리: 후보별 독립 3회 비교와 철회, 최종 공급·플랫폼 회귀·진단 없는 일반 제품 3회 재측정, 최대화 Gallery·전체 범위 입력 실패 재현과 PARTIAL 판정·소유 산출물 정리. 제품 수락은 C5 미완료를 유지한다.

**후보 구현·비교의 결론은 모두 기본 비활성화다.** 최종 공급의 재진입·소유 검사와 제품 판정·정리를 마쳤다. 다음 제품 작업은 전체 범위 복귀 입력의 TSF 문자 관측 오류, 최대화 Gallery 시각 실패·지속 60fps, 장시간 결합 후보의 GPU allocation 실패 원인 분리다. 구체적인 실행 범위·순서·완료 기준은 **§11**을 따른다. 다음 실행의 첫 구현 대상은 **E1의 편집기 화면 밖 이동·복귀 입력 복구**다. 입력 geometry의 C3 metadata 비진입 결론은 유지한다. 기본 화면 Windows IME의 한정 통과를 전체 입력 수락으로 확대하지 않는다.

## 8. 실행 기록 — 2026-11-02

- **C0 제품:** 일반 명령 `npm.cmd run run:windows --workspace @nelyx/testbed-2`로 기준 제품을 실행해 실제 화면 표시·정상 종료를 확인했다. locator와 manifest/EXE/bytecode는 §1.2의 기존 제품과 일치하고 Hermes bytecode / optimized / Release, 기존 compiler policy다. 실제 측정 창은 2560×1459 physical / DPI 192다. 디스플레이 설정은 바꾸지 않았다.
- **C0/C1 계약:** `Float64` v1, 16-word header(session·owner generation·transaction revision·viewport/surface generation·scale·크기·count/length), 24-word node(parent·6/16-lane transform·edge clip), 12-word editor와 4-word selection이다. 모든 숫자 식별/count/index를 cast 전 검증하며 parent는 앞선 index만 참조한다. 최대 **4MiB / nodes 8,192 / editors 256 / 전체 selection 16,384 / editor별 4,096 / depth 128**. 입력은 JSI 안에서 native vector로 복사하고 전체 검증 뒤 계산한다. 숫자 세션만 유지하고 명시적 close 뒤 호출·오래된 revision을 거부한다. GPU/JS 객체·callback·Runtime 포인터를 kernel/세션에 보유하지 않는다.
- **C1:** 새 `input_geometry.cpp/.h`와 실제 MSVC C++20 fixture를 추가했다. 실제 TS geometry 연산과 비교한 **30개 사례**가 통과했다(affine/4×4·perspective horizon·중첩/완전 clip·복수 selection·큰 값/비유한 결과·잘린 packet·count overflow·depth 상한·owner/version·stale/close·선택적 native timing). node 마지막 lane에 내부 captured transform 여부를 전달해 raw affine의 기존 dense Matrix4 투영/overflow 오류도 보존한다. `/fp:strict`, 다른 CMake compiler의 `-fno-fast-math -ffp-contract=off`를 지정했다. 변경/epoch 판정은 기존 TS JSON key와 `freezeTextInputGeometry`에 남겨 `-0/+0`과 epoch 재사용 의미를 보존한다.
- **C2 공통 통합:** 기존 JSI Api에 version/session capability, native adapter와 중립 `InputGeometryService`, SDK owner/disposal, Root의 기존 commit/discard를 연결했다. 실제 C++ fixture를 서비스 뒤에 연결한 편집기 검사에서 native 호출 **12회**, TS와 같은 값/동일 snapshot identity·epoch, scroll/clip·pending token·commit/discard·custom provider/visitor·prototype 교체 fallback·명시적 close가 통과했다. 계산 중 paint 변경 후 discard 알림과 재진입한 최신 transaction을 이전 결과가 덮거나 삭제하지 않는 fence도 통과했다. 이 검사는 RNW JSI 실행 증거와 구별한다.
- **보수적 경로:** 내부 등록된 hook descriptor와 현재 instance/prototype·parent data를 확인한다. custom hook은 판별을 위해 실행하지 않는다. cold editor나 backend glyph 질의가 필요한 경로, 미등록 clipper/transform·교체 getter는 transaction 전체를 기존 TS로 처리한다. native는 따뜻한 표준 편집기 숫자 snapshot만 묶는다. node/editor/depth 상한은 getter 실행 전 TS 선택, 전체 selection 초과는 이미 읽은 표준 snapshot으로 TS 계산하며 native 실패를 숨기거나 hook을 재실행하지 않는다.
- **진단:** 기존 bounded `FrameDiagnostics`에 extract·packet·JSI·copy/validation·kernel·decode·apply를 구분했다. native 두 duration은 해당 실행의 steady clock으로 측정하며 서로 다른 JS/native clock epoch를 합치지 않는다. 총 input geometry/JSI와 그 내부 구간은 겹치므로 합산하지 않는다. 일반 FPS 실행에는 source probe를 설치하지 않는다.
- **기준 반복:** 새 프로세스 3회, source probe·상세 native 로그·GDI 캡처 없이 기존 surface counter와 OS wheel로 측정했다. 입력 페이지는 maximize/focus, 10초씩 두 방향, Gallery는 maximize·pointer X 66.7%·motion, 5초씩 두 방향이다. packet-defined 좁은 반전이며 전체 범위 수락이 아니다. 모두 exit 0. 입력 FPS는 **44.267/41.500, 44.907/40.316, 43.339/41.814**, Gallery는 **48.556/49.377, 49.968/49.663, 49.739/48.435**다. 이 기준은 §5의 60fps 미달이다.
- **공통 회귀:** paint-recording **169/169**, scroll-engine 및 native-paint-replay(후자는 **69/69**), Windows input **7/7**, semantics **12/12**, workspace type check가 통과했다. AOT 실행/빌드/전용 검사는 수행하지 않았다. 현재 C4/C5·최대화 Gallery 정지·실제 한국어 IME는 아직 미판정이며 `performanceAccepted=false`, `resizePerformanceAccepted=false`다.
- **실제 RNW 반환 경계:** 첫 실제 API 직접 호출 제품(manifest `8f25e202…`, native `8743432f…`)은 `0xc0000409`로 종료했다. 현재 pinned RNW 소스의 `JSI/JsiAbiApi.cpp:462`는 `createArrayBuffer`에서 `VerifyElseCrash(false)`를 실행한다. 해당 실행의 dump 주소/PDB 조회도 `abort → terminate → JsiAbiRuntime::createArrayBuffer → JsiInputGeometry::evaluate`를 확인했다. native external buffer 반환을 철회하고 기존 byte adapter와 같은 VM-owned `Float64Array.buffer` 할당·복사로 변경했다. 생성자/getter 재진입 뒤 buffer 길이와 session revision/close를 확인한다. 수정 제품(native `1fac5489…`)은 실제 pinned RNW에서 `available=true / executed=true / errors=0`, bindings close와 JS shutdown ack, 정상 exit 0을 확인했다. 진단 소스는 finally에서 원복·삭제했다. 진단 제품과 일반 제품을 구분한다.
- **플랫폼 중간 회귀:** 일반 Web build(`application.js` `2ccc65e2…`)와 Chrome의 EditContext/moveBefore 유무·비시각 DOM 입력 **3/3**이 통과했다. Web은 TS 경로다. 최종 native 반환 수정의 Android Temurin 21.0.11 / Release / x86_64 / 기존 `-Og` build·emulator-5554 설치 및 OS 입력·clear/undo·secure/plain·Next/Done·Form·design return **1/1**을 통과했다. 첫 입력 검사는 Gboard 한글 모드가 `XY`를 `툐`로 조합해 ASCII 기대값에서 실패했으며 영문 모드로 전환한 재검사가 통과했다. Unicode 삽입이나 이 ASCII 검사를 실제 한국어 조합 수락으로 해석하지 않는다.

### 8.1 대표 제품 비교와 철회

비교 후보는 probe 없는 일반 제품 manifest `c4deda47652c5dafe086a7891ad3623cc7e1a1822ce5cb410c55644a06c63a47`, EXE `02399e47…`, bytecode `d672bd81…`, native `1fac5489…`다. §8 기준과 같은 창·DPI·명령·hover/focus·관찰 시간의 새 프로세스 3회이며 모든 프로세스 exit 0이다. source probe·GDI 캡처·다른 build/test는 측정 중 실행하지 않았다.

| 장면 / trial | TS 기준 두 방향 surface FPS | 통합 후보 두 방향 surface FPS |
| --- | --- | --- |
| 입력 / 1 | 44.267 / 41.500 | 45.172 / 41.209 |
| 입력 / 2 | 44.907 / 40.316 | 43.646 / 41.858 |
| 입력 / 3 | 43.339 / 41.814 | 44.110 / 40.375 |
| Gallery / 1 | 48.556 / 49.377 | 48.816 / 50.330 |
| Gallery / 2 | 49.968 / 49.663 | 51.929 / 51.542 |
| Gallery / 3 | 49.739 / 48.435 | 46.731 / 50.951 |

입력 산술 평균은 **42.691 → 42.728 FPS(+0.09%)**, Gallery는 **49.290 → 50.050(+1.54%)**이나 이 수치를 C++ kernel 이득으로 채택하지 않는다. 별도 실제 RNW 진단의 입력 화면은 입력 관련 **359개 노드 / providers 12 / cold 0**이며 `paintsChild`, `isDisplayed`, `describeApproximatePaintClip/clips/clipBehavior`, `childTransform`, `childMainAxisPosition/childCrossAxisPosition`의 descriptor가 미증명이라 transaction 전체가 TS다. minified constructor 이름으로 구체 클래스를 확정하지 않는다. 일반 제품에는 이 분포를 수집하는 probe가 없다. 대표 화면 native 적용·60fps 개선의 증거가 없고 preflight 비용만 추가할 수 있으므로 **native-engine의 기본 주입을 철회**했다. 명시적 내부 `NativeEngineOptions.inputGeometry` 또는 중립 서비스 주입으로만 후보를 검사하며 일반 Windows/Android는 기존 TS를 유지한다. capability·C++ 모듈·서비스와 회귀 검사는 보존한다.

custom Animation/clipper/alignment의 getter를 무조건 신뢰하거나 snapshot 순서를 바꿔 커버리지를 높이지 않았다. subtree 단독 commit은 검사 범위 밖 조상을 증명하지 못하므로 전체 TS를 유지한다. C3 metadata·worker·semantics 전체 이관에는 진입하지 않았다.

### 8.2 최대화 Gallery 실패와 실제 입력 경계

기존 helper에 visual 진단 때만 세 독립 화면 영역과 native surface counter·frame·generation을 같이 읽도록 보강했다. FPS 비교의 `-CadenceOnly`에는 GDI 캡처·추가 counter polling이 없다. 기존 350ms 실패 기준을 낮추거나 제거하지 않았다.

`-Page material -WindowTransitions -Maximized -MouseMotion -InputDurationMs 5000 -InputXFraction 0.667`의 두 번째 구간에서 **85.745–1296.567ms(1210.822ms)** 동안 세 영역이 모두 정적이었다. 같은 구간 native **frame 311→358 / surface updates 47 / view 1000 / surface generation 4**이며 native QPC **113384830.8504→113386038.0966**다. 전체 구간의 관측 surface 진행 최대 간격은 **332.967ms**였다. 이는 선택 픽셀 정지를 surface 갱신 중단과 동일시할 수 없다는 근거지만, 이 자료만으로 endpoint clamp·다른 정적 내용·실제 시각 정지의 원인을 확정하지 않는다. **visual 검사는 FAIL 유지**다. 종료는 drain=true, exit 0, hidden 2.128ms였다. 이 별도 캡처 진단의 52.137/50.530 surface FPS를 probe 없는 대표 비교에 합치지 않는다.

일반 명령의 실제 표시를 확인했지만 Computer Use의 좌표 클릭이 창 재선택·활성화 뒤에도 `foreground window did not report a process id`로 반복 실패했다. Tab 뒤의 편집 포커스도 확인하지 못해 확인 없는 창에 조합 키를 보내지 않았다. Alt+F4 종료는 동작했다. 이 도구 실패를 제품의 입력 실패로 확정하거나 Windows IME 통과로 바꾸지 않는다. 전체 범위·Windows 한국어 실제 조합·물리 트랙패드·scanout은 `notVerified`, `performanceAccepted=false`, `resizePerformanceAccepted=false`를 유지한다. Android 실제 조합 시도는 아래에 별도로 기록한다.

### 8.3 최종 공급과 재검증

기본 주입 철회 뒤 실제 RNW 진단을 다시 실행해 **`productionEnabled=false / available=true / executed=true / errors=0`**, bindings close·JS shutdown ack·정상 exit 0을 확인했다. 해당 진단만 숫자 서비스를 명시적으로 만들고 close한다. fixture App 원문 복구·임시 디렉터리 삭제 뒤 일반 명령을 실행했으며 **`Nelyx application or SDK inputs changed; rebuilding the Windows package before launch.`**를 관찰했다. 최종 source의 빈 `onReady`와 원본 App bytes를 유지한다.

| 최종 Windows 일반 제품 | SHA-256 / 값 |
| --- | --- |
| manifest | `9ecfc3911c20111cf2ddf370e07f8d6ad8033cff33a08ef80782e9258c52d388` |
| EXE | `c1b6bdbfcb1553b3edfba4bef6b28888a8d7557159a478c7921c8963a6723b9c` |
| bytecode bundle | `066430c5d07b21120927ca8173f618770ad551333577bed74871817176e83e44` |
| native inputs | `1fac54895fd1dfd0bf77f73dcb94cc4088a182c965149ec953e85ec628757296` |
| SDK inputs | `64ee6392b3589122e8800eb3fe67784adb8233e7c3fb4f669cbac284ca903079` |
| app inputs | `42d31f969fd25625d4b1d5216cb44872e2a95f1e7dc7a735acedf5b5470a629b` |
| mode / policy | Hermes bytecode / optimized / Release / `windows-hermes-94aa5e1d-no-cfg-v1` |

최종 Windows package inventory·pinned runtime 검사를 통과했다. Windows/Android는 core·SDK·skia-native·skia-rn **4개씩**, Web은 core·SDK·skia-web **3개**의 source/dist/설치본 입력이 일치한다. 설치된 native 두 패키지는 각각 canonical **166 files**를 대조했다. Apple podspec의 `generated/core/**/*.{h,cpp}`와 공통 CMake 공급에 새 kernel이 포함되며 Apple/Linux 실제 runtime은 미검증이다.

최종 Web `application.js` SHA-256은 `8e2e8918ce400132922e1ea5a602ca472994f44e20690bf3df6c17f2c79f8f74`, Chrome 입력 **3/3** 통과다. 최종 Android APK는 Release / x86_64 / emulator-vulkan / 기존 `-Og`, **66,185,760 bytes**, SHA-256 `c17f866ba5dab6ea42bc79247f81503a1d1c6c3da5c1b2305aac7a25e5729010`다. emulator-5554 설치 APK의 `sha256sum`과 일치한다. 물리 Samsung 기기는 사용하지 않았다.

마지막 C++ differential **30 cases**와 실제 편집기/native 통합 **12 calls**(subtree 단독 commit의 조상 검사 포함), FrameDiagnostics/RNW probe **19/19**, workspace types, package-boundaries(948 files / design cycles 0), 변경 TS/JS lint·diff 검사를 통과했다. 최종 공급 native 라이브러리의 그림자 **1/1**도 DPR 1/1.25/1.5/2 direct/retained와 Vulkan drain을 통과했다. 이번 실행에서 생성한 이전 native 입력 `f73dfc7a…`, `8743432f…`와 실패 dump는 삭제했으며 현재 `1fac5489…` 및 기존 사용자 소유 출력은 보존했다. 임시 probe·supply staging·검증 로그·receipt archive를 추가 보관하지 않는다.

최종 Windows 일반 명령은 실제 표시와 **exit 0**을 확인했다. 같은 제품의 기존 packaged-interaction 검사에서 OS pointer seed/theme·두 dialog, Material Form UIA 편집·OS Next/Done·저장/reset, route 결과·새 상태·design return이 통과했다. 최종 `test:windows-continuous-scroll`도 **1/1**, 내부 **Material/List/Cupertino/mixed 4개 페이지**의 기본 크기 연속 OS 입력·native drain·종료가 통과했다. 이는 §8.2 최대화/5초 확장 실패나 전체 범위 왕복을 대체하지 않는다. 최종 Android 설치 APK도 OS 입력 회귀 **1/1**을 다시 통과했다.

### 8.4 실제 한국어 IME 시도 — Android 한정

최종 APK / emulator-5554의 기존 Gboard **Korean two-bulsik**에서 편집 포커스를 확인하고 OS **`KEYCODE_G → KEYCODE_K → KEYCODE_S → KEYCODE_SPACE`**를 보냈다. Unicode 문자열 삽입을 사용하지 않았다. 실제 native 입력 endpoint에서 **`ㅎ → 하 → 한 → 한 `**을 순서대로 관찰했고, Core Ctrl+A/delete 뒤 Ctrl+Z로 조합 후 텍스트가 복원되는 ack까지 **1/1** 통과했다. 이 한정된 실제 IME 조합은 확인했으며 Windows IME·물리 키보드·candidate C++ 적용·caret 픽셀 정확성·FPS 수락으로 확대하지 않는다. 검사용 영문 전환은 원래 한글 모드로 복원했고 임시 XML·Metro·sample 앱을 정리했다. 기존 사용자 emulator는 종료하지 않았다.

## 9. 후속 C++ 구현 계획 — D0~D6

### 9.1 목표와 실행 순서

**Path·clip·paint 생성 배치화, Scene 합성, Semantics 좌표 계산을 차례로 C++에 구현하고 실제 RNW에 연결한다.** 분석·API 선언·TS mock 검사만으로 단계를 완료하지 않는다. 각 모듈의 최소 구현과 실제 실행을 먼저 확인하고, 일반 제품 기본 활성화는 총비용·회귀·FPS 비교 뒤 별도로 판정한다. 한 후보의 미채택은 다음 독립 모듈의 구현을 막지 않는다.

순서는 **D0 → D1 → D2 → D3 → D4 → D6**다. D5는 D0에서 기존 native 비용 분리를 시작해 각 후보 진단에서 함께 확인한다. 각 단계는 해당 후보만 바꾼 기준/후보로 비교한다. 앞선 후보를 유지하면 채택 근거와 기준 소스를 명시하고, 미채택이면 그 후보의 기본 연결을 원복한 상태에서 다음 단계로 간다. 여러 변경의 합산 효과를 개별 C++ 모듈 성과로 보고하지 않는다.

현재 [Path 생성](Nelyx/skia/packages/native/src/path.ts)은 JS가 verb마다 native builder를 호출한다. [native Scene 준비](Nelyx/skia/packages/native/src/scene.ts)는 clip·복잡한 paint의 임시 객체를 JS에서 만들며, 단순 fill과 affine transform은 이미 숫자로 배치한다. [LayerRecording](Nelyx/src/ui/scene.ts)은 기존 native leaf/Picture를 재사용하지만 합성·명령 조립 작업이 남아 있다. [Semantics geometry](Nelyx/src/framework/rendering/semantics-pipeline.ts)는 이미 공유 조상 경로 캐시와 translation 빠른 경로가 있다. 이 기존 최적화를 출발점으로 삼는다.

이전 진단의 native submit 전체 중앙값 약 **1.69ms**와 producer 완료 대기 **7.719ms**는 서로 다른 실행의 관찰이다. 이번 문서 구성 중 재측정하지 않았다. 첫 배치화의 개선 폭이나 다른 단계와의 합산 절감량으로 가정하지 않으며, D0에서 현재 비용을 다시 확인한다. work2의 TS 계획 캐시·executor/transport 실험 철회는 유지하고 새 C++ 경계의 차이를 명시한다.

### 9.2 D0 — 기준 제품·실행률·공통 계약 확정

1. §8.3 제품을 출발점으로 HEAD·현재 미커밋 변경·source/dist/설치본/native/SDK/package 입력을 확인한다. 입력 geometry 기본 주입은 끈 상태를 기준으로 한다. 기존 사용자 변경·검증된 공통 수정은 보존한다.
2. §5 장면에서 같은 frame identity로 Path 수/verb 수, clip·paint 종류별 건수, 남은 합성 방문·명령 복사량, Semantics 숫자 노드/edge 수를 집계한다. JSI 호출 수, 임시 native wrapper 생성·폐기 수, 준비·복사/검증·native 처리·결과 반영을 구분한다. 관측하지 않은 GC pause·CPU 시간·GPU 실행 시간을 추정값으로 채우지 않는다.
3. 대상 건수·native 실행 건수·fallback 사유를 bounded 숫자 계측으로 기록한다. 대상이 없는 장면은 `n/a`, 전체 fallback은 `nativeExecuted=0`으로 구분한다. 모듈 직접 호출 fixture와 일반 장면의 적용률을 따로 표기한다. §8의 전체 TS fallback 비교를 native 계산 성능 비교로 재사용하지 않는다.
4. 기존 display-list 경계에 **버전 있는 Path/clip/paint 숫자 table**을 확장하는 계약을 정한다. v1 generic Canvas 경로는 유지하고 새 버전은 별도 capability로 확인한다. 입력 geometry v1과 새 scene schema를 혼용하지 않는다. owner/session·세대·transaction revision·context/viewport/surface·scale·count/byte 길이와 결과/오류 형식을 구현 전에 확정한다.
5. frame의 현재 **4,096 records / 512KiB / layers 32**, Path **4,096 operations**, native display-list **16MiB / commands·handles 각 65,536** 상한을 유지한다. record 확장 비용도 계산한다. D3/D4 파생 metadata는 초기 설계 상한을 **각 서비스의 view/session별 합계 4MiB / live nodes 8,192 / depth 128**로 둔다. committed·staging·in-flight snapshot의 실제 보유 bytes를 합산하고 두 서비스 합계 peak도 보고하며, D0에서 크기 산식·동시 snapshot 보유량·해제 시점을 확정한다. 예산 초과 시 선택 단위를 사전에 TS로 처리하거나 명시적 오류를 내며 자동 확대·조용한 잘라내기를 하지 않는다.

**완료 조건:** 현재 기준 식별, 후보별 적용 대상과 수량, 숫자 schema·상한·owner·실패 정책, 진단/일반 FPS 측정 구분을 이 문서에 기록한다. 계측만 확장하며 끝내지 않고 D1의 최소 C++ 구현으로 이어간다.

### 9.3 D1 — Path 숫자 명령의 C++ 일괄 생성

- TS의 기존 Path mutator·snapshot 확정·외부 값 격리를 유지한다. 캡처된 fill type·verb·operand를 숫자 table로 한 번 전달하고 C++에서 `SkPathBuilder` 순회를 수행한다. drawPath·clipPath·shadow가 같은 frame 안에서 같은 내부 snapshot을 사용하면 table 참조를 공유한다. 새 장기 Path cache나 GPU cache를 만들지 않는다.
- [path.ts](Nelyx/skia/packages/native/src/path.ts), [scene.ts](Nelyx/skia/packages/native/src/scene.ts), [JsiDisplayList.h](Nelyx/skia/native/adapters/jsi/cpp/api/JsiDisplayList.h), [Skia API 타입](Nelyx/skia/packages/native/src/skia/types/Skia.ts)을 연결한다. 숫자 parser/상한 검사는 canonical core, Skia 객체 생성은 canonical native rendering, JSI adapter는 복사·호출·오류 전달에 둔다. 제안 파일명 `scene_packet.cpp/.h`, `scene_build.cpp/.h`는 D0에서 확정하며 generated 사본을 구현 원본으로 편집하지 않는다.
- move/relative move·line·quadratic/cubic/conic·close·다중 contour·rect/oval/rrect·fill rule과 기존 숫자→SkScalar 변환을 보존한다. 빈 Path, 중복 close, 큰 값·비유한 값, 잘린 operand·지원하지 않는 verb·count overflow를 검사한다. 기존 API가 허용/거부하는 경계를 임의로 바꾸지 않는다.
- 실제 C++ 결과를 기존 builder 경로와 비교한다. Path 의미·bounds·그리기/clip/shadow 픽셀, 캡처 뒤 원본 변경, 외부 getter/subclass, 중간 실패·명시적 폐기를 검사한다. native 실패 뒤 같은 JS getter/verb를 재실행하는 fallback은 허용하지 않는다.

**완료 조건:** pinned RNW의 실제 새 batch 경로에서 지원 대상 Path가 실행되고 verb별 JSI 호출 감소·준비/폐기 포함 총비용을 확인한다. C++ correctness, 실제 적용률, 기본 채택 여부를 각각 기록한다. 대상이 적어 일반 앱 이득이 없으면 모듈을 보존하고 기본 연결은 미채택으로 판정한다.

### 9.4 D2 — clip·paint 생성의 C++ 배치화

- D1 schema에 rect/rrect clip과 지원하는 PaintSnapshot 속성을 확장한다. JS에서 `XYWHRect`·RRect·Paint를 만들고 속성마다 호출하던 작업을 C++ replay 준비 단계로 옮긴다. 기존 단순 fill·숫자 transform 경로의 재사용을 유지한다.
- clip op·AA·rrect 모서리별 radius, color/alpha·blend·style·stroke/cap/join/miter, saveLayer/backdrop·지원 filter/shader를 현재 표현과 대조한다. 복잡한 효과는 지원 속성을 명시하며 미지원 여부를 packet 실행 전에 결정한다. unsupported와 malformed/foreign/stale를 구분하고 일부 drawing 후 legacy replay로 재시도하지 않는다.
- 숫자 검증, handle owner/generation 확인, 필요한 독립 hold 획득을 끝낸 뒤 SkCanvas에 적용한다. 임시 SkPaint/SkPath와 image/paragraph/shader 참조는 실제 recording/frame 수명까지 유지하고 rollback·retirement·close에서 해제한다.
- old/new 경로의 clip/save/restore 순서·pixel·그림자·누수·예외를 검사한다. 여러 clip, 중첩 opacity/saveLayer, fractional DPR, 투명/복잡 paint, 잘못된 table index와 해제된/다른 owner의 handle을 포함한다.

**완료 조건:** 실제 Gallery·입력 화면의 clip/paint 유형별 native 실행 건수와 wrapper 생성/폐기·JSI 호출·packet bytes·총비용을 기록하고 D1 효과와 분리해 비교한다. 기능 축소·효과 생략·handle 안전성 완화로 성능을 얻지 않는다.

### 9.5 D3 — C++ Scene 합성과 변경 배치

- [PaintingContext 합성](Nelyx/src/framework/painting/context.ts), [Layer](Nelyx/src/framework/rendering/layer.ts), [SceneBuilder/LayerRecording](Nelyx/src/ui/scene.ts), [FrameRecording](Nelyx/src/ui/frame.ts), [native Scene](Nelyx/skia/packages/native/src/scene.ts)을 경계로 삼는다. 기존 native leaf·immutable Picture 재사용을 유지하면서, 표준 offset/transform·opacity·rect/rrect clip·child 순서의 숫자 합성과 명령 조립을 C++에 구현한다.
- custom Layer/Scene hook은 기존 TS 순서로 평가하고, 소유가 증명된 캡처 값만 넘긴다. **JS에서 이미 전체 합성·flatten을 끝낸 뒤 같은 일을 C++에서 반복하는 경로를 최종 구조로 채택하지 않는다.** native 지원 경계에서는 flatten 전에 캡처된 표준 recording 구조와 변경된 숫자 속성·자식 관계·resource ID를 전달한다. CPU/custom/backend fallback은 같은 소스 의미를 유지한다.
- view/session의 파생 숫자 상태에 create/update/remove/reparent를 배치 적용한다. ID/세대, cycle·dangling·duplicate·삭제 순서, mutation 중 실패를 검증한다. source revision별 불변 snapshot을 만들고 prepare/seal/commit/discard를 연결해 제출된 이전 frame이 뒤의 변경을 읽지 않게 한다.
- Scene metadata는 숫자·명령 bytes·resource 식별을 보유한다. Picture/image/paragraph의 실제 native 참조는 frame별 독립 lease로 확보하며 metadata가 cache eviction을 막는 숨은 GPU hold가 되지 않게 한다. 기존 Core resource admission과 token/owner/estimated bytes 검사를 유지하고 renderer 큐·Picture 예산을 확대하지 않는다.
- 변경은 layout/paint/recording 단계에서 이미 아는 dirty 값으로 수집한다. 매 frame 전체 JS tree 추출·native mirror 재생성의 비용을 숨기지 않는다. custom getter의 전이 의존성까지 증명할 수 없으면 해당 단위를 기존 TS로 처리하고, 지원 경계를 좁혀 적용률을 솔직하게 기록한다.
- differential 명령 의미·동일 픽셀·fractional shadow, scroll·reorder/reparent·detach·eviction·context loss·DPI/resize·visibility·빠른 close·실패 rollback을 검사한다. native state/bytes·동시 snapshot 수·peak와 명시적 close 뒤 해제를 확인한다.

**완료 조건:** 대표 표준 장면에서 실제 C++ 합성이 실행되고 TS planning/명령 복사·native 전송·합성·보유량을 포함한 순이득을 확인한다. 전체 mirror 전송이나 상태 유지 비용이 이득을 상쇄하면 기본 Scene 적용을 철회한다. 기존 TS 계획 캐시를 다시 켠 결과를 새 모듈 효과로 계산하지 않는다.

### 9.6 D4 — Semantics 좌표·clip·가시성의 C++ 계산

- [semantics-pipeline.ts](Nelyx/src/framework/rendering/semantics-pipeline.ts)의 `_SemanticsGeometry.computeChildGeometry`를 기준으로 parent transform·paint/semantics clip·local bounds의 숫자 계산을 배치화한다. 입력 geometry kernel의 공통 수학을 재사용·분리하되 기존의 입력 geometry 기본 주입은 계속 끈다. 의미·node ID·merge/order·focus/value/action 처리는 TS에 둔다.
- 현재 공유 조상 캐시·translation 빠른 경로 이후의 남은 비용을 비교한다. 역행렬·singular/zero·perspective·비유한 값·빈 clip·hidden/sibling bounds와 연산 순서를 기존 TS에 맞춘다. float 축소·fast-math·임의 epsilon으로 결과/epoch를 바꾸지 않는다.
- `applyPaintTransform`·paint/semantics clip·semanticBounds와 그 안에서 읽는 getter, Animation·clipper·alignment·ViewportOffset 등 전이 의존성의 custom 동작을 감사한다. 지원 판별을 위해 custom getter를 추가 실행하지 않는다. hook 호출 횟수·순서·예외·조기 종료를 보존할 수 없는 단위는 전체 TS 경로를 사용한다. 대표 표준 장면이 전부 fallback이면 실제 C++ 성능 비교 전 단계로 남긴다.
- 중립 hosting service와 SDK owner/disposal을 통해 주입하고 frame token·source/configuration/editing revision·layout/paint·viewport/context/surface·scale을 fence한다. 새 native 결과는 기존 geometry commit/discard 이후의 semantics 공개 순서를 따른다. dirty/flushing 경로의 예외·재진입·late result가 최신 snapshot이나 action을 덮지 않게 한다.
- [Semantics transport](Nelyx/src/framework/rendering/semantics-transport.ts), [Windows packet/action 검증](Nelyx/sdk/src/platforms/windows/semantics-packet.ts)과 연결한다. geometry와 무관한 문자열/전체 UIA tree 이관은 포함하지 않는다. quiet/300ms 정책을 늘리거나 최신 좌표·value/focus/action revision을 생략해 비용을 줄이지 않는다.

**완료 조건:** 실제 C++ differential과 pinned RNW의 표준 Semantics 경로를 통과하고 native 노드/edge 수·fallback·추출/전송/공개 총비용을 확인한다. 화면 밖 입력 surface 철회·복귀, 첫/마지막 편집기 전체 이동 후 재클릭 없는 입력, stale action 거부와 reader/IME 관측 범위를 분리한다. 적용 이득이 없으면 기본 주입을 철회한다.

### 9.7 D5 — 기존 C++ producer 완료 대기 원인 판정

대상은 [GpuContext::renderWin32Frame](Nelyx/skia/native/platforms/vulkan/gpu_context.cpp), [Vulkan device/import](Nelyx/skia/native/platforms/vulkan/device.cpp), [Windows frame trace](Nelyx/skia/packages/rn/native/windows/WindowsFrameTrace.h)다. 이 구간은 이미 C++이므로 신규 TS→C++ 이관 성과와 구분한다.

- 같은 frame의 import·replay/submit·completion wait·context/Recorder 준비·finish/retirement, worker/UI 복귀 지연을 분리한다. D1~D4가 JS 준비를 줄여도 실제 critical path가 남는지 확인하며 겹치는 wall 구간을 합산하지 않는다.
- import·Recorder 준비·불필요한 동기화가 원인으로 확인되면 해당 기존 C++ 코드의 작은 수정으로 따로 비교한다. 독립 GPU 실행 시간은 실제 timestamp가 없으면 `unobserved`다. 대기 시간만 보고 GPU 병목·GC·driver 원인을 확정하지 않는다.
- fence/완료 확인·독립 hold·drain을 유지한다. wait 삭제·무확인 재사용·큐/recording 확대·새 import cache·compiler 정책 변경을 대기 회피 수단으로 사용하지 않는다. 안전하고 유효한 수정 근거가 없으면 측정된 잔여 비용과 원인 미분리를 기록한다.

**완료 조건:** 현재 producer 비용과 각 C++ 후보의 영향, 확인된 원인/미관찰, 수정 여부·별도 비교 결과를 기록한다. 비용이 남는다는 이유만으로 임의의 renderer 전면 교체로 확대하지 않는다.

### 9.8 공통 소유·오류·공급 계약

- canonical 위치는 숫자 schema/parser·기하 계산을 `Nelyx/skia/native/core`, Skia 생성/합성을 `Nelyx/skia/native/rendering`, 얇은 JSI 경계를 `Nelyx/skia/native/adapters/jsi/cpp/api`에 둔다. [native CMake](Nelyx/skia/native/CMakeLists.txt), [core CMake](Nelyx/skia/native/core/CMakeLists.txt), [JSI engine.cmake](Nelyx/skia/native/adapters/jsi/engine.cmake)의 standalone/embed 경로를 함께 확인한다. framework는 RN/Skia를 직접 import하지 않으며 새 Scene/Semantics 서비스의 중립 계약·native adapter 이름은 D0에서 확정한다.
- 모든 byte/count/offset/index/ID의 정수성·범위·overflow를 allocation/cast 전에 검사한다. JSI 입력은 native 소유로 복사하고 전체 검증·handle admission 뒤 적용한다. §8에서 확인한 RNW external ArrayBuffer 실패를 반복하지 않도록 결과 buffer는 VM-owned storage를 사용하며 생성자/getter 재진입 뒤 길이·owner/revision/close를 재검증한다.
- native 숫자 상태에 JS 객체·callback·Runtime 포인터를 보유하지 않는다. native Skia 객체·frame 참조에는 명시적 소유자·세대·close/retirement가 있어야 한다. protocol 불일치·stale 공급·부분 실패를 조용한 legacy fallback으로 숨기지 않는다. worker는 실제 이득과 affinity 계약이 확인될 때만 별도 확장한다.
- D1~D4의 내부 진단 선택과 capability 범위를 분리해 후보별 효과를 비교한다. 일반 제품에는 판정된 기본 조합만 반영하며 실험 선택을 사용자 화면·설정 흐름에 노출하지 않는다.
- Picture **64-entry / 32MiB**, optional child **16 / Element 2,048**, Gallery **2**, CPU pending **1**·native recording **2**를 유지한다. 새 숫자 metadata는 별도 peak/bytes·동시 snapshot·close 후 해제를 계측하며 이 상한과 기존 resource 비용을 함께 보고한다.
- canonical → generated → 현재 dist → runner 설치본 → native/SDK/package → 실제 실행 제품을 대조한다. Windows 고정 cohort/JSI/CRT·bytecode 정책, Web TS fallback, Android Release/x86_64/Temurin 21.0.11·기존 `-Og`를 유지한다. Apple/Linux는 공급·source 검사와 실제 runtime 미검증을 구분한다.

### 9.9 D6 — 단계별 검사·대표 비교·최종 판정

1. **구현 검사:** D1/D2는 실제 C++ 생성 결과·픽셀·오류/handle 수명, D3는 합성 명령·불변 snapshot·delta/rollback·메모리, D4는 실제 C++ 기하 결과·commit/discard·Semantics/action을 검사한다. 새 테스트 파일·npm 명령은 해당 harness 구현과 함께 등록하며 현재 존재하는 실행 명령처럼 가정하지 않는다. §6의 기존 검사는 변경 범위에 맞춰 선택한다.
2. **실제 적용 확인:** pinned RNW에서 새 API 및 대표 표준 장면의 해당 경로가 실제 실행됐는지 계측한다. 전체 대상/지원 대상/native 실행/fallback을 구분하고 cold/warm을 기록한다. direct API 한 번의 성공이나 미등록 hook으로 전체 TS fallback인 결과만으로 일반 제품 연결을 완료하지 않는다.
3. **비용·FPS 비교:** 후보별 준비·할당·JSI 호출·복사/검증·native 처리·반영·보유량과 native producer를 구분한다. 같은 일반 제품 조건의 새 프로세스 대표 **3쌍**을 비교하고 유효한 기준을 재사용할 때 source/설정·조건 일치를 확인한다. 단일 현재 공급만 유지하며 측정 중 source probe·상세 로그·GDI 캡처·이중 경로·다른 build/test를 끈다.
4. **제품 확인:** §5의 Gallery 좌/우열·입력 12개/버튼 36개·전체 범위 왕복·빠른 반전·hover/focus·재클릭 없는 입력·Windows 실제 IME 시도를 수행한다. 최대화 시각 실패는 scroll offset·frame identity·surface counter·복수 움직임 영역으로 원인을 판정한다. Android 조합 확인을 Windows IME 수락으로 확대하지 않는다. 정상 close/drain·late callback·context loss·DPI/resize·기존 그림자와 Web/Android 최신 설치본을 검증한다.
5. **채택·철회:** 정확성·수명·입력 회귀가 있거나 전송/반영까지 포함한 순이득이 없으면 그 후보의 기본 연결을 철회한다. 실제 native 적용 없이 C++ 성능을 판정하지 않는다. 개선됐어도 대표 지속 이동·hover/focus가 **60 surface FPS 미만**이거나 최대화 시각 실패가 남으면 전체 상태는 `PARTIAL / performanceAccepted=false`다. resize·물리 입력·scanout의 기존 관측 한계는 별도로 유지하며 추가 사용자 승인·scanout 입증을 완료 조건으로 신설하지 않는다.
6. **기록·정리:** 이 문서의 현재 상태에 D1~D4별 `구현 검사 / 실제 적용률 / 기본 채택·철회 / 성능 수락`을 분리해 남긴다. 기준/후보 source·제품 식별, 핵심 수치·잔여 병목·최종 일반 명령을 기록한다. 테스트는 **1,200,000ms**, 반복은 대부분 **30회 이내**, 소유 임시 파일·fixture·staging·진단 프로세스는 성공/실패/중단 모두 `finally`에서 정리한다. 기존 미커밋 변경을 보존하며 검증 로그·receipt·과거 package/SDK 사본을 추가 축적하지 않는다.

## 10. D0~D6 실행 — 2026-11-02 KST

- 착수 HEAD `d576ad533846458a3eff4dbcffe6fb89e9318897`, clean. §8.3의 manifest `9ecfc391…`, native `1fac5489…`, SDK `64ee6392…`, bytecode `066430c5…`가 현재 locator·전체 package inventory·pinned runtime과 일치했다. source/dist 및 native canonical 166 files/package도 일치했다. 입력 geometry 기본 주입은 계속 꺼 둔다.
- D0 기준: 같은 2560×1459 physical / DPI 192, 새 프로세스 3회, probe·GDI 캡처 없이 기존 surface counter와 OS wheel. 입력(maximize/focus, 10초씩) **49.853/45.587, 51.631/47.668, 52.783/47.833**, Gallery(maximize/right hover, 5초씩) **54.038/51.777, 53.923/55.411, 54.895/54.093 surface FPS**. 전부 exit 0. packet-defined 왕복이며 전체 범위·scanout·60fps 수락이 아니다.
- D1/D2 계약: display-list v1을 보존하고 별도 `nelyxScenePacketVersion()=2` capability로 v2를 선택한다. Float64 16-word header에 counts/word length/table end와 frame owner/sequence·viewport/renderer/context/surface·scale을 둔다. Path table은 fill/count/length 뒤 verb/arity/operand, Paint table은 8 scalars다. 숫자 참조는 table별 `-2-index`, `-1`은 nullable handle이다. native 소유 복사·전체 validation/독립 handle hold 후 replay하며 원래 recording이 재진입으로 바뀌면 drawing 전에 거부한다. frame resource admission·기존 상한을 유지한다. 세션을 남기지 않는 frame-local table은 호출 종료에 해제한다.
- D1/D2 구현 검사: canonical core parser·rendering Skia builder·얇은 JSI·TS packet 연결을 추가했다. 실제 pinned Skia의 모든 Path verb/fill/empty와 paint 비교, fractional DPR 8개 draw/clip/opacity/shadow pixel 쌍, malformed/version/count/overflow 검사가 통과했다. 후속 실제 RNW 적용률·비용·기본 적용 철회는 아래 기록을 따른다.
- D3 최소 구현: `scene_composition.cpp/.h`, 중립 `SceneCompositionService`, native adapter/SDK owner와 `SceneBuilder`의 flatten 전 경계를 연결했다. 불변 recording의 ID·scope·command range·자식 삽입 순서를 create/update/remove 배치로 원자 적용하고 C++가 replay 순서를 만든다. 기존 native leaf와 복합 retained Picture는 opaque leaf이며 실제 resource 재입장·`Picture.onCreate`는 TS의 원래 replay 위치에서 수행한다. metadata는 callback·JS/GPU 객체를 보유하지 않는다. 기존 snapshot이 다음 변경을 읽지 않으며 frame seal/current-scope 확인 뒤 commit, 실패·stale·close 때 discard한다. TS source lookup 방문은 매 frame 여전히 필요하므로 그 비용을 계측하며 제거했다고 보고하지 않는다.
- D3 예산: live 8,192 / depth 128 / frame commands 4,096과 view/session 합계 4MiB를 유지한다. committed/staging vector capacity·child storage, 입력·출력/VM 복사·검증 scratch·재귀 상한을 합산해 allocation 전에 보수적으로 검사한다. prepare 중 snapshot은 최대 두 개이며 명시적 close에서 두 저장소를 비운다. 이 capacity 집계는 allocator/process RSS 측정이 아니다.
- D4 최소 구현: `semantics_geometry.cpp/.h`와 중립 서비스·SDK owner를 추가했다. 기존 TS hook 순회·공유 조상 cache 뒤 남은 parent clip 결합, translation/inverse 투영, sibling transform, local bounds·hidden 계산을 Float64 query table로 처리한다. merge/order/value/focus/action과 geometry 이후 공개 순서는 TS에 남긴다. 표준 box의 bounds/size/parent와 수학 구현 descriptor를 확인하며 custom 또는 교체 getter는 추가 평가 없이 TS를 사용한다. 일반 tree는 기존 갱신 순서를 보존하기 위해 현재 endpoint마다 한 query를 호출하며, API 자체의 복수 query 배치와 구분한다. 전체 tree 배치 이관 완료로 보고하지 않는다.
- D4 예산: 16-word owner/frame header, query 57 / result 31 words. live node 상한 8,192와 4MiB를 동시에 적용하므로 큰 단일 batch는 입력+native/VM result+scratch 합계에서 먼저 거부될 수 있다. retained tree는 없고 session/revision과 peak 숫자만 남긴다. inverse·zero/singular·perspective·empty/inverted clip·hidden/sibling·큰 유한 값의 실제 C++/TS **17 queries**, malformed/foreign/budget **6개**가 통과했다. 실제 `SceneBuilder` **2회** 및 `FrameworkRoot`의 표준 Semantics **1회**를 C++ fixture 뒤에 연결해 같은 명령/좌표 결과를 확인했다. 이 수치는 pinned RNW 실행 증거와 구분한다.
- 공통 회귀 1차: 중복 파일을 제거한 **473개 중 472 PASS**. 실패 1개는 diagnostic stage 상한을 48→64로 늘린 뒤 옛 48 상한을 기대한 검사였으며 새 상한 초과·bounded 보관 조건으로 갱신했다. 수정 검사와 최종 공급/플랫폼 검증은 진행 중이다. C++ 모듈과 이전 입력 geometry는 아직 일반 기본 적용하지 않았다.
- 실제 pinned RNW(native `955dba0b…`)의 직접 API: Path old/new SVG 동등·원본 변경 격리, path/paint/all recorder replay **3 modes**, disposed paint·handle getter 재진입 중 recorder 폐기의 drawing 전 거부가 통과했다. 종료는 bindings-close·JS shutdown ack·exit 0이다. 별도 진단에서 유지 Picture compiler와 renderer의 공유 resources에 후보를 주입했으며 **735 numeric packets / Path table 207 / Paint table 247 / numeric clips 283 / packet bytes 1,421,416**을 관찰했다. 선택한 37개 JSI method wrapper 설치 실패는 0이다. 실제 callback 중 관찰한 일부 API 호출만 세며 전체 JSI/GC 비용으로 확대하지 않는다.
- 같은 진단의 D3는 **165 native compose / 변경·신규 node 4,299 / edges 4,134**, D4는 **native endpoint 1,502 / TS fallback 312**다. D4 현재 endpoint당 한 query이며 추출·반환 비용을 포함한다. source lookup은 여전히 TS다. 뒤의 OS 키 입력에서 별도 제품 오류가 발생했으므로 `probe.errors=0`을 전체 입력 제품 통과로 해석하지 않는다.
- D5 같은 joined frame 집합 **n=165**의 native wall 중앙값/p95: import **1.769/2.550ms**, replay-submit **0.760/1.431ms**, completion wait **5.381/6.720ms**, finish **0.088/0.114ms**, context **0.067/0.139ms**, worker 전체 **8.123/10.739ms**. JS compose **2.731/8.885ms** 중 native call **0.139/0.234ms**, SG 실행 frame(n=33)의 packet **0.180/0.239ms**, native call **1.212/1.425ms**, kernel **0.0163/0.0224ms**다. route 전환·초기화도 포함한 opt-in 진단의 retained 분포이며 일반 FPS와 합치지 않는다. 서로 겹치는 구간을 합산하지 않는다. 완료 대기는 실측 잔여 비용이나 독립 GPU/driver 시간·단독 병목은 `unobserved`다. wait/queue/cache/compiler 정책은 변경하지 않았다.
- D3 allocation 검토 후, 변경 node 상한까지 staging node vector를 먼저 예약하고 기존 child 저장소와 committed/staging/input/result/scratch를 allocation 전에 계산하도록 보강했다. 실제 C++ transaction·17-query differential·SceneBuilder/Frame fixture가 다시 통과했다. 해당 중간 Windows 공급은 native `6af1b640…`, canonical **175 files/package**다. 새 native 소스는 Android embedded CMake Release/x86_64에서도 빌드됐다.
- 중간 플랫폼 회귀: 당시 Web build와 Chrome moveBefore 유무·비시각 DOM input **3/3**, Android Temurin 21.0.11 / Release / x86_64 / 기존 `-Og` build 통과. 최종 설치·입력 회귀와 hash 대조는 §10.3을 따른다. workspace 전체 types, 사용자/Proxy prototype descriptor를 추가 평가하지 않는 검사, RNW probe **16/16**이 통과했다.
- 최신 Windows 일반 명령과 exit 0, 첫 편집기 OS End/Z/Space 입력(`initialz `)을 확인했다. `windows-mixed-input.ps1 -ActionsOnly`는 OS wheel 전체 탐색에서 **12 fields / 36 buttons**, 첫/마지막 행 send/count/clear와 Back을 통과했다. UIA에는 보이는 일부 노드만 공개되므로 한 snapshot에 12개가 동시에 있어야 한다는 잘못된 helper 가정은 제거했다.
- **Windows 실제 IME 한정 통과:** 같은 일반 제품의 새 프로세스에서 소유 포커스·Korean HKL `0x04120412`를 확인하고 OS G/K/S/Space를 보냈다. 첫 영문 모드 `g/gk/gks/gks ` 뒤 Hangul toggle에서 **`ㅎ → 하 → 한 → 한 `**을 관찰했다. Unicode 삽입은 없으며 원래 layout/모드를 복원했다. `-ImeOnly` 검사이며 물리 키보드·후보 C++ 적용·전체 범위 복귀·caret 픽셀/FPS 수락으로 확대하지 않는다.
- **전체 범위 복귀 입력 FAIL:** `windows-mixed-input.ps1 -AppPid <현재 PID> -KoreanIme`는 첫/마지막 이동 후 첫 행이 다시 보인 상태에서 재클릭·SetFocus 없이 OS End/Z/Space를 보냈을 때 **`Native printable key lacks its owning TSF character observation`**을 실제 일반 제품에서 재현했다(range-1). 기본 화면 같은 OS 키는 통과했다. 처음 scan=0 helper 입력에서도 오류가 있었고 이를 실제 scan/extended flags로 보정한 뒤에도 범위 복귀에서 재현됐으므로 도구 원인만으로 닫지 않는다. 원인을 TSF focus/receipt 중 하나로 확정하지 않으며 strict 문자 소유 검사도 완화하지 않았다. 일반 제품의 모든 새 C++ 기본 주입은 꺼져 있었다. 기존 기본 크기 검사를 이 실패의 통과로 대체하지 않는다.

### 10.1 독립 후보의 일반 제품 비교와 기본 적용 철회

모든 후보의 공통 native inputs는 `6af1b640fe8f4256ddf5c84dee8343af17a1cfe2a2815c35071486dc9eedda4f`다. `run-scene-candidates.mjs`가 한 번에 하나의 SDK 기본 연결만 바꾸고 매 후보를 재공급·재설치·optimized Hermes bytecode Release로 빌드했다. 각 모드 입력/Gallery 새 프로세스 3회, 총 **30개 유효 프로세스 모두 exit 0**이다. 2560×1459 physical / DPI 192, 입력 focus 10초×2방향, Gallery mouse motion 좌열 X=0.4·우열 X=2/3 각각 5초×2방향이다. 좌열 X=0.167은 정적 sidebar이므로 유효 비교에 쓰지 않는다. source probe·GDI 캡처·다른 build/test 없이 실행했다. 기존 surface counter 관측이며 scanout이나 전체 범위 왕복을 뜻하지 않는다. 최초 기준 trial 3은 살아 있는 창의 foreground 소유권을 잃어 폐기했고, 새 프로세스에서 다시 측정했다. native 오류·미진행·비정상 종료를 재시도로 숨기지 않는다.

| 후보 / trial | 입력 두 방향 FPS | Gallery 좌열 두 방향 | Gallery 우열 두 방향 |
| --- | --- | --- | --- |
| legacy / 1 | 49.490 / 45.805 | 49.934 / 52.010 | 55.548 / 56.146 |
| legacy / 2 | 48.318 / 48.776 | 55.755 / 60.512 | 58.735 / 55.600 |
| legacy / 3 | 50.203 / 48.068 | 51.443 / 54.144 | 59.247 / 57.890 |
| path / 1 | 48.176 / 48.073 | 51.268 / 56.094 | 58.670 / 57.665 |
| path / 2 | 49.885 / 47.478 | 54.001 / 54.798 | 58.046 / 55.538 |
| path / 3 | 50.791 / 49.965 | 58.085 / 58.684 | 59.485 / 54.979 |
| paint / 1 | 50.953 / 48.169 | 52.402 / 55.293 | 59.330 / 57.654 |
| paint / 2 | 48.905 / 48.305 | 54.511 / 59.832 | 64.180 / 54.680 |
| paint / 3 | 51.927 / 48.071 | 56.068 / 61.108 | 62.432 / 57.398 |
| composition / 1 | 47.902 / 45.528 | 47.547 / 52.643 | 60.966 / 55.142 |
| composition / 2 | 48.257 / 45.593 | 55.543 / 54.726 | 60.768 / 55.991 |
| composition / 3 | 50.260 / 46.197 | 56.323 / 55.769 | 59.717 / 53.962 |
| semantics / 1 | 47.357 / 43.556 | 50.165 / 50.787 | 56.236 / 54.687 |
| semantics / 2 | 47.263 / 45.882 | 55.071 / 53.660 | 58.152 / 58.549 |
| semantics / 3 | 48.516 / 45.166 | 52.881 / 60.869 | 57.326 / 54.449 |

| 후보 | 입력 평균 / 기준 대비 | 좌열 평균 | 우열 평균 | 판정 |
| --- | --- | --- | --- | --- |
| legacy | 48.443 / 0.00% | 53.966 | 57.194 | 일반 기본 경로 유지 |
| path | 49.061 / 1.28% | 55.488 | 57.397 | 기본 적용 철회 |
| paint | 49.388 / 1.95% | 56.536 | 59.279 | 기본 적용 철회 |
| composition | 47.289 / -2.38% | 53.758 | 57.758 | 기본 적용 철회 |
| semantics | 46.290 / -4.45% | 53.906 | 56.566 | 기본 적용 철회 |

각 평균은 같은 장면의 6개 방향 구간 산술 평균이다. Path/paint의 소폭 평균 증가는 trial/방향별 변동을 넘는 지속 60fps 근거가 아니다. Scene/Semantics는 입력 평균이 후퇴했다. **입력 geometry, sceneBatch, sceneComposition, semanticsGeometry 모두 일반 기본 주입하지 않는다.** 내부 capability와 명시적 opt-in 모듈은 보존한다. GPU queue/wait/cache, retained Picture 예산, compiler 정책은 바꾸지 않았다. `performanceAccepted=false`, `resizePerformanceAccepted=false`다.

| 모드 | manifest SHA-256 | SDK inputs SHA-256 | bytecode SHA-256 |
| --- | --- | --- | --- |
| legacy | `c1d5142e51f420a73dc33c4f864b72de93352cbd5841be078f970ec322791c74` | `733ef8bc520b1784c05f8fd5e6d7fd26d624094895dc2c6512ca0144801f9628` | `85a77770252febfff5aa5253c14fa4f55026430fe9239df48e64830960e5960f` |
| path | `ebe2580184c936ca859c6d8aa51df2f539a80ab80191d10f2188793775bd0417` | `6c9e308f2aac5fd999df7ce8bdbe7f8e1ae8cfcfdb77227067535010580279ad` | `4cf6940897ddb65c0e911248f980810dc37fb1f6f448b23d928bb03cc2c6d85a` |
| paint | `04c6f34c8c119a9f910d241f2d8cdfae2dc970f390c0530dde808ffd791429f9` | `d775e26cb7b5df91e45be08b659c95c36ae00da0d627dff26052c83839b09eff` | `d716bf9fb7b47a1f7d85c8e9dd3eddbc1e768205114cd3c2711f366f4adcfb57` |
| composition | `fd9e5510d0bb8a56c210b72ce579f2236f94c6725c2dc8a9e315420ef9f2e5bb` | `b6a3c7126c7bcb1407f0d4069420bf1e344a552835d08fdcaefe90f14a90df5a` | `a083bed691a0342432839cd85daec34762c4c347f46417c21e1d05065ee2976c` |
| semantics | `ca836ff7e6049465f7ba3a9612258e208fe5affdd013d55fe9a78611c17da65a` | `fc5bf6695ccfd1bccacd48c3c12ea7eba6def00ad65594d4969f624a02bad170` | `40692d87cbbb10f85bb101c9a27d417ec6e3aa8f73ff81daac7f66de51056161` |

위 비교는 native `6af1b640…`의 결과다. 이후 JSI 반환 생성자 재진입의 동시 예산, 입력 복사 전 retained bytes 검사, PictureRecorder finish/begin 교체 감지를 보강했다. 최종 native와 비교 제품의 식별을 합치지 않으며, 최종 일반 제품 재검증은 아래에 따로 기록한다. SDK 원본은 매 실행 finally에서 복원하고 현재 일반 제품을 다시 빌드했다.

### 10.2 남은 실패와 진단의 해석

장시간 opt-in 결합 진단(native `6af1b640…`, Path/paint + Scene + Semantics)의 Gallery → 입력 → Gallery 전환에서 **`Failed to allocate unprotected shared image memory` / ColorAttachment·AddingRecording 실패 / exit 2**를 관찰했다. 최종 joined report가 없으므로 성공 실행으로 집계하지 않는다. GPU 메모리 누수, CPU 메모리 부족, 단일 후보 중 하나를 원인으로 확정하지 않는다. 원인·장시간 결합 안정성은 미해결이며 기본 적용은 꺼져 있다.

같은 진단의 앞선 우열 maximize/restore/maximize·5초 확장 검사는 최대 세 영역 공통 정지 **188.544 / 189.083ms**로 옛 1,210.822ms 실패를 재현하지 못했다. 제품·주입·관찰 조건이 다르고 뒤에 allocation 실패도 났으므로 **§8.2의 일반 제품 visual FAIL을 닫지 않는다**. 기존 350ms 기준을 유지했다.

D3/D4 metadata의 한 진단 관측 peak 합계는 **315,356 bytes**(Scene 309,924 + Semantics 5,432, native `955dba0b…`)다. 이는 각각 관측한 보수적 vector capacity peak의 합이며 RSS/JS Map/GPU resident 측정이 아니다. 두 서비스는 각 4MiB 상한이고 동시 committed/staging/input/output/scratch를 합산한다. 최신 JSI는 반환 생성자 중 같은 서비스의 prepare/evaluate/stats/commit/discard 재진입을 거부하며 close는 원래 operation을 무효화할 수 있다. PictureRecorder는 raw canvas 주소뿐 아니라 기존 canvas wrapper 소유 identity를 대조해 finish/begin 주소 재사용도 거부한다.

### 10.3 최종 안전성·공급 검증

최종 native inputs는 `32d160b77d22012fc10fb6a478391a9435cdf1d494413500a32a2d571ad21777`다. 별도 실제 pinned RNW 직접 API 제품(manifest `d350b419e0795b5cae3e6ec43f33cfe6903dc21dc4eed5980a60c9cf106bec3b`)에서 Path 동등성·3 batch modes, disposed handle 거부, getter 중 recorder dispose·finish/begin 교체 거부, Scene/Semantics 반환 `Float64Array` 생성자 중 같은 세션의 재진입 거부, close 후 보유 metadata 0·재사용 거부가 모두 통과했다. bindings-close·JS shutdown ack·정상 exit 0이다. 이 작은 직접 API 검사가 앞선 장시간 결합 GPU 실패를 닫지는 않는다. 진단 App 원문과 임시 fixture는 finally에서 복구·삭제했다.

변경 관련 중복 제거 **51 test files / 475 tests PASS / fail·skip 0**(20분 timeout), workspace 전체 types와 package boundaries 검사가 통과했다. 이는 TS mock뿐 아니라 실제 pinned Skia pixel·C++ numeric differential·SceneBuilder/FrameworkRoot 연결 검사를 포함한다. 최종 source·dist·설치본의 package inputs가 Windows/Android/Web 모두 일치하며 native canonical은 **각 175 files**다. Core 628 / SDK 113 / Skia native 62 / RN 53 / Web 6 / Material 257 / Cupertino 63 emitted modules를 확인했다. 최종 공급의 실제 Vulkan 그림자 검사는 delivered Windows library에 링크해 direct/retained fractional DPR와 drain **1/1 PASS**다.

일반 SDK 원본 `native-engine.ts` SHA-256은 `95e4b6284db86ffbbc746631254a88d727e94e454163da54f2c331c88c3df618`이며 모든 새 기본 주입은 꺼져 있다. 실제 일반 명령은 `npm.cmd run run:windows --workspace @nelyx/testbed-2`다. 진단 원복 뒤 입력 변경 감지에 따른 일반 제품 재빌드를 확인했다. 최종 일반 제품·플랫폼 판정은 아래와 같다.

| 최종 일반 Windows 제품 | SHA-256 / 값 |
| --- | --- |
| manifest | `0df3773e3a87fbf807c25f2303bf9fc72c9206749724895b4c521b2e9b2025a3` |
| EXE | `dceed1f86e4f0cf87391869cdc40ae1fca9fbd4280b01d601505e26099512cd0` |
| bytecode | `85a77770252febfff5aa5253c14fa4f55026430fe9239df48e64830960e5960f` |
| native inputs | `32d160b77d22012fc10fb6a478391a9435cdf1d494413500a32a2d571ad21777` |
| SDK inputs | `eb60938b3e671479a15c78dca2a8f1af7230eb57e97b85b707735e8d6bb6a0d2` |
| app inputs | `43d63efb18ca28f93093ef5c9956abf59b0e19ae2455a77757cb4a0ea8f9020d` |
| App.tsx 원문 | `92d045b43f1316023328f5f2f0922f94e8f7395b9f499e29a84983eabb261bfb` |
| package inventory / runtime | 1,794 files 검증, RNW 0.83.2 / JSI 21 / MD / optimized bytecode / Release |
| compiler policy | `windows-hermes-94aa5e1d-no-cfg-v1` 유지 |

이 제품의 일반 명령·정상 close/exit 0, 기본 편집기 실제 Korean HKL `0x04120412`의 **`ㅎ → 하 → 한 → 한 ` + commit 후 Ctrl+A/delete·Ctrl+Z undo**, ActionsOnly **12 fields / 36 buttons / 첫·마지막 send·count·clear·Back**, 기존 pointer/theme/dialog/Form/route 검사가 통과했다. 전체 범위 첫↔마지막 후 재클릭 없는 입력은 최종 제품에서도 **range-1 FAIL**이며 UIA에 `Error: Native printable key lacks its owning TSF character observation`이 나타났다. 오류 화면의 정상 close를 입력 성공으로 해석하지 않는다. 한 번은 앞선 route 검사의 종료 화면에서 시작하여 helper의 open 전제에 못 들어갔으며, 새 일반 프로세스의 유효 range 검사와 구분했다.

최종 Android는 process-local Temurin 21.0.11 / Release / x86_64 / emulator-vulkan / 기존 Hermes `-Og`로 다시 빌드하고 설치했다. `android/app/build/outputs/apk/release/app-release.apk`와 emulator-5554 설치본 SHA-256은 **`f2adfe57c3305d0d8a546b0076e7812bd8a5041b6ea54ba32e5db39eab970b19`**로 일치했다. 최종 Web `application.js` SHA-256 **`01f838e674859c0f62a35173612bcab9a39cd047ca05167564a669e6136fd349`**도 current build inventory와 일치하며 Chrome 입력 **3/3 PASS**다. Web은 TS fallback이다. Apple/Linux는 공통 source/CMake 포함 확인만 했으며 runtime과 Static AOT는 이번 작업에서 실행하지 않았다.

최종 Android 설치본의 OS 입력·clear/undo·secure/plain·keyboard viewport·Next/Done·Form save/reset·design return 회귀 **1/1 PASS**다. 준비 중 helper의 문자 키 코드 오지정을 제품 실패와 구분하고 `KEYCODE_G/K/S/SPACE`로 보정했다. 실제 Gboard 한글 조합을 확인한 후 Shift+Space로 영문을 선택하고 ASCII 검사를 수행했으며, finally에서 원래 한글 모드로 복원해 **`ㅎ → 하 → 한 → 한 `**을 다시 관찰했다. Unicode 문자열 주입이 아니며 에뮬레이터 OS key injection의 한정 통과다. 소유 Metro/8081 reverse·원격 XML·앱은 finally에서 정리했고 기존 사용자 emulator 프로세스는 유지했다.

추가 회귀 명령은 실제 등록된 `npm.cmd run test:scene-batch`, `npm.cmd run test:numeric-services`다. 작업 소유 중간 native 공급 사본 4개(`fbb6723b…`, `955dba0b…`, `6af1b640…`, `126a557d…`)는 absolute path·symlink 부재·manifest hash를 preview 확인한 뒤 제거했다. 최종 `32d160b7…`와 착수 전 `1fac5489…` 등 기존 사용자 공급은 보존했다. 현재 package/dist만 유지하고 별도 로그·receipt·archive·프로필을 만들지 않았다.

### 10.4 최종 일반 제품의 진단 없는 3회 재측정

§10.3의 최종 native `32d160b7…`·manifest `0df3773e…`에서 다시 측정했다. 새 프로세스 입력/Gallery 각각 3회, 모두 exit 0. 2560×1459 physical / DPI 192, 입력 focus 10초×2방향, Gallery 좌열 X=0.4·우열 X=2/3 hover/mouse motion 5초×2방향이다. source probe·GDI 캡처 없이 OS wheel과 기존 native surface counter만 사용했고 다른 build/test는 동시에 실행하지 않았다.

| trial | 입력 두 방향 FPS | Gallery 좌열 두 방향 | Gallery 우열 두 방향 |
| --- | --- | --- | --- |
| 1 | 52.245 / 47.568 | 53.648 / 57.245 | 60.188 / 58.693 |
| 2 | 51.590 / 48.605 | 58.212 / 58.352 | 59.989 / 56.019 |
| 3 | 51.557 / 47.144 | 55.740 / 56.505 | 62.112 / 57.146 |

6구간 평균은 입력 **49.785**, Gallery 좌열 **56.617**, 우열 **59.024 surface FPS**다. 최종 일반 제품도 지속 60fps 미달이다. 이 재측정과 native가 다른 §10.1 후보 값을 묶어 마지막 안전성 보강의 성능 효과로 계산하지 않는다. packet-defined 반전이며 전체 범위·scanout 수락이 아니다.

### 10.5 최종 시각 회귀·제품 판정과 잔여 작업

최종 일반 패키지의 기본 크기 연속 스크롤 검사는 **1/1 PASS**, 내부 Material/List/Cupertino/mixed **4개 페이지** 모두 실제 OS wheel·350ms 시각 기준·native drain·exit 0을 통과했다. 마지막 mixed의 초기 두 실행은 창이 살아 있는 상태의 `Own foreground unavailable`로 입력 전에 중단됐다. 그 경우에만 새 프로세스 1회 재시도를 허용했고, 진단의 소유 창을 잠시 topmost로 올려 caption hit-test/입력 소유권을 확인하며 finally에서 원래 topmost 상태를 복원하도록 보강했다. 이후 전체 4페이지 검사는 재시도 없이 통과했다. 창 크기/DPI와 실패 기준을 바꾸거나 native 실패·정지·비정상 종료를 재시도로 숨기지 않았다.

그러나 같은 최종 제품의 **`-Page material -WindowTransitions -Maximized -MouseMotion -InputDurationMs 5000 -InputXFraction 0.667`**은 두 번째 구간 **247.7649→1310.5336ms**, 즉 **1,062.7687ms** 동안 세 영역 모두 정적이어서 **FAIL**이다. 같은 구간 native frame **359→393 / surface updates 33 / view 1000 / surface generation 4**, native QPC **128490554.0194→128491623.5781**이다. 해당 leg의 native surface 최대 갱신 간격은 **516.9524ms**였다. 첫 방향 공통 최대 정지는 97.0132ms다. 종료는 drain=true·exit 0·hidden 2.2467ms였으며, 정상 종료로 시각 실패를 지우지 않는다. startup resize actual-frame/actual-commit timeout도 관찰했고 `resizePerformanceAccepted=false`다. 표본이 정적인 이유나 GPU/driver/GC 중 하나를 원인으로 확정하지 않는다. §8.2의 문제는 최종 일반 제품에서도 미해결이다.

| 항목 | 최종 판정 |
| --- | --- |
| D1/D2 Path·clip·paint | C++ 생성·실제 RNW·pixel/differential·독립 비교 완료. 기본 미채택 |
| D3 Scene | C++ 구조 합성·변경 transaction·수명 검사·실제 RNW 완료. TS source lookup 비용 잔존, 기본 미채택. 장시간 결합 안정성 미수락 |
| D4 Semantics | hook 뒤 숫자 suffix C++ 실행·17-query differential·실제 RNW 완료. endpoint당 한 query, 전체 tree 배치 미완료. 기본 미채택 |
| D5 producer | 비용 분리 완료. completion wait 잔존·독립 GPU/driver 원인 미관찰, wait/queue/cache 변경 없음 |
| 공급·회귀 | 최종 source/dist/설치본/native/package 일치, 475 관련 검사·types·Web 3/3·Android 1/1·Windows 기본 스크롤 1/1·delivered 그림자 1/1 PASS |
| 제품 입력 | 기본 Korean 조합/commit/undo·동작 PASS-scoped. 전체 범위 복귀 후 TSF 문자 관측 오류 FAIL |
| 제품 성능·시각 | 입력 평균 49.785fps·최대화 Gallery 1,062.769ms 정지 FAIL. `PARTIAL / performanceAccepted=false / resizePerformanceAccepted=false` |

잔여 작업은 **(1) 일반 제품의 범위 복귀 후 native TSF 문자 소유·focus/receipt 흐름 원인 분리, (2) 최대화 Gallery의 정적 픽셀과 surface/producer 진행을 함께 추적해 지속 60fps·시각 정지 개선, (3) opt-in 결합 후보의 GPU allocation 실패 원인 분리**다. 새 모듈을 기본 활성화하거나 proof 없는 hook·strict 문자 소유 검사를 완화해서 이 결과를 통과시키지 않는다. 물리 트랙패드·물리 키보드·screen reader·scanout·Android 직접 C++ 후보 실행·Apple/Linux runtime·Static AOT의 미관찰 범위를 보존한다. 이번 D0~D6의 구현·평가·정리는 여기서 종료하며 제품 수락을 완료로 표시하지 않는다.

마지막 current package/runtime·supplier inventory 대조도 통과했고 원본 App·fixture 0, 작업 소유 Windows/Android 앱·Metro/8081 reverse 정리를 확인했다. 사용자 emulator PID 24540은 유지했다. 관련 변경의 lint/format·PowerShell parser·`git diff --check`가 통과했으며 커밋은 만들지 않았다.

## 11. 다음 작업 계획 — Windows 입력 복귀·시각 정지·GPU 할당 실패

계획 정리: **2026-11-02 KST / 구현 미착수**. §10의 실행 결과·실패·제품 식별을 기준으로 삼는다. D0~D6는 종료 상태를 유지하며 후속 작업의 성공으로 과거 실패 기록을 지우지 않는다. 일반 제품에서 재현되는 기능 오류인 E1을 먼저 수정하고, E2에서 체감 정지와 지속 이동 성능을 다룬다. E3는 기본 비활성화된 후보의 안정성 조사다.

- [ ] E0: 착수 시 현재 source·제품·설치본을 대조하고 재현 조건 확정.
- [ ] E1: 편집기의 화면 밖 이동·복귀 후 재클릭 없는 TSF 입력 복구.
- [ ] E2: 최대화 Gallery의 시각 정지 원인 분리·수정과 지속 이동 성능 검증.
- [ ] E3: opt-in 결합 후보의 GPU allocation 실패 원인 분리·수명 검증.
- [ ] E4: 각 변경의 현재 공급·회귀·일반 제품 판정·정리.

### 11.1 E0 — 현재 기준과 재현 조건 대조

착수 때 HEAD·dirty state와 §10.3의 locator/manifest·EXE·bytecode·native/SDK 입력·설치 패키지를 다시 대조한다. 기존 미커밋 변경을 보존한다. §10의 hash를 현재 공급 확인으로 대신하지 않는다. 일반 명령은 **`npm.cmd run run:windows --workspace @nelyx/testbed-2`**이며 입력 geometry·sceneBatch·sceneComposition·semanticsGeometry 기본 주입을 계속 끈다. 기존 Hermes bytecode/optimized/Release·compiler 정책·resource 예산을 유지한다. 측정 창·DPI·focus/hover·입력 패턴은 §10.3~§10.5와 맞춘다.

**완료 기준:** 실제 실행 제품과 재현 조건을 식별하고 E1의 정상 첫 입력과 범위 복귀 실패를 구분해 관찰한다. 원인을 확인하기 전 TSF focus·receipt·GPU/GC 중 하나로 확정하지 않는다.

### 11.2 E1 — 최우선: 화면 밖 이동·복귀 후 TSF 입력 복구

- **재현:** 새 일반 프로세스에서 mixed 입력 페이지의 첫 편집기를 focus한 뒤 첫 행 → 마지막 행 → 첫 행으로 이동한다. 복귀 후 재클릭·`SetFocus` 없이 OS End/Z/Space 입력을 보낸다. [windows-mixed-input.ps1](Nelyx/eng/tests/windows-mixed-input.ps1)의 전체 범위 경로와 `-KoreanIme`를 사용하고 실행 중인 소유 PID를 확인한다. `-ImeOnly`·`-ActionsOnly`의 한정 통과와 구분한다.
- **조사 경계:** [key-queue.ts](Nelyx/sdk/src/platforms/windows/key-queue.ts), [keyboard-input.ts](Nelyx/sdk/src/platforms/windows/keyboard-input.ts), [SkiaView.h](Nelyx/skia/packages/rn/native/windows/SkiaView.h), [WindowsKeyboardState.h](Nelyx/skia/packages/rn/native/windows/WindowsKeyboardState.h)에서 native key/text/focus 관측과 Core 편집 상태의 전달 순서를 연결한다. 화면 밖 입력 surface의 철회·복원, 소유 view/editor, `viewGeneration`·`focusEpoch`·sequence가 언제 바뀌는지 추적한다.
- **수정 원칙:** 현재 오류 검사는 처리되지 않은 printable key에 유효한 TSF 문자 소유 관측이 없음을 드러낸다. 이 검사를 유지한 채 원인 경계를 수정한다. 재클릭으로 focus를 강제로 복원하거나, 문자를 합성·중복 삽입하거나, stale 관측을 수락하거나, 임의 대기를 늘려 실패를 가리지 않는다.
- **회귀:** 첫/마지막 편집기의 value·selection·focus를 함께 확인하고 복귀 후 영문 입력, 실제 OS 한글 조합·commit·clear/undo, 다른 편집기로의 focus 이동과 빠른 close를 검사한다. 이전 editor/view의 늦은 문자·focus 관측이 새 입력을 덮지 않아야 한다.

**완료 기준:** 동일한 일반 명령·전체 범위 왕복을 새 프로세스 3회에서 수행해 재클릭 없는 입력과 한글 조합/commit/undo가 모두 통과하고 TSF 문자 소유 오류가 재발하지 않는다. 수정 범위의 queue/focus/retirement 검사와 실제 native drain·정상 종료도 통과한다. 기본 화면 입력이나 UIA 값 설정만으로 완료하지 않는다.

### 11.3 E2 — 최대화 Gallery의 시각 정지와 지속 이동 성능

- **출발 실패:** §10.5의 최대화·창 전환·우열 mouse motion·5초 입력에서 세 영역 공통 **1,062.7687ms 정지**, 같은 구간 surface updates **33회**를 관찰했다. counter 진행과 실제 픽셀 움직임을 따로 확인한다.
- **원인 분리:** OS wheel → Core scroll offset/범위 clamp → recording/Scene 내용·버전 → native producer의 import/submit/completion → surface와 세 영역 픽셀을 같은 frame·view·generation으로 연결한다. offset이 멈춘 경우, 같은 내용이 재제출되는 경우, 내용은 바뀌는데 관측 픽셀이 정적인 경우를 구분한다. 실제 스크롤 범위와 샘플 영역을 확인하며 기존 실패 기준을 유지한다.
- **수정 경계:** 근거가 확인된 scroll/recording invalidation·내용 재사용·native 제출/표시 경계부터 작은 변경으로 비교한다. [gpu_context.cpp](Nelyx/skia/native/platforms/vulkan/gpu_context.cpp)·[device.cpp](Nelyx/skia/native/platforms/vulkan/device.cpp)의 완료 대기 wall time만으로 독립 GPU 병목을 확정하지 않는다. fence 삭제·무확인 재사용·queue/cache 확대·compiler 변경을 해결책으로 사용하지 않는다.
- **비교:** 상세 frame/픽셀 진단과 probe 없는 일반 FPS 실행을 나눈다. 변경별 기준/후보 3쌍을 같은 창/DPI·입력 focus·Gallery 양 열 hover/motion 조건에서 비교하고 추출·전송·대기 등 겹치는 시간을 합산하지 않는다. 일반 FPS 측정 중 다른 build/test를 실행하지 않는다.

**완료 기준:** §10.5와 같은 `-Page material -WindowTransitions -Maximized -MouseMotion -InputDurationMs 5000 -InputXFraction 0.667` 조건을 새 프로세스 3회에서 검사해 기존 **350ms** 시각 기준·native drain·exit 0을 통과한다. 입력·Gallery 양 열의 대표 지속 이동도 기존 **60 surface FPS** 기준으로 별도 판정한다. 정지만 해소하고 60fps에 못 미치면 기능 수정과 성능 수락을 나눠 `PARTIAL`을 유지한다. 물리 입력·scanout·resize 성능의 미관찰을 이 검사로 대체하지 않는다.

### 11.4 E3 — 결합 후보 GPU allocation 실패 원인 분리

- **재현 단위:** §10.2의 Gallery → mixed 입력 → Gallery 전환을 출발점으로 일반 기본 경로, Path, clip/paint, Scene, Semantics를 각각 비교한다. 개별 결과 뒤 필요한 조합만 선택하며 모든 조합을 무작정 반복하지 않는다. source opt-in·현재 공급·fixture 원복을 실행별로 확인한다.
- **보유량 관측:** 화면 전환·detach·context/surface 교체·close 전후의 native owner, Picture/recording·image/texture 참조와 생성/해제·retirement를 연결한다. JS/C++ metadata capacity와 실제 GPU 자원·process 메모리를 구분한다. `Failed to allocate unprotected shared image memory`만으로 누수나 전체 시스템 메모리 부족을 단정하지 않는다.
- **수정·철회:** 실패를 유발하는 최소 경계가 확인되면 해당 소유·해제 경로를 수정한다. renderer 예산 확대·임의 eviction 억제·실패 무시를 사용하지 않는다. 실패 원인이 미분리거나 순이득이 없으면 후보 기본 비활성화를 유지한다.

**완료 기준:** 확인된 실패 재현 경로를 새 프로세스 3회에서 실행해 allocation/recording 실패 없이 실제 후보가 동작하고, 전환·close 후 소유 자원이 계약대로 해제되며 정상 종료한다. 자원 증가의 원인과 회수 여부를 기록한다. 짧은 직접 API 검사 통과를 장시간 결합 안정성 수락으로 확대하지 않으며, 기본 재채택은 비용·회귀·성능 비교로 별도 판정한다.

### 11.5 E4 — 각 단계의 공급·회귀·제품 판정과 정리

1. 변경된 canonical 소스를 generated/dist·공급 archive·설치본·최종 실행 제품까지 반영하고 hash/입력을 대조한다. 기존 App 원문·일반 명령을 복구한 제품에서 해당 실패 패턴을 다시 검사한다.
2. 변경 경계에 맞는 기존 Windows key/input·semantics·scene/paint·close 검사와 types를 실행한다. 공통 native 변경이 있으면 Windows delivered binary 및 Android build/입력, Web fallback에 필요한 회귀를 수행한다. 이번 계획 작성으로 검사 결과가 새로 생긴 것으로 기록하지 않는다.
3. 제품 기능, 최대화 시각 기준, 지속 60fps, 후보 기본 채택, resize·물리 입력·scanout을 따로 판정한다. E1 통과로 E2/E3를 완료 처리하지 않으며 `performanceAccepted=false`·`resizePerformanceAccepted=false`는 해당 수락 근거가 생길 때까지 유지한다.
4. 테스트 timeout **1,200,000ms**, 반복은 대부분 **30회 이내**다. 관측은 bounded 메모리/현재 문서에 요약하고 소유 fixture·임시 디렉터리·프로세스·staging은 성공/실패/중단 모두 finally에서 정리한다. 현재 dist·필요한 최신 공급을 유지하며 로그·receipt·과거 SDK/package·browser profile을 누적하지 않는다. 상태·핵심 근거·잔여 작업은 이 문서에 갱신한다.
