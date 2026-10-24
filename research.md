# Windows Static AOT 트랙패드 스크롤 끊김 원인 조사

기준일: **2026-10-23 KST** · checkout: `7a6be8f9` · 대상: `sample/nelyx-testbed-app-2`

## 1. 결론

**가장 강한 원인은 스크롤 경계에서 새 항목의 Widget/Element/RenderObject를 만들고, 문단을 측정하고, 이전 항목을 해제하는 동기 작업이다.** 이미 만들어진 트리를 움직이는 인디케이터·라우트 애니메이션과, 새 트리를 계속 요구하는 긴 스크롤의 부하는 크게 다르다. Static AOT도 이 작업량과 객체·동적 호출 비용을 그대로 부담한다.

사용자가 지적한 검사 공백도 확인됐다. 최신 native 성능 검사의 `list-warm`은 **새 row mount/unmount가 0이어야 통과**하는 작은 왕복이다. 먼 항목 진입 검사는 별도로 있지만 `jumpTo` 사이에 대기·drain을 넣는다. 따라서 **새 항목 진입/퇴장 + 연속 입력 + 프레임 마감 시간**이 겹치는 사용자 동작에 대한 수락 검사가 빠져 있다.

이번 Core 제스처 진단에서는 80px씩 24회 이동할 때 매 프레임 **Element 74개 생성·74개 해제**가 발생했다. 작은 왕복은 frame p95 **3.018ms**, 새 행을 통과하는 전진은 **16.773ms**, 역방향 재방문은 **12.096ms**였다. 이 수치는 **Node V8 + CanvasKit의 계측된 Core CPU 결과**다. Windows Static AOT의 물리 트랙패드·실제 표시 시간을 이번에 측정한 것은 아니다.

원인 우선순위는 다음과 같다.

| 우선순위 | 원인/조건 | 근거 수준 |
|---|---|---|
| 1 | lazy 항목 진입 때 subtree 생성·layout·퇴장 해제가 한 프레임에 집중 | 현재 코드와 이번 Core 진단으로 확인. 기존 native 계측에서도 entry layout 지연 관찰 |
| 2 | 새 문단 측정, text/style snapshot 및 객체 생성 비용 | 이번 profile·문단 호출 수로 확인. 개별 연산의 AOT self time은 미확정 |
| 3 | 갤러리는 row보다 큰 section 전체를 생성하고 일반 section을 퇴장 시 해제 | 현재 코드로 확인. 갤러리별 정확한 native 시간은 추가 측정 필요 |
| 4 | AOT의 대부분 경로가 동적 JS 의미를 유지하여 위 비용이 남음 | 현재 패키지 정책과 기존 엔진 비교로 확인 |
| 5 | 연속 입력 처리와 긴 JS 프레임의 중첩, precision 경로의 접촉·관성·fallback 특성 | 관련 구조 확인. 물리 입력에서의 기여도는 미확정 |
| 6 | 가변 높이 section의 측정 후 offset 보정·재layout | 코드상 가능한 추가 비용. 발생 횟수·기여도는 미측정 |

## 2. 조사 기준과 실행본

실행 스크립트는 기본값 `Engine=hermes`에서 `prepare:native → build --hermes-mode static-aot --configuration Release --hermes-profile optimized → run`을 수행한다. `-RefreshSdk`를 지정해야 SDK 빌드·패키지 공급·runner 재설치까지 수행한다.

이번 확인 시 현재 Release는 다음 상태였다.

| 항목 | 확인값 |
|---|---|
| 실행 모드 | `hermesExecutionMode=static-aot`, `optimized`, x64 Release |
| AOT metadata | `mode=static-native-aot`, `wholeAppNativeAot=true`, `typePolicyAccepted=true` |
| 원본 callable native 분류 | native 40,632 = typed 19 + dynamic 40,613; unclassified 0 |
| 타입 선택 정책의 별도 분모 | callable 31,398 중 specialize 19 / dynamic 31,379 |
| 접근성 설정 | runner `app-config.json`의 `accessibilityEnabled=false` |
| EXE SHA-256 | `3138524c517cf980edc0b27c8ee80dc4e74ebffedcce4057b66dbd36f7f71432` |
| AOT DLL SHA-256 | `2e055c4cdb8a2e1a3c4c23bfc84a817d793b206a7696c6170feb1dbc4ce364dd` |
| Hermes DLL SHA-256 | `c6e57ac68ad43a6073c3e159efbf273197f6b41a297c8b75c9fc1364202a9d5c` |

세 binary의 SHA는 현재 `nelyx-package.json`과 일치했다. native coverage와 타입 정책은 서로 다른 분모이므로 두 callable 수를 합치지 않는다. 이 metadata 확인은 이번 실행의 실제 함수 hit/fallback audit을 대신하지 않는다.

설치본의 `SkiaView.h`, `WindowsPrecisionTrackpad.h`, `TextInputSkiaSurface.h`는 저장소와 bytewise 일치했다. Core의 sliver/고정 extent/section list/viewport/root 5개 dist 파일도 설치본과 일치했다. 해당 Core 소스 5개와 앱 `list-view.ts`·`gallery.ts` 2개의 SHA는 현재 AOT 타입 정책에 기록된 입력 SHA와 일치했다. 전체 공급망을 다시 수락한 검사는 아니다.

[work15a.md §9](work15a.md#9-성능과-채택-판정)는 현재 **기능·전체 native AOT 수락과 별도로 `performanceAccepted=false`**를 기록한다. 아래의 기존 native 결과는 그 문서의 이전 비교 image/fixture 결과이며, 위 현재 DLL의 신규 성능 실측값으로 재사용하지 않는다.

## 3. 왜 작은 애니메이션은 괜찮고 긴 스크롤은 끊기는가

### 3.1 항목을 통과할 때 layout 안에서 새 트리를 동기 생성한다

핵심 경로는 다음과 같다.

```text
pointer/drag → ScrollPosition 변경 → viewport.markNeedsLayout
→ FrameworkRoot.build → PipelineOwner.flushLayout
→ RenderSliverFixedExtentBoxAdaptor / RenderSliverSectionList.performLayout
→ _createOrObtainChild → SliverMultiBoxAdaptorElement.createChild
→ delegate.build → reconcile/mount/build → RenderObject attach/layout
→ 문단 측정 → paint/scene 구성 → finalizeTree/unmount → frame 제출
```

- [viewport.ts](Nelyx/src/framework/rendering/viewport.ts)의 `offsetChanged`는 offset 변경을 layout 무효화로 연결한다.
- [sliver-fixed-extent-list.ts](Nelyx/src/framework/rendering/sliver-fixed-extent-list.ts)의 `performLayout`은 새 cache 범위의 child를 `insertAndLayoutChild`로 즉시 생성·측정한다.
- [sliver.ts](Nelyx/src/framework/widgets/sliver.ts)의 `createChild`는 `owner.buildScope` 안에서 `delegate.build`와 child reconciliation을 수행한다. 이 때문에 **layout span 안에 Widget build 시간도 포함**된다. `Widgets.flushBuild`만 측정하면 lazy build 비용을 놓친다.
- [sliver-multi-box-adaptor.ts](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts)의 `collectGarbage`는 퇴장한 일반 child를 `removeChild`로 넘긴다. [root.ts](Nelyx/src/framework/widgets/root.ts)는 프레임 종료에 `finalizeTree`를 실행하며, 로컬 subtree는 조건에 따라 더 일찍 해제한다.

`ListViewPage`에는 이미 `itemExtent:80`과 lazy builder가 있다. 먼 offset 계산은 고정 extent를 사용한다. 현재 병목 후보는 **목적지에 필요한 행의 하위 트리 생성·측정·해제 비용**이다. 한 행도 ListTile·텍스트·아이콘·Ink·focus·semantics·keep-alive 등의 하위 owner를 갖는다.

반면 [repaint-boundary.ts](Nelyx/src/framework/rendering/repaint-boundary.ts)는 내용이 유지되는 boundary의 recording을 재사용한다. 인디케이터 tick이나 이미 구성된 라우트의 이동은 이 이점을 받을 수 있다. 스크롤로 **새 항목이 필요해지는 순간**에는 그 항목의 최초 build/layout/recording이 필요하다. RepaintBoundary는 Widget 생명주기나 최초 문단 측정을 생략하지 않는다.

### 3.2 갤러리는 section 전체가 lazy 생성 단위다

[gallery.ts](sample/nelyx-testbed-app-2/src/gallery.ts)의 `ListView.builder`는 `GallerySection` 하나를 만들고, 그 안에서 해당 데모의 control 묶음을 구성한다. [cupertino-gallery.ts](sample/nelyx-testbed-app-2/src/cupertino-gallery.ts)도 같은 방식이다. 복잡한 section이 들어오면 작은 control 여러 개의 생성·측정이 같은 프레임에 몰릴 수 있다.

[gallery-section.ts](sample/nelyx-testbed-app-2/src/gallery-section.ts)의 `wantKeepAlive`는 editor section에만 켜져 있다. 일반 section은 cache 범위를 벗어나면 해제되므로 역방향으로 돌아와도 생성 비용을 다시 낸다. `SectionExtentIndex`는 **높이·anchor 정보**를 유지하고, 해제된 Widget/Element 전체를 보존하지 않는다.

기본 cache는 [viewport.ts](Nelyx/src/framework/rendering/viewport.ts)의 양쪽 **250 logical px**다. 이는 필요한 child를 결정하는 layout 범위이며, 남는 프레임 시간에 분산해서 사전 생성하는 작업 큐가 아니다. 큰 delta에서는 새 cache 범위의 복수 child를 한 번에 만들 수 있다. cache를 늘리면 최초 생성량·메모리도 증가하므로, 숫자를 키우는 것만으로 해결됐다고 판단할 수 없다.

### 3.3 새 문단과 immutable snapshot 비용이 반복된다

행에는 title/subtitle과 양쪽 아이콘이 있다. 새 RenderParagraph는 `TextPainter.layout → Paragraph.layoutWithReplacement → context.text.layout` 경로를 거친다. 이번 연속 진입 검사에서는 **24회 이동당 text layout API 96회**가 발생했다.

[text-layout-cache.ts](Nelyx/src/hosting/text-layout-cache.ts)에는 이미 문단 cache가 있다. idle resident 한도는 64개·1MiB이고 별도 indexed 한도는 128개다. key에는 text·폭·style·폰트 catalog 등이 들어가며, 각 행의 고유 title과 폭/테마 변화는 재사용 조건을 달리한다. cache hit여도 새 Widget/Element 생성과 스타일 해결·입력 snapshot 등의 작업은 남는다.

이번 진단에서 전진 text API 합계는 **46.957ms**, 역방향은 **5.216ms**로 줄었지만, 역방향도 Element 생성·해제는 각각 **1,776회**였다. 문단 재사용과 warm 상태가 유리해져도 subtree 생명주기 비용이 남는다는 증거다. 이 진단은 cache hit/miss를 직접 집계하지 않았으므로 그 비율은 추정하지 않는다.

기존 CPU profile을 이번에 한 번 실행했을 때 `freezeRunStyle`, `protect`, ancestor 탐색, `freezePaintCommand`, render attach/detach, paragraph layout 등이 조사점으로 나타났다. 이들은 여러 프레임에 걸친 Node sampling 결과다. 특정 함수 하나를 AOT의 확정 주범으로 지목하거나 inclusive 시간을 합쳐 전체 시간으로 해석하지 않는다.

### 3.4 Static AOT에서도 동적 객체 작업은 남는다

현재 image는 전체 실행 코드를 native로 공급하지만 타입 특화는 정책상 검증된 scalar body 19개에 한정된다. 대부분의 Widget/class/collection/callback은 **같은 Hermes VM의 dynamic-native** 경로다. Map/Set·속성 접근·prototype 호출·객체 할당·immutable descriptor/snapshot·GC가 자동으로 정적 구조체 연산으로 바뀌는 것은 아니다.

따라서 AOT 전환이 최초 진입·재방문 frame을 없애지 못하는 것은 현재 코드 구조와 일치한다. 타입 특화 수를 늘리는 작업과, 한 프레임에 만드는 트리/문단/recording의 양을 줄이는 작업은 따로 평가해야 한다.

### 3.5 긴 JS frame과 입력 mailbox가 겹칠 수 있다

[runtime.ts](Nelyx/src/hosting/runtime.ts)의 `queuePointer`는 Windows의 move/hover/wheel/panZoomUpdate를 다음 owned tick까지 모은다. mailbox는 최대 256 packet이며 `flushPointerInput`은 batch의 **각 이벤트를 순서대로 dispatch**한다. 이미 입력 batching과 frame 예약은 구현되어 있다.

그러나 batching은 긴 layout을 프레임 예산에 맞춰 나누지 않는다. JS에서 긴 동기 build/layout/teardown을 수행하는 동안 후속 JS 입력 처리는 기다릴 수 있다. 밀린 packet 처리에는 hit test·gesture·scroll notification 비용도 따른다. 이 중첩이 실제 precision 입력에서 얼마나 생기는지는 queue 길이·oldest packet age·프레임 시간을 함께 측정해야 한다.

현재 frame token에는 마지막으로 dispatch한 입력의 timestamp가 남는다. 기존 `latest-input-to-surface`는 **최신 입력과 matching surface 사이의 지연**이므로, 같은 묶음의 가장 오래 기다린 입력이나 모든 입력의 지연을 대표하지 않는다. frame CPU만 빨라졌거나 마지막 offset이 맞았다는 이유로 입력 체감까지 수락할 수 없다.

### 3.6 precision trackpad는 synthetic wheel과 경로가 다르다

[WindowsPrecisionTrackpad.h](Nelyx/skia/packages/rn/native/windows/WindowsPrecisionTrackpad.h)는 DirectManipulation을 manual update하며 `panZoomStart/Update/End`를 만든다. OS inertia는 취소 관찰에 쓰고 framework physics가 momentum을 담당한다. native payload는 [SkiaView.h](Nelyx/skia/packages/rn/native/windows/SkiaView.h)의 `windowsPointer`와 SDK [input.ts](Nelyx/sdk/src/backends/react-native/input.ts)를 거쳐 Core drag recognizer로 들어간다.

precision capability 생성 실패 시 [TextInputSkiaSurface.h](Nelyx/sdk/native/windows/TextInputSkiaSurface.h)는 native wheel fallback을 유지한다. `SkiaView.wheel`은 precision이 접촉/관성을 소유할 때 해당 trackpad wheel을 억제한다. 따라서 실제 기기에서는 다음을 구분해야 한다.

- precision 사용 여부와 실제 수신한 `panZoom*`/wheel 종류.
- 접촉 중 연속 진입과 손을 뗀 뒤 ballistic 구간.
- 접촉 재시작·inertiaCancel·방향 반전 시 offset/velocity 연속성.
- native 수신→JS dispatch→offset 적용→surface→실제 표시의 지연.

이번에는 물리 장치의 이 경로를 계측하지 않았다. 중복 입력·관성 문제·fallback 전환이 발생한다고 확정할 증거도 없다. 다만 wheel 검사 통과만으로 이 경로를 수락하는 것은 범위가 맞지 않는다.

### 3.7 가변 높이 section은 측정 후 추가 layout이 가능하다

[sliver-section-list.ts](Nelyx/src/framework/rendering/sliver-section-list.ts)는 추정 높이로 찾은 section을 실제 측정한 뒤 anchor offset 차이를 `scrollOffsetCorrection`으로 반환할 수 있다. `RenderViewport.performLayout`은 correction/content dimension 수락까지 layout을 반복한다. 새 복잡한 section이 등장하는 프레임에는 이 보정이 비용을 더할 가능성이 있다.

반복 횟수를 이번에 측정하지 않았으므로 확정 병목으로 분류하지 않는다. 고정 80px ListView에서도 진입 비용이 재현되었으므로 section 높이 보정만으로 전체 현상을 설명할 수는 없다.

## 4. 기존 native 수치와 이번 확인 결과

### 4.1 work15a에 기록된 이전 native 측정

2026-10-23의 18회 비교는 기능/trace/종료 검사가 통과했고 **성능 채택은 실패**했다. 다음은 [work15a.md §9](work15a.md#9-성능과-채택-판정)의 수치이며 재측정값이 아니다. 단위는 ms, CPU는 callback wall time이다.

| 엔진/창 | loaded warm p95 | 먼 첫 진입 p95 | 재방문 max |
|---|---:|---:|---:|
| V8 기본 | 5.16 | 109.37 | 108.85 |
| V8 최대화 | 6.04 | 111.88 | 102.71 |
| Static AOT 기본 | 11.05 | 187.07 | 206.23 |
| Static AOT 최대화 | 14.36 | 214.21 | 265.73 |

별도 기본창 AOT 계측 1회의 주요 span은 다음과 같다. 각 열은 inclusive이고 중첩될 수 있다.

| phase | Frame CPU p95 | Root.build p95 | layout p95 | paint/compose p95 | workerRender p95 |
|---|---:|---:|---:|---:|---:|
| list-warm | 11.970 | 8.733 | 0.505 | 2.233 | 3.628 |
| list-entry-cold | 184.551 | 183.074 | 145.432 | 8.436 | 3.529 |
| list-entry-revisit | 163.495 | 162.303 | 125.608 | 6.711 | 3.439 |

이 비교에서는 entry 지연의 우선 조사 대상이 Core layout/lazy build다. worker span은 GPU timestamp가 아니며, 실제 긴 트랙패드 스크롤에서의 GPU 병목 여부까지 배제하지 않는다.

### 4.2 이번에 실행한 bounded Core pan 진단

현재 Core/Material dist와 앱 소스를 사용했다. viewport는 **487×464.5 logical / scale 2**, 접근성은 비활성이다. 실제 `ListViewPage`에 Core `panZoom*` 이벤트를 전달하고 다음 세 구간을 각각 24 update씩 한 번 검사했다.

| 구간 | offset 시작→종료 | frame p50 / p95 / max(ms) | layout p95(ms) | Element mount / unmount | text API 호출 |
|---|---|---:|---:|---:|---:|
| loaded ±0.4px 왕복 | 400→400 | 1.925 / 3.018 / 3.164 | 0.272 | 0 / 0 | 0 |
| 80px씩 전진 | 400→2,320 | 9.727 / 16.773 / 17.491 | 10.087 | 1,776 / 1,776 | 96 |
| 80px씩 역방향 | 2,320→400 | 7.471 / 12.096 / 15.968 | 6.867 | 1,776 / 1,776 | 96 |

전진·역방향은 각각 1,920px를 이동했고 24개 프레임 모두 새 subtree가 생성됐다. 매 update마다 Element 74개가 생성됐다. 생성·해제 호출 수는 전체 하위 Element 수이며 row 1,776개를 뜻하지 않는다. 이 작은 표본에서는 **진입이 발생하는 조건 자체가 작은 왕복과 다른 비용 분포를 만들었다.**

측정 범위: **Node V8 + CanvasKit, CPU only, 함수 wrapper 계측 포함, 각 update 뒤 동기 frame 실행**이다. 이벤트 timestamp는 가상 시간 16ms씩 증가시켰으며 실제 OS가 16ms 간격으로 전달한 부하가 아니다. native event queue, RNW, Hermes AOT, GPU submit/present/scanout과 물리 입력은 포함하지 않는다. 60Hz의 16.67ms·120Hz의 8.33ms 예산과 대조할 조사 근거이며 제품 FPS 수락값은 아니다.

기존 opt-in `ListView CPU profile separates fixed-extent row entry from retained frames`도 1회 PASS했다. 20,000→60,000→20,000→0 seek의 진단 시간은 **115.947 / 123.710 / 83.118 / 68.423ms**, text layout 호출은 총 176회였다. inspector와 접근성 기본 설정을 포함한 별도 profile이므로 위 표와 절대 시간을 직접 비교하지 않는다.

두 검사 모두 **20분 timeout**을 적용했다. 임시 Core pan fixture는 실행 종료 후 삭제했고 별도 profile/log/archive는 보관하지 않았다. 초기 fixture 준비 실패 표본은 측정에서 제외했다.

## 5. 기존 검사가 사용자 동작을 놓치는 정확한 이유

1. **현재 주 native 부하는 의도적으로 항목 경계를 피한다.** [windows-animation.tsx](Nelyx/eng/tests/windows-animation.tsx)의 `research-engine`은 `wheelSweep(...,-1,240,16)`으로 24 packet마다 방향을 바꾼다. 기본 3-line 설정에서 native 변환은 `1/120×48=0.4px`, 반왕복 최대 범위는 약 **9.6px**다. row 높이는 80px이고 `mount/unmount=0`을 요구한다. 이벤트 240개라는 숫자가 큰 이동 범위를 뜻하지 않는다.
2. **먼 진입 검사도 존재하지만 독립 seek다.** `list-entry-cold/revisit`는 20,000·60,000·0으로 `jumpTo`한 뒤 `delay(100)`과 `drainWheelRendering`을 수행한다. 진입 CPU spike를 관찰할 수 있지만, 여러 화면을 통과하는 접촉·관성 입력과 긴 frame의 중첩은 측정하지 않는다.
3. **다른 기존 모드의 이동 폭은 다르다.** 일반 `NELYX_ANIMATION_WHEEL_INPUT` 경로는 `wheelDelta` 설정에 따라 더 멀리 이동할 수 있다. 모든 기존 검사를 작은 이동이라고 일반화하지 않는다. 다만 W15A의 주 성능 비교와 문서화된 warm 지표는 위의 loaded-row 부하다.
4. **검사 PASS와 성능 수락이 분리돼 있다.** [windows-research-results.mjs](Nelyx/eng/tests/windows-research-results.mjs)의 `researchResult`는 유효한 시간 분포·기능·native 수명·audit 등을 확인한다. entry frame이 100~200ms라는 이유로 그 자체가 실패하지는 않는다. `work15a`의 최종 성능 판정은 별도로 FAIL이다.
5. **surface 완료와 화면 표시가 다르다.** 기존 입력 지연은 matching surface token 기준이며 코드에도 `displayed=unobserved`라고 기록한다. 표시 간격·missed refresh·최장 정지·연속 jank frame과 물리 precision 동작은 그 PASS 범위에 포함되지 않는다.
6. **기존 Core precision 회귀는 짧다.** [gallery.test.mjs](sample/nelyx-testbed-app-2/tests/gallery.test.mjs)의 precision 회귀는 두 gesture 각각 60px update 두 번이다. 실제 drag recognizer 연결은 검증하지만 긴 진입·퇴장 성능 검사는 아니다. native `windows-precision` 회귀 역시 `physicalInput=unobserved`를 명시한다.

## 6. 후속 조사·수정의 우선순위

### 먼저 검사 부하와 수락 기준을 보완한다

- **경계를 넘는 연속 스트림**: 고정 80px ListView와 실제 Material/Cupertino 전체 갤러리에서 각각 최소 여러 viewport를 지나 전진·역방향·재방문한다. 각 스트림에 실제 mount/unmount와 새 항목 노출이 있었는지 필수 확인한다. 최대화도 포함한다.
- **속도와 delta 분포**: 작은 연속 delta, 보통 이동, 빠른 이동을 구분하고 여러 packet을 모아 받는 상황도 다룬다. 프레임마다 drain/고정 대기를 삽입하는 seek 검사와 연속 검사를 별도로 둔다. 4ms 입력은 이전 delivery 실패 이력이 있으므로 실제 수신량·합산 거리·누락을 확인한 표본만 사용한다.
- **전체 입력 경로**: synthetic wheel, Core pan fixture, 실제 precision 접촉/관성의 증거를 구분한다. 물리 trackpad는 현재 Release에서 별도 확인한다.
- **조건별 시간**: `mount>0`, `unmount>0`, text cache miss, 재방문, 완전 retained frame별 p50/p95/p99/max를 따로 낸다. `layout` 안의 lazy build와 `finalizeTree` 시간도 분리한다.
- **체감 지표**: oldest/latest native input age, JS mailbox 길이, offset 적용 지연, surface 간격과 실제 표시 간격을 대응시킨다. 60/120Hz 예산 초과 수, 50/100ms 이상 정지, 연속 jank 길이를 판정한다. 전체 평균으로 entry spike를 희석하지 않는다.
- 필요한 소수의 동일 조건 표본으로 확인하고, 각 실행은 20분 timeout·임시 산출물 finally 정리를 유지한다.

### 그 결과로 구현 범위를 좁힌다

1. **새 subtree 생성/해제 단가**: `SliverMultiBoxAdaptorElement.createChild/removeChild`, row build, inherited/theme 탐색, attach/detach, reconciliation·snapshot 비용을 native AOT에서 attribution한다. 현재 per-child 정렬·active sibling 재동기화도 후보지만, 활성 child는 bounded이므로 이 부분만 주원인이라고 단정하지 않는다.
2. **최초 문단 작업과 반복 wrapper 비용**: 같은 폭/폰트/스타일의 안정된 데이터 재사용 범위를 확인한다. text hit와 새 트리 생성량을 동시에 줄이는 방향을 평가하며, 캐시/owner 수명·글자/테마 정확성을 유지한다.
3. **갤러리 section의 작업 크기**: 한 section이 가진 control subtree 크기와 첫 노출 frame을 측정한다. 더 작은 lazy 단위 또는 제한된 재방문 보존·예산 기반 사전 준비가 필요한지 판단한다. 전체 1,000행 keep-alive나 무제한 문단 cache는 검증 없는 해결책으로 채택하지 않는다.
4. **한 프레임의 일감과 입력 지연**: prefetch/cache 조정 시 같은 frame의 새 mount 수·메모리·최장 정지를 함께 본다. correctness가 필요한 child admission과 독립적으로 미뤄도 되는 일을 구분한다. mailbox 병합은 hit target·방향 반전·nested scroll 의미를 보존하는 범위에서 검토한다.
5. **precision·높이 보정**: 앞선 비용을 분리한 뒤 DM fallback/관성·correction 횟수와 지연의 상관을 확인한다. 사용자 환경의 wheel/panZoom 실제 분기를 먼저 확인한다.

## 7. 아직 확정하지 않은 범위

- **물리 트랙패드의 최종 원인별 비중과 표시 FPS는 `notVerified`**다. 이번 결과는 가장 유력한 공통 CPU 경로를 좁힌 것이며 단일 함수의 native 원인을 확정한 것은 아니다.
- 현재 접근성 설정은 false다. 이 실행본의 증상 해결을 접근성 비활성화만으로 설명할 근거가 없다. 접근성을 켠 별도 구성에서는 semantics geometry/전송 비용도 함께 측정한다.
- 이전 native 계측의 workerRender는 entry/warm 모두 약 3.4~3.6ms였고 entry Core layout이 훨씬 컸다. 우선순위는 Core지만, 실제 큰 화면·많은 새 recording에서의 GPU/driver/scene import 비용은 별도 계측이 필요하다.
- allocation/GC는 생성량과 함께 확인할 항목이다. 이번 Core profile에 GC sample은 있었으나 물리 끊김과 GC pause의 직접 대응은 측정하지 않았다.
- 이 문서는 원인 조사와 검증 보완 방향을 기록한다. 제품 코드·실행 스크립트·기존 검사 프로그램의 수정과 성능 개선 수락은 수행하지 않았다.
