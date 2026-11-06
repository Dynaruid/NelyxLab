# work9-2 — 2부: 공개 API·렌더링·입력·Web

작성: **2026-11-05 KST** · 갱신: **2026-11-06 KST** · 상태: **PAUSED / API 검사 입력 정상화·입력 회귀 구현 / 전체 호환 PARTIAL**

[전체 목차](work9.md) · [이전: 1부](work9-1.md) · [다음: 3부](work9-3.md)

**범위:** 원문 §8–10과 §11의 공통·Web 계약(§11.1–11.3·§11.6–11.7). 기존 공개 API, 렌더링·자원 재사용·frame, 입력·복구와 Web 두 profile을 다룬다. Android 구현은 4부의 2차, iOS 구현은 후속 5부의 3차로 분리한다.

**실행 순서:** Windows/Web 1차는 [3부 §12.2의 실행 묶음](work9-3.md#122-windowsweb-1차-실행-순서)을 따른다. 이후 **[4부의 Android·Linux 2차](work9-4.md) → [후속 5부의 iOS·macOS 3차](work9-5.md)**로 진행하며 후속 플랫폼을 Windows/Web 1차 완료의 선행 조건으로 두지 않는다.

다음 차수 착수는 앞선 차수 전체 대상의 **W9-13 기술 완료**를 기준으로 하며 W9-14의 물리·성능 수락과 구별한다. [완료·차수 전환 기준](work9-3.md#125-차수-전환과-완료-판정)

## 8. 기존 공개 API 호환 작업

사용자 기준인 **원래 import·생성자·동작 호환**을 유지한다. 원래 동기 API를 비동기 snapshot으로 바꾸는 work8 초기 변경안은 호환 완료 조건이 아니다.

| 작업 | 구현·검증할 의미 |
| --- | --- |
| Gate 입력 | **W9-00에서 먼저 정상화.** [원래 공개 표면](Nelyx/engine/schema/public-api.json)을 유지. 현재 [audit](Nelyx/engine/tools/api-audit.mjs)의 단일 declaration program을 Windows/Web의 target별 program·명시 환경으로 분리하고 원래 entry와 동작 의무를 매핑. `inputValid=true`와 `compatible=true`를 별도 판정. 누락/module/reexport·해석 실패·빈/non-code export를 지우거나 `skipLibCheck`로 FAIL을 없애지 않음 |
| Widget/P1 | 원래 Widget/Element/State/BuildContext·Inherited·GlobalKey와 Key equality·parent data·init/update/deactivate/activate/dispose. Reparent/NACK/build 예외·listener 재진입·정확한 해제 횟수를 원래 호출로 검사 |
| RenderObject/custom hook | 원래 intrinsic/baseline/layout/paint/hit-test/protected subclass 계약을 API별로 대응. 표준 node·등록한 native extension·명시 App boundary의 실제 실행과 한계를 검증. `AppDrivenBoundary`나 alias만으로 임의 동기 hook을 호환 처리하지 않음 |
| 동기 상태 API | ScrollController pixels/jump/animate, editing value/selection, layout geometry의 즉시 읽기·쓰기·listener를 ACK 전후/실패/취소/재진입에서 비교. App의 관측 상태와 C++ 권위 상태를 구별하고 stale cache를 현재 값으로 반환하지 않음 |
| 디자인/P3 | 전체 Material/Cupertino 생성자/default·theme/typography/icons/shapes·form/control·route/overlay/modal·전환·localization과 SDK app/service/platform API를 원래 사용 사례에 연결 |
| 실제 소비 | [API 동작 사례](Nelyx/engine/tools/api-behavior.mjs)와 [audit](Nelyx/engine/tools/api-audit.mjs)에 overload/member별 의무를 추가. 부분 검사한 class의 나머지 의무는 그대로 남기고 installed package의 원래 import·compiler·runtime에서 실행 |

임의 동기 JS subclass와 독립 Content owner 사이에 동기 callback을 추가하면 교착·App 지연이 생길 수 있다. **W9-06-A를 W9-00 직후의 선행 검증으로 분리**한다. 기존 구현 위에서 State/GlobalKey/context·동기 controller·custom layout/paint/hit-test의 대표 원래 consumer를 실행해 보존할 상태·실행 위치·ACK 전후 의미를 정한다. 큰 그래픽 확장이나 전체 Widget 이식 전에 이 경계를 확인한다.

보존하지 못한 원래 계약은 API별 미완료로 남기며 public API 변경이 필요하면 변경 대상·이유를 명시한다. 이 경우 독립 기능 개발은 계속할 수 있지만 전체 호환과 제품 기본값 전환은 통과시키지 않는다. UI/Content가 App의 동기 응답을 기다리는 우회나 숨은 TS layout/paint fallback으로 해결하지 않는다. Target별 적용 여부와 원래 공개 표면의 분모를 유지하며 후속 플랫폼 미검증을 Windows/Web의 전체 플랫폼 호환 성공으로 합치지 않는다.

### 8.1 검사 환경과 실행 모델의 선행 판정

W9-00의 target별 program은 **실제 설치 consumer의 export condition·module resolution·`lib/types`·compiler 버전**과 맞춘다. 공통 entry는 Windows와 Web 모두 검사하며 Web의 threaded/single-worker 동작 사례도 분리한다. 플랫폼 전용 entry의 비적용은 원래 공개 계약·조건부 export에 근거를 남기고, 이식이 어렵거나 환경 진단이 난다는 이유로 제외하지 않는다. 원래 표면에서 target별 적용·비적용·미검증의 합계가 빠짐없이 대응해야 하며, `public-api.json`을 현재 v2 구현만으로 재생성해 분모를 줄이지 않는다. 의도적으로 충돌하는 환경 분리와 실제 consumer에서도 재현되는 타입 결함 수정을 구별한다.

W9-06-A는 대표 consumer마다 **원래 호출·동기 반환/즉시 읽기·listener 순서·실행 owner·ACK 전후/거부 시 값·실제 C++ 작업**을 함께 확인한다. 다음 분류를 현재 작업 문서에 남기고 원래 계약을 통과한 범위만 W9-06-B 이식의 근거로 사용한다.

| 실행 분류 | 판정 조건 |
| --- | --- |
| Core에서 보존 가능 | 표준 C++ node/연산으로 원래 호출 의미를 보존하고 App/Content 지연 중 준비 scene 진행·실패 rollback을 확인 |
| 명시 경계가 필요 | Native extension 또는 App 경계의 등록/실행·geometry·수명·관측 한계를 명시. 임의 JS subclass 함수를 자동 native 변환하거나 독립 Content에서 호출할 수 있다고 가정하지 않음. 원래 consumer를 바꿔야 하면 호환 미완료 |
| 보존 방식 미해결 | 해당 의무와 의존 기능을 미완료로 유지. 실패를 적었다는 이유로 호환 PASS나 W9-06 전체 완료로 올리지 않음. 독립된 host/기능 작업은 가능하되 전체 API·제품 전환 gate는 계속 FAIL |

최소 사례는 State/GlobalKey reparent·BuildContext 조회, scroll/editing의 즉시 읽기·쓰기/취소·재진입, custom intrinsic/layout/paint/hit-test다. Setter 호출 직후의 값·listener와 다음 publication의 값을 따로 검사하고, App 소유 animation callback과 Core motion을 구별한다. 모든 JS animation/custom hook의 App 독립 진행을 약속하지 않는다.

## 9. 렌더링 표현력·재사용·frame 일정

[2a의 Flutter 소스 비교](history/26/11/05/work8-2a-summary.md#flutter-엔진-c-비교)를 아래 독립 작업으로 이월한다. 비교 reference는 저장소의 snapshot이며 최신 Flutter 버전이나 동일 기능/성능을 보장하는 기준은 아니다.

아래 공통 corpus의 **1차 provider는 Windows native와 Web 두 profile**이다. GTK/Metal·모바일 provider의 같은 의무는 후속 host 단계에 연결하며 1차 완료를 막는 별도 port 작업으로 앞당기지 않는다.

| 축 | 남은 구현 | 완료 증거 |
| --- | --- | --- |
| Canvas/Paint | Gradient/shader·blend/color/image/backdrop filter·stroke cap/join/miter·saveLayer·필요한 perspective와 공통 graphics protocol | Core 검증과 각 native provider/Web 두 profile의 paint pixel·clip/hit/semantics 일치, 잘못된 자원/좌표의 원자 실패·회수 |
| Rich paragraph | Style span·run별 font weight/features/variations/locale·maxLines/ellipsis/strut·inline placeholder·동적 font/fallback revision | 한글/surrogate/결합/RTL/emoji·rich text/caret/selection/line·WidgetSpan corpus. Native와 공식 CanvasKit의 지원 차이를 capability로 공개 |
| 준비 결과 재사용 | Preparation 사이의 Picture·paragraph·decoded image 재사용, node/resource/style/font/layout revision별 invalidation·cancel/retire | 텍스트/이미지 많은 scene의 작은 변경에서 변경 없는 node의 재기록·shaping/layout·decode 수 감소. 기존 publication·geometry와 pixel 보존, 실패/close 회수 |
| Frame clock | Windows display timing·GTK GdkFrameClock·AppKit display link·Web rAF를 사용하는 start/target/deadline·input wake·idle 정책 | 같은 조건의 실제 build/content/raster/submit 시간과 frame 수요/credit. 고주사율·모니터 이동·resize·App/Content 지연·숨김/복귀. Timer callback 수를 FPS로 쓰지 않음 |
| Cache·damage | 위 재사용/clock 결과 후 raster cache admission/eviction·damage/부분 재그리기 | Backend가 보존을 보장하는 surface에서 전체 재그리기와 pixel 비교. Clip/opacity/filter·buffer 교체·resize/device loss 무효화. 미지원 surface의 전체 재그리기 유지 |
| 이미지·외부 콘텐츠 | Animated codec frame/duration/loop·texture registration/update·platform view geometry/clip/opacity/paint order/input | Frame producer/consumer fence·취소·재등록·late callback·숨김/close·native input/접근성의 실제 host 경로. 영상/카메라/plugin은 해당 공급까지 따로 확인 |
| Pressure·예산 | OS memory pressure를 Content/Render cache 축소·필요 자원 재준비로 연결, 신규 cache/texture·GDK/Metal hold 포함 | Reservation·heap 관측·RSS/VRAM 범위를 구분. 거부/교체/pressure/close 뒤 bounded 상태와 다음 정상 frame 회복. 불투명한 driver peak는 미관측 한계 유지 |

Windows의 FIFO present는 이미 존재한다. **Present mode와 frame 생산 clock을 구별**하고 `DwmFlush`·Vulkan present·Metal completion·GTK frame clock·Web rAF 중 어느 것도 물리 scanout 시각으로 재명명하지 않는다. GTK clock의 frame 시각/refresh 예측은 [GdkFrameClock](https://docs.gtk.org/gdk4/class.FrameClock.html) 계약을 따른다.

Clock은 고정 16 ms 반복에서 display 수요 기반 일정으로 옮기되 더 이른 input/control wake가 대기를 깨워야 한다. Web threaded에서는 owner에서 실제 사용할 수 있는 worker rAF/프레임 신호를 검증하고, 지원하지 않는 환경의 명시적 timing 경로와 capability를 보고한다. Single-worker의 `contentIndependent=false`와 유한 task/quota를 유지한다.

Host별 frame 수요·credit의 권위자는 하나로 두고 rAF/display callback·input wake·기존 timer가 중복 raster loop를 만들지 않게 한다. Web은 실제 Render worker에서 rAF 등록·취소·숨김/복귀를 확인하며, worker 종류/생성 관계에 따른 지원 여부는 [AnimationFrameProvider 계약](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#animation-frames)을 따른다. App의 Ticker/build callback과 Core compositor의 진행을 구별하고 App callback을 매 frame ACK 장벽으로 넣지 않는다.

W9-10-A에서 단조 clock의 단위·기준과 session/frame/publication ID를 정한다. Native QPC, Main/worker의 서로 다른 시간 기준은 변환 근거 없이 빼지 않으며 비교할 수 없는 구간은 미관측으로 남긴다. 같은 입력 구간의 build/content/raster/submit·게시를 연결하고 startup 작업을 포함하지 않는다. Hidden/zero-size에서는 frame 생산을 멈추되 입력 terminal·ACK·자원 release·close는 계속 진행해야 한다.

**순서는 clock·관측과 필수 자원 수명 → 실제 재기록/shaping/decode 재사용 → 측정상 필요한 raster cache/damage다.** W9-10-A의 clock·단계 시간과 W9-09의 hold/예산은 최소 수직 연결부터 확인하고 기능 확장 때 함께 갱신한다. W9-11은 원래 API가 요구하는 animated/외부 콘텐츠 지원과 선택적인 추가 최적화를 나눈다. 기존 API 의무인 기능은 1차에서 구현하거나 미완료로 표시하며, 새 backend·추가 cache 최적화를 전체 API 호환의 근거 없이 필수 선행 단계로 늘리지 않는다.

## 10. 입력·편집·semantics·가상화와 복구

- 전체 nested gesture arena·capture/우선순위·pan/pinch·bouncing/clamping·transform/clip motion graph를 추가한다. OS pan/zoom/momentum과 engine physics의 소유자를 stream별로 하나만 두고 cancel/반전/재접촉·modal 전환·삭제 시 terminal을 검사한다.
- 기존 bounded builder/anchor·수평 list·먼 index seek를 보존하면서 선언형 native item template, 가변 높이·reorder·느린/실패 builder·먼 lazy focus 준비를 보완한다. 모든 item keep-alive로 성능을 만드는 대신 retention/coverage와 실제 resource bytes를 함께 검사한다.
- 모든 bidi/affinity·키 이동/삭제·clipboard·editor 내부 scroll·focus/caret reveal를 같은 paragraph revision에서 구현한다. OS 조합 종료 승인 전 App replacement를 적용하지 않고 focus session 변경·timeout·중복/late 답변을 처리한다.
- Semantics에 traversal/hit-test 순서·scroll 정보·문자열 속성·heading·custom action을 보강하고 Windows UIA, GTK/AT-SPI, AppKit NSAccessibility, Web ARIA, 모바일 peer로 연결한다. 최신 비시각 값과 게시 bounds를 구분하고 UI thread에서 shaping/JS 동기 대기를 하지 않는다.
- Web `dom-textarea/aria` profile은 유지한다. EditContext character bounds를 추가한다면 별도 capability와 실제 지원 browser 검사를 제공하고 EditContext가 없는 편집 경로도 유지한다.
- 다중 view quota·독립 close, hide/zero-size/restore, device/context loss와 재생성 중 close를 검증한다. 같은 session 복구를 구현하지 못한 경로는 실패 후 **새 session/surface** 정책을 명시하고 복구 완료로 세지 않는다.
- **1차 W9-12-A**에서 Windows/Web generation reload·device/context loss·재시작/close를 연결한다. Reload는 파일 감시 → 검증된 새 bundle 준비 → 이전 App의 신규 입력/작업 admission 닫기·callback/gesture/edit 세대 차단 → 이전 App dispose/drain → 새 App 접속/게시로 정의한다. 준비 실패는 기존 session 유지, 교체 진입 뒤 실패는 명시적 terminal로 처리한다. 상태 보존 hot reload는 별도 기능이며 단순 build/run으로 표시하지 않는다. 모바일 port를 기다리지 않고 현재 CLI/일반 앱으로 확인한다.

Reload의 **App 세대만 교체하는 경우와 host/session/surface까지 교체하는 경우**를 나누고 각각의 입력 중단 구간·마지막 정상 scene·worker/VM·pending/lease 회수를 정의한다. 이전 세대의 신규 mutation을 막아도 ACK·취소 terminal·소유 자원 release용 경로는 drain까지 유지한다. 파일 변경은 최신 후속 bundle 하나로 합치며 오래된 build 완료가 새 generation을 덮지 않게 한다. 무응답 dispose/worker·실패한 surface 생성·close와 겹친 reload는 유한 deadline 뒤 명시적 실패로 끝내고, 이전 세대의 입력을 새 App에 재생하지 않는다.

## 11. Web·모바일에서 유지할 범위

### 11.1 채택 방침과 앞선 소스 검토

**Web과 [§4.1](work9-1.md#41-windows-rnw-소스-선별-재사용)의 Windows RNW 재사용은 1차 개발이다. Android는 4부의 2차 W9-12-B(Android), iOS는 그다음 후속 5부의 3차 W9-12-B(iOS)로 진행한다.** 모바일 플랫폼 adapter를 만들 때 Nelyx와 RN의 OS 연결 소스를 선별 재사용한다. C++ core가 layout·editing document·gesture 판정·scroll/motion·scene·frame 일정을 계속 소유한다. RN의 전체 앱 실행·렌더러를 필수 기반으로 추가하지 않는다. 이 방침은 구현 계획에 채택했으며 실제 소스 추출·새 host 빌드·실기기 검증은 아직 하지 않았다.

앞선 소스 검토의 비교 기준은 로컬 설치 **`react-native@0.83.10`**, **`react-native-web@0.21.3`**와 당시 저장소 소스다. 이 버전은 소스 비교의 기준이며 Android/iOS의 기존 runner나 Hermes/JSI 공급을 자동 갱신하는 결정이 아니다. 모바일 소스를 실제 도입할 때 해당 target의 W9-12-B/M0에서 원본 tag/commit·파일 hash·의존성과 runtime/ABI를 다시 확인해 고정한다. Android 도입은 2차, iOS 도입은 3차이며 양쪽 공급을 한 번에 준비하지 않는다. Web helper를 먼저 도입하면 해당 helper의 출처만 그 작업에서 고정한다.

| 검토한 소스 | 확인한 재사용 범위와 의존성 | 채택 방법 |
| --- | --- | --- |
| [Nelyx InputConnection](Nelyx/sdk/native/android/NelyxInputConnectionView.kt)·[keyboard host](Nelyx/sdk/native/android/NelyxKeyboardHost.kt) | BaseInputConnection·조합/selection·batch edit·CursorAnchorInfo·focus/close 처리가 있으나 `ThemedReactContext`, RN map/event/manager에 연결됨 | **Android의 첫 출발점**. OS 처리와 RN 전달 계층을 분리하고 native 값 타입·JNI/engine port로 교체 |
| [Nelyx Android semantics](Nelyx/sdk/native/android/NelyxSemanticsView.kt)·[OS services](Nelyx/sdk/native/android/NelyxPlatformServices.kt) | Native accessibility/action·Activity 서비스의 일부 구현. ReactViewGroup/ViewManager·ReactApplicationContext 소유권과 섞여 있음 | OS 로직과 사례를 재사용하고 v2의 view/semantic handle·Activity 수명으로 재결합 |
| [RN Android 입력 wrapper](https://github.com/react/react-native/blob/v0.83.10/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/views/textinput/ReactEditTextInputConnectionWrapper.kt) | `ReactEditText`·EventDispatcher에 결합된 soft-keyboard `onKeyPress` 처리. 조합 전후 커서로 key를 추정하고 batch에서 한 key를 선택 | IME별 경계 처리·사례를 선별. **추정 key를 편집 명령의 원본으로 쓰지 않음** |
| [RN iOS delegate adapter](https://github.com/react/react-native/blob/v0.83.10/packages/react-native/Libraries/Text/TextInput/RCTBackedTextInputDelegateAdapter.mm) | UITextField/UITextView의 선택·자동수정·delegate 이벤트 순서 처리. `RCTBackedTextInputViewProtocol`과 native text control에 의존 | 공통화 가능한 OS handler와 회귀 사례를 이식. Core paragraph geometry를 쓰는 custom UITextInput에 그대로 연결된다고 가정하지 않음 |
| [Nelyx Apple OS service](Nelyx/sdk/native/apple/NelyxPlatformServices.m)·[기존 RN 입력 peer](Nelyx/sdk/src/backends/react-native/interaction-controls.tsx) | Locale/navigation은 RCTBridgeModule·RCTKeyWindow를 사용. 입력 peer는 React/RN control을 생성 | 서비스 기능은 중립 callback으로 이식. RN peer나 Apple shutdown marker의 존재를 v2 UIKit 입력 host 완료로 세지 않음 |
| [현재 Web 입력/ARIA](Nelyx/sdk/src/runtime/engine-v2-interaction.ts)·RN Web TextInput/createElement | V2는 Main의 DOM carrier를 직접 관리. 설치 RN Web 소스는 React hook·React element·DOM props 생성과 연결됨 | 기존 v2를 유지하고 실제 필요한 DOM 호환 helper/사례만 추출. [RN Web의 React DOM 기반 구조](https://necolas.github.io/react-native-web/docs/)와 구별 |

RN의 render/commit/mount는 React element·shadow tree·layout·host view를 연결한다. 이를 통째로 추가하면 Nelyx의 document/layout/activation과 책임이 겹친다는 것이 이번 설계 판단이다. 재사용 범위는 OS 동작과 연결 helper이며, Fabric/Yoga·React commit·Responder/Animated·ReactChoreographer를 Nelyx의 두 번째 상태/일정 소유자로 넣지 않는다. [RN 공식 render pipeline](https://reactnative.dev/architecture/render-pipeline)

### 11.2 중립 adapter와 상태 계약

```text
Android InputConnection / iOS UITextInput / Web DOM 입력
  → OS adapter: 입력 연산·focus·조합·동기 질의용 mirror
  → bounded engine port: session/view/node 세대·edit revision·요청 ID
  → C++ editing/interaction: 승인 상태·undo/selection·gesture·scene
  → 값/terminal 및 게시 geometry
  → OS adapter: mirror·후보창·접근성 갱신
```

| 책임 | 고정할 계약 |
| --- | --- |
| C++ document와 UI mirror | Core가 승인된 text/selection/composing·undo의 권위 상태다. UI mirror는 OS의 동기 입력 호출에 대응하는 버전 있는 버퍼이며 별도 앱 편집 모델을 만들지 않는다. 연산 ID·base revision·focus/connection 세대, pending 상한과 ACK/NACK 후 재동기화를 정의 |
| 입력과 echo | Commit/setComposing/selection/delete/batch 등 **실제 OS 연산 또는 결과 값**을 정규화한다. RN의 추정 `onKeyPress`나 App callback의 재전송으로 동일 입력을 두 번 적용하지 않는다. 동일 값 echo로 native composing/marked range를 끊지 않음 |
| Geometry | 후보창·caret/range·hit-test·접근성 bounds는 대응하는 **게시 paragraph/publication**에서 제공. 최신 비시각 값에 해당 geometry가 없으면 unavailable로 처리하며 UI에서 text를 다시 shaping하거나 App 응답을 동기 대기하지 않음 |
| 스레드·전송 | UI 객체·IME delegate·accessibility는 OS UI owner, JNI/Objective-C++의 packet admission·해제는 명시 소유자, layout/준비/GPU는 기존 owner에 둔다. Callback은 owned immutable 값을 복사하고 RN map·JSI object·native view 포인터를 wire/worker에 보관하지 않음 |
| Focus·종료 | OS focus와 Core focus session을 연결하고 이전 InputConnection/delegate·reload 결과를 generation으로 거부. Commit/cancel은 OS 종료 확인과 최신 revision을 거친다. Close 뒤 예약 callback·keyboard observer·scene/view·surface hold를 회수하고 복합 오류를 보존 |

OS 동기 API에 반환할 값, Core 승인 전 mirror 변경의 허용 범위, 거부 시 조합을 보존하며 복구하는 방법을 정의한다. 1차에는 Windows/Web의 W9-01/07/12-A에 적용한다. 모바일 W9-12-B/M1은 2차 Android의 DTO/JNI부터 수행하고, 3차 iOS에서 UITextInput adapter로 확장한다. 단순 queue 전달만으로 입력 호환을 완료 처리하지 않는다.

### 11.3 Web — 기존 DOM·Worker host 유지

Web은 두 engine 빌드와 하나의 고정 owned `m153-nelyx-paragraph.1 / API 1` CanvasKit 공급을 유지한다. npm 의존성은 타입 선언에 사용하며 선택된 runtime의 manifest·hash·실제 API가 다르면 시작을 거부한다. 실제 page/worker capability를 한 번 확인해 session profile을 고정한다. **COOP/COEP가 없으면 `auto → single-worker`로 화면·입력·정상 종료가 동작해야 한다.** 명시 threaded 요구·Worker/CSP/OffscreenCanvas/WebGL2 부족·공급/ABI/hash/초기화 오류는 원인별 시작 실패다. [기존 배포 검증표](history/26/11/04/work8-3-summary.md#164-web-비격리-배포와-profile-검증표)

**W9-02-B는 Windows App SDK 연결과 같은 차수의 필수 단계**다. 동일한 작은 일반 앱을 Windows와 두 Web profile에서 실행하고 C++ 작업·게시·편집·resize·hide/restore·close를 대조한다. 초기 실제 browser 대상은 Windows Chrome·Edge이며 제품 browser/version·GPU·devicePixelRatio·worker capability를 기록한다. Headless Chromium의 성공을 이 두 실제 browser의 물리 입력·GPU 성능 결과로 대신하지 않는다.

| Web 실행 조건 | 1차 완료 조건 |
| --- | --- |
| 비격리 `/plain/`, `auto` | 공유 메모리 없이 single-worker 선택, 같은 기능 corpus·입력 보존·유한 Content 점유 후 회복·정상 종료 |
| 격리 `/isolated/`, `auto` | 실제 page/worker probe로 threaded 선택, App/Content 지연 중 준비 scene 진행·정상 종료 |
| 격리 `/isolated/`, 강제 single-worker | 격리 여부와 무관하게 non-shared engine build·하나의 engine worker를 실제 선택. 같은 기능/close corpus와 `contentIndependent=false` 확인 |
| 강제 요구·손상 공급 | 비격리의 강제 threaded, capability 부족·잘못된 worker URL·ABI/hash/초기화 실패를 명확히 거부. 다른 renderer로 숨기지 않음 |
| DOM·surface 수명 | Main의 focus/clipboard/ARIA·게시 geometry, canvas 크기/DPR revision·숨김/복귀·context loss 정책·재생성/close에서 late event 차단 |

헤더 이름만으로 격리를 판정하지 않고 실제 `crossOriginIsolated`·worker·전송/초기화를 확인한다. 격리와 공유 메모리의 브라우저 계약은 [crossOriginIsolated 문서](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated), canvas의 worker 소유권은 [OffscreenCanvas 문서](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)를 대조한다. 정확한 지원 범위는 실행한 browser에 한정한다.

RN Web은 필요한 focus·composition·selection·keyboard·ARIA/브라우저 차이의 helper와 사례를 고르는 참고 기반이다. 현재 `dom-textarea/aria` carrier·Main의 trusted action·C++ 게시 geometry를 유지하고 React DOM component tree·CSS layout·RN ScrollView/Responder를 v2 canvas의 필수 경로로 도입하지 않는다.

각 helper는 해결할 실제 browser 사례·원본 경로/버전·필요 의존성·Nelyx에서 바꾼 의미를 먼저 적는다. 독립성이 없거나 현재 구현으로 처리하는 helper는 가져오지 않는다. 도입 시 두 Web profile에서 비교하고, Worker 내부 DOM 조작·새 renderer fallback·매 frame React commit이 생기지 않는지 확인한다.

Web의 신규 session은 profile probe를 다시 할 수 있지만 실행 중인 session의 worker/heap/profile은 바꾸지 않는다. Surface 재생성으로 canvas owner를 다시 만들 때는 **새 HTML canvas와 새 OffscreenCanvas**를 준비한다. 이미 이전한 canvas에 `transferControlToOffscreen()`을 다시 호출할 수 있다고 가정하지 않으며, 이전 DOM carrier·listener·worker·CanvasKit/GPU 자원의 종료와 새 세대를 연결한다. [HTML canvas 이전 계약](https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-transfercontroltooffscreen)

App·engine·CanvasKit JS/Wasm·font/image URL은 같은 bundle identity로 확인한다. Plain/isolated 배포와 하위 base URL에서 MIME·CSP/worker/Wasm 허용·cross-origin 자원 정책·HTTPS 또는 신뢰된 localhost 조건을 검사한다. 오래된 cache/혼합 자원·손상 파일은 명시적 공급 실패로 처리하며, 외부 image/clipboard 권한 거부·취소도 해당 API의 동작과 자원 회수에 포함한다.

플랫폼별 구현은 **[4부의 Android §11.4](work9-4.md#114-android--기존-nelyx-os-코드를-먼저-분리)**와 **[후속 5부의 iOS §11.5](work9-5.md#115-ios--uikit-입력-endpoint와-rn-예외-처리-이식)**로 분리했다. 공통 입력 계약·Web helper·도입 gate와 검증 corpus는 이 부에 유지한다.

### 11.6 도입 순서와 의존성 gate

M0–M4는 재사용 범위의 식별자다. **1차 Web의 M3는 모바일 M0–M2 완료를 기다리지 않는다.** 모바일 추출·통합은 2차 Android → 3차 iOS 순서로 해당 target의 W9-12-B와 W9-13에서 수행한다. Android의 M0–M2/M4 완료에 iOS 구현·Apple 공급을 요구하지 않는다.

| 항목 | 연결 단계·차수 | 완료 조건 |
| --- | --- | --- |
| M0 — 원본·범위 고정 | W9-12-B / Android 2차·iOS 3차 | Nelyx 우선 재사용·RN 도입·참고만 할 파일을 구별. 원본 tag/commit·파일 hash·변경 이유·필수 의존성·license/notice를 고정. 로컬 node_modules 전체를 제품 source로 복제하지 않음 |
| M1 — 중립 계약·helper 추출 | W9-12-B / Android 2차·iOS 3차, W9-01의 공통 계약 사용 | Native DTO/packet·mirror/ACK·focus/connection/reload generation·UI thread·callback/close 계약. 새 standalone adapter는 RN 앱 객체 없이 compile/link 가능하고 기존 v1 wrapper의 기능도 유지 |
| M2 — 모바일 수직 실행 | W9-12-B / Android 2차·iOS 3차 | 해당 차수의 Android 또는 iOS **각각**의 일반 앱에서 scene·OS 입력/편집·semantics·surface 재생성·close/drain. SDK 요청과 실제 C++ 작업 대조. RN 부재를 runtime 시작/입력 실패로 숨기지 않음 |
| M3 — Web helper 선별 | W9-07/12-A / 1차·필요한 경우 | 재현된 browser 차이와 필요한 helper만 반영. 출처·의존성, Main의 DOM 소유권·trusted activation·두 profile·geometry·회수 유지. 도입할 helper가 없으면 기존 host 유지로 기록 |
| M4 — 공급·통합 | W9-13 / 대상별 | 1차는 Windows/Web 및 도입한 RNW/Web helper, 2차는 Android, 3차는 iOS의 dependency/link graph·설치본·앱 entry를 각각 확인. Runtime identity·host/IME/semantics corpus·손상 거부·종료 통과 |

V2 standalone target의 실제 Gradle/CMake·Pod/Xcode link·bundle dependency graph에서 ReactHost/ReactContext·ViewManager/UIManager·Fabric/Yoga·RCTBridgeModule/TurboModule·React DOM renderer 의존성을 검사한다. 소스 이름에서 `React`를 지운 것만으로 분리 성공으로 세지 않는다. 기존 v1 runner나 workspace의 RN 의존성은 이 gate와 구별한다.

Hermes/JSI는 별도로 고정한 VM/ABI 공급으로 사용할 수 있다. 이를 RN 앱 runtime 도입으로 혼동하지 않으며, JSI object를 UI/worker 경계로 넘기지 않는다. RN source를 일부 가져온 것만으로 RN ViewManager/TurboModule 기반 외부 패키지가 자동 호환되지는 않는다. 필요한 plugin/API는 명시 adapter·capability·수명·실제 설치 사례로 연결하고 기존 SDK 공개 API 호환 gate도 계속 적용한다.

### 11.7 공통 입력·수명 검증 corpus

1차에는 Windows TSF/UIA와 Web DOM/ARIA에 해당하는 사례를 적용한다. InputConnection·Android surface 사례는 2차 W9-12-B(Android), UITextInput·iOS scene 사례는 3차 W9-12-B(iOS)에서 실행하며 플랫폼별 비적용 사유와 미검증을 구별한다.

| 범위 | 필수 확인 |
| --- | --- |
| 편집 단위·중복 | 한글 조합·자동수정·selection replacement·다중 문자 commit·UTF-16 surrogate/결합/emoji·code-point 삭제. 실제 연산 1회에 Core 변경 1회, 추정 key/echo로 중복되지 않음 |
| 동기 API·mirror | OS 호출 직후 질의·nested batch·ACK 지연/거부·같은 값 echo·연산 순서. Core revision과 UI mirror의 관측 범위·pending 상한 및 조합 보존 복구 |
| Focus·조합 | Commit/cancel·App programmatic edit·focus 이동·새 InputConnection/marked range·timeout·keyboard show/hide·background. 이전 session/connection의 late callback 거부 |
| Geometry·접근성 | Scroll/scale/resize 중 후보창·caret/range·hit와 게시 ID 일치. 새 text/이전 paragraph의 범위 거부, Windows UIA/Web ARIA와 후속 Android accessibility/iOS VoiceOver의 값·focus/action·중복 노출 확인 |
| Core 독립 진행 | Native/Web threaded는 App/Content 지연 중 준비 scene 입력·합성. Web single-worker는 App 독립·유한 Content 점유 후 회복. UI input admission·bounded pending을 유지하고 keyboard·delegate 때문에 매 frame App ACK를 요구하지 않음 |
| Surface·세대 수명 | Detach/attach·Android surface 재생성·iOS scene 전환·reload·device loss·close 중 교체. Observer/task/delegate·JNI/native ref·GPU hold·pending 요청 회수와 복합 오류 보존 |
| Web profile | Plain/isolated 두 profile의 같은 편집·focus·ARIA corpus, 실제 trusted clipboard/권한 거부·composition 종료 교섭. DOM carrier/Worker 종료 뒤 late event 차단 |

각 검사는 OS/ABI·device 또는 simulator/emulator·IME/browser·입력 source·공급 identity를 명시한다. 위 항목은 **앞으로 통과해야 할 조건**이며 소스 검토·모의 callback·synthetic key 성공을 물리 IME/reader·scanout·성능 수락으로 올리지 않는다.
## 현재 API·입력 구현 — 2026-11-06 KST

Windows/Web 공개 입력은 실제 NodeNext consumer에서 각각 해석한다. Windows는 ES2022, Web은 ES2022/DOM/browser condition이며 모두 `skipLibCheck=false`다. Compiler **6.0.3**, workspace alias `@typescript/typescript6@6.0.2`, 선언 진단·오류 **0**, `inputValid=true`다. 원래 **4 package·834 subpath·4541 hash**를 보존했고 추가 entry 포함 실제 **836 subpath·4544 항목**을 검사한다. Windows 적용/비적용은 **802/34**, Web은 **788/48**이다.

[API audit](Nelyx/engine/tools/api-audit.mjs)의 original/3은 설치 경로와 compiler symbol 번호를 안정화하고 union 순서만 정규화한다. Well-known/unique symbol 출처, literal, overload/intersection 순서·member/protected 변경과 원래 package JSON 값은 계속 구별한다. 회귀 **21/21**, strict audit는 오류 0·`compatible=false`·exit **1**이다. 작은 데이터 사례·서명·import 허용만으로 전체 동작을 승인하지 않는다.

[OriginalWidgetHost](Nelyx/runtime/engine-client/original.ts)는 명시적 `@nelyx/sdk/engine-v2-original` 경로에서 canonical BuildOwner/Element/State/Inherited/GlobalKey를 App에 유지한다. 표준 RenderObject는 설정만 전달하고 C++가 layout을 수행한다. 원래 key/context identity·즉시 setState·NACK 후 App 값 및 native scene 보존·ACK 뒤 dispose·viewport reader 선택 갱신을 연결했다. Render metadata의 TS layout/query/paint/hit-test와 미이식 hook/service는 명시적으로 거부한다. 동기 geometry/custom hook과 전체 Widget/디자인은 미완료다. 원래 ListView/ScrollController는 세로 고정 extent·유한 bounded 목록부터 연결했다. 즉시 listener 재진입·먼 pixel seek·native animation terminal·detach를 Native 통합 1개로 확인하고, 실제 HWND 앱에서도 20,007→20,027px 이동과 행 표시를 확인했다(C++ 5,245 = SDK ACK 5,245, TS layout fallback 0). 전체 controller/scroll API의 호환 완료로 올리지 않는다.

현재 ConstrainedBox·Padding·ColoredBox, RTL/up Flex·Align/Center·비 positioned Stack·plain Text와 basic ClipRect·affine Transform을 연결했다. Text는 정렬 6종·RTL·locale·nowrap·maxLines/ellipsis·height/0 이상 간격·leading/height behavior·manual/hidden hyphen를 지원하며 provider가 실제 일반 굵기 **400** font를 소유한다. C++는 intrinsic box·paragraph paint 폭·자연 높이·overflow를 구분한다. 변수 글꼴 기본 굵기 100 재사용, nowrap 폭, raster hinting, Native 측정 응답의 옛 크기를 실제 대조로 수정했다. 사용자 font·다른 굵기/italic·음수 간격·rich span/strut·전체 text query는 미완료다.

공급 `90649c3d…`(ABI **2**, schema **4122515473**)에서 Core **283/283**, 원래 bridge **42/42**, canonical CanvasKit pixel 포함 graphics **6/6**, glyph **3/3**, geometry **2/2·7/7**, 전체 host **17/17**, 독립 설치/local strict compiler 포함 runner **19/19**, 개발 재시작 **7/7**을 통과했다. 정렬·RTL·height/spacing·resize를 쓰는 실제 원래 앱 소비자는 HWND/App SDK/Web 두 profile **4/4**이며 Native는 geometry·semantics, Web은 glyph pixel도 확인한다. 실제 Testbed **C++ 1251 = SDK ACK 1251**, TS fallback **0**이다. 전체 API·물리/성능 수락으로 확대하지 않는다.

입력은 동일 document의 게시 관측/capture를 각각 **8개**로 제한하며, 대기 중 begin/up도 현재와 동일한 대상·조상 geometry가 입증될 때만 수락한다. 이동·가림·만료·App document 교체·wheel 퇴역·terminal/close와 제거한 자원 회수를 검사했다. 앞선 HWND UIA E_UNEXPECTED와 headless plain 간헐 실패는 원인 미확정으로 남긴다. 같은-document 재준비의 stale 경합은 별도 재현·수정 범위다.

수요 clock은 Native DWM composition QPC와 Web worker rAF/pthread Main rAF를 사용한다. Content cache는 한 세대·**16 MiB**이며 Native **95**·Web **96** 재사용과 추가 image decode **0**, pressure/eviction 뒤 active hold 보존을 확인했다. 개발 runner는 candidate 검증·세대별 자산·이전 App/VM/worker/provider drain을 수행한다. 실제 OS low-memory 신호, 상태 보존 reload·loss 복구·전체 frame 일정/성능·per-monitor scanout은 미완료다.

현재 owned m153 paragraph runtime의 manifest/hash·API 1과 Native/Web manual/hidden hyphen을 연결했다. Cache가 비어 있는 첫 문단의 생성 hyphen font 참조와 ready callback 이후 SDK/native 집계의 stale 관측도 실제 네 앱 경로에서 재현·수정했다. 마지막 전체 검증 공급의 host **17/17**, 독립 설치 포함 runner **19/19**, 개발 재시작 **7/7**을 확인했다. Native 두 host에서 clip·원점/중심 회전·flip·한글/이모지를 직접 확인했다. 표준 clip 계열과 원래 ListView/ScrollController의 일부를 연결했으며 scroll·gesture/control·디자인 등 고수준 API를 계속 개발한다. 기초 reference 4개를 제거하고 기능마다 전체 suite를 반복하는 절차를 중단했다. 기능 통합 1개와 필요한 빌드·실제 앱 연결을 우선한다. 앞선 공급 `7a2922c8…`(schema **4120097723**)의 빌드·source identity와 원래 버튼/gesture/목록 통합 **3/3**을 확인했다. Tap/long-press·drag details에 이어 CupertinoButton의 원래 theme·State/controller·semantics, Opacity/기본 장식과 App frame clock을 연결했다. 실제 App SDK에서 세 버튼·disable·Tab/Enter와 AnimationController의 opacity 1→0.5→1, **C++ 788 = SDK ACK 788**, fallback 0을 관측했다. 직전 기능 검증 `9fa78a98…` 공급에서 같은 Web 버튼 소비·hover 유지/이탈과 opacity 실제 pixel·종료 대표 통합 **1/1**을 두 profile에서 확인했다(C++/SDK ACK 각각 794/795, fallback 0). 원래 목록 controller의 외부·내부 교체도 연결해 같은 position/offset과 attach/detach callback을 유지하며 Native 대표 통합 **1/1**을 확인했다(C++ 6285 = SDK ACK 6285). Material 및 전체 focus/semantics·OS cursor는 미완료다. 보조 버튼·double-tap details·scale/force·전체 arena/overflow hit 계약은 미완료다. 위 전체 회귀 수치는 앞선 `90649c3d…` 공급의 기록이다. 최신 공급·실패·잔여 범위는 [3부](work9-3.md#현재-구현검증과-잔여-작업)를 따른다. Android/Linux·iOS/macOS는 DEFERRED, 물리 IME/reader/trackpad·display/scanout과 성능 두 flag는 미수락이다.

**외출 일시정지 — 2026-11-06 KST:** 사용자 요청으로 PAUSED / PARTIAL. Material의 native shape·border·highlight/ripple와 font weight 설정을 연결 중이며 실제 Material 앱은 아직 통과하지 않았다. 마지막 전체 빌드 공급은 `68b9fdc1…` / schema **486707000**, 이후 MediaQuery·진단/CLI 변경과 형식 정리로 현재 source identity가 달라졌다. 현재 소스로 rebuild한 뒤 대표 통합부터 재개한다. 진행 중 빌드·실행 창·임시 앱은 정리했다. 상세 상태와 복사할 명령은 [3부 재개 기록](work9-3.md#외출-일시정지-기록)을 따른다.
