# work9-2 — 2부: 공개 API·렌더링·입력·Web

> 2026-11-07: 사용자 요청으로 본문의 독립 테스트·감사·실험 명령을 폐기했다. 이전 검증 기록과 미완료 판정은 보존하며, 현행 확인·정리 기준은 [전체 목차의 정리 안내](work9.md)를 따른다.

작성: **2026-11-05 KST** · 갱신: **2026-11-07 KST** · 상태: **IN_PROGRESS / 사용자 요청 재개 / 전체 호환 PARTIAL**

[전체 목차](work9.md) · [이전: 1부](work9-1.md) · [다음: 3부](work9-3.md)

**범위:** 원문 §8–10과 §11의 공통·Web 계약(§11.1–11.3·§11.6–11.7). 기존 공개 API, 렌더링·자원 재사용·frame, 입력·복구와 Web 두 profile을 다룬다. Android 구현은 4부의 2차, iOS 구현은 후속 5부의 3차로 분리한다.

**실행 순서:** Windows/Web 1차는 [3부 §12.2의 실행 묶음](work9-3.md#122-windowsweb-1차-실행-순서)을 따른다. 이후 **[4부의 Android·Linux 2차](work9-4.md) → [후속 5부의 iOS·macOS 3차](work9-5.md)**로 진행하며 후속 플랫폼을 Windows/Web 1차 완료의 선행 조건으로 두지 않는다.

다음 차수 착수는 앞선 차수 전체 대상의 **W9-13 기술 완료**를 기준으로 하며 W9-14의 물리·성능 수락과 구별한다. [완료·차수 전환 기준](work9-3.md#125-차수-전환과-완료-판정)

## 8. 기존 공개 API 호환 작업

사용자 기준인 **원래 import·생성자·동작 호환**을 유지한다. 원래 동기 API를 비동기 snapshot으로 바꾸는 work8 초기 변경안은 호환 완료 조건이 아니다.

[1부 §1.1](work9-1.md#11-typescript-디자인-패키지와-c-엔진의-책임)에 따라 `packages/cupertino`·`packages/material`의 구현은 TypeScript에 유지한다. 아래의 디자인 연결·API 이식은 원래 TypeScript 구현이 C++ 엔진의 공통 연산을 사용하는 작업을 뜻한다.

| 작업                     | 구현·검증할 의미                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate 입력                | **W9-00에서 먼저 정상화.** [원래 공개 표면](Nelyx/engine/schema/public-api.json)을 유지. 현재 [audit](Nelyx/engine/tools/api-audit.mjs)의 단일 declaration program을 Windows/Web의 target별 program·명시 환경으로 분리하고 원래 entry와 동작 의무를 매핑. `inputValid=true`와 `compatible=true`를 별도 판정. 누락/module/reexport·해석 실패·빈/non-code export를 지우거나 `skipLibCheck`로 FAIL을 없애지 않음 |
| Widget/P1                | 원래 Widget/Element/State/BuildContext·Inherited·GlobalKey와 Key equality·parent data·init/update/deactivate/activate/dispose. Reparent/NACK/build 예외·listener 재진입·정확한 해제 횟수를 원래 호출로 검사                                                                                                                                                                                                   |
| RenderObject/custom hook | 원래 intrinsic/baseline/layout/paint/hit-test/protected subclass 계약을 API별로 대응. 표준 node·등록한 native extension·명시 App boundary의 실제 실행과 한계를 검증. `AppDrivenBoundary`나 alias만으로 임의 동기 hook을 호환 처리하지 않음                                                                                                                                                                    |
| 동기 상태 API            | ScrollController pixels/jump/animate, editing value/selection, layout geometry의 즉시 읽기·쓰기·listener를 ACK 전후/실패/취소/재진입에서 비교. App의 관측 상태와 C++ 권위 상태를 구별하고 stale cache를 현재 값으로 반환하지 않음                                                                                                                                                                             |
| 디자인/P3                | 두 TypeScript 패키지의 원래 Widget/State·생성자/default·theme/typography/icons/shapes·form/control·route/overlay/modal·전환·localization을 유지한 채 공통 engine 연산에 연결. SDK app/service/platform API도 원래 사용 사례로 검사. C++ 컴포넌트 재구현으로 대체하지 않음                                                                                                                                     |
| 실제 소비                | [API 동작 사례](Nelyx/engine/tools/api-behavior.mjs)와 [audit](Nelyx/engine/tools/api-audit.mjs)에 overload/member별 의무를 추가. 부분 검사한 class의 나머지 의무는 그대로 남기고 installed package의 원래 import·compiler·runtime에서 실행                                                                                                                                                                   |

임의 동기 JS subclass와 독립 Content owner 사이에 동기 callback을 추가하면 교착·App 지연이 생길 수 있다. **W9-06-A를 W9-00 직후의 선행 검증으로 분리**한다. 기존 구현 위에서 State/GlobalKey/context·동기 controller·custom layout/paint/hit-test의 대표 원래 consumer를 실행해 보존할 상태·실행 위치·ACK 전후 의미를 정한다. 큰 그래픽 확장이나 전체 Widget 이식 전에 이 경계를 확인한다.

보존하지 못한 원래 계약은 API별 미완료로 남기며 public API 변경이 필요하면 변경 대상·이유를 명시한다. 이 경우 독립 기능 개발은 계속할 수 있지만 전체 호환과 제품 기본값 전환은 통과시키지 않는다. UI/Content가 App의 동기 응답을 기다리는 우회나 숨은 TS layout/paint fallback으로 해결하지 않는다. Target별 적용 여부와 원래 공개 표면의 분모를 유지하며 후속 플랫폼 미검증을 Windows/Web의 전체 플랫폼 호환 성공으로 합치지 않는다.

### 8.1 검사 환경과 실행 모델의 선행 판정

W9-00의 target별 program은 **실제 설치 consumer의 export condition·module resolution·`lib/types`·compiler 버전**과 맞춘다. 공통 entry는 Windows와 Web 모두 검사하며 Web의 threaded/single-worker 동작 사례도 분리한다. 플랫폼 전용 entry의 비적용은 원래 공개 계약·조건부 export에 근거를 남기고, 이식이 어렵거나 환경 진단이 난다는 이유로 제외하지 않는다. 원래 표면에서 target별 적용·비적용·미검증의 합계가 빠짐없이 대응해야 하며, `public-api.json`을 현재 v2 구현만으로 재생성해 분모를 줄이지 않는다. 의도적으로 충돌하는 환경 분리와 실제 consumer에서도 재현되는 타입 결함 수정을 구별한다.

W9-06-A는 대표 consumer마다 **원래 호출·동기 반환/즉시 읽기·listener 순서·실행 owner·ACK 전후/거부 시 값·실제 C++ 작업**을 함께 확인한다. TypeScript가 소유하는 컴포넌트 동작과 C++가 수행하는 engine 연산을 구별해 기록한다. 다음 분류를 현재 작업 문서에 남기고 원래 계약을 통과한 범위만 W9-06-B 연결의 근거로 사용한다.

| 실행 분류                              | 판정 조건                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript와 공통 engine으로 보존 가능 | 원래 TypeScript Widget/State·정책은 유지하고 필요한 표준 C++ node/연산으로 연결. 원래 호출 의미와 App/Content 지연 중 준비 scene 진행·실패 rollback을 확인                                                                                                                                                             |
| 명시 경계가 필요                       | Native extension 또는 App 경계의 등록/실행·geometry·수명·관측 한계를 명시. Extension은 engine 연산의 확장이며 디자인 Widget/State/theme를 C++로 이전하는 우회로 사용하지 않음. 임의 JS subclass 함수를 자동 native 변환하거나 독립 Content에서 호출할 수 있다고 가정하지 않음. 원래 consumer를 바꿔야 하면 호환 미완료 |
| 보존 방식 미해결                       | 해당 의무와 의존 기능을 미완료로 유지. 실패를 적었다는 이유로 호환 PASS나 W9-06 전체 완료로 올리지 않음. 독립된 host/기능 작업은 가능하되 전체 API·제품 전환 gate는 계속 FAIL                                                                                                                                          |

최소 사례는 State/GlobalKey reparent·BuildContext 조회, scroll/editing의 즉시 읽기·쓰기/취소·재진입, custom intrinsic/layout/paint/hit-test다. Setter 호출 직후의 값·listener와 다음 publication의 값을 따로 검사하고, App 소유 animation callback과 Core motion을 구별한다. 모든 JS animation/custom hook의 App 독립 진행을 약속하지 않는다.

### 8.2 디자인 패키지의 TypeScript 구현 유지

**Theme와 컴포넌트의 동작을 정하는 코드는 TypeScript에 남긴다.** Engine 연결은 원래 클래스의 build/State/controller·사용자 확장 지점에서 공통 node/연산·paint 설정을 생성하는 방식으로 진행한다. C++의 컴포넌트 사본이나 adapter의 간소화된 대체 Widget로 원래 구현을 우회하지 않는다.

| 기능                            | TypeScript 디자인/framework가 결정                                                                       | C++ engine이 수행                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Theme·스타일·구성               | ThemeData/Inherited 조회, default·상태별 색/shape/typography·intrinsic 설정·자식 구성                    | 전달된 제약/스타일/자원으로 최종 크기·좌표·paragraph/paint 계산                                                         |
| Control·입력                    | Controlled value, enabled·tristate·선택/drag commit·divisions·validation 정책, onChanged와 callback 순서 | 게시 geometry의 hit-test·gesture 인식·capture·key/focus/semantic action 전달. 이벤트/terminal을 세대가 있는 값으로 복사 |
| Animation·전환                  | AnimationController/Ticker·curve/duration 선택·컴포넌트 상태 전환과 listener                             | 선언한 motion 연산·host clock·준비 scene의 합성/게시. Material/Cupertino의 전환 정책을 engine에 다시 구현하지 않음      |
| Painter·graphics                | 원래 TypeScript painter/shape의 스타일·명령·지원되는 metadata 구성과 자원 선택                           | 공통 path/shape/clip/shadow·text/image 처리, 실제 box 기준 geometry·검증·기록/raster·수명                               |
| Form·route·overlay·localization | 검증·navigation/modal 정책·Widget 구성·문구/방향 선택과 App callback                                     | 필요한 layer/clip/transform·focus/입력 차단·semantics/게시와 OS 서비스 연산                                             |

예를 들어 Material Switch·CupertinoSwitch의 theme, thumb 스타일, controlled value·drag commit 정책과 callback은 원래 TypeScript 구현이 결정한다. C++는 전달받은 크기/진행값의 track/thumb 배치·hit-test·그리기를 수행한다. Slider도 divisions·allowed interaction·onChangeStart/onChanged/onChangeEnd는 TypeScript에 두고 engine의 geometry·gesture 결과를 연결한다. C++가 별도 선택 값을 확정해 원래 callback과 이중 변경을 만들지 않게 한다.

TypeScript에서 스타일/명령을 구성하고 원래 State/controller를 실행하는 일은 정상적인 디자인 패키지 실행이며 TS renderer fallback으로 세지 않는다. 최종 layout/hit-test/raster를 별도 TS 엔진으로 우회하는 경로는 기존 fallback 정책을 적용한다. 원래 custom painter나 동기 subclass hook의 계약을 아직 연결하지 못했다면 W9-06의 미완료로 남기고, 전체 디자인 코드를 C++로 옮겨 해결하지 않는다.

W9-08/13에서는 실제 설치 import가 원래 TypeScript 클래스·State를 실행하는지, theme/사용자 callback·controller 재진입·controlled update 거부/NACK·dispose 순서를 검사한다. 기존 capability 안의 theme/상태별 스타일 변경은 TypeScript 패키지/adapter 공급으로 반영되고 C++의 디자인 기본값 수정이나 native 재컴파일을 요구하지 않아야 한다. 새 engine 연산/ABI가 필요한 변경은 그 이유와 공통 책임을 별도로 확인한다. C++ 실제 작업과 SDK 집계, TypeScript 원래 동작의 보존을 함께 검증해야 완료다.

## 9. 렌더링 표현력·재사용·frame 일정

[2a의 Flutter 소스 비교](history/26/11/05/work8-2a-summary.md#flutter-엔진-c-비교)를 아래 독립 작업으로 이월한다. 비교 reference는 저장소의 snapshot이며 최신 Flutter 버전이나 동일 기능/성능을 보장하는 기준은 아니다.

아래 공통 corpus의 **1차 provider는 Windows native와 Web 두 profile**이다. GTK/Metal·모바일 provider의 같은 의무는 후속 host 단계에 연결하며 1차 완료를 막는 별도 port 작업으로 앞당기지 않는다.

이 절은 C++ 엔진/provider의 표현력을 확장한다. 디자인 패키지는 TypeScript에서 그 연산과 자원을 구성하며, Canvas/Paint 지원 확대를 Material/Cupertino Widget·theme·전환 구현의 C++ 이전으로 확대하지 않는다.

| 축                 | 남은 구현                                                                                                                        | 완료 증거                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canvas/Paint       | Gradient/shader·blend/color/image/backdrop filter·stroke cap/join/miter·saveLayer·필요한 perspective와 공통 graphics protocol    | Core 검증과 각 native provider/Web 두 profile의 paint pixel·clip/hit/semantics 일치, 잘못된 자원/좌표의 원자 실패·회수                                             |
| Rich paragraph     | Style span·run별 font weight/features/variations/locale·maxLines/ellipsis/strut·inline placeholder·동적 font/fallback revision   | 한글/surrogate/결합/RTL/emoji·rich text/caret/selection/line·WidgetSpan corpus. Native와 공식 CanvasKit의 지원 차이를 capability로 공개                            |
| 준비 결과 재사용   | Preparation 사이의 Picture·paragraph·decoded image 재사용, node/resource/style/font/layout revision별 invalidation·cancel/retire | 텍스트/이미지 많은 scene의 작은 변경에서 변경 없는 node의 재기록·shaping/layout·decode 수 감소. 기존 publication·geometry와 pixel 보존, 실패/close 회수            |
| Frame clock        | Windows display timing·GTK GdkFrameClock·AppKit display link·Web rAF를 사용하는 start/target/deadline·input wake·idle 정책       | 같은 조건의 실제 build/content/raster/submit 시간과 frame 수요/credit. 고주사율·모니터 이동·resize·App/Content 지연·숨김/복귀. Timer callback 수를 FPS로 쓰지 않음 |
| Cache·damage       | 위 재사용/clock 결과 후 raster cache admission/eviction·damage/부분 재그리기                                                     | Backend가 보존을 보장하는 surface에서 전체 재그리기와 pixel 비교. Clip/opacity/filter·buffer 교체·resize/device loss 무효화. 미지원 surface의 전체 재그리기 유지   |
| 이미지·외부 콘텐츠 | Animated codec frame/duration/loop·texture registration/update·platform view geometry/clip/opacity/paint order/input             | Frame producer/consumer fence·취소·재등록·late callback·숨김/close·native input/접근성의 실제 host 경로. 영상/카메라/plugin은 해당 공급까지 따로 확인              |
| Pressure·예산      | OS memory pressure를 Content/Render cache 축소·필요 자원 재준비로 연결, 신규 cache/texture·GDK/Metal hold 포함                   | Reservation·heap 관측·RSS/VRAM 범위를 구분. 거부/교체/pressure/close 뒤 bounded 상태와 다음 정상 frame 회복. 불투명한 driver peak는 미관측 한계 유지               |

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

모든 host는 [§8.2](#82-디자인-패키지의-typescript-구현-유지)의 같은 TypeScript 디자인 패키지를 실행한다. OS 입력 carrier·접근성 peer·명시적 platform view는 host/서비스 경계에 두며, 기본 Material/Cupertino 컴포넌트를 플랫폼별 C++/Kotlin/Objective-C++ Widget로 다시 만드는 작업으로 확장하지 않는다.

앞선 소스 검토의 비교 기준은 로컬 설치 **`react-native@0.83.10`**, **`react-native-web@0.21.3`**와 당시 저장소 소스다. 이 버전은 소스 비교의 기준이며 Android/iOS의 기존 runner나 Hermes/JSI 공급을 자동 갱신하는 결정이 아니다. 모바일 소스를 실제 도입할 때 해당 target의 W9-12-B/M0에서 원본 tag/commit·파일 hash·의존성과 runtime/ABI를 다시 확인해 고정한다. Android 도입은 2차, iOS 도입은 3차이며 양쪽 공급을 한 번에 준비하지 않는다. Web helper를 먼저 도입하면 해당 helper의 출처만 그 작업에서 고정한다.

| 검토한 소스                                                                                                                                                                                               | 확인한 재사용 범위와 의존성                                                                                                                  | 채택 방법                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Nelyx InputConnection](Nelyx/sdk/native/android/NelyxInputConnectionView.kt)·[keyboard host](Nelyx/sdk/native/android/NelyxKeyboardHost.kt)                                                              | BaseInputConnection·조합/selection·batch edit·CursorAnchorInfo·focus/close 처리가 있으나 `ThemedReactContext`, RN map/event/manager에 연결됨 | **Android의 첫 출발점**. OS 처리와 RN 전달 계층을 분리하고 native 값 타입·JNI/engine port로 교체                                                    |
| [Nelyx Android semantics](Nelyx/sdk/native/android/NelyxSemanticsView.kt)·[OS services](Nelyx/sdk/native/android/NelyxPlatformServices.kt)                                                                | Native accessibility/action·Activity 서비스의 일부 구현. ReactViewGroup/ViewManager·ReactApplicationContext 소유권과 섞여 있음               | OS 로직과 사례를 재사용하고 v2의 view/semantic handle·Activity 수명으로 재결합                                                                      |
| [RN Android 입력 wrapper](https://github.com/react/react-native/blob/v0.83.10/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/views/textinput/ReactEditTextInputConnectionWrapper.kt) | `ReactEditText`·EventDispatcher에 결합된 soft-keyboard `onKeyPress` 처리. 조합 전후 커서로 key를 추정하고 batch에서 한 key를 선택            | IME별 경계 처리·사례를 선별. **추정 key를 편집 명령의 원본으로 쓰지 않음**                                                                          |
| [RN iOS delegate adapter](https://github.com/react/react-native/blob/v0.83.10/packages/react-native/Libraries/Text/TextInput/RCTBackedTextInputDelegateAdapter.mm)                                        | UITextField/UITextView의 선택·자동수정·delegate 이벤트 순서 처리. `RCTBackedTextInputViewProtocol`과 native text control에 의존              | 공통화 가능한 OS handler와 회귀 사례를 이식. Core paragraph geometry를 쓰는 custom UITextInput에 그대로 연결된다고 가정하지 않음                    |
| [Nelyx Apple OS service](Nelyx/sdk/native/apple/NelyxPlatformServices.m)·[기존 RN 입력 peer](Nelyx/sdk/src/backends/react-native/interaction-controls.tsx)                                                | Locale/navigation은 RCTBridgeModule·RCTKeyWindow를 사용. 입력 peer는 React/RN control을 생성                                                 | 서비스 기능은 중립 callback으로 이식. RN peer나 Apple shutdown marker의 존재를 v2 UIKit 입력 host 완료로 세지 않음                                  |
| [현재 Web 입력/ARIA](Nelyx/sdk/src/runtime/engine-v2-interaction.ts)·RN Web TextInput/createElement                                                                                                       | V2는 Main의 DOM carrier를 직접 관리. 설치 RN Web 소스는 React hook·React element·DOM props 생성과 연결됨                                     | 기존 v2를 유지하고 실제 필요한 DOM 호환 helper/사례만 추출. [RN Web의 React DOM 기반 구조](https://necolas.github.io/react-native-web/docs/)와 구별 |

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

| 책임                     | 고정할 계약                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C++ document와 UI mirror | Core가 승인된 text/selection/composing·undo의 권위 상태다. UI mirror는 OS의 동기 입력 호출에 대응하는 버전 있는 버퍼이며 별도 앱 편집 모델을 만들지 않는다. 연산 ID·base revision·focus/connection 세대, pending 상한과 ACK/NACK 후 재동기화를 정의           |
| 입력과 echo              | Commit/setComposing/selection/delete/batch 등 **실제 OS 연산 또는 결과 값**을 정규화한다. RN의 추정 `onKeyPress`나 App callback의 재전송으로 동일 입력을 두 번 적용하지 않는다. 동일 값 echo로 native composing/marked range를 끊지 않음                      |
| Geometry                 | 후보창·caret/range·hit-test·접근성 bounds는 대응하는 **게시 paragraph/publication**에서 제공. 최신 비시각 값에 해당 geometry가 없으면 unavailable로 처리하며 UI에서 text를 다시 shaping하거나 App 응답을 동기 대기하지 않음                                   |
| 스레드·전송              | UI 객체·IME delegate·accessibility는 OS UI owner, JNI/Objective-C++의 packet admission·해제는 명시 소유자, layout/준비/GPU는 기존 owner에 둔다. Callback은 owned immutable 값을 복사하고 RN map·JSI object·native view 포인터를 wire/worker에 보관하지 않음   |
| Focus·종료               | OS focus와 Core focus session을 연결하고 이전 InputConnection/delegate·reload 결과를 generation으로 거부. Commit/cancel은 OS 종료 확인과 최신 revision을 거친다. Close 뒤 예약 callback·keyboard observer·scene/view·surface hold를 회수하고 복합 오류를 보존 |

OS 동기 API에 반환할 값, Core 승인 전 mirror 변경의 허용 범위, 거부 시 조합을 보존하며 복구하는 방법을 정의한다. 1차에는 Windows/Web의 W9-01/07/12-A에 적용한다. 모바일 W9-12-B/M1은 2차 Android의 DTO/JNI부터 수행하고, 3차 iOS에서 UITextInput adapter로 확장한다. 단순 queue 전달만으로 입력 호환을 완료 처리하지 않는다.

### 11.3 Web — 기존 DOM·Worker host 유지

Web은 두 engine 빌드와 하나의 고정 owned `m153-nelyx-paragraph.2 / API 1` CanvasKit 공급을 유지한다. npm 의존성은 타입 선언에 사용하며 선택된 runtime의 manifest·hash·실제 API가 다르면 시작을 거부한다. 실제 page/worker capability를 한 번 확인해 session profile을 고정한다. **COOP/COEP가 없으면 `auto → single-worker`로 화면·입력·정상 종료가 동작해야 한다.** 명시 threaded 요구·Worker/CSP/OffscreenCanvas/WebGL2 부족·공급/ABI/hash/초기화 오류는 원인별 시작 실패다. [기존 배포 검증표](history/26/11/04/work8-3-summary.md#164-web-비격리-배포와-profile-검증표)

**W9-02-B는 Windows App SDK 연결과 같은 차수의 필수 단계**다. 동일한 작은 일반 앱을 Windows와 두 Web profile에서 실행하고 C++ 작업·게시·편집·resize·hide/restore·close를 대조한다. 초기 실제 browser 대상은 Windows Chrome·Edge이며 제품 browser/version·GPU·devicePixelRatio·worker capability를 기록한다. Headless Chromium의 성공을 이 두 실제 browser의 물리 입력·GPU 성능 결과로 대신하지 않는다.

| Web 실행 조건                         | 1차 완료 조건                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 비격리 `/plain/`, `auto`              | 공유 메모리 없이 single-worker 선택, 같은 기능 corpus·입력 보존·유한 Content 점유 후 회복·정상 종료                                     |
| 격리 `/isolated/`, `auto`             | 실제 page/worker probe로 threaded 선택, App/Content 지연 중 준비 scene 진행·정상 종료                                                   |
| 격리 `/isolated/`, 강제 single-worker | 격리 여부와 무관하게 non-shared engine build·하나의 engine worker를 실제 선택. 같은 기능/close corpus와 `contentIndependent=false` 확인 |
| 강제 요구·손상 공급                   | 비격리의 강제 threaded, capability 부족·잘못된 worker URL·ABI/hash/초기화 실패를 명확히 거부. 다른 renderer로 숨기지 않음               |
| DOM·surface 수명                      | Main의 focus/clipboard/ARIA·게시 geometry, canvas 크기/DPR revision·숨김/복귀·context loss 정책·재생성/close에서 late event 차단        |

헤더 이름만으로 격리를 판정하지 않고 실제 `crossOriginIsolated`·worker·전송/초기화를 확인한다. 격리와 공유 메모리의 브라우저 계약은 [crossOriginIsolated 문서](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated), canvas의 worker 소유권은 [OffscreenCanvas 문서](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)를 대조한다. 정확한 지원 범위는 실행한 browser에 한정한다.

RN Web은 필요한 focus·composition·selection·keyboard·ARIA/브라우저 차이의 helper와 사례를 고르는 참고 기반이다. 현재 `dom-textarea/aria` carrier·Main의 trusted action·C++ 게시 geometry를 유지하고 React DOM component tree·CSS layout·RN ScrollView/Responder를 v2 canvas의 필수 경로로 도입하지 않는다.

각 helper는 해결할 실제 browser 사례·원본 경로/버전·필요 의존성·Nelyx에서 바꾼 의미를 먼저 적는다. 독립성이 없거나 현재 구현으로 처리하는 helper는 가져오지 않는다. 도입 시 두 Web profile에서 비교하고, Worker 내부 DOM 조작·새 renderer fallback·매 frame React commit이 생기지 않는지 확인한다.

Web의 신규 session은 profile probe를 다시 할 수 있지만 실행 중인 session의 worker/heap/profile은 바꾸지 않는다. Surface 재생성으로 canvas owner를 다시 만들 때는 **새 HTML canvas와 새 OffscreenCanvas**를 준비한다. 이미 이전한 canvas에 `transferControlToOffscreen()`을 다시 호출할 수 있다고 가정하지 않으며, 이전 DOM carrier·listener·worker·CanvasKit/GPU 자원의 종료와 새 세대를 연결한다. [HTML canvas 이전 계약](https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-transfercontroltooffscreen)

App·engine·CanvasKit JS/Wasm·font/image URL은 같은 bundle identity로 확인한다. Plain/isolated 배포와 하위 base URL에서 MIME·CSP/worker/Wasm 허용·cross-origin 자원 정책·HTTPS 또는 신뢰된 localhost 조건을 검사한다. 오래된 cache/혼합 자원·손상 파일은 명시적 공급 실패로 처리하며, 외부 image/clipboard 권한 거부·취소도 해당 API의 동작과 자원 회수에 포함한다.

플랫폼별 구현은 **[4부의 Android §11.4](work9-4.md#114-android--기존-nelyx-os-코드를-먼저-분리)**와 **[후속 5부의 iOS §11.5](work9-5.md#115-ios--uikit-입력-endpoint와-rn-예외-처리-이식)**로 분리했다. 공통 입력 계약·Web helper·도입 gate와 검증 corpus는 이 부에 유지한다.

### 11.6 도입 순서와 의존성 gate

M0–M4는 재사용 범위의 식별자다. **1차 Web의 M3는 모바일 M0–M2 완료를 기다리지 않는다.** 모바일 추출·통합은 2차 Android → 3차 iOS 순서로 해당 target의 W9-12-B와 W9-13에서 수행한다. Android의 M0–M2/M4 완료에 iOS 구현·Apple 공급을 요구하지 않는다.

| 항목                       | 연결 단계·차수                                        | 완료 조건                                                                                                                                                                                                                                            |
| -------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — 원본·범위 고정        | W9-12-B / Android 2차·iOS 3차                         | Nelyx 우선 재사용·RN 도입·참고만 할 파일을 구별. 원본 tag/commit·파일 hash·변경 이유·필수 의존성·license/notice를 고정. 로컬 node_modules 전체를 제품 source로 복제하지 않음                                                                         |
| M1 — 중립 계약·helper 추출 | W9-12-B / Android 2차·iOS 3차, W9-01의 공통 계약 사용 | Native DTO/packet·mirror/ACK·focus/connection/reload generation·UI thread·callback/close 계약. 새 standalone adapter는 RN 앱 객체 없이 compile/link 가능하고 기존 v1 wrapper의 기능도 유지                                                           |
| M2 — 모바일 수직 실행      | W9-12-B / Android 2차·iOS 3차                         | 해당 차수의 Android 또는 iOS **각각**의 일반 앱에서 scene·OS 입력/편집·semantics·surface 재생성·close/drain. SDK 요청과 실제 C++ 작업 대조. RN 부재를 runtime 시작/입력 실패로 숨기지 않음                                                           |
| M3 — Web helper 선별       | W9-07/12-A / 1차·필요한 경우                          | 재현된 browser 차이와 필요한 helper만 반영. 출처·의존성, Main의 DOM 소유권·trusted activation·두 profile·geometry·회수 유지. 도입할 helper가 없으면 기존 host 유지로 기록                                                                            |
| M4 — 공급·통합             | W9-13 / 대상별                                        | 1차는 Windows/Web 및 도입한 RNW/Web helper, 2차는 Android, 3차는 iOS의 dependency/link graph·설치본·앱 entry를 각각 확인. 같은 TypeScript 디자인 구현/자산과 공통 engine 공급의 경계, runtime identity·host/IME/semantics corpus·손상 거부·종료 통과 |

V2 standalone target의 실제 Gradle/CMake·Pod/Xcode link·bundle dependency graph에서 ReactHost/ReactContext·ViewManager/UIManager·Fabric/Yoga·RCTBridgeModule/TurboModule·React DOM renderer 의존성을 검사한다. 소스 이름에서 `React`를 지운 것만으로 분리 성공으로 세지 않는다. 기존 v1 runner나 workspace의 RN 의존성은 이 gate와 구별한다.

Hermes/JSI는 별도로 고정한 VM/ABI 공급으로 사용할 수 있다. 이를 RN 앱 runtime 도입으로 혼동하지 않으며, JSI object를 UI/worker 경계로 넘기지 않는다. RN source를 일부 가져온 것만으로 RN ViewManager/TurboModule 기반 외부 패키지가 자동 호환되지는 않는다. 필요한 plugin/API는 명시 adapter·capability·수명·실제 설치 사례로 연결하고 기존 SDK 공개 API 호환 gate도 계속 적용한다.

### 11.7 공통 입력·수명 검증 corpus

1차에는 Windows TSF/UIA와 Web DOM/ARIA에 해당하는 사례를 적용한다. InputConnection·Android surface 사례는 2차 W9-12-B(Android), UITextInput·iOS scene 사례는 3차 W9-12-B(iOS)에서 실행하며 플랫폼별 비적용 사유와 미검증을 구별한다.

| 범위              | 필수 확인                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 편집 단위·중복    | 한글 조합·자동수정·selection replacement·다중 문자 commit·UTF-16 surrogate/결합/emoji·code-point 삭제. 실제 연산 1회에 Core 변경 1회, 추정 key/echo로 중복되지 않음                                                             |
| 동기 API·mirror   | OS 호출 직후 질의·nested batch·ACK 지연/거부·같은 값 echo·연산 순서. Core revision과 UI mirror의 관측 범위·pending 상한 및 조합 보존 복구                                                                                       |
| Focus·조합        | Commit/cancel·App programmatic edit·focus 이동·새 InputConnection/marked range·timeout·keyboard show/hide·background. 이전 session/connection의 late callback 거부                                                              |
| Geometry·접근성   | Scroll/scale/resize 중 후보창·caret/range·hit와 게시 ID 일치. 새 text/이전 paragraph의 범위 거부, Windows UIA/Web ARIA와 후속 Android accessibility/iOS VoiceOver의 값·focus/action·중복 노출 확인                              |
| Core 독립 진행    | Native/Web threaded는 App/Content 지연 중 준비 scene 입력·합성. Web single-worker는 App 독립·유한 Content 점유 후 회복. UI input admission·bounded pending을 유지하고 keyboard·delegate 때문에 매 frame App ACK를 요구하지 않음 |
| Surface·세대 수명 | Detach/attach·Android surface 재생성·iOS scene 전환·reload·device loss·close 중 교체. Observer/task/delegate·JNI/native ref·GPU hold·pending 요청 회수와 복합 오류 보존                                                         |
| Web profile       | Plain/isolated 두 profile의 같은 편집·focus·ARIA corpus, 실제 trusted clipboard/권한 거부·composition 종료 교섭. DOM carrier/Worker 종료 뒤 late event 차단                                                                     |

각 검사는 OS/ABI·device 또는 simulator/emulator·IME/browser·입력 source·공급 identity를 명시한다. 위 항목은 **앞으로 통과해야 할 조건**이며 소스 검토·모의 callback·synthetic key 성공을 물리 IME/reader·scanout·성능 수락으로 올리지 않는다.

## 현재 API·입력 구현 — 2026-11-07 KST

**패키지 AssetBundle 경로를 연결했다.** [PlatformAssetBundle/rootBundle](Nelyx/src/services/asset-bundle.ts)은 data/Original SDK의 공통 App 소유자를 쓴다. [DefaultAssetBundle.of](Nelyx/src/framework/widgets/default-asset-bundle.ts)는 ImageService 없이 root를 선택하며 상위 bundle override를 보존한다. Structured miss는 문자열 캐시를 거치지 않아 parser 실패 뒤 실제 bytes를 다시 읽고, cache hit identity·evict/clear·늦은 이전 App 결과 격리를 유지한다.

**App service 12·IO/credit:** Native의 크기 확인→admit→C++ 파일 읽기/JSI copy, Web의 HEAD/index→admit→bounded stream/hash를 연결했다. 일반 HTTP의 HEAD·전용 hash header 없는 경로도 검증했다. IO 대기 **32개**, admit buffer **64개**, 누적 data **32 MiB**, 입력당 **3 × size + 65536 bytes**를 기존 App quota 안에서 제한한다. 전달한 caller ByteData는 실제 realm 종료까지 credit을 유지한다. 내부 index credit은 논리적 close 때 회수한다. 새 IO 거부·실행/시작 중 read 취소·미전달 credit 반환·종류/foreign/중복 token·실패한 반환의 quarantine을 검증했다.

**서비스 준비·종료:** Web App bootstrap 계약 **1**을 요구하고 quota 응답·서비스 모듈·CanvasKit/폰트 다운로드까지 취소를 전달한다. 실패한 provider 요청의 나머지도 중단·정리한 뒤 staging credit을 반환한다. 중단할 수 없는 Wasm 초기화는 완료를 기다려 늦은 backend 전달을 차단하며, 확정 heap과 App **320 MiB** host 예약은 실제 worker 종료까지 유지한다. 두 모델·두 profile의 시작 단계 **28조건**, 정리 순서·heap credit 단위 **2개**를 통과했다. 이는 렌더 수요가 없는 lifecycle control이며 Native C++ 구현·성능 승인이 아니다.

[실제 Native](Nelyx/engine/tests/app-assets-probe.mjs)의 **7읽기·52 bytes = SDK**, 논리적 close 뒤 buffer **7개/458908 bytes**, 실제 runtime 종료 뒤 ledger **0**을 확인했다. 일반 SDK의 Original/data 두 profile은 각각 **65/17명령 = SDK**, asset **9회/113450 bytes·8회/810 bytes**다. 원래 structured/default/manifest 정책, UTF-8/공백·Nx, 변조/초과 응답·파일/폴더 충돌 거부, 시작 중 취소까지 **4개 일반 case + 2개 startup control**을 통과했다. Close 뒤 실제 worker 종료·예약 **0**이며 App paragraph 수요 0인 asset control을 shaping 성능 증거로 쓰지 않는다.

**NetworkAssetBundle·HTTP 소유권:** [Canonical API](Nelyx/src/services/asset-bundle.ts)를 [공통 App transport](Nelyx/sdk/src/runtime/engine-v2-network.ts)에 연결했다. Base URL 문자열에 상대 key·query·fragment·절대 HTTP(S) key를 해석하고 HTTP 200만 성공시킨다. Bundle 자체 cache는 두지 않는다. [Native 비동기 WinHTTP](Nelyx/engine/platform/windows/app_http.hpp)와 Web fetch stream은 HTTP 전에 metadata/callback 복사용 **512 KiB**를 확보한다. 공통 IO 대기 **32개**, data **32 MiB**와 App quota를 유지하며 길이 미상·압축 응답은 할당 전에 **3 × capacity + 65536 bytes**를 늘리고 실제 길이로 줄인다. Native는 가용 bytes를 확인한 뒤 최대 **64 KiB**를 읽고 마지막 HANDLE_CLOSING callback·빌린 JSI 복사 뒤에 요청 credit을 반환한다. 비동기 transport 해제 실패는 staging을 quarantine하며 정상 drain으로 바꾸지 않는다. OS/browser 내부 network buffering은 소유 ledger의 측정 대상이 아니다.

**ImmutableBuffer·실제 소유권:** [Canonical API](Nelyx/src/ui/immutable-buffer.ts)와 `AssetBundle.loadBuffer()`를 연결했다. Native는 C++ SkData, Web은 CanvasKit 할당과 SDK byte upload/readback 복사를 사용한다. 입력 view는 Promise 반환 전 캡처하며 `fromAsset`·Native UTF-8 `fromFilePath`·길이·dispose를 제공한다. Public handle을 해제해도 engine holder와 진행 중인 읽기의 backing/credit은 마지막 참조까지 유지한다. 할당당 **2 × size + 65536 bytes**, live handle/할당 **64개**·data **32 MiB**·IO 대기 **32개**, 내부 chunk **256 KiB**를 제한한다. 불확정 해제·foreign/종류/중복·살아 있는 reader는 정상 drain으로 바꾸지 않는다. Buffer 전용 IO staging은 반환하며 caller ByteData의 realm credit과 구별한다.

**Font·Source 수명:** Source FontLoader의 순서/1회·protected hook과 공개 ui.loadFontFromList의 optional family·실제 C++ 해석, App build 전 owner 준비를 유지한다. 현재 catalog의 family/fallback을 추가하고 font load **32개/캡처 16 MiB**를 별도로 제한한다. App 준비·bounded upload·Core begin·owner ACK **7**·App 활성화·watermark commit·Source 관측·finish를 조정한다. 불확정 ACK는 terminal까지 stage/producer를 유지하며 Paragraph·Canvas·desired/ACK 대기 scene의 lease가 이전 cohort를 보호한다. Native Source는 TS PipelineOwner에 attach하지 않는다.

일반 font 앱 두 profile × 9상태는 각각 **167명령 = SDK·Core layout 596·App 19/0 = SDK·Content 조판 21**, decode **64/53**·capture **24**·Source 알림 **12**·TS fallback **0**이다. Asset credit **3631104 bytes**는 actor 종료까지 유지한다. Source fault control은 **227명령 = SDK·Core layout 448·App 16/0 = SDK·Content 조판 22·capture 57·Source 알림 11·pixel 차이 0**이다. 기존 family·recording 보존과 quota/cancel/recover를 유지한다.

**Native 선언 경계:** Data SDK entry의 browser 재수출이 Native에 DOM ambient type을 요구하던 문제를 [선언](Nelyx/sdk/src/runtime/engine-v2-browser.ts)에서 수정했다. 실제 TypeScript **7.0.2**로 두 모델 × 정상/시작 취소 × Windows/Web **8조합**을 strict 검사했다. Native는 ES2022·types=[]·skipLibCheck=false를 유지하고 Web은 정확한 Worker/MessagePort/Canvas/URL 타입을 보존한다. Runtime의 browser capability 요구와 실패 경계는 같다.

**ImageDescriptor/Codec·buffer 소비:** [Canonical descriptor](Nelyx/src/ui/image-descriptor.ts)·[codec 함수](Nelyx/src/ui/image-decoder.ts)를 두 App 모델의 App image service **2**과 기존 ImageService/ResourceRegistry에 연결했다. Native는 보유 SkData·명시적인 SkCodec decoder 목록, Web은 기존 소유 CanvasKit heap을 사용한다. Public buffer → descriptor → Codec → Image/clone/read의 독립 수명과 PNG·GIF frame duration/순서/반복·행 padding·RGBA/BGRA·resize·옵션 getter/target 실패·foreign/종류/quota·빌린 read 중 재진입을 검증했다. [실제 Native/Web](Nelyx/engine/tests/app-images.test.mjs)은 public 범위 각각 **descriptor 6·Codec 6·frame decode 10·pixel read 7회/60 bytes = SDK·TS fallback 0**이며 Native 패키지 파일 **1읽기/71 bytes**와 마지막 runtime 종료 뒤 ledger **0**이다. 일반 SDK 두 모델 × 두 profile도 같은 decode/read 집계·Core **32/17명령 = SDK**·최종 worker 종료/예약 **0**을 확인했다. Public 결과 **7개/credit 458932 bytes**는 caller ByteData를 위해 realm 종료까지 유지하고 descriptor/Codec/Image handle·불변 backing은 **0**이다. 이 검증은 decoder control이다. RawImage/RenderImage 표시는 아래의 Scene 검증으로 구별하며 float raw/target·PNG/straight-alpha readback은 미완료다.

**큰 encoded 이미지의 Scene 자원:** [청크 계약](Nelyx/runtime/engine-client/image-resource.ts)과 WidgetHost를 연결해 여러 이미지의 합계가 커져도 기존 packet **1 MiB**·resource **32 MiB** 안에서 **256 KiB**씩 전달한다. Core는 전체 upload 뒤 불변 backing을 게시하고, SDK는 upload의 첫 await 전 snapshot·동일 token 재전송·불확정 ACK·desired tree 교체·close 수명을 유지한다. Scene은 작은 inline 합계만 담고 나머지는 preparation/frame에 묶인 read로 Content에 전달한다. Producer 해제·같은 slot의 새 generation 뒤에도 이전 frame은 원래 bytes를 읽는다. [Core 수명 검사](Nelyx/engine/tests/image-resource-contracts.mjs)는 Native·두 Wasm **15조건**, [실제 표시 검사](Nelyx/engine/tests/image-resource-render-contracts.mjs)는 **1,229,560 bytes PNG 2장/3상태**를 통과했다. 일반·기존 설치 Web의 두 profile 각각 **33명령 = SDK·C++ layout 19·Content 이미지 기록 2·App geometry/TS fallback 0**, 실제 pixel 교체·worker 종료/예약 **0**이다. 별도 Native Content CPU control은 **측정 2·이미지 2·Picture 2**, producer backing 소멸 뒤에도 이전 Picture 픽셀을 유지하고 owner 종료 뒤 ledger **0**이다. Canonical RawImage/RenderImage는 별도 Scene snapshot 계약으로 연결했으며 Canvas는 미완료다.

**Canonical RawImage/RenderImage·Scene:** [App frame 소유자](Nelyx/sdk/src/runtime/engine-v2-images.ts)와 [Original bridge](Nelyx/runtime/engine-client/original.ts)를 연결했다. 같은 Image/clone은 불변 RGBA snapshot 한 개를 공유하며, 별도 Scene credit을 픽셀 복사 전에 확보한다. Public toByteData quota는 소비하지 않는다. Snapshot은 수락된 이전 트리·불확실한 upload 등 마지막 App 참조까지 유지하며 Core/Content/Picture는 각자의 자원 credit으로 픽셀을 보유한다. [C++ 배치](Nelyx/engine/core/scene/image.hpp)는 크기/scale·7가지 BoxFit·alignment·repeat·RTL 반전·nine-patch·박스 밖 그리기 범위를 계산한다. Native Skia/CanvasKit은 같은 배치에 opacity·tint/blend·색 반전·filter quality를 적용하며 Source render object를 TS layout에 attach하지 않는다. [Core 검사](Nelyx/engine/tests/image-style-contracts.mjs) **6조건**과 [Original 수명](Nelyx/engine/tests/original-image-contracts.mjs) **9조건**은 세 경로의 fit·타일 초과·오류 복구·known NACK 연속 교체·chunk ACK 유실 뒤 교체/close를 확인했다. [실제 일반/설치 SDK](Nelyx/engine/tests/raw-image-render-contracts.mjs)의 두 Web profile은 각각 **574명령 = SDK·C++ layout 376·이미지 배치 148·Content 이미지 기록 24·App geometry/TS fallback 0**이다. 12개 RawImage 배치의 프레임 2개/opacity 변경·호출자 Image/clone/codec 해제 뒤 픽셀·교체/제거를 확인했다. Snapshot **2개/524288 pixel bytes**, public readback **0**, 제거 뒤 frame/Scene credit **0**·최종 worker 종료/예약 **0**이다. Native CPU는 별도 **Raw 스타일 8개**와 마지막 Picture까지의 원본 backing 보유·최종 ledger **0**이다. 실제 Native/Web App control은 캡처 실패 credit 반환·동일 clone 공유·foreign registry/틀린 크기 거부·Source frame보다 긴 Scene 수명도 통과했다. Stream visibility·유한 반복 종료/복구·Canvas와 추가 형식 및 물리/성능 승인은 미완료다.

**ImageProvider·캐시·Core 시계:** [App decoder/IO](Nelyx/sdk/src/runtime/engine-v2-images.ts)를 Source ImageService·ImageProvider/ImageCache·Original Image Widget에 연결했다. Memory·Asset·Resize·Network와 Native FileImage가 같은 immutable buffer/descriptor 소유자를 사용하며 provider byte 캡처도 복사 전에 credit을 확보한다. [Core 시계](Nelyx/runtime/engine-client/app-image-clock.ts)는 실제 Core timestamp와 절대 deadline을 사용하고 frame/timer callback을 각각 **64개**로 제한한다. 새 state는 **744 bytes**, deadline 요청은 f64 초 단위이며 취소·동일 deadline ACK 재시도·숨김/복원은 [Native·두 Wasm 6조건](Nelyx/engine/tests/image-clock-contracts.mjs)으로 확인했다. [일반/기존 설치 Web](Nelyx/engine/tests/image-provider-render-contracts.mjs)은 두 profile 각각 **334명령 = SDK·C++ layout/image paint >0·Content 이미지 7·App geometry/TS fallback 0**이다. 실제 Memory/Asset/Network/resize 픽셀·동일 key 캐시의 동기 clone 공유·GIF 전환/TickerMode 정지·재개·404/손상 bytes 오류 대체·cache eviction·pending HTTP 중 close와 최종 worker 종료/예약 **0**을 확인했다. PNG **131155 bytes**의 중간 **65536 bytes** 진행률도 관찰했다. 제거 뒤 descriptor/Codec/frame/Scene credit은 **0**, public readback은 사용하지 않는다. [Native Hermes control](Nelyx/engine/tests/image-provider-native-contracts.mjs)은 **descriptor 8·Codec 7·decode 9·pixel read 6/48 bytes = SDK·TS fallback 0**, 실제 파일 **1읽기/71 bytes**·HTTP 요청 **7회**·최종 ledger **0**이다. Native의 이 control은 수동 App 시계이며 실제 Core deadline/일반 Web 표시와 구별한다. Native HTTP는 빈 key의 정확한 URL/query를 유지하고 같은 origin의 Authorization/Cookie는 보존하며 교차 origin에서는 제거한다. 기본 Original App은 사용자 build 전에 HTTP header service **2**를 요구하며 오래된 공급의 두 profile 시작 거부도 확인했다. Caller ByteData/readback credit은 realm까지 유지한다. Stream visibility·유한 반복 종료/복구·Canvas와 추가 형식 및 물리/성능 승인은 남는다.

Core **419/419**, 통합 **53/53**, Source·수명·편집기·캐시·Frame **108/108**, geometry **2/2·7/7**, 도구/API/supply **32/32**을 통과했다. Mixed **12 editor**·activation failure 회귀를 유지한다. WidgetSpan의 두 profile × 6상태·동일 TextPainter control pixels와 rich/layer/live paint/Material 회귀를 통과했다.

현재 공급은 **`175c55c60f565577f202650a44b127f67866e214b1ac24e736617e6996005114` / ABI 2·schema 2844160510 / App service 12·image service 2·HTTP header service 2 / manifest 349파일**이다. 원래 **4 package/834 subpath·hash 16개**를 보존한 전체 API는 **inputValid=true / compatible=false**다. 현재 **847/4629 occurrence**, Windows **813/34·4499/130**, Web **799/48·4442/187**, compiler **7.0.2**·직접 해석 trace·target 오류 **0**을 확인했다. `loadBuffer` 추가 두 건은 원래 클래스의 모든 멤버를 고정 선언으로 대조한 뒤에도 **signatureChanged / structuralCompatibility=notApproved**로 남긴다. 원래 hash/분모를 바꾸지 않으며 기존 멤버 수정·삭제는 여전히 입력 실패다. 현재 동작 검사가 기존 구조적 타입 호환성을 승인하지 않는다.

기존 Windows/Web 설치본에서 각 Windows/Web target **847개** strict 입력·실제 compiler **7.0.2**·Root/PlatformAssetBundle·NetworkAssetBundle·ImmutableBuffer·ImageDescriptor/Codec·FontLoader/UI·App service **12** 타입·README FontLoader/assetByteLength/remoteAssetByteLength/firstImagePixels 예제·CLI build/verify를 통과했다. Core **687 module/2748 dist 파일**, SDK **123/492**, Material **259/1036**, Cupertino **64/256**, SDK native **63**·CLI **75**·Metro **34**·owned Web runtime **6**·Core/SDK EN/KO README의 exact set/hash/source-map 입력이 일치한다. 설치 Web 두 profile은 각각 **1067명령 = SDK·App 8/0 = SDK·Content 조판 17**, asset **4읽기/337923 bytes·credit 1275913 bytes**, buffer **13캡처/113208 bytes = SDK·asset buffer 읽기 2회/112643 bytes·최종 handle/credit 0**, network raw/buffer 각각 **1읽기/3 bytes·network credit 0**, font credit/queue **0**·실제 close 예약 **0/worker 종료**다. 세 기존 runner의 일반 check도 통과했다. Native 창/물리 검증과 구별한다.

**다음:** 이미지 stream visibility/복구·Canvas 연결·기존 구조적 타입 호환성·OS font 알림과 추가 text/선택·Canvas/Picture/custom hook·동기 geometry·전체 keyboard/IME/reader·semantics/cursor/service·가변 list·콘텐츠/복구를 진행한다. TypeScript 7.0.2 검사와 Microsoft 6 변환 API, CanvasKit **128/256 MiB**·App **320 MiB**·ledger **768 MiB/GPU 128 MiB**를 유지한다. W9-13/14는 미완료이며 Native UIA/물리 Esc 경계를 재개하지 않았다. 두 성능 flag **false**·물리/display/scanout **notVerified**·후속 **DEFERRED**다. [현재 증거와 다음 실행](work9-3.md#현재-구현검증과-잔여-작업)을 따른다.
