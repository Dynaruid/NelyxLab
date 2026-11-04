# Nelyx 엔진 v2 — 공통 C++ 백엔드 설계·구축 계획 — 2부: 렌더링·플랫폼·API 이식

작성·심화 검토: **2026-11-04 KST** · 상태: **DESIGN / 구현 미착수 / 성능·물리 입력 미검증**

[전체 목차](work8.md) · [1부](work8-1.md) · **2부** · [3부](work8-3.md)

원문 범위: **§8–14**. 전체 설계의 절 번호와 W8 단계 식별자를 유지한다.

## 8. C++ render node·레이아웃·텍스트

### 8.1 Native render model

Content Engine에 node arena와 부모/자식 관계, 제약·baseline·intrinsic dependency, dirty queue를 둔다. TS의 Flutter식 개념을 참고하되 기존 TS RenderObject를 C++ 객체와 1:1로 왕복 호출하는 adapter를 만들지 않는다.

- 표준 layout은 C++ Content owner가 자식과 준비된 paragraph metrics를 조회하고 결과를 보유한다. Web의 외부 text provider 결과가 없으면 작업을 보류·재개하며, 임의 Widget/앱 코드에 layout을 돌려주지 않는다.
- Property 변경마다 layout·paint·composite·semantics 중 필요한 invalidation을 선언한다.
- 조상 제약이나 자식 크기에 의존하는 실제 변경 경로를 계산하고 영향 없는 branch를 재방문하지 않는다.
- Flex의 숫자 부분만 호출한 뒤 TS가 각 child를 다시 layout하는 구조를 v2 표준 경로로 사용하지 않는다.
- Intrinsic·baseline·dry layout의 의미와 cycle 방지·실패 원자성을 함께 구현한다. 이 부분을 생략한 제한 demo를 framework 전체 이식으로 세지 않는다.
- Scroll의 transform 변경은 layout dirty와 구별한다. 새 sliver coverage·가변 높이 측정·sticky header 등 콘텐츠 계산이 필요할 때만 Content Engine에 작업을 요청한다.

Derived layout/paint 결과는 작업의 document/metrics·입력 revision에 귀속한다. 준비 중 실패한 일부 metrics/display list를 기존 scene이나 다음 작업의 유효 cache로 게시하지 않는다. 작업 시작 뒤 새로 발생한 dirty revision을 이전 작업의 완료로 지우지 않으며, 실패한 branch는 유효한 이전 결과를 보유하거나 다음 수정에서 다시 준비한다.

### 8.2 Text service

Paragraph 구성·font fallback·shaping·줄바꿈·selection geometry·glyph/paragraph cache는 해당 Content text provider가 관리한다. Native는 SkParagraph를 직접 연결하고, Web은 Content owner의 worker에서 npm CanvasKit 공개 API를 호출하는 host adapter를 사용한다. App TS는 텍스트·style·locale·direction·font 참조를 선언하고 C++ layout은 버전이 있는 provider metrics를 사용한다.

Font 등록·fallback 변경·text scale·DPI·locale 변화는 관련 paragraph와 scene을 무효화한다. Font·text·width·style revision을 cache key에 포함하고, frame 밖에서 결과가 도착해도 이전 scene에 새 metrics를 끼워 넣지 않는다. Async font/image 준비가 실패하면 명시적인 오류·대체 콘텐츠 정책을 적용한다.

Core의 text 모듈은 paragraph provider 계약과 의존 관계를 정의한다. Web은 C++가 요청한 text/style/width/font revision의 bounded batch를 adapter에 넘기고 metrics·selection geometry·준비된 text resource를 돌려받는다. 대기 중 전역 lock을 보유하거나 App Runtime callback을 호출하지 않는다. 결과가 없으면 Content 작업을 재개 가능한 상태로 반환하며, 다른 epoch의 결과를 현재 geometry에 설치하지 않는다.

Mutable paragraph는 Content text provider에 남기고 render 쪽에는 준비된 immutable text paint record와 명시적인 font/resource hold를 전달한다. Web threaded에서는 Content/Render worker에 각각 같은 npm CanvasKit 배포본의 instance를 두고, Content에서 만든 text Picture를 공개 `serialize()`/`MakePicture()`로 넘기는 경로를 W8-02에서 검증한다. Single-worker에서는 같은 CanvasKit instance의 준비된 resource ID를 재사용할 수 있다. 직렬화 결과·font/image·glyph 보존과 실패·메모리 상한은 [§12.2.6](#1226-enginecanvaskit-adapter와-retained-자원)을 따른다. Paint 중 paragraph를 다시 layout하거나 mutable 객체를 worker 간 공유하지 않는다.

현재 [전용 paragraph patch](Nelyx/skia/eng/source-build/canvaskit-paragraph.patch)의 차이는 npm으로 전환하기 전에 다음과 같이 다룬다. **공개 API 존재와 의미 호환은 별개의 검사다.**

| 기존 전용 기능/가정 | npm 원본을 사용하는 v2의 이식 계약 |
| --- | --- |
| `nelyxParagraphApiVersion` 강제 | Nelyx 전용 export를 요구하지 않고 고정 npm 배포본의 공개 메서드·실제 결과를 검사 |
| `nelyxLineNumberAtUTF16` | 공개 `getLineNumberAt` 등으로 구현하되 실제 offset 단위를 corpus로 확인. 기존 UTF-8 변환을 그대로 복사하지 않음. 한국어·surrogate pair·결합 문자·RTL·줄 끝/caret 확인 |
| `unscaledAscent` 추가 field | 공개 metrics로 정확히 계산 가능한 범위를 확인. `ascent`를 복사해 동일 의미라고 표시하지 않고, 지원 불가 의미는 API 이식표에 명시 |
| `renderSoftHyphens` switch | 공개 API 조합·원문/표시문 index mapping으로 `manual/hidden`의 줄바꿈·표시·selection 의미를 재현할 수 있는지 확인. 속성을 전달하고 무시된 것을 지원으로 세지 않음 |

W8-00에서 필수 API와 의도한 차이를 고정하고 W8-02에서 npm 원본으로 실제 확인한다. 동등 구현이 안 되는 필수 기능은 gate를 열어 두고 API/범위를 이유와 함께 다시 설계한다. 이를 해결한다며 CanvasKit fork·자체 재빌드를 다시 전제로 넣지 않는다.

TS가 즉시 읽을 수 있는 geometry는 마지막 완료된 layout 또는 활성화 snapshot과 그 상태·버전을 함께 제공한다. `DocumentAccepted`만 받은 새 epoch의 geometry가 계산됐다고 표시하지 않는다. 현재 layout 완료를 얻으려고 frame 중 JS→native→JS 동기 callback을 만들지 않는다.

### 8.3 사용자 정의 layout·paint

세 가지 확장 경계를 제공한다.

| 확장 | 실행·제약 |
| --- | --- |
| 표준 node 조합·선언형 layout/effect | 일반 engine 경로. 우선 제공하는 확장 방식 |
| Native engine extension | 버전·node schema·thread·수명 계약을 구현한 C++/Wasm 모듈 |
| `AppDrivenBoundary` | TS가 외부에서 계산한 geometry/display list를 transaction으로 공급. 완료 전에는 기존 준비 결과 유지 |

`AppDrivenBoundary` 안의 사용자 코드가 느리면 그 콘텐츠의 갱신은 늦는다. 경계 전체의 이동·clip·opacity는 준비된 결과를 이용해 계속할 수 있다. 기존 임의 RenderObject subclass의 sync layout·paint·hit-test hook을 자동으로 독립 엔진 동작으로 바꾸지는 못한다.

첫 native extension은 정적 등록·schema 고정으로 시작한다. Native와 Wasm에서 같은 기능/수명 계약을 구현하며 동적 DLL/Wasm plugin loader는 필수 범위에 넣지 않는다. `AppDrivenBoundary`도 bounds·intrinsic/baseline 응답 범위·hit-test/semantics 데이터·자원 예산을 선언해야 한다. 엔진이 layout 중 TS에 추가 질의를 해야 하는 콘텐츠는 지원 경계를 제한하고 명시적인 오류를 내며 동기 callback으로 우회하지 않는다.

## 9. Retained scene과 렌더링

### 9.1 Scene에 오래 보유할 것

- Content 좌표의 display list/Picture와 자원 참조.
- Transform·clip·effect·scroll property tree와 의존 관계.
- 가시성·손상 영역·준비된 콘텐츠 범위.
- Hit-test 구조·semantics 내용과 node identity.
- Scene을 만든 document·metrics·font/resource 세대.

Compositor는 App Runtime에 scene의 paint 재생성을 요구하지 않는다. Scroll은 C++ property를 바꾸고, Native renderer는 필요한 가시 항목과 effect pass를 직접 처리한다. Web은 engine이 정한 frame packet을 같은 render worker의 JS adapter가 npm CanvasKit 공개 API로 실행한다. 준비된 Picture/resource를 재사용하고 App Widget build·TS layout·전체 paint 직렬화를 매 frame 반복하지 않는다. Wasm↔JS↔CanvasKit 호출/복사 비용은 Web 경계의 실제 비용으로 측정한다. 작업량은 가시 항목·변경 property·필요한 raster에 따라 증가한다. **C++라는 이유로 합성·hit test·GPU replay가 상수 시간이 된다고 가정하지 않는다.**

### 9.2 표준 motion

Transform·opacity·지원하는 clip·scroll physics·준비된 caret의 표시 여부는 compositor motion graph로 실행한다. 색/단순 material state도 paint record가 해당 property를 간접 참조할 수 있는 종류만 같은 경로를 지원한다. Picture에 값이 구워졌거나 새 mask/raster가 필요한 효과는 Content/Render 준비가 필요하다고 capability에 표시한다. TS는 시작/중단/목표·curve·duration과 event listener를 선언한다.

크기 변화로 재배치가 필요한 animation은 Content Engine의 layout을 사용한다. TS 임의 frame callback은 App Runtime에서 실행하되 다른 node의 native motion을 막지 않는다. Motion graph가 참조하는 node·resource가 사라지면 정확한 cancel terminal을 발생시킨다.

### 9.3 그래픽 backend

Native는 기존 Skia·Graphite/Ganesh·paragraph·shadow 수정·라이선스와 vendor 공급을 재사용한다. Web은 npm 공식 CanvasKit의 공개 surface/paragraph/Picture API와 라이선스를 사용하며 Native patch가 npm 배포본에도 반영됐다고 가정하지 않는다. v2 재설계와 별도의 GPU API 교체·JS VM 교체를 동시에 성능 개선으로 묶지 않는다.

처음에는 retained Picture의 native 재생과 정확한 전체 surface 갱신으로 시작할 수 있다. 이후 작업량 측정에 따라 tile/raster cache·부분 손상 갱신·effect pass 재사용을 추가한다. 복잡한 backdrop/blur·clip/shadow에서 damage를 확신할 수 없으면 정확한 큰 영역 재그리기를 선택한다. 작은 damage 수치만으로 시각 회귀를 감추지 않는다.

Layout·텍스트·scene 준비와 render thread가 같은 mutable Skia 객체를 함께 쓰지 않는다. Graphite recorder/context와 GPU 자원은 명시한 owner에서만 접근하고, content 쪽 CPU 기록과 immutable 결과의 전달 계약을 먼저 확정한다.

### 9.4 CPU 준비와 활성화 가능한 자원을 구분한다

`SceneReady`는 CPU layout/text/기록의 준비 상태다. 새 scene의 필수 image decode·font·GPU upload·effect 자원과 device generation을 검사한 뒤 `ActivationReady`로 넘긴다. 필수 자원이 부족하면 기존 유효 scene을 유지하며, 앱이 선언한 placeholder만 별도 정상 콘텐츠로 사용할 수 있다.

GPU upload·shader 준비도 render owner의 bounded 작업으로 예약하고 기존 motion 제출과 공정하게 나눈다. Driver 내부의 동기 compile/allocation 비용이 모두 취소 가능하거나 독립 thread에서 안전하다고 약속하지 않는다. 실제 점유는 계측하며 GPU API가 허용하지 않는 객체 공유로 우회하지 않는다. Device loss에서는 이전 GPU handle을 무효화하고 살아 있는 CPU document/기록에서 자원을 재구축한다. 옛 device의 late 완료가 새 credit·publication 상태를 변경할 수 없다.

## 10. Hit test·편집·접근성의 정합성

### 10.1 화면과 같은 property를 사용한다

Hit-test index의 node·clip·transform·scroll 참조는 해당 게시 frame의 scene/property와 공유한다. Scroll할 때 별도의 TS geometry 트리를 갱신하기 위해 전체 node를 재직렬화하지 않는다. Native 결과는 callback ID와 버전이 있는 route로 전달한다.

`InteractionSnapshot`에는 `SceneEpoch`, `PropertyEpoch`, `MetricsEpoch`, `SubmissionId`, `PublicationId`, `publicationStage`와 **관측 가능한 경우에만** `SurfaceCommitId`를 포함한다. Render에 사용한 동일 property 값을 immutable snapshot으로 봉인한다. Compositor의 최신 simulation 값과 마지막 게시용 값을 분리하며, 아직 게시하지 않은 미래 transform으로 새 target을 잡지 않는다.

| Port | Interaction용 snapshot을 넘길 수 있는 근거 | 보장하지 않는 관측 |
| --- | --- | --- |
| Windows | 정확한 submission과 연결한 surface 갱신·host 게시 API의 성공. 더 강한 완료 신호가 있으면 별도 stage로 표시 | `Commit` 반환·GPU copy 완료만으로 실제 DWM 표시/scanout을 확정하지 않음 |
| Web | 같은 frame의 draw/flush·event-loop 반환 또는 사용 가능한 commit 경계를 port가 식별하고 browser main에 게시 통지를 전달 | Worker 메시지·rAF·WebGL 제출을 browser compositor의 실제 표시 완료로 간주하지 않음 |

`PublicationId`는 host의 논리적 게시 순서이며 표시 receipt가 아니다. Web처럼 surface 완료를 관측할 수 없는 port는 `surfaceCommitted=unobserved`로 유지하고 API도 이 정합성 한계를 노출한다. Windows의 batch `Commit` 의미는 [DirectComposition Commit](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-idcompositiondevice-commit), Web의 implicit/explicit 게시 경계는 [Emscripten WebGL context](https://emscripten.org/docs/api_reference/html5.h.html)를 따른다.

Platform UI는 마지막 게시 통지를 설치한 뒤 새 입력 packet에 그 `PublicationId`와 metrics를 붙인다. 일반 target/route의 판정자는 compositor이며 packet이 지정한 snapshot으로 hit test한다. UI의 IME·접근성 proxy도 같은 snapshot을 읽고 별도 권위 geometry를 만들지 않는다. 새 게시 이전에 수집한 입력을 새 snapshot으로 재해석하지 않으며, 진행 중 stream은 latch/capture한 node의 generation과 좌표 변환을 사용한다.

Snapshot은 마지막 게시용 1개와 admitted input/진행 stream·GPU/platform이 실제 참조하는 세대만 제한적으로 보유한다. Host의 snapshot lease는 교체 설치와 기존 packet/stream 소비가 끝난 뒤 회수해 수집과 retirement 사이의 race를 막는다. 이미 회수했거나 metrics가 맞지 않는 snapshot의 입력은 정의한 rebase 또는 cancel로 끝내며 임의의 새 target으로 보내지 않는다. Modal·view 폐쇄는 admission fence로 이전 route의 추가 동작을 막고 cancel을 전달한다. Node가 새 document에서 사라졌지만 이전 화면에 남아 있는 경우에도 callback을 재사용 slot으로 보내지 않는다. Publication·input 교차, 두 열·nested scroll·고정 header·회전/scale·singular transform을 검사한다.

### 10.2 편집 document

Native text-input service가 focus session별 **문서 값·selection·composing·revision의 단일 writer**가 된다. TS form state는 revision이 있는 편집 결과를 받고, 값 변경 요청은 별도의 command로 보낸다. 기존 controller의 값 대입도 승인 시점이 있는 v2 계약으로 이식한다.

Windows TSF·Android InputConnection 등 동기 질의가 필요한 platform 서비스는 해당 UI owner의 native document를 읽는다. JS를 동기 호출하지 않는다. Content Engine에는 순서 있는 edit transaction/immutable document revision을 전달해 paragraph·caret·selection layout을 준비한다. 다른 thread가 같은 문자열을 동시에 수정하지 않는다.

Web의 DOM/EditContext 연결은 browser main thread의 platform service가 같은 document revision 계약을 구현한다. 이 서비스는 browser 편집 이벤트를 순서 있게 전달하고 engine layout 결과로 후보창·selection geometry를 갱신한다. OS native text store와 동일한 C++ 객체를 DOM에서 직접 사용한다고 가정하지 않으며, app worker의 응답을 browser 편집 이벤트의 동기 조건으로 두지 않는다.

기본 입력 formatter는 선언형 native 규칙으로 제공한다. 사용자 JS 검증은 비동기 결과와 명시적 수정 transaction으로 처리한다. 매 키의 동기 JS 반환이 반드시 필요한 확장은 앱 의존 편집 경계로 표시하고, 그 비용·조합 취소 의미를 분리한다.

Focus 전환·한국어 composing·undo/redo·selection drag·자동 reveal·scroll 중 caret·detach 시 종료를 함께 검증한다. 오래된 JS 상태가 새 조합 문자열을 덮지 않도록 base revision 충돌을 거부한다. 후보창 좌표는 사용할 수 있는 최신 문서 layout과 interaction snapshot의 일치 여부를 확인한다.

Wire의 문서 offset은 UTF-16 code unit으로 고정하고 platform의 다른 offset 단위는 adapter에서 변환한다. Range가 문서 길이·surrogate 경계를 위반하지 않는지 검사하며 grapheme 단위 이동·삭제의 의미는 별도 text 계약으로 유지한다. Selection/composing·undo 기록·외부 값 교체도 `EditRevision`에 포함한다. 외부 교체는 `preserve/commit/cancel composing` 중 정책을 명시해야 하며 stale 명령이 새 조합을 덮지 못한다. Focus session 종료와 문서 폐기를 구분해 blur만으로 undo 문서를 잃지 않는다.

OS가 동기적으로 요구한 geometry에 맞는 최신 layout이 아직 없으면 port가 지원하는 일시적 layout 없음/재질의 통지를 사용한다. 옛 paragraph의 caret 위치를 새 edit revision의 정확한 값으로 돌려주지 않는다. 이 임시 상태와 재통지 경로를 실제 TSF/InputConnection/browser 편집에서 확인한다.

### 10.3 접근성

Semantics의 label·역할·상태·action은 content transaction으로 바꾸고, bounds는 동일한 scene/property 참조로 계산한다. 이동만으로 전체 semantics 내용을 다시 전송하지 않는다. Native UI proxy는 버전이 있는 snapshot으로 OS 질의에 응답한다.

Focus·값·선택 등 의미 변화는 motion-only bounds 갱신과 구별한다. 스크린 리더 action도 node generation·문서 revision을 확인한다. 구조·시각적 bounds는 해당 host publication보다 먼저 게시하지 않는다. OS에 이미 승인된 편집 값/focus는 document revision으로 즉시 응답할 수 있지만 layout/visual revision과 구분한다. 삭제된 node의 action을 다음 slot의 node로 보내지 않는다.

## 11. 가상화와 자원 수명

### 11.1 준비되지 않은 콘텐츠의 한계

Retained scene은 준비된 콘텐츠를 계속 움직이게 할 수 있지만, 아직 실행하지 않은 TS builder의 결과를 만들어 낼 수는 없다. Native layout이 있어도 JS에서 새 child를 생성해야 하면 그 경계가 남는다.

- Engine이 viewport·속도·방향·실제 준비 비용·메모리 여유로 다음 필요 범위를 계산한다.
- `NeedChildren` 요청은 list generation·key/index 범위·환경 revision을 포함하며 중복 요청을 합친다.
- TS builder 결과가 돌아오면 현재 요청과 key를 검증해 transaction으로 설치한다. Builder를 native layout stack에서 동기 호출하지 않는다.
- 고정/추정 extent와 anchor 보정의 계약을 정의하고, 실제 측정으로 extent가 바뀌면 현재 손가락 아래의 콘텐츠 위치를 보존한다.
- 데이터와 표현을 선언형 item template로 제공할 수 있는 list는 native가 새 항목을 구성할 수 있게 한다. 모든 사용자 Widget을 자동으로 template으로 번역한다고 약속하지 않는다.

### 11.2 준비 범위를 넘어갈 때의 정책

Scene은 viewport보다 넓은 `preparedCoverage`와 준비된 display list/resource를 가진다. Prefetch 범위는 예산 안에서 방향·속도에 따라 조정하며, 전 페이지 상주를 전제로 하지 않는다.

기본 정책은 준비된 유효 영역의 끝에서 visual offset을 제한하고 콘텐츠 준비를 요청하는 것이다. 단일 scroll model 안에서 `requestedOffset`과 `visualOffset`을 구분하고 요청·적용·defer·extent clamp·ancestor handoff를 집계한다. 외부에 보이는 `pixels`는 적용된 visual 값이며 미적용 요청을 화면 위치로 보고하지 않는다.

초기 deferred 정책은 **활성 gesture 중 한 viewport 이내의 최신 목표 1개**만 보유하는 것이다. 반전 시 이전 방향의 미적용 목표를 먼저 버리고 현재 visual 위치에서 반대 이동을 적용한다. End/cancel/hide에서는 잔여 목표와 그에 따른 ballistic을 버린다. Phase가 없는 wheel은 현재 sample의 적용분만 유지하며 미적용 목표를 누적하지 않는다. 준비 완료가 같은 gesture에 도착한 경우에만 W8-03에서 고정한 속도 한도로 현재 목표를 따라가며, 과거 sample을 몰아 재생하거나 손을 뗀 뒤 뒤늦게 jump하지 않는다. 명시적인 programmatic scroll은 별도 command 수명과 목적지 준비 정책을 따른다.

빈 콘텐츠 위를 계속 이동하거나 미준비 영역을 정상 frame처럼 세는 정책은 기본값으로 두지 않는다. Placeholder를 허용하는 list는 앱이 placeholder·추정 extent·접근성 의미를 명시한다. 이 콘텐츠 준비 지연은 `contentUnavailable`로 관측해 일반 준비 구간의 motion과 분리한다.

### 11.3 예산과 해제

기존 Gallery의 bounded section 정책·editor keep-alive와 [work7 §3.3](history/26/11/04/work7-summary.md)의 자원 예산을 비교 출발점으로 삼는다. Scene prefetch용 Picture/raster를 추가하면 기존 Element retention과 합산한 비용을 공개한다. 예산 확대만으로 v2 개선을 만들지 않는다.

엔진의 메모리 장부는 document/node·scene block·paragraph/font·display list·image decoded bytes·CPU/GPU raster·frame backing·protocol/inbox로 나눈다. 공유 객체는 실제 소유량과 참조 수를 구별한다. 초기 한도는 W8-01에서 정하고 W8-04/05의 실제 장면으로 확인한다.

Node/scene 개수만이 아닌 bytes 한도와 일시적 peak를 적용한다. [§5](work8-1.md#5-변경-transaction과-세대-계약)의 staging document·준비 중 scene·옛 interaction snapshot·GPU retirement backlog가 동시에 남는 경우도 포함한다. 예산 초과 시 optional 준비를 줄이거나 admission을 명시적으로 거부한다. Required/visible 자원까지 포화되면 view 오류를 보고하며 상한을 몰래 늘리지 않는다. 입력 raw observer·App 이벤트·edit 전달·작업 결과 큐도 장부와 한도에서 제외하지 않는다.

자원은 다음 참조가 모두 없어져야 해제된다: document, 준비 scene, active scene, interaction/semantics snapshot, GPU in-flight, platform 사용. 압박 시 optional prefetch·raster·화면 밖 기록부터 회수한다. 보이는 콘텐츠·focus editor·GPU 참조를 무시하고 제거하지 않는다.

종료는 입력 admission 종료 → stream cancel/문서 session 종료 → App/Content 전송 봉인 → 준비 작업 취소 → GPU와 platform consumer drain → snapshot/resource 해제 → 각 owner 종료 순서다. JS가 정지한 상태에서도 native 종료가 무한히 ACK를 기다리지 않도록 timeout·실패 terminal을 정의한다. Device loss·hide·zero-size·resize·late callback도 같은 세대 계약을 따른다.

Reload도 정식 수명 경계다. App generation을 교체하고 이전 callback·transaction·focus/편집 session을 종료한 뒤 새 runtime을 연결한다. 마지막 준비 frame을 잠시 유지할 수 있지만 이전 앱으로 입력을 보내지 않는다. 새 첫 scene의 게시와 old-generation 자원 drain을 확인하며, reload를 창 재생성이나 종료 누락으로 대신하지 않는다.

Timeout은 실패 판정이며 GPU/platform이 아직 쓰는 메모리를 해제해도 된다는 허가가 아니다. Fence 완료·device 폐기 등 안전한 해제 조건을 확인한 뒤 drain한다. JS owner가 반환하지 않는 상황은 runtime의 검증된 interrupt/종료 경로가 필요하고, 안전한 회수가 불가능하면 engine session/host를 실패 종료한다. 강제 thread 종료 뒤 같은 session에서 reload를 성공 처리하지 않는다. 지연·late callback·cleanup 실패를 포함한 실패 종료도 테스트한다.

## 12. 호스트와 플랫폼 경계

### 12.1 Windows를 첫 완성 경로로 만든다

기존 [windows-hermes host](Nelyx/sdk/native/windows-hermes/)의 runtime loop·window·입력·서비스·GPU 연결에서 재사용 가능한 코드를 추출한다. VM/compiler/JSI/CRT·Skia native 공급 cohort를 고정하고, v2 선택을 로그와 현재 package manifest에서 확인한다. 현재 자체 host의 존재를 전체 Testbed·IME·접근성·reload가 이미 검증됐다는 뜻으로 사용하지 않는다.

V2의 normal input/frame 경로는 Fabric event→JS→render 제출을 거치지 않는다. SDK는 플랫폼 서비스·자산·실행 도구의 adapter가 되고 common engine의 schedule을 대신 소유하지 않는다. React Native embedding이 필요하면 나중에 같은 engine API의 host adapter로 제공할 수 있으나 v2의 필수 기반은 아니다.

Resize에서는 기존 front를 유지하고 새 metrics에 맞는 scene·surface가 준비된 뒤 게시한다. 이전 크기 frame의 late 완료가 새 surface를 덮지 않게 한다. 정확성과 resize 성능은 구별하며 기존 `resizePerformanceAccepted=false`를 설계만으로 변경하지 않는다.

### 12.2 Web

Web에서도 공통 node·layout·text provider·scroll·scene 코어를 Wasm으로 컴파일한다. **자체 engine Wasm과 npm 공식 CanvasKit Wasm을 분리하고 host adapter로 연결한다.** Engine은 document·layout 결과·scroll·motion·scene·자원 수명의 권위 상태를 소유하고 CanvasKit은 graphics/text provider를 담당한다. Engine에 Skia를 함께 링크하는 이전 안은 사용자의 npm 배포본 사용 방침에 맞춰 변경한다. npm 배포와 JS/Wasm 초기화 경계는 [Skia CanvasKit 안내](https://skia.org/docs/user/modules/canvaskit/)·[공식 quickstart](https://skia.org/docs/user/modules/quickstart/)를 따른다.

#### 12.2.1 필수 실행 profile과 기능 경계

| 항목 | `threaded` | `single-worker` |
| --- | --- | --- |
| 최소 환경 | [§1.4](work8-1.md#14-첫-백엔드-완료에-포함할-대상) + cross-origin isolation·공유 Wasm memory/atomics·pthread 실행 가능 | [§1.4](work8-1.md#14-첫-백엔드-완료에-포함할-대상). COOP/COEP·SharedArrayBuffer 불필요 |
| Browser main / App | DOM·입력·IME/접근성 proxy / 별도 TS app worker | 동일. Wasm single-thread가 앱 전체를 browser main에서 실행한다는 뜻은 아님 |
| Engine 실행 | Emscripten runtime worker와 pthread들이 한 engine/document와 shared linear memory를 사용. Content와 Render thread 분리 | 별도 engine worker 하나의 non-shared Wasm instance. Content와 Render를 같은 event loop에서 순차 실행 |
| CanvasKit 실행 | Content worker의 CPU text/Picture instance와 Render worker의 GPU instance. 같은 npm 버전/배포 variant·공개 API 사용 | 같은 engine worker의 별도 CanvasKit module. 준비된 paragraph/Picture를 local resource ID로 재사용 |
| 공통 기능 | 같은 node/layout/text·scroll/physics·scene·편집/semantics protocol·resource/drain 계약 | 동일. v1 TS layout·paint로 대체하지 않음 |
| 실행 capability | `appIndependent=true`, `contentIndependent=true` | `appIndependent=true`, `contentIndependent=false` |
| 성능 제한 | Thread/전송·engine↔JS↔CanvasKit adapter·Picture 준비/전달·browser/GPU 비용은 여전히 존재 | 같은 adapter 비용에 더해 긴 동기 Content·decode·shader 작업 동안 입력 소비·motion/render가 지연될 수 있음 |

위 capability는 구현 후 실제 검사로 보고할 값이다. 두 profile 모두 C++가 권위 상태를 소유하며 worker마다 독립 engine/document를 만들지 않는다. Single-worker의 성능 저하는 허용하되 입력 유실·scene 역행·편집 불일치·무한 대기·자원 누수는 허용하지 않는다. Browser main이 막히면 두 profile 모두 새 입력 전달이 늦어질 수 있다.

#### 12.2.2 두 빌드와 공급 identity

[Emscripten pthreads](https://emscripten.org/docs/porting/pthreads.html)는 threaded/non-threaded를 한 바이너리에서 전환할 수 없으며 별도 빌드 후 runtime에서 선택해야 한다고 명시한다. **두 빌드는 자체 engine에 해당하고 npm CanvasKit을 두 종류로 재빌드하는 계획이 아니다.** 런타임의 thread 수만 1로 줄이거나 shared memory를 일반 ArrayBuffer로 바꾸는 방식은 fallback 구현이 아니다.

- Threaded는 자체 엔진과 필요한 engine dependency의 compile/link에 맞는 `-pthread` 설정을 사용한다. Non-shared는 같은 엔진 소스를 pthread/shared-memory 없이 별도로 compile/link한다. 공통 코어에는 executor/provider port를 두고 `std::thread` 생성·futex wait·thread join이나 Skia object가 Web 빌드의 필수 의존이 되지 않게 한다.
- Engine profile마다 별도 object/library 출력·JS glue·Wasm·필요한 worker 파일과 manifest를 만든다. Threaded object/library를 non-shared link에 재사용하지 않는다. Source revision·engine ABI/schema·provider protocol은 맞추고 toolchain·flags·memory 공유 여부·각 파일 hash를 identity에 포함한다.
- CanvasKit은 고정 npm 버전·선택한 공식 배포 variant의 JS/Wasm을 사용한다. Package lock의 integrity·배포 entrypoint·JS/Wasm 입력 hash를 확인하고, 기본 variant와 `full` 등의 파일을 섞지 않는다. JS의 정상적인 번들링 결과는 제품 빌드 identity로 추적하되 upstream source/binding/Wasm을 직접 패치하거나 재빌드하지 않는다. 채택 배포본의 실제 non-shared 실행·필수 paragraph/codec 기능은 두 engine profile에서 확인한다.
- 배포 index와 SDK/template은 두 engine profile과 공통 npm CanvasKit 자산을 공급한다. Loader/bootstrap은 SharedArrayBuffer 없이도 로드돼야 하며, 선택 전에 threaded engine glue를 정적 import하거나 두 engine Wasm을 모두 instantiate하지 않는다. 선택한 engine profile과 필요한 CanvasKit module instance만 초기화한다.
- 기존 전용 CanvasKit manifest를 v2의 npm identity로 재사용하지 않는다. W8-02에서 engine toolchain·flags·worker asset 경로·CSP·공개 CanvasKit 초기화 방식을 확정하고, engine/CanvasKit 각각의 실제 HEAP buffer·owner·파일 identity를 검사한다. Single-worker 실행에서 pthread worker나 필수 SAB 의존이 없는지도 확인한다.

#### 12.2.3 자동 선택과 시작 실패

아래 `webExecution` 이름·값은 **구현할 설정 계약**이며 현재 CLI option이 아니다. V2 Web의 기본값은 `auto`다.

| 요청 | 선택/실패 규칙 |
| --- | --- |
| `auto` | 공통 최소 환경을 확인하고 threaded capability가 모두 있으면 `threaded`, 격리/shared-memory/threading capability가 없으면 `single-worker`를 선택 |
| `single-worker` | 격리 여부와 관계없이 non-shared 빌드를 선택. 재현·호환성 검사에도 사용 |
| `threaded` | 모든 threaded capability와 해당 공급을 요구. 부족하면 이유를 반환하고 시작 실패 |

1. 먼저 공통 worker bootstrap/메시지 왕복과 main/실제 engine runtime worker의 `crossOriginIsolated === true`를 확인한다. 미격리면 SAB 생성/공유 probe·threaded 자산 로딩을 건너뛰고 single-worker를 선택한다. 격리되면 SAB 가용성·공유 Wasm memory/atomics·공유 메시지 왕복을 확인하며 전역 객체의 존재만으로 성공을 판정하지 않는다. 공통 graphics probe는 임시 canvas에서 하고 실제 view canvas에 미리 context를 만들지 않는다. Probe 자원 정리·thread pool 준비·canvas 이전 순서도 W8-02에서 검증한다.
2. 격리 판정은 header 문자열의 유무보다 실제 실행 context를 따른다. Header가 있어도 embedding/Permissions-Policy 등으로 isolation이 안 되면 `auto`는 single-worker다. COOP/COEP가 모두 없는 일반 정적 호스팅도 필수 성공 대상이다([cross-origin isolation 조건](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)).
3. 자동 대체는 session 생성·실제 canvas 이전·document 승인 전에 확인한 capability 부족에만 적용한다. HTTP/해시/ABI 오류·잘못된 worker URL·Wasm 초기화 예외·OOM을 통째로 잡아 fallback하지 않는다. 공통 Worker/CSP·OffscreenCanvas/WebGL2 부족이나 요청한 필수 capability 부족은 명시적 시작 오류다.
4. `requestedProfile`, `selectedProfile`, `selectionReason`, engine/CanvasKit 각각의 실제 memory 종류·owner 배치·기능 capability·artifact identity를 SDK에 보고한다. `auto`가 non-shared를 선택하는 것은 허용된 v2 profile 선택이다. 앱이 `contentIndependent`를 필수로 요구하면 그 환경에서 실패해야 한다.
5. 선택은 session 동안 고정한다. Threaded↔non-shared live heap/handle 이식은 하지 않는다. 시작 실패 뒤 재시도는 이전 worker/port를 정리하고 새 session/view 세대에서 수행한다. Canvas 이전/context 생성 후에는 같은 canvas를 되돌려 재사용할 수 있다고 가정하지 않는다.

선택한 profile에서도 배포에 남아 있는 COEP/CSP·자산 CORS/CORP·MIME·HTTPS가 필요한 API의 조건을 적용한다. Non-shared는 shared-memory 요구를 없애는 실행 방식이며 자산 접근 권한을 바꾸지 않는다.

#### 12.2.4 Single-worker scheduler와 전송

- Native/threaded에서 별도 thread가 진행하는 Content 작업을 single-worker에서는 재개 가능한 작업 단위와 유한한 quota로 실행한다. 입력 watermark·motion/credit·scene 활성화·Content 각각에 진행 기회를 주어 연속 입력과 연속 commit 어느 쪽도 다른 쪽을 굶기지 않게 한다. 짧은 작업만 영원히 우선해 새 콘텐츠가 준비되지 않는 것도 실패다.
- 한 Wasm 호출은 유한한 작업 뒤 반환한다. Layout 순회·decode 준비 등은 가능한 경계에서 나누고 남은 작업을 다음 browser task/frame 기회에 예약한다. 무한 C++ loop·`Atomics.wait`·동기 메시지 응답 대기나 끝없이 이어지는 Promise microtask로 event loop를 점유하지 않는다. 임의의 동기 paragraph/driver 호출을 자동 선점할 수는 없으므로 그 점유·반환 뒤 회복을 측정한다([Emscripten event loop](https://emscripten.org/docs/porting/emscripten-runtime-environment.html)).
- App↔engine은 MessagePort와 standalone transferable ArrayBuffer로 transaction·결과·snapshot을 전달한다. Wasm HEAP에서 packet을 복사하고 송신자는 transfer 뒤 buffer를 사용하지 않는다. 재시도에 필요한 동일 payload는 bounded 보관하거나 다시 인코딩하며, 소유권 반환/실패 terminal도 정의한다.
- Main→engine 입력은 App 응답과 무관하게 전달한다. 전송 전에 bytes·packet 수/credit을 제한하고 observer snapshot·wake를 합친다. 단순히 수신 배열의 길이만 제한해 이미 `postMessage`된 task가 무한 누적되게 하지 않는다. Down/up/cancel·edit·transaction 순서는 보존하고, 큐 포화 정책은 [§7](work8-1.md#7-입력제스처스크롤을-엔진-상태로-만든다)/[11.3](#113-예산과-해제)과 같다.

#### 12.2.5 Canvas·게시·DOM 서비스

OffscreenCanvas와 Worker 사용 자체를 shared-memory 요구와 묶지 않는다. 격리가 없어도 공통 최소 환경을 통과하면 single-worker가 직접 렌더링한다. 실제 canvas는 context 생성 전에 선택된 render owner로 한 번 이전하고 CanvasKit surface/WebGL2 context는 그 owner에 고정한다. Web의 JS adapter는 같은 render worker에서 CanvasKit 공개 API를 호출하며 browser main이나 App Runtime의 응답을 매 draw의 조건으로 두지 않는다. Canvas 이전과 context 모드의 제한은 [HTML OffscreenCanvas/transfer 계약](https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-transfercontroltooffscreen)을 따른다. 고정 npm build가 만든 실제 WebGL version·GPU surface를 W8-02에서 확인하며, 자동 software surface 대체를 WebGL2 실행 증거로 세지 않는다.

Web render tick은 implicit 게시에 필요한 event loop 반환 또는 실제 지원되는 explicit commit을 수행한다. Native의 blocking loop로 draw만 반복하는 것을 화면 갱신으로 인정하지 않는다. Worker rAF 가용성·visibility·idle·hide/resume에 맞게 비동기 예약하고, 필요하면 main에서 bounded tick을 전달한다. Worker 메시지/rAF/WebGL submit은 실제 표시 완료 receipt가 아니다([§10.1](#101-화면과-같은-property를-사용한다)). Context loss는 기존 CPU document에서 같은 profile로 복구하며 thread profile 변경으로 숨기지 않는다.

Browser 기본 조작은 main thread에서 결정해야 한다. Engine 영역의 `touch-action`은 gesture 시작 전에 설치하고, wheel listener의 cancel 가능 여부·페이지 scroll 허용·pointer capture 정책도 게시된 설정으로 처리한다. App/engine worker의 비동기 답을 받은 뒤 이미 진행된 browser pan/zoom을 취소할 수 있다고 가정하지 않는다([W3C Pointer Events](https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property)). DOM focus·IME·clipboard 등은 main-thread adapter capability와 실패 결과를 제공한다. Worker 내부 gesture 성공만으로 DOM focus/편집 성공을 대신하지 않는다.

Web port의 첫 gate는 W8-01에서 두 engine profile의 headless 코어 compile·protocol 왕복이다. W8-02에서는 npm CanvasKit과 두 engine 공급물의 연결·작은 실제 화면·[§16.4](work8-3.md#164-web-비격리-배포와-profile-검증표) 배포 선택을 확인한다. 이를 native framework 이식이 끝난 뒤까지 미루지 않는다.

#### 12.2.6 Engine↔CanvasKit adapter와 retained 자원

- C++는 node/layout·가시 항목·transform/clip/opacity·frame 선택을 결정한다. Adapter는 버전이 있는 resource 변경 batch와 frame packet을 받아 공개 CanvasKit API로 준비/재생한다. Resource bytes는 변경 때 보내고 준비된 Picture/path/paint/image ID를 재사용한다. JS adapter에 두 번째 render tree·scroll physics·layout 권위를 만들지 않는다.
- Engine linear-memory offset을 CanvasKit의 포인터로 전달하지 않는다. 원시 값·복사한 byte packet·module-local resource ID로 연결하고 CanvasKit 할당/객체는 해당 instance의 공개 release/`delete()` API로 회수한다. Engine의 shared heap과 CanvasKit heap·worker별 복제된 font/cache·직렬화 staging bytes를 ledger에 합산한다.
- Content의 CanvasKit paragraph/Picture는 같은 worker에 남긴다. Threaded에서 전달할 text paint record는 같은 npm 버전/variant 사이의 공개 Picture 직렬화로 준비하고, Render의 `MakePicture()` 성공·font/glyph/emoji·image 보존을 확인한 뒤 `ActivationReady`로 넘긴다. Raw SKP를 native/Web 공통 wire ABI나 버전을 넘는 영구 cache로 취급하지 않는다. 직렬화 실패·decode 실패·bytes 초과는 명시적 scene/resource 실패로 끝내고 기존 유효 scene을 유지한다.
- `serialize()`/`MakePicture()`의 API 존재는 현재 npm 타입에서 확인했지만 이 font/resource 전달 경로는 아직 실행 검증 전이다. W8-02에서 필수 text/image corpus가 통과하지 않으면 공급 gate를 닫지 않고 공개 API 기반 준비 형식을 다시 설계한다. Draw 중 paragraph를 다시 layout해 미준비 자원을 숨기는 방식으로 통과시키지 않는다.
- Engine owner도 browser task에 반환해 JS adapter·CanvasKit 초기화/작업·credit 통지가 실행될 수 있어야 한다. Threaded C++의 무한 blocking loop 때문에 같은 worker의 adapter가 실행되지 않는 구조를 피한다. Content provider 지연 중 Render는 이미 준비된 CanvasKit resource로 진행한다.
- Frame마다 engine→JS packet 수/bytes·CanvasKit 호출 수·resource 생성/재사용·복사/직렬화·provider 대기·순수 엔진/adapter/GPU 점유를 나누어 확인한다. npm 사용은 공급 단순화의 결정이며, 이전 단일 module 안과 같거나 더 빠르다는 성능 주장은 검증 전에는 하지 않는다.

### 12.3 Android·Apple·Linux

Platform UI·vsync·surface·text-input·semantics 서비스만 각 OS port로 구현한다. Common engine에 Java/Kotlin·Objective-C·GTK·RN 타입을 포함하지 않는다. Android 입력 수집도 표준 엔진 경로로 연결하고, JavaScript bridge 호출이 gesture frame 생산의 필수 단계가 되지 않게 한다.

W8-02에서 Android의 같은 최소 scene 실행도 확인해 window/event loop 가정의 편향을 일찍 찾는다. 전체 Testbed 이식·물리 IME/접근성·제품 배포는 후속 platform gate로 구분한다. Apple/Linux의 기존 미검증 상태를 v2 Windows 성공으로 채우지 않는다.

## 13. 공개 API와 기존 코드의 이식

### 13.1 보존할 경험과 바꿀 계약

| 현재 작성 방식/기능 | v2 방향 |
| --- | --- |
| Widget 구성·State·Key·의존성·theme | 사용 경험을 우선 보존하고 새 reconciler에서 node transaction 생산 |
| Material/Cupertino 속성·자산·아이콘·테마 데이터 | 재사용. 렌더링 내부·gesture·motion 연결은 v2로 이식 |
| TS RenderObject의 동기 layout/paint/hitTest subclass | Native node 조합·engine extension·AppDrivenBoundary로 명시적 이식 |
| ScrollController의 즉시 정확한 `pixels` 조회 | 버전이 있는 마지막 snapshot 조회. 명령과 처리 결과는 비동기 ACK |
| `jumpTo/animateTo` | 순서 있는 engine command와 완료/cancel terminal. 사용자 gesture 충돌 정책 포함 |
| 임의 TS frame callback | App Runtime callback. 지원되는 motion은 native graph로 선언 |
| TextEditingController 값/selection 동기 변경 | Revision을 포함한 edit command와 결과 snapshot |
| layout 뒤 geometry 조회 | Scene/Metrics epoch가 붙은 비동기 query 또는 cached snapshot |
| v1 packet별 동기 input callback | v2 결과 이벤트·선택적 raw observer·앱 의존 gesture를 구별 |

핵심은 앱에서 보기 편한 동일 이름을 붙이는 일이 아니라 **언제 읽은 값이고 누가 최종 적용했는지**를 분명히 하는 것이다. 명령 ACK·motion 종료·surface 게시·display 관측을 모두 `complete` 하나로 표현하지 않는다.

### 13.2 점진 이식의 경계

V1과 v2는 build/run 시작 시 engine major를 선택하는 **별도 실행 제품**으로 비교한다. 한 view의 일부 widget은 v1 RenderObject, 나머지는 v2 native tree로 조용히 섞지 않는다. 이식 중 필요한 TS 경계는 v2 protocol 안의 명시적 AppDrivenBoundary로 한정한다.

첫 이식은 primitive→paragraph/image→표준 control→scroll/list→editable→overlay/navigation→확정한 Material/Cupertino API 순서다. W8-00에서 현재 export·Testbed 사용 목록으로 필수 이식 범위를 고정한다. 지원하지 않는 control은 명시적인 미지원 결과를 내고, v1 fallback으로 화면을 채운 것을 v2 완료로 세지 않는다. 공개 import 경로는 가능한 범위에서 유지하지만 의미가 달라지는 API는 migration 목록과 타입으로 드러낸다.

기존 Flutter→TypeScript 변환·생성 소스도 새 runtime을 대상으로 재검토한다. Widget API·테마 데이터의 생성은 재사용할 수 있지만, 생성된 TS RenderObject 구현을 그대로 연결해 native node마다 TS layout callback을 부르는 우회 이식은 하지 않는다. Node/property schema와 codec은 같은 계약에서 생성하고 canonical source·생성 책임을 하나로 유지한다.

## 14. 다른 선택지를 채택하지 않은 이유

| 선택지 | 판단 |
| --- | --- |
| TS 엔진을 유지하고 scheduler·C++ kernel을 계속 보완 | 개별 문제 수정에는 유효하지만 JS가 화면 실행의 공통 관문인 소유 구조가 남음. v2의 최종 기반으로 선택하지 않음 |
| TS 전체를 AOT/다른 VM으로 변경 | 실행 비용을 줄일 가능성은 있으나 input·layout·paint·제출의 대기 관계와 상태 중복은 별도로 남음 |
| C++ renderer만 두고 TS가 매 frame 전체 command 생성 | 렌더러는 native여도 JS frame 생산이 계속 필요해 이번 재설계 목표를 충족하지 못함 |
| 모든 Widget·State·앱 callback까지 C++로 작성 | TS UI SDK의 사용 경험을 크게 버리며, 앱 코드가 느릴 때와 화면 실행의 분리를 자동으로 해결하지도 않음 |
| OS native scroll control 위에 화면을 얹기 | 특정 platform의 scroll에는 유효하지만 custom canvas·nested gesture·공통 text/semantics와 통합할 새 계약이 필요 |
| C++ authoritative engine + TS 선언·상태 | 채택. 엔진이 지속 상태를 보유하고 JS를 기다리지 않는 일반 이동 경로를 만들 수 있음. API 변경·thread·자원·이식 비용은 감수 |

독립 합성과 준비 scene을 나누는 구조는 Chromium의 compositor/main-thread 분리와 active/pending content 운용에서도 확인할 수 있다([Chromium How cc Works](https://chromium.googlesource.com/chromium/src/+/main/docs/how_cc_works.md)). Firefox APZ는 콘텐츠 준비와 독립적인 이동뿐 아니라 displayport 범위 밖의 미준비 영역·hit detection·scroll handoff 문제도 설명한다([Firefox APZ](https://firefox-source-docs.mozilla.org/gfx/AsyncPanZoom.html)). **이 자료에서 Nelyx에 적용할 원리를 추론한 것이며, 두 엔진의 구현 전체를 복제하거나 같은 성능을 보장하는 것은 아니다.**

Windows `MANUALUPDATE`는 `Update` 호출로 콘텐츠 갱신을 진행해야 한다는 계약이다([Microsoft DirectManipulation options](https://learn.microsoft.com/en-us/windows/win32/api/directmanipulation/ne-directmanipulation-directmanipulation_viewport_options)). 따라서 native 수집 scheduling을 계속 검증해야 하며, 엔진을 C++로 옮겼다는 이유로 그 지연이 사라졌다고 가정하지 않는다.


---

이전: [1부 — 구조·상태·입력 계약](work8-1.md) · 다음: [3부 — 구현 순서·검증·완료 기준](work8-3.md)
