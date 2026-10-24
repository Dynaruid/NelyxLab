# work6 — Flutter 참조 대비 Nelyx 프레임워크·위젯·플랫폼 완성 계획

**CLOSED / SUPERSEDED — 2026-10-12 KST.** 사용자 요청에 따라 이 계획의 실행을 종료하고, 남은 범위와 진행 방식을 [work7.md](work7.md)로 이관한다. 구현 결과는 **PARTIAL**이며 전체 기능 완료를 뜻하지 않는다. 아래 중단 기록·수락 증거·체크포인트는 당시 상태 그대로 보존한다. 후속 작업의 순서와 검증 주기는 work7을 따른다.

**중간 마무리 — 2026-10-12 KST, 사용자 요청: PAUSED/PARTIAL.** 현재 시점에서 구현을 중단하고 기존 코드·패키지·검증 증거를 보존했다. 전체 W6 완료가 아니다. 아래 ACTIVE 표기는 중단 전 실행 이력이며 현재 goal 상태는 일시정지다. 재개 기준은 `.tmp/work6/pause-checkpoint.json`과 이 문서 마지막의 중간 마무리 기록이다.

**최근 선정 수락 PASS — 플랫폼 채널·broadcast/default binding·SDK retirement:** Basic/Method/Optional/Event·typed lazy cast·profiling·broadcast 수명과 SDK 종료/retired proxy 해제를 구현했다. 원본 채널498+버퍼483 groups·실제 SDK65+owner120 expectations 및 이전 serialization/진단/frame 회귀가 fresh ESM/types·3 first-import orders·Metro·Windows Hermes source/optimized HBC99에서 PASS다. core0.9.0/SDK0.11.0·provider/CLI/template/lock·6개 공급을 반영했다. coverage5,100 reviews/5,153 refs·40 envelopes이며 이전39개와5,035 hashes를 그대로 보존했다.119개 선정 source 중118개를 adapted로 채택하고 native update 선언1개는 missing으로 남겼다. 최종 archive2,667 files·Android2,656·외부1,141 bytes/listing PASS다. built-in native/DOM transport와 W6 나머지는 남아 전체 ACTIVE/PARTIAL이다. 인계는 `.tmp/work6/platform-channels/checkpoint.json`·`resume-progress.md`다.

**직전 foundation serialization·message/method codecs 선정 수락 PASS:** ReadBuffer/WriteBuffer와 Binary/String/JSON/Standard codec을 구현하고 실제 frame encoder·nullable-message 예외 보고에 연결했다. 원본4 units/15 spans·3 modes1,116 groups와 오류 진단21 groups, 실제 오류 연결144 expectations·frame61 cases/510 expectations/222,848 bytes가 PASS다. 기존 platform291/basic-print1,602/diagnostics567 groups·FrameworkRoot126·SDK bootstrap/cache30도 emitted3 first-import orders·fresh ESM/types·Metro·Windows Hermes source/optimized HBC99에서 PASS다. core0.8.0/SDK0.10.0·provider/CLI/template/lock·6개 runner 공급을 반영했다. coverage4,982 reviews/5,035 refs·39 envelopes이며 이전38개를 보존했다. 최종 archive2,627 files·Android2,616·외부1,101 files byte/listing PASS다. 전체 W6는 ACTIVE/PARTIAL이며 `.tmp/work6/foundation-serialization/checkpoint.json`과 아래 최신 실행 기록을 따른다.

**이전 foundation platform·conditional import 선정 수락 PASS:** 실제 native/Web 플랫폼 정책·debug override·브라우저 OS/UA lazy cache를 core/SDK에 연결했다. 도구의 conditional import 누락을 고쳐 구현 의존성154개를 추가했으며 기존74143개 선언의 hash/공개 여부와 공개 분모47282개를 유지했다. inventory74297개 전체 cache roundtrip PASS다. 원본3 units+browser10 spans·3 modes291 groups, 기존1602+567 groups·FrameworkRoot126·SDK bootstrap/cache30 expectations가 fresh ESM/types·Metro·Windows Hermes source/optimized HBC99에서 PASS다. core0.7.0/SDK0.9.0·provider/CLI/template/lock·6개 runner 공급을 반영했다. coverage4858 reviews/4911 refs·38 envelopes이며 이전37개를 보존했다. 최종 archive2602 files·Android2591·외부1076 files byte/listing PASS다. 전체 W6는 ACTIVE/PARTIAL이며 `.tmp/work6/foundation-platform/checkpoint.json`과 아래 최신 실행 기록을 따른다.

**이전 foundation basic-types·print·조건부 오류 출력 선정 수락 PASS:** CachingIterable의 공유 cache/파생 iterator, callback/Factory, host-duration 보간과 실제 출력 owner·throttling/wrapping/completion·IO/Web dumper를 구현했다. SDK bootstrap은 provider identity로 console branch를 선택한다. 원본5 units/30 spans·IO/Web×3 modes1,602 groups와 기존 diagnostics567 groups·FrameworkRoot126 expectations·bootstrap16 expectations, emitted3 import orders·fresh ESM/types·Metro·Windows Hermes source/optimized HBC99가 PASS다. core0.6.0/SDK0.8.0·provider/CLI/template/lock·6개 runner 공급을 반영했다. coverage4841 reviews/4895 refs·37 envelopes이며 이전36개를 보존했다. 최종 archive2592 files·Android2581·외부1066 files byte/listing PASS다. 전체 W6는 ACTIVE/PARTIAL이며 아래 최신 실행 기록과 `.tmp/work6/foundation-basic-print/checkpoint.json`을 따른다.

**이전 diagnostics 잔여 source·패키지 수락 PASS:** callback 타입·불변 object sentinel·tooltip/cache helper·numeric-base lazy·private parse/helper/field/type 대응을 보완했다. isInteresting의 lazy 실행 순서와 FIFO 참조 해제/compaction/drain을 고쳤다. 원본3 modes567 groups·실제 FrameworkRoot126 expectations·emitted3 import orders·fresh install/types/Metro/Windows Hermes source/optimized HBC99 PASS다. diagnostics source missing/partial0(합성 enum constructor3개는 compiler 호출 거부 근거로 분류), coverage4773 reviews/4828 refs·36 envelopes이며 이전35 envelope/selected destination을 보존했다. core0.5.0/SDK0.7.0·provider/CLI/template/lock·6개 runner 공급, archive2582 files·Android 설치2571·외부 설치1056 byte/listing PASS다. CLI owned native archive의 반복 hash suffix 문제도 고쳐 실제 설치본으로 재공급 검증했다. 전체 W6는 ACTIVE/PARTIAL이다.

**최근 선정 묶음 — 오류 보고·ErrorWidget·앱 기본 font (2026-10-12):** 실제 component/LayoutBuilder fallback·BuildScope 계속 실행·structured error/stack·emergency paragraph lease·명시적 defaultFont를 구현했다. 원본 Dart312 groups, actual FrameworkRoot21 tests/138 expectations와 binding10 expectations, SDK/root/fixture/tool/CLI/외부 types, fresh installed core0.3.0/SDK0.5.0 및 Metro/Windows Hermes source/HBC99 PASS다. coverage4533 reviews/4579 source refs이며 이전33 evidence envelope를 보존했다. core/SDK version·provider/schema·CLI/6개 template 이행을 반영했다. 전체 diagnostics/text/native 수락과 W6 나머지는 남아 **전체 goal은 active/PARTIAL**이다. 상세 기록은 9절 최신 묶음을 따른다.

**최근 완료한 선정 묶음 — LayoutBuilder·OrientationBuilder (2026-10-12):** 실제 layout callback·격리 BuildScope·constraints/config/dependency 재빌드·deferred State·skipped ancestor 갱신과 child build 실패 복구를 구현했다. 원본 Dart106 groups·actual FrameworkRoot22 tests/83 expectations·SDK/root/fixture/tool/installed types·fresh installed core·Metro/Windows Hermes source/HBC99 PASS다. coverage4309 reviews/4353 source hash references를 현재 소스에 재검토했고 이전32 evidence envelope를 보존했다. ErrorWidget·intrinsic 검사 모드·전체 diagnostics·sliver와 나머지 W6 작업은 남으며 **전체 goal은 active/PARTIAL**이다. 상세 증거와 이번 묶음 정리는 9절 최신 기록을 따른다.

**최근 완료한 선정 묶음 — Visibility·IndexedStack (2026-10-12):** 모든 box visibility maintain 정책·공통 inherited scope·선택 child render 경로, Stack Clip4와 실제 GlobalKey 이동 보정을 구현했다. 원본881 groups·framework22 tests/200 expectations·fresh installed core·Metro/Windows Hermes source/HBC99 PASS. coverage4246 reviews/4275 source hash references이며 전체 W6 수락은 PARTIAL이다. SliverVisibility·diagnostics·retained layers·native overlay visual hide와 나머지 W6 작업은 남는다. 상세 증거·정리 상태는 9절 최신 기록을 따른다.

**실행 현황 — 2026-10-11 KST:** W6 전체 작업 진행 중(`PARTIAL`). exact Flutter pin·resolved inventory·이식 도구와 GlobalKey/inherited·foundation/scheduler/Ticker·ParentData/slot·측정/layout family·scalar Paint/Canvas·Opacity·CustomPaint·Canvas/framework full 4×4 변환·Flow·Path draw/clip·CustomClipper/rect·oval·full corner ClipRRect·Radius/Rect/RRect·OffsetBase/Offset/Size·BorderRadius·rounded Canvas/Path·vector_math64 Vector/Matrix/Quaternion·AlignmentGeometry/Directional과 RTL 연결의 선정 범위를 구현했다. geometry getter dispatch와 semantics/scroll/text의 실제 Rect 캡처 회귀를 수정하고 Transform rotate/translate/scale/flip factory 및 RenderShiftedBox/RenderAligningShiftedBox·PositionedBox/Stack의 geometry/direction 보존을 연결했다. EdgeInsets 전체 CPU API·RenderPadding geometry/RTL·Stack 생성자 보정과 overflow render 4종/widget 5종의 sizing·constraint·cache·clip 연결도 구현했다. BoxFit 7종·FittedBox/RotatedBox의 layout/paint/hit/semantics와 생성자 상태 순서도 보정했다. FractionalTranslation·Offstage·IgnorePointer·AbsorbPointer의 실제 render/widget 경로와 navigation legacy Offstage를 원본 동작에 연결했다. TickerMode의 inherited enabled/forceFrames·State provider와 실제 View forced-frame 요청도 연결했다. 전체 API/플랫폼 수락 완료가 아니며 현재 증거와 다음 경계는 **9절 실행 기록**에 남긴다.

작성일: **2026-10-11 KST**. 검토 기준: Nelyx HEAD `70af83df1dfec17d0004cfb5fa1c0caaee0ed3d0`, `work5.md`, 현행 제품 소스·package exports·README, 로컬 `reference/flutter-master/`의 실제 소스.

**검토 결론: W5는 선정한 기능으로 공유 Widget 화면을 만드는 단계까지 완료했고, Flutter에 대응하는 전체 프레임워크를 완성한 상태는 아니다.** 기존 기능의 의미를 넓히고, 공통 rendering·text·input·sliver·앱 시스템을 보강한 다음, Material·Cupertino의 전체 대상 API와 6개 플랫폼 코드 구성, Windows·Android·Web의 제품 수락까지 이어 가야 한다. 위젯 이름만 추가하거나 현재의 단순 조합을 그대로 늘리는 것으로는 이 차이가 해소되지 않는다.

**범위 조정 — 2026-10-11 사용자 결정:** Linux와 Apple(iOS·macOS)은 코드를 구성하되 플랫폼 검증은 생략한다. 코드 구현 범위는 유지하고 해당 target의 native build·실행·입력/IME·접근성·성능·서명/배포 검증은 `SKIPPED (사용자 지정)`로 기록한다. 이 생략은 합의한 W6 범위의 완료를 막지 않으며, 해당 플랫폼의 지원 검증 완료를 뜻하지 않는다.

이 문서는 **작업계획**이다. 이번 작업에서는 구현·native build·기기 수락을 새로 수행하지 않았다. W5 실행 기록은 과거의 범위별 증거로 참조하며, 그 안의 작업 지시를 이번 구현 실행 요청으로 취급하지 않는다. 착수 시 working tree는 clean이고 `work6.md`는 빈 파일이었다. 루트 `.github/copilot-instructions.md`와 저장소 제품 경로의 별도 `AGENTS.md`는 없었다.

## 1. 실제 비교에서 확인한 차이

### 1.1 규모와 출처

| 영역 | 로컬 Flutter의 `.dart` 파일 | Nelyx의 해당 `.ts` 파일 | 해석 |
| --- | ---: | ---: | --- |
| foundation | 41 | 7 | Nelyx는 `src/foundation/`; notifier·key 외의 기반과 서비스 의미를 추가 검토해야 함 |
| scheduler / animation / physics | 5 / 8 / 7 | 1 / 2 / 2 | scheduler·ticker·숫자 tween·일부 simulation의 선정 구현 |
| gestures | 27 | 2 | arena와 TapDragRecognizer 중심 |
| painting / rendering | 48 / 49 | 2 / 3 | 제한된 paint command와 RenderBox 중심 |
| semantics | 5 | 1 | 제한된 role/action의 트리 snapshot |
| services | 53 | 같은 이름의 framework 폴더 0 | 편집·clipboard 등 일부 계약은 `ui/`, `hosting/`, SDK에 있으므로 서비스 전체 부재를 뜻하지 않음 |
| widgets | 188 | 14 | 공통 트리와 기본 위젯·선정 앱 시스템 |
| material | 198 | 1 | 실제 Widget class 6개와 `showDialog` 함수 |
| cupertino | 52 | 1 | 실제 Widget class 7개와 theme 값 |

파일 수는 해당 경로 아래의 소스 파일을 재귀 집계한 값이며 **API 수나 구현률이 아니다.** Flutter의 private 구현·theme·generated 코드와 Nelyx의 합쳐진 모듈이 섞여 있으므로 파일 수로 백분율을 계산하지 않는다. Nelyx `src/framework/`는 총 29개 TS 파일이고 core public subpath는 49개다.

현행 `Nelyx/upstream/framework-imports.json`은 Doroti revision `d8d1e1796bcaf7be33361afdc0dc3b6cef627fea`의 **24개 selection**을 기록한다. `automatic`은 Tolerance 1개, `reviewed-port`는 23개다. 이 manifest는 현재 이식 출처이며 Flutter 전체 지원 목록이 아니다. Bun 도구도 범용 Dart/C#→TS 변환기가 아니다.

로컬 Flutter에는 `.git`이 없어 exact upstream commit은 **미확정**이다. 비교 snapshot의 `packages/flutter/lib/src/`에는 Dart 파일 684개가 있다. 식별용 합성 SHA256은 `31aa3b78409e94fce5417e0774b170cf02288ed42aec2b5e07d8dc45728fa2a1`이다. 계산은 상대 POSIX 경로순으로 각 파일의 `경로 + NUL + 파일 SHA256 + LF`를 연결한 UTF-8 bytes의 SHA256이다. 이는 로컬 내용 식별자이며 commit 증거가 아니다. W6-00에서 이식용 exact source pin을 별도로 확보한다.

### 1.2 이름이 있어도 아직 부족한 의미

이 표에서 `framework/`, `foundation/`, `ui/`로 시작하는 제품 경로의 기준은 `Nelyx/src/`다.

| 현재 확인한 제품 소스 | 구현된 범위 | 완성까지 필요한 차이 |
| --- | --- | --- |
| `framework/widgets/framework.ts`, `foundation/key.ts` | Widget·Element·State·InheritedWidget, sibling key reconciliation | GlobalKey registry·같은 프레임 reparent·activate/finalizeTree, 폭넓은 context/dependency 의미. 현재 key 탐색과 중복 검사는 큰 sibling 묶음에서 반복 선형 탐색을 사용 |
| `framework/rendering/object.ts`, `boxes.ts` | RenderBox·constraints·Flex·Stack·기본 hit test | 일반 RenderObject/ParentData 계약, dry/intrinsic/baseline layout, Positioned·Wrap·Table·custom layout, relayout/compositing 경계 |
| `ui/types.ts`, `framework/painting/context.ts` | rect/rrect/image/paragraph, 직사각형 clip, affine transform | Path·stroke·gradient·border·shadow·opacity·saveLayer·filter·shader·4×4 transform와 대응 backend 재생 |
| `framework/widgets/repaint-boundary.ts` | 최대 4096 command의 JS 명령 목록 캐시 | layer tree·compositing·GPU raster cache와 구별해야 함. 현재 구현을 Flutter compositing 완성으로 기록할 수 없음 |
| `framework/widgets/basic.ts`, `painting/text-painter.ts` | 단일 스타일 Text, 고정 크기 asset Image, 실제 paragraph 측정 | RichText/InlineSpan/WidgetSpan·TextStyle·font fallback·selection·image provider/stream/cache·애니메이션 이미지 |
| `framework/gestures/recognizers.ts`, `ui/input.ts` | tap/drag, 기본 pointer·wheel·key | 독립 recognizer·double/long/secondary tap·scale·velocity 추정·gesture team·trackpad pan/zoom·pressed key 상태 |
| `framework/widgets/scroll.ts` | clamping, 세로 page scroll, 고정 extent LazyList | 일반 SliverConstraints/SliverGeometry·가변 높이·grid·mixed sliver·page·nested·reorder·2D. 현재 private RenderSliverList도 RenderBox를 상속 |
| `framework/widgets/focus.ts`, `root.ts` | View 내 평면 FocusScope와 semantics 목록 기반 기본 Tab/activate | 계층 focus tree·scope/traversal policy·focusable canvas control·키 전파/handled 의미·focus highlight |
| `framework/widgets/editable-text.ts`, SDK interaction | 여러 native editor session, revision·Android composing/geometry 관측 | 공통 RenderEditable·서식/다중 행/선택/undo/autofill·모든 target의 실제 IME. native overlay의 clip/transform/paint order도 해결 필요 |
| `framework/widgets/navigation.ts` | push/pop 결과, Offstage 보존, 기본 Overlay·focus 복원 | Pages/Router·URL/deep link·restoration·route animation/gesture·modal barrier·nested navigation·예측 Back |
| `framework/widgets/app-data.ts` | 소수 색·radius의 ThemeData, 메시지 dictionary·방향·기본 metrics | Material/Cupertino token·WidgetState·typography·동적 색·전체 locale delegate·플랫폼 환경 변화 |
| `framework/material/widgets.ts` | MaterialApp·Scaffold·FilledButton·TextField·ListTile·AlertDialog | MaterialApp은 theme/locale 래퍼, Scaffold는 기본 Column 조합. Material/Ink·button state·app bar/drawer/snackbar·폼·picker·메뉴·표 등이 없음 |
| `framework/cupertino/widgets.ts` | Theme·Button·NavigationBar·PageScaffold·TextField·ListTile·AlertDialog | CupertinoApp, route/back gesture·tab/sliver navigation·switch/slider/picker·sheet/context menu·동적 theme 등 |

`Nelyx/README.md`도 GlobalKey reparent, intrinsic sizing, flex baseline, variable-height list, full design-system parity, restoration/deep link, state-preserving hot reload를 미지원으로 명시한다. README의 범위 설명과 위 소스가 일치한다.

### 1.3 플랫폼 증거의 현재 경계

| Target | 현재 문서·소스에서 확인한 출발점 | W6에서 새로 닫아야 할 항목 |
| --- | --- | --- |
| Web | W5의 Chrome WebGL2 화면·자동화 입력·resize·Fast Refresh remount/정리 기록 | 확장 연산·편집·접근성·browser history·context loss·실제 사용자 입력 |
| Windows | RNW/Hermes/Graphite-Vulkan x64 Release UI·자동화·정상 close 기록 | stock Core full reload, composing/direction/geometry, Narrator·실제 IME·failure/loss recovery |
| Android | x86_64 emulator Release의 공유 화면·tap/drag·native editor 기록 | 최신 ARM64 물리 기기·한국어 composing/후보창·TalkBack·lifecycle·서명 배포 |
| iOS / macOS | runner와 source integration | SDK/native port·Metal·입력/접근성·lifecycle·runner/배포 설정 코드 구성. 플랫폼 검증은 사용자 지정 `SKIPPED` |
| Linux | supplier/binding compile, GTK4/X11/Graphite-Vulkan 구성 | GTK host·Vulkan·입력/IME·AT-SPI·종료·runner/배포 설정 코드 구성. 플랫폼 검증은 사용자 지정 `SKIPPED` |

이 표의 현재 결과는 W5 및 README에 기록된 범위다. 이번 계획 작성에서 runtime을 재실행하지 않았으며, provider qualification은 현행 SDK 문서처럼 `notVerified`로 둔다. 과거 Deno 경로나 삭제된 검증 체계를 현행 작업의 선행 조건으로 되살리지 않는다.

## 2. W6의 완성 범위와 판정 방식

### 2.1 최종 목표

**고정한 Flutter 참조의 공개 UI 기능을 TypeScript API로 제공하고, Windows·Android·Web·iOS·macOS·Linux의 코드를 구성하며, Windows·Android·Web에서 해당 기능의 layout·paint·input·semantics·lifecycle·배포를 확인하는 것**을 이번 W6의 최종 목표로 삼는다. 사용자 결정에 따라 Apple/Linux는 구현 대상에 포함하고 플랫폼 검증 대상에서 제외한다.

1. **프레임워크 기능 완료:** foundation, scheduler, animation, physics, gestures, painting, rendering, semantics, services, widgets, Material, Cupertino의 대상 공개 선언과 필요한 내부 의존성을 모두 대응한다. `packages/flutter_localizations/`의 기본 UI 문구·locale delegate와 `characters`/`vector_math` 같은 공개 의존성의 필요한 의미도 포함한다. 표에 예시로 열거하지 않은 API도 W6-00 inventory에서 누락 없이 작업에 배정한다.
2. **제품 완료:** 기능 완료와 6개 target의 코드 구성에 더해 Windows·Android·Web의 실제 실행·물리 입력/IME/reader·성능·수명·production 배포·외부 소비가 수락돼야 한다. Linux·iOS·macOS의 플랫폼 검증은 사용자 지정 `SKIPPED`로 닫으며 환경 확보를 기다리는 미완료 관문으로 남기지 않는다.
3. **개발 경험 완료:** 직접 module API·예제·오류 정보·template·개발 갱신·패키징이 사용자 환경에서 이어져야 한다. Flutter와 같은 이름의 facade만 제공하는 것으로 충족하지 않는다.

Dart VM·Dart ABI·pub plugin의 무수정 실행, Flutter engine/Impeller의 그대로 복제, Dart 문법과 TS 문법의 일치는 목표에 포함하지 않는다. 대신 Flutter의 사용자에게 보이는 기능과 상태 수명은 비교한다. platform channel도 Nelyx의 타입 계약을 제공하며 Dart plugin binary compatibility를 약속하지 않는다.

| Target | 코드 구성 | 플랫폼 검증 |
| --- | --- | --- |
| Windows·Android·Web | 공통 framework·SDK/native 또는 DOM port·renderer·runner/template·배포 설정 | 이번 W6에서 수행 |
| iOS·macOS | 같은 기능의 Apple SDK/native·Metal·UIKit/AppKit 연결·runner/template·서명/배포 설정 | `SKIPPED (사용자 지정)` |
| Linux | 같은 기능의 GTK/RNL·Vulkan·입력/접근성 연결·runner/template·배포 설정 | `SKIPPED (사용자 지정)` |

생략 범위에는 target 전용 compile/native build, simulator/device/display 실행, UI 자동화, GPU·물리 입력·IME·reader·성능/복구, 실제 서명·설치·clean-machine 확인을 포함한다. 공통 core/SDK의 TypeScript typecheck·ESM/declaration build에 해당 TS source가 포함되는 것은 유지하지만 이를 Apple/Linux 플랫폼 검증으로 집계하지 않는다. Apple/Linux용 별도 검증 환경·harness를 만들거나 실행하지 않는다. 설정/연결을 빈 stub으로 대체하는 것은 코드 구성 완료가 아니다.

### 2.2 공개 API 대조표를 먼저 만든다

W6-00에서 작은 유지보수용 명세 **`Nelyx/upstream/flutter-coverage.json`**을 추가한다. 현재 존재하는 파일이 아니라 예정 산출물이다. 채택 source를 기록하는 `framework-imports.json`과 목적을 구분하고, 둘 사이에는 중복 구현 목록 대신 stable ID로 연결한다. 별도 report tree/dashboard/checkpoint 체계는 만들지 않는다.

- 범위 추출은 Flutter `packages/flutter/lib/`의 실제 public library export, `show/hide`·conditional export·외부 의존성을 해석한다. `lib/src/`의 모든 class를 public API로 집계하지 않는다. resolved analyzer/IR로 선언 identity를 확보하고 TS는 compiler API로 실제 export·상속·member를 확인한다.
- 단위는 class명만이 아니라 **생성자·옵션·method/property·상태 전이·오류·dispose·platform 조건**이다. typedef/function/enum/mixin/extension 및 필요한 private 의존성도 추적한다. 거대한 icon 상수군은 파일 hash·생성 규칙·대표 glyph 확인으로 관리한다.
- 각 항목은 `upstream library + qualified symbol + source span/hash`, Nelyx 실제 구현 module/member, dependency, W6 작업 ID, API 차이·근거, 아래 상태와 target별 확인을 가진다.
- 구현 상태는 `missing / partial / implemented / adapted / notApplicable`로 둔다. `adapted`에는 TS 문법/host 대응 이유와 보존한 동작을 적는다. 기능이 빠진 alias·기본값 반환·빈 method는 `partial/missing`이다.
- 확인은 구현 상태와 독립된 `PASS / PARTIAL / FAIL / SKIPPED / notVerified`다. ESM/Metro/Hermes, 화면, 입력, IME, reader, 성능, 배포를 따로 기록한다.
- Linux·iOS·macOS의 플랫폼 확인 항목에는 `SKIPPED`와 `사용자 지정: 코드 구성만 수행`이라는 이유를 남긴다. provider qualification은 실제 증거가 없으므로 `notVerified`를 유지한다. 검증 생략을 구현의 `notApplicable`이나 확인 `PASS`로 바꾸지 않는다.
- deprecated API는 replacement와 호환 정책을 정하고 낮은 순서로 처리한다. private/debug/VM 전용·6개 target 밖의 platform 전용 항목은 이유를 적어 분류한다. 단순히 어렵거나 비용이 크다는 이유로 `notApplicable`을 사용하지 않는다.
- 원래 전체 대상에 있던 기능을 뺄 때는 scope 변경과 이유를 문서에 드러낸다. 미완료를 자동으로 새 범위 밖으로 옮겨 완료율을 높이지 않는다.

**종료 조건:** mandatory 항목의 `missing/partial`과 의존성 미연결이 0이고, `adapted/notApplicable`에 근거가 있으며, Windows·Android·Web의 요구 수락이 모두 끝나야 합의한 W6 범위 완료다. Apple/Linux는 코드 구성 완료와 사용자 지정 `SKIPPED` 기록을 요구하며 플랫폼 미검증은 완료 차단 조건에서 제외한다. P0나 대표 위젯 수락만 끝나면 그 milestone만 완료한다. W6 완료 후에도 Apple/Linux를 포함한 6개 플랫폼 검증 완료로 안내하지 않는다.

## 3. 구현 원칙과 반자동 이식 방식

기존 `@nelyx/core`는 플랫폼 독립 UI·상태·layout 계약, `@nelyx/sdk`는 플랫폼 composition·native service, `Nelyx/skia/`는 paint/text/GPU 실행·retirement, runner는 등록·Metro/Babel·native build를 담당한다. 공통 앱·진입점은 `src/`, 플랫폼 등록은 `<target>/runner/`에 유지한다. RN/Hermes/native Graphite와 Web CanvasKit/Ganesh/WebGL2를 현행 기준으로 삼는다.

- framework는 Widget 설정 → Element/State → RenderObject → layer/frame의 책임을 지킨다. View별 트리·focus·scroll·editing 소유권을 AppSession의 공유 asset/resource 수명과 섞지 않는다. Flutter의 framework/engine/embedder 분리는 이 경계의 근거다. [Flutter architecture](https://docs.flutter.dev/resources/architectural-overview)
- 공통 알고리즘·위젯은 core에서 구현한다. Material/Cupertino가 자체 hit test·scroll·editing 시스템을 복제하거나 앱이 RN/Skia/native 자원을 직접 조립하게 하지 않는다.
- 새 기능은 실제 책임별 구현 파일과 직접 public subpath로 제공한다. `material/widgets.ts`, `cupertino/widgets.ts`, `widgets/basic.ts`를 무제한 키우지 않는다. re-export barrel을 만들지 않으며, 기존 경로 변경은 package version·migration·sample/template와 함께 처리한다.
- primitive 확장은 core 타입만 추가하고 끝내지 않는다. validation/serialization·byte budget·resource 열거·JSI/native/Web replay·ABI/cohort·packaged source를 함께 연결한다. 미지원 연산의 조용한 생략은 금지한다.
- 화면에서 제거한 resource와 제출된 frame의 lease는 별개다. layer/image/paragraph/shader를 GPU retirement/drain 이전에 해제하지 않는다. resize·native context·surface·renderer 세대와 이전 callback 차단을 유지한다.
- Nelyx 작성 코드는 BSD-3-Clause를 유지하고 Flutter/Doroti/폰트/이미지/decoder 유래 notice를 보존한다. 앱의 build/runtime에 Bun·.NET·Dart analyzer·다른 저장소 checkout을 요구하지 않는다.

반자동 이식 도구는 **`tools/Nelyx.FrameworkToTypeScript/`의 독립 Bun/TS 프로젝트**를 계속 사용한다. C# reviewed-port를 재사용할지 Flutter Dart를 직접 입력으로 삼을지는 symbol별로 선택한다. 하나의 동작을 양쪽에서 생성해 중복 제품 코드로 채택하지 않는다. 원본 의미는 pin한 Flutter를 기준으로 다시 확인한다.

**사용자 승인된 도구 수정 범위:** W6 작업 중 필요하면 `tools/Nelyx.FrameworkToTypeScript/`를 수정·확장할 수 있다. 분석 frontend/Roslyn helper·IR/lowering·TS emitter·변환 규칙·symbol/port 매핑·CLI·설정/개발 의존성·Bun lock·README 등 이식에 필요한 변경을 포함한다. 이 권한은 W6-01에 한정하지 않고 이후 모든 구현 단계에 적용하며, 필요한 도구 수정을 위해 별도 승인을 다시 요청하지 않는다. 실제 이식 묶음과 함께 개선하고 결과를 확인하되, 범용 변환기 완성을 제품 구현의 선행 조건으로 만들지 않는다. 제품 source 자동 덮어쓰기 방지와 앱/runtime의 도구 의존성 분리 원칙은 유지한다.

현재 도구의 단순 class lowering, 선택별 전역 symbol명 중복 제한, `.tmp/work5/` 고정 출력, inheritance/generic/async의 수동 검토 범위를 먼저 보강한다. 여러 library의 동명 symbol은 qualified ID로 구분한다. Dart 입력이 필요한 실제 묶음에서 resolved frontend를 연결하며 ApolloVM 실행을 이미 검증한 것처럼 취급하지 않는다. 도구 완성률보다 **분석 → 초안 → 의미 보완 → 제품 연결 → 실제 소비 → 채택** 사이클을 완료하는 것이 우선이다.

## 4. 단계별 실행 작업

계획 작성 시점에는 **모든 W6 구현 작업이 TODO**였다. 현재 체크 상태와 9절 실행 기록을 함께 확인한다. 각 작업은 scope 확정·구현·필요한 동작 확인·package 반영·임시 구성 정리를 포함한다. 예시 symbol 목록은 출발점이며 전체 대상 목록은 W6-00의 inventory를 기준으로 한다.

**이하 모든 작업의 플랫폼 적용 규칙:** 코드 구성은 6개 target에 적용하고, 실제 확인·측정·native build·배포 수락은 Windows·Android·Web에 적용한다. Apple/Linux 관련 실제 확인은 공통 기능 작업에 포함돼 있어도 `SKIPPED (사용자 지정)`로 처리한다. Cupertino 공통 위젯도 Windows·Android·Web에서 확인하고 Apple 고유 runtime 수락은 생략한다.

### W6-00 — 참조 pin·전체 차이·API 계약 확정

- [x] 현재 diff·W5 인계·README·provider·exports를 재확인하고 변경을 보존한다. 로컬 Flutter 비교 hash와 이식용 upstream commit을 구분해 exact source·license·선택 파일 hash를 확보한다.
- [ ] 모든 public library와 member의 coverage inventory를 만들고 각 차이를 W6-01~30에 배정한다. `widget_previews`, inspector/debug, deprecated·conditional export와 `dart:ui`/외부 package 의존성도 분류한다.
- [ ] `packages/flutter_localizations/lib/`와 `engine/src/flutter/lib/ui/ui.dart`의 필요한 UI primitive를 추가로 대조한다. 1절의 파일 집계와 완성 범위의 의존성 집계를 구별한다. target별 OS/browser·아키텍처·display backend·기기·locale 지원 범위를 명시한다.
- [ ] coverage와 작업의 검증 대상을 Windows·Android·Web으로 고정하고, Linux·iOS·macOS의 플랫폼 검증은 사용자 지정 `SKIPPED`로 표시한다. 코드 구성 대상 6개와 검증 대상 3개를 분리한다.
- [ ] TS options object·named constructor·value equality·generic token·async cancellation·공개 module/version 정책을 정한다. 이미 있는 API도 full/partial/adapted 여부를 member 단위로 판정한다.
- **수락:** 원본과 목적지·의존성·상태·작업 ID가 연결되고 분모/예외가 명시된다. 현재 snapshot hash만 있는 상태를 source provenance 완료로 판정하지 않는다.

### W6-01 — 반자동 도구를 실제 위젯 묶음에 확장

- [ ] 최초 도구 확장뿐 아니라 W6 후속 단계에서 필요한 `tools/Nelyx.FrameworkToTypeScript/`의 수정·기능 추가·오류 수정을 해당 이식 작업과 함께 수행한다. 재사용할 규칙·매핑·설정·lock·사용법을 갱신하고 일회성 초안과 구별한다.
- [ ] selection identity·source language/repository/pin을 확장하고 inheritance·generic·constructor·enum·collection·callback·override를 필요한 묶음부터 분석/변환한다. C# syntax/semantic에는 Roslyn, Dart resolved symbol에는 실제 선택한 analyzer 경로를 사용한다.
- [ ] `.tmp/work6/<stage>/` 등 소유 scratch를 안전하게 허용하고 path/link·fresh output·hash 검사를 유지한다. 제품 source 자동 overwrite와 unsupported의 `any`/빈 본문 대체를 막는다.
- [ ] 수치 기반·Element/State 기반·design widget 조합의 3개 대표 묶음으로 비용과 의미 차이를 확인한다. 원본 갱신 한 묶음에서 old/new draft와 reviewed TS 비교도 수행한다.
- **수락:** 실제 채택된 모듈이 ESM 및 Metro/Hermes에서 소비되고, 수동 수정이 갱신 비교에서 보존된다. parser/typecheck 성공과 의미 보존을 구별한다.

### W6-02 — foundation·환경·scheduler·service 기반

- [ ] notifier/listenable·diagnostics/error·value/identity·collection 보조를 public inventory에 맞춰 보강한다. Dart/CLR runtime 전체를 TS helper로 복제하지 않는다.
- [ ] frame phase·transient/persistent/post-frame·ticker·lifecycle·visibility·warm-up/deferred first frame 등 필요한 binding 의미를 기존 host tick 위에 연결한다. timestamp·microtask·취소 순서를 명시한다.
- [ ] typed service port의 capability/error·AppSession/View ownership과 재접속/종료 계약을 정한다. text scale·brightness·locale·padding/inset·accessibility 설정의 live change를 전달한다.
- **수락:** 재진입·listener 해제·frame 병합·hidden/resume·close 이후 callback·여러 View 격리가 관찰한 순서대로 동작한다.

### W6-03 — Widget·Element·State·Key 의미 완성

- [ ] GlobalKey/GlobalObjectKey registry, inactive subtree, activate/deactivate/finalizeTree와 같은 프레임 reparent를 구현한다. State/context/render attachment와 focus/editor/ticker 소유권을 함께 옮긴다.
- [ ] keyed/unkeyed child diff·slot·RenderObjectElement/ParentDataWidget를 보강한다. sibling 규모에 따라 반복 전체 탐색이 커지는 경로를 개선하고 안정된 identity를 유지한다.
- [ ] InheritedNotifier/InheritedModel/InheritedTheme, dependency 등록/제거·didChangeDependencies, context lookup·mounted 및 async 사용 오류를 대응한다.
- **수락:** reorder/insert/remove·부모 간 이동에서 State가 필요한 경우 유지되고 duplicate key·잘못된 render parent·dispose 후 갱신이 진단된다. 이전 subtree의 dependency/registration이 남지 않는다.

### W6-04 — RenderObject·layout·기본 배치 위젯

- [ ] 일반 RenderObject와 RenderBox/향후 RenderSliver 경계를 정하고 parent data·layout/paint/compositing dirty·relayout boundary·dry layout·intrinsic·baseline을 구현한다.
- [ ] BoxConstraints·directional alignment/insets·Flex의 main/cross/baseline·Stack/Positioned·Wrap·Table·ListBody·Flow·CustomSingle/MultiChildLayout를 구현한다.
- [ ] Center/Container/ConstrainedBox/LimitedBox/UnconstrainedBox·AspectRatio/FittedBox/FractionallySizedBox·Baseline/IntrinsicWidth/Height·OverflowBox·LayoutBuilder/OrientationBuilder·Visibility/IndexedStack/RotatedBox 등 공통 배치 API를 채운다.
- **수락:** bounded/unbounded·RTL·text scale·intrinsic 순환/비용·parent data 오류·resize에서 geometry와 hit test가 일치한다. Text의 bounded-width 제한을 무조건 부모에게 전가하는 현행 제약을 해소한다.

### W6-05 — Canvas·paint 연산·layer·compositing

- [ ] Paint/Path·fill/stroke·cap/join·anti-alias·clip path/rrect·gradient/shader·blend/color/image filter·opacity/saveLayer·shadow·4×4 transform/perspective를 소비 위젯 순서로 확장한다.
- [ ] layer tree·retained layer·repaint/compositing boundary·leader/follower·clip/transform/opacity/effect layer를 구현하고 CompositedTransformTarget/Follower·CustomPaint·ClipRRect/Oval/Path·Opacity·BackdropFilter/ImageFiltered 등과 연결한다.
- [ ] core frame/resource 계약과 `Nelyx/skia/packages/web/src/library.ts`, RN/JSI, `Nelyx/skia/native/`의 실제 재생 경로를 함께 수정한다. raster cache에는 byte 상한·eviction·context loss 재생성을 둔다.
- **수락:** 중첩 clip/opacity/filter·shape·perspective의 실제 pixels와 inverse hit test가 일치하고 cache eviction/실패/retirement가 안전하다. 명령 목록 재사용과 GPU cache 효과를 따로 측정한다.

### W6-06 — text·typography·font·선택 가능한 본문

- [ ] TextStyle/TextHeightBehavior/StrutStyle/TextScaler·InlineSpan/TextSpan/WidgetSpan·RichText/DefaultTextStyle·TextPainter의 caret/range/baseline/intrinsic/overflow 의미를 구현한다.
- [ ] locale/direction·ligature·bidi·grapheme/word/line boundary·색상 emoji·fallback chain·font feature/variation·package-qualified icon font를 실제 font 공급·SkParagraph/CanvasKit와 연결한다.
- [ ] 기본 font 선택을 앱/SDK의 정식 설정과 fallback에 연결하고 현재 Text의 `sample-font` 기본 asset 이름 의존을 해소한다. 외부 소비 앱이 sample 내부 이름을 알아야 하는 구조를 남기지 않는다.
- [ ] SelectionContainer/SelectionArea/SelectableRegion·SelectableText·selection gesture·toolbar·copy·semantics를 구현한다. WidgetSpan의 layout/hit test/selection도 범위에 넣는다.
- **수락:** 한국어·혼합 RTL·결합 문자·emoji·font 교체·큰 배율에서 실제 paragraph geometry와 painted text/선택이 일치한다. sample font 하나의 결과를 전체 glyph coverage로 확대하지 않는다.

### W6-07 — image·asset·decoration

- [ ] AssetBundle/ImageProvider/ImageStream/ImageCache에 대응하는 typed asset 공급, 비동기 decode·취소·중복 요청 병합·eviction·오류/placeholder를 구현한다. asset/network/memory/file은 target 권한과 capability를 명시한다.
- [ ] 해상도별 asset·BoxFit/alignment/repeat·filter quality·nine-patch에 해당하는 기능·다중 frame 이미지·FadeInImage/ImageIcon/DecorationImage를 연결한다.
- [ ] Color/ColorScheme의 표현 계약, Border/BorderRadius/ShapeBorder·BoxDecoration/ShapeDecoration·gradient·shadow를 W6-05 paint로 구현한다.
- **수락:** decode 실패·동시 소비·마지막 consumer 제거·animation pause/resume·메모리 압력·GPU 재생성에서 자원이 유한하게 유지되고 현재 frame의 lease를 보존한다.

### W6-08 — pointer·gesture·mouse·trackpad

- [ ] pointer router/converter·hit-test behavior·capture/cancel·device/buttons·enter/exit/hover·pressure·pointer signal resolver·mouse cursor를 지원 target의 native/DOM 입력과 연결한다.
- [ ] Tap/DoubleTap/LongPress/SecondaryTap·axis별 drag/pan·Scale·MultiDrag·gesture team·velocity tracker 및 gesture settings/slop을 구현한다. trackpad pan/zoom·wheel 단위·modifier와 touch 경쟁을 다룬다.
- [ ] RawGestureDetector/MouseRegion/AbsorbPointer/IgnorePointer·TapRegion·Draggable/DragTarget/LongPressDraggable 등 공통 입력 위젯을 연결한다.
- **수락:** child/parent recognizer 경쟁·여러 pointer·cancel/resize·제거된 target·pen/trackpad에서 callback 순서와 승자가 정의돼 있고 tap이 scroll 뒤에 잘못 실행되지 않는다.

### W6-09 — focus·keyboard·actions

- [ ] 계층 FocusManager/FocusScope/FocusNode·traversal group/policy·reading/ordered/directional traversal·skip/canRequestFocus·autofocus·focus restoration을 구현한다.
- [ ] Focus/FocusScope/FocusableActionDetector/KeyboardListener·Actions/Shortcuts/Intent·logical/physical key·pressed set·repeat/synthesized event·modifier·handled/ignored 전파를 연결한다.
- [ ] canvas button/list/menu/slider도 native editor와 같은 focus tree에 참여하게 하고 focus ring·platform highlight strategy·modal focus trap을 적용한다.
- **수락:** Tab/Shift-Tab/화살표/Enter/Space/Escape, nested scope·삭제·disabled·route 복귀에서 시각 focus·native focus·reader focus의 정책이 일관된다.

### W6-10 — RenderEditable·폼 편집·실제 IME

- [ ] 공통 editing value/delta·TextEditingController·RenderEditable를 중심으로 text/caret/selection/hit test를 구현한다. native IME는 composition/keyboard/candidate와 플랫폼 서비스의 port로 연결한다.
- [ ] multiline/obscure/readOnly·input formatter·max length·keyboard/action·undo/redo·autofill·spell check/context menu·selection handle/toolbar/magnifier·scroll-to-caret를 구현한다.
- [ ] 현행 native TextBox/DOM input overlay는 전환 경로로 검토하되 clip/transform/opacity/z-order와 typography 차이를 닫는다. 전체 동작을 맞출 수 없는 native control 경로는 명시적 별도 기능으로 표시한다. 입력 proxy와 Skia 본문이 reader에 중복 노출되지 않게 한다.
- [ ] Windows·Android·Apple·Linux·Web의 composing 범위·anchor/focus·revision·caret screen geometry·focus/blur/remount·programmatic edit acknowledgement 계약과 native/DOM port 코드를 구성한다.
- **수락:** Windows·Android·Web에서 실제 한국어 조합/재변환·후보창·선택·emoji/RTL·붙여넣기·Next/Done·IME 중 route/resize·late event를 확인한다. Apple/Linux는 코드 구성까지 수행하고 실제 IME 수락은 `SKIPPED`다. ASCII 입력이나 synthetic composing만으로 IME PASS를 주지 않는다.

### W6-11 — animation·physics·전환 위젯

- [ ] Animation/AnimationStatus·controller bounds/repeat/fling/animateWith·취소 future·Tween/Animatable/Curve/Interval/Sequence·다양한 타입의 lerp·spring/friction/scroll simulation을 보강한다.
- [ ] AnimatedBuilder/ListenableBuilder/ValueListenableBuilder·implicit AnimatedContainer/Opacity/Padding/Align/Positioned/DefaultTextStyle/Size·TweenAnimationBuilder·AnimatedSwitcher/CrossFade·explicit transitions를 구현한다.
- [ ] TickerProvider/TickerMode·visibility·accessibility reduce motion·시간 배율과 controller 교체/해제를 공통 scheduler에 연결한다.
- **수락:** fake clock 수치/상태 순서와 실제 animation 화면을 각각 확인하고, 취소·hidden/resume·dispose에서 중복 ticker와 미해결 future가 남지 않는다.

### W6-12 — 일반 sliver·viewport·ListView/GridView

- [ ] SliverConstraints/SliverGeometry·Viewport/ViewportOffset·RenderSliverMultiBoxAdaptor·child manager·layout/paint/cache extent·scroll correction을 일반 계약으로 구현한다.
- [ ] 가변 높이 SliverList·fixed/prototype extent·SliverGrid·Padding/FillRemaining/FillViewport/ToBoxAdapter·sliver group·decorated/clip sliver와 CustomScrollView/ListView/GridView를 구현한다.
- [ ] item key 기반 재배치·AutomaticKeepAlive/KeepAlive·PageStorage·semantic index·cache budget·shrinkWrap/reverse/axis/center/anchor를 대응한다. 명시적 viewport 높이를 요구하는 현재 LazyList 제한을 해소한다.
- **수락:** 10,000개 가변 크기 데이터에서 전체 item을 먼저 만들지 않고, 앞 삽입/삭제·resize/text scale·jump/fling·keep-alive eviction 후 offset/State가 정책대로 유지된다.

### W6-13 — 고급 scroll·page·interactive widget

- [ ] ScrollPosition/Activity/Physics를 controller와 분리해 다중 position·driven/ballistic/hold·notification/metrics·PrimaryScrollController/ScrollConfiguration·clamping/bouncing을 보강한다.
- [ ] PageView/PageController·NestedScrollView·Scrollbar·RefreshIndicator 기반·persistent/pinned/floating/resizing header·SliverAppBar 지원·wheel/pan 경계 소비를 구현한다.
- [ ] AnimatedList/AnimatedGrid·ReorderableList·Dismissible·DraggableScrollableSheet·ListWheelScrollView·InteractiveViewer·TwoDimensionalScrollView/Viewport·TreeSliver를 inventory에 따라 완료한다.
- **수락:** inner/outer scroll·header와 refresh 경쟁·page snap·reorder 중 자동 scroll·2D cache·offscreen semantics에서 동작과 메모리 상한을 확인한다.

### W6-14 — WidgetsApp·Navigator·Router·Overlay·restoration

- [ ] WidgetsApp와 앱 root 환경·Navigator Pages/Route/TransitionRoute/PopupRoute·nested navigator·observer·Hero·route animation/interactive back을 구현한다.
- [ ] OverlayEntry/OverlayPortal·modal barrier·portal/follower 위치·dismiss/focus trap·route 유지/제거를 연결한다. dialog가 전체 배경을 칠하는 page 조합에 머물지 않게 한다.
- [ ] Router/RouteInformation/Parser/Delegate·URL/history/deep link·Back dispatcher/PopScope·Android predictive Back를 platform port로 연결한다.
- [ ] RestorationManager/Bucket/RestorableProperty·route/controller/form/scroll 상태의 serialize/restore·version 정책을 구현한다.
- **수락:** 외부 link로 cold start·history 앞/뒤·nested Back·취소된 pop·route 결과·재시작 복원에서 focus/editor/semantics/resource 수명이 일치한다.

### W6-15 — 공통 앱 위젯·폼·async·notification

- [ ] Builder/StatefulBuilder·FutureBuilder/StreamBuilder·Notification/NotificationListener·Inherited 계열·ValueListenableBuilder의 교체/취소/오류 의미를 채운다.
- [ ] Form/FormField/validation/save/reset/autovalidate·AutofillGroup·RawAutocomplete/RawMenuAnchor/RawRadio/RadioGroup·기본 tooltip/menu·Expansible 등 공통 모델을 구현한다.
- [ ] Icon/IconTheme·Placeholder·PreferredSize·SafeArea·MediaQuery의 세부 환경·layout/size notification·표준 debug/사용자용 보조 위젯을 inventory에 따라 완료한다.
- **수락:** async source 교체 후 늦은 결과를 버리고, form validation·reset·dependency 갱신·notification bubbling이 실제 위젯 수명과 맞는다.

### W6-16 — semantics·접근성·localization

- [ ] role/state/action·sort/traversal·merge/exclude/block·live region·route/focus·text selection·scroll extent·custom action을 필요한 native/DOM 모델로 확장한다.
- [ ] Android accessibility node·Windows UIA·Apple accessibility·Linux AT-SPI·Web DOM bridge를 연결하고 native editor와 중복 노출·늦은 action·가상화 항목 탐색을 해결한다.
- [ ] `packages/flutter_localizations/`의 대상 locale를 inventory에 포함하고 Localizations delegate·locale resolution·Material/Cupertino 기본 문구·숫자/날짜/시간/복수형·RTL·locale/scale/contrast/reduce motion 변경을 지원한다. 한국어/영어 예시 두 개를 전체 localization 완료로 집계하지 않는다.
- **수락:** TalkBack/Narrator와 Web의 선정 browser/reader에서 읽기·탐색·편집·scroll·modal 복귀를 실제 확인한다. Apple accessibility/VoiceOver·Linux AT-SPI/Orca는 bridge 코드 구성까지 수행하고 플랫폼 수락은 `SKIPPED`다. tree snapshot/자동화 노드 존재와 reader 수락을 구분한다. [Flutter accessibility](https://docs.flutter.dev/ui/accessibility)

### W6-17 — Material 기반·theme·앱 구조

- [ ] Material/Ink/InkWell/InkResponse·shape/elevation/surface tint·splash/highlight/focus/hover·WidgetState/WidgetStateProperty·ColorScheme/Typography/TextTheme·Theme extension/lerp를 구현한다.
- [ ] MaterialApp이 WidgetsApp/Navigator/Router·localization·theme mode·scroll behavior·action/focus·restoration과 연결되게 한다. 대상 snapshot의 Material 버전별 계약을 inventory에 기록한다.
- [ ] Scaffold/ScaffoldMessenger·AppBar/SliverAppBar·drawer/endDrawer·FAB·BottomAppBar·bottom/navigation bar·NavigationRail/Drawer·snackbar/banner/body/inset 배치를 구현한다.
- **수락:** light/dark·state·text scale·RTL·keyboard inset·drawer/snackbar/FAB/route 조합이 실제 theme token과 layout을 따른다. 색상 몇 개의 공통 Theme를 full Material theme로 집계하지 않는다.

### W6-18 — Material 기본 control·폼·피드백

- [ ] Filled/Elevated/Outlined/Text/Icon/FloatingActionButton의 style/state·ButtonStyleButton 계층을 구현한다. Checkbox/Radio/Switch/Slider/RangeSlider·Segmented/ToggleButtons·Chip 계열을 연결한다.
- [ ] TextField/InputDecorator/InputBorder/TextFormField·Dropdown/DropdownMenu/FormField·Autocomplete/SearchBar/SearchAnchor를 공통 편집·폼·popup 기반으로 구현한다.
- [ ] Card/Divider/ListTile/CheckboxListTile/RadioListTile/SwitchListTile·Badge/CircleAvatar·linear/circular progress·Tooltip·Material icons/animated icons를 채운다.
- **수락:** enabled/disabled/pressed/hover/focus/selected/error·keyboard/semantics·validation·controller 교체와 시각 상태를 확인한다. 모든 control을 단일 GestureDetector 조합으로 지원 처리하지 않는다.

### W6-19 — Material 복합 UI·picker·navigation

- [ ] Alert/Simple/Dialog·bottom sheet/modal sheet·PopupMenu/MenuAnchor/MenuBar/SubmenuButton·DatePicker/CalendarDatePicker/DateRangePicker/TimePicker를 구현한다.
- [ ] TabController/TabBar/TabBarView·DataTable/PaginatedDataTable/DataTableSource·ExpansionTile/Panel·Stepper·CarouselView·ReorderableListView·RefreshIndicator·About/License UI 등 남은 public family를 완료한다.
- [ ] 관련 ThemeData·localizations·selection toolbar·route transition·예측 Back·adaptive variant를 함께 구현한다. 데이터 테이블에 가상화가 필요한 경우 scroll/cache 정책을 명시한다.
- **수락:** 폼→picker→modal→tab/list/detail→Back의 실제 복합 흐름, large text/RTL·focus trap·reader·취소 결과·state restoration을 확인한다.

### W6-20 — Cupertino 기반·theme·navigation

- [ ] CupertinoApp/Theme/ThemeData/TextTheme·CupertinoDynamicColor·interface level·brightness/high contrast·icon font/theme·기본 localizations를 구현한다.
- [ ] CupertinoPageRoute/FullscreenDialogTransition·interactive edge-back·modal popup/dialog/sheet·CupertinoNavigationBar/SliverNavigationBar의 large title/collapse·page scaffold inset을 구현한다.
- [ ] CupertinoTabScaffold/TabBar/TabView·tab별 Navigator/keep-alive/focus 복원·CupertinoPageScaffold와 공통 Router/restoration을 연결한다.
- **수락:** Windows·Android·Web에서 공통 navigation transition/back gesture·safe area·keyboard·tab 복귀와 TS API의 선언된 동작을 확인한다. Apple 고유 UIKit/AppKit 연결 코드는 구성하고 실제 Apple runtime 수락은 `SKIPPED`다. 색/문구 변경만으로 Cupertino fidelity를 판정하지 않는다.

### W6-21 — Cupertino control·폼·picker·복합 UI

- [ ] Button·Checkbox/Radio/Switch/Slider·SegmentedControl/SlidingSegmentedControl·ActivityIndicator·TextField/SearchTextField/TextFormFieldRow·FormRow/FormSection을 구현한다.
- [ ] Picker/DatePicker/TimerPicker·AlertDialog/DialogAction/ActionSheet/ActionSheetAction·ContextMenu/Action·ListTile/ListSection/ExpansionTile·Scrollbar/SliverRefreshControl·sheet/menu 계열을 완료한다.
- [ ] text selection toolbar/magnifier·spell check·haptic·adaptive control·pressed/focus/high-contrast/dynamic color를 공통 service에 연결한다.
- **수락:** Windows·Android·Web에서 picker wheel/날짜 locale·여러 선택 상태·취소/확정·context menu·폼 편집/IME·접근성을 실제 흐름으로 확인한다. Apple용 port 코드는 구성하고 VoiceOver 등 Apple 플랫폼 검증은 `SKIPPED`다.

### W6-22 — 플랫폼 서비스·PlatformView·Texture

- [ ] clipboard·haptic/system sound·SystemChrome/Navigator·mouse cursor·asset/font·platform menu·restoration·text service와 typed platform message/channel/codec를 필요한 native/DOM port에 연결한다.
- [ ] PlatformViewLink/AndroidView/UiKitView 등 참조 기능에 대응하는 Nelyx platform-view factory·controller·외부 texture resource 계약, Web HtmlElementView·desktop native view/menu를 설계·구현한다.
- [ ] native view의 geometry·clip/transform·z-order·raster/native 교차 composition·입력/focus·접근성·resize·dispose/retirement를 분리해 지원한다. 살아 있는 native view를 snapshot으로 바꾸고 같은 기능으로 기록하지 않는다.
- **수락:** native view 앞뒤의 Skia UI, 실제 입력/IME·occlusion·resource 해제와 capability 오류가 확인된다. 생성 성공/채널 응답만으로 composition 완료를 주지 않는다.

### W6-23 — 개발 갱신·진단·inspector·preview

- [ ] 실제 tree/state/layout/paint/semantics·오류 cause/source span을 보여 주는 개발자 API와 inspector/overlay를 필요한 범위로 구현한다. Widget preview·debug paint·repaint/성능 overlay·service extension도 대상 inventory에 따라 대응한다.
- [ ] state-preserving reassemble의 type/key identity·State shape·controller/native lease 호환 조건과 remount/restart 경계를 구현한다. generated module/class identity와 Metro Refresh 처리를 함께 검토한다.
- [ ] native full reload/teardown, 특히 현행 stock RNW Core 문제를 재현하고 정식 공급 경로에서 해결한다. private patch를 기본 제품에 적용했다는 근거 없이 해결로 기록하지 않는다.
- **수락:** 수정→복원에서 state 유지 가능한 변경과 필요한 remount가 정책대로 동작하고, 이전 tree/editor/renderer/font가 정리된다. Web HMR delta 성공을 native full reload 수락으로 확대하지 않는다.

### W6-24 — 성능·budget·failure/loss recovery

- [ ] Windows·Android·Web의 대표 기기/refresh rate/화면별 frame budget을 정하고 build/layout/paint/raster/present를 나눠 측정한다. 60 Hz는 16.67 ms, 120 Hz는 8.33 ms를 frame interval의 기준으로 사용한다. Apple/Linux의 budget·복구 관련 코드와 설정은 구성하되 플랫폼 측정은 `SKIPPED`다.
- [ ] 큰 keyed tree·10,000 item 가변 목록·rich text/emoji·animation/filter·복수 editor/native view에서 p50/p95·missed frame·startup 첫 표시·메모리·입력 지연을 측정한다. cold process start와 first content/present를 구분한다.
- [ ] 현재 text 4096 UTF-16/128 lines/64 paragraph, live/cache item 256, paint cache 4096 command 등 제한을 workload와 lease 예산에 맞게 재설계한다. 상한을 없애거나 숫자만 키우지 않는다.
- [ ] decode/submit/asset/startup 실패·GPU/context loss·resize storm·background/resume·정상/비정상 close에서 세대·pending/accepted frame·drain·재생성을 확인한다.
- **수락:** 명시한 workload와 측정 구간의 p95가 목표 budget을 충족하고 반복 사용 뒤 자원이 안정된다. GPU submit/retire와 scanout/FPS를 같은 증거로 사용하지 않는다. 미관측 항목은 `notVerified`다.

### W6-25 — Web 제품 수락

- [ ] 확장 framework를 설치된 package의 sample/외부 앱으로 build/run한다. Chromium·Firefox·WebKit의 선정 지원 버전에서 CanvasKit/WebGL2·DPR·resize·font/image·history·clipboard·context loss를 확인한다.
- [ ] 실제 keyboard/pointer/touch·한국어 composition/selection/candidate·focus/scroll·DOM semantics/reader·page visibility·Refresh/dispose를 확인한다.
- **수락:** 공유 기능의 Web 대상 항목과 runtime·접근성·배포 수락이 모두 연결된다. browser engine이나 API 제한으로 불가능한 기능은 capability와 문서에 드러내고 전체 완료 조건에서 따로 판정한다.

### W6-26 — Windows 제품 수락

- [ ] 지원 아키텍처별 RNW/Hermes/Graphite-Vulkan 설치 앱에서 실제 창·DPI/다중 monitor·resize/minimize·mouse/keyboard/trackpad·native view/menu를 확인한다.
- [ ] 실제 한국어 IME·Narrator/UIA·clipboard·후보창/caret·native reload·GPU loss/복구·WM_CLOSE/drain·설치/업데이트/제거와 production 서명 공급을 확인한다.
- **수락:** x64 개발 PC 자동화 외의 지원 환경과 깨끗한 소비 환경에서 성공하고, 일반 UI 변경의 개발 갱신과 필요한 native restart/teardown이 정책대로 동작한다. 현행 stock Core full reload 실패가 남아 있으면 해당 수락은 미완료다. build 성공만으로 완료하지 않는다.

### W6-27 — Android 제품 수락

- [ ] 최신 ARM64 물리 기기와 선정 API/기기 계열에서 shared UI·Graphite/Vulkan·touch/fling·회전/분할 화면·background/resume·native view·memory pressure를 확인한다. x86_64 emulator는 별도 범위로 유지한다.
- [ ] Gboard 한국어·selection/candidate·autofill·hardware keyboard·TalkBack·predictive Back·edge-to-edge/insets·release 성능·production APK/AAB 서명/설치를 확인한다.
- **수락:** native snapshot과 실제 편집 결과·접근성·device lifecycle·배포가 일치한다. emulator tap/ASCII 입력을 물리 IME 수락으로 대체하지 않는다.

### W6-28 — iOS·macOS 코드 구성·플랫폼 검증 생략

- [ ] iOS·macOS 각각의 SDK application/surface/controls, native UIKit/AppKit·Hermes/Metal·text/input/view·window/lifecycle·drain 코드를 공통 framework 계약에 연결한다.
- [ ] 한국어 IME·selection/autofill·safe area·navigation/gesture·accessibility, macOS menu/window/trackpad에 필요한 native port·binding·capability·오류/종료 처리를 구성한다.
- [ ] provider/cohort·native source/patch·CLI·runner/template·Xcode project·signing/provisioning·archive/notarization 관련 공급·배포 설정을 구성한다. 실제 자격 증명·서명/배포 실행은 요구하지 않는다.
- **코드 완료 기준:** iOS와 macOS 모두 실제 구현·등록·호출·수명·package/runner 연결을 갖추고, 공통 기능 확장에 필요한 코드가 누락되거나 빈 stub으로 남지 않는다.
- **플랫폼 검증:** target 전용 compile/native build, simulator/device 실행, Metal/GPU·입력/IME·VoiceOver·성능/복구·서명/설치·clean-machine 확인은 모두 `SKIPPED (사용자 지정)`다. Apple 환경 확보를 이번 W6 완료의 선행 조건으로 두지 않으며 provider qualification은 `notVerified`를 유지한다.

### W6-29 — Linux 코드 구성·플랫폼 검증 생략

- [ ] 현행 GTK4/RNL/Hermes/Graphite-Vulkan X11 host의 window/surface·resize·input·text·native view·loss recovery·close 코드를 공통 framework 계약에 연결한다.
- [ ] IBus/Fcitx IME·AT-SPI·clipboard·키보드/마우스/trackpad·DPI·desktop menu에 필요한 native port·binding·capability·오류/종료 처리를 구성한다.
- [ ] provider/cohort·native source/patch·CLI·runner/template·CMake/GTK 설정·패키징/배포 코드를 구성한다. Wayland는 현재 X11에서 자동 지원으로 표시하지 않고 실제 구성한 경로만 명시한다.
- **코드 완료 기준:** 선언한 Linux backend에 실제 구현·등록·호출·수명·package/runner 연결을 갖추고, 공통 기능 확장에 필요한 코드가 누락되거나 빈 stub으로 남지 않는다.
- **플랫폼 검증:** target 전용 compile/native build, 실제 display/GPU 실행, 입력/IME·Orca/AT-SPI·성능/복구·설치·clean-machine 확인은 모두 `SKIPPED (사용자 지정)`다. Linux display/기기 확보를 이번 W6 완료의 선행 조건으로 두지 않으며 provider qualification은 `notVerified`를 유지한다.

### W6-30 — 패키징·외부 소비·최종 차이 닫기

- [ ] core/SDK/Skia/Metro/CLI의 source·ESM·declaration·map·assets·native supply·notice·export를 동기화하고 breaking API/version/migration을 적용한다. sample과 CLI template의 공유 source/runner를 일치시킨다.
- [ ] 설치한 CLI와 공급 archive만으로 새 외부 앱을 만들고 Windows·Android·Web의 install/typecheck/build/run/pack·clean-machine 실행을 확인한다. Apple/Linux의 source·module·provider·runner/template·배포 설정은 공급에 포함하되 플랫폼 소비/실행 검증은 `SKIPPED`다. 소비 앱은 repository `reference/`, DorotiLab, 개발 도구·scratch 없이 구성돼야 한다.
- [ ] coverage의 모든 mandatory missing/partial, Windows·Android·Web의 FAIL/notVerified, Apple/Linux의 코드 구성과 사용자 지정 SKIPPED, 원본 갱신·license·서명·제약 문서를 검토한다. 미구현이나 필수 검증 미완료는 이 문서에 남기며 Apple/Linux의 합의된 검증 생략만으로 W6 완료를 막지 않는다.
- [ ] 소유 임시 자료/프로세스/포트/외부 앱을 정리하고 현재 제품 build·대표 흐름·직접 import/exports를 마지막 확인한다. 실제 남겨 둔 artifact와 제거한 raw 자료를 구별한다.
- **수락:** 2절의 기능·제품·개발 경험 조건을 합의한 범위에서 함께 충족한다. 새 API가 manifest에만 있고 제품 경로에 연결되지 않은 항목은 완료로 집계하지 않는다. 결과에는 `6개 target 코드 구성 / Windows·Android·Web 검증 / Apple·Linux 플랫폼 검증 SKIPPED`를 구분해 표시한다.

## 5. 위젯 coverage의 필수 묶음

다음 표는 inventory를 작업에 배정할 때의 누락 방지 목록이다. **정확한 공개 목록은 pin한 참조의 exports가 기준**이며, 같은 이름의 내부 class를 모두 API로 노출할 필요는 없다. 한 family의 theme/controller/route/localization·state/semantics도 함께 완료한다.

| 공통 Widget 묶음 | 주요 대상 | 담당 |
| --- | --- | --- |
| 트리·데이터·빌더 | Key/GlobalKey, Inherited 계열, Builder/StatefulBuilder, Listenable/ValueListenable, Future/StreamBuilder, Notification | 03·15 |
| 배치 | Container/Center/Align/Row/Column/Flex/Stack/Positioned/Wrap/Table/Flow, sizing/intrinsic/custom/layout builder, directional variant | 04 |
| 그리기·효과 | CustomPaint/Clip/Opacity/Transform/RotatedBox/BackdropFilter/ImageFiltered/ShaderMask/ColorFiltered, composited follower, RepaintBoundary | 05 |
| text·image·icon | Text/RichText/WidgetSpan/DefaultTextStyle, selection families, Image/FadeInImage/ImageIcon/Icon/IconTheme | 06·07·15 |
| 입력·focus·폼 | Listener/GestureDetector/RawGestureDetector/MouseRegion/TapRegion, Focus/Actions/Shortcuts, Form/EditableText/Autofill/UndoHistory | 08~10·15 |
| 애니메이션 | explicit transitions, implicit animations, AnimatedSwitcher/CrossFade/Size, TweenAnimationBuilder/TickerMode | 11 |
| scroll·sliver | Scrollable/List/Grid/CustomScrollView, mixed/variable sliver·header·page·nested·wheel·refresh·reorder·dismiss·tree·2D·interactive | 12·13 |
| 앱·route·overlay | WidgetsApp/Navigator/Router/Pages/Route/PopScope/Hero/Overlay/ModalBarrier/Restoration/PageStorage | 14 |
| 환경·접근성·OS view | MediaQuery/SafeArea/Localizations/Directionality/Semantics, PlatformView/Texture/HtmlElementView/PlatformMenuBar | 02·16·22 |
| 개발 기능 | inspector/accessibility inspector, debug/semantics/performance overlay, widget previews | 23 |

| Material 묶음 | 주요 대상 | 담당 |
| --- | --- | --- |
| 디자인 기반 | Material/Ink, full Theme/ColorScheme/TextTheme/WidgetState, shapes/icons/motion | 17 |
| 앱 shell | App/Scaffold/Messenger, AppBar/SliverAppBar, drawer/FAB/bottom bar, navigation bar/rail/drawer | 17 |
| 선택·입력 | 모든 button 계열, checkbox/radio/switch/slider/range/segmented/toggle/chip, TextField/FormField/dropdown/autocomplete/search | 18 |
| 표시·피드백 | card/list/divider/avatar/badge/progress/tooltip/snackbar/banner/selection | 18·19 |
| 복합 흐름 | dialogs/sheets/menu, tabs/data table/pagination, date/range/time picker, expansion/stepper/carousel/refresh/reorder/about/license | 19 |

| Cupertino 묶음 | 주요 대상 | 담당 |
| --- | --- | --- |
| 디자인 기반 | App/Theme/DynamicColor/TextTheme/IconTheme/Localizations/interface level | 20 |
| 앱·navigation | page/nav/sliver nav, route/edge back, tab scaffold/bar/view, dialogs/popups/sheets | 20 |
| 선택·입력 | button/checkbox/radio/switch/slider/segmented, text/search/form, picker/date/timer | 21 |
| 표시·복합 흐름 | activity indicator, list/form sections·expansion, action sheet/context menu, refresh/scrollbar, selection toolbar/magnifier | 21 |

특히 로컬 snapshot에 있는 `expansible`, `sliver_tree`, `two_dimensional_viewport`, Material `carousel`·`dropdown_menu_form_field`, Cupertino `sheet`·`menu_anchor` 같은 family를 익숙한 오래된 위젯 목록만 보고 누락하지 않는다. 새로운 master API를 진행 중 무제한으로 추적하지 않고, baseline 갱신은 별도 source diff로 처리한다.

## 6. 우선순위·의존성·milestone

| Milestone | 작업 | 완료 결과 |
| --- | --- | --- |
| M0 — 전체 공백 고정 | 00~01 | exact source·전체 coverage·실제 재사용 가능한 이식 사이클 |
| M1 — 확장 가능한 공통 기반 | 02~09·11 | 일반 트리/layout/paint/text/image/input/focus/animation |
| M2 — 실제 앱 공통 기능 | 10·12~16·22 | 편집/IME·sliver·앱/route/restoration·폼·접근성·platform service |
| M3 — 디자인 위젯 기능 완료 | 17~21 및 잔여 coverage | Material/Cupertino의 모든 mandatory family와 member |
| M4 — 제품·개발 경험 수락 | 23~29 | Windows·Android·Web 개발 갱신·성능/복구·실제 수락, Apple/Linux 코드 구성·플랫폼 검증 SKIPPED |
| M5 — 합의한 W6 범위 완료 | 30 | mandatory 코드 공백 0, Windows·Android·Web 필수 검증·외부 소비·배포, Apple/Linux 검증 생략 기록·정리 |

기본 의존성은 **00 → 01/02 → 03 → 04 → 05~09/11 → 10/12~16 → 17~21 → 30**이다. 구체적으로 12는 03/04/08/11, 13은 12, 14는 03/05/09/11, 16은 각 위젯의 semantics와 해당 플랫폼 bridge, 17은 05~07/09/11/14/16을 필요로 한다. 22는 02/05/08~10/16과 연결한다.

플랫폼 25~27과 24의 Windows·Android·Web 성능 측정은 마지막에 처음 시작하지 않는다. primitive·편집·sliver 묶음이 나올 때부터 해당 platform port의 가능 여부를 확인하고 기능별 수락을 누적한다. 28~29의 Apple/Linux 코드는 공통 계약 변경과 함께 구성하되 플랫폼 검증은 생략한다. 23의 기본 진단도 초기 구현에 필요한 부분부터 제공한다.

**첫 구현 묶음 권고:** W6-00/01의 inventory·pin·도구 검토 → W6-03/04의 lifecycle/layout → W6-05의 Path/stroke/opacity/shadow 및 W6-06의 text 기반 → W6-12의 일반 variable sliver 순으로 착수한다. 이 기반을 소비하는 Material checkbox/button/form/list와 Cupertino switch/navigation 한 흐름을 먼저 끝내 이식 비용·backend 비용·fidelity 문제를 확인한다. 이는 전체 범위를 줄이는 조치가 아니라 남은 family에 같은 기반을 재사용하기 위한 첫 수락 단위다.

날짜·총 공수는 지금 확정하지 않는다. 684개 파일이나 위젯 이름 수로 일정을 환산하면 정확하지 않다. W6-01의 대표 3개 묶음과 최초 native port 결과로 layer별 구현/수정/확인 비용을 측정한 뒤, coverage에 남은 dependency closure를 기준으로 milestone 일정을 산정한다. Windows·Android·Web의 실제 수락에 필요한 물리 기기·입력/reader 환경·서명 자격을 준비한다. Apple 장비·Xcode 실행 환경·Linux display/기기는 이번 W6 완료의 확보 조건에서 제외한다.

## 7. 검증·운영·정리

### 7.1 확인 관문

아래 관문의 플랫폼별 실행·수락 대상은 Windows·Android·Web이다. Apple/Linux는 공통 source/API·패키지 구성에 포함하되 target 전용 검증 관문은 사용자 지정 `SKIPPED`로 처리한다.

| 관문 | 확인할 내용 | 확인하지 못하는 것 |
| --- | --- | --- |
| G6-0 — 출처/API | pin·license·public declaration/member·매핑·차이 | 실행 동작·화면 |
| G6-1 — build/소비 | strict types·ESM/선언 `.js`·source map·Metro/Hermes·packed import | 실제 native/DOM 표시 |
| G6-2 — 의미 | 수명·callback 순서·수치·key diff·editing revision·오류/취소·resource lease | 물리 입력·IME·reader·GPU 화면 |
| G6-3 — 시각/상호작용 | actual Skia/CanvasKit pixels·layout/hit test·font·scroll·복합 route | 미실행 target·물리 입력·scanout |
| G6-4 — 플랫폼 서비스 | 실제 IME/candidate·focus·clipboard·reader·OS lifecycle/native view | 다른 OS/기기·production 배포 |
| G6-5 — 성능/복구 | frame timing·실제 presentation 범위·메모리·loss/failure/drain | 측정하지 않은 refresh rate·환경 |
| G6-6 — 배포/최종 | 외부 앱·clean machine·signing·install/update·coverage 공백 0 | 범위 밖 환경의 자동 보장 |

순수 계산은 pin한 upstream의 수치/상태 결과와 비교하고, 위젯은 같은 입력·viewport·theme/locale/font의 참조 장면을 대응한다. 비교용 Flutter 앱이 필요하면 임시 소비 환경에서 실행하며 Nelyx runtime 의존성으로 넣지 않는다. OS font/anti-alias 차이는 허용 오차와 이유를 적고 geometry·state·interaction 차이와 분리한다.

기능 확인은 변경의 의미를 검증하는 작은 assertion/fake clock·실제 sample/runner·필요한 UI 자동화로 수행한다. Flutter의 unit/widget/integration 구분은 참고하되, 별도 거대한 검증 workspace/report 수집 체계를 복제하지 않는다. [Flutter testing overview](https://docs.flutter.dev/testing/overview)

### 7.2 현행 명령과 반복 범위

기본 제품 확인 명령은 현재 `package.json`에 있는 다음 명령이다.

```powershell
npm.cmd run check:types
npm.cmd run build:sdk
```

CLI/Metro를 수정하면 해당 선언 compiler check를 추가한다.

```powershell
npm.cmd run check:cli-types
npm.cmd run check:metro-types
```

반자동 도구는 모든 W6 단계에서 필요에 따라 수정할 수 있으며, 변경 시 도구 디렉터리에서 자체 확인을 수행한다.

```powershell
bun install --frozen-lockfile
bun run check:types
```

테스트를 실행할 때는 현행 `.github/copilot-instructions.md`에 따라 **20분 timeout**을 적용하고, 반복 확인은 대부분 **30회 이내**로 제한한다. 도구 변경에는 영향받은 실제 선택 소스의 분석/초안 생성·의미 확인을 추가하고, 제품에 채택한 변경에는 해당 제품 확인을 연결한다.

선택 source 분석/초안 생성은 도구 README와 **그 시점에 구현된** CLI argument/출력 경계를 따른다. 현재 `.tmp/work6` 지원을 이미 제공하는 것으로 가정하지 않는다. Web static build는 설치/공급을 맞춘 뒤 `npm.cmd --prefix sample/nelyx-testbed-app/web/runner run build`, Windows/Android native는 해당 runner/CLI README의 현재 명령을 사용한다. Apple/Linux target 전용 compile/native build·실행 검증 명령은 생략한다. 현재 없는 broad `npm run check`나 삭제된 W1~W4 validator를 선행 조건으로 되살리지 않는다.

공통 타입·빌드와 Windows·Android·Web의 해당 기능 흐름이 통과하면 동일 검사를 이유 없이 반복하지 않는다. 새로운 primitive/ABI/native service는 해당 검증 target의 영향을 받는 backend를 확인하고 Apple/Linux의 대응 코드는 함께 구성한다. 검증을 이유로 Apple/Linux native build를 추가하지 않는다. 최종 필수 qualification은 25~27/30에서 누적하고 28~29의 플랫폼 검증은 `SKIPPED`로 남긴다.

### 7.3 결과와 임시 자료 관리

- W5의 가벼운 검증 운영 방향은 후속 계획의 기본값으로 유지한다. source pin·이식 규칙·coverage·제품 API·README·작은 재현 절차는 유지하고, 회차별 assertion·draft·raw log·screenshot·외부 소비 앱·test-only hook는 해당 묶음 종료 때 정리한다.
- 이 문서의 실행 기록에 source revision, 명령/환경, 기대/관찰, 실패 원인, 미수행 범위와 정리 여부를 남긴다. raw 결과를 제거한 뒤 파일이 남아 있다고 안내하지 않는다. 재현 가능한 작은 입력과 절차를 보존한다.
- 정리는 이번 단계에서 만든 명시적 allowlist로 preview하고 실행형 도구는 `-Execute`를 요구한다. 절대 경로·workspace 경계·link를 확인하고 사용자 변경/다른 단계/제품 공급·build input을 보존한다. owned emulator/server/포트도 소유권을 확인하고 종료한다.
- build·prepare·patch·template·tarball이 삭제한 검증 hook/복사본을 되살리지 않는지 확인한다. 도구와 실제 제품 기능을 임시 검증 코드로 잘못 분류하지 않는다.
- 영구 자동 회귀 suite를 보유하지 않는 비용은 재발 탐지와 대규모 parity 유지에 있다. 현재 정책에서 재현 절차·실제 예제·작은 의미 확인으로 보완하되, 향후 suite 도입은 별도 정책 변경으로 명시한다.

## 8. 착수 체크리스트와 최종 완료 체크리스트

### 착수

- [x] W5의 선정 API 완료와 Flutter 전체 대비 미완료를 구분한 현재 상태를 확인한다.
- [ ] exact Flutter baseline·public/member coverage·API migration 정책을 확정한다.
- [ ] 도구의 실제 지원 범위와 처음 채택할 dependency closure를 선택한다.
- [ ] common RenderObject/paint/text/IME/sliver 확장과 backend 연결 지점을 정한다.
- [ ] Web·Windows·Android 개발/물리 기기 수락 조건을 작업에 연결하고, Apple/Linux는 코드 구성과 플랫폼 검증 생략 정책을 작업에 반영한다.

### 합의한 W6 범위 완료

- [ ] 모든 mandatory public API/member가 실제 구현 module에 연결되고 `missing/partial`이 없다.
- [ ] GlobalKey·layout·layers·rich text/image·gesture/focus/editing·animation/sliver·앱/restoration·services/semantics의 동작이 대응한다.
- [ ] Material/Cupertino 전체 대상 family와 state/theme/localization·motion·접근성이 완료됐다.
- [ ] 6개 target의 framework·SDK/native 또는 DOM port·renderer·provider·runner/template·배포 설정 코드가 구성됐다.
- [ ] Windows·Android·Web의 선언된 backend/기기 범위에서 실제 실행·물리 입력·IME·reader·lifecycle이 수락됐다.
- [ ] Windows·Android·Web의 성능/자원 budget·실제 표시·failure/loss/drain·개발 갱신 조건이 수락됐다.
- [ ] 공통 패키징·source/notice 및 Windows·Android·Web의 외부 소비·production 서명/설치·clean-machine 확인이 완료됐다.
- [ ] Linux·iOS·macOS의 플랫폼 검증은 사용자 지정 `SKIPPED`와 이유가 기록됐고 provider qualification은 `notVerified`로 유지됐다. 이 생략은 이번 W6 완료를 막지 않는다.
- [ ] 임시 구성 정리 뒤 제품 build/대표 흐름이 유지되고 README·제약·migration이 현재 상태와 일치한다.

**계획 작성 시점 상태: 검토/계획 문서 작성과 사용자 범위 조정 반영 완료. W6-00~30 실행은 미착수다. 완료 목표는 6개 target 코드 구성과 Windows·Android·Web 검증이며 Linux·iOS·macOS의 플랫폼 검증은 사용자 지정 SKIPPED다.**

## 9. 실행 기록

### 2026-10-11 — source·inventory·첫 트리 묶음

**전체 판정: PARTIAL, 목표 계속 진행.** W6-00/01과 W6-03의 첫 구현을 수행했으며 M0/M1 또는 W6 전체를 완료로 판정하지 않는다. 착수 시 working tree는 clean이었다. 진행 중 사용자가 `.github/copilot-instructions.md`에 추가한 `필요하면 pwsh과 playwright사용가능`을 읽고 보존했다. 이전 메모의 삭제된 broad validator/Deno 검증을 되살리지 않고 현행 명령과 W5 인계를 기준으로 진행했다.

| 작업 | 현재 상태와 남은 경계 |
| --- | --- |
| W6-00 | `PARTIAL`: exact Git pin, license/파일 hash, 15개 public entrypoint, member/constructor/options·상속·private dependency·conditional alternative inventory와 작업 배정 구현. deprecated/target 조건의 개별 의미 판정, conditional export의 target별 최종 visibility 확인, 지원 OS/browser/물리 기기 범위 확정이 남음 |
| W6-01 | `PARTIAL`: qualified ID, C#/Dart 선택 구분, W6 scratch/링크 방어, 공식 Dart analyzer frontend, TS compiler 대조, 원본/목적지 hash가 같은 review 보존 구현. 기존 C# 24 selection과 새 Dart 8 selection 분석 성공. inheritance/generic/async 자동 lowering, 대표 3개 묶음 전체 및 실제 upstream update의 old/new draft 수락은 남음 |
| W6-03 | `PARTIAL`: GlobalKey/GlobalObjectKey/LabeledGlobalKey, inactive/activate/finalizeTree, hash 기반 child diff, inherited notifier/model/theme와 context lookup 구현. slot/ParentDataWidget 및 전체 Element/BuildContext 계약, GlobalObjectKey의 object 이외 identity 의미, target별 입력·ticker/semantics 이동의 전체 수락이 남음 |
| 나머지 W6-02·04~30 | 미완료. 첫 묶음의 package/Web 증거를 해당 기능의 범위로만 누적함 |

**참조와 대조표.** Flutter repository의 exact commit은 `71e4717a61786faab4c7aa39825989305ed29e8a`다. `Nelyx/upstream/flutter-coverage.json`에는 analyzer 14.4.0 / Dart 3.14.0-296.0.dev로 해석한 15개 library, **74,028개 선언·member record(그중 public 47,282개)**, 778개 source file hash와 외부 참조 744개를 기록했다. 이는 구현률의 분모나 위젯 개수로 환산할 수 없는 member/dependency 집계다. 두 icon 상수군은 hash·생성 규칙·대표 glyph로 묶었다. 분석 source의 error diagnostic은 0이며 source/member/상속/dependency 참조 연결 확인이 통과했다.

로컬 비교 snapshot은 원래의 684개 파일/hash `31aa3b78409e94fce5417e0774b170cf02288ed42aec2b5e07d8dc45728fa2a1`을 유지했다. pin은 682개 파일이며 로컬 대비 `_web_browser_detection_io.dart`와 `_web_browser_detection_web.dart`의 private helper 2개가 없고 12개 파일의 내용이 다르다. 차이 목록을 coverage의 `source.baselineDelta`에 보존했다. 공개 family를 제외하는 scope 변경은 하지 않았다. Windows checkout의 CRLF와 원본 LF를 구별하여 분석 bytes SHA256, Git blob SHA1, LF-normalized upstream SHA256을 기록하고 실제 pin 객체와 대조했다. 기존 Flutter/Doroti notice는 보존했다.

현재 coverage는 **missing 73,457 / partial 564 / implemented 4 / adapted 3**이다. 기존 동명 API를 자동 완료 처리하지 않았다. 명시적으로 source 의미를 검토한 7개 member만 독립적으로 상태를 올렸으며 class 전체나 W6-03 전체 완료로 확대하지 않았다. Windows·Android·Web의 전체 수락 상태는 `notVerified`, iOS·macOS·Linux의 플랫폼 검증은 `SKIPPED (사용자 지정: 코드 구성만 수행)`, provider qualification은 `notVerified`다. review된 항목이 regeneration에서 유지되는 것과 실제 source/destination hash가 바뀌면 재검토로 돌아가는 경계를 도구에 반영했다.

**제품 변경.** GlobalKey registry는 View별 BuildOwner가 소유하며 같은 프레임의 부모 이동에서 State/context/render를 보존한다. 아직 사용 중인 다른 View, 중복 부모·sibling, ancestor cycle을 진단한다. inactive subtree의 dependency 등록은 해제하고 다시 활성화할 때 의존성을 갱신하며, 회수되지 않은 subtree는 frame finalization에서 해제한다. GlobalKey에는 erased generic을 검사할 선택적 State constructor token을 제공한다. 표준 ValueKey/UniqueKey/ObjectKey/global key를 hash bucket으로 조회하고 custom key는 equals/hash 계약을 유지한다. 큰 render child 목록의 제거 조회와 sibling detach도 집합/묶음 처리를 사용한다. InheritedNotifier의 frame 병합, InheritedModel의 aspect 의존, InheritedTheme capture를 직접 module로 제공하며 Theme가 이를 사용한다. TickerMode는 비활성 subtree를 mute하고 재활성화 때 적용한다.

새 public subpath 4개를 추가해 core export는 53개다. `foundation/key`에는 ObjectKey/KeyMap을 추가했다. sample과 CLI template에는 같은 GlobalKey의 두 번째 editor를 왼쪽/오른쪽 부모로 이동하는 흐름을 추가했다. 빈 쪽 열도 폭을 유지하도록 tight Flexible을 사용한다. core/SDK와 consumer의 경계, `src` 공유 진입점, `.ts` source / `.js` ESM·declaration 및 no-barrel 원칙을 유지했다. 새 API는 기존 경로에 additive하게 제공하며 W6 전체의 breaking/version migration 수락은 W6-30에 남긴다.

**확인 결과.** 모든 test 실행의 전체 timeout은 20분으로 설정했으며 수백 회 반복하지 않았다. 최종 트리 확인 21건/67 assertion, 도구 확인 4건/12 assertion이 통과했다. 앞선 15건에서 확장한 최종 21건이지 서로 다른 36건으로 합산하지 않는다. 내용은 양방향 부모 이동, 제거된 inactive ancestor에서 추출, State/context 생존·최종 dispose, dependency 재등록, notifier 교체·해제, aspect 갱신, theme capture, generic token mismatch, render 재부착, dispose 오류 시 sibling 정리, key 충돌·중복·View/cycle 오류, editor/focus 소유권이다. 10,000 keyed sibling 역순 변경은 비교 30,000회였고 최종 단일 관측은 40.1262 ms다. 이는 end-to-end frame budget/scanout 검증이 아니다.

`npm.cmd run check:types`, `npm.cmd run build:sdk`, 도구 `bun run check:types`가 통과했다. C# Roslyn 선택 24개와 Dart resolved 선택 8개를 실제 분석했다. draft 출력의 product 경로·재사용 출력·junction ancestor를 거부하고, qualified 동명 symbol을 구분하며, compare에서 선택 옵션 변경을 감지하고 reviewed bytes를 보존하는 것을 확인했다. Dart frontend에는 자동 Dart→TS emitter가 없으며 reviewed record와 수동 의미 구현을 사용한다.

6개 package archive만으로 임시 Web 소비 앱을 만들고 독립 runner의 install/check/Metro static build를 수행했다. Node에서 packed core의 **53개 ESM export와 .js declaration specifier**, 기본 State/GlobalKey 생존·해제를 확인했다. Chrome **154.0.8037.98**, Playwright **1.63.0**, CanvasKit/WebGL2의 **ANGLE AMD Radeon 780M D3D11** 실제 화면을 확인했다. pointer 이동 3회에서 같은 DOM input·텍스트·backward selection `[1,5]`가 유지됐고 canvas 1/input 2를 유지했다. 기존 pointer 정책의 `canvas.focus()`에 따라 canvas 클릭은 editor focus를 옮긴다. 실제 DOM semantics button action으로 이동했을 때는 editor focus도 유지됐다. 960×1000→760×900 resize와 runtime error 0을 관측했다. 최종 확인 bundle SHA256은 `5e21e5ef7fe9bdde9bd5a358decd268d2b3ce943e6f332a160b845f8a3b14d74`다. 이 입력은 자동화이며 물리 한국어 IME/reader 수락이 아니다. Windows/Android native 실행과 Apple/Linux 플랫폼 검증은 이 묶음에서 수행하지 않았다.

초기 검증에서 Bun test의 path filter, Python selector 문자열 quoting 및 sample의 loose Flexible 폭 문제가 드러나 수정했다. 장시간 대기하던 소유 Python과 첫 static server는 PID/command를 확인해 종료했으며 이를 cooperative close 증거로 쓰지 않았다. 최종 server는 SDK 공급 server의 close Promise를 기다려 종료 ACK와 exit 0을 확인했다. 기존 package manifest가 있는 output에 재발행을 거부한 동작도 유지했고 수정본은 fresh output을 사용했다. root의 `bun run check:types`는 npm workspace script와 호환되지 않아 실패했으므로 제품 gate는 정식 `npm.cmd` 명령의 성공으로 기록했다.

**다음 구현 경계.** 전체 목표는 active다. W6-00의 conditional visibility/target·deprecated 분류와 W6-01의 대표 묶음/갱신 의미 확인을 계속하고, W6-02의 notifier/scheduler 기반을 보강한다. W6-03의 slot/ParentDataWidget 및 generic identity 공백을 닫은 뒤 W6-04 layout·W6-05 paint/backend·W6-06 text·W6-12 일반 sliver로 이어간다. 물리 기기/IME/reader·production 자격·clean-machine은 W6-25~27/30의 필수 수락으로 유지하며 자동화 결과로 대체하지 않는다.

**임시 자료 정리 상태:** 이 묶음의 assertion/draft/raw inventory·coverage draft·screenshots·archive·외부 소비 앱은 명시 allowlist preview 후 `-Execute`로 정리한다. 다음 이식을 위한 exact Flutter checkout과 개발용 Dart SDK는 소유 개발 입력으로 계속 사용하며 앱/runtime에 포함하지 않는다. 실제 정리 결과와 마지막 compiler 확인은 아래 후속 기록에 추가한다.

**묶음 정리 완료:** 29개 소유 경로를 preview한 후 `-Execute`로 제거했고 cleanup helper도 제거했다. junction은 target을 순회하지 않고 링크 자체만 제거했다. 현재 `.tmp/work6/`에는 다음 이식에 사용할 `flutter-source/`와 `dart-dev/`만 남았다. 삭제한 assertion·raw inventory·draft·screenshots·외부 소비 앱이 남아 있다고 안내하지 않는다. 최종 `npm.cmd run check:types`, 도구 `bun install --frozen-lockfile`(변경 없음) / `bun run check:types`, 포맷한 Dart frontend의 `dart analyze`(No issues found), `git diff --check`가 통과했다. SDK build와 실제 Web 화면 증거는 위 확인본의 scope를 유지한다. commit/push는 수행하지 않았다.

### 2026-10-11 — foundation·scheduler·Ticker와 Windows adapter 묶음

**전체 판정: PARTIAL, 목표 계속 진행.** W6-02의 foundation/frame 기반과 W6-11의 Ticker, W6-03의 primitive identity를 구현했다. 전체 단계나 class를 완료 처리하지 않았다. 이전 묶음의 source가 바뀐 review는 다시 검토했으며, 아래 결과가 현재 변경본의 증거다.

| 작업 | 구현과 남은 경계 |
| --- | --- |
| W6-01 | resolved coverage를 손실 없이 복원하는 TS-only refresh를 추가했다. Git pin/blob·Dart dependency lock을 다시 검증하며 parameter/supertype/conditional export와 744개 외부 참조를 보존한다. 과거 unreviewed missing 기록이 새 TS export를 가리던 오류를 수정했다. 실제 `Symbol.iterator`/`equals` 매핑과 source/destination hash가 같은 review만 보존한다. 전체 Dart lowering·대표 design widget/원본 갱신 수락은 남음 |
| W6-02 | Listenable/ValueListenable·merge·reentrant notifier/error/debug instrumentation, nullable collection equality·binarySearch·stable range sort·ObserverList/HashedObserverList를 추가했다. View별 transient/persistent/passive post-frame·cancel·endOfFrame·visibility·timestamp/timeDilation과 defer/allow first-frame admission을 연결했다. warm-up/forced frame·priority task·전체 diagnostics·live locale/brightness/accessibility 환경 및 typed service port는 남음 |
| W6-03 | LocalKey·일반 ValueKey policy·primitive/reference GlobalObjectKey 및 명시 generic State token을 보강했다. KeyMap은 hash collision과 무관하게 전체 삽입 순서를 유지한다. 이전 실행 기록의 object-only identity 공백은 이 묶음에서 대응했다. slot/ParentDataWidget·전체 Element 계약은 남음 |
| W6-11 | TickerFuture의 정상 완료/취소 derivative, muted/hidden 시간 진행, owner close 취소와 ticker 흡수를 구현했다. completion listener가 새 animation을 시작하면 이전 tick이 이를 지우던 오류를 수정했다. 전체 Dart Future API·Ticker.forceFrames·AnimationController/Simulation/Curve/Transition family는 남음 |
| W6-24 | Windows의 기본 GPU 선택으로 흰 화면/입력 실패가 관측되어, DXGI 첫 adapter 대신 주 화면에 연결된 hardware adapter를 선택하도록 수정했다. 명시 vendor override와 선택 로그를 유지한다. display migration·cross-adapter/device loss 및 성능 qualification은 남음 |

**source·API·이식 차이.** Flutter pin은 `71e4717a61786faab4c7aa39825989305ed29e8a`로 유지했다. 이 pin의 notifier 공개 공급은 `foundation/change_notifier.dart`가 아니라 `package:listen`이다. locked **listen 1.0.1**, archive SHA256 `47501a08016a43fcad79252439d723f50f14f88fa7bfd8a177e0a417e5c9e1f2`와 public cache의 실제 source hash를 연결했다. `listen-LICENSE` SHA256은 `420f7739f169097f0aad1242045169cd643c8f1d94e62866fad265ae4c369b7d`이며 기존 Flutter/Doroti notice도 보존한다. selection은 C# 24/Dart 21개로 구성했고 Dart 21개를 실제 분석했다. package source는 package_config와 locked name/version/archive hash로 해석하며 repo source와 hosted source의 path/EOL/hash 경계를 구분한다.

core direct public subpath는 **56개**다. 새 module은 `foundation/collections`, `foundation/observer-list`, `framework/animation/ticker-future`이며 barrel을 만들지 않았다. JavaScript collection key identity·명시 value equality/hash, iterator protocol·options object·millisecond timestamp, opt-in debug instrumentation과 W5 idempotent notifier dispose를 README/개별 coverage 차이로 명시했다. Ticker muted/hidden 구간은 이제 시간을 진행하므로 **W5의 pause 의미와 동작이 달라진다**. 이 migration과 전체 release/version 수락은 W6-30에 남긴다. 기존 AnimationController의 Promise 취소 API 전체를 바꾼 것은 아니다.

**coverage.** 현재 **missing 73,380 / partial 578 / implemented 4 / adapted 66**이다. 이번에 검토한 함수/member 66개만 `adapted`로 연결했고 class 및 target 수락을 완료 처리하지 않았다. 기존 review 4개를 포함한 70개 기록의 semantic fields가 regeneration에서 그대로 유지되는 것을 확인했다. 새 API 발견, 변경된 GlobalKey destination의 review invalidation, 불명확한 cached reference 거부, 실제 iterator/equality member 연결을 확인했다. 전체 74,028개 record/47,282개 public·778개 파일/15개 entrypoint의 집계 의미는 이전 기록과 같다.

**portable·도구 확인.** 20분 timeout으로 foundation/scheduler **30건/131 assertion**, coverage 도구 **4건/15 assertion**이 통과했다. notifier reentrancy·duplicate/rollback·reporter 오류/정리·instrumentation·custom equality, stable sort/range·observer collision/순서/고정 길이 copy, primitive/generic key, transient cancel/next batch·persistent/passive post·split microtask/endOfFrame, muted/hidden ticker/취소·흡수·재시작, animation 교체, 다중 View 격리와 FrameworkRoot/AppSession의 실제 frame admission·build/close 오류 원인 보존을 확인했다. busy renderer에 보관된 frame에 나중 deferral이 생기면 submit 직전 gate도 재검사하도록 수정했다. 초기 busy-frame 실패와 임시 fixture의 부적절한 동시 parameter/supertype 가정은 수정 뒤 통과했다. 수백 회 반복하지 않았다.

`npm.cmd run build:sdk`, `npm.cmd run check:types`, 독립 도구 `bun run check:types`가 통과했다. SDK의 기본 onError는 fatal 종료 경로이며 configurable portable reporter의 통과를 기본 nonfatal error 처리 증거로 확대하지 않는다. 진짜 JS microtask gap은 host가 begin/draw 호출을 분리했을 때만 제공한다. 현행 동기 FrameworkRoot가 자동으로 Promise turn을 끼우는 것은 아니다.

**외부 Web 소비.** 6개 archive로 fresh 외부 앱을 만들고 독립 runner install/check/Metro build를 수행했다. packed **56개 ESM export**의 source bytes가 현재 checkout과 같고 declaration 상대 경로가 `.js`인 것을 확인했다. packed Ticker timeline도 실행했다. Chrome **154.0.8037.98**/Playwright **1.63.0**, 실제 **WebGL2/ANGLE AMD Radeon 780M D3D11** 화면에서 pointer editor 이동 3회·같은 DOM editor/text/backward selection `[1,5]`, semantics action의 focus 유지, canvas 1/input 2, 960×1000→760×900 resize, page error 0을 확인했다. bundle SHA256은 `42753e3ee7662a716cc0125e46f750b6428b6da6e07ab142a4f79d35ccd41e76`다. 소유 static server의 close ACK와 exit 0을 확인했다.

**Hermes·Windows 확인.** RNW 공급 pin의 x64 Hermes CLI로 현재 source IIFE를 실제 실행해 notifier merge/error continuation·observer 순서·sort·ticker muted timeline/cancel 상태를 확인했다. CLI 실행은 React Native host 수락과 구분한다. fresh Windows consumer는 RNW **0.83.2**/RN **0.83.10**, x64 Release/MD native 공급 hash `d8a01c23ae68b952bd72b3fabb605a023986359a00c0424b2b37223011e2f4e1`의 1,795개 파일/220,903,703 bytes를 검증해 복사했다. Windows SDK 10.0.26100.0/MSBuild 18.9.1, Metro/Hermes bytecode/native build가 통과했다.

첫 기본 adapter 실행에서는 UIA 트리는 있었지만 흰 화면과 pointer 카운터 실패를 관측했다. 이를 성공으로 쓰지 않았다. 같은 exe에서 `NELYX_WINDOWS_GPU_VENDOR=4098`로 AMD를 선택한 실행은 실제 화면, OS pointer counter 0→1/animation 진행, 두 번째 native editor의 부모 이동, 같은 UIA runtime identity와 값 `w6 retained editor` 유지가 통과했다. 소유 PID/path/start time/HWND와 foreground를 확인하고 native log의 `closed views=0 consumers=0 gpuDrained=1`, INSTANCE_DESTROYED/APP_STOP 및 **cooperative exit 0/forced=false**를 관측했다. 해당 AMD 통과 exe hash는 `d5b9aa37c9392297dccb3e9e726287b58c5e6760466f316611693227eb210496`다. 기본 GPU 수정 뒤 결과는 아래 후속 기록에 추가한다.

**남은 수락과 정리.** Windows/Android/Web 전체 qualification은 `notVerified`를 유지한다. Android의 이 변경본 native 수락, 물리 한국어 IME·reader·scanout/FPS·성능 budget·production signing/clean-machine 수락은 아직 완료하지 않았다. Apple/Linux 전용 compile/build/run은 실행하지 않았고 사용자 지정 `SKIPPED`, provider `notVerified`다. 다음 묶음은 W6-03의 slot/ParentDataWidget 및 W6-04 layout 경계를 진행한다. 이번 `.tmp/work6/foundation-batch/`의 assertion·draft·consumer·archive·log·screenshot·helper는 종료 확인 후 명시 allowlist preview/`-Execute`로 정리하며, 재사용 Flutter checkout/Dart SDK는 개발 입력으로 보존한다. 정리와 최종 기본 GPU 확인 결과를 아래에 기록한다.

**기본 Windows GPU 수정 수락:** 수정 SDK header SHA256 `75ff6a512675056d1669e3688972debb810537a1c627ccc7cca5ce0f4faf724f`가 archive/설치본과 일치함을 확인한 후 재빌드했다. archive/lock만 바뀐 같은 버전 `npm install`은 이전 header를 유지했으므로 이 중간 빌드를 수정본의 증거로 쓰지 않았다. 현행 runner/CLI README대로 **`npm ci --workspaces=false`**로 설치한 뒤 수정 header의 실제 native compile을 확인했다. 최종 exe SHA256은 **`948b47a0725f34a73f0972354ea57b5eb1342bfa9243fad4d0d7fff6083fd6a5`**, package는 900 files/268,528,714 bytes다.

vendor 환경 변수를 child에서 제거한 기본 실행이 **`adapter=AMD Radeon 780M Graphics vendor=4098 selection=primary-display`**를 보고했다(driver 32.0.13031.3015). 실제 화면·OS pointer counter 0→1/animation 진행, 같은 native editor의 오른쪽 부모 이동/값 유지가 통과했다. 이어 1000×1000→1200×1500 window resize에서 editor UIA runtime identity·값·focus와 새 폭이 유지됐으며 실제 화면을 확인했다. `closed views=0 consumers=0 gpuDrained=1`/INSTANCE_DESTROYED/APP_STOP, cooperative **exit 0/forced=false**가 통과했다. 최초 실패 경로의 정확한 adapter 이름은 관측하지 않았고, 이 결과를 다른 GPU·display 이동·device loss 수락으로 일반화하지 않는다. package manifest 자체의 qualification `notVerified`도 유지했다. helper/server/native process 모두 종료했으며 최종 공통 `check:types`, 도구 compiler check와 diff whitespace가 통과했다.

작은 timeline 재현은 installed core의 ESM에서 아래 입력으로 수행할 수 있다. 결과는 `[0,30]`이며 `done`은 정상 완료된다. `stop({canceled:true})` 변형에서는 primary를 await하지 말고 `orCancel`의 TickerCanceled를 관측한다. first-frame admission은 createRoot에서 `scheduler.deferFirstFrame()` 후 다음 host turn에 `allowFirstFrame()`를 호출해, framework build는 수행되지만 renderer accepted 이전에 `firstFrameSubmitted`가 true가 되지 않는지 확인한다. Web/Windows sample의 Move editor 버튼과 Second editor를 사용해 native identity/value를 확인하며 물리 IME 수락으로 해석하지 않는다.

```javascript
import {FrameScheduler} from '@nelyx/core/framework/scheduler/scheduler';
import {Ticker} from '@nelyx/core/framework/animation/ticker';
let now=0;const times=[],scheduler=new FrameScheduler({now:()=>now},()=>{});
const ticker=new Ticker(scheduler,time=>times.push(time)),done=ticker.start();
scheduler.beginFrame();scheduler.endFrame();ticker.muted=true;now=30;ticker.muted=false;
scheduler.beginFrame();scheduler.endFrame();ticker.stop();await done;console.log(times);
ticker.dispose();scheduler.dispose();
```

**묶음 정리 완료:** 소유 `foundation-batch/` 한 경로(39,754 files/7,090 directories/3,186,310,211 bytes)를 allowlist preview 후 `-Execute`로 제거했다. root/ancestor·workspace 경계와 descendant link 0, 참조 중인 소유 process 부재를 확인했고 cleanup helper도 제거했다. `.tmp/work6/`에는 재사용 개발 입력 `flutter-source/`와 `dart-dev/`만 남았다. 삭제한 test/draft/consumer/archive/log/screenshot은 남아 있지 않다. 제품 source/template의 임시 helper 참조 부재와 정리 후 `npm.cmd run check:types`, `git diff --check`가 통과했다. 실제 SDK build/Windows native/Web 화면 결과는 위 검증 bytes의 범위를 유지한다. 전체 goal은 active이며 commit/push는 수행하지 않았다.

### 2026-10-11 — ParentData·slot·일반 RenderObject 묶음

**전체 판정: PARTIAL, 목표 계속 진행.** W6-03의 render attachment/slot·ParentData 경계와 W6-04의 일반 RenderObject/Stack 배치를 구현했다. 전체 class·단계 및 M0/M1을 완료로 판정하지 않는다. 이전 묶음과 사용자 변경은 보존했으며 commit/push는 수행하지 않았다.

| 작업 | 현재 구현과 남은 경계 |
| --- | --- |
| W6-03 | ProxyWidget/Element, ParentDataWidget/Element, IndexedSlot, leaf/single/multi-child RenderObjectWidget/Element를 구현했다. slot이 Stateful/Stateless/Inherited 조상을 통과하며 실제 render ancestor의 insert/move/remove hook을 호출한다. ParentData 타입·경쟁 provider·잘못된 render boundary를 진단하고 out-of-turn 변경은 허용·동일 child 조건을 검사한다. 전체 Element/BuildContext/BuildScope·debug/hot reload 계약은 남음 |
| W6-03 | single-child 교체 시 outgoing subtree를 먼저 비활성화해 capacity 오류를 막고, outgoing 조상의 GlobalKey descendant도 retake한다. Flex→Stack 이동에서 State/render identity를 유지하면서 ParentData를 교체한다. detach/unmount hook 오류는 원인을 보존하고 소유권·dispose 정리를 계속한다. 실제 IME/reader/ticker/semantics 이동의 전체 수락은 남음 |
| W6-04 | 일반 RenderObject와 Constraints를 도입하고 RenderBox를 특수 child protocol에 대해 generic으로 구성했다. parent/owner/ParentData, immutable child snapshot, 연결 목록 기반 O(1) insert/move/remove와 O(n) bulk setChildren을 제공한다. relayout boundary·dirty queue·dry/intrinsic/baseline·RenderSliver/compositing은 남음 |
| W6-04 | Flexible/Expanded는 FlexParentData를 갱신하며 Builder를 통한 composition도 동작한다. Positioned/fill/fromRect/directional·PositionedDirectional, Stack fit/alignment·positioned 크기/offset·overflow clip을 연결했다. 전체 Flex main/cross/baseline/RTL·unbounded loose flex, AlignmentGeometry·RelativeRect·모든 Clip variant와 나머지 layout family는 남음 |
| W6-01/30 | 보호된 subclass member를 destination `access`와 함께 연결하고 named Dart constructor는 실제 named TS factory에만 연결한다. fresh create와 supply 후 install/ci 구분을 CLI 영어/한국어 README에 설명했다. 전체 갱신·배포 수락은 남음 |

**source·API·migration.** Flutter pin `71e4717a61786faab4c7aa39825989305ed29e8a`를 유지한다. selection은 **C# 24/Dart 50개**이며 Dart 50개를 실제 분석했다. reviewed-port는 수동 구현이며 Dart 자동 lowering 성공을 뜻하지 않는다. direct public subpath는 **56개**이고 barrel은 추가하지 않았다. sample과 CLI template의 header에 Builder→Flexible, 이미지에 Positioned.fill→Stack을 넣어 실제 소비 경로로 연결했다.

새 Widget 생성자는 child-first/options object를 사용하며 기존 Flexible/Flex 등의 positional API는 유지한다. ParentData generic은 명시 constructor token, IndexedSlot은 Element/undefined identity·명시 type token·nonnegative safe-integer index를 사용한다. FlexParentData의 nullable 기본값은 effective non-flex 값 0/tight로 대응하고 Flexible은 nonnegative safe integer를 요구한다. offset/rect는 `{x,y,...}` 값이고 absent edge는 undefined다. child snapshot을 직접 수정할 수 없으며 render dispose 전에 parent/pipeline에서 분리한다. 특수 non-box 자식은 `RenderBox<Child>`와 `super({childType:ChildClass})`로 허용하고 해당 protocol의 hit test는 subclass가 구현한다. 전체 Sliver 지원을 뜻하지 않는다. ParentDataElement의 정식 메서드 이름은 원본처럼 **applyWidgetOutOfTurn**이다.

**coverage.** 최신 집계는 **missing 73,257 / partial 605 / implemented 7 / adapted 159**다. 이번에 검토한 100개 member는 기존 4개 unchanged-semantic review 복원, ParentData base 3개, 명시 TS 차이가 있는 93개로 구성된다. 앞선 adapted 66개를 포함한 **166개 review record**의 implementation/destination/differences/verification/evidence가 regeneration에서 보존되고 source diagnostics 0임을 확인했다. 전체 74,028개 record·47,282 public·778 files·15 entrypoints 집계의 의미는 이전 기록과 같다. 실제 named factory가 없는데 default constructor로 연결하던 51개 false partial match를 제거했다. compiler/name 연결만으로 completion을 올리지 않으며 전체 class를 partial로 유지한다. 최신 근거는 `flutter-coverage.json`의 `w6-parent-data-20261011`이다.

**portable·도구·외부 소비.** 20분 timeout으로 최종 **20건/103 assertion**, coverage 도구 **2건/9 assertion**이 통과했다. proxy/stateful/inherited ParentData 전파, 같은 render의 data 갱신, slot/sibling 재정렬, GlobalKey Flex→Stack 이동·single-child replacement/descendant extraction, 잘못된 boundary·경쟁 data·cycle/owner/capacity/slot, out-of-turn 허용·동일 child·지속성, Positioned/fill/RTL/옵션 제거·overflow clip, non-box token, InheritedNotifier coalescing/listener 해제와 teardown 원인 보존을 확인했다. leaf mutation과 single-child move/잘못된 removal slot은 직접 호출에서도 거부한다. 10,000 keyed reverse는 **10,000 move**, 최종 단일 측정 **35.3556 ms**였으며 frame-budget PASS가 아니다. 반복 수백 회 검증하지 않았다.

`npm.cmd run build:sdk`, `npm.cmd run check:types`, 독립 도구 `bun run check:types`, 외부 Web runner check/Metro build가 통과했다. 현재 packed **56개 ESM export**의 source bytes가 checkout과 같고 declaration 상대 경로는 `.js`임을 확인했다. packed ParentData/Positioned 배치와 strict NodeNext/ES2022 외부 `RenderBox<NonBox>` consumer도 통과했다. 테스트 invocation은 `.tmp` 경로에 명시 `./`가 필요했고, Bun의 workspace script 실행 대신 현행 npm 명령을 사용했다. 임시 pack/serve helper의 기존 directory/manifest 재사용 오류는 fresh draft/package 경로로 수정했다. 이 실행 준비 실패를 제품 동작 실패나 통과로 세지 않는다.

**최신 실제 Web 화면.** Chrome **154.0.8037.98**/Playwright **1.63.0**, 실제 canvas의 **WebGL2/ANGLE AMD Radeon 780M D3D11**을 관측했다. OS/browser pointer로 counter 0→1/animation, editor 부모 이동 3회에서 같은 DOM editor·값 `retained 한글 A😀B`·backward selection `[1,5]`, semantics 이동의 focus 유지를 확인했다. theme/locale·Item 1 detail/Open dialog/Close/Back에서도 원래 home editor identity/value를 유지했다. 960×1000→760×900 resize에서 canvas 1/input 2였고 page/application console error는 0이다. screenshot의 실제 화면을 확인했다.

공개 SDK **closeAllWebApplications**를 실제 Metro export에서 호출해 canvas 0/input 0/fonts 1→0, 해당 WebGL context의 loss를 확인했다. 소유 loopback server는 close ACK HTTP 200/exit 0으로 종료했다. 최종 bundle SHA256은 **`cacd8fa9473bde25492970c00eee46a76fdf2d3d5937a8bb1c5f76b93ef5c131`**이며 정식 API 이름·ParentData 기본 문자열·leaf/single misuse 검사 보강 이후 current source의 결과다. 초기 bundle `f98b72d5e20fa61c07ede5f767db27e89750266d509c3bc417b7e98603c5d792`의 결과와 구분한다.

**Windows 실행과 제한.** fresh consumer의 supply→ci→prepare→Metro/Hermes/native build가 통과했다. RNW **0.83.2**/RN **0.83.10**, x64 Release/MD, SDK **10.0.26100.0**/MSBuild **18.9.1**, native input SHA256 **`d8a01c23ae68b952bd72b3fabb605a023986359a00c0424b2b37223011e2f4e1`**(1,795 files/220,903,703 bytes)를 검증했다. exe SHA256은 **`e98c59eb4c0c0964f4ae71e5d3ad18550c96a896124db552b70df194335eb9f8`**, package 900 files/262,177,650 bytes다. vendor override 없이 기본 `adapter=AMD Radeon 780M Graphics vendor=4098 selection=primary-display`를 보고했다.

첫 zero-gap cursor move/down/up에서 counter가 0에 머물렀다. 정확한 원인을 규명하거나 빠른 입력이 수락됐다고 기록하지 않는다. **같은 exe**에 move 후 80ms·down/up 사이 80ms를 둔 입력은 counter 0→1/animation 화면, editor의 오른쪽 이동과 같은 UIA runtime identity·값 `w6 parent data editor`·focus, 1200×1500 resize에서 identity/value/focus 유지가 통과했다. PID/path/start time/HWND/foreground를 확인했다. window 하단이 visible desktop을 넘었으므로 전체 window scanout 수락으로 해석하지 않는다. native `closed views=0 consumers=0 gpuDrained=1`/INSTANCE_DESTROYED/APP_STOP과 cooperative **exit 0/forced=false**가 통과했다.

이 native 실행의 framework.ts hash는 `1f3dcfbc4f5e343f27c9f672e5c50d6d2656b06821c65bf485bfdb9aaf1e8ce8`, rendering/object.ts는 `77cf9bf01cc74896aaba6a413cd902e97ccaeb0b56bc4e43ee19941374d28807`이다. 이후 applyWidgetOutOfTurn 명칭·ParentData.toString·leaf/single 직접 misuse 검사만 수정했으며 이 최종 수정에는 portable/packed/current-Web 근거가 있다. native exe를 이 최종 source bytes의 재실행 증거로 확대하지 않는다. 빠른 입력과 W6-04 추가 layout 변경본의 native 수락은 다음 검증에 남긴다.

**작은 재현 입력.** installed ESM의 `BuildOwner`에 아래 Widget을 mount하고 `flushBuild()`→`syncRenderTree()` 후 첫 render를 200×40 tight constraint로 layout하면 두 child 폭이 각각 100이다. owner는 host services를 받으며 Text 없이 재현할 수 있다. 별도 `Stack([Positioned.fill(new SizedBox())])`는 bounded 80×60에서 child도 80×60이다. 정리 시 root를 unmount하고 owner를 dispose한다.

```javascript
import {Row,Builder,Flexible,SizedBox,Stack,Positioned} from '@nelyx/core/framework/widgets/basic';
const row=new Row([
  new Builder(()=>new Flexible(new SizedBox(10,20),1,'tight')),
  new Flexible(new SizedBox(10,20),1,'tight'),
]);
const stack=new Stack([Positioned.fill(new SizedBox())]);
```

**남은 수락·다음 구현.** Android의 이 묶음 native 실행, 물리 한국어 composing/후보창·reader·scanout/FPS·성능 budget·production signing/clean-machine, rapid input/display/device loss는 미완료다. Windows/Android/Web 전체 qualification과 package qualification은 `notVerified`다. Apple/Linux native compile/build/run은 수행하지 않았고 사용자 지정 `SKIPPED`, provider `notVerified`를 유지한다. 다음 구현은 W6-04의 BoxConstraints 전체 의미·dry/intrinsic/baseline·relayout boundary와 Flex/공통 layout family이며 이후 paint/text/sliver 및 전체 W6-00~30을 계속한다. 이번 임시 ParentData test/draft/consumer/archive/log/screenshot/helper는 종료 확인 후 한 경로 allowlist preview/`-Execute`로 제거하고 재사용 Flutter checkout/Dart SDK는 보존한다.

**묶음 정리 완료:** allowlist preview 후 -Execute로 소유 parent-data/ 한 경로(38,294 files/6,523 directories/2,853,688,489 bytes)를 제거했다. root/ancestor·workspace 경계, descendant link 0, 참조 process 0을 확인했고 one-time helper도 제거했다. .tmp/work6/에는 재사용 flutter-source/와 dart-dev/만 남았다. 제품 source/template의 임시 helper 참조 부재, 정리 후 npm.cmd run check:types와 도구 compiler check, git diff --check가 통과했다. 현재 review 166개의 destination SHA256이 실제 파일과 일치한다. goal은 active이며 다음 W6-04 구현을 계속한다.

### 2026-10-11 — 제약·dry/intrinsic/baseline·Flex와 paragraph 배치 묶음

**전체 판정: PARTIAL, 목표 계속 진행.** W6-04의 측정 기반과 공통 box 배치를 구현했고 W6-06의 unbounded Text 제한을 줄였다. 전체 class·W6-04·M0/M1 및 W6 전체를 완료 처리하지 않는다. 이전 변경과 사용자의 copilot 지침은 보존했다. 코드 구성은 공통 6개 target에 적용하며 이번 실제 플랫폼 확인은 Web·Windows다.

| 작업 | 현재 구현과 남은 경계 |
| --- | --- |
| W6-01 | operator alias와 Object.prototype 이름에 가려진 toString 매핑을 수정했다. 상속 member의 선언 파일과 export class 파일을 각각 hash로 검증한다. getter로 없는 setter를 연결하지 않고 protected setter/public getter를 구분한다. 전체 자동 lowering·원본 갱신·design family 수락은 남음 |
| W6-04 | BoxConstraints raw/normalize·tight/loose/expand·copy/tighten/enforce/deflate·axis·aspect·interpolation·수치 method·validation을 구현했다. unnormalized/무한 최소값은 표현하되 실제 적용은 정규화·유한 최소값을 요구한다. signed-zero modulo는 partial |
| W6-04 | dirty relayout queue, layout dependency·parentUsesSize·sizedByParent resize, dry/intrinsic/actual·dry baseline을 연결했다. 최초 layout 전 size를 진단하고 immutable finite size를 protected setter로 설정한다. 측정 중 wet layout/size/offset 변경과 같은 종류의 재진입을 진단한다. constraint subtype equality를 보존하는 유한 cache를 사용한다. 전체 RenderObject/Sliver/compositing/debug는 남음 |
| W6-04 | 실제 RenderProxyBox/ConstrainedBox/Padding/PositionedBox, LimitedBox/AspectRatio/IntrinsicWidth/Height/IgnoreBaseline/Baseline과 widget, SizedBox named factory·Center·Align factor를 연결했다. Flex main-axis 분배·cross/stretch·RTL/up·baseline·spacing·unbounded loose flex, Stack dry/intrinsic/baseline·positioned 제약·overflow, RelativeRect/Positioned.fromRelativeRect를 구현했다. directional geometry·전체 clip·나머지 layout family는 남음 |
| W6-06 | Text/RenderParagraph가 intrinsic 폭으로 일반 unflexed Row 자식이 된다. 측정용 paragraph는 producer를 즉시 해제하고 painted paragraph/frame lease를 유지한다. 논리 content 폭과 backend layout 폭을 분리해 소수 intrinsic 경계의 재줄바꿈을 수정하고 start/RTL paint alignment를 연결했다. InlineSpan/WidgetSpan/전체 TextPainter·typography·selection·default font 정책은 남음 |

**pin·API·migration.** Flutter pin `71e4717a61786faab4c7aa39825989305ed29e8a`, selection **C# 24 / Dart 77개**, 실제 Dart 77개 분석이다. 수동 reviewed-port를 자동 lowering으로 집계하지 않는다. direct public subpath는 **56개**, barrel은 추가하지 않았다. raw CRLF analyzer span과 LF-normalized Git file/blob hash를 각각 검증했다. 실행한 pinned BoxConstraints 선언 SHA256은 `632143caa15fde1c659b6c5c82cbc5d1a6270c63519e2b8c74bb0231128607bb`다.

structural immutable geometry, string enum·child-first/positional/options 생성자, 명시 equals/local hash·multiply/divide/truncatingDivide/modulo를 사용한다. 검사는 all-build 진단이다. **Flex 기본값 max/center는 W5 min/start와 다르며** legacy mainSize/crossAlign은 유지한다. omitted textDirection은 W5 ltr fallback, explicit null은 방향 의존 배치에서 진단한다. parent가 child.size를 읽으면 parentUsesSize:true가 필요하고 최초 layout 전에는 hasSize를 검사한다. signed Insets deflation을 허용하지만 Padding은 finite nonnegative physical Insets를 요구한다. RelativeRect null-target lerp는 pin의 b null dereference를 수정해 a를 zero로 보간한다. LimitedBox dry baseline에도 제한된 child 제약을 적용한다. intrinsic nesting의 비용은 여전히 quadratic일 수 있다.

paragraph 폭은 surface와 독립적인 **0..16,777,216 logical units**이며 text/font/line/glyph budget은 유지한다. CanvasKit·RN builder와 C ABI renderer의 start alignment source를 연결했다. **독립 C ABI renderer compile/runtime은 이번 묶음에서 확인하지 않았다.** RNW/JSI common core compile과 구별한다. sample/template은 Builder→Expanded→Row→unflexed Text, Positioned.fill→Stack을 사용하며 theme/locale button의 fill 의도는 명시 Expanded로 유지한다.

**coverage.** 최신 집계는 **missing 73,013 / partial 608 / implemented 7 / adapted 400**, review **407개**다. 변경 파일의 이전 review 45개는 ParentData·Box/Flex/StackParentData·Builder/Flexible/Expanded/Positioned 계열의 unchanged member 의미를 다시 검토해 복원했고, 새 241개 member를 TS 차이와 함께 adapted로 기록했다. 새 member의 개별 acceptance는 **portable/runtime PARTIAL**로 유지한다. class·전체 단계는 partial이며 compiler 이름 일치만으로 완료를 올리지 않는다. regeneration에서 407개 record의 implementation/destination/differences/verification/evidence가 보존됐고 source diagnostics 0이다. 근거는 `flutter-coverage.json`의 `w6-layout-foundation-20261011`이다. 전체 74,028 record·47,282 public·778 files·15 entrypoints를 단순 구현 완료율로 해석하지 않는다.

**portable·Dart/WASM·패키지.** 20분 timeout으로 **23건 / 317 assertion / 6 files**가 통과했으며 도구 3건/18 assertion을 포함한다. 변경하지 않은 pinned BoxConstraints class를 작은 Size/Insets/diagnostics/ui shim과 Dart에서 실행해 수치·validation fixture **30개**를 비교했다. Dart VM 전체/Flutter engine 수락은 아니다. relayout boundary·의존성·constraint subclass equality·measurement cycle·wet mutation 진단·실패 후 retry·parentUsesSize·sizedByParent·Flex/Stack dry/wet/RTL/up/baseline·proxy family·GlobalKey State/render 이동을 확인했다.

실제 **CanvasKit 0.41.0 + NotoSansKR**에서 한국어/영문 세 문장의 LTR/RTL **6조합**을 shaping했다. font SHA256은 `194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252`다. intrinsic 폭 209.14999389648438/142.74000549316406/60.720001220703125에 backend layout 폭 210/143/61을 사용해 높이 32의 한 줄을 유지했다. RTL paint offset·측정 중 painted paragraph 유지·frame lease 이후 해제를 확인했다. CPU/WASM shaping은 GPU/display 수락과 별도다. SDK build·root check:types·도구 compiler, fresh archive의 **56개 ESM import/current source bytes/.js declaration**, 외부 consumer check·Metro build가 통과했다.

**실제 Web 화면.** 초기 bundle `099c708593502726de3d770a4ea90976be6464915848ff52c4c8adb4d1e402e3`은 자동 interaction이 통과했지만 screenshot에서 counter 재줄바꿈과 theme button 축소를 관측했다. 이를 시각 PASS로 기록하지 않았다. paragraph/content 폭 분리와 명시 button flex 수정 뒤 최종 source를 재pack/supply/**ci**했다. 최종 bundle SHA256은 **`c1816f0c2624b52b373593695a99ea6564c900228a74e049c9c2b0ae15579fdd`**다.

Chrome **154.0.8037.98** / Playwright **1.63.0**, 실제 WebGL2/ANGLE AMD Radeon 780M D3D11에서 한 줄 greeting/counter와 button 폭을 screenshot으로 확인했다. raw pointer counter 0→1, editor 부모 이동 3회와 같은 DOM/text `retained 한글 A😀B`·backward selection `[1,5]`, semantics action focus, theme/locale·detail/dialog/back, 960×1000→760×900 resize·canvas 1/input 2·page error 0이 통과했다. public SDK close 이후 canvas/input/font 0·context lost를 확인했다. 소유 server close ACK HTTP 200·exit 0, 브라우저 종료를 확인했다.

**Windows 공급·실제 실행.** 과거 d8a01c supplier는 변경된 generated/core/core.cpp hash mismatch로 prepare에서 거부됐다. guard를 약화하지 않고 build-windows-rn.py로 **16/16 CMake/Ninja Release/MD compile/link**를 수행했다. 새 manifest SHA256은 **`c1bf0760dc07649fca88ec8dd73924ed67c62f9ac36c242a3185da60b816a0fc`**, 18 libraries / 1,795 files / 220,903,493 bytes다. core.cpp SHA256 `95143febe75fdfef4b83c8dcb2a08029029e788ddf8f71a86eab7ae5f90e80ef`가 compiled/generated/packed source와 일치했다.

새 공급을 재사용 개발 입력 **`Nelyx/.cache/native/windows/w6-layout-c1bf0760dc07649f/inputs.json`**으로 복사하고 모든 file hash를 검증했다. 과거 sample의 remembered native input은 현재 core.cpp와 맞지 않는 역사적 입력이다. 이후 prepare에는 새 manifest를 명시하거나 native source가 바뀌면 새 공급을 빌드한다. runner/template README에도 source mismatch와 재빌드를 설명했다. 캐시는 production qualification이나 앱 runtime 도구 의존성을 뜻하지 않는다.

최종 source를 재pack/supply/ci한 **RNW 0.83.2 / RN 0.83.10 / JSI21**, x64 Release/MD, Windows SDK 10.0.26100.0 / MSBuild 18.9.1 빌드가 통과했다. package는 **901 files / 268,839,444 bytes**, exe SHA256은 **`94909bf8c2297785c87aed6807e1309bed56f80b34094ec8013a6959740a47f3`**다. manifest/locator/hash 검증 후 소유 PID **38252**, start `2026-10-11T10:56:42.1370353+09:00`, HWND 854524를 실행했다. vendor override를 제거한 기본 선택은 **AMD Radeon 780M Graphics vendor=4098 selection=primary-display**였다.

cursor 이동 후 및 down/up 사이 **80ms**를 둔 OS pointer로 counter 0→1, UIA value `w6 layout editor`, 같은 editor runtime identity·오른쪽 부모 이동·focus, window 1000×900→1200×900 resize에서 값/identity/focus 유지가 통과했다. 소유 whole window가 주 화면 안에 있는 screenshot에서 한 줄 greeting과 editor를 확인했다. native DPI와 Web DPR이 다르므로 physical window와 logical viewport를 동일 크기로 비교하지 않는다. 이 묶음은 native animation 두 시점·FPS/scanout을 측정하지 않았고 앞선 zero-gap 빠른 입력 실패를 해결했다고 확대하지 않는다.

cooperative close ACK HTTP 200, `closed views=0 consumers=0 gpuDrained=1`, INSTANCE_DESTROYED/APP_STOP 및 **exit 0 / forced=false**를 확인했고 helper/collector도 exit 0이다. fresh web 앱 config에 Windows target이 없어 prepare가 실패한 경로, source-mismatch 거부, UIA foreground setup 실패 후 scoped thread-input setup으로 재시도한 경로를 최종 성공과 구별했다.

**다음 경계와 정리.** RenderObject parent/owner/needsLayout의 public mutable 상태와 bulk child mutation 중 drop/attach 오류의 ownership 복구가 남아 있다. RenderFlex.computeDryBaseline은 baseline-aligned row에서 pin처럼 configured baseline을 사용하므로 요청 kind가 다른 경우를 partial로 유지한다. Wrap/Table/ListBody/Flow/custom layout·나머지 box family, Sliver/compositing·paint/text·전체 후속 W6-00~30이 남아 있다. Android의 현 변경본 runtime, 물리 IME/candidate window/reader·성능·production signing/clean-machine은 `notVerified`다. Apple/Linux compile/build/run은 사용자 지정 `SKIPPED`, provider `notVerified`를 유지한다.

이번 `.tmp/work6/layout/` assertion/oracle/draft/archive/consumer/native build/raw log/screenshot/helper는 소유 process 종료 후 명시 allowlist preview/`-Execute`로 정리한다. reusable Flutter checkout/Dart SDK와 위 source-matching native 공급 cache는 개발 입력으로 남긴다. 정리 결과와 마지막 compiler/hash 검사는 아래 후속 기록에 추가한다. 전체 goal은 active이며 commit/push는 수행하지 않았다.

**묶음 정리 완료:** 소유 layout/ 한 경로(42328 files / 7297 directories / 3849425409 bytes)를 allowlist preview 후 -Execute로 제거했다. root/ancestor·workspace 경계, descendant links 0, 참조 process 0를 확인했다. one-time helper도 제거했다. .tmp/work6/에는 reusable flutter-source/와 dart-dev/만 남았고 source-matching native 공급은 Nelyx/.cache/native/windows/w6-layout-c1bf0760dc07649f/에 보존했다. 삭제한 assertion/draft/archive/consumer/native build/raw log/screenshot은 남아 있지 않다. 마지막 compiler/hash 결과는 후속 기록에 추가한다.

최종 root check:types와 도구 compiler check, 407개 review의 declaring/export-source hash 및 최종 runtime source hash, 보존 native supplier manifest hash가 통과했다. git diff --check도 확인했다. 전체 goal은 active이며 다음 W6-04 ownership 오류 복구와 남은 layout family를 계속한다. commit/push는 수행하지 않았다.

### 2026-10-11 — RenderObject 소유권·오류 복구 묶음

**전체 판정: PARTIAL, 목표 계속 진행.** 이전 턴은 실제 구현·수락·기록·정리를 완료한 progress로 분류했다. 이번에는 W6-03/04의 render ownership과 실패 경로를 보강했다. 전체 RenderObject/PipelineOwner·W6-04 및 후속 W6-00~30을 완료 처리하지 않는다. 사용자/이전 변경을 보존했고 commit/push는 수행하지 않았다.

**구현·API 변경.** RenderObject의 **parent/owner/needsLayout**과 PipelineOwner.root를 읽기 전용 getter로 바꿨다. rootNode getter/setter를 실제 root 교체에 연결하고 setRoot도 유지한다. depth는 부모가 더 깊어질 때 descendant까지 올리며 얕은 이동에서 낮추지 않는다. attached root를 자식으로 채택하거나 붙어 있는 부모보다 자식을 먼저 직접 detach하는 잘못된 소유권을 진단한다. mutation/measurement/layout/attach/detach 중 재진입을 막으며, pipeline별 tree transition을 추적해 미완료 child attach hook에서 root 교체·flush·dispose로 끼어드는 경로도 막는다.

bulk setChildren은 입력 목록을 snapshot하고 **새 자식 채택을 먼저 stage**한다. 채택 실패는 staged 자식을 모두 분리하고 이전 목록/parent/owner를 보존하며 원래 unparented ParentData 참조를 복원한다. 성공하면 요청 목록과 sibling link를 반영한 뒤 모든 outgoing child 정리를 계속한다. 제거 hook 오류에서는 요청한 최종 목록이 유지된다. before/after-super 오류와 super 누락도 base ownership을 복구하며, 복수 오류는 원래 객체를 보존한 AggregateError로 보고하고 단일 원인은 그대로 전달한다. 임의 custom hook의 외부 side effect까지 역전하는 계약은 아니다. subclass hook은 여전히 super 호출과 자신의 외부 자원 정리를 책임진다.

root 교체도 새 root attach 실패는 이전 root를 보존하고, outgoing root detach 오류는 새 root를 반영한 뒤 정리를 계속한다. PipelineOwner.dispose는 terminal/idempotent이며, RenderObject.dispose는 child cleanup 오류가 있어도 자신의 dead 상태·dependencies·pointer/semantics를 정리한다. **Element 소유 자식 자체를 대신 dispose하지 않는다.** detach는 dirty queue의 이전 참조를 제거한다. flushLayout 한 boundary가 실패해도 아직 처리하지 않은 dirty node를 다음 flush에 보존한다. layout/paint invalidation callback이 실패해도 이미 반영된 트리와 dirty 상태를 잃지 않는다. Paragraph teardown은 base 정리 오류 후에도 dead 상태이면 painter producer 정리를 시도한다.

Element/BuildOwner는 detach hook 하나의 실패 때문에 sibling deactivation/finalize가 중단되지 않도록 수정했다. RenderObjectElement는 attachment/ParentData 적용 실패를 rollback하고, remove hook이 base 제거를 끝내지 않았으면 실제 parent에서 분리한다. 이미 detached된 root의 hook은 unmount에서 중복 호출하지 않는다. configurable reporter에서 모든 build 실패를 재시도 가능한 ErrorWidget으로 바꾼 것은 아니며 전체 BuildScope/error/debug 계약은 남아 있다. README 영어/한국어에 읽기 전용 API, 교체 실패 의미, monotonic depth와 custom hook 책임을 설명했다.

**pin·coverage.** Flutter pin `71e4717a61786faab4c7aa39825989305ed29e8a`의 parent/owner/depth/adopt/drop/attach/detach/dispose 및 rootNode 선언을 읽었다. PipelineOwner selection을 추가해 **C# 24 / Dart 78개**, 실제 Dart 78개 분석이다. direct public subpath는 **56개**이며 barrel은 추가하지 않았다. 이전 ESM source map의 embedded source가 기록된 SHA256과 일치함을 먼저 검증하고 TS AST token을 비교했다. unchanged member 222개를 재검토했고 마지막 object hash 변경 때 24개를 다시 갱신했다. 새 getter/redepth/rootNode 9개만 adapted로 검토했으며, 바뀐 **RenderBox.markNeedsLayout·Element.detachRenderObject·RenderObjectElement.attachRenderObject/detachRenderObject** 4개는 partial로 유지했다.

최신 집계는 **missing 73,009 / partial 607 / implemented 7 / adapted 405**, review **412개**다. regeneration에서 이 412개 record의 implementation/destination/differences/verification/evidence가 보존됐고 diagnostics 0이다. 새 근거는 `flutter-coverage.json`의 `w6-render-ownership-20261011`이다. 이전 layout/native 실행 기록은 해당 이전 source bytes의 역사적 증거로 유지한다. 전체 74,028 record·47,282 public 집계를 구현 완료율로 단순 해석하지 않는다.

**portable·packaged 소비.** 20분 timeout의 최종 **17건/256 assertion**과 fixture strict compiler가 통과했다. 읽기 전용 getter의 runtime 대입 거부, before/after/missing-super 오류, ParentData+detach 복수 오류, staged rollback, reentrant child steal/layout/pipeline close, root replacement·terminal dispose, 실패 뒤 dirty boundary 재시도, callback 오류 뒤 committed tree 유지, 측정 mutation 진단/retry, descendant depth, GlobalKey State/render의 Flex→Stack 이동, sibling deactivation/finalize·registry 해제, semantics callback 정리·외부 소유 자식 수명을 확인했다. 한 번의 10,000 linked reverse 측정은 **8.1896 ms**였으며 frame budget/반복 성능 qualification이 아니다. initial sibling finalize 실패에서 중복 detach hook 호출을 발견해 수정했고 최종 통과했다. 중간 archive는 마지막 pipeline transition guard 이전이므로 현재 source 수락으로 쓰지 않았다.

`npm.cmd run build:sdk`, root check:types·도구 compiler, 외부 consumer check·Metro build가 통과했다. 최종 archive를 supply 후 **ci**로 설치했고, **56개 ESM 경로/current source bytes/.js declaration** 및 packed 오류 복구 probe가 통과했다. current render object SHA256은 `a688fceebea88424f2b066c04c1f6a0708835ebdc55b694cbb5ab32984818c29`, framework는 `1eb5821b64e6a8c5d0f0e3bdbe8412789eb64bc8461b60f5a0a4465e58662e00`, boxes는 `20146e98c3a9581acbbd4de809a7f8ec663fbad683ed0bee411398bdd4823eed`다.

**실제 Hermes CLI·Web.** pinned RNW NuGet `microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d`의 x64 Hermes CLI에서 현 source IIFE를 실제 실행했다. exe SHA256은 `74b975947a885939296540664f1f6c0067d1ff4b409f105377ac256a3d3f33cc`다. parent-data/detach 두 오류의 AggregateError 원인, read-only owner, sibling ownership 정리와 terminal dispose가 통과했다. **CLI 실행은 Windows React Native host/native GPU·입력 수락과 별도다.** 이번 ownership 변경본의 Windows native host 및 Android runtime은 `notVerified`; 앞선 layout bundle의 native PASS 범위를 이 변경본으로 확대하지 않는다. C++ source 변경은 없으며 C1 native supplier cache는 계속 보존한다.

최종 Web bundle SHA256은 **`539b73351574e4dae9820dbe4eecbd0fd8f9c23aff1bf7ec61d2d5217200511c`**다. Chrome 154.0.8037.98/Playwright 1.63.0, 실제 WebGL2/ANGLE AMD Radeon 780M D3D11에서 pointer counter 0→1, 부모 이동 3회·동일 DOM/text `ownership 한글 A😀B`·backward selection `[1,5]`, semantics focus, theme/locale·detail/dialog/back, 960×1000→760×900 resize·canvas 1/input 2·page error 0이 통과했다. screenshot에서 한 줄 greeting과 button 폭·editor를 확인했다. public SDK close 후 canvas/input/font 0·context lost, server close ACK HTTP 200·소유 PID 28472 exit 0·브라우저 종료를 확인했다. programmatic UTF text/DOM selection을 물리 IME나 reader 수락으로 해석하지 않는다.

**남은 경계·정리.** paint/compositing/semantics queue, invokeLayoutCallback, 전체 PipelineOwner/manifold/Sliver, directional alignment/insets, Wrap/Table/ListBody/Flow/custom layout와 나머지 W6 family를 계속한다. physical input/IME/candidate window/reader·성능·production signing/clean-machine은 notVerified다. Apple/Linux 전용 compile/build/run은 사용자 지정 SKIPPED, provider notVerified를 유지한다. 이번 ownership/의 test/draft/source-map copy/archive/consumer/Metro 출력/raw log/screenshot/Hermes probe/helper는 explicit allowlist preview 후 -Execute로 제거한다. reusable Flutter checkout/Dart SDK와 이전 current-source native cache는 개발 입력으로 남긴다. 실제 정리·마지막 hash/diff 결과는 아래 후속 기록에 추가한다. 전체 goal은 active다.

**묶음 정리 완료:** 소유 ownership/ 한 경로(8253 files / 1363 directories / 602858744 bytes)를 allowlist preview 후 -Execute로 제거했다. root/ancestor·workspace 경계, descendant links 0, 참조 process 0를 확인했고 one-time helper도 제거했다. .tmp/work6/에는 reusable flutter-source/와 dart-dev/만 남았다. C1 native supplier cache도 보존했다. 삭제한 test/draft/archive/consumer/raw log/screenshot/Hermes probe는 남아 있지 않다.

최종 SDK build·root/도구 compiler 결과는 위 source bytes의 PASS를 유지한다. 정리 후 412개 review의 declaring/export-source 및 current runtime source hash가 일치하고 git diff --check가 통과했다. 전체 goal은 active이며 다음 W6-04의 Wrap/Table/ListBody/Flow/custom layout와 나머지 family를 계속한다. commit/push는 수행하지 않았다.

### 2026-10-11 — Wrap·ListBody와 반응형 배치 묶음

**전체 판정: PARTIAL, 목표 계속 진행.** 이전 ownership 묶음은 구현·검증·기록을 완료한 progress다. 이번에는 W6-04의 Wrap/ListBody를 별도 책임 module로 추가했다. 전체 Wrap/ListBody class·W6-04·후속 W6-00~30을 완료 처리하지 않는다. 사용자/이전 변경은 보존했고 commit/push는 수행하지 않았다.

**실제 구현과 연결.** 새 직접 subpath는 **framework/rendering/wrap·framework/rendering/list-body·framework/widgets/wrap·framework/widgets/list-body**, core export는 **60개**다. basic.ts/boxes.ts에 family를 계속 합치거나 barrel을 추가하지 않았다. RenderWrap은 실제 child 측정→run 구성→위치 배치, 개별 child/run spacing·6종 alignment 분배·cross alignment·horizontal/vertical·RTL/up·intrinsic·actual/dry baseline과 WrapParentData를 제공한다. dry query는 wet size/offset을 변경하지 않고 shared dependency/cache 계약을 사용한다. signed finite spacing을 지원하며 실제 child bounds overflow도 검사한다. parent data sibling/순서·paint/hit/semantics는 공통 RenderBox tree에 연결한다.

RenderListBody/ListBodyParentData는 4개 axisDirection, finite tight cross stretch·unbounded main 제약, 원래 child 순서와 reverse offset, intrinsic/baseline·dry/wet 배치를 제공한다. widget은 live Directionality와 reverse를 해석한다. 원본처럼 main axis가 bounded이거나 cross axis가 unbounded이면 진단한다. Wrap widget은 ambient Directionality를 사용하며 raw RenderWrap은 수평 order/start/end를 해석할 textDirection이 필요하다. 생성자는 child-first/widget options 및 render options object, geometry는 structural 값, enum은 string literal이며 검사는 all-build다.

**Clip 경계는 미완료다.** Wrap은 기존 frame replay가 실제 제공하는 **none/antiAlias 사각 clip**만 연결했다. hardEdge·antiAliasWithSaveLayer·retained layer·전체 paint/compositing/diagnostics는 W6-05에 남는다. 미지원값을 alias로 받아 조용히 생략하지 않고 진단하며 RenderWrap/Wrap constructor·clipBehavior·paint 및 class 상태는 partial이다. 전체 Clip 요구를 완료 범위 밖으로 옮긴 것이 아니다. 새로운 paint opcode/ABI/native C++ 변경은 이 묶음에 없다.

**실행한 pin과 명시 보정.** Flutter pin `71e4717a61786faab4c7aa39825989305ed29e8a`의 Wrap/ListBody 전체 layout source를 읽었다. source file의 LF-normalized hash를 검증하고 import/library prefix 아래 **변경하지 않은 Dart class/helper 코드**를 작은 RenderBox/Constraints/engine/diagnostics/paint shim과 실행했다. fragment SHA256은 wrap `145dfa8778d2d45fcfe8d376fbed88c779553ab243ca8bf37d6779c28d310310`, list_body `78a74cce52493da51518092ce4f218a55e64eee98e6c6f7745dc6a55f5e81c33`다. 14개 fixture의 wet size/offset이 TS와 일치했다. **실제 Flutter engine/device 실행을 뜻하지 않는다.** 아래 불일치를 source 실행으로 관측해 TS에서 보정했다.

| pin에서 관측한 값 | 현재 보정 |
| --- | --- |
| Wrap center-run dry baseline 36, wet 34; RTL/up dry 51, wet 47 | dry positioning에도 content extent 대신 실제 free run space를 사용해 wet과 동일한 34/47 |
| width 75−5e−11에서 Wrap dry 40×37, wet은 한 run의 높이 20 | dry/wet에 같은 1e−10 run-break tolerance 사용 |
| Wrap max intrinsic main extent에 child spacing 누락: 40→50, 120→130 | gaps와 signed overlap bounds를 포함 |
| vertical ListBody max intrinsic height 25, 실제 합 40; horizontal은 합 40, 실제 cross max 25 | 해당 dimension의 main/cross에 맞춰 sum/max 사용 |
| ListBody up dry baseline 4, wet 33; horizontal dry 4, wet 8 | 첫 logical child의 실제 positioned offset과 baseline을 dry에도 적용해 33/8 |

**portable·coverage·패키지.** 20분 timeout으로 **15건/270 assertion/2 files**, strict fixture compiler가 통과했다. 6종 main/run 분배·single spaceBetween·RTL/up·독립 spacing·signed overlap·dry purity/cache·baseline·overflow clip command·own hit bounds/semantics crop·제약 오류·live Directionality·GlobalKey State/render Stack→Wrap 이동을 확인했다. source execution은 14개 상이한 fixture이며 수백 회 반복하지 않았다. C# selection **24 / Dart 84개**, 실제 Dart 84개 분석이다. reviewed-port를 자동 Dart lowering 성공으로 집계하지 않는다. 기존 Flutter/Doroti/listen notice와 Nelyx BSD-3-Clause 정책을 유지했다.

새 own member **55개**를 검토해 현재 **missing 72,938 / partial 623 / implemented 7 / adapted 460**, review **467개**다. compiler 이름 연결만으로 class나 미완료 Clip을 완료 처리하지 않았다. 새 member의 portable/runtime acceptance는 PARTIAL이며 scoped tests와 별개다. regeneration에서 467개 record의 implementation/destination/differences/verification/evidence가 보존됐고 diagnostics 0이다. 근거는 flutter-coverage.json의 **w6-flow-layout-20261011**이다. 전체 74,028 record·47,282 public 집계를 단순 구현 완료율로 해석하지 않는다.

SDK build·root check:types·도구 compiler, 새 archive의 **60개 ESM import/current source bytes/.js declaration**과 packed Wrap/ListBody geometry, fresh consumer의 install/check/Metro build가 통과했다. source module export를 추가한 직후 이전 dist에는 새 declaration이 없어 sample check가 실패했지만 SDK build 뒤 최종 check는 통과했다. final CLI archive로 새 소비 앱을 만들었으며 src/app.ts가 sample/template와 byte 단위로 같음을 확인했다. final archive에는 467개 member review 결정이 들어 있고 최종 runtime/cleanup evidence는 이후 repository coverage에 기록했다.

**실제 소비와 실패 보존.** sample/template의 action control/title group은 ListBody, action button은 Wrap으로 바꿔 좁은 폭에서 다음 run으로 이동한다. 초기 bundle `158b07996f296b09268bf6c3033d35074e5297581ca201ce828effbf34716f58`은 control reflow는 통과했으나 230px screenshot에서 기존 unflexed header Row의 Text가 image와 겹쳤다. 이를 시각 PASS로 확대하지 않았다. header를 bounded Wrap으로 바꾸고 final CLI archive에서 fresh app을 생성해 다시 확인했다. 이전 일반 unflexed Row Text API 자체를 제거한 것은 아니다. 최초 자동화 selector가 HTML button의 implicit role을 빠뜨린 실패도 native button selector로 수정했으며 제품 semantics는 이 이유로 변경하지 않았다.

최종 Web bundle SHA256은 **dd6ea33b77e39000ee6f273aadf60601494d55d70b15fbfe2f33fed682eb2331**이다. Chrome 154.0.8037.98 / Playwright 1.63.0, 실제 WebGL2/ANGLE AMD Radeon 780M D3D11에서 pointer counter 0→1, editor 부모 이동 3회·동일 DOM/text `flow 한글 A😀B`·backward selection `[1,5]`, semantics focus, theme/locale·detail/dialog/back, 960×1000→760×900→230×900 resize가 통과했다. 760px theme/locale y=411로 같은 run, 230px theme y=427/height 54·locale y=493으로 **12px gap**의 다음 run이며 x=20이 유지됐다. wide/narrow screenshot에서 header가 image를 가리지 않고 두 줄로 표시되는 것을 확인했다. canvas 1/input 2/page error 0, public SDK close 후 canvas/input/font 0·context lost, server ACK HTTP 200·소유 PID 32564 exit 0·브라우저 종료를 확인했다.

pinned RNW x64 Hermes CLI(이전과 같은 exe SHA256 `74b975947a885939296540664f1f6c0067d1ff4b409f105377ac256a3d3f33cc`)에서 현 source IIFE의 RTL/up Wrap offset·dry/wet baseline·reverse ListBody offset·정리가 통과했다. **CLI는 Windows native host/GPU·입력 수락과 별도다.** 이 변경본의 Windows native host·Android runtime, physical IME/reader·성능·production signing/clean-machine은 notVerified다. Apple/Linux 전용 compile/build/run은 사용자 지정 SKIPPED, provider notVerified를 유지한다.

**다음 작업·정리.** Table/Flow/custom layout 및 나머지 공통 box family, full directional geometry·Clip/layer·Sliver와 전체 후속 W6를 계속한다. 이번 flow-layout/의 source-execution shim/oracle/assertion/draft/archive/consumer/Metro output/raw log/screenshot/Hermes probe/helper는 종료 확인 후 explicit allowlist preview/-Execute로 정리한다. reusable Flutter checkout/Dart SDK와 C1 native supplier cache는 개발 입력으로 보존한다. 정리와 마지막 source hash/diff 검사는 아래에 기록한다. 전체 goal은 active다.

**묶음 정리 완료:** 소유 flow-layout/ 한 경로(15791 files / 2703 directories / 587264565 bytes)를 allowlist preview 후 -Execute로 제거했다. root/ancestor·workspace 경계, descendant links 0, 참조 process 0를 확인했고 one-time helper도 제거했다. .tmp/work6/에는 reusable flutter-source/와 dart-dev/만 남았다. C1 native supplier cache도 보존했다. 삭제한 oracle/test/draft/archive/consumer/raw log/screenshot/Hermes probe는 남아 있지 않다.

최종 SDK build·root/도구 compiler의 PASS를 유지하고, 정리 후 467개 review의 declaring/export-source와 current Wrap/ListBody/sample/template source hash·60개 직접 export를 확인했다. git diff --check가 통과했다. 전체 goal은 active이며 다음 Table/Flow/custom layout와 남은 W6 작업을 계속한다. commit/push는 수행하지 않았다.

### 2026-10-11 — CustomSingleChildLayout·CustomMultiChildLayout·LayoutId 묶음

**전체 판정: PARTIAL, 목표 계속 진행.** W6-04의 사용자 정의 layout family를 구현·연결·검증했다. 전체 class·W6-04 및 W6-00~30을 완료 처리하지 않는다. 이전 변경과 사용자 copilot 지침은 보존했고 commit/push는 수행하지 않았다.

**실제 구현.** framework/rendering/custom-layout·framework/widgets/custom-layout를 직접 module로 추가해 core public subpath는 **62개**다. SingleChildLayoutDelegate·MultiChildLayoutDelegate·각 RenderCustom box·MultiChildLayoutParentData·CustomSingleChildLayout·CustomMultiChildLayout·LayoutId를 제공한다. 부모 getSize는 자식 측정과 독립적이고 incoming constraints로 constrain한다. 부모 size를 child layout 전에 지정한다. 기본 constraints.biggest와 intrinsic infinity→0은 pin의 실제 동작이며 unbounded 실제 크기에는 finite 진단을 낸다. 음수 delegate size는 constraints 최소값으로 clamp한다. Single은 child constraints/offset, tight child의 parentUsesSize=false, actual/dry baseline을 연결한다. Multi의 child baseline은 원본처럼 null이며 가짜 child baseline을 제공하지 않는다.

Multi delegate는 임의 순서로 child constraints·위치를 지정한다. 각 child ID가 고유하고 layoutChild를 정확히 한 번 호출해야 한다. 같은 delegate를 부모/자식이 공유해도 finally에서 바깥 scope를 복원한다. getSize/활성 performLayout 밖의 helper·없는 ID·중복 ID·중복/누락 layout·부정 constraints/offset을 all-build 진단한다. ID/default LayoutId key는 primitive ===, 일반 object reference, Nelyx Key의 명시 equal/hash 정책이며 null/undefined/NaN은 거부한다. Dart의 임의 operator override를 JS에 자동 이식했다고 주장하지 않는다.

**수명주기와 오류.** typeToken(기본 constructor) 변경은 relayout, 같은 token은 shouldRelayout을 사용한다. relayout notifier는 widget rebuild 없이 layout을 갱신한다. 구독은 attached render object/View별이다. 새 listener 등록 실패는 기존 delegate/binding을 유지하고 실패 callback을 비활성화하며 원인/cleanup 오류를 함께 보존한다. 이전 listener 제거 실패는 새 상태를 commit하고 이전 callback을 비활성화한다. attach 실패의 owner rollback·invalid direct child detach의 binding 유지·close 후 callback 차단·동기 addListener notify buffering을 검증했다. 외부 Listenable이 제거에 실패하면 callback은 inert이지만 외부 등록 side effect/메모리 회수를 보장하지 않는다.

RenderObject에 protected assertCanMutateLayoutProperty를 추가해 measurement/active layout/tree transition에서 delegate 변경을 state mutation 전에 거부한다. 저장한 이전 raw file SHA256 **a688fceebea88424f2b066c04c1f6a0708835ebdc55b694cbb5ab32984818c29**을 검증하고 새 guard를 제외한 기존 source text가 LF-normalize 후 정확히 동일함을 확인했다. 기존 **33개** declaring/export-source review를 다시 검토해 current hash로 갱신했고 434개는 유지했다. 기존 전체 ownership/class 완료 판정을 확장하지 않았다.

**pin 실행과 portable.** Flutter pin 71e4717a61786faab4c7aa39825989305ed29e8a에서 변경하지 않은 class fragment **5개**를 Dart 3.14.0-296.0.dev와 작은 RenderBox/constraints/engine/diagnostics shim으로 실행했다. SingleChildLayoutDelegate·RenderCustomSingleChildLayoutBox·MultiChildLayoutParentData·MultiChildLayoutDelegate·RenderCustomMultiChildLayoutBox의 **9 fixture**가 TS의 constrained/dry/wet size·offset·intrinsic·actual/dry baseline과 일치했다. 전체 Flutter engine/device 실행을 뜻하지 않는다. fragment별 hash·fixture 결과는 coverage evidence에 남겼다.

20분 timeout으로 **16건/133 assertion/2 files**, strict fixture compiler·root check:types·SDK build가 통과했다. geometry 외에 ID equality/default keyed State reorder·GlobalKey render parent 이동·측정 중 wet read/delegate mutation·nested delegate·missing/duplicate/layout retry·listener add/remove aggregate failure·동기 notify·동일 delegate의 두 View 구독·close 후 해제를 검증했다. notifier 갱신 후 BuildOwner.hasDirty=false와 State build 횟수 1도 확인했다. Full diagnostics/paint/compositing/semantics queues·invokeLayoutCallback·나머지 layout family는 남아 있다.

**도입/coverage/패키지.** selection은 **C#24/Dart92**, 실제 92 symbol 분석 PASS다. source selection은 LF-normalized upstream hash를 사용하고 raw analyzed span hash는 별도로 유지한다. 74,028개 coverage는 **missing 72877/partial 633/adapted 511/implemented 7**, 근거가 있는 review는 **528개**다. 새 61개 review 중 class/paint/parent-data 전체 diagnostics는 partial이며 source-private helper 이름을 자동 완료 처리하지 않았다. 6개 새 archive로 외부 CLI consumer를 생성·설치해 current source bytes·62 ESM public imports·.js declaration specifiers·packed relayout/multi geometry·current sample/template를 검증했다. 설치된 CLI의 실제 Web build도 PASS다. 최종 runtime/cleanup 기록은 패키지 snapshot 이후 repo coverage에 추가했다.

**실제 실행.** sample/template progress bar는 직접 delegate.relayout로, 두 editor slot은 실제 두 Column parent 아래 LayoutId로 배치한다. Node v24.15.0와 pinned RNW x64 Hermes CLI에서 relayout width 35·nested scope/phase guards·구독 cleanup PASS다. Hermes CLI는 Windows native host 실행과 별도다. Web Chrome 154.0.8037.98, 실제 WebGL2 ANGLE (AMD, AMD Radeon 780M Graphics (0x00001900) Direct3D11 vs_5_0 ps_5_0, D3D11)에서 progress bar 40→160px(rounded 끝을 제외한 solid interior 38→158)을 관측했다. 처음 opaque pixel assertion을 40으로 둔 fixture가 실패해 AA 끝을 반영했으며 product 변경은 없었다.

Web 편집기 x **486→20→486** 세 번 이동 후 동일 DOM input·텍스트·backward [1,5] 선택을 유지했다. semantics focus·theme/locale·detail/dialog/back·760→230 responsive wrap PASS, screenshots를 확인했다. public SDK close 후 canvas/input/font=0·contextLost=true·page errors=[]다. 실제 bundle SHA256은 **c91d3e27a928088cb164ce592b4fa15bc416acb0d395adb83b4cb0c9d235aa55**, server는 close ACK HTTP 200; owned PID 1152 exit 0; browser closed다. current Windows native host/Android 실행·physical IME/reader·performance/scanout·서명/clean-machine acceptance는 notVerified다. Apple/Linux native 검증은 사용자 지정 SKIPPED, provider는 notVerified이며 코드 구성 대상은 유지한다.

**현재 source SHA256.**

| file | SHA256 |
| --- | --- |
| Nelyx/src/framework/rendering/object.ts | fe8ff908e2eed0ecd2bb42acfbddaf55d1a08c6be61edb2594744be55f79a2d6 |
| Nelyx/src/framework/rendering/custom-layout.ts | 6c2fa10860c4150092aa49da086a3d7935ecf2f97aaf066c61d5a607d474bcca |
| Nelyx/src/framework/widgets/custom-layout.ts | 8a49ab6e7e945836ba8e83de55d327c237f4bf09704f41ec7746a8dd8c0859e6 |
| sample/nelyx-testbed-app/src/app.ts | 31b379910f04f8d906127d4e516c645bfce38ece77d3371b8b961ce5d912d204 |
| Nelyx/sdk/tooling/cli/templates/nelyx-app/src/app.ts | 31b379910f04f8d906127d4e516c645bfce38ece77d3371b8b961ce5d912d204 |

정리와 최종 hash/coverage 재생성 검증을 이어간다. 전체 goal은 active이며 다음 Table/Flow와 남은 W6-04 및 paint/layer·후속 family를 계속한다.

**정리 완료.** 명시 allowlist .tmp/work6/custom-layout의 7901 files/1356 directories/421488831 bytes를 preview 후 -Execute로 제거했다. descendant link/process reference=0을 확인하고 한 번 쓰는 cleanup helper도 제거했다. 테스트/원본 실행 shim·draft·packed consumer/archives·raw logs/screenshots/servers를 정리했으며 재사용 Flutter pin/Dart SDK/C1 native supplier cache는 보존했다. cleanup 후 current runtime source 및 528 reviewed declaring/export-source hashes가 일치한다. coverage 재생성도 528개 review의 semantic fields를 유지했고 사전 git diff --check는 PASS다. 전체 goal은 active다.

### 2026-10-11 — Table column/row layout·keyed row 연결 묶음

**전체 판정: PARTIAL, 목표 계속 진행.** 이전 custom layout 묶음은 구현·검증·기록/정리를 끝낸 progress다. 이번에는 W6-04의 실제 Table 배치를 구현했다. 전체 Table·W6-04·후속 작업을 완료 처리하지 않는다. 사용자/이전 dirty 변경을 보존했고 commit/push는 수행하지 않았다.

**구현과 API.** framework/rendering/table·framework/widgets/table 직접 module을 추가해 core public subpath는 **64개**다. TableColumnWidth와 Fixed/Fraction/Flex/Intrinsic/Min/MaxColumnWidth는 실제 intrinsic 측정·ideal 폭·flex 확장·min-width 균등 확장·최소값을 지키는 반복 축소를 수행한다. JS one-shot iterable은 combined algorithm 내부에서 materialize해 양쪽 algorithm에 같은 cell을 전달한다. finite nonnegative width·positive flex·safe integer grid를 all-build 검사하며 원본처럼 최소 column 합이 constrained table보다 크면 content가 overflow할 수 있다. intrinsic 측정의 비용을 프레임 성능 수락으로 대신하지 않는다.

RenderTable/TableCellParentData는 row-major null hole·column/row resizing·setChild/addRow/setFlatChildren/setCellRows·lazy row/column 조회·row boxes, top/middle/bottom/baseline/fill/intrinsicHeight·RTL·intrinsic·pure dry geometry와 baseline을 제공한다. fill-only row의 content 높이는 0이며 parent min-height가 row를 자동 stretch하지 않는다. intrinsicHeight는 처음 자연 높이를 측정하고 row 높이로 재배치한다. 부모가 child size를 읽는 경로는 parentUsesSize=true, tight fill/stretch는 false다. zero-column/empty grid도 baseline/row geometry를 초기화한다.

Dart RenderTable.setChildren(rows)는 **setCellRows**로 제공한다. 상속받은 flat setChildren은 기존 RenderObject 소유권 계약을 유지하며 base pruning에서 제거된 cell 자리는 null로 보존한다. 삽입/재배치는 setFlatChildren/setChild로 grid를 확정한 뒤 layout한다. 초기 GlobalKey 교체 검증에서 base pruning을 완전한 cell 배열로 잘못 해석해 실패했고 이 실제 product 문제를 수정했다. adoption 실패는 이전 grid/부모/owner를 유지하고 outgoing 제거/notification 실패는 새 grid를 commit하면서 원래 cause를 보고한다. 제거한 render box의 최종 dispose는 외부 owner 책임이다.

Table/TableRow/TableCell은 실제 render tree/ParentData에 연결한다. 내부의 render 없는 row grouping Element는 LocalKey row와 unkeyed row ordinal을 재사용하고 cell State를 유지한다. row key 및 표 전체 cell key 중복·irregular/empty row·부정 ParentData ancestor·baseline 설정 누락을 진단한다. ambient Directionality 변경과 Stack→Table의 GlobalKey State/render 이동·RTL/bottom 배치·hit test가 확인됐다. sample/template detail 화면은 실제 2열 Table로 초기 항목/텍스트를 표시한다.

**남은 Table 기능.** TableBorder·row Decoration/ImageConfiguration/painter 수명·표/row/cell 전용 semantics·전체 diagnostics/paint는 missing/partial이다. TableCell은 실제 ParentData를 제공하지만 아직 원본의 cell semantics wrapper는 없다. 지원하지 않는 paint 옵션을 가짜 alias로 추가하지 않았고 constructor/class/paint 및 관련 review를 완료 처리하지 않았다. 현재 공통 child paint/hit/semantics 수명만 연결한다. 새 paint opcode/ABI/native C++ 변경은 없다.

**원본 실행과 보정.** pin 71e4717a61786faab4c7aa39825989305ed29e8a의 **변경하지 않은 class fragment 8개·RenderTable method fragment 12개**를 SHA256 검증 후 Dart 3.14.0-296.0.dev의 임시 wrapper·작은 RenderBox/constraints/geometry shim과 실행했다. **18 fixture**의 column algorithm·축소/overflow·bounded/unbounded·RTL·hole·row height/position·intrinsic·row boxes를 TS와 비교했다. 전체 Flutter engine/device 실행 증거는 아니다. source fragment별 hash와 원본 관측값은 coverage evidence에 보존했다.

| 실행한 pin의 baseline 사례 | TS의 명시 보정 |
| --- | --- |
| baseline 없는 세 번째 cell offset y=14, 주석은 top alignment | y=0으로 top 정렬 |
| configured alphabetic wet baseline=14, queried ideographic dry=17 | dry/wet 모두 configured textBaseline의 14 |
| baseline row dry layout unsupported | child의 pure dry size/baseline이 있으면 120×36 지원; 없는 dry metric은 진단 유지 |

**검증/도구/coverage.** 20분 timeout으로 **16 tests/1193 assertions/2 files**, strict fixture·root·port-tool compiler와 SDK build PASS다. 1193 assertion은 18개 구조화 geometry 결과의 수치 비교를 포함하며 수백 회 반복 실행한 수가 아니다. listener/layer 없는 family에 가짜 native evidence를 만들지 않았다. selection은 **C#24/Dart104**, 실제 104 symbol 분석 PASS다. coverage 도구에 RenderTable.setChildren→setCellRows의 실제 명칭 대응을 추가했으며 이름만으로 동작을 자동 승격하지 않는다. 재생성 후 **639개 review**의 semantic fields가 유지됐다. 현재 74,028 records는 **missing 72765/partial 655/adapted 601/implemented 7**이며 전체 구현률이 아니다. 기존 528개 review는 유지하고 새 111개를 검토했다.

**패키지와 실제 실행.** 6 archive로 만든 외부 CLI consumer에서 Node v24.15.0의 **64 ESM public imports·.js declaration 경로·current source bytes·실제 packed RTL geometry**가 PASS다. sample/template bytes가 일치하고 consumer compiler·Metro static Web build도 PASS다. 최종 current archive는 639개 review snapshot을 포함한다. 중간 supply 후 npm install이 lock의 archive 경로만 갱신하고 이전 installed source를 남긴 것을 hash 비교로 발견했다. stale widget a62d730b0a6f363c8cce3d8e672d652406ccd995b3eda39a31b90e7fc2c55ad4, expected/current a83b559d83326ad73b46f67117e0986b92efa0c7d8a7934329f015158d4ce9de이며 npm ci 후 일치를 재확인했다. 해당 stale build 1341f62e2f4bb480a5cd2e2be35b66569ee560598214ac0070b38c4adc573edb는 최종 runtime 증거로 취급하지 않는다.

Pinned RNW x64 Hermes CLI에서 실제 36px baseline row·baseline 14·RTL shrink·cell 이동 parent data 유지·제거 slot/cleanup PASS다. Windows native host 실행과 별도다. Web Chrome 154.0.8037.98, 실제 WebGL2 ANGLE (AMD, AMD Radeon 780M Graphics (0x00001900) Direct3D11 vs_5_0 ps_5_0, D3D11)에서 표 첫 열 **96px**, 둘째 열 **816→86px**, 내용 높이 **26→52px**를 확인했다. wide/narrow screenshot과 geometry를 확인했다. 편집기 세 번 이동 x486→20→486 후 동일 input/text/backward [1,5] 선택을 유지했고 semantics focus·theme/locale·detail/dialog/back·home responsive PASS다. public SDK close 후 canvas/input/font=0·contextLost=true·page errors=[]이며 close ACK HTTP 200; owned PID 25176 exit 0; browser closed다. 최종 bundle SHA256 **668d54758572307c31b3c76c244475e3859deb49a942ac856f3f26d395c7f929**.

현재 Windows native host/Android 실행·physical IME/reader·performance/scanout·서명/clean-machine 수락은 notVerified다. Apple/Linux native platform 검증은 사용자 지정 SKIPPED, provider는 notVerified이며 6 target 코드 구성 범위는 유지한다.

**현재 source SHA256.**

| file | SHA256 |
| --- | --- |
| Nelyx/src/framework/rendering/table.ts | 55fc57cb72e265a28628ded5d83b6330c6a47c859f3dbf99f836b8413f922288 |
| Nelyx/src/framework/widgets/table.ts | a83b559d83326ad73b46f67117e0986b92efa0c7d8a7934329f015158d4ce9de |
| sample/nelyx-testbed-app/src/app.ts | 52607b61445a904c73f75926501abb3b8c1eab8d92a4a4dbafdffc486762fd02 |
| Nelyx/sdk/tooling/cli/templates/nelyx-app/src/app.ts | 52607b61445a904c73f75926501abb3b8c1eab8d92a4a4dbafdffc486762fd02 |

정리와 최종 source hash 확인을 이어간다. 다음은 W6-04의 Flow/나머지 layout 및 W6-05 paint/layer 기반이며 전체 goal은 active다.

**정리 완료.** 명시 allowlist .tmp/work6/table-layout의 8626 files/1372 directories/633969377 bytes를 preview 후 -Execute로 제거했다. descendant link/process reference=0과 workspace/ancestor 경계를 확인했고 한 번 쓰는 cleanup helper도 제거했다. assertion·원본 실행 shim·draft·archives/외부 consumer·raw logs/screenshots/servers를 정리했다. 재사용 Flutter pin/Dart SDK/C1 native supplier cache는 보존한다. cleanup 후 639 reviewed declaring/export-source 및 current runtime source hash가 일치한다. 전체 goal은 active이며 다음 W6-04/05 작업을 계속한다.


### 2026-10-11 — Paint·Canvas scalar commands·Opacity group layer 묶음

**전체 판정: PARTIAL, 목표 계속 진행.** W6-05의 Paint/Canvas 기반과 실제 Opacity raster grouping을 구현했다. W6-04의 Flow/나머지 layout과 전체 W6-05/후속 family는 미완료다. 이전 dirty 변경과 사용자 copilot 지침을 보존했으며 commit/push는 수행하지 않았다.

**구현.** ui/paint·ui/canvas·ui/frame-wire·framework/rendering/opacity·framework/widgets/opacity 직접 module을 추가해 core public subpath는 **69개**다. Paint는 mutable scalar 값·독립 copy·불변 snapshot을 제공하며 ARGB8 color, 29 blend mode, style, anti-alias, stroke width/cap/join/miter를 검사한다. 미지원 shader/filter 필드는 조용히 버리지 않고 거부한다. Canvas는 기록 시 argument 값을 복사하며 실제 rect/oval/line/균일 radius RRect, intersect/difference rect/RRect clip, saveLayer를 기록한다. 기존 rect/image/paragraph/affine 경로도 유지한다. PaintingContext는 이 Canvas를 상속하고 실제 child save/transform/paint/finally-restore를 수행하며 RenderObject의 기존 helper를 위임했다.

RenderOpacity/Opacity는 alpha 0 paint 생략·255 direct paint·중간 alpha의 **단일 실제 saveLayer 그룹 합성**을 수행한다. layout/dry/baseline/hit test를 유지하고 paint만 invalidate한다. alpha 0 semantics는 alwaysIncludeSemantics에 따라 유지할 수 있다. 잘못된 constructor 값은 child adoption 전에 검사해 소유권 유출을 막는다. sample/template의 기존 48px 이미지 위에 opacity .8의 clipped stroked RRect·oval·round-cap line 표식을 추가했다.

**wire와 native 공급.** frame admission은 확장 wire record 4096개·추정 value bytes 512 KiB·중첩 layer 32개·balanced save/restore·유한 geometry/scalar를 검사한다. byte 한계는 JS heap/JSON 크기의 정확한 측정이 아니다. wire 2는 기존 64-byte header/48-byte record 구조에 paint state/shape/layer/clip opcode를 추가한다. native ABI **1 유지**, additive maximum-wire query **2**, native wire 1 packet 재생을 확인했다. 6 target provider의 wire ABI는 **2**로 맞췄으며 현재 core/SDK/renderer/archive/artifact 조합이 필요하다. 기존 provider metadata wire 1을 새 SDK가 허용한다는 뜻은 아니다. CanvasKit adapter ABI 1과 frame wire 2는 별개다.

공유 C++ core는 SkPaint/SkCanvas로 새 command를 실제 재생하고 잘못된 opcode/version/flags/stack을 paint 전에 거부한다. resource identity/lease/drain 경로는 유지한다. native resource의 모든 존재 여부를 paint 전 원자적으로 검사하는 추가 구현까지 했다는 주장은 아니다. RN/JSI는 host temporary를 역순 해제하고 drawing/cleanup cause를 보존한다. Web은 실패 시 전체 canvas save count를 복구하고 두 Paint를 정리한다. 두 번째 Paint factory 실패도 누수 없이 처리하며 legacy image alpha와 styled paint state를 분리했다.

**원본 실행.** pin 71e4717a61786faab4c7aa39825989305ed29e8a의 변경하지 않은 enum 4개·Paint getter/setter 7쌍·Paint.from·field initializer expression을 SHA256 확인 후 Dart 3.14.0-296.0.dev/ByteData wrapper로 실행했다. FIELD 선언 wrapper는 분석기 span이 변수 declarator만 포함하기 때문에 붙였으며 initializer를 바꾸지 않았다. 전체 Flutter engine 실행과 별도다. pinned Dart strokeMiterLimit getter는 encoded raw 값을 반환해 default=0, set(.2) 후 -3.799999952316284를 관측했다. engine painting/paint.cc는 기본 4를 더해 decode한다. port는 engine 유효값 default=4, set(.2) 후 **.2000000476837158**을 노출하는 명시 보정이다. width float32·copy·snapshot·29 blend 순서를 비교했고 이 차이를 coverage에 기록했다.

**portable/coverage/package.** 20분 timeout의 **16 tests/135 assertions/3 files**, strict fixture compiler·root/port-tool types·SDK build PASS다. C#24/Dart109 selection, 실제 109 symbol 분석 PASS. 기존 639 reviews 중 RenderObject hash가 바뀐 39개는 이전 bytes와 현재 전체 text를 paintChild helper/EOL 외 동일한지 확인하고 재검토했다. 기존 600개 유지+39개 재검토+새 48개로 **687 reviews**다. coverage 재생성은 semantic fields와 현재 declaring/export-source hashes를 보존했다. 전체 74,028 records는 **missing 72715/partial 677/adapted 629/implemented 7**이며 전체 구현률이 아니다.

6 archives로 생성한 외부 CLI Web consumer에서 Node v24.15.0의 **69 ESM public imports·69 declaration files의 .js 경로·installed source hashes·template parity**, consumer compiler·Metro static build가 PASS다. packed coverage snapshot은 687 reviews다. assertions/oracles와 consumer helper는 임시이며 reusable product tests를 새로 남기지 않았다.

**실제 native/Web pixels.** 현재 공유 C++/C ABI는 Windows x64 Release/MD에서 8/8 빌드됐고 실제 AMD Radeon 780M/vendor4098/Vulkan physical 1.3.302/Graphite offscreen에서 19 commands→30 records→1504 bytes를 재생했다. 중간 alpha 그룹의 single/overlap pixels가 모두 [127,255,127,255]로 같고 round cap/stroke edge/interior/oval/difference clip/rounded clip/multiply 등 **11 선택 pixel**이 예상과 일치했다. invalid wire1/new opcode·flags·stack은 이전 pixel을 바꾸지 않고 거부했고 valid wire1 clear도 PASS, owner GPU drain을 확인했다. DLL SHA256 **88df42fe9950871050bb52a107251f56b5d498705c482024319f2ddc6e1ea9b5**.

동일 fixture를 실제 CanvasKit 0.41.0/Ganesh/WebGL2로 실행해 11 pixel이 native와 채널 오차 1 이내로 일치했고 29 blend enum index가 일치했다. GPU retirement 뒤 lease 해제와 context close/canvas 제거 PASS다. fixture View token은 synthetic이며 실제 SDK app/input 수락과 구분한다. Web Chrome **154.0.8037.98**, ANGLE AMD780M D3D11이며 SwiftShader가 아니다.

RNW0.83.2/RN0.83.10/JSI21 binding은 current C++로 **16/16 compile/link PASS**다. 새 immutable supplier는 **Nelyx/.cache/native/windows/w6-paint-4759576bf2382d5a/inputs.json**, SHA256 **4759576bf2382d5a3664a44de56e20aa1bb911617c79eca5ef22057116efdfdb**이며 18 libraries/1795 files/**221022597 bytes** 전체 hash를 확인했다. 이전 w6-layout-c1bf0760dc07649f는 historical cache로 보존하되 현재 compiled-source와 맞지 않는다. Windows prepare에는 새 manifest를 사용한다. 이 supplier build와 offscreen pixel 검증을 현재 RNW native application 실행 PASS로 승격하지 않는다.

**실제 SDK app/Hermes.** pinned x64 Hermes CLI에서 Paint copy/float32/miter·29 blends·wire 2 records·actual Opacity group/zero-alpha paint-only invalidation PASS다. native RNW host 실행과 별도다. packed SDK Web 앱에서 기존 이미지와 새 48px 표식(blue stroke pixels 332)을 확인했다. 실제 canvas 좌표 input으로 카운터·편집기 3회 이동 **486→20→486** 후 동일 DOM input/text/backward [1,5] 선택을 유지했다. focus·theme/locale·Table detail/dialog/back·760→230px Wrap PASS, wide/narrow home/detail와 표식 screenshot을 확인했다. public SDK close 후 **canvas/input/font=0·contextLost=true·page errors=[]**다. 최종 bundle SHA256 **ec8bb50a11409ba2748866430a8e91d847dc0b043cd0e9056acd58187525ce82**. owned server PID27012 close ACK HTTP200·exit0, browser closed다. primitive fixture server PID31864도 종료돼 live process/session이 없다.

**실패와 수정 기록.** 실제 product에서 invalid Opacity constructor adoption·child paint finally scope·Web nested failure save stack/second factory cleanup·legacy image alpha를 수정하고 검증했다. 임시 fixture DOM/JSX와 src/dist nominal identity, extracted field wrapper, Bun IIFE의 top-level-await를 수정했다. 첫 app 검증과 diagnostic probe의 DOM Locator.click은 canvas 뒤 semantic proxy를 눌러 canvas interception timeout이 났다. 최종 검증은 실제 화면 좌표를 통해 canvas hit test로 클릭하며 force click/DOM synthetic action을 사용하지 않았다. 실패를 native/device 수락으로 숨기지 않는다.

**미완료 범위.** full Color/wide gamut·per-corner RRect·Path/shader/filter/shadow·perspective/4×4·Picture/PictureRecorder·retained layer/compositing/PaintingContext 전체·native editor overlay의 중간 group opacity/clip/general transform 연동이 남아 있다. TableBorder/row Decoration 및 기존 W6 미완료도 유지한다. 현재 RNW native application/Android 실행·physical input/IME/reader·performance/scanout·graphics loss/recovery·서명/clean-machine 수락은 notVerified다. Apple/Linux native platform 검증은 사용자 지정 SKIPPED, provider는 notVerified이며 6 target 코드 구성 범위는 유지한다.

**현재 source SHA256.**

| file | SHA256 |
| --- | --- |
| Nelyx/src/ui/paint.ts | f44d563f64f067edb874c4235349031f9bc086d735b61145a6d8fa6bfe11c21a |
| Nelyx/src/ui/canvas.ts | ff420980d7ca4d2ab3a8a5f636c645b011b87066c06b8a7dc1d2004e31504c66 |
| Nelyx/src/ui/frame.ts | ccbbc21abecc41630f0ff84388e12812d3ce56dc2bdf1f27e1f2be9742782f69 |
| Nelyx/src/ui/frame-wire.ts | e31457f065a5f2897bb701a42df0e58c55c336c4dd2cb283cc0afb8034b77f98 |
| Nelyx/src/ui/types.ts | 0c4f2892bcbfba21aa4f009016031f2cd25bd15f11ff736890090482f3e6b454 |
| Nelyx/src/framework/painting/context.ts | db6010104fa22a00c2b31fa753d06d1f49f375e74bf74b9125642f7a8a72d93d |
| Nelyx/src/framework/rendering/object.ts | b6bd4b2d639ef1e46647b70159ca230d7b30d0342457063595c69a7a49dc6c10 |
| Nelyx/src/framework/rendering/opacity.ts | 3dd6be2f50b42b50d7d5d3c60b2120b3661fec8f6d759103b7a4e71aeaf21c7b |
| Nelyx/src/framework/widgets/opacity.ts | 2769c31b993f004a63e549b8650054055a9b256aa6e3c1a60483895d02cff9bc |
| Nelyx/skia/packages/rn/src/renderer.ts | c6249d2db625d3f900b9656a5386fd68515a9fa0e69eb98bee9d3faea5909977 |
| Nelyx/skia/packages/web/src/library.ts | 1039f6d9a6dea8433b8aecadabecc7e7672c15541c526966754f73e805ff86df |
| Nelyx/skia/native/core/core.cpp | 549667563c743e3b3ac57ec780f583c553f2ff86072c517f22c1c178c22a4ce5 |
| Nelyx/skia/native/core/nelyx_skia/core.h | 2aebc3ddeab2768748bf3df68b21b91d607ba644555ec3b40ed677eaece50fb6 |
| sample/nelyx-testbed-app/src/app.ts | 4649fabaf1fede2ece4850712696350ad464921a71aab84936b4f816fecf6625 |
| Nelyx/sdk/tooling/cli/templates/nelyx-app/src/app.ts | 4649fabaf1fede2ece4850712696350ad464921a71aab84936b4f816fecf6625 |

전체 goal은 active다. 이번 묶음 임시 파일 정리 후 W6-04 Flow/나머지 layout 및 W6-05 Path/Clip/retained layer와 후속 family를 이어간다.

**정리 완료.** 명시 allowlist .tmp/work6/paint의 **9849 files/1563 directories/833091944 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor 경계·descendant link/process reference=0을 확인했다. 임시 assertion/oracle shim·draft·logs/screenshots·archives/consumer·native build를 제거하고 재사용 Flutter pin/Dart SDK·historical layout/current paint native supplier cache를 보존했다. 한 번 쓰는 cleanup helper도 제거했다. 정리 후 687 reviewed declaring/export-source와 runtime source hash·69 public exports·current supplier manifest hash가 일치하며 scratch가 없다. 전체 goal은 active다.


### 2026-10-11 — CustomPaint delegate·paint phase guard·keyed semantics 묶음

**전체 판정: PARTIAL, 목표 계속 진행.** 이전 Paint/Canvas/Opacity 묶음은 구현·검증·정리를 끝낸 progress다. 이번에는 W6-05의 실제 CustomPaint를 구현하고 W6-03/04의 paint 중 mutation 경계를 보강했다. Flow의 4×4 paint transform 의존성과 나머지 layout/Path/layer/후속 W6 전체는 여전히 미완료다. 기존 dirty와 사용자 copilot 지침을 보존했고 commit/push는 수행하지 않았다.

**구현과 API.** framework/rendering/custom-paint·framework/widgets/custom-paint 직접 module을 추가해 public core subpath는 **71개**다. CustomPainter는 실제 Listenable이며 repaint source의 add/removeListener를 전달하고 paint/shouldRepaint/shouldRebuildSemantics/semanticsBuilder/hitTest를 제공한다. TS erased/runtime type 구분에는 constructor 기본 typeToken 또는 명시 token을 사용한다. RenderCustomPaint/CustomPaint는 실제 background→child→foreground Canvas painting, child 또는 preferredSize 기반 wet/dry/intrinsic/baseline 배치, no-child override hook, foreground null=false/background null=true hit policy를 연결한다. foreground hit는 child보다 앞서고 child hit 뒤 render entry도 경로에 포함한다.

repaint notification은 layout/build를 dirty로 만들지 않고 paint invalidation을 전파한다. delegate replacement는 동일 object·type identity·paint/semantics policy를 구분한다. attached painter의 source 교체는 새 listener를 먼저 등록하며 실패 시 이전 delegate/subscription을 보존한다. 이전 listener removal 실패는 새 delegate를 commit하고 원래 cause를 보고하며 비활성화한 stale callback은 무시한다. 두 painter attach 중 두 번째 등록 실패도 양쪽 listener와 root ownership을 정리한다. detach/dispose/unmount에서 두 subscription을 해제하며 painter 객체 자체의 dispose 책임은 외부 owner에 둔다.

CustomPainterSemantics는 지원하는 현재 SemanticsNode properties·rect·affine transform·key를 불변 값으로 캡처한다. background/child/foreground 순서의 실제 semantics group boundary와 안정적인 keyed node id를 만든다. 기존 keyed id는 reorder 뒤 유지하며 unkeyed는 위치 기반 재사용 정책이다. builder는 layout 또는 shouldRebuildSemantics/명시 markNeedsSemanticsUpdate로 갱신하고 순수 repaint notification은 cache를 유지한다. duplicate key·잘못된 rect/role/actions·미지원 properties/tags 등을 명시적으로 진단한다. 전체 Flutter SemanticsProperties/tags/Matrix4와 native reader 수락을 완료한 것은 아니다.

**paint scope와 phase.** CustomPaint는 실제 PaintingContext.canvas를 전달하고 painter별 save/restore 범위를 검증한다. callback 실패·추가 save·바깥 scope restore는 해당 painter가 새로 기록한 명령만 rollback한 뒤 원래 오류를 보존한다. callback의 build/layout/tree 변경은 frame-local synchronous paint guard로 거부하며 setState는 사용자 callback 실행 전에 검사한다. root paint와 standalone CustomPaint가 같은 guard를 사용한다. PipelineOwner root/layout/dispose, RenderObject layout/attachment/tree/offset/size·관련 layout 속성, BuildOwner build와 Element/State update 경로에 실제 guard를 넣었다. 기존 RenderBox family/Wrap/ListBody·StackParentData의 **44 setter**도 mutation 전에 검사한다. 신규/기존 정상 layout 알고리즘을 바꾼 것은 아니다.

sample/template의 앱 전용 PaintMark render class를 실제 CustomPaint/CustomPainter로 교체했다. 동일 AnimationController를 repaint source로 사용하며 line 끝점을 animation 값으로 움직이고 keyed 'Nelyx painted mark' image semantics를 제공한다. progress custom-layout·편집기 이동·Wrap/ListBody·Table detail 경로도 유지한다. native editor overlay group alpha/clip/general transform은 이전에 기록한 미완료 범위 그대로다.

**원본 실행.** pin 71e4717a61786faab4c7aa39825989305ed29e8a의 변경하지 않은 **CustomPainter·CustomPainterSemantics class 2개와 RenderCustomPaint method 19개**, 총 **21 fragments**를 raw span SHA256 검증 후 Dart 3.14.0-296.0.dev --enable-asserts로 실행했다. geometry/render/canvas/semantics-node 작은 shim과 _updateSemanticsChild shim을 사용했고 keyed reconciliation method 자체는 변경하지 않았다. 전체 Flutter engine/native semantics 실행과 별도다. preferred/child/infinite intrinsic 결과 [[50,30],[80,30],[0,0],[25,15]], background/child/foreground order, hit policy [true,true,false,false,true], delegate policy와 keyed ids **[1,2,3]→[2,1,3]**를 TS와 비교했다.

pin debug canvas-save-count 검사는 excess save를 잡지만 enclosing restore 후 save로 net count가 같으면 통과했다. TS는 scope 침범을 all-build 거부하고 새 명령을 rollback하는 명시 보정이다. full debug describeIdentity/repaint toString은 아직 class명만 반환하므로 해당 review도 partial이다.

**검증/coverage.** 20분 timeout으로 **15 tests/150 assertions/2 files**, strict fixture compiler·core/root/port-tool compiler·SDK build PASS다. phase 실패 뒤 guard 해제, 실제 FrameworkRoot의 setState callback 미실행/후속 정상 build, failure rollback/구독 cleanup·keyed semantics와 실제 hit 경로를 확인했다. source selection은 **C#24/Dart113**, 113 symbols 실제 분석 PASS다. 기존 687 reviews 중 409개는 유지하고 hash가 바뀐 278개는 이전 bytes와 current source를 비교해 추가 guard import/call·root paint wrapper 외 동일한지 검증한 뒤 재검토했다. 새 44개를 더해 **731 reviews**, declaring/export-source **738 hash references**를 확인했고 재생성은 semantic fields를 유지했다. 현재 74,028 records는 **missing 72670/partial 691/adapted 660/implemented 7**이며 전체 구현률이 아니다.

**package와 실제 실행.** 6 archives로 만든 외부 CLI Web consumer에서 Node v24.15.0의 **71 ESM public imports·72 declaration files의 .js 경로·installed source hashes·template parity**, consumer compiler·Metro static build PASS다. internal phase module은 barrel/public aggregate가 아니다. packed coverage는 731 reviews를 포함한다. pinned x64 RNW Hermes CLI에서 실제 CustomPaint widget/render·repaint source→paint-only command·keyed semantics reorder·wire 2 직렬화 **256 bytes**·listener teardown PASS다. Hermes CLI는 native host 실행과 별도다.

Web Chrome **154.0.8037.98**, 실제 WebGL2 ANGLE AMD Radeon780M/D3D11에서 48×48 표식의 counter animation 뒤 채널 차이 10 초과 **145 pixels** 변화를 관측했다. 표식의 native DOM semantics node는 counter·편집기 이동·theme/locale 뒤 동일하게 유지됐으며 reader 동작을 증명하는 것은 아니다. 편집기 3회 이동 **486→20→486** 뒤 동일 input/text/backward [1,5] 선택·focus를 유지했고 theme/locale·Table detail/dialog/back·760→230px Wrap PASS다. before/after mark 및 wide/narrow home/detail screenshot을 확인했다. public SDK close 뒤 **canvas/input/font/mark=0·contextLost=true·page errors=[]**다. 최종 bundle SHA256 **d677cdd77c0e3be88633f450d74d4262c8b27521543e0135fe35597348b4bbd6**. owned server PID12088 close ACK HTTP200·exit0·browser closed다.

**실패와 보정.** 초기 check:types를 새 export의 declaration build 전에 실행해 TS2307이 났고 SDK build 후 통과했다. 임시 Bun 경로의 ./ 누락·compiler에 포함된 saved baseline .ts와 expected id의 타입을 수정했다. selection은 처음 raw CRLF SHA를 넣어 hash gate가 거부했고 inventory의 검증된 LF upstream SHA로 고쳤으며 gate를 약화하지 않았다. 이미 사용한 coverage draft 출력은 fresh-scratch guard가 거부해 새 owned directory를 사용했다. AST guard 추가 중 StackParentData.rect에 RenderObject 전용 helper를 잘못 넣은 compiler 오류는 독립 phase guard로 수정했다. Dart shim의 named _repaint 인자는 현행 repaint로 고쳤고 원본 fragments는 변경하지 않았다.

**남은 범위.** isComplex/willChange raster cache hint는 미구현이며 공급한 옵션을 거부한다. Retained layer/compositing/GPU raster cache, 전체 Canvas/Path/filter/wide gamut·4×4 변환·full semantics/diagnostics, Flow 및 남은 W6-04/후속 family는 계속한다. 이 묶음은 **wire 2/native ABI 1·native C++를 바꾸지 않는다**. 이전 w6-paint-4759576bf2382d5a supplier cache는 보존하며 그 당시 native offscreen pixel/compile 근거를 이번 TS native host 실행으로 승격하지 않는다. 현재 RNW native application/Android 실행·physical input/IME/reader·performance/scanout·loss/recovery·서명/clean-machine 수락은 notVerified다. Apple/Linux native 검증은 사용자 지정 SKIPPED, provider notVerified이며 6 target 코드 구성은 유지한다.

**현재 source SHA256.**

| file | SHA256 |
| --- | --- |
| Nelyx/src/framework/rendering/object.ts | bcfc54d2699e8d571cd2fdea6f2a420d1877e7d7ff3b04835c9af29606798f10 |
| Nelyx/src/framework/rendering/boxes.ts | 101e44fce8aef946929e0505d4982b4731468088da41e09b42726d72c18b1ccb |
| Nelyx/src/framework/rendering/wrap.ts | 61c96c8124367a5f08773f07bf40493641eba0951a35cd40ae433e3b104d20bc |
| Nelyx/src/framework/rendering/list-body.ts | 002953770066eb985b63229af812952b95fce408d8ea82fa2b86f9336f932d9c |
| Nelyx/src/framework/widgets/framework.ts | b7cd38fc02a90e83f99b857dfad5d7c14e858516e45cb2c40813f111781eae16 |
| Nelyx/src/framework/widgets/root.ts | 4c7a7c40a6704270ffed73ac644a25d63c3c9aadabc834960ce0d710fb40cda6 |
| Nelyx/src/framework/rendering/phase.ts | 10dddd41208f9ebde6c3a2717aae31c9249bb14b9df93716f0f937d9884dd781 |
| Nelyx/src/framework/rendering/custom-paint.ts | c400c7b87b83049f9fab800b7a5f5e80a026177fc60cfafc7210506b34168706 |
| Nelyx/src/framework/widgets/custom-paint.ts | f54710e9d7ea4f68f035acbae1598d75eb87fb16649fbe37ce6e494366dd748c |
| sample/nelyx-testbed-app/src/app.ts | f89137cc69980d55440e961966a38879c78dead6c3b210cec076c2b1e0b22820 |
| Nelyx/sdk/tooling/cli/templates/nelyx-app/src/app.ts | f89137cc69980d55440e961966a38879c78dead6c3b210cec076c2b1e0b22820 |

전체 goal은 active다. 이번 묶음 임시 파일 정리 후 4×4 transform·Flow 및 Path/Clip/retained layer와 후속 family를 계속한다.

**정리 완료.** 명시 allowlist .tmp/work6/custom-paint의 **7991 files/1358 directories/490127434 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor 경계·descendant link/process reference=0을 확인했고 one-time helper도 제거했다. assertion/oracle shim·saved baseline·draft·logs/screenshots·archives/consumer를 정리하고 Flutter pin/Dart SDK·현재 및 historical immutable native supplier cache는 보존했다. cleanup 후 **731 reviews/738 declaring-export-source hash references·runtime source hashes·71 public exports**가 일치하고 scratch가 없다. 전체 goal은 active다.

### 2026-10-11 — Canvas full 4×4 matrix·wire 3·native JSI 묶음

**구현.** Canvas.transform은 기존 6-value affine과 16-value column-major/Float64Array를 즉시 복사해 기록한다. z 성분을 제거하지 않으며 Rx/Ry 뒤 Tz와 perspective가 이후 합성까지 유지된다. translate/scale/rotate(radians)/skew(direct factors), getTransform/getSaveCount/restoreToCount를 추가했다. getTransform은 독립 Float64Array snapshot이고 실제 command stream의 save/layer/restore와 legacy cache insertion을 순회해 backend float32-effective 합성을 계산한다. state query는 O(record count)이며 native constant-time query와 작은 산술 반올림 차이가 있다. ui/matrix4의 immutable storage/capture/affine conversion/multiplication은 직접 module이다. 전체 mutable vector_math Matrix4 class의 이식 완료로 분류하지 않는다.

**wire·backend.** wire **3**은 기존 64-byte header/48-byte record에 **18/19/20**의 순서 있는 3-record matrix를 추가한다. 값 16개와 zero padding/reserved fields를 검증하고 frame budget에서도 3 records/192 estimated bytes로 계산한다. 기존 최대 4096 expanded records/512KiB estimated bytes/32 layers를 유지한다. native ABI는 **1**, wire 1·2 replay는 유지한다. 6개 provider manifest는 wire ABI3으로 갱신했으며 CanvasKit adapter ABI1은 그대로다. 동일 package와 matching native supplier를 사용해야 한다.

JSI의 기존 SkMatrix concat 경로는 보존하고 전용 **nelyxConcat44** host method를 추가해 shared core의 **SkM44::ColMajor** helper로 전달한다. 오래된 binding에 method가 없으면 명시 실패하며 2D로 축소하지 않는다. Web은 column-major 값을 실제 CanvasKit row-major M44 input으로 바꾼다. lease·GPU retirement·drain 소유권은 유지한다. malformed packet validation은 paint 전에 수행하지만 모든 resource existence의 transactional preflight까지 완성한 것은 아니다.

**원본·portable.** exact Flutter pin 71e4717a61786faab4c7aa39825989305ed29e8a의 변경하지 않은 _NativeCanvas.scale/transform wrapper **2 fragments**를 raw span SHA 검증 후 Dart 3.14.0-296.0.dev로 실행했다. native-call shim의 복사는 engine 실행 증거가 아니다. 실제 locked vector_math **2.4.3**(archive SHA92b9910f66ed1057fd4da7b040ae7c74cafacf885bdc81be496928d5049b032d)로 Rx/Ry/Tz/perspective를 계산했고 engine canvas.cc의 column-major narrowing도 검토했다. Rx60°·Tz20·translate(10,35) 합성의 translation은 [10,17.67949192431123,10,1]이다. **10 tests/162 assertions/1 file**, strict fixture·root/compiler·SDK build PASS다. immutable capture, save/layer state, sparse/NaN/overflow 입력, wire order/padding, 1365 matrices 허용/1366 거부, JSI forwarding/temporary dispose/stale binding, 6 provider 정책을 확인했다. tests/subprocess timeout은 20분이다.

**native supplier와 픽셀.** Windows x64 Release/MD CABI **8/8**, RNW/JSI **16/16** build PASS다. 기존 외부 code warning은 남는다. 현재 immutable supplier는 Nelyx/.cache/native/windows/w6-matrix4-1e9d254d80ab8acf/inputs.json, SHA **1e9d254d80ab8acfe1de192445ec3149acbc384fa9f785a3f2145b80ddd4e1bb**이며 **18 libraries/1795 files/221034229 bytes**의 hash를 검증했다. 이전 paint/layout supplier는 historical로 보존한다.

실제 Graphite/native Vulkan CABI offscreen, AMD Radeon780M/vendor4098/driver8388939/Vulkan1.1(physical1.3.302)에서 28 commands/44 records/**2176 wire bytes**를 실행했다. full z composition·perspective·group alpha·legacy affine의 **9 pixels**가 기대값과 일치했고 Web CanvasKit0.41.0/WebGL2의 같은 픽셀과 채널 오차≤1이다. wire2+matrix·standalone continuation·순서·reserved flags·padding·NaN·truncation **7 invalid cases**가 paint 전 거부되고 기존 픽셀이 보존됐다. wire1 clear/wire2 scalar paint도 PASS다. CABI DLL SHA **9ad534055b24b0a739f9903cfe76d8d5ab9db0506ea3772f320e71697eca6c23**. primitive Web fixture lease retirement/context loss와 CABI owner drain도 확인했다.

**실제 package·앱.** 6 archives로 생성한 외부 Web/Windows consumers에서 각각 **72 direct ESM imports/73 declaration files의 .js 경로·installed source hashes·template parity·compiler** PASS다. sample/template는 CustomPaint의 oval을 두 full matrices(Rx·Tz)로 기울이므로 모든 frame에서 새 native binding을 실행한다. Windows package **916 files/262775799 bytes**, fresh supplier와 matching RN0.83.10/RNW0.83.2/Hermes bytecode99의 Release build·verify PASS다. 실제 Win32 pointer로 counter1, Unicode text 입력, 편집기 3회 이동 때 동일 UIA runtimeId/텍스트, 실제 wheel scroll·Table detail/dialog/back을 확인했다. DPI192에서 96×96 mark의 채널 차이10 초과 **1643 pixels**, before/after screenshot을 확인했다. exit0, fatal exception/JS errors=[], **closed views=0 consumers=0 gpuDrained=1**이다. UIA/Win32 automation은 물리 입력·IME·reader·scanout 수락과 별도다.

Web Chrome154.0.8037.98/WebGL2 ANGLE AMD780M/D3D11에서 48×48 mark가 **453 pixels** 변화했다. counter·theme/locale 중 mark semantics DOM identity를 유지한다. 실제 pointer counter/route actions와 별도로 DOM semantics activate를 사용해 편집기 3회 이동 **386→20→386**, 동일 input/text/backward [1,6] selection·focus를 확인했다. 실제 pointerdown은 browser input policy에 따라 canvas를 focus하므로 native input blur가 정상 발생한다. full dialog role/reader 수락은 열려 있으며 이번에는 Open/Close action과 screenshot을 확인했다. Table detail/dialog/back·760→230px Wrap, public SDK close 후 canvas/input/font/mark=0·contextLost=true·page errors=[] PASS다. Web bundle SHA **582012e9d1b7f8fd76e3307e9ebfe22fd2a5614ab44b3e02bd245ff87a570b01**. owned server PID29156 close ACK HTTP200/exit0·browser closed다. pinned native Hermes CLI(no polyfill)에서도 Float64Array capture/full composition/save query/wire3 **12 assertions/736 wire bytes** PASS다. CLI 실행은 RNW host와 별도다.

**실패와 남은 shutdown.** 최초 UIA harness의 decoder utf8-sig를 utf-8-sig로 수정했다. 이 실행에서 runtime 준비 전 WM_CLOSE가 **Composition shutdown requires one live native runtime**으로 거부되어 강제 종료한 실패를 보존했다. early startup close의 결정적 queue/deferred acknowledgement는 **W6-24 미완료**다. 첫 UIA 트리가 나타나자마자 실행한 capture는 흰색이고 첫 pointer도 반영되지 않았다. 임시 diagnostic consumer에서 active/open/visible=true·renderer failed=false·실제 pointer 전달을 확인했다. 원래 제품 package에서 초기 settle 뒤 UIA bounds를 다시 읽으면 정상 렌더/입력한다. product visibility guard를 약화하거나 active를 가정하지 않았다. 작은 DPI2 viewport에서 Item1이 아래에 있어 처음에는 찾지 못했고 실제 wheel 입력을 추가했다. Web focus/dialog-role 검증의 잘못된 가정도 수정했고 실패 receipt를 runtime evidence에 별도 보존했다.

**coverage·현재 경계.** 기존 731 reviews 중 719를 유지하고 Canvas hash 변화의 12개를 재검토했으며 7개 추가/1개 개선 후 **738 reviews/745 declaring-export source hash references**다. fresh regeneration은 review semantic fields와 runtime evidence를 보존했다. source selection C#24/Dart113은 그대로다. 74028 records는 **missing72663/partial690/adapted668/implemented7**이며 전체 구현률이 아니다. Canvas class는 partial, 8 methods는 adapted다. full mutable Matrix4, framework projective Transform/hit/semantics·Flow, Path/filter/shader/retained layers와 후속 family를 계속한다. Android와 Windows/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine 수락은 notVerified다. Apple/Linux native 검증은 사용자 지정 SKIPPED/provider notVerified, 6 target code scope는 유지한다.

**현재 source SHA256.**

| file | SHA256 |
| --- | --- |
| Nelyx/src/ui/canvas.ts | 94dd3a8eed93a1781a1223953e8b409894006e40cbd9106338402a338855c326 |
| Nelyx/src/ui/matrix4.ts | d76489dee469f6fd53a627bd226f7706517551fb25d8f4b4d4d2dfc0b89404ce |
| Nelyx/src/ui/frame.ts | a93d7fc0a645170eaca4bc72c247ecb8967d0a09ab44da5c762b6ab4de94af2f |
| Nelyx/src/ui/frame-wire.ts | d749d9f185d59bf3b4a00177ac3beeaf10112b14323eaffebaf4c0714c16d30c |
| Nelyx/skia/packages/rn/src/renderer.ts | f0ddd5f7aee12b149c8ffa1381e677f75bd3eb8efbbde083a4965f798a52c196 |
| Nelyx/skia/packages/rn/cpp/api/JsiSkCanvas.h | aaff176fca152f81a2e0b48336d1750df7bccc3aac00aa211b568e4aaff54c49 |
| Nelyx/skia/packages/web/src/library.ts | f7d3e623c3200991fadb46cbc1ae3012073a0406f14f16d4c056c326e0b06a0d |
| Nelyx/skia/native/core/core.cpp | 0326c21b6aa1774ec9d6e1e9d0205fe97dbf00f242326d9d6ebbef81c3f2f7f4 |
| Nelyx/skia/native/core/nelyx_skia/core.h | 274b6bfa5ac75454e92dbcbbeebe146365a5ae9b77301051e7565440ff9a4ae6 |
| Nelyx/skia/native/adapters/cabi/nelyx_skia_cabi.h | 89cdca0f56a0ce4e6bb28959a0e20e1fe067207f545ad16368cacdad7e08d4a7 |
| sample/nelyx-testbed-app/src/app.ts | 69bfb8d68215ee04ed17febae5d62e2ce979cb214e1240b8f5c8a3d643484083 |
| Nelyx/sdk/tooling/cli/templates/nelyx-app/src/app.ts | 69bfb8d68215ee04ed17febae5d62e2ce979cb214e1240b8f5c8a3d643484083 |

전체 goal은 active다. 이번 묶음의 임시 파일을 allowlist 정리한 뒤 framework full matrix·Flow 및 후속 family를 계속한다.

**정리 완료.** allowlist .tmp/work6/matrix4의 **41147 files/7052 directories/3110688564 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했고 descendant links/process references=0이다. 임시 native/consumer/diagnostic build·oracle/test shim·logs/screenshots/archives/drafts를 정리하고 Flutter pin/Dart SDK·현재 및 historical native supplier cache를 보존했다. cleanup helper도 제거한다. 최종 coverage **738 reviews/745 hash references·72 public exports**이며 전체 goal은 active다.

### 2026-10-11 — framework projective Transform·paint-plane hit·unprojection 묶음

**구현.** geometry의 기존 6-value affine API를 유지하고 TransformMatrix(6/16 values)·입력 capture·full composition·f64 pivot inverse·point projection·paint-plane inverse를 추가했다. RenderObject child paint, PaintingContext, FrameworkRoot pointer와 captured path, RenderBox/Opacity/navigation/semantics/CustomPaint의 좌표 type을 확장했다. getTransformTo는 render tree의 완전한 합성과 같은 tree의 target/sibling 좌표 변환, localToGlobal/globalToLocal은 projection·screen ray의 local z=0 plane unprojection을 사용한다. unrelated tree target은 거부하고 target singular inverse는 zero matrix, globalToLocal의 singular/parallel 결과는 Flutter처럼 Offset.zero다. 작은 nonzero pivot은 epsilon으로 singular 처리하지 않으며 nonfinite inverse는 보수적으로 거부한다.

**Transform 의미.** RenderTransform은 자신의 layout/parent 위치에 행렬을 적용하던 기존 경로를 고쳐 **자식의 paint/hit/semantics transform**에 적용한다. layout 크기는 그대로이고 own-size hit gate를 우회해 이동된 자식 영역을 hit할 수 있다. 입력 matrix/Float64Array·origin·absolute alignment는 복사한다. origin/alignment conjugation, transformHitTests=false, transform setter, rotateX/Y/Z·translate/scale·setIdentity를 추가했다. 직접 render 속성 변경은 layout을 invalidate하지 않고 paint를 갱신한다. 공통 BoxWidget.updateRenderObject는 widget rebuild 때 여전히 layout을 요청하므로 그 최적화는 미완료다. 전체 mutable Matrix4·AlignmentDirectional/textDirection/filterQuality/factory constructor·retained transform layer는 미완료이며 지원하지 않는 옵션을 거부한다.

hit test는 Flutter BoxHitTestResult.addWithPaintTransform처럼 **각 child의 paint plane을 분리해 inverse**를 적용한다. full paint/getTransformTo/globalToLocal과 일반 3D ray hit test는 구분한다. 예를 들어 z scale0 행렬은 paint/full inverse가 singular여도 XY paint-plane hit는 가능하다. RenderTransform은 singular full transform의 자식 paint를 생략한다. semantics는 full matrix의 corner projected AABB를 제공하며 projective horizon을 가로지르는 비유한 영역은 native overlay에 잘못 게시하지 않고 생략한다. projective clip/shape/reader·native text editor의 실제 warp/clip/paint order는 여전히 미완료다.

**원본 실행·검증.** exact pin 71e4717a61786faab4c7aa39825989305ed29e8a의 변경하지 않은 **6 fragments**(MatrixUtils.transformPoint, PointerEvent.removePerspectiveTransform, RenderBox.globalToLocal, BoxHitTestResult.addWithPaintTransform, RenderTransform._effectiveTransform/hitTestChildren)를 source span SHA 검증 후 Dart3.14.0-296.0.dev로 실행했다. actual locked vector_math2.4.3과 작은 Offset/Size/Alignment/render/hit shim을 썼으며 native engine/full pipeline 실행과 별도다. combined Rx/Tz·perspective·z scale0·1e-12 scale·identity·origin/alignment 및 transformHitTests=false 결과를 비교했다.

20분 timeout으로 **12 tests/312 assertions/1 file**, strict fixture compiler·core/root/SDK build PASS다. 실제 FrameworkRoot의 full paint command·projected semantics·down/up captured local [7,11], nested matrix composition·sibling 좌표·자신 bounds 밖 이동 자식 hit·singular 구분·입력 snapshot·paint-phase/disposed mutation 거부·semantics horizon 생략을 확인했다. 임시 fixture에서 BoxConstraints positional constructor와 RenderCustomPaint options를 잘못 쓴 실패를 수정했고, Bun typeRoots·expected tuple 비교도 fixture만 수정했다. native Hermes CLI(no polyfill)에서 같은 full inverse/unprojection/actual FrameworkRoot 경로 **12 assertions/544 wire bytes** PASS다. Promise 미선언 분석 warning은 기존 scheduler의 실행하지 않은 async branch에서 나오며 전체 async scheduler 지원 증거로 승격하지 않는다.

**coverage.** AST로 기존 711 member/declaration의 token 의미를 확인했고 type identifier Matrix2D→TransformMatrix 외의 변경은 허용하지 않았다. 기존 method 14개와 새 구현을 명시 검토했다. 이전 738 reviews 중 **435 유지/303 hash 변경 재검토**, **26 추가/5 개선** 후 **764 reviews/771 declaring-export-source hash references**다. fresh regeneration에서 review semantic fields와 runtime evidence가 유지됐다. 새 RenderTransform/Transform Dart selection으로 **C#24/Dart115**, 115 symbols 실제 분석 PASS다. 현재 74028 records는 **missing72643/partial687/adapted691/implemented7**이며 전체 구현률이 아니다. class의 미완료 의미는 partial로 남긴다.

**실제 외부 package.** sample/template의 카운터를 x-perspective .0002의 실제 Transform으로 감쌌고 기존 CustomPaint Rx/Tz 표식도 유지했다. 6 archives의 Web/Windows consumers 각각 **72 direct ESM imports/73 declarations의 .js 경로·installed source hashes·template parity·compiler** PASS다. Web package356 files/26428888 bytes, Windows package916 files/262816840 bytes의 build·verify PASS다. 이번에는 C++를 변경하지 않았으므로 current w6-matrix4-1e9d254d80ab8acf supplier(SHA1e9d254d80ab8acfe1de192445ec3149acbc384fa9f785a3f2145b80ddd4e1bb)와 native ABI1/wire3을 유지한다. 이전 묶음의 CABI offscreen pixel proof는 historical 범위 그대로이며 이번 framework runtime으로 대신하지 않는다.

Windows RNW x64 Release/Hermes/Graphite-Vulkan/AMD780M, DPI192에서 projective AABB width **821 physical pixels**의 bottom-right **경계 밖 actual Win32 pointer는 counter0 유지**, 안쪽 pointer는 counter1이 됐다. 표식 변화1643 pixels·UIA 편집기 동일 runtimeId/text로 3회 이동·실제 SendInput text·wheel·Table detail/dialog/back PASS다. screenshot을 확인했고 exit0/errors=[]/**closed views=0 consumers=0 gpuDrained=1**이다. EXE SHA **aa72e3c22a18fd14b71880186b58c81c0b70fcb586fff32b93c6cd18bbe3440a**, Hermes bundle SHA **feb02e089e4f1a28cdc6572fd800b2e7844bc2664cc598aac4654fe2cc0d13f8**. 자동 입력과 물리 입력/IME/reader/scanout은 별도다. startup settle 뒤 UIA bounds를 다시 읽으며 이전 묶음의 runtime 준비 전 close 실패는 W6-24 미완료다.

Web Chrome154.0.8037.98/WebGL2 ANGLE AMD780M/D3D11의 AABB **629.3671875×54**에서 경계 밖 실제 pointer 무시/안쪽 활성화, mark453 pixels 변화 PASS다. DOM semantics activate로 분리한 편집기 3회 이동386→20→386에서 동일 input/text/backward[1,6]·focus를 유지했다. pointerdown은 제품 정책대로 canvas를 focus한다. theme/locale·mark semantics identity·Table detail/dialog/back·760→230px Wrap·public SDK close 후 canvas/input/font/mark=0/contextLost=true/errors=[] PASS다. Web bundle SHA **3b6ebdc46f224dd5baff1218bb24e0d23e3e9bd9f946d93345a103cd8b85d6b8**. owned serverPID32744 closeACKHTTP200/exit0·browser closed다.

**현재 source SHA256.**

| file | SHA256 |
| --- | --- |
| Nelyx/src/framework/widgets/basic.ts | bcb68cb24854a552e26dc1f46a907eab683b5c5b53b83ea45702d19a1402d136 |
| Nelyx/src/framework/widgets/root.ts | 5226234e49860657a15961cecc3d75abf79dab71e632488676fa649d457b322e |
| Nelyx/src/ui/matrix4.ts | e81cd9b5acd2a4435eb68ab1567a37ad373191f2f4927e8ff2a5dc15a9c4421d |
| Nelyx/src/framework/rendering/opacity.ts | 58c93c76d0ea92cb25cf0aea63601adf59a493f59f052c595de1db5e8c8dd04a |
| Nelyx/src/framework/rendering/object.ts | 54f9498a7c64034f84006deec0254eddd0d531354055286d44c12d567457eca3 |
| Nelyx/src/framework/widgets/navigation.ts | a13ddd79528d512c025bb1e8a8a43fe862eedc86ade2eac13e0dd843e6ca4104 |
| Nelyx/src/framework/rendering/boxes.ts | d2a81d4a4eaad7ef55ddefc0086b81426d3a6159972b83009044a5836ec76f19 |
| Nelyx/src/framework/painting/context.ts | 9c84d30cd328935528fa59ec0b73227e6b71710836be1393c357bb917ffe2914 |
| Nelyx/src/framework/widgets/semantics.ts | 4312dfafb9da51e0c97fcc6e985864db921372f84116a0a938e216f92370ef5c |
| Nelyx/src/ui/geometry.ts | 3c6a81e5cc8b420bf6a4221f3033ab97d53954dac89c84186a6eef6bca102d8f |
| Nelyx/src/framework/rendering/custom-paint.ts | 0c70acb40fc1b692af7909f6265b54ef3953bba00e010c8cb823f259e53dd34d |
| sample/nelyx-testbed-app/src/app.ts | 165c8f77860f9aff63b47ce20533561399d835fdae0109f40b78ae80f9836403 |
| Nelyx/sdk/tooling/cli/templates/nelyx-app/src/app.ts | 165c8f77860f9aff63b47ce20533561399d835fdae0109f40b78ae80f9836403 |

Flow·Path/Clip/retained layers와 후속 family를 계속한다. Android와 Windows/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine 수락은 notVerified다. Apple/Linux native 검증은 사용자 지정 SKIPPED/provider notVerified이며 6 target code 범위는 유지한다. 전체 goal은 active다.

**정리 완료.** allowlist .tmp/work6/projective의 **36537 files/6393 directories/2285707283 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했고 descendant links/process references=0이다. 임시 build·consumer·oracle/test shim·baseline·draft·logs/screenshots/archives를 정리하고 Flutter pin/Dart SDK·현재 및 historical native supplier cache를 보존했다. one-time helper도 제거한다. 최종 **764 reviews/771 source hash references·72 public exports**, 전체 goal은 active다.

### 2026-10-11 — Flow delegate·paint order·group opacity·repaint cache 묶음

**구현.** framework/rendering/flow에 FlowDelegate·FlowPaintingContext interface·FlowParentData·RenderFlow, framework/widgets/flow에 Flow·Flow.unwrapped를 추가했다. delegate size와 child constraints로 독립 layout을 수행하고 offset은 zero다. paintChildren callback에서 child index별 full matrix를 복사해 paint한다. callback 밖 helper, 중복 paint·잘못된 index/옵션·nonfinite 또는 범위 밖 opacity를 all-build 거부한다. child paint는 실제 saveLayer group alpha를 사용하며 opacity0도 transform과 hit order를 게시한다. hit는 마지막 성공 paint의 역순이고 child/data identity를 확인해 tree 변경 후 index를 다른 자식으로 retarget하지 않는다. clip none도 Flow box의 hit gate를 유지한다. unpainted child semantics는 원본의 identity transform fallback을 유지한다.

none/hardEdge/antiAlias/antiAliasWithSaveLayer는 실제 clipRect/saveLayer 명령을 사용한다. 실패한 callback·child paint/save scope는 새 명령과 transform 상태를 rollback하고 이전 성공 hit order를 보존한다. native GPU submission/presentation의 transaction 완료를 뜻하지 않는다. 원본의 debug-only 중복 paint 진단과 범위 밖 alpha clamp 대신 명시 all-build 검증을 적용한 차이다.

**구독·기본 cache·offset guard.** typeToken/shouldRelayout/shouldRepaint 정책으로 layout/paint invalidation을 구분하고 Listenable repaint는 paint만 갱신한다. 등록/교체/attach/detach/dispose 실패를 처리하며 이전 callback은 제거 실패 때도 비활성화한다. 기본 Flow는 추가한 RepaintBoundary.wrap/wrapAll로 child key 또는 index 기반 ValueKey wrapper를 적용한다. Flow.unwrapped/명시 unwrapped option은 wrapper를 생략한다. 현재 cache는 JS command cache다. Flutter retained ClipRectLayer/OpacityLayer·native compositing·GPU raster cache/isRepaintBoundary의 완료로 분류하지 않는다.

테스트 중 parentData.offset 직접 쓰기가 RenderBox.offset의 paint guard를 우회함을 확인했다. BoxParentData.offset을 finite copied snapshot getter/setter로 바꾸고 paint/measurement 중 직접 쓰기도 mutation 전에 거부한다. 나머지 기존 object/repaint-boundary **171 member/declaration의 AST token이 동일**함을 확인했다. 기존 offset 객체를 후속 mutation해도 render 상태가 바뀌지 않는다.

**원본·portable.** exact Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a의 **22 unchanged fragments**(FlowDelegate/FlowParentData class, sizing/intrinsic/layout·indexed painting·paint scope·hit/applyPaintTransform·delegate/clip setter·attach/detach와 paint-plane math helper)를 raw span SHA 검증 후 Dart3.14.0-296.0.dev로 실행했다. actual locked vector_math2.4.3, package lock/archive SHA를 확인했다. geometry/render/painting/layer/Listenable shim을 사용했으며 native Flutter engine/layer cache 실행과 별도다. size100×80·children20×15·paint b→a·a group alpha128·translation[10,20]·reverse hit a·opacity0 hit a·omitted identity·intrinsic[100,100,80,80]·detach listener0·duplicate debug reject를 비교했다.

20분 timeout의 **20 tests/213 assertions/1 file**, strict fixture·core/root/compiler·SDK build PASS다. 실제 FrameworkRoot에서 Flow source repaint 뒤 child layout/paint **각 1회**를 유지하면서 cached commands의 parent transform·semantics10→20·captured pointer local[2,3]를 갱신했다. failure rollback/초기 등록 실패와 synchronous invalidate cleanup·retired callbacks·key reorder·clip4정책·scope/tree/offset guard도 확인했다. pinned native Hermes CLI(no polyfill)에서도 실제 Root/cache/full matrix/group alpha/semantics/pointer·offset guard·teardown **16 assertions/976 wire bytes**, layout1/paint1 PASS다. 기존 scheduler의 미실행 async branch Promise 분석 warning은 남으며 async scheduler 전체 검증과 별도다.

**실패 보정.** 초기 compiler의 base private intrinsic 이름 충돌과 parent-data narrowing은 intrinsicDimension/local data로 수정했다. Dart shim의 protected annotation/public repaint named argument·상속 size와 충돌하는 shim function을 수정했고 원본 fragments는 변경하지 않았다. TS fixture의 boolean repaint가 Listenable source field를 가린 오류는 repaintNeeded로 고치고 fixed child indices를 tuple로 표현했다. 실패 기록은 portable evidence에 남겼다.

**coverage.** 이전764 reviews 중 **722 유지/42 source hash 재검토**, **46 추가/1 개선** 후 **810 reviews/817 declaring-export-source hash references**다. fresh regeneration에서 semantic review/runtime evidence를 보존했다. Flow family/RepaintBoundary source selection으로 **C#24/Dart121**, 121 symbols 실제 분석 PASS다. 현재74028 records는 **missing72599/partial692/adapted730/implemented7**이며 전체 구현률이 아니다. layer/compositing 등 미완료 class 의미는 partial로 유지한다.

**실제 패키지·실행.** 6 archives의 외부 Web/Windows consumers 각각 **74 direct ESM imports/75 declarations의 .js 경로·installed source hashes·template parity·compiler** PASS다. sample/template 표식은 Flow 기본 RepaintBoundary wrappers와 animation repaint·full matrix·opacity.8을 사용하며 기존 CustomPaint Rx/Tz 및 projective counter를 유지한다. Web package357 files/26493461 bytes, Windows package917 files/262872905 bytes의 build·verify PASS다. C++를 변경하지 않았으므로 native ABI1/wire3 및 source-matched supplier w6-matrix4-1e9d254d80ab8acf(1e9d254d80ab8acfe1de192445ec3149acbc384fa9f785a3f2145b80ddd4e1bb)을 유지했다. 이전 native CABI primitive pixel proof는 그 당시 범위 그대로다.

Windows RNW x64 Release/Hermes/Graphite-Vulkan/AMD780M/DPI192에서 같은 mark UIA runtimeId의 x1096→1100, width96→91을 확인했다. 동일 초기96×96 Flow clip crop에서 채널 차이10 초과 **2964 pixels**다. projective counter 경계 밖 실제 Win32 pointer 무시/안쪽 activation·SendInput text·편집기 동일 UIA ID/text 3회 이동·wheel·Table detail/dialog/back PASS다. screenshot을 확인했고 exit0/fatal/JS errors=[]/**closed views=0 consumers=0 gpuDrained=1**이다. EXE SHA **da15a1e60b4526e730b40ad46e3fbd423cbd591bc61aafb63598422ae7fd64b8**, Hermes bundle SHA **b90f4857a1aa72317160255b64f4546621137b75ac438ec77f6e6408e2f12453**. automation은 physical input/IME/reader/scanout 수락과 별도다.

Web Chrome154.0.8037.98/WebGL2 ANGLE AMD780M/D3D11에서 같은 mark DOM node의 x692→694·width48→45.703125를 확인했다. 동일 초기48×48 Flow clip crop에서 **967 pixels**가 바뀌었다. counter 실제 pointer 경계/activation·DOM semantics activate로 분리한 동일 editor/text/backward[1,6]·focus 3회 이동386→20→386·theme/locale·mark identity·Table detail/dialog/back·760→230px Wrap PASS다. SDK close 뒤 canvas/input/font/mark=0/contextLost=true/errors=[]다. bundle SHA **28c6920aaf307069aaff72988d3881f9b6b84dc5b1139f0476c27a04767157c1**, owned serverPID33044 closeACKHTTP200/exit0·browser closed다.

**현재 source SHA256.**

| file | SHA256 |
| --- | --- |
| Nelyx/src/framework/rendering/flow.ts | 47d6c3cebf3fe22d91ee1b47559eeeef11cee30b1b8d4bb6b2f0b9220102b15e |
| Nelyx/src/framework/widgets/flow.ts | c3a30ef0e81b5a641863be498ac2886c2eb680654dc85f842cc26cedad095513 |
| Nelyx/src/framework/rendering/object.ts | 87225fb1f44444874d927743b7b1a07931520810dc382505836284d3d8c04855 |
| Nelyx/src/framework/widgets/repaint-boundary.ts | bfe8ad1c36558a1d7af00269dde25e8a77e183f097accfb0171190488ece580c |
| sample/nelyx-testbed-app/src/app.ts | e49fbcc85a08f3f907a690d532cb2d6dfc13cec1e00ebfe5476063cb3b6a2f02 |
| Nelyx/sdk/tooling/cli/templates/nelyx-app/src/app.ts | e49fbcc85a08f3f907a690d532cb2d6dfc13cec1e00ebfe5476063cb3b6a2f02 |

Path/Clip/retained layers·전체 Matrix4 및 후속 family와 W6-24 startup close를 계속한다. native editor overlay alpha/clip/warp, Android와 Windows/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine 수락은 notVerified다. Apple/Linux native 검증은 사용자 지정 SKIPPED/provider notVerified, 6 target code scope는 유지한다. 전체 goal은 active다.

**정리 완료.** allowlist .tmp/work6/flow의 **36562 files/6402 directories/2223746613 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했고 descendant links/process references=0이다. 임시 build/consumer·oracle/test shim·baseline·draft·logs/screenshots/archives를 정리하고 Flutter pin/Dart SDK·현재 및 historical native supplier cache를 보존했다. one-time helper도 제거한다. 최종 **810 reviews/817 source hash references·74 public exports**, 전체 goal은 active다.

### 2026-10-11 — Windows first-load close·늦은 surface effect admission 묶음

**문제·수정.** 이전 matrix4 실행의 runtime 준비 전 WM_CLOSE가 Composition shutdown requires one live native runtime으로 실패한 기록을 보존하고 default WindowsAppHost를 수정했다. 초기 close를 UI owner에 저장하며 RNW **InstanceLoaded** 성공 이후 재개한다. primary RNW0.83.2 ReactInstanceSettings.idl에서 이 event가 JS dispatcher에서 bundle 실행 완료 후 발생하고 Failed를 제공함을 확인했다. Failed boolean만 UI dispatcher로 보내며 JSI/Context/GPU object는 넘기지 않는다. pending/closing 중 반복 요청은 합친다. 기존 **phase=closed/drained=true/consumers=0/views=0** 검사 후 UI device close/window Destroy를 유지한다. GPU active만 보고 SDK handler 등록 이전에 close하는 race를 만들지 않는다.

**JS admission.** bindWindowsNativeHost.isClosing은 native UI가 admission을 닫고 JS shutdown callback이 아직 대기하는 상태도 확인한다. 이미 JS closing이면 native API를 다시 읽지 않는다. Windows surface adapter의 optional isClosing으로 뒤늦은 initial effect를 막고, effect의 첫 검사와 retainOwner 사이에 close가 경합하면 생성한 interaction을 정리한다. asset/native owner를 새로 열거나 정상 close cancellation을 startup 오류로 보고하지 않는다. 실제 retire 실패는 계속 보고하며 의존성을 보존한다. 다른 target은 hook을 공급하지 않아 기존 effect 경로를 유지한다.

20분 timeout의 **5 tests/29 assertions/1 file**, strict fixture·SDK/root compiler PASS다. 실제 binding/effect code에 native API/hook driver fixture를 공급해 synchronous seal·owner/native count drain·failed drain retention·JS callback 전 native phase 관측·늦은/racing effect의 assets/owner 미개방과 interaction cleanup을 확인했다. native acceptance로 대신하지 않는다.

**C++/package·실제 실행.** SDK native WindowsAppHost header를 consumer에서 새로 컴파일했다. Skia library supplier source에는 Windows Composition/host header가 포함되지 않으며, 이 header들은 consumer compilation 범위다. 실제 supplier의 모든 source hash와 별도의 installed CompositionSession/RNSkWindowsHost header bytes를 검증했다. 이 Skia source는 바꾸지 않았으므로 native ABI1/wire3·current supplier w6-matrix4-1e9d254d80ab8acf/SHA1e9d254d80ab8acfe1de192445ec3149acbc384fa9f785a3f2145b80ddd4e1bb을 유지했다.

첫 candidate SDK/package는 runtime 검증 전에 native-UI admission guard를 더 보강하며 superseded로 보존했다. local SDK tgz의 정확한 SHA512를 owned consumer lock에 반영하고 npm ci로 재설치했다. 최종 **74 core ESM imports/75 declarations의 .js 경로·5 SDK installed source hashes·consumer compiler**, Windows final package **917 files/269026746 bytes**의 build·verify PASS다. RN0.83.10/RNW0.83.2/Hermes bytecode99/AMD780M Graphite-Vulkan/x64 Release/MD이고 qualification은 notVerified다.

실제 제품 package를 수정하지 않은 상태로 own HWND에 WM_CLOSE를 보냈다. bundle 로드 전 **0.361s**의 첫 요청은 deferred1→requested1→closed1, **0.219s**에 연속3회 보낸 요청도 deferred1→requested1→closed1이었다. 각각 **1.196s/0.855s**에 exit0, fatal/JS errors=[]/**closed views=0 consumers=0 gpuDrained=1/INSTANCE_DESTROYED/APP_STOP**다. 강제 종료·두 번째 close 재시도·임시 JS delay 없이 통과했다. 별도 ready 실행에서 actual counter pointer·SendInput text·동일 UIA editor ID/text 이동 후 일반 close도 requested1/closed1·exit0·errors=[]였다. ready screenshot을 확인했다. Bundle loaded는 first-frame/scanout 증거와 별도다.

EXE SHA **bde623a2f2d467f8c3c8192db52f1470d33d89b58c8cc6935d692468685b0733**, Hermes bundle SHA **cdb468bc9cb6c10b7284233fe24577f3ed4543ebfd6bf1d4be9334fe1adbebb7**. 이전 startup close FAIL은 w6-canvas-matrix4-20261011의 historical failure로 유지한다. receipt 조립 중 consumer-compiled Windows header를 supplier source-map key로 잘못 조회한 오류는 실제 source-map 전체 hash + installed consumer header hash를 각각 검사하도록 고쳤으며 검증을 약화하지 않았다.

**범위.** 첫 로드의 cooperative early/duplicate/normal close만 scoped PASS다. failed-bundle retained-owner branch는 code-only이며 full reload/restart·fatal/forced teardown·graphics loss/recovery·physical input/IME/reader/performance/scanout/signing/clean-machine 수락은 미완료다. Apple/Linux native 검증은 사용자 지정 SKIPPED/provider notVerified, Android notVerified다. Flutter API 구현을 추가로 완료했다고 분류하지 않았고 **810 reviews/817 hash references**, fresh regeneration에서 review/runtime evidence 보존을 확인했다. 전체 goal은 active다.

**현재 source SHA256.**

| file | SHA256 |
| --- | --- |
| Nelyx/sdk/src/platforms/windows/application.ts | eb69a755347a4ec1ac02e2dcd8413a9059f9da56428c7e905da500b305dc3764 |
| Nelyx/sdk/src/backends/react-native/surface.tsx | 98646342e6eb4bb767799352b3d5c8273cba994a91e68bec2d2394fc67598bf1 |
| Nelyx/sdk/src/platforms/windows/surface.tsx | 4601023083aa15cbd6096dbde1bf3eeb3bbfbf9838983a18a951bbff2d02a87a |
| Nelyx/sdk/src/platforms/windows/native-host.ts | be8a9548a9da5eb21c1cc1442131d79f087a076c04bfdc60ceea77c982e46ea9 |
| Nelyx/sdk/native/windows/WindowsAppHost.h | b351a8b16cf9507fd6e4123c7d1a00ba7e93dcda006c93c0a237311240a38053 |

이 묶음을 allowlist 정리한 뒤 Path/Clip/retained layers·전체 Matrix4와 후속 W6 family를 계속한다.

**정리 완료.** allowlist .tmp/work6/startup-close의 **29491 files/5336 directories/2216492984 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했고 descendant links/process references=0이다. candidate/final build·consumer·fixtures·baseline·draft·logs/screenshots/archives와 superseded SDK archive를 정리하고 Flutter pin/Dart SDK·현재 및 historical native supplier cache를 보존했다. one-time helper도 제거한다. 최종 **810 reviews/817 source hash references·74 core public exports**, 전체 goal은 active다.


### 2026-10-11 — Path recorder·draw/clip·wire4·enum literal coverage 묶음

**구현.** ui/path에 mutable CPU Path recorder를 추가했다. 절대/상대 move·line·quadratic/cubic/conic curve, close, addRect/addOval/addPolygon, nonZero/evenOdd fillType, Path.from·reset을 제공한다. 기록 좌표는 finite float32로 복사하고 polygon 갱신은 입력 검증 뒤 한 번에 반영한다. Path.from은 native copy-on-write 대신 recorder storage를 복사한다. Canvas.drawPath/clipPath는 Path·Paint의 불변 snapshot을 저장하며 후속 reset/변경과 분리된다. GPU object/resource handle은 framework tree에 들어오지 않는다. contains/getBounds·arcs·RRect/RSuperellipse·add/extend/combine/shift/transform·metrics와 retained ClipPath widget/layer는 여전히 미완료다. 문자열 union PathFillType에 runtime enum object가 있다고 주장하지 않는다.

**Backend·wire.** RN/JSI·CanvasKit·공유 C++ replay가 실제 SkPathBuilder로 경로를 만들고 drawPath/clipPath를 호출한다. builder/path는 기존 replay cleanup 소유권에서 정리된다. Flutter addOval의 legacy startIndex1을 명시해 RN binding 기본값0과의 차이를 보정했다. RN rectangle은 기존 native setLTRB를 사용해 LTRB→XYWH 재계산 손실을 피한다. 이미 제공되던 native method의 누락된 TS 선언과 web adapter도 맞췄다.

native ABI1을 유지하며 **wire4**에 draw/clip path header21/22와 operation record23을 추가했다. 이전 wire1~3은 읽는다. native는 fill/flags/count/operation order·arity·reserved/padding·nonfinite/rectangle를 전체 preflight한 뒤 paint한다. Path record도 4096 expanded records/512 KiB/32 layer 예산에 포함한다. 큰 Path가 반복될 때 마지막까지 capture하던 비용을 고쳐 첫 예산 초과에서 중단한다. finite nonpositive conic weight는 Skia에 그대로 전달하며 overflow/nonfinite/negative rectangle/unknown enum은 all-build 거부한다. engine SafeNarrow의 범위 밖 값 처리를 그대로 복제한 것은 아니다.

**원본·portable.** exact Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a의 path.cc에서 **16 unchanged CanvasPath methods**를 LF-normalized span SHA로 확보해 pinned Skia에 링크한 작은 C++ oracle로 실행했다. absolute/relative primitives·get/set fill·rect/oval·close/reset과 16 paths를 사용했다. CanvasPath/resetVolatility/SafeNarrow shim과 CPU reference이며 Flutter engine/Dart native wrapper 실행은 아니다. Path/PathFillType selection을 추가해 **C#24/Dart123**, 실제123 symbols 분석 PASS다.

20분 timeout의 **12 tests/67 assertions/2 files**(core10/59, coverage identity2/8), SDK/root build·typecheck·strict tool compiler PASS다. immutable nested snapshot·independent copy·polygon atomicity·invalid/sparse input·expanded admission early-stop·wire metadata·RN/Web builder failure와 temporary cleanup을 확인했다. 기존 Canvas **24 members의 AST tokens**가 동일하다. 초기 readonly CanvasKit InputRect compiler 오류와 Bun filter/fixture import 경로를 고쳤으며 검증을 약화하지 않았다.

**실제 primitive pixels.** C ABI Graphite/native Vulkan/AMD780M과 CanvasKit0.41·Chrome154/WebGL2 ANGLE AMD780M/D3D11에서 **12 fixture tiles**, 원본 C++ CPU oracle를 비교했다. winding/evenOdd hole, absolute/relative cubic/quadratic/conic, implicit start/repeated move, close 후 relative, oval 후 relative line, empty/move-only, intersect/difference clip, zero/negative/unit conic weight, nested clip/group alpha/full perspective다. **20개 interior/empty 표본은 채널 차이1 이하**이며 malformed11 + old-wire path 거부3, 총14건을 확인했다. malformed11은 다른 clear를 앞에 넣어도 기존 pixels가 그대로였다. 유효 legacy wire1~3 clear도 통과했다.

**경계 fidelity는 PARTIAL이다.** native Graphite와 Ganesh/CPU는 non-AA 요청에서도 edge coverage/rasterization이 다르다. native/Web 차이는 tile별0~301 pixels·최대채널179, Web/CPU 차이는0~88 pixels·최대238이다. 전체 이미지 일치나 hard-edge raster parity로 승격하지 않았다. BGRA C ABI readback을 RGBA로 정규화했으며 초기 boundary 표본 실패와 전체 tile delta를 evidence에 남겼다. 두 reference/실행 screenshots를 확인했다.

**coverage 도구·상태.** exported pure string-union의 실제 literal을 compiler로 확인해 upstream ENUM FIELD만 명시 literal identity로 연결하도록 도구를 보강했다. member:null/literal은 runtime enum property를 뜻하지 않는다. literal 제거/변경·declaring/export source hash 변경은 review를 무효화한다. 초기 수동 union-field mapping이 regeneration에서 사라진 것을 이 규칙과 작은 identity tests로 고쳤다. 새 **25 behavior reviews**, 이전 Canvas19 hash 재검토 후 **835 reviews/842 declaring-export-source hash references**, fresh regeneration에서 semantic fields/runtime evidence 보존 PASS다. 추가74개 literal name matches는 compiler-only partial이며 새 행동 완료로 집계하지 않았다. 현재74028 records는 **missing72500/partial769/adapted752/implemented7**이다.

**외부 package.** 6 final archives와 isolated installed CLI로 Web/Windows 소비 앱을 생성·공급했다. 각각 **75 direct core ESM imports/76 declarations·76 source files·.js declaration path·installed source bytes·template parity·compiler** PASS다. final core archive SHA512와 runner lock integrity, packed coverage hash도 검증 당시 snapshot과 일치했다. Web **358 files/26536006 bytes**, Windows **918 files/263068590 bytes**의 installed CLI build·package verify PASS다. 처음 metadata snapshot archive는 superseded로 보존 후 정리하며 최종 runtime evidence는 패키지 snapshot 이후 repository coverage에 기록했다. qualification은 notVerified다.

sample/template CustomPaint 표식은 polygon clipPath와 cubic/conic closed drawPath를 사용한다. 기존 Flow/RepaintBoundary·full Rx/Tz transform·group alpha·projective counter도 유지했다. Web 같은 mark DOM node의 x692→694·width48→45.703125, 초기48 crop **958 pixels** 변화다. 실제 pointer counter 활성화·동일 editor/text/backward[1,6]/focus의386→20→386 세 번 이동 PASS다. public closeAllWebApplications 후 canvas/input/mark=0, JS/app errors=[]이며 browser/favicon.ico404는 ambient request로 별도 기록했다. owned server/browser는 닫혔다.

Windows RNW0.83.2/RN0.83.10/Hermes bytecode99/x64 Release/MD/Graphite-Vulkan/AMD780M/DPI192에서 same mark UIA ID의 x998→1002·width96→91, 초기96 crop **2925 pixels** 변화다. actual Win32 pointer counter·편집기 동일 UIA ID/텍스트의659→200→659 세 번 이동 PASS다. 이번 editor text 입력은 UIA ValuePattern programmatic이며 physical keyboard/IME 증거가 아니다. 처음 선택한 Move editor right peer가 InvokePattern을 지원하지 않은 실패를 보존했고 실제 pointer button 경로는 통과했다. 해당 UIA peer와 reader/action 전체 수락은 W6-16에 남는다. 최종 exit0·fatal/JS errors=[]/**closed views=0 consumers=0 gpuDrained=1/INSTANCE_DESTROYED/APP_STOP**이다. 첫 실패 실행도 cooperative drain으로 종료했고 강제 종료하지 않았다.

Windows EXE SHA **bbd22fb0f83e43fef4829eaa4c3bc1bb2cb880a61382f9461b83d8f06615be2e**, Hermes bundle SHA **7eab4e1952c3f806e2e86092ea0a110eb324a3c213e7fddfc27d1574cdefba3e**. Web bundle SHA **67f4b23ff3fb395e741282450993fed434f3272b663fa6aacc14011681f42ce2**. 새 immutable supplier **Nelyx/.cache/native/windows/w6-path-4f7b3d8f939fd9e1/inputs.json**, SHA **4f7b3d8f939fd9e1f416351b9cd1504874a6191a0ab738db375a6266bcc3344d**, **18 libs/1795 files/221051959 bytes**이며 actual compiled source146 hashes가 현재와 같다. 이전 supplier는 historical로 보존했다. C ABI8/8·RNW binding16/16 native builds PASS다.

**현재 source SHA256.**

| file | SHA256 |
| --- | --- |
| Nelyx/src/ui/path.ts | 48d9145ffe2f52ceaea6d45c21fa1d480a81440256baa6ecbc2535278eeacafa |
| Nelyx/src/ui/canvas.ts | cad1a847b6a0e35e2b399b58ea09708083f02ec2fe77cdd19eea275e7db55ba0 |
| Nelyx/src/ui/frame.ts | 8e73769c5b6d23e10d5f8d3bb64e5b5aaddd740df070b6b8092fa7c18a939678 |
| Nelyx/src/ui/frame-wire.ts | ac307647fe71b2c0b0e03ac4266b8e7904b971886c49508c76811c0218e54fd6 |
| Nelyx/src/ui/types.ts | 1438d834adea39be8bdebd81368c20d4ca69c3ceb71d6ef86391ecbb15d19783 |
| Nelyx/skia/native/core/core.cpp | 4e8a262603d1d8e03af19ba4ebb53785f9149830783db460e92e5bc9ae5d0999 |
| Nelyx/skia/packages/rn/src/renderer.ts | d71899bdb0a51da2756c2bdb805c154228adbe8374d680836587bc01d176b3e9 |
| Nelyx/skia/packages/rn/src/skia/types/Rect.ts | ef9f10558dc8723b6b374d22c48db23a3012e83d43281fc9347c156203f29742 |
| Nelyx/skia/packages/rn/src/skia/web/JsiSkRect.ts | 22585d5ddec721a1c6520af4c2771531bf472bdd98c5bd3d786e8f871baab6e6 |
| Nelyx/skia/packages/web/src/library.ts | b3cc58720f104747693b3084c13c7c53ffc66c5c2c3ddb03411d1bfc01f9b358 |
| tools/Nelyx.FrameworkToTypeScript/src/coverage.ts | 0cd4b96a22a35462dae94256e7d95a53f522494626cc3f74973654c7cc04e2ba |
| tools/Nelyx.FrameworkToTypeScript/src/coverage-format.ts | e9d19691de31456f414bfe87d10a82df42cb6841e5c9ea0d9da6af963be0b27b |
| sample/nelyx-testbed-app/src/app.ts | 57de1abec2bfd6844a2d76464ab9db9f70ccef8bf42e80d216d32bead67ca277 |
| Nelyx/sdk/tooling/cli/templates/nelyx-app/src/app.ts | 57de1abec2bfd6844a2d76464ab9db9f70ccef8bf42e80d216d32bead67ca277 |

이 묶음 정리 뒤 Path queries/Clip widget·retained layers·전체 Matrix4와 후속 W6 family를 계속한다. Android runtime와 Windows/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine 수락은 notVerified다. Apple/Linux native 검증은 사용자 지정 SKIPPED/provider notVerified, 6 target code scope는 유지한다. 전체 goal은 active다.


**정리 완료.** allowlist .tmp/work6/path의 **47112 files/7607 directories/3242639612 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했고 descendant links/process references=0이다. oracle/native/consumer builds·fixtures·drafts·candidate/final archives·logs/screenshots·one-time helper를 정리하고 Flutter pin/Dart SDK·현재 및 historical immutable native supplier cache를 보존했다. 최종 **835 reviews/842 source hash references·75 core public exports**, 전체 goal은 active다.

### 2026-10-11 — CustomClipper·rect/oval/uniform rounded Clip·private override inventory 묶음

**구현.** ui/clip 문자열 union과 framework/rendering/clip·framework/widgets/clip 직접 모듈을 추가했다. CustomClipper는 reclip Listenable을 전달하고 render instance마다 구독·복사한 geometry cache를 유지한다. delegate 교체·등록/제거 실패·동기 notification·attach/detach/dispose·reentrant callback을 처리하며 퇴역 callback은 inert로 만든다. reclip은 paint·통합 semantics를 갱신하고 child layout/widget build를 다시 하지 않는다. 실제 FrameworkRoot와 RepaintBoundary에서 child layout1/paint1, dirty build=false, 갱신된 hit/approximate semantics와 captured pointer 경로를 확인했다. clip callbacks/반환 getter의 tree mutation도 all-build 거부하는 더 강한 보호다.

ClipRect·ClipOval·균일 원형 radius ClipRRect와 none/hardEdge/antiAlias/antiAliasWithSaveLayer를 실제 Canvas clip/saveLayer로 기록한다. Rect widget 기본은 hardEdge, Oval/RRect는 antiAlias다. pin처럼 default RRect는 corner hit를 별도 제한하지 않고 custom rect/RRect clipper는 Clip.none에서도 제한한다. Oval은 Clip.none에서도 ellipse hit gate를 적용하며 zero-area의 NaN-axis 원본 동작을 유지한다. ClipRect/Oval의 실제 unmount는 dispose 전에 clipper=null로 정리한다. approximate semantics는 incoming/translated clip과 교차하는 보수적 사각형이며 실제 곡선 mask/reader fidelity는 별도다. 전체 per-corner/directional BorderRadiusGeometry·ClipPath/RSuperellipse·diagnostics·retained engine layer는 열려 있다. widgets/basic의 W5 ClipRect shortcut은 유지하며 새 API는 widgets/clip에서 직접 사용한다.

**원본·portable.** exact Flutter pin의 CustomClipper/clip render methods·Clip enum·Rect/RRect helper **37 unchanged Dart fragments**를 span hash로 검증하고 작은 geometry/render/layer shim에서 실행했다. **19 shape/policy cases×10 hit points**, paint/approx trace와 delegate cache/reclip/layout/lifecycle를 TS와 비교했다. Flutter engine/native retained layer 실행은 아니다. **20 tests/237 assertions/1 file**, fixture/tool/SDK/root compiler PASS, timeout20분이다. 처음 unmount fixture의 필수 semantics capability 누락은 수정 후 통과했다.

**가정 정정.** 큰 uniform radius에 대해 backend가 X/Y를 독립 clamp한다는 초기 가정은 틀렸다. 실제 pinned Skia CPU와 CanvasKit0.41 probe 모두 20×70/radius100을 radii[10,10]으로 common-scale하고 contains(1,10)=true였다. backend 차이/수정으로 주장하지 않는다. ClipRRect 정규화는 copied snapshot과 hit 계산에 필요한 유효 radius를 구하며 native C++는 변경하지 않았다.

**inventory/도구.** private instance override의 dynamic dispatch body가 기존 inventory에서 빠지는 문제를 고쳤다. 같은 Dart library private identity와 inherited method/getter/setter를 analyzer element model로 확인해 구현 dependency에 추가하며 public으로 승격하지 않는다. fresh analyzer **74123 records(+95)/47282 public/778 files/15 entrypoints/diagnostics0**, frontend SHA2ae66efa0387e1c3461c85e3fbedc5f7f1f5fe17d0df394f9b7d95494859b454다. frontend source+lock identity가 없거나 다르면 coverage cache/선정 분석을 거부하고 fresh analyzer를 요구한다. 이전 cache 거부와 product coverage 불변을 확인했다. Clip family는 W6-05로 배정하고 private defaultClip getter를 실제 protected method에 명시 연결했다. private base를 coverage 숫자를 위해 public API로 노출하지 않았다.

새 **51 reviews**와 8 Dart selections를 추가했다. C#24/Dart131이며 실제 Dart 분석 PASS다. 첫 selection checkout-byte hash 사용은 LF-normalized upstreamSha256으로 고쳤다. 이전835를 보존해 **886 reviews/893 source hash references**이며 regeneration에서 reviewed fields/evidence 보존 PASS다. 현행74123 records는 **missing72549/partial784/adapted783/implemented7**이다. class/enum/full rounded geometry는 partial이며 diagnostics/private cache/retained layers를 완료 처리하지 않았다.

**외부 package·실행.** 6 archives→isolated installed CLI로 Web/Windows 앱을 생성·공급·설치했다. 각각 **78 direct core ESM imports/79 declarations/79 sources**, emitted .js 경로·installed source bytes·template parity·core tgz SHA512/runner lock·packed coverage snapshot 검증 PASS다. Web **360 files/26618250 bytes**, Windows **920 files/263142550 bytes**, build/verify PASS이며 qualification notVerified다. consumer header는 supplier source inventory와 별도 owner 경로에서 검증했다.

sample/template은 CounterOvalClipper(reclip animation)의 타원 버튼, 표식 ClipRRect+saveLayer, progress ClipRect를 연결한다. Web Chrome154.0.8037.98/CanvasKit0.41/WebGL2/AMD780M D3D11에서 bbox 안·ellipse 밖 실제 pointer는 counter0을 유지하고 중앙 pointer는1로 올렸다. same mark DOM x692→694/width48→45.703125이며 pixel 변화는 아래 기록이다. same editor/text/backward[1,6]/focus를 유지하며 x386→20→386 세 번 이동했다. public closeAllWebApplications 후 canvas/input/mark0·JS/app errors=[]이며 favicon404는 ambient로 별도 기록했다. owned browser/server는 닫혔다.

Windows RNW0.83.2/RN0.83.10/Hermes99/Graphite-Vulkan/AMD780M/x64 Release/MD/DPI192에서 ellipse 밖/중앙 실제 Win32 pointer가 각각 counter0 유지/1 증가를 보였다. same mark UIA x949→953/width96→91과 same editor UIA/text x610→151→610 세 번 이동 PASS다. editor text는 ValuePattern programmatic이며 physical keyboard/IME 검증이 아니다. selected peer InvokePattern 문제는 이전 Path evidence대로 open이다. 정상 WM_CLOSE exit0·fatal/JS errors=[]/**closed views=0 consumers=0 gpuDrained=1/INSTANCE_DESTROYED/APP_STOP**다. Web/Windows screenshots를 확인했다.

Windows EXE SHA c3a0a8b159a123ca6fe84a21f5c974894066941122ca4cb4f1c3766dd1a6e4a6, Hermes bundle SHA ad7774fa388aab69227a353a4b38e0c95d3633d509bfd00e1a2b360578bb0d68, Web bundle SHA caff50612a2ed55eb9fedd9a6060be43a3aaa75e3830f82e8fc2d91512daf815다. native ABI1/wire4와 immutable supplier w6-path-4f7b3d8f939fd9e1/SHA4f7b3d8f939fd9e1f416351b9cd1504874a6191a0ab738db375a6266bcc3344d를 유지하고 **146 compiled source hashes/18 libs/1795 files/221051959 bytes**가 일치했다. consumer compiled WindowsAppHost/CompositionSession/RNSkWindowsHost도 별도 installed hash 일치다.

**표식 pixel 변화:** web 958 pixels (max channel delta>10, initial mark crop), windows 2925 pixels (max channel delta>10, initial mark crop).

**범위.** selected clip/reclip/widget lifecycle만 scoped PASS다. Android runtime, Windows/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine은 notVerified다. Apple/Linux native 검증은 사용자 지정 SKIPPED/provider notVerified이며 6 target code scope를 유지한다. 이 묶음 정리 뒤 전체 RRect/BorderRadiusGeometry·Path queries/ClipPath·retained layers·전체 Matrix4와 후속 W6 family를 계속하며 전체 goal은 active다.

**정리 완료.** allowlist .tmp/work6/clip의 **45267 files/7413 directories/3015467577 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했고 descendant links/process references=0이다. oracle/fixtures/analysis/drafts/archives/isolated consumers/native host build/logs/screenshots와 one-time helper를 정리하고 Flutter pin/Dart SDK·현재 및 historical native supplier cache를 보존했다. 최종 **886 reviews/893 source hash references·78 core public exports**, 전체 goal은 active다.

### 2026-10-11 — Radius·exact LTRB Rect·RRect·physical/directional/mixed BorderRadius 값 묶음

**구현.** ui/radius·ui/rect·ui/rrect·framework/painting/border-radius 직접 모듈과 내부 value-math를 추가했다. mutable GPU handle 없이 named factory·불변 값·이름 붙인 산술/보간·contains/query를 제공한다. Rect는 exact LTRB를 저장하고 기존 paint DTO의 x/y/width/height getter도 제공한다. RRect는 네 독립 타원 corner·공통 radius 축소·각 inner/middle rectangle·shift/inflate/deflate·분류/contains를 제공하며 실제 Rect 입력의 끝점을 재계산하지 않는다. 기존 plain XYWH 입력도 허용한다. Offset/Size 결과는 기존 좌표 DTO로, 전체 Offset/Size class 완료가 아니다.

BorderRadiusGeometry/BorderRadius/BorderRadiusDirectional은 물리/논리/혼합 값·factory·연산·보간·copyWith·LTR/RTL resolve·toRRect를 제공한다. 음수 border 식은 변환 때만 clamp하고 direction이 필요한 resolve는 null을 거부한다. TypeScript static factory inheritance를 위해 공유 option vocabulary를 쓰며 잘못 섞은/모르는 keyword는 all-build 거부한다. private Mixed 구현이나 _RRectLike abstract stub를 public export하지 않는다. 원본 private _RRectLike는 실제 RRect host의 공통 geometry만 명시 매핑하고 RSuperellipse 지원으로 승격하지 않는다.

**수치 의미.** IEEE NaN/Infinity 값과 원본 분류·half-open/NaN hit 정책을 유지한다. clamp의 NaN→maximum·음수 divisor에도 양수 modulo·nonfinite truncate 실패·Dart VM int64 포화 뒤 double 반환을 실행으로 확인했다. 이는 Dart VM/JS integer ABI 전체 재현 주장이 아니다. equals는 runtime constructor/동일 object 의미를 지키고 hashCode는 equal→equal hash를 만족하는 안정적인 로컬 hash다. Dart Object.hash 정수와 같다고 주장하지 않는다. final data field는 nonwritable이고 derived class 자체 field는 만들 수 있다. plain Offset/Rect getter는 값 생성 전에 한 번씩 복사한다.

**원본·검증.** exact pin의 **8 unchanged classes**(Rect/Radius/_RRectLike/RRect/BorderRadiusGeometry/BorderRadius/Directional/_Mixed)와 **math/lerp helper 2 groups**를 raw UTF16 span/source SHA로 확인하고 작은 Offset/Size/direction/annotation shim에서 실행했다. RSuperellipse는 미사용 반환형 shim이며 해당 method를 검증하지 않았다. 5 radius·10 Rect·7 RRect·15 physical/logical/mixed border 사례의 값·nonfinite/음수/과대 corner·query·보간·양 방향 결과와 수명 없는 value 실패 경로를 비교했다. **12 tests/141 assertions/1 file**, fixture/SDK/root/tool compiler PASS, timeout20분이다. Flutter engine/native renderer 실행이 아니다.

첫 source 추출의 CRLF 정규화 후 UTF16 offset 사용은 raw byte decode+모든 span hash 검증으로 고쳤다. 원본 RRect safeInnerRect를 XYWH로 바꿨다가 LTRB로 복원할 때 끝점이 약3.6e-15 달라진 테스트 실패는 exact Rect class 추가로 해결했다. 허용오차를 넓히지 않았으며 Rect 결과와 RRect factory 끝점은 원본 double 값과 일치한다. 이 사실이 기존 Canvas wire 전체의 정확한 LTRB 보존을 뜻하지는 않는다.

coverage regeneration에서 JSON.stringify가 -0을0으로 쓰는 metadata 문제를 발견했다. evidence oracle의 signed zero를 -0.0 문자열로 명시해 부호를 보존하며 NaN/Infinity도 문자열이다. 실제 비교는 원래 oracle JSON을 사용하고 추가 Object.is assertion으로 원본 -0 부호를 확인했다. 큰 double의 scientific/decimal JSON 표기 차이는 Node의 JSON IEEE754 deep equality로 검사한다. Python arbitrary integer와 float의 텍스트 차이를 동작 차이로 처리하지 않는다.

**coverage·외부 소비.** 새 **179 reviews/7 Dart selections**, 기존886을 보존해 **1065 reviews/1072 source hash references**, C#24/Dart138다. 실제 Dart 분석과 regeneration의 reviewed fields/runtime evidence 보존 PASS다. 74123 records/47282 public/778 files를 유지하고 **missing72372/partial789/adapted955/implemented7**이다. classes는 dependency/engine integration 범위를 남겨 partial이며 private raw/getValue32/helpers를 fake public API로 매핑하지 않았다.

SDK build 후 core archive를 외부 consumer에 설치해 **82 direct ESM imports/84 declarations/274 relative .js declaration imports/84 source files**를 확인했다. installed source bytes·core tgz SHA512와 lock·packed coverage snapshot 일치 PASS다. Node24.15.0에서 같은 oracle fixture를 실제 installed emitted JS로 실행해 **12 tests/141 assertions** PASS이며 external readonly/named factory/Rect→Canvas type contract도 통과했다. 이 Node fixture는 standalone harness이며 제품 runtime에 hook을 추가하지 않았다. immutable archive에는 검증 당시 pre-runtime receipt snapshot이 있고 repository에는 signed-zero encoding/후속 consumer 증거가 추가됨을 hash로 구분한다.

core tgz integrity는 sha512-m5T/5L01nhuh/g/Me4k1Qa83iriRiL0aDxLoeS8E4XGU+Qnp+mlw9/qtl5dnvX1Ix8D+oY1pQm2tx/ul4ZQg6Q==, packed coverage SHA b8f19ab6b2b2193d15fb86b0936b8753cc1fdc09749dc135713470ddb04d5824다. native code/ABI1/wire4는 변경하지 않았고 supplier w6-path-4f7b3d8f939fd9e1/SHA4f7b3d8f939fd9e1f416351b9cd1504874a6191a0ab738db375a6266bcc3344d의 compiled source146 hashes가 현재와 일치한다. 새 native compile/runtime을 수행했다고 주장하지 않는다.

**현재 source SHA256.**

| file | SHA256 |
| --- | --- |
| Nelyx/src/ui/rrect.ts | 025813d7925cb0315c61b8fb6d69f19dc14da0e43b9f7443b927cb2284c814b4 |
| Nelyx/src/ui/radius.ts | ce7762a56932b20ad2b0b0954edebdc72746f4bb5bac6a8688b14adfc0f76e9f |
| Nelyx/src/framework/painting/border-radius.ts | 464cfc80f4e2f982d3786c97ad73f1a6b929dabbdc5e232ca0564b38993fb947 |
| Nelyx/src/ui/rect.ts | 8508de998e61dc504155cf6052287b2ba0554f1b12de6e7e0e70efb00bdf5345 |
| Nelyx/src/ui/value-math.ts | c78c6fa106abc502b3019438c62385695e8ef90649062393246973c6027b73bf |
| tools/Nelyx.FrameworkToTypeScript/src/coverage.ts | 8e71a6b0fc6deab320fbac1b118e0c16833798c30a0ab9b5a24e9d7fa9b56dc7 |

**범위.** CPU 값 연산의 선정 범위만 scoped PASS다. toRSuperellipse·full per-corner Canvas/Path recording·ClipRRect/decoration 연결·retained layers는 다음 작업이다. Windows/Web/Android native/input/IME/reader/performance/scanout/recovery/signing/clean-machine 수락은 이번 값 연산 검증으로 바뀌지 않는다. Apple/Linux native 검증은 사용자 지정 SKIPPED/provider notVerified다. 이 묶음을 allowlist 정리하고 rendering 연결과 후속 W6 family를 계속하며 전체 goal은 active다.

**정리 완료.** allowlist .tmp/work6/rrect의 **531 files/42 directories/559240346 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했고 links/process references=0이다. raw source spans/oracle/fixtures/drafts/archives/consumer/diagnostics와 one-time helper를 정리하고 Flutter pin/Dart SDK·native supplier cache를 보존했다. 최종 **1065 reviews/1072 source hash references·82 core public exports**, 전체 goal은 active다.

### 2026-10-11 — full corner RRect paint/clip·Path.addRRect·wire5·Rect getter snapshot 묶음

**구현.** Canvas.drawRRect/clipRRect는 실제 RRect의 exact LTRB+TL/TR/BR/BL 타원 radius8개를 불변 finite float32 snapshot으로 기록한다. 기존 rect/radius 호출도 유지한다. Path.addRRect는 실제 SkPathBuilder.addRRect를 사용하며 원본 default contour start와 뒤의 relative verb를 유지한다. Path.addRect/addOval도 실제 Rect 끝점을 사용하고 plain DTO getter는 한 번씩 읽는다. CPU RRect hit는 double precision이며 raster narrowing과 분리된다.

ClipRRect는 physical/directional/mixed BorderRadiusGeometry를 inherited Directionality로 resolve하고 CustomClipper<RRect>·기존 RoundedClip DTO를 받는다. default rounded corner hit는 별도 gate하지 않고 custom clipper만 contains를 적용하는 pin 동작을 유지한다. textDirection 변경·동일 값 비교·4 clip/saveLayer 정책·paint-only reclip/listener 수명을 유지한다. 실제 inherited tree의 LTR→RTL에서 같은 render object/child layout1을 확인했다. private base에 Captured type을 추가했지만 public abstract stub는 만들지 않았다.

**transport/backend.** native ABI1을 유지하고 wire5에 draw/clip full rounded header24/25+continuation26, Path verb14+continuation26을 추가했다. count는 논리 Path operation 수이고 expanded budgets는 두 row를 센다. old wires1..4를 읽는다. native는 모든 geometry/sequence/flags/reserved/finite 값 검증 뒤 paint하며 잘못 짝지은/orphan row는 거부한다. RN은 기존 NonUniformRRect API와 owned setLTRB host rect를, CanvasKit는 12값 입력을 사용한다. native 객체가 tree로 들어가지 않으며 temp builder/path/host rect는 기존 cleanup 소유권에서 정리한다. JSI Web adapter의 actual RRect host 감지와 LTRB 보존도 고쳤고 actual CanvasKit에서 cancellation-sensitive right1/host reference 보존을 확인했다. 여섯 provider code/descriptor는 wireAbi5, native manifest는 wire5/supported1..5다. CanvasKit binary manifest 자체는 adapterAbi1/version0.41이며 C ABI wire report와 구분한다.

**portable/source.** 최종 **14 tests/121 assertions/1 file**, fixture/SDK/root compiler PASS, timeout20분이다. full/legacy snapshots·양 row budgets·malformed frame·double hit·direction/value setter·custom/legacy clipper·real inherited update·real FrameworkRoot saveLayer/repeated admission을 확인했다. exact pin CanvasPath::addRRect **1 unchanged LF-normalized C++ method**를 작은 RRect/ToSkRRect/resetVolatility shim으로 pinned Skia CPU reference에서 실행했다. Dart geometry의 이전8 unchanged classes 증거도 유지한다. Flutter engine/display-list/retained-layer 실행으로 주장하지 않는다.

**실제 raster.** 8 tiles(비대칭 fill·과대 stroke·intersect/difference clip·rounded Path+relative start·evenOdd hole·matrix4/saveLayer·legacy/full 혼합), 74 records를 실제 C ABI Graphite/native Vulkan/AMD780M·CanvasKit0.41 Chrome154.0.8037.98 WebGL2/AMD780M D3D11에서 실행했다. **34 interior/stroke-center samples는 CPU reference와 모두 채널 delta0**, default start 뒤 relative segment 표본도 blue로 일치했다. native **18 malformed packets**는 red clear prefix가 있어도 기존 pixels를 그대로 유지하며 거부했다. valid wire1..4 clear·wire4 addOval/relativeLineTo/close Path도 실행했다. C ABI BGRA를 RGBA로 정규화했고 close0/failed-create cleanup0이다. actual Web GPU fence에서 lease released=true·dispose 완료다.

전체 edge fidelity는 PARTIAL이다. Native/Web tile별 **52..270 pixels/max119**, Native/CPU **96..270/max178**, Web/CPU **0..118/max237** 차이를 보존했다. non-AA 요청에서도 edge coverage 차이가 있어 whole-image/hard-edge parity로 승격하지 않는다. reference/native/Web images를 확인했다.

**외부 실행에서 찾은 수정.** 첫 installed Web candidate가 negative size로 첫 frame에 실패했다. Rect의 x/y/width/height가 prototype getter인데 기존 frame.rect의 Object.entries/spread가 own LTRB만 복사해 두 번째 capture에서 필수 필드가 사라졌다. 네 DTO 값을 명시적으로 한 번씩 복사하도록 수정하고 실제 FrameworkRoot AAWithSaveLayer·각 primitive의 repeated frame regression을 추가했다. 검증을 완화하지 않았다. 실패한 Web receipt·candidate archives/Windows build를 보존했고 Windows candidate는 runtime 전에 superseded다. native source는 변하지 않아 supplier 재빌드는 하지 않았다. 기존 GPU fixture bytes도 수정 전후 동일함을 확인했다.

초기 fixture의 unscaled/inverted safeInnerRect 입력은 유효 LTRB(-1e16,0,1,10)로 고쳤다. Bun.build memory artifact는 명시 Bun.write로 저장했고 source/emitted ResourceRegistry 혼용은 public package import로 고쳐 재빌드/실행했다. 이 진단과 manifest verifier의 CanvasKit schema 가정 오류를 evidence에 보존한다.

**패키지·실제 앱.** 6 archives/isolated installed CLI로 Web/Windows 앱을 생성·공급했다. getter 수정 뒤 final core archive와 matching5 archives를 새 directory에 두고 supply→npm ci→compiler→fresh package build를 완료했다. 두 consumer 모두 **82 direct core ESM imports/85 declarations/282 relative .js imports/85 source files**, installed bytes·template parity·core tgz SHA512/lock·packed coverage snapshot PASS다. Web **366 files/26783526 bytes**, Windows **926 files/269380942 bytes**, qualification notVerified다.

sample/template은 directional corner ClipRRect+saveLayer·full Canvas.drawRRect outline·Path.addRRect badge를 기존 polygon/curve/Flow/full matrix/ellipse counter에 연결한다. Web 실제 ellipse 밖 pointer는0 유지·중앙은1 증가, same mark DOM x692→694/width48→45.703125와 same editor/text/backward[1,6]/focus x386→20→386 PASS다. public close 후 canvas/input/mark0·JS/app errors=[]이며 favicon404는 ambient로 별도 기록했다. browser/server는 닫혔다.

Windows RNW0.83.2/RN0.83.10/Hermes99/x64 Release/MD/Graphite-Vulkan/DPI192에서 own foreground HWND만 조작했다. ellipse 밖/중앙 Win32 pointer가0 유지/1 증가를 보였고 same mark UIA x949→953/width96→91, same editor UIA/text x610→151→610 세 번 이동 PASS다. text는 ValuePattern programmatic, physical keyboard/IME 증거가 아니다. 정상 close exit0·fatal/JS errors=[]/**closed views=0 consumers=0 gpuDrained=1/INSTANCE_DESTROYED/APP_STOP**다. 두 app screenshots도 확인했다. 이전 선택 UIA peer의 InvokePattern 미지원은 reader/action 수락에 남는다.

**표식 변화:** web 1035 pixels (max channel delta>10, initial mark crop), windows 3719 pixels (max channel delta>10, initial mark crop).

Windows EXE SHA **feed7c1a0d738e1bad00a9fce1310cab0c138ba6cd24f3e56d29d081c5463ff0**, Hermes bundle SHA **2aadfc91c9d423c466ad010b845bdb80bf7df784aee6ea4b72c7879c765d9023**, Web bundle SHA **09e9289b0c59541869805a500472a352ecb1edd0239de3e48714d427994b6541**다. core tgz integrity는 **sha512-Uv1MVj1pbwjlqeuGfbf688LsqV78MvLsdlW3mSht/HvSEYrMQfUZkrK/7Q9EFjyORqKurNOmg9h8tjTKz0588w==**, packed coverage SHA **a8801217440e65abdfcd2f65a10209f6fce990acb5b7e3c018f2f0ace44fc969**이며 final runtime receipt는 그 snapshot 후 repository에 추가했다.

**native/coverage.** C ABI8/8·RN binding16/16 native builds PASS, 새 immutable supplier **Nelyx/.cache/native/windows/w6-rounded-3e2a13223120d3ca/inputs.json**, SHA **3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47**, **18 libs/1795 files/221060123 bytes**다. actual compiled source146 hashes와 installed consumer WindowsAppHost/CompositionSession/RNSkWindowsHost headers를 각각 확인했다. core.cpp SHA **4fead7246810942d4440485ca12083fd102312b202d9935315cd454abbfbd343**이며 이전 supplier는 historical로 보존했다.

90 collateral reviews를 재검토했다. runtime/erased type/abstract signature token이 같은77개와 동작을 바꾼13개를 구분하고 shared helper 변경은 별도 regression으로 검증했다. 새 Path.addRRect/textDirection getter/setter **3 reviews**를 더해 **1068 reviews/1075 source hash references**, C#24/Dart138/82 core exports다. 74123 records/47282 public/778 files는 **missing72369/partial781/adapted966/implemented7**이며 classes/diagnostics/retained layers는 partial이다.

**범위.** selected full rounded raster/clip/value lifecycle와 자동화된 앱 normal close만 scoped PASS다. 전체 Path queries/arcs/metrics/boolean ops·RSuperellipse/ClipPath·retained layers·전체 Matrix4 및 후속 family는 계속한다. Windows/Web/Android physical input/IME/reader/performance/scanout/recovery/signing/clean-machine은 notVerified다. Apple/Linux native 검증은 사용자 지정 SKIPPED/provider notVerified이고 6 target code scope를 유지한다. 이 묶음을 allowlist 정리한 뒤 후속 W6 구현을 계속하며 전체 goal은 active다.

**재생성·정리 완료.** final regeneration에서 **1068 reviews/1075 declaring-export-source hash references와 runtime evidence** 보존을 Node deep equality로 확인했고 실제 Dart138 selection 분석도 PASS다. allowlist .tmp/work6/rounded-paint의 **48635 files/7918 directories/3631592819 bytes**를 preview 후 -Execute로 제거했다. resolved workspace/ancestor/link/absolute-relative process reference 경계를 확인했고 links/process references=0이다. candidate/final archives·isolated consumers·native builds·fixtures/oracle/drafts·실패/성공 logs/screenshots·one-time helper를 정리하고 Flutter pin/Dart SDK·현재 w6-rounded-3e2a13223120d3ca 및 historical immutable supplier를 보존했다. 최종 **1068 reviews/1075 source hash references·82 core exports**, 전체 goal은 active다.

### 2026-10-11 — OffsetBase·Offset·Size 전체 값 API와 getter geometry 연결 묶음

**구현.** ui/offset-base·ui/offset·ui/size 직접 모듈을 추가했다. immutable base component·부분 순서 비교·named factory/산술/보간·direction/distance·분류·9 relative position·half-open contains를 제공한다. Size.subtract(Size)는 Offset, Size.subtract(Offset)는 Size이며 다른 OffsetBase 파생 값은 거부한다. topLeft는 origin identity를 유지한다. Offset의 dx/dy와 x/y compatibility getter, Size의 width/height를 제공하고 기존 structural DTO 입력 계약도 유지한다. Rect의 size/position getters와 RRect.center는 실제 값 class를 반환한다.

**원본 의미.** equality는 Rect와 달리 identical/runtime-constructor shortcut이 없고 subclass를 허용한다. NaN component가 있으면 자기 비교도 false다. isInfinite는 positive infinity만 판단하고 zero-height aspectRatio의 NaN width→0도 pin을 유지한다. signed zero·nonfinite·Euclidean modulo·VM int64→double truncation adaptation을 보존한다. local hash는 equal→equal hash와 signed-zero normalization을 만족하며 Dart Object.hash 정수 identity를 약속하지 않는다. private Dart component는 public 노출 없이 protected immutable storage에 매핑하고 subclass 자체 field는 수정할 수 있다.

**제품 연결 수정.** Size/Offset의 prototype getter를 object spread로 복사하면 값이 빠지는 경로를 조사했다. validSize·RenderBox offset·BoxParentData offset·RenderTransform origin/alignment·CustomClipper approximate bounds를 명시적 getter capture로 바꿨다. size와 point boundary는 getter를 한 번씩 읽고 불변 DTO로 저장한다. 실제 render wet/dry layout·parent data·transform·clip·Canvas와 repeated frame admission을 확인했다. sample Progress/EditorSlots delegate가 실제 Size/Offset을 사용하며 template bytes가 일치한다.

**원본·portable.** exact Flutter pin의 OffsetBase/Offset/Size/Rect **4 unchanged Dart classes + 1 unchanged interpolation helper**를 raw UTF16 span SHA와 실제 oracle file의 exact fragment bytes로 확인한 뒤 Dart3.14.0-296.0.dev/assertions enabled에서 실행했다. geometry shim 없이 dart:math/typed_data/convert만 사용했다. 16 finite/signed-zero/nonfinite 입력·scalar6·base comparison256pairs·lerp224groups·factory6을 비교했다. **13 tests/526 assertions/1 file**, SDK build·root/fixture/tool compiler PASS, timeout20분이다. trig에만 relative1e-14 tolerance를 사용하고 나머지 비교는 explicit -0.0/NaN/Infinity encoding을 포함한 exact IEEE754 값이다. Flutter engine/renderer 실행은 아니다.

**검증 fixture 보정.** 최초 Bun hidden path filter는 ./ prefix로 고쳤고 strict fixture의 protected childTransform 접근은 fixture-only subclass probe로 바꿨다. Python Windows newline translation으로 scratch previous-source hash가 달라진 문제는 byte write로 고치고 old reviewed source hashes와 oracle fragments를 다시 검증했다. compiler review helper가 implicit constructor와 같은 줄 getter/setter를 실제 TS syntax node로 구별하도록 고쳤다. 실패 logs의 bytes/SHA를 coverage evidence에 보존했다. 제품 의미를 통과시키기 위한 허용오차 완화는 없다.

**coverage/이식.** 새 **73 reviews/3 Dart selections**, 기존1068을 보존해 **1141 reviews/1150 declaring+export source hash references**, C#24/Dart141이다. 바뀐 source에 연결된327rows는 old file SHA 확인 후 **310 unchanged member-token rows/17 explicitly changed rows**로 검토했다. runtime/erased signature/implicit constructor의 증거를 구분하고 기존 partial class 제한을 유지했다. 실제 Dart selection 분석과 Node JSON deep-equality regeneration은 reviewed fields와 이전 runtime evidence를 보존했다. 현행74123 records/47282public/778sourcefiles/15entrypoints/diagnostics0, **missing72300/partial777/adapted1039/implemented7**이다. 새로운 value API는 DTO interface의 이름 일치를 채택 증거로 사용하지 않는다.

**외부 소비.** SDK build 후 core archive를 별도 consumer에 설치했다. **85 direct ESM imports/88 declarations/290 relative .js declaration imports/88 source files**, installed source bytes·core tgz SHA512·lock integrity·packed coverage snapshot 일치 PASS다. Node24.15.0에서 동일 fixture를 실제 emitted JS로 실행해 **13 tests/526 assertions PASS**, readonly/protected component·typed subtraction overload·Rect result→value/structural type contract도 PASS다. core integrity는 sha512-Ia0vSEWCXjzlyH3nr5RY6I5GgizjZZaUlZxXECBY5gHKoRt5VagXHrHeBIT04gtdC/zVlQwBDuEDlsD9ojjgdg==, tgz SHA84bf3565c217ebde03f1e23c447dc4ee4528c32986d3d375d26738fd23b0f02c, packed coverage SHA0095c71235997828a6227ae63710e303a2dad240058a403608f4331cbfa14b35다. archive는 external receipt 추가 전 coverage snapshot이며 repository 후속 evidence와 구분한다.

**native/범위.** ABI1/wire5/supported1..5와 현재 supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47을 유지한다. current compiled source146 hashes와 별도 consumer header3 hashes를 확인했다. 이번 묶음에 새 native compile/GPU/UI 실행을 수행한 것으로 집계하지 않는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine은 notVerified, Apple/Linux 플랫폼 검증은 사용자 지정 SKIPPED/provider notVerified다. 전체 mutable Matrix4·Path queries/RSuperellipse/ClipPath·retained layers와 후속 W6 family는 남아 있으며 전체 goal은 active다.

**정리 완료.** allowlist .tmp/work6/offset-size의 **531 files/47 directories/352109231 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했으며 links/process references=0이다. 첫 preview가 같은 command wrapper의 아직 살아 있는 source-reference를 감지해 거부한 뒤 wrapper 종료 후 독립 preview/execute를 수행했다. oracle/fixtures/drafts/archives/isolated consumer/logs를 정리하고 Flutter pin/Dart SDK·현재/historical native supplier cache를 보존했다. external receipt를 포함한 최종 regeneration은 **1141 reviews/1150 source hash references**와 모든 기존 runtime evidence의 Node deep equality를 확인했다. core public exports85/source+declarations88이며 전체 goal은 active다.
one-time helper는 shell 삭제의 자동 승인 거부 뒤 명시적 파일 patch로 제거했으며 helper/scratch 부재와 모든 현행 reviewed source1150 references의 SHA 일치를 확인했다.

### 2026-10-11 — vector_math64 Vector·Matrix·Quaternion 전체 CPU API 묶음

**구현.** `math/vector`·`math/vector2`·`math/vector3`·`math/vector4`·`math/matrix2`·`math/matrix3`·`math/matrix4`·`math/quaternion` 직접 모듈을 추가했다. vector_math2.4.3의 swizzle·정규화·역행렬·분해·회전·산술을 mutable column-major Float64Array로 구현했다. Vector는 실제 abstract base이며 V2/3/4가 상속한다. 연산자는 equals/unaryMinus/plus/minus/times/divided/at/setAt으로 대응하고 matrix times는 scalar/matrix/vector별 반환형을 제공한다. 기존 `ui/matrix4`의 작은 immutable frame/hit helper는 byte-exact로 유지한다. sample/template의 projective counter·Flow가 새 Matrix4.storage를 사용하며 framework/Canvas는 independent snapshot을 캡처한다.

**storage·수치 의미.** real `#values`와 내부 WeakMap friend access가 원본 library-private cross-object 읽기를 보존한다. public storage override가 private 값을 바꾸지 않으며, 원본의 명시 public storage 읽기는 virtual dispatch를 유지한다. subclass 자체 values field와 borrowed `super(view)`를 허용한다. fromFloat64List/fromBuffer의 raw view identity·짧거나 긴 view 길이를 유지하고 조건부 checked indexing으로 범위 실패 전에 진행된 부분 쓰기를 보존한다. readonly array 입력과 mutable output을 구별한다. num.compareTo clamp의 signed-zero/NaN-high 순서·round ties away from zero·nonfinite CPU 값을 보존하며 raster finite float32 admission과 구분한다.

**명시 adaptation.** local hash는 equality 성분만 사용하고 signed zero를 정규화한다. 원본의 긴 borrowed view는 첫 N성분 equality가 true인데 전체 storage hash는 달라지는 사례가 다섯 class에서 확인되어 이 불일치를 의도적으로 수정했다. Dart VM hash 정수 identity는 약속하지 않는다. random factory는 nextDouble 공급자를 받고 기본 Math.random은 Dart seed sequence를 재현하지 않는다. Dart type/error/연산자/생성자 문법은 TS host 계약으로 대응한다. private dependency를 public API로 승격하지 않는다.

**원본·이식 도구.** exact vector_math2.4.3 archive SHA92b9910f66ed1057fd4da7b040ae7c74cafacf885bdc81be496928d5049b032d와 notice를 기록했다. restricted resolved AST numeric_draft는 일곱 class의 **2249 members/unsupported0**을 fresh scratch에만 출력하며 생성자/storage/visibility adapter와 의미 검토 뒤 수동 채택했다. 실제 원본 package를 Dart3.14.0-296.0.dev에서 실행했고 **2269 member descriptors/raw UTF16 spans**를 검증했다. **2262 member cases/21907 numeric leaves**, **669 edge·alias cases/6075 leaves**, **250 view cases**, **450 index/range cases**, **16 derived-storage groups**가 통과했다. VM-dependent hash 정수 비교7개는 제외하고 host hash law를 따로 확인했다. method/factory relative1e-12, getter/setter 및 encoded signed-zero/nonfinite는 exact 비교이며 Flutter engine shim 실행이 아니다.

**coverage 개선·채택.** implicit assignment identifier의 analyzer element가 null인 경로를 발견해 assignment read/write·binary/prefix/postfix·index resolved element를 추적했다. fresh inventory **74143 records(+20)/47282 public/778 files/15 entrypoints/diagnostics0**, frontend SHA **0308f50a5b44933825827a3fdf80e63955150be84ba05d4ac150aa95ec964851**다. 이전 frontend cache의 거부와 product ledger 불변을 확인한 뒤 fresh model을 채택했다. private numeric backing7/cache3/ctor1은 실제 compiler의 private destination에만 연결한다. 새 **2290 reviews**, 기존1141을 보존해 **3431 reviews/3440 declaring+export source hash references**, C#24/Dart149다. 실제 Dart149 분석·Node JSON deep-equality regeneration이 reviewed fields와 이전 runtime evidence를 보존했다. 현재 **missing70029/partial778/adapted3329/implemented7**이며 이름 일치를 행동 완료로 바꾸지 않았다.

**패키지·실행.** current core/SDK build·root/tool/sample compiler는 timeout20분으로 PASS다. isolated installed core는 **93 direct ESM imports/97 declarations/324 relative .js declaration imports/97 source files**, installed source bytes·tgz/lock integrity·packed coverage snapshot이 일치했다. Node24.15.0의 실제 installed emitted JS에서 같은 3631 cases·16 derived groups·58 host checks와 readonly/storage/typed multiplication 계약이 통과했다. Metro0.83.8/RN Babel0.83.10이 이 installed package를 묶고, Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c에서 source와 optimized bytecode99를 모두 실행해 동일 결과를 확인했다. executable SHA74b975947a885939296540664f1f6c0067d1ff4b409f105377ac256a3d3f33cc, bundle SHAee790f7906304a45a33d64e1b5f0ef3db023c0dca0e89cb0c3a0a621b26e45d2, bytecode SHA8b998569f4b81400b14bcb0e25e5c978eb72106d9bc64a73423d2ab6148723fc다. 이는 standalone CPU Hermes 실행이며 RNW 앱/GPU/Android runtime 수락이 아니다.

**검증 중 보정.** AST emitter의 cascade·operator·private cross-object access·typed overload와 source의 array/row 범위 부분 쓰기를 수동 보완했다. fixture의 Object.prototype static lookup·파생 Quaternion의 factory super 사용·signed-zero expected 값을 실제 원본 결과에 맞게 고쳤다. external 준비의 누락된 emitted fixture와 shell quote 오류는 준비 스크립트로 수정했고 Metro 직접 API 호출에 consumer watch root를 명시했다. npm hermesc는 실행을 지원하지 않아 pin한 Windows Hermes executable로 실제 실행했다. 실패 logs의 bytes/SHA는 evidence에 남겼으며 제품 의미를 통과시키려고 검증을 완화하지 않았다.

**native·남은 범위.** ABI1/wire5/supported1..5와 supplier `w6-rounded-3e2a13223120d3ca`/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47을 유지하며 actual compiled source146/consumer header3 hashes가 현재와 일치한다. 이번 묶음에 새 native compile/GPU/UI 실행은 없다. Path queries/arcs/metrics/boolean ops·RSuperellipse/ClipPath·retained layers와 후속 W6 family가 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine은 notVerified, Apple/Linux native 확인은 사용자 지정 SKIPPED/provider notVerified다. 전체 goal은 active다.

**최종 package snapshot.** core tgz SHA **36bfb239b3bde1a1ed44f207939cc5a3c33b0ed3ba16ac2621379f9bd30e769b**, integrity **sha512-ihsYWKeQiRj9VtwRsdSkgaM/KPTxhqjDT2JAGJS8MmpIsK89GVTCQTse4psQvTTQiU21k8v9G40UXFnPVl2U4A==**, packed coverage SHA **939733c784213a9536dd791a0fa7e614d86a900a9bab81345cd27bcdc03ca89d**다. 최종 archive는 현행 README와 후속 receipt 추가 전 coverage snapshot이며, candidate의 full oracle와 최종 archive의 source97/emitted JS·declarations 전체 bytes가 같다. 최종 isolated install의 imports93·type contract·host58 확인과 마지막 SDK 전체 build도 PASS다.

**재생성·정리 완료.** 최종 external receipt를 포함한 regeneration이 3431 reviews/3440 source hash references와 모든 이전 runtime evidence를 보존했다. allowlist .tmp/work6/vector-math의 **1339 files/102 directories/964983361 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했으며 links/process references=0이다. 초기 directory Length 기반 listing guard가 불안정해 삭제를 거부했고 directory marker를 명시한 새 preview/execute가 일치한 뒤 정리했다. oracle/fixtures/drafts/archives/isolated consumers/Metro·Hermes bundles/logs와 one-time helper를 정리하고 Flutter pin/Dart SDK·current/historical native supplier cache를 보존했다. 현행 reviewed source3440 hash 참조도 일치하며 전체 goal은 active다.

### 2026-10-11 — AlignmentGeometry·AlignmentDirectional·RTL Align/Stack/Transform와 Metro 상수 수정 묶음

**구현.** framework/painting/alignment 직접 모듈에 AlignmentGeometry·Alignment·AlignmentDirectional과 module-private MixedAlignment를 구현했다. physical/logical/mixed 산술·named operator/factory·상수 identity·LTR/RTL resolve·Offset/Size/Rect query·보간·string·hash를 제공한다. equality는 종류를 구분하지 않고 세 성분을 비교하며 NaN 자기 비교는 false다. typed lerp는 ui.lerpDouble의 equal/both-NaN shortcut을, geometry null endpoint는 직접 scaling을 유지한다. 서로 다른 nonfinite 보간은 원본 debug 계약을 all-build 적용한다. local hash·int64-to-double truncation은 명시 host adaptation이다.

**실제 연결.** Align·Stack은 full geometry 및 기존 numeric/structural 값을 받고 inherited Directionality를 해석한다. W5 ltr fallback과 numeric render interfaces를 유지한다. Stack은 plain getter를 immutable alignment로 캡처한다. Transform/RenderTransform은 geometry·inherited/explicit textDirection과 원본 origin/alignment 번역 순서를 사용한다. widget의 origin/alignment getter는 spread 없이 한 번씩 읽고 matrix도 복사한다. Transform update는 layout 요청을 추가하지 않고 통합 paint/semantics를 갱신한다. 같은 FrameworkRoot/child에서 RTL의 child layout1·render identity·실제 frame admission·host pointer 좌표·local/global·semantics bounds를 확인했다. sample/template counter는 AlignmentDirectional.topStart를 사용하며 template bytes가 같다.

**원본·portable.** exact Flutter pin의 AlignmentGeometry/Alignment/AlignmentDirectional/_MixedAlignment **4 unchanged classes**, RenderTransform._effectiveTransform **1 unchanged getter**, ui.lerpDouble **1 unchanged helper**를 raw UTF16 source span SHA로 검증해 Dart assertions-enabled에서 실행했다. Offset/Size/Rect는 명시 shim이며 matrix는 실제 vector_math2.4.3다. **413 groups/7942 numeric leaves**, 그 안의 **324 effective-transform cases**가 통과했다. matrix만 relative1e-12, 나머지 값과 signed-zero/nonfinite encoding은 exact 비교다. 최종 **11 integration tests/100 expectations**, tool identity **1 test/5 expectations**, fixture·tool·root compiler·SDK 전체 build PASS이며 timeout20분이다. Flutter engine/native 실행은 아니다.

**Metro에서 발견한 제품 수정.** 첫 후보 package는 Node에서 통과했지만 RN Babel의 loose static-field 변환이 inherited getter에 값을 대입해 Alignment.center getter를 재귀 호출했다. BorderRadius.zero/Directional.zero에도 같은 패턴이 있어 모두 module-private 값과 own static getter로 고쳤다. original candidate source/HBC 실패와 archive를 따로 보존했고 검증을 약화하지 않았다. 추가로 실제 Dart에서 public-final field의 derived getter override가 가능한 것을 확인했다. Alignment 좌표를 private slot 기반 readonly getter로 바꿔 query·lerp·equality/hash의 virtual dispatch를 보존했다. 원본 driver 결과 [7,8,40,90,7,8,-7,8,4,5,true,true]와 host가 일치한다. 다른 geometry class는 기존 partial을 유지하며 이 경계를 다음에 재검토한다.

**coverage·도구.** private local class를 실제 compiler symbol·fully qualified private upstream identity·public module anchor로 연결했다. export:AlignmentGeometry/local:MixedAlignment는 공개 class export가 아니며 rename/hash 변화가 review를 무효화한다. 새 **115 reviews/4 Dart selections**, 이전3431을 보존해 **3546 reviews/3555 declaring+export source hash references**, C#24/Dart153이다. 초기 source 변경의240 rows는 **232 same-token/8 changed-token**, 그 중28 behavior rows를 재검토했다. runtime 수정의171 rows(147 same/24 changed)와 후속104 rows(78 same/26 changed)는 중복 재검토이며 새 review로 더하지 않았다. 현행74143 records/47282 public/778 files/15 entrypoints/diagnostics0, **missing69916/partial778/adapted3442/implemented7**다. frontend SHA0308f50a5b44933825827a3fdf80e63955150be84ba05d4ac150aa95ec964851을 유지한다. 실제 Dart153 분석과 최종 Node deep-equality regeneration이 모든 reviewed fields·기존 runtime evidence를 보존했다.

**외부 소비·Hermes.** 수정 뒤 fresh core archive/isolated install에서 **94 direct ESM imports/98 declarations/328 relative .js imports/98 source files**, current source/dist 전체 bytes·lock integrity·packed coverage snapshot이 일치했다. Node24.15.0에서 같은413 groups·11 tests/100 expectations와 public type contract가 통과했다. private Mixed class가 export되지 않는 것도 확인했다. 처음 external fixture의 internal phase import는 package export 경계에서 거부되어 public CustomPaint/FrameworkRoot paint guard를 사용하도록 고쳤다. Metro0.83.8/RN Babel0.83.10의 실제 installed bundle을 Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c에서 source와 optimized bytecode99로 실행해 동일 결과를 확인했다. 이는 JS host pipeline fixture이며 RNW 앱/GPU/physical pointer/native reader 실행이 아니다.

core tgz SHA **dfdade24db8a1e44fe546f4c41a1850f872a8aa4fa9ab7548b08fdf072679438**, integrity **sha512-0Tk89NyOEdVjwJuoF1eIB0w/IAj1LpPF6/yXpF6CyDmMccT52Hj7/Y7cZPqrbZV9kMgKKZd5kGEJ9nVgtN0aHg==**, packed coverage SHA **a8f91b6ba62344bac4e3f668386ac708707d9e77274caf5acbf9ae311086ca82**다. archive는 후속 external/runtime receipt 추가 전 snapshot이다. 최종 Metro bundle SHA **170f59c875b87ce78cf2098d950a3f64ade2a57474e22cbb4d6bbb2dcb5540db**, HBC SHA **61286c649b73a3e8230d19a8c8cadcadbb82f2265fcde0c53be45adc469dff2f**, executable SHA **74b975947a885939296540664f1f6c0067d1ff4b409f105377ac256a3d3f33cc**다.

**native·경계.** ABI1/wire5/supported1..5와 supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47를 유지하며 compiled source146·consumer header3 hashes가 현재와 일치한다. 새 native compile/GPU/UI 실행은 없다. public-final geometry getter audit·general render alignment interfaces·Transform factories/filterQuality·Path queries/RSuperellipse/ClipPath·retained layers 및 후속 W6 family가 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine은 notVerified, Apple/Linux native 확인은 사용자 지정 SKIPPED/provider notVerified다. 전체 goal은 active다.

**현재 source SHA256.**

| file | SHA256 |
| --- | --- |
| Nelyx/src/framework/painting/alignment.ts | a4a326c3ea37950ef4bcf453f410d18f67a5bc09156d468719a8553697fb257a |
| Nelyx/src/framework/painting/border-radius.ts | d67cb81d6a63415ad59d717e04db57f79a9381ef307e5e2ba5efa3bc0e9dfc53 |
| Nelyx/src/framework/rendering/boxes.ts | 5959c6b74f7b4f117b2bca7edb8ec5f2e1d6abf8a785165554e8474d016d68c4 |
| Nelyx/src/framework/widgets/basic.ts | 496725ce9d7584e4b0bb6c2868325a3596c6c5dec4da3ff2de350ff680cd78c5 |
| tools/Nelyx.FrameworkToTypeScript/src/coverage.ts | 9f845c7f8270f3e7dd64acf8b75d67baf203afc827628b41a8e7bb3d59993dec |
| tools/Nelyx.FrameworkToTypeScript/src/coverage-format.ts | fb81d919e065b455b91c75288d37031c1b4f0243278a1f0d6014fdb340bba12a |

**정리 완료.** allowlist .tmp/work6/alignment의 **1177 files/85 directories/939048822 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했으며 links/process references=0이다. 첫 execute는 listing 변화 때문에 삭제 없이 거부했고 새 preview/execute가 일치한 뒤 정리했다. source oracle/fixtures/drafts·실패 후보/최종 archives·isolated consumers·Metro/Hermes bundles·성공/실패 logs와 one-time helper를 정리하고 Flutter pin/Dart SDK·current/historical native supplier cache를 보존했다. 최종 3546 reviews/3555 source hash references는 현재 source SHA와 일치한다. geometry getter override audit부터 후속 W6를 계속하며 전체 goal은 active다.

### 2026-10-11 — geometry getter dispatch·혼합 BorderRadius 내부 의존성·실제 Rect 캡처

**구현.** Radius·LTRB Rect·RRect·physical/directional BorderRadius의 public final 값을 실제 private immutable slot과 readonly getter로 바꿨다. 파생 getter가 query·연산·equality/hash·Canvas/Path 캡처에 반영되며 subclass 자체 상태는 수정할 수 있다. equality는 원본의 identity/runtime-type 정책, other-before-receiver 성분 읽기와 조기 종료를 보존한다. RRect는 원본의 BL-before-BR 비교 순서를 사용한다. BorderRadius mixed add/subtract도 getter를 원본 순서대로 한 성분씩 읽는다. protected 성분 adapter와 module-private MixedBorderRadius를 사용하며 RN Babel에 맞춘 own static zero getter는 유지한다.

**보간·좌표 캡처.** RRect의 원본 `_lerpTo` concrete receiver debug assertion을 all-build 적용한다. derived left receiver와 null-left/derived-right receiver는 실패하고 concrete left receiver의 derived right endpoint는 허용한다. semantics bounds와 scroll reveal의 object spread가 실제 Rect의 prototype getter 좌표를 잃던 회귀를 고쳤다. semantics·scroll·text는 x/y/width/height를 각각 한 번 읽고 같은 값으로 검증·저장한다. CustomPaint/FrameworkRoot의 반복 frame·ancestor scroll 전달·caret/selection snapshot·Canvas/Path의 파생 rounded 값 캡처를 연결했다. plain structural DTO 입력은 유지한다.

**원본·검증.** exact Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a의 **11 unchanged Dart classes/2 unchanged helpers/13 raw UTF16 spans**를 실제 Dart3.14.0-296.0.dev/assertions enabled에서 실행했다. 사용하지 않는 RSuperellipse만 throwing type-only shim이며 이 기능은 검증하지 않았다. **76 source groups**는 signed-zero/NaN/Infinity encoding을 포함한 exact IEEE754 값으로 비교했고 getter trace와 RRect receiver assertion도 비교했다. **7 integration tests/42 expectations**, fixture/tool/root compiler·전체 SDK build PASS, timeout20분이다. fixture의 semantics dom capability는 데이터 sink이며 실제 DOM/native reader 실행 증거가 아니다.

**이식·coverage.** `_MixedBorderRadius`를 public BorderRadiusGeometry anchor 아래 실제 unexported compiler local identity로 추적한다. private/protected 의존성을 public API로 승격하지 않는다. 새 **40 reviews**(protected component24/local mixed16), 기존3546 중 **179 collateral rows**를 검토해 **139 unchanged member-token/40 changed member-token rows**를 채택했다. 바뀐 source hash의 재채택에서도 이전에 선정한 destination subset만 유지해 structural Rect DTO 등의 이름 일치를 새 행동 증거로 포함하지 않았다. 최종 **3586 reviews/3595 declaring+export source hash references**, C#24/Dart154, 실제 Dart154 selection 분석 PASS다. fresh regeneration의 Node deep equality는 모든 reviewed rows·selected destination subsets·기존 runtime evidence를 보존했다. 현재 **74143 records/47282 public/778 files/15 entrypoints/diagnostics0**, **missing69876/partial778/adapted3482/implemented7**이며 기존 geometry class의 partial 제한은 유지한다.

**외부 소비.** 새 core archive의 실제 설치본에서 **94 direct ESM imports/98 source files/98 declarations/328 relative .js declaration imports**, installed source/dist bytes·tgz/lock integrity·packed coverage snapshot 일치 PASS다. Node24.15.0의 installed emitted JS에서 동일76 source groups·7 tests/42 expectations와 readonly/getter subclass·private-export type contract가 통과했다. tgz SHA **e098394d61ff4b0670349601daeaef0da767b06af93d9d571376f2357f3262b8**, integrity sha512-EdgWVmpMqD8RxCSIQhlej4Jg0nadtcJYBG3r2S4EwAKXWzW8e1xdQwblcbZe5wPvAyLpbA37zIpl12scd6ukbQ==, packed coverage SHA **26fdfe1f497d8b74269bdedda6bdb13c26a01c2e556bdaec33593b4322176dca**다. archive는 external runtime receipt 추가 전 coverage snapshot이다.

**Metro/Hermes.** Metro0.83.8/RN Babel0.83.10이 installed emitted core를 Windows platform bundle로 변환했고 Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c에서 source와 최적화 HBC99 모두 같은76 groups·7 tests/42 expectations PASS다. bundle SHA **e323d2d3d60ba027d47b19492e2d8aefcb91a9dfa7716b49bb308a8e7f065984**, HBC SHA **9e70dedb196d986855ef1b0918c97d40eccca9e1c946560c361092246c28be3d**, engine exe SHA74b975947a885939296540664f1f6c0067d1ff4b409f105377ac256a3d3f33cc다. ESM consumer의 Babel CommonJS config 확장자를 .cjs로 고친 실패/성공 logs를 포함해 source oracle·adoption·compiler·runtime logs의 bytes/SHA를 evidence `w6-geometry-getters-20261011`에 보존했다. RNW 앱/GPU/OS 입력 실행 증거로 집계하지 않는다.

**native·남은 범위.** ABI1/wire5/supported1..5와 supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47를 유지한다. compiled source146·별도 consumer header3 SHA가 현재 source와 일치하며 새 native compile/GPU/UI 실행은 없다. general render alignment interfaces·Transform factories/filterQuality·Path queries/RSuperellipse/ClipPath·retained layers와 후속 W6 family는 계속 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine은 notVerified, Apple/Linux native 확인은 사용자 지정 SKIPPED/provider notVerified다. 전체 goal은 active다.

**정리 완료.** allowlist .tmp/work6/geometry-getters의 **604 files/43 directories/428072061 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했으며 links/process references=0이다. 첫 execute는 listing 변화로 삭제 없이 거부했고 새 preview/execute가 일치한 뒤 정리했다. oracle/fixtures·분석/coverage drafts·archives/isolated consumer·Metro/Hermes bundles·성공/실패 logs와 one-time helper를 정리하고 Flutter pin/Dart SDK·current/historical native supplier cache를 보존했다. 최종3586 reviews/3595 source hash references가 현재 source와 일치한다. cleanup receipt와 실행 fingerprint는 coverage evidence에 남기며 전체 goal은 active다.

### 2026-10-11 — Transform rotate·translate·scale·flip factory와 childless 연결

**구현.** 기존 직접 module `framework/widgets/basic`의 Transform에 rotate/translate/scale/flip static factory와 실제 private `_computeRotation`/`_createZRotation` helper를 추가했다. child-first API 뒤에 angle/offset 또는 options를 받으며 undefined child를 허용한다. key·origin·alignment·transformHitTests를 전달하고 rotate는 원본의 sin/cos exact-angle 보정과 signed-zero matrix lane을 보존한다. rotate/scale의 기본 alignment와 flip의 고정 alignment는 center, translate의 origin/alignment는 null이다. scale은 uniform scale 또는 한쪽/양쪽 axis scale을 요구하며 생략 축은 1이다. scale debug assertions·finite rotation 계약과 bool flip 검사는 all-build 적용한다. 기존 불변 finite matrix capture 때문에 nonfinite translation/scale은 원본의 render admission보다 일찍 거부한다. bitmap filterQuality는 계속 미구현/거부이며 Transform class·factory constructor rows는 partial이다.

**원본·host 검증.** exact Flutter pin의 **1 unchanged Transform class**를 raw UTF16 span/SHA c0eb08a85e443c66100c7d735b140a6195637ba281e7f414e074609bc7779726으로 확인하고 실제 Dart3.14.0-296.0.dev/assertions enabled에서 실행했다. Widget/geometry/context/render receiver는 type-only shim이며 행렬은 실제 vector_math2.4.3을 사용했다. 해당 cached Matrix4 class span도 resolved inventory SHA와 일치한다. Flutter framework/engine 실행으로 집계하지 않는다. **152 source groups**는 trig를 포함해 signed-zero encoding과 exact IEEE754 비교 PASS다. 별도의 actual FrameworkRoot **9 tests/48 expectations**는 네 factory의 layout·paint·pointer·semantics, hit-test opt-out, RTL directional alignment, render identity를 보존하는 paint-only update, singular/childless 동작과 origin/offset 캡처를 검증했다. semantics dom capability는 host data sink이며 실제 DOM/native reader가 아니다. source/fixture/root compiler·전체 SDK build PASS, timeout20분이다.

**coverage.** 기존3586 rows 중 source hash가 바뀐 **80 collateral rows**를 **78 unchanged member-token/2 changed member-token rows**로 검토했다. 이전 selected destination subset과 구현 제한을 보존했고 새 **6 reviews**(partial constructors4/adapted private helpers2)를 채택했다. 최종 **3592 reviews/3601 declaring+export source hash references**, **74143 records/47282 public/778 files/15 entrypoints/diagnostics0**, **missing69870/partial782/adapted3484/implemented7**이다. C#24/Dart154 selections·Dart source pin은 변하지 않았으며 selection 분석은 직전 geometry 묶음의 PASS를 재사용한다. fresh regeneration의 Node deep equality는 전체 reviewed rows·기존 runtime evidence·selected destination subsets를 보존했다. stage evidence는 `w6-transform-factories-20261011`이다.

**외부 소비.** installed emitted core의 Node24.15.0 실행에서 같은152 source groups·9 tests/48 expectations가 통과했다. **94 direct ESM imports/98 source files/98 declarations/328 relative .js declaration imports**, source/dist bytes·현재 README bytes·tgz/lock integrity와 packed coverage snapshot이 일치했다. factory option/childless 계약 및 flip alignment·translate origin·filterQuality·비수치 angle의 타입 거부도 PASS다. 문서 반영 후 최종 archive를 다시 설치했고 실행에 사용한 source/dist와 byte-exact임을 확인해 중복 runtime을 재실행하지 않았다. 최종 tgz SHA **bd08f988ce206194ca6e049b3597e9b3edae86607d6362df6343eac32551a54a**, integrity sha512-vX1S2bXxxoGWSgWtnXBOzLxUwvOWUZym1JRGBUEoSrjBf5LhPGbkoSgviq6q25BP1aSjxv5dqqvk4dE5Gz/IFA==, packed coverage SHA **823dc175a0ad8eab73794d457ae32052d995379d77fc8f17652ff933aed68691**이다. archive는 external runtime receipt 추가 전 coverage snapshot이다.

**Metro/Hermes.** Metro0.83.8/RN Babel0.83.10의 actual Windows bundle을 Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c에서 source와 optimized HBC99로 실행해 동일152 groups·9 tests/48 expectations PASS다. bundle SHA **a16ea965c2abf990af8becee18358cf7d02736bcef3edb1d7a14fb8d138a8b4d**, HBC SHA **833e7655f39ebc80c7c0ed58e4f224201e140691a343289d5e7afcd6f0e9d430**, engine exe SHA74b975947a885939296540664f1f6c0067d1ff4b409f105377ac256a3d3f33cc다. 최초 assertion shim이 render identity 성공 비교에서도 failure message의 JSON을 먼저 직렬화해 순환 참조 오류를 냈다. 이를 실패 때만 평가하도록 고쳤으며 제품 코드를 바꾸거나 기대값을 완화하지 않았다. 원본 span의 문서 주석을 인정하도록 고친 prepare 실패와 runtime 실패/성공 logs의 bytes/SHA를 보존했다.

**native·다음 경계.** ABI1/wire5/supported1..5, supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47, compiled source146·별도 consumer header3 hashes가 현재와 일치한다. 새 native compile/GPU/UI 실행은 없다. general render alignment interfaces·Transform filterQuality·Path queries/RSuperellipse/ClipPath·retained layers와 후속 W6 family는 계속 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine notVerified, Apple/Linux native 사용자 지정 SKIPPED/provider notVerified를 유지한다. 현재 basic.ts SHA **8bc3477f915ef8bb981f1180282e558a41ab53f7cbcef62c9e32efcc5750fc2c**이며 전체 goal은 active다.

**정리 완료.** allowlist .tmp/work6/transform-factories의 **579 files/42 directories/359907659 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했으며 links/process references=0이다. 첫 execute는 listing 변화로 삭제 없이 거부했고 새 preview/execute가 일치한 뒤 정리했다. 원본 oracle/fixtures·coverage drafts·이전/최종 archives·isolated consumer·Metro/Hermes bundles·성공/실패 logs와 one-time helper를 정리하고 Flutter pin/Dart SDK·current/historical native supplier cache를 보존했다. cleanup receipt와 fingerprint를 coverage evidence에 남겼으며 최종3592 reviews/3601 source hash references가 현재 source와 일치한다. 전체 goal은 active다.

### 2026-10-11 — RenderShiftedBox·RenderAligningShiftedBox와 PositionedBox/Stack의 geometry 보존

**구현.** 새 직접 모듈 `framework/rendering/shifted-box`에 abstract RenderShiftedBox·RenderAligningShiftedBox를 추가했다. single-child 소유권·intrinsic/baseline forwarding·offset paint/hit의 virtual dispatch·protected resolvedAlignment/alignChild를 제공한다. geometry와 textDirection을 보존하고 필요할 때 해석해 캐시하며 동등 alignment 재설정은 layout을 무효화하지 않는다. geometry/방향이 바뀌면 해석·layout·측정 cache를 무효화한다. RenderPositionedBox는 이 base를 상속하며 원본 alongOffset의 half-delta 산술을 wet/dry 정렬과 baseline에 사용한다. wet baseline에는 child offset을 한 번만 더한다. 기존 numeric/shrink 생성자와 새 geometry/direction/child/factor options를 모두 제공한다.

**Stack/widget 연결.** RenderStack도 geometry/direction과 해석 cache를 보유하고 non/partially positioned child에 원본 정렬 산술을 적용한다. 직접 RenderStack의 default는 원본 AlignmentDirectional.topStart/null direction으로 바뀌어 empty stack을 포함한 wet layout에 방향이 필요하다. 이전 alignmentX/Y·PositionedBox x/y는 명시적인 physical alignment adapter이며 getter의 ltr fallback을 유지한다. Align·Stack widget은 geometry를 render 객체에 전달하고 inherited direction을 설정하며 기존 ltr fallback을 유지한다. child/factor의 Dart null은 host undefined로 대응하고 finite factor/offset admission과 alignChild all-build assert 정책을 문서화했다. abstract class와 기존 render family는 diagnostics/mixin·플랫폼까지 완성한 상태로 승격하지 않는다.

**원본·실행.** exact Flutter pin의 **11 unchanged Dart classes/2 helpers/6 unchanged Stack cache members/19 raw UTF16 spans**를 hash로 확인해 Dart3.14.0-296.0.dev/assertions enabled에서 실행했다. RenderBox/child ownership·BoxConstraints·diagnostics/debug drawing·paint/hit receiver는 type shim이며 원본 layout/baseline/cache 알고리즘 범위다. 실제 host의 **298 source groups**는 signed-zero encoding을 포함한 exact IEEE754 비교 PASS다. 별도 **7 tests/55 expectations**는 inheritance·소유권·dry/wet 분리·방향 invalidation·baseline·single-child virtual hit·partially positioned Stack과 actual FrameworkRoot Align/Stack RTL 갱신의 identity·paint·pointer·semantics·child layout 재사용을 확인했다. source/fixture/root compiler·전체 SDK build PASS, timeout20분이다. fixture의 semantics dom capability는 데이터 sink이며 실제 DOM/native reader 실행 증거가 아니다.

**coverage/선정.** 기존3592 reviews 중 바뀐 source에 연결된 **257 collateral rows**를 **253 unchanged member-token/4 changed class-token rows**로 검토했다. shared helper/상속 동작도 재검토하며 이전 selected destination subsets와 구현 제한을 보존했다. 새 **31 reviews**(partial abstract classes2/adapted members29)로 **3623 reviews/3632 declaring+export source hash references**다. RenderShiftedBox·RenderAligningShiftedBox의 실제 resolved class selection과 reverse link를 추가해 C#24/Dart156, 실제 Dart156 분석 PASS다. fresh regeneration의 Node deep equality는 전체 reviewed rows·selected subsets·기존 runtime evidence·새 selection links를 보존했다. 현재 **74143 records/47282 public/778 files/15 entrypoints/diagnostics0**, **missing69839/partial784/adapted3513/implemented7**이다. evidence는 `w6-render-alignment-20261011`이다.

**외부 소비·Metro/Hermes.** 실제 installed emitted core에서 Node24.15.0과 Metro0.83.8/RN Babel0.83.10→Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c source/optimized HBC99 모두 동일298 groups·7 tests/55 expectations PASS다. **95 direct ESM imports/99 source files/99 declarations/336 relative .js declaration imports**, source/dist/현재 README bytes·tgz/lock integrity·packed coverage snapshot이 일치했다. abstract/protected API·새 render options·legacy numeric API와 잘못된 geometry/direction 타입 거부도 PASS다. tgz SHA **dce305a44026e1c410d7d89b4d6dac5cdbb3e8baf6d9e57f20a63b296caf0771**, integrity sha512-a6GsIQi1hoykHO7TZpCca2w3t0CbBIreyU0PWebXv9w9uo8UuNuTCSrKamg4CSK4B2qVDBlOia6omt+aoTgJNA==, packed coverage SHA **34c5f9b0548552b3554b68f6156eed95593d82982377387bc7e0f3b18663c7a8**다. archive는 external receipt와 최종 reverse selection-link 채택 전 snapshot이며 installed manifest의 coverageId 참조 자체는 pinned class와 일치한다. bundle SHA **efcd4eeb229d93ee2aa575d7ebc90584dd4ece11da1970b54c13da29ed9065fb**, HBC SHA **b659a1d25c004ecb8f5ac3d233a7653a4521f1f1ada4ee5814686fa2e5aff432**다.

**fixture/선정 보정.** original algorithm을 바꾸지 않고 type-only debug/diagnostic receiver를 보완했다. fixture의 positional BoxConstraints API·private 이름 충돌·실제 Element 갱신 타입을 고쳤고 새 Dart selection ID를 resolved upstream identity에 맞췄다. 실패/성공 logs의 bytes/SHA를 evidence에 보존했다. 제품 의미를 통과시키기 위한 기대값·정밀도 완화는 없다.

**native·다음 경계.** ABI1/wire5/supported1..5와 supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47를 유지한다. compiled source146·별도 consumer header3 hashes가 현재와 일치하며 새 native compile/GPU/UI 실행은 없다. full EdgeInsets/RenderPadding·overflow families와 broader diagnostics, Transform filterQuality·Path queries/RSuperellipse/ClipPath·retained layers 및 후속 W6가 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine notVerified, Apple/Linux native 사용자 지정 SKIPPED/provider notVerified를 유지한다. source SHA는 shifted-box.ts **b604bcbbb562fc4829400c2cb9698f6fe8d52a7b0849480f2bae0103b6c58d86**, boxes.ts **fc47df486b0c18ccdd3eb776d15ac0b0e24c53536e3af8d62694054058691f6d**, basic.ts **4b3fae4201030a6da3b99f377e17f99a2b110c859b0303d537d8311f94b2d316**다. 전체 goal은 active다.

**정리 완료.** allowlist .tmp/work6/render-alignment의 **585 files/43 directories/363200306 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했으며 links/process references=0이다. 첫 execute는 listing 변화로 삭제 없이 거부했고 새 preview/execute가 일치한 뒤 정리했다. 원본 oracle/fixtures·selection analysis/coverage drafts·archive/isolated consumer·Metro/Hermes bundles·성공/실패 logs와 one-time helper를 정리하고 Flutter pin/Dart SDK·current/historical native supplier cache를 보존했다. cleanup receipt와 fingerprints는 evidence에 남았으며 최종3623 reviews/3632 source hash references가 현재 source와 일치한다. 전체 goal은 active다.

**후속 검토 항목.** RenderStack options 생성자는 현재 validation setter로 초기화해 원본 field initializer와 달리 construction 중 markNeedsLayout override를 호출할 수 있다. setter/cache 실행 대조는 통과했지만 이 생성자 초기화 순서는 별도 보정·원본 비교가 필요하며 class/constructor의 partial 범위에 남긴다. 이 보정부터 이어서 full EdgeInsets/RenderPadding·overflow family를 진행한다.

### 2026-10-11 — EdgeInsets 전체 CPU API·RenderPadding geometry/RTL·Stack 생성자 보정

**구현.** 새 직접 모듈 `framework/painting/edge-insets`에 EdgeInsetsGeometry·EdgeInsets·EdgeInsetsDirectional과 module-private MixedEdgeInsets를 구현했다. 실제 private immutable slot과 readonly getter가 파생 getter를 보존한다. 전체 factory·물리/방향/혼합 산술·clamp·보간·Size/Rect/RRect 연산·개별 corner 축 조정·LTR/RTL resolve·equality/hash/string을 제공한다. physical clamp는 directional/mixed bounds에서도 physical 결과를 반환한다. only와 nullable copyWith 계약을 구분하고 factory 인자를 한 번 캡처한다. ui.lerpDouble의 equal/both-NaN shortcut과 all-build unequal-finite debug 계약, null endpoint의 직접 scaling을 유지한다. CPU nonfinite/signed-zero를 보존하고 hash는 equality를 지키는 local adaptation이며 Dart VM hash 정수/const canonicalization ABI는 약속하지 않는다. ViewPadding은 readonly 구조 값으로 받고 fromWindowPadding은 deprecated alias다.

**RenderPadding·Stack.** RenderPadding은 RenderShiftedBox를 상속하고 geometry/textDirection·lazy resolved cache를 보유한다. 원본 intrinsic 입력 축소·padding 합산 순서·dry/wet 분리·baseline offset-once를 적용했다. Padding widget은 geometry를 유지하거나 physical DTO getter 값을 캡처하며 inherited 방향을 사용한다. directional padding에는 방향이 필요하고 childless widget도 지원한다. nonnegative 검사는 child adoption 전에 수행하며 resolved padding의 finite admission은 추가 host 계약이다. 동등 padding setter는 원래 값을 유지하고 방향 변경은 cache/측정을 무효화하면서 동일 child constraint의 layout을 재사용한다. **직전 RenderStack constructor 후속 항목은 해결했다.** 검증한 backing field를 직접 초기화해 field 초기화 중 override setter/layout hook을 호출하지 않으며 파생 private field 초기화 전 hook 실패를 보정했다. broader RenderPadding/Stack diagnostics·mixin·overflow class 제한은 유지한다.

**원본·host 증거.** exact Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a의 **13 unchanged Dart classes/3 unchanged helpers/1 unchanged Stack constructor/17 raw UTF16 spans**를 hash로 확인해 Dart3.14.0-296.0.dev/assertions enabled에서 실행했다. RenderBox/constraints·debug/paint/hit receiver와 structural ViewPadding은 shim이며 실제 Flutter engine/native window 실행이 아니다. **760 source groups**(basic19/pairs361/clamp57/null·identical lerp114/rounded8/getter trace4/padding layout144/Stack ctor36/factory17)는 signed-zero encoding을 포함한 exact IEEE754 비교 PASS다. 별도 **9 tests/65 expectations**는 실제 private slot·한 번 읽는 factory/DTO·cache/equality·child adoption·dry/wet baseline·Stack 파생 private state와 actual FrameworkRoot Padding RTL 갱신의 render/child identity·paint·pointer·semantics·layout 재사용·childless frame을 검증했다. semantics dom capability는 데이터 sink이며 실제 DOM/native reader가 아니다. source/fixture/tool/root compiler·전체 SDK build PASS, timeout20분이다.

**채택·coverage.** `_MixedEdgeInsets`를 public EdgeInsetsGeometry anchor 아래 실제 compiler local identity로 추적한다. 새 **130 reviews**(inset123/RenderPadding7), 기존3623 중 **266 collateral rows**를 **258 unchanged member-token/8 changed member-token rows**로 검토해 **3753 reviews/3762 declaring+export source hash references**다. 기존 selected destination subset·class 제한·runtime evidence를 보존했다. 네 실제 Dart class selection을 추가해 C#24/Dart160, 실제 Dart160 분석 PASS다. EdgeInsets source file에 missing destination은 없으며 전체 CPU 계약은 명시 adaptation으로 채택했다. fresh regeneration의 Node deep equality도 모두 PASS다. 현재 **74143 records/47282 public/778 files/15 entrypoints/diagnostics0**, **missing69709/partial784/adapted3643/implemented7**이다. evidence는 `w6-edge-insets-20261011`이며 이전 constructor 제한의 해결도 별도로 연결한다.

**외부 소비.** installed emitted core의 Node24.15.0 실행에서 동일760 groups·9 tests/65 expectations PASS다. **96 direct ESM imports/100 source files/100 declarations/343 relative .js declaration imports**, source/dist/현재 README bytes·tgz/lock integrity·packed coverage snapshot이 일치했다. readonly/getter·typed arithmetic/clamp·only/copyWith null 구분·physical/directional option·private export 타입 계약도 PASS다. tgz SHA **b29fb994c5f627742f443591e1de26c27bbf4068fb1ba10edc4d5292d469812d**, integrity sha512-3zPHrUtTRRE9YPlnM6qn6QcQL5Ss7ane5OPMnHnGRbmabsUmSCXnfKnb5b7Ye0EoRFZvJLKIPzyj6qlE1BEaaw==, packed coverage SHA **1a2cc19a7323b00958607134ae4c89d682544aa53adf1f5053ad45de164df29e**다. archive는 external runtime receipt 추가 전 snapshot이다.

**Metro/Hermes.** Metro0.83.8/RN Babel0.83.10의 실제 Windows bundle을 Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c에서 source/optimized HBC99로 실행해 동일760 groups·9 tests/65 expectations PASS다. bundle SHA **20ed4690036969b9148f2765d06edbb4941dd67cc5405bee09d87a1bb4c9d9d6**, HBC SHA **7b4f3b2ca9cf36ab1464e5a13053d4df2366aed5dede436505319551492bdf4f**, engine exe SHA74b975947a885939296540664f1f6c0067d1ff4b409f105377ac256a3d3f33cc다. oracle I/O/plain assertion host만 사용하며 RNW 앱/GPU/OS 입력 실행으로 집계하지 않는다. 원본 clamp 결과 종류와 single-read factory/null 계약은 채택 전에 보정했고 기대값·정밀도를 완화하지 않았다.

**native·다음 경계.** ABI1/wire5/supported1..5와 supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47를 유지한다. compiled source146·별도 consumer header3 SHA가 현재와 일치하며 새 native compile/GPU/UI 실행은 없다. overflow/render diagnostics, Transform filterQuality·Path queries/RSuperellipse/ClipPath·retained layers와 후속 W6 family가 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine notVerified, Apple/Linux native 사용자 지정 SKIPPED/provider notVerified를 유지한다. 현행 source SHA는 edge-insets.ts **672a76e602468b21be0b3122b6ab480f13e6a8e9effae451e3fed3ddb0a79db5**, boxes.ts **3dbfa69c878340c95a9b9ea390b043d14aa61d6dbd34e765c7cfad53ed40d9bb**, basic.ts **f6fbb9fed3e9350b9d1638a51a83e31d4d1708a89f415fdfee331460496c1081**, coverage.ts **819e019b33f315c23742aa1ede695c46b0a9732ec0d66f71fe40b9e481591ee4**다. 전체 goal은 active다.

**정리 완료.** allowlist .tmp/work6/edge-insets의 **603 files/43 directories/438857936 bytes**를 preview 후 -Execute로 제거했다. workspace/ancestor/link/process 경계를 확인했으며 links/process references=0이다. 첫 execute는 listing 변화로 삭제 없이 거부했고 새 preview/execute가 일치한 뒤 정리했다. 원본 oracle/fixtures·selection analysis/coverage drafts·archive/isolated consumer·Metro/Hermes bundles·logs와 one-time helper를 정리하고 Flutter pin/Dart SDK·current/historical native supplier cache를 보존했다. cleanup receipt와 fingerprints는 evidence에 남았으며 최종3753 reviews/3762 source hash references가 현재 source와 일치한다. 전체 goal은 active다.

### 2026-10-11 — Overflow sizing·constraint transform·fractional/size/unconstrained widget

**구현.** direct `framework/rendering/overflow-box`에 RenderConstrainedOverflowBox·RenderSizedOverflowBox·RenderFractionallySizedOverflowBox·RenderConstraintsTransformBox를, direct `framework/widgets/overflow-box`에 OverflowBox·SizedOverflowBox·FractionallySizedBox·ConstraintsTransformBox·UnconstrainedBox를 추가했다. 네 render는 실제 RenderAligningShiftedBox를 상속하고 다섯 widget은 persistent single-child element 또는 Stateless 조합을 사용한다. OverflowBoxFit은 max/deferToChild string union, BoxConstraintsTransform은 실제 normalized BoxConstraints를 반환하는 callback이다. max는 sizedByParent이고 fit 교체는 이전 relayout boundary까지 무효화한다. **deferToChild의 dry는 incoming constraint, wet은 override된 inner constraint를 쓰는 원본 차이를 유지했다.** requested Size는 실제 객체를 보존하거나 structural getter 값을 한 번 캡처하고 SizedOverflowBox는 child에 incoming constraint를 전달하며 physical alignment여도 Directionality가 필요하다. fractional factor의 tight axis·intrinsic 나눗셈·zero/signed-zero/Infinity·absent child 계약도 유지했다.

**cache·clip·명시적 한계.** constraint callback 교체에서 현재 mapped constraint가 같으면 원본처럼 wet layout을 생략하되 RenderObject의 새 protected helper로 자신의 dry/intrinsic cache와 측정 의존 객체 cache를 갱신한다. 다른 constraint로 후속 측정할 때 이전 callback 결과를 재사용하던 host 문제를 방지한다. helper를 제거한 나머지 object.ts bytes는 이전 snapshot과 완전히 같다. UnconstrainedBox는 retained axis에 따라 실제 ConstraintsTransformBox를 조합하고 7개 static constraint transform을 제공한다. none/hardEdge/antiAlias/antiAliasWithSaveLayer는 실제 immediate frame command를 기록하고 save/restore를 균형 있게 닫으며 parent hit 경계·host semantics clip을 유지한다. **yellow/black debug overflow 표시, diagnostic label/known transform table, retained ClipRectLayer와 그 release는 미완료다.** nonempty debugTransformType은 타입/runtime에서 명시 거부한다. 해당 class·paint·생성자·상속 dispose는 partial로 유지하며 fake layer/debug placeholder로 채우지 않았다.

**원본·실제 host 검증.** Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a의 **20 unchanged classes/3 helpers/1 typedef, 24 raw UTF16 spans**를 SHA256 확인 후 Dart3.14.0-296.0.dev/assertions enabled에서 실행했다. RenderBox/constraints/debug/paint/layer/context는 좁은 receiver shim이며 실제 Flutter engine/retained layer 실행이 아니다. **2,083 source groups**(constrained432/sized384/fractional672/transformed504/helper7/widget config84)가 signed-zero encoding을 포함한 exact IEEE754 비교 PASS다. 별도 **18 tests/100 expectations**는 실제 FrameworkRoot에서 paint·semantics clip4종, overflow hit 경계, direction 갱신, persistent child/render identity, fit relayout boundary, callback 변경의 parent 측정 cache 갱신과 wet skip, invalid return/constraint·measurement mutation 거부, childless 구성을 검증했다. semantics DOM capability는 데이터 sink다. SDK 전체 build·root/fixture compiler·실제 Dart171 selection 분석 PASS, timeout20분이다. 초기 shim의 unprefixed lerpDouble import, Rect/structural Size encoder 순서, private helper 이름 충돌, Windows Metro mixed-separator 경로 오류를 보정했고 실패 log SHA와 원인을 보존했다. 기대값·정밀도를 완화하지 않았다.

**채택·coverage.** 실제 Dart11개 selection을 더해 **C#24/Dart171**이며 manual reviewed-port를 자동 lowering으로 집계하지 않는다. 새 **124 reviews**, 기존3753 중 변경 파일 참조 **43 rows의 선언 토큰 동일성**을 검토해 **3877 reviews/3887 declaring+export source hash references**다. 나머지3710 review fields·기존 selected destination subset·과거 runtime evidence를 보존했다. fresh regeneration의 Node deep equality와 현재 source hash 검증 PASS다. 현재 **74143 records/47282 public/778 files/15 entrypoints/diagnostics0**, **missing69585/partial797/adapted3754/implemented7**이다. 전체 구현률로 단순 해석하지 않는다. evidence는 `w6-overflow-20261011`이다.

**외부 패키지·Metro/Hermes.** fresh installed emitted core의 Node24.15.0에서 동일2083 groups·18 tests/100 expectations PASS다. **98 direct ESM imports/102 source files/102 declarations/364 relative .js declaration imports**, 전체 source/dist/현재 README bytes·archive/lock integrity·packed coverage snapshot 및 readonly/options/callback/private export 타입 계약을 확인했다. tgz SHA **94310eb8040f411c2f2ee7465b038f25fa223069526f6273bcfd04404fc6dfac**, integrity **sha512-F+sN+hIW1leQCGuiQefniQNMBH4HY44RQgdvOSWt40LaeZhnGgZoKNDGAD/BZochLfYrp0GzQGvVQUpE3PErjg==**, packed coverage SHA **37da473184169facc923374c435aa805c0d34db4aae37dcd114451574db73717**다. archive는 external receipt 추가 전 snapshot이다. Metro0.83.8/RN Babel0.83.10 Windows bundle을 실제 Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c의 source/optimized HBC99로 실행해 동일 결과 PASS다. bundle SHA **1a9ee5b3b6e1922508be2f8743b736a7f04ba044ef1b60741ae7d5f65778bd10**, HBC SHA **de13574ae4d1d20a850fa3929648f144aec328ad6e9aa3d7f80457222765adf0**다. oracle I/O/assertion adapter만 사용하며 RNW 앱/GPU/OS 입력 실행을 뜻하지 않는다.

**native·후속 경계.** ABI1/wire5/supported1..5와 supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47를 유지하고 compiled source146·별도 consumer header3 SHA가 현재와 일치한다. 새 native compile/GPU/UI 실행은 없다. 현재 object.ts SHA **c8ffa8afcbff2eb178d2231a40ac319323234d108efe18ec3fc4ed0423752783**, rendering/overflow-box.ts **1fbb348d7d743bc803dd1a9a387e5c2ba52e4204a0d6fb01467f7f891e14abfb**, widgets/overflow-box.ts **877fc7c4871ffaba6a3b3acb4e2016cb7a020aa30d2a9beb77c632f1ae61bbc6**다. debug/retained-layer 범위와 Transform filterQuality·Path queries/RSuperellipse/ClipPath·후속 W6 family가 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine notVerified, Apple/Linux native 사용자 지정 SKIPPED/provider notVerified를 유지한다. 전체 goal은 active다.

**정리 완료.** marked allowlist .tmp/work6/overflow의 **610 files/43 directories/446321268 bytes**를 preview와 -Execute의 동일 listing SHA로 확인해 제거했다. ancestor/workspace/link/process 경계를 확인했으며 links/process references=0이다. 첫 preview는 같은 shell batch의 검증 command가 target을 참조해 삭제 없이 거부했고 해당 process가 끝난 뒤 별도 preview/execute로 정리했다. 원본 oracle·fixtures·draft/selection analysis·archive/isolated consumer·Metro/Hermes bundles·logs와 one-time helper를 제거하고 Flutter pin/Dart SDK·native supplier cache를 보존했다. cleanup receipt·source/fixture/log fingerprints는 evidence에 남겼으며 정리 후 **3877 reviews/3887 source hash references**와 current product hashes가 일치한다. git diff --check PASS다. 전체 goal은 active다.

### 2026-10-11 — 기존 sizing family 원본 보정·nullable intrinsic step·Baseline 상속

**구현·호환 경로.** 기존 boxes/basic의 RenderLimitedBox·RenderAspectRatio·RenderIntrinsicWidth/Height·RenderBaseline·RenderIgnoreBaseline과 대응 widget 6종을 원본에 맞춰 보강했다. 중복 모듈을 추가하는 초기 편집은 채택 전에 제거하고 TypeScript AST class 경계로 기존 구현을 교체했다. **기존 공개 경로·legacy numeric/child 생성자를 유지하고 render options overload, widget AspectRatio/Baseline options overload를 추가했다.** 새 public subpath/barrel은 없다. widget readonly config는 getter/DTO를 한 번 캡처하고 기존 LimitedBox/IntrinsicWidth options holder는 frozen snapshot으로 보존한다. 실제 single-child element를 사용하고 update는 무조건 layout dirty를 만들지 않는다. render intrinsic getter의 미지정 값은 기존 undefined에서 원본 null로 보정했으며 undefined 입력은 계속 null로 받는다. 이 변경과 앞선 W6 breaking API의 최종 version/migration qualification은 전체 W6 종료 전에 필요하다.

**원본 알고리즘.** LimitedBox는 unbounded 축만 제한하고 dry baseline은 제한 전 incoming constraint로 전달한다. AspectRatio는 childless여도 자신의 ratio 크기를 계산하고 원본의 maxWidth→maxHeight→minWidth→minHeight 순서를 유지한다. child는 tight constraint로 layout하며 자신의 size가 child에 의존하지 않으므로 parentUsesSize를 설정하지 않는다. 양쪽 unbounded는 오류다. IntrinsicWidth/Height는 tight 축의 speculative query 생략, finite intrinsic assertion, child constraint·baseline·dry/wet 분리와 parent 측정 cache 갱신을 유지한다. widget zero/-zero step은 null이며 render step은 null 또는 positive다. positive Infinity step은 source처럼 허용하고 후속 nonfinite 값은 기존 host admission에서 검사한다. **매우 작은 step은 pin한 Dart VM의 signed64 ceil 포화 후 double 변환을 모든 host에 적용한다.** integer zero를 사용하고 nonfinite quotient는 거부한다. Dart compiled-JS의 다른 integer 동작을 별도 numeric 정책으로 약속하지 않는다. Baseline은 실제 RenderShiftedBox를 상속하며 음수 child offset·baseline-free child의 bottom layout fallback·requested/positioning baseline getter 순서와 this.baseline + requested - positioning 산술을 보존한다. baseline 값 저장에는 source에 없는 finite assert를 추가하지 않으며 실제 size/offset/baseline admission은 기존 host 규칙을 따른다. IgnoreBaseline은 real actual/dry baseline을 숨기고 일반 bottom fallback을 유지한다. render diagnostics·whole class는 partial이다.

**source·host 증거와 차이.** Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a의 **19 unchanged classes/1 mixin/3 helpers/2 typedefs, 25 raw UTF16 spans**를 SHA256 확인 후 Dart3.14.0-296.0.dev/assertions enabled에서 실행했다. BoxConstraints/render/cache/paint/debug/context receiver는 shim이며 실제 Flutter engine/native ownership 실행이 아니다. **1148 groups**(limited84/aspect168/width588/height28/ignore28/baseline210/widget config42) 중 **1112는 signed-zero를 포함한 exact IEEE754 일치**, **36은 명시적 host admission 차이**다. 원본 dry baseline은 infinite minimum child constraint 또는 Infinity 결과를 받을 수 있지만 기존 host RenderBox는 applied infinite-min constraint와 nonfinite baseline을 거부한다. 36개 각각의 양쪽 baseline 값·case를 evidence에 보존하고 해당 그룹의 나머지 4개 출력은 정확히 비교했다. 이 차이를 exact PASS로 숨기거나 수치 tolerance를 완화하지 않았다. 추가 ceil probe와 168 source groups가 VM64 포화를 검증했다.

별도 **23 tests/121 expectations**는 legacy/options constructor identity·invalid 인자의 child adoption 전 거부·LimitedBox incoming baseline·childless/conflicting AspectRatio·intrinsic one-read/zero/null·parent measured cache 갱신·tight-axis query 생략·unchanged child layout 재사용·Baseline inheritance/negative offset/real-null fallback·measurement mutation 거부와 actual FrameworkRoot 6종의 paint·semantics·pointer·persistent child/render identity·childless frame을 검증했다. semantics DOM capability는 데이터 sink다. SDK 전체 build·root/strict fixture/외부 consumer 타입 PASS, timeout20분이다. 최초 shim import·strip-only Node source transform·테스트의 이미 소유된 child 재사용/childWidgets 누락·adoption scanner의 표현식/implicit constructor 구분은 보정하고 실패 log fingerprint를 보존했다.

**채택·coverage.** 기존 **66 own reviews를 재검토하고 34 reviews를 추가**했다. 기존3877 중 **273 changed-file rows**는 **209 unchanged declaration-token/64 changed token rows**로 검토했고 changed token은 이 12개 sizing class에 한정했다. 나머지3604 review fields·이전 selected destination subset·과거 runtime evidence를 보존했다. **3911 reviews/3921 declaring+export source hash references**, fresh regeneration의 Node deep equality와 current hash 검증 PASS다. manifest는 **C#24/Dart171**을 유지하고 실제 Dart171 분석 PASS다. manual reviewed-port를 자동 lowering으로 집계하지 않는다. 현재 **74143 records/47282 public/778 files/15 entrypoints/diagnostics0**, **missing69563/partial797/adapted3776/implemented7**, evidence는 **w6-sizing-20261011**이다.

**설치 패키지·Metro/Hermes.** fresh installed emitted core의 실제 Node24.15.0에서 동일1148 groups(1112 exact/36 admission 차이)·23 tests/121 expectations PASS다. **98 direct ESM imports/102 source files/102 declarations/364 relative .js declaration imports**, source/dist/현재 README bytes·tgz/lock integrity·packed coverage snapshot, legacy/options overload·nullable step/undefined setter·readonly/private export 타입을 확인했다. tgz SHA **c24567bf2ab099960ceb4028f12eb0c48140d512ed49457d245b8a530581b183**, integrity **sha512-CeG5jZHc2VhavXKn14aMCt+5AzhA960DlqKp2rIU+Aize8TtiPVMJB7dPKMFwzfjuKmUYajQl38yDisky1VJuA==**, packed coverage SHA **16df372acbb684f092970d55bbf6c9e7d7e33593a19519be8bd97f12b1617959**다. archive는 external receipt 추가 전 snapshot이다. Metro0.83.8/RN Babel0.83.10 Windows bundle을 Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c의 source/optimized HBC99로 실행해 같은 결과 PASS다. bundle SHA **01719e4628956d680ce98ca606d5020b750cd19702930774dd0f9d717caa6293**, HBC SHA **49d79819cb596084fb6fae26d6bd67eec9b480f6aa0adb1909c7b49ab0a4e7f8**다. oracle I/O/assertion host를 사용하며 RNW 앱/GPU/OS input 실행을 뜻하지 않는다.

**native·후속 범위.** ABI1/wire5/supported1..5, supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47를 유지하고 compiled source146·별도 consumer header3 hash가 현재와 일치한다. 새 native compile/GPU/UI 실행은 없다. 현행 boxes.ts SHA **4e8b16ddcdaa97ba5cf792acaf0de2c2456bbeb35f788ea87dd1156487501c61**, basic.ts **0db2a80b09e4d8b0a8683389eaff6c36157a73b9b6b71f76d75ee612b20757ad**다. FittedBox/BoxFit·RotatedBox/IndexedStack/Visibility·후속 공통 widget과 debug/retained-layer·Path/filter·text/input/sliver/Material/Cupertino 전체 항목이 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine notVerified, Apple/Linux native 사용자 지정 SKIPPED/provider notVerified를 유지한다. 전체 goal은 active다.

**정리 완료.** marked allowlist .tmp/work6/sizing의 **631 files/45 directories/595102472 bytes**를 preview/-Execute의 동일 listing SHA로 확인해 제거했다. workspace/ancestor/link/process 경계를 확인했고 links/process references=0이다. 원본 oracle·fixtures/ceil probe·AST transplant/coverage drafts·Dart selection analysis·archive/isolated consumer·Metro/Hermes bundle·logs와 one-time helper를 정리하고 Flutter pin/Dart SDK·current/historical native supplier cache를 보존했다. receipt·source/fixture/log fingerprints는 evidence에 남겼으며 정리 후 **3911 reviews/3921 source hash references/current product hashes**가 일치하고 중복 sizing 모듈이 없음을 확인했다. git diff --check PASS다. 전체 goal은 active다.

### 2026-10-11 — BoxFit 전체 CPU 연산·FittedBox·RotatedBox와 생성자 상태 순서

**구현.** direct `framework/painting/box-fit`에 BoxFit 7종 string literal·applyBoxFit·getter 기반 FittedSizes를, direct rendering/widgets의 fitted-box·rotated-box 4개 모듈에 두 render·widget을 추가했다. 실제 Size identity·파생 getter 읽기 순서를 유지하고 structural DTO는 한 번 캡처한다. FittedSizes의 실제 private readonly slot과 virtual getter는 source/destination 참조를 보존한다. fill/contain/cover/fitWidth/fitHeight/none/scaleDown의 source/destination 크기·result identity·NaN/Infinity/negative/signed-zero CPU 산술을 원본과 대조했다. Dart enum constructor/values/index/name·const canonicalization은 이 string literal host 표현에 포함하지 않으며 enum implicit constructor는 missing으로 유지한다. public subpath는 5개 증가한 **103개**이고 barrel은 없다.

**FittedBox.** child를 unconstrained로 layout하고 원본의 unscaled intrinsic·baseline 동작을 유지한다. scaleDown만 layout 크기에 영향을 주고 다른 fit·alignment/direction 변경은 paint data만 갱신한다. 방향은 paint/hit/좌표 변환 시 지연 resolve하며 inherited nullable 방향에 새 ltr fallback을 넣지 않는다. applyBoxFit·Alignment.inscribe로 얻은 matrix/crop을 paint·hit·local/global 좌표·semantics에 연결한다. empty child는 zero public paint matrix·paint/hit/descendant semantics 생략을 적용한다. clip4종은 균형 잡힌 immediate clip/saveLayer command를 기록하고 parent hit gate와 host semantics crop을 유지한다. **추가 생성자 probe에서 child adoption이 own fit field 초기화보다 먼저 일어나 virtual layout hook이 undefined를 읽던 문제를 발견해 보정했다.** 모든 own config를 먼저 초기화하고 child를 채택한다. 원본 RenderObject.adoptChild와 mixin child setter를 변경 없이 실행한 7개 constructor case가 이를 확인한다. 기존 archive/consumer 영수증은 SUPERSEDED로 보존했고 수정 후 별도 fresh package·consumer·bundle/HBC를 검증했다.

**RotatedBox·명시적 한계.** odd quarterTurns는 layout/intrinsic 축을 뒤집고 Euclidean modulo와 실제 vector_math rotateZ/translation 순서로 4×4 matrix를 만든다. quarter-angle 소수 값을 snapping하지 않는다. 같은 행렬을 paint/hit/좌표/semantics에 적용하며 safe integer 입력과 integer zero를 사용한다. actual real baseline은 null이고 source unsupported dry-baseline debug 계약을 모든 host build에서 거부한다. private radians constant는 실제 module const이며 RenderRotatedBox public anchor 아래 compiler local identity로 추적한다. coverage 도구는 명시 mapping의 unexported const를 기존 private class와 함께 발견하고 mutable/exported/guessed binding으로 대체하지 않는다. **retained ClipRectLayer/TransformLayer·재사용/resource release·진단은 미완료다.** Fitted paint/_paintChildWithTransform와 Rotated paint/inherited dispose 및 render/widget class는 partial이며, source _transformLayer는 missing이다. fake retained handle이나 placeholder로 완료 처리하지 않았다.

**원본·host 증거.** Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a의 **14 unchanged classes/5 functions/1 enum/1 mixin/1 const initializer/6 methods/1 setter, 29 raw UTF16 spans**를 SHA256 확인 후 Dart3.14.0-296.0.dev/assertions enabled와 실제 locked vector_math2.4.3에서 실행했다. vector archive SHA **92b9910f66ed1057fd4da7b040ae7c74cafacf885bdc81be496928d5049b032d**, library73 files/844317 bytes의 fingerprint **463cbde467a0590955f1433c7cb07d0ba8c035053d25e43857730088c4239907**을 기록했다. original default baseline diagnostic·direction check·MatrixUtils·adoptChild/child setter도 실행한다. 나머지 render/constraints/paint/layer/context receiver는 shim이며 실제 Flutter engine·retained resource·native ownership 수락이 아니다. **2685 groups**(fit1008/fitted1260/rotated281/widgetFitted108/widgetRotated14/getter trace7/constructor7)가 signed-zero를 포함한 exact IEEE754 일치 PASS다. quarter-turn point의 **10.000000000000002**도 원본 관측값으로 유지하며 수치 tolerance를 완화하지 않았다.

별도 **21 tests/127 expectations**는 readonly references·DTO single read·invalid 옵션의 adoption 전 거부·own field 초기화 순서·raw intrinsic/baseline·fit별 dirty/cache 분리·deferred direction·child size 변경·empty transform/hit/semantics·실패 paint scope balance·actual FrameworkRoot paint mutation 거부·axis/baseline·quarterTurns admission·clip4종 command/semantics/hit·inherited RTL·persistent child/render identity·childless frame을 검증했다. semantics DOM capability는 데이터 sink다. Metro가 non-strict module을 생성해 getter-only 대입의 예외 검사 한 개가 실패한 초기 Hermes log를 보존했다. 대입 검사를 explicit strict 함수로 실행해 같은 예외 계약을 검증했으며 제품 getter나 numeric 기대값을 완화하지 않았다. 초기 원본 wrapper의 annotation/type/semicolon·nullable diagnostic·mixed alignment API 구분도 보정했고 실패 log fingerprints를 남겼다. SDK 전체 build·root/strict fixture/tool/외부 consumer 타입 PASS, timeout20분이다.

**채택·coverage.** 새 **74 reviews**, 기존3911의 review fields·selected destination subset·과거 evidence를 그대로 보존해 **3985 reviews/3996 declaring+export source hash references**다. 기존 제품 TS 파일은 변경하지 않아 collateral row는 0이다. 실제 Dart7개 selection을 더해 **C#24/Dart178**, 실제 Dart178 분석 PASS다. manual reviewed-port를 자동 lowering으로 집계하지 않는다. fresh regeneration의 Node deep equality와 current hashes PASS다. 현재 **74143 records/47282 public/778 files/15 entrypoints/diagnostics0**, **missing69489/partial806/adapted3841/implemented7**이며 전체 구현률이 아니다. evidence는 **w6-fitting-20261011**이다.

**설치 패키지·Metro/Hermes.** 생성자 보정 후 fresh installed emitted core의 실제 Node24.15.0에서 동일2685 groups·21 tests/127 expectations PASS다. **103 direct ESM imports/107 source files/107 declarations/392 relative .js declaration imports**, 모든 source/dist/현재 README bytes·tgz/lock integrity·packed coverage snapshot과 literal Fit·readonly result·options·private const export 차단 타입 계약을 확인했다. 최종 tgz SHA **d224a7f5bce4aca9fc3867ba27e1b1c6e751be7e52ed1f8107dd7b17afb34370**, integrity **sha512-Jt8Umm7+NMReJLAVL9wt/qOdZz9SLeHZAewwWNvIE8FoCrnuVTGVZ7iHVZb6sWmAl6ZPFT0pMydXm0Qxqlmy1g==**, packed coverage SHA **46a12af655fe5a208022e841aadc622f089ab2ca9eb119b4e506801cf8de7da7**다. archive는 external receipt 추가 전 snapshot이다. 이전 archive SHA4a9390eab20341cca85ef7d08e9db2ab6b72ec0cdd70ab7bc3df1f5ab8892902는 constructor 보정 전 역사적 영수증이다. 최종 Metro0.83.8/RN Babel0.83.10 Windows bundle을 Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c의 source/optimized HBC99로 실행해 같은 결과 PASS다. bundle SHA **f77fc34b42d3f13980feed7d1b16b756ffe2a2289c71274be715de1ecc5f513d**, HBC SHA **e0292d8ab2ebd1ac594b7b0fcada86d976b51214a77cb24b87b4535b8bdbdea9**다. oracle I/O/assertion host를 사용하며 RNW 앱/GPU/OS input 실행을 뜻하지 않는다.

**native·후속 범위.** ABI1/wire5/supported1..5와 supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47를 유지하고 compiled source146·별도 consumer header3 hash가 현재와 일치한다. 새 native compile/GPU/UI 실행은 없다. 현행 painting/box-fit.ts SHA **66d8de95cf3df0fd091bded8fd9e2cfb39af6cc1e5d0a7ab03a643885b140bb7**, rendering/fitted-box.ts **dad563800f2603621bfb7e955495a45a5687a4a99a30a6924679ab9daf37b66a**, rendering/rotated-box.ts **71cb4e92c38f45725b5f514b35cd77434139a75adb8953e8e05574d176073b0d**, coverage.ts **0345a4adcbb1fe6fa9a1edb3f165fa8a64c18ccb2711b147805f913d90a31847**다. IndexedStack/Visibility·FractionalTranslation·후속 공통 widget, retained layer/Path/filter·text/input/sliver/Material/Cupertino와 최종 version/migration qualification이 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine notVerified, Apple/Linux native 사용자 지정 SKIPPED/provider notVerified를 유지한다. 전체 goal은 active다.

**정리 완료.** marked allowlist .tmp/work6/fitting의 **1260 files/85 directories/799457218 bytes**를 preview/-Execute의 동일 listing SHA로 확인해 제거했다. workspace/ancestor/link/process 경계를 확인했고 links/process references=0이다. 원본 oracle·fixtures/constructor probe·selection analysis/coverage drafts·초기/최종 archives 및 isolated consumers·Metro/Hermes bundles·raw logs와 one-time helper를 정리하고 Flutter pin/Dart SDK·current/historical native supplier cache를 보존했다. 초기 성공/실패 scope와 SUPERSEDED 영수증·source/fixture/log fingerprints·cleanup receipt는 evidence에 남겼으며 정리 후 **3985 reviews/3996 source hash references/current product hashes**가 일치한다. git diff --check PASS다. 전체 goal은 active다.

### 2026-10-11 — FractionalTranslation·Offstage·포인터 차단 subtree와 navigation 보정

**구현.** rendering/widgets의 fractional-translation·offstage·pointer-blocking **6 direct modules**에 render/widget 4쌍을 추가했다. public subpath는 **109개**, barrel은 없다. actual Offset identity와 structural DTO single capture를 유지하고 own configuration을 child adoption 이전에 초기화한다. 실제 persistent SingleChildRenderObjectElement와 setter-only update를 사용한다. 기존 navigation의 Offstage는 legacy (child, offstage, key?) 생성자를 가진 실제 canonical subclass이며 공개 경로와 route identity를 유지한다. 기존 renderer가 숨긴 route의 layout 공간을 그대로 차지하던 동작을 원본 minimum-size 동작으로 보정했다.

**렌더 동작.** FractionalTranslation은 own size를 기준으로 translate하고 자신의 hit bounds를 우회하는 실제 source override를 따른다. ancestor hit gate는 유지하며 transformHitTests=false는 hit translation만 바꾼다. paint matrix·local/global 좌표·semantics는 항상 translate한다. translation 변경은 paint/semantics frame만 요청하고 wet layout·measurement cache를 유지한다. Offstage는 child를 incoming constraint/parentUsesSize=false로 계속 layout하며 sizedByParent/performResize로 자신의 크기를 constraints.smallest로 정한다. 숨긴 경우 paint/hit/semantics·real baseline/intrinsics를 생략하고 sizedByParent 전환은 parent layout을 요청한다. child의 focus와 활성 animation registration은 계속 유지한다. isDisplayed는 기존 native editor reveal 경로에 연결되며 OS focus/IME 수락을 뜻하지 않는다.

**포인터·semantics 경계.** IgnorePointer는 아래 stack sibling이 hit을 받게 하고 AbsorbPointer는 자기/child entry를 추가하지 않고 in-bounds hit을 소비해 아래 sibling을 차단한다. ancestor listener는 여전히 받을 수 있다. 현재 host semantics tree의 labels·role·enabled·value/selected/checked/focused를 보존하며 사용 가능한 6개 user action을 재귀 제거한다. 2048 nodes/64 depth/cycle budget을 적용하고 기존 action object는 변경하지 않는다. **전체 Flutter SemanticsConfiguration과 describeSemanticsConfiguration API는 missing을 유지한다.** source blocking flag와 실제 host tree adaptation을 구분한다. source accessibility-focus notification action은 현재 host action ABI에 없다. 진단 API·RenderOffstage debug children·private _OffstageElement의 debug onstage traversal도 missing이다. Offstage.createElement와 class 8개는 partial이다.

**원본·host 검증.** Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a의 **13 unchanged classes/3 functions/1 mixin/1 method/1 setter, 19 raw UTF16 spans**를 SHA 검증 후 Dart3.14.0-296.0.dev/assertions enabled와 실제 locked vector_math2.4.3에서 실행했다. render/constraint/context/semantics receiver는 명시 shim이다. **262 groups**(fractional150/offstage30/ignore30/absorb30/widget8/constructor8/semantics6)는 signed-zero 포함 exact 비교 PASS다. semantics6은 source blocking flag/visit와 host action adapter의 대응 관측이며 full Flutter semantics engine 실행이 아니다. **22 tests/166 expectations**는 실제 FrameworkRoot, pointer capture·ancestor/stack gates, parent boundary·독립 child layout, baseline, query cache, DTO identity, adoption 전 invalid option, paint/measurement/disposed mutation guards, nested semantics 보존·budget, persistent child/render identity, focus·animation 지속, 실제 Navigator push/pop route 보존을 검증한다. DOM semantics는 data sink다. 실패한 source shim 타입/mixed declaration, fixture constraint API/direction, external private phase import와 Windows Metro absolute entry import log의 fingerprints를 남겼다. 최종 guard probe는 실제 FrameworkRoot paint를 사용한다. 숫자 기대값을 완화하지 않았다. SDK 전체 build·root/strict fixture·external consumer type PASS, timeout20분이다.

**채택·coverage.** 실제 Dart8 selections 추가로 **C#24/Dart186**, 실제186개 분석 PASS다. manual reviewed-port를 자동 lowering으로 집계하지 않는다. **새63 reviews**, 기존3985개 reviewed row 전체와 selected destination subset·과거28개 evidence envelope를 보존해 **4048 reviews/4071 declaring+export source hash references**다. navigation.ts에는 기존 reviewed row가 없어 collateral invalidation은0이다. legacy/canonical Offstage의 actual declaring/export source identity를 모두 추적한다. fresh regeneration의 items deep equality·현재 source hashes PASS다. 현행 **74143 records/47282 public/778 files/15 entrypoints/diagnostics0**, **missing69432/partial809/adapted3895/implemented7**, evidence **w6-staging-20261011**이다. localSnapshotMatchesPin=false는 역사적 unpinned comparison snapshot flag이며 현재 pin의 Git/source blob 검증과 별도다.

**설치 패키지·Metro/Hermes.** fresh installed emitted core Node24.15.0, Metro0.83.8/RN Babel0.83.10 Windows bundle, Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c source/optimized HBC99에서 동일262 groups·22 tests/166 expectations PASS다. **109 direct ESM imports/113 source files/113 declarations/421 relative .js declaration imports**와 모든 source/dist/README bytes·lock integrity·readonly/private/options/legacy constructor 타입 계약을 확인했다. tgz SHA **56cc077de4cb0da7e47ebeaf1007bb367c2b84d1491a4c22adf38711cb220efc**, integrity **sha512-bx7H6rDmddffCsv2OK0/9P8yCszrmB28TQw1Di6xOBea8QKU4xug8s9q1A0GB0OUx/8XVbBoVkLwGgIu3TkQag==**, packed coverage SHA **10a1a3f771b17e010b0e493c1d43aba8de7baffa586dfcad58ebbebb4275c264**다. archive는 외부 runtime receipt 추가 전 snapshot이다. bundle SHA **6292d344fbcfa4a6da5b2bb67fee5776f843ec7bd195273dfc2d42c23fe64fe6**, HBC SHA **f44407ef8bbc3433be213a55015c29c848cc5fea33729a43fc91af01c8c76e94**다. oracle I/O/assertion adapter만 사용하며 RNW 앱/GPU/OS 입력 실행이 아니다.

**후속 경계.** ABI1/wire5/supported1..5 및 supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47를 유지하고 compiled source146·별도 consumer header3 SHA가 현재와 일치한다. 새 native compile/runtime은 없다. **Visibility/IndexedStack은 real inherited focus/ticker 정책이 선행되어야 하며 미완료다.** maintain flag를 무시한 조합으로 닫지 않았다. diagnostics/full semantics configuration·retained layers·Path/filter·text/input/sliver/Material/Cupertino·최종 version/migration qualification과 Windows Move editor right InvokePattern 문제가 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine notVerified, Apple/Linux native 사용자 지정 SKIPPED/provider notVerified를 유지한다. 전체 goal은 active다.

**정리 완료.** marked allowlist .tmp/work6/staging의 **670 files/44 directories/382422034 bytes**를 preview/-Execute의 동일 listing SHA **43e5e350fd341a80beb5dd0821cfc4c221443de32e694fdb550a53be269c4ea5**로 확인해 제거했다. workspace/ancestor/link/process 경계를 확인했고 links/process references=0이다. 원본 oracle·fixtures·selection analysis/drafts·archive/isolated consumer·Metro/Hermes bundle·logs와 one-time helper를 정리하고 Flutter pin/Dart SDK·current/historical native supplier cache를 보존했다. source/fixture/log fingerprints·cleanup receipt는 evidence에 남겼으며 정리 후 **4048 reviews/4071 source hash references/current product hashes/compiled source146·consumer header3**가 현재와 일치한다. git diff --check PASS다. 전체 goal은 active다.

### 2026-10-11 — inherited TickerMode·State provider와 숨긴 View의 forced frame

**구현.** 기존 ticker-mode 모듈을 실제 inherited 정책으로 보강하고 direct widgets/ticker-provider에 SingleTickerProviderStateMixin/TickerProviderStateMixin을 TypeScript State superclass로 이식했다. FrameworkRoot와 BuildOwner의 scheduler를 internal weak registry로 연결하며 public registry/barrel을 추가하지 않는다. public subpath는 **110개**다. immutable getter/private-slot TickerModeData·equals/fallback/local hash, stable boolean/compound notifier, dependent of/valuesOf와 nondependent getNotifier/getValuesNotifier, merge를 제공한다. enabled는 ancestor AND, forceFrames는 ancestor OR다. 기존 (enabled,child,targets,key) 생성자는 유지하고 options overload를 더했다. borrowed explicit targets는 owner mute 합성과 해제만 적용하며 dispose하지 않는다. 두 policy field는 widget-aware provider에 자동 적용된다.

**provider·resource.** 실제 owning FrameworkRoot scheduler에서 ticker를 만들고 mode listener로 widget rebuild 없이 갱신한다. GlobalKey 이동은 새 notifier로 재구독하고 State/render/ticker identity를 유지한다. Single은 disposed ticker 이후에도 State lifetime 동안 한 번만 vend한다. Multi는 개별 ticker 해제를 추적한다. 기존 AnimationController의 첫 인수는 FrameScheduler 또는 TickerProvider로 받으며 기존 경로를 유지한다. 전체 AnimationController API는 별도 미완료다. **active ticker를 가진 State의 teardown은 source guard를 모든 host build에서 오류로 보고하면서 owned ticker/observer와 notifier를 정리한다.** inactive owned ticker도 host observer 해제를 위해 dispose한다. idempotent disposal·강제 cleanup은 명시 host adaptation이다. diagnostic/private helper identity와 root disposal 중 처음 생성되는 late controller/ticker는 미완료이며 class/mixin partial을 유지한다. root는 기존대로 scheduler를 State보다 먼저 닫는다. TickerModeData.hashCode는 VM Object.hash/const canonicalization을 약속하지 않는다.

**forced frame.** Ticker.forceFrames·FrameScheduler.scheduleForcedFrame이 concrete optional forced host callback을 호출하고 ViewRuntime이 이를 제공한다. hidden View도 요청 한 개로 frame을 coalesce하며, physical surface 크기0에서도 forced framework callbacks를 진행하고 renderer frame은 제출하지 않는다. normal hidden request는 dormant이고 View close는 queue task와 tickers를 취소한다. isTicking은 source처럼 hidden/idle에서는 false이며 forced callback이 queued여도 동일하다. **host는 nonforced hidden ticker의 callback을 unschedule하는 기존 admission을 유지한다.** source의 queued-but-not-requested callback과 이 차이를 명시했다. forceFrames setter는 host scheduling을 즉시 재평가하고 request 실패는 callback 등록을 되돌린다. 실제 OS background delivery/power 정책은 별도 notVerified다.

**검증.** Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a의 **11 unchanged classes/2 mixins, 13 raw UTF16 spans**를 SHA 확인 후 Dart3.14.0-296.0.dev/assertions enabled에서 실행했다. 실제 Dart Futures를 사용하며 foundation/widget/SchedulerBinding receiver와 context lifecycle은 narrow shim이다. **120 exact groups**(data4/nested64/merge36/notifier4/provider8/forced4) PASS다. host counterpart는 실제 FrameworkRoot tree와 FrameScheduler다. 별도 **20 tests/95 expectations**는 immutable/subtype data, fallback·stable notifier, 의존 build와 nondependent consumer, single/multi lifetime, muted elapsed time, existing AnimationController/provider 연결, ancestor AND/OR, actual GlobalKey 이동, per-View policy, active/inactive teardown·실패 cleanup, borrowed targets, forced coalescing/request rollback, queued callback cleanup, scheduler close와 **actual ViewRuntime hidden/zero-size** 경로를 검증했다. FrameClock·renderer는 recording host이며 GPU/OS 증거가 아니다. source annotation·overload narrowing·과거 destination의 누락 public access metadata 정규화 관련 실패 log fingerprints를 보존했다. SDK 전체 build·root/fixture/tool/외부 consumer type PASS, timeout20분이다.

**채택.** Dart5 selections 추가로 **C#24/Dart191**, 실제191개 분석 PASS다. manual reviewed-port이며 자동 lowering이 아니다. 새 **30 reviews**, 기존4048 중4026 review fields·selected destination subset을 보존하고 변경 파일22 rows를 재검토했다. 그중20개 선언 token은 동일하고 **Ticker.scheduleTick/shouldScheduleTick 두 body**는 forced scheduling 변경을 반영한다. 기존29개 evidence envelope는 그대로 보존했다. 현재 **4078 reviews/4101 declaring+export source hash references**, fresh regeneration items deep equality·현재 hashes PASS다. ledger **74143 records/47282 public/778 files/15 entrypoints/diagnostics0**, **missing69409/partial806/adapted3921/implemented7**, evidence **w6-ticker-policy-20261011**이다. 전체 구현률이 아니다.

**외부 실행.** fresh installed emitted core Node24.15.0·Metro0.83.8/RN Babel0.83.10 Windows bundle·Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c source/optimized HBC99에서 동일120 groups·20 tests/95 expectations PASS다. **110 direct ESM imports/115 source files/115 declarations/430 relative .js declaration imports**, source/dist/README bytes·archive/lock integrity와 provider/legacy overload·readonly/private/internal/no-barrel 타입 계약 PASS다. tgz SHA **10423d0db804593393c36a0587d210353094fd77b2ea84b883a684ef0ae31a0a**, integrity **sha512-b1XzibHFuZ30dh+I2gE6lOT1jVYdEXCX1gPQj698LqWGHmmIOwTvD+uYI/aTwrhsYuVH8Sb1MNvcRG0Q8e3PdA==**, packed coverage SHA **f750a00924b04d69239834cf01dfa773900b9596b23a6ffa19c8e75568d4909f**다. archive는 external runtime receipt 추가 전 snapshot이다. bundle SHA **77503084bc6b5987f3458e26b2b2785aa906a0312a5add83c7f725b0763ad15f**, HBC SHA **e53a252989f93354555a831751b47cacb4ae198e94a2da074bf02c9f43973b5d**다. RNW 앱/GPU/native input 실행은 없다.

**후속 경계.** ABI1/wire5/supported1..5·supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47·compiled source146·별도 consumer header3 hash는 현재와 일치한다. 새 native compile/runtime은 없다. **다음은 계층 focus/ExcludeFocus와 실제 EditableText 연결, 이어 Visibility/IndexedStack 구현**이다. Ticker 기반만으로 해당 widget을 완료 처리하지 않았다. diagnostic/full semantics configuration·late disposal·retained layers·Path/filter·text/input/sliver/Material/Cupertino·final version/migration qualification과 Windows Move editor right InvokePattern 문제가 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine notVerified, Apple/Linux native 사용자 지정 SKIPPED/provider notVerified를 유지한다. 전체 goal은 active다.

**정리 완료.** marked allowlist .tmp/work6/ticker-policy의 **672 files/44 directories/456307371 bytes**를 preview/-Execute의 동일 listing SHA **c5f84e0a92e08e7536cab2a817487c4ff61f58d39fe59bb14e2a70073f9ca741**로 확인해 제거했다. workspace/ancestor/link/process 경계를 확인했고 links/process references=0이다. 원본 oracle·fixtures·analysis/drafts·archive/isolated consumer·Metro/Hermes bundle·logs·one-time helper를 정리하고 Flutter pin/Dart SDK와 current/historical native supplier cache를 보존했다. source/fixture/log fingerprints·cleanup receipt는 evidence에 남겼다. 정리 후 **4078 reviews/4101 source hash references/current product hashes/compiled source146·consumer header3** 일치, git diff --check PASS다. 전체 goal은 active다.


### 2026-10-12 — 계층 focus·실제 inherited 위젯·EditableText와 SDK blur

**구현.** FocusNode/FocusScopeNode/FocusAttachment/FocusManager를 실제 per-View tree로 연결했다. flag 합성·ancestor/descendant 조회·scope history·keyboard token·microtask request/autofocus·request/unfocus·attach/reparent/detach와 key down/up ancestor 전파를 제공한다. 같은 enclosing scope 안의 leaf 이동과 scope 전체 이동은 history를 보존하고 root.unfocus는 원본처럼 no-op이다. native host/context의 다른 View 이동·cycle·disposed admission을 거부하며 unmanaged parent 이동은 이전 native focus를 해제한다. reentrant listener 요청은 다음 update에서 처리한다. 전체 focus/traversal API가 완료된 것은 아니다.

**위젯·편집.** direct widgets/focus-scope에 persistent Focus/FocusScope와 private subtype external-node factories, ExcludeFocus/ExcludeFocusTraversal을 추가했다. 실제 inherited notifier dependency와 GlobalKey 재부모화로 State/render/native binding을 보존하며 exclusion은 RenderObject를 추가하지 않아 Positioned ParentData를 보존한다. 기존 widgets/focus의 FocusScope manager와 legacy attach callback은 호환 유지한다. EditableText는 실제 context attachment를 사용하고 제외/분리 시 REQUIRED EditingBinding.blur를 호출한다. ReactNativeEditorPort/NativeTextFieldHandle에도 blur가 필수이며 SDK DOM/TextInput/기존 Android blur command로 연결한다. Kotlin은 변경·재빌드하지 않았다. focusable:false semantics는 enabled/label/text/backward selection을 유지하면서 focus/action/traversal을 억제한다. 재활성화는 자동 refocus하지 않는다. custom host API migration을 README에 명시했고 최종 version/migration qualification은 남는다.

**원본·host 검증.** exact Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a의 6 unchanged classes/3 enums/7 methods, 총16 raw UTF16 spans를 SHA 확인 후 Dart3.14.0-296.0.dev/assertions enabled에서 실행했다. foundation/context/geometry/diagnostics/traversal/hardware/SchedulerBinding은 narrow receiver shim이며 Flutter engine 실행이 아니다. 170 exact groups(flags128/request16/history4/deferred+detach2/root1/reparent3/exclusion composition4/lookup12) PASS다. 별도 실제 FrameworkRoot/SDK 22 tests/105 expectations는 lifetime·history·ownership·GlobalKey/render/binding·dependency·ParentData·key chain·geometry receiver·reentrant request·blur failure cleanup·RN pending focus를 검증한다. actual Chrome154.0.8037.98/Playwright1.63.0에서 DOM18 checks/page errors0 PASS, owned browser/server를 닫았다. SDK 전체 build·root/strict fixture/tool/external types와 실제 Dart201 selection 분석 PASS, 각 테스트 timeout20분이다.

**명시적 차이.** host pending focus의 live/canRequestFocus admission, descendant notification, same-View native ownership, idempotent/failing-blur cleanup과 immutable collection snapshot은 host adaptation이다. undefined no-focus와 string-union enum literals를 사용한다. runtime enum constructor/values/index/name·RawKeyEvent/onKey·highlight/application lifecycle·reading/ordered/directional traversal·edge policy·diagnostics/private helper identity는 미완료다. source geometry receiver는 shim이므로 geometry rows와 whole focus class/constructor는 partial이다. source key hardware ABI/full semantics engine 수락을 주장하지 않는다.

**채택·coverage.** Dart10 selections을 더해 C#24/Dart201이며 manual reviewed-port다. 옛 FocusScopeNode→FocusScope alias를 제거하고 source FocusScope를 canonical widget subpath에만 대응시켰다. 새93 reviews, 기존4078 review fields/selected destination subset과 기존30 evidence envelope를 모두 보존했다. 현재4171 reviews/4194 declaring+export source hash references, fresh regeneration74143 items deep equality·현재 hashes PASS다. 74143 records/47282 public/778 files/15 entrypoints/diagnostics0, missing69326/partial818/adapted3992/implemented7이다. evidence는 w6-focus-tree-20261012이며 이 집계를 전체 구현률로 읽지 않는다.

**설치 패키지·Hermes.** 새 consumer에 실제 core0.2.0+SDK0.4.0 tgz를 설치해 Node24.15.0에서 같은170 groups·22 tests/105 expectations PASS다. core111 direct emitted ESM imports/117 sources/117 declarations/436 relative .js declaration imports, SDK61 sources/61 declarations/72 relative imports, core609+SDK342 packed files의 source/dist/README/native/provider bytes·archive/lock integrity와 private constructor/readonly/string literal/required blur/internal/no-root export 타입 계약을 확인했다. SDK optional-peer 전체 모듈 runtime scan은 수행하지 않았다. core tgz SHA b730d9c86c0970698611da342597b62b63decd764adc1cde1d5b4a632dc2869b, integrity sha512-aED0nz3jWb823lTxdM+tUKMxD/wYKzTBeS3X2rarjeAhJHYVAewy2e+ZB+CB1qG/320VJVEPMSSxkSY1NNTlMg==, packed coverage SHA 023d081eccc2b53dfb6969a8bfd1732cb6b2ce60896ee4150fdfccc059ddfac2; SDK tgz SHA 3fc9db616b521999bd50a4f133412f03326725aacc30dad7d6d6a25a79088874, integrity sha512-zK4LtJ7VIpBWXO+zt+9W2TyxLZTIRxrMGvEC4sEK2sgCIfR9Ct747xYyMeH12oyGRSvdlooJSLfy9RODAn4qRQ==다. archive는 외부 receipt 채택 전 snapshot이다. Metro0.83.8/RN Babel0.83.10 Windows bundle과 실제 Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c source/optimized HBC99에서도 같은 결과 PASS다. SDK는 react-native source condition 대신 installed emitted interaction.js를 명시 사용했다. bundle SHA 5e623c8e4e1f611480708a0b754d6d5077b8a83012b2e600df558e1b248e7bc0, HBC SHA 3c307761d97739214599c74ce177dfc4131fd8275f58a1c8381de33f62594ee5다. stock Babel이 static block을 거부해 제품 factory 초기화를 ordinary static field로 보정했고 새 archive부터 다시 검증했다. Windows ESM audit의 file URL 보정과 이전 source/fixture 실패 log fingerprints를 보존했으며 기대값을 완화하지 않았다.

**후속 경계.** ABI1/wire5/supported1..5·supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47·compiled source146/consumer header3 SHA가 현재와 같다. 새 native compile/RNW/Android/GPU runtime은 없다. 다음은 Visibility/IndexedStack이며 retained layers·Path/filter·text/input/sliver/Material/Cupertino·최종 migration/qualification과 Windows Move editor right InvokePattern 문제도 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine notVerified, Apple/Linux native 사용자 지정 SKIPPED/provider notVerified를 유지한다. 전체 goal은 active다.

**정리 완료.** marked allowlist .tmp/work6/focus-tree의 2165 files/179 directories/676533553 bytes를 preview/-Execute의 동일 listing SHA 5d05a90a742ad46942c71aca332c4b92ec2177bb93bc7ad1bbb00d325e58bab7로 확인해 제거했다. workspace/ancestor/link/process 경계 PASS, links/process references=0이다. source oracle·fixtures·selection analysis/drafts·actual browser dependency·archives/isolated consumers·Metro/Hermes bundle·raw logs를 정리하고 pin/Dart SDK/native supplier cache를 보존했다. source/fixture/log fingerprints·cleanup receipt는 evidence에 남는다. 정리 후4171 reviews/4194 source hash references/current product hashes/compiled source146·consumer header3·unchanged Android blur source fingerprint PASS다. 전체 goal은 active다.

**작은 재현 입력.** 실제 FrameworkRoot 아래 FocusScope(node:s)에 Focus(childA,focusNode:a)·Focus(childB,focusNode:b)를 두고 a.requestFocus→microtask→b.requestFocus→microtask→b.unfocus(previouslyFocusedChild)를 실행하면 a가 primary가 된다. root.unfocus는 이를 바꾸지 않는다. 같은 scope 안에서 a를 ordinary parent 사이로 reparent해도 history가 유지된다. 실제 EditableText의 controller를 ABCDE/anchor4/focus1로 두고 ExcludeFocus를 false→true로 바꾸면 native blur·focusable:false·tabIndex-1, text/backward selection 보존을 확인한다. true→false는 자동 focus하지 않고 node.requestFocus 뒤에만 focus한다. ExcludeFocusTraversal에서는 skipTraversal=true/canRequestFocus=true로 explicit request를 허용한다. 원본170 groups의 입력 축과16 source spans는 evidence에 남아 있으며 raw oracle fixture는 정리했다.

일회성 정리 보조스크립트와 preview/result 파일도 명시적 plain-file allowlist로 preview/-Execute 후 제거했다. git diff --check PASS다.


### 2026-10-12 — Visibility 전체 box 정책·IndexedStack·Stack Clip4와 GlobalKey 예약 보정

**구현.** direct widgets/visibility·widgets/indexed-stack·rendering/indexed-stack과 internal shared visibility-scope를 추가해 public subpath114개다. Visibility의 maintainState/Animation/Size/Semantics/Interactivity/Focusability 6개 flag·생성자 의존 제약·maintain factory·실제 dependency 기반 of를 이식했다. 기본 숨김은 child를 replacement로 교체·해제하며 state 유지에서는 Offstage 최소 공간과 inherited ticker mute를 적용한다. size 유지에서는 opacity layer 없이 paint를 생략하고 semantics/pointer/focus를 개별 제어한다. maintain flag 구조 변경 시 State가 교체될 수 있다. of는 모든 visibility ancestor의 AND이며 false에서 source처럼 short circuit한다. host ancestor lookup은 receiver를 제외하므로 inherited element 자체에서 다음 ancestor를 찾는 adapter를 사용한다.

**IndexedStack·렌더.** 모든 child를 layout하고 최대 child sizing·intrinsics·State/active ticker를 보존하며 선택 child만 paint/hit/semantics/actual·dry baseline에 노출한다. null index는 아무 child도 노출하지 않고 focus도 전부 제외한다. shared visibility scope와 ExcludeFocus는 RenderObject를 추가하지 않아 Positioned StackParentData를 유지한다. widget index 범위는 원본처럼 null/유효 index/empty index0을 허용한다. direct renderer의 negative index는 원본 _childAtIndex처럼 첫 child를 선택하고 nonempty high index는 조회 때 거부한다. source directional alignment는 ambient Directionality 또는 explicit textDirection을 요구하며 explicit 값은 ambient dependency를 만들지 않는다. private element의 debug onstage 방문도 선택 child만 반환한다.

**Stack·GlobalKey 보정.** RenderStack의 protected paintStack 확장과 none/hardEdge/antiAlias/antiAliasWithSaveLayer를 연결했다. overflow인 경우 기존 wire 명령 clipRect/saveLayer로 실행하고 child paint가 실패해도 모든 scope를 restore한다. unselected child의 overflow도 source처럼 stack clip을 결정한다. 기존 GlobalKey reserve의 조기 중복 거부가 focus 알림과 함께 발생한 정상 같은-frame reorder를 막는 실제 회귀를 발견했다. 요청 부모들을 기록한 뒤 모든 rebuild가 끝난 실제 child ownership을 검증하도록 고쳤고 기존 retaken-parent 검사를 유지했다. 실제 State/render/focus attachment 이동과 진짜 duplicate-parent/sibling 거부를 함께 검증했다. source BuildOwner의 reserve/verify/remove 3개 raw spans는 SHA 확인·소스 검토이며 해당 진단 메서드 전체를 원본 oracle에서 실행한 것은 아니다.

**검증.** Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a의 8 unchanged classes와 RenderStack 원본 dry-baseline helper/paint 2 methods, 총10 raw UTF16 spans를 SHA 검증 후 Dart3.14.0-296.0.dev/assertions enabled에서 실행했다. 881 exact groups(visibility flags128/maintain2/index config432/ancestor lookup15/selected render296/private visibility render4/onstage4) PASS다. widgets/context/render/constraints/geometry/diagnostic/paint-layer는 narrow receiver shim이고 inherited RenderStack sizing/positioning은 shim이다. 원본 selected RenderIndexedStack body와 두 원본 Stack method 실행을 Flutter engine/layer 수락으로 확장하지 않는다. 별도 actual FrameworkRoot22 tests/200 expectations는 flag 조합·상태/실제 ticker/focus·replacement lifetime·GlobalKey/ParentData·RTL/explicit direction·selected baseline/cache·Clip4/실패 복원·실제 editor port blur와 ABCDE/backward selection 보존을 검증했다. DOM semantics는 data sink이며 실제 browser/native app 실행이 아니다. SDK 전체 build·root/strict fixture/tool/installed types·실제 Dart209 selection 분석 PASS, timeout20분이다. 원본 private initializing formal의 public index 인수명, 빈 initial semantics binding, 기존 undefined GlobalKey 해제 표현과 implicit constructor token audit의 fixture 보정을 기록했고 원본 기대값/정밀도를 완화하지 않았다.

**채택.** Dart8 selections 추가로 C#24/Dart209, manual reviewed-port다. private shared scope는 실제 internal compiled declaration과 public Visibility anchor 두 source hash를 추적하고 public export로 만들지 않았다. 새75 reviews, 변경 파일을 참조한 기존360 rows/361 references의 선언·anchor token은 전부 동일함을 확인해 selected destination subset을 보존하며 hash를 갱신했다. 나머지3811 review fields와 이전31 evidence envelope는 동일하게 보존했다. 현재4246 reviews/4275 declaring+export source hash references, fresh regeneration74143 items deep equality·현재 hashes PASS다. ledger74143 records/47282 public/778 files/15 entrypoints/diagnostics0, missing69261/partial828/adapted4047/implemented7이며 evidence는 w6-visibility-20261012다. 전체 구현률로 단순 해석하지 않는다.

**설치·Hermes.** fresh installed emitted core0.2.0/Node24.15.0·Metro0.83.8/RN Babel0.83.10 Windows bundle·실제 Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c source/optimized HBC99에서 동일881 groups·22 tests/200 expectations PASS다. 114 direct ESM imports/121 source files/121 declarations/454 relative .js declaration imports와 전체629 packed source/dist/README/license/upstream bytes·lock integrity·readonly/private/internal/no-root export 타입 계약을 확인했다. core tgz SHA aaa384671bb393d7d3c15ee3c8f7c6b7d2ae8895519eb84f379672fe8fa3d3ef, integrity sha512-vjPo+Ioj/YxCAD/KXS9TWe/4PGDjrm+Jd2CFKIzyE3fDFwng3CimnzcgEmMsLKO056WyHVN3SH2A2+NhE2373w==, packed coverage SHA 605c927cbff7d1d8e59f1ae474114ac98f580f03c123153f6ad7bde3c7783fc4다. archive는 외부 runtime receipt 채택 전 snapshot이다. bundle SHA a8c062c38ba5e47abedd11c2f227c772ad107ee2adb478614160e8a2fdf60faa, HBC SHA a346353473d0fe1f993a1669fd1c724aad37f8d276e19aaf4a00755e12ee6691다. oracle assertion adapter만 사용하며 SDK optional-peer runtime/RNW/Android/native input/GPU 실행은 없다.

**남은 경계.** SliverVisibility는 real sliver protocol 선행 작업과 함께 미완료다. diagnostics·retained ClipRectLayer reuse/release·full semantics engine과 native editor overlay 시각적 hide/clip은 미완료이며 해당 class/메서드/생성자 partial을 유지한다. private _IndexedStackElement는 source의 covariant getter/생성자 대신 host Widget slot을 사용하고 private _Visibility는 source와 달리 child를 요구하므로 해당 rows도 partial이다. source base RenderStack의 기록된 제한은 계속 유지한다. ABI1/wire5/supported1..5·supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47·compiled source146/consumer header3 hashes가 현재와 일치한다. 새 native compile/runtime은 없다. 나머지 W6 Path/layer/text/input/sliver/Material/Cupertino·최종 migration/qualification·Windows Move editor right InvokePattern 문제가 남는다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine notVerified, Apple/Linux native 사용자 지정 SKIPPED/provider notVerified를 유지한다. 전체 goal은 active다.

**정리 완료.** marked allowlist .tmp/work6/visibility의 722 files/44 directories/403846002 bytes를 preview/-Execute의 동일 listing SHA 55ab7614462a58f612d98a0ac9ab5676ba95f997c51c95b32b8ed1632744a132로 확인해 제거했다. workspace/ancestor/link/process 경계 PASS, links/process references=0이다. 원본 oracle·fixtures·analysis/drafts·archives/isolated consumer·Metro/Hermes bundle·raw logs를 정리하고 pin/Dart SDK/native supplier cache를 보존했다. source/fixture/log fingerprints·cleanup receipt는 evidence에 남는다. 정리 후4246 reviews/4275 source hash references/current product hashes/compiled source146·consumer header3 PASS다. 전체 goal은 active다.

**작은 재현 입력.** Directionality(ltr) 안의 IndexedStack에 Positioned(LeafA,left7,top9,width10,height12)와 LeafB를 두고 index0→1→null로 바꾼다. 두 State/render를 유지하며 각 index의 paint/hit/semantics만 나타나고 hidden focus는 제외된다. GlobalKey를 준 LeafA를 children의 다른 위치로 같은 frame에 옮겨도 State/render identity가 유지되어야 하며 동시에 두 부모가 같은 key를 요구하면 frame finalization에서 오류가 난다. Column 안의 Visibility(child,{maintainState:true})를 visible true→false로 바꾸면 State/render는 유지하고 wrapper 높이는0, 실제 State ticker는 mute된다. maintainAnimation=true이면 ticker가 계속 진행한다. Visibility.maintain은 숨겨도 size/semantics/interactivity/focus를 유지하면서 paint/saveLayer를 만들지 않는다. 원본881 groups의 입력 축·10 실행 spans와3 source-review-only spans는 evidence에 남으며 raw oracle fixture는 정리했다.

일회성 정리 보조스크립트와 preview/result 파일도 plain-file allowlist로 preview/-Execute 후 제거했다. git diff --check PASS다.

### 2026-10-12 — 실제 layout-time builder·격리 BuildScope·parent OrientationBuilder

**구현.** direct modules `framework/rendering/layout-callback`, `framework/widgets/layout-builder`, `framework/widgets/orientation-builder`를 추가했다. BuildOwner는 Element의 BuildScope별 dirty queue를 기록·이동하고 일반 root build는 default scope만 flush한다. BuildScope의 stable depth heap은 flush 도중 새로 dirty가 된 하위 Element도 현재 depth 순으로 처리한다. 실제 LayoutBuilder Element는 자기 scope와 stable callback을 유지하며 constraints 값 변경·updateShouldRebuild가 허용한 config 변경·inherited dependency 알림 때 layout 단계에서 child를 재구성한다. 하위 State만 dirty이면 builder 재호출 없이 그 scope만 flush한다. idle/post-frame 알림은 다음 transient까지 markNeedsLayout을 미루고 해제 때 예약을 취소한다. ancestor가 layout을 생략해도 별도 callback queue가 마지막 constraints로 갱신한다.

**렌더·generic 경계.** RenderObject.invokeLayoutCallback은 붙어 있는 노드의 performLayout 안에서만 자기 하위 트리 또는 같은 PipelineOwner의 다른 dirty 하위 트리 변경을 임시 허용한다. nested/query/paint/다른 View 변경은 거부하고 실패 때 권한을 복원한다. callback 내부 child 변경은 현재 layout에서 소비해 callback root를 반복 dirty로 만들지 않는다. detach/owner close는 두 layout queue를 정리한다. RenderObjectWithLayoutCallbackMixin(Base)와 RenderAbstractLayoutBuilderMixin<Info,Child>()(Base)는 실제 class factory로 base constructor tuple·box/non-box protocol을 유지한다. 실제 non-box Constraints/Widget 경로를 검증했으며 가짜 RenderSliver를 추가하지 않았다. fresh constraints가 previous.equals가 아니라 자기 equals로 비교되어 non-box 값 동등성도 적용된다. LayoutBuilder는 child actual baseline/hit/paint/semantics를 전달한다. OrientationBuilder는 parent maxWidth > maxHeight를 사용하며 square/양축 infinity는 portrait다.

**발견·수정.** 하위 Builder의 build 예외를 추가하자 callback/BuildOwner는 해제되지만 실패한 child가 clean 상태로 유실되어 다음 layout에 갱신되지 않는 실제 회귀가 드러났다. Element.rebuild가 실패한 active Element를 dirty scope에 남겨 명시적인 다음 frame 복구가 가능하도록 고쳤다. builder 자체 오류와 child build 오류를 모두 복구 검증했다. 원본 ErrorWidget 대체와 진단 catch-and-continue는 아직 구현하지 않았으므로 이 host 오류 전파·재시도 정책을 source 동일 동작으로 기록하지 않는다.

**원본 비교·host.** Flutter pin71e4717a61786faab4c7aa39825989305ed29e8a에서 BuildScope·layout 관련6 classes·2 mixins·RenderObject.invokeLayoutCallback·private exception helper 총11 raw UTF16 declaration spans를 SHA 검증 후 수정 없이 Dart3.14.0-296.0.dev/assertions enabled로 실행했다. 106 exact groups는 geometry36/orientation25/update16/dependency4/deferred10/scope8/intrinsic6/callback1이다. widget/Element/render/geometry/diagnostic/scheduler는 좁은 receiver shim이며 scope queue8 cases도 explicit Element receiver다. source ErrorWidget/profile/debugCheckingIntrinsics bypass는 oracle 수락 범위에서 제외한다. 별도 actual FrameworkRoot22 tests/83 expectations는 실제 layout phase·소유 BuildOwner·State/config/dependency·중첩 scope·ancestor skip·GlobalKey/State/render/ticker/editor focus/backward selection 유지·오류 복구·non-box Widget·baseline/hit/paint/semantics·해제와 예약 취소를 검증했다. semantics는 recording sink이며 native reader 증거가 아니다. SDK 전체 build·root types·strict fixture·tool types·installed consumer contracts PASS, 모든 test process timeout은20분이다.

**coverage 채택.** Dart9 selections를 추가해 C#24/Dart218이다. compiler는 private Element/render를 public LayoutBuilder anchor 아래에서 찾고 public Dart mixin의 실제 nested runtime class를 명시된 exported factory 안에서만 식별한다. interface/동명 overlay helper를 구현으로 채택하지 않는다. 기존147 rows/148 references는 AST token과 선택 destination subset을 검토해 rebind했다. 그중 BuildOwner whole class와 inherited RenderTable.detach의 두 변경 선언은 별도 의미 검토·partial을 유지하며 나머지 선택 선언은 token 동일하다. 나머지4099 review fields·이전32 envelopes는 동일하게 보존했다. 새63 reviews로4309 reviews/4353 declaring+export hash references이며 fresh regeneration74143 items/33 evidence deep equality·현재 hashes PASS다. ledger74143 records/47282 public/778 files/15 entrypoints/diagnostics0, missing69193/partial855/adapted4088/implemented7이다. evidence는 `w6-layout-builder-20261012`이며 전체 구현률을 의미하지 않는다.

**설치·Hermes.** 새 core0.2.0 tgz를 isolated consumer에 설치해 Node24.15.0에서 같은106 groups·22 tests/83 expectations와117 direct ESM imports를 통과했다.124 sources/124 declarations/464 relative .js declaration imports·전체644 packed source/dist/README/license/upstream bytes·lock integrity·readonly/private/no-root export·generic base constructor 인수 보존 계약 PASS다. type-only harness의 추상 receiver paint/semantics와 inline import type 경로를 보정했고 이미 bundle한 네 JS fixture의 bytes가 그대로임을 확인했다. archive SHA0e247fdb5814b188b3918d95059831a0af1d9a1dbc1fb950313e42fe62c991d2, integrity sha512-sTFBtMAsUlVcL+GH4/WW6pWuzWQprHR8yyOW9nxR9lWhNsmSNgbgql+da6tEsCt0tx+omVEz5szf2p85CSUkWg==, packed coverage SHA194d6d65159b9da002996eaadaf3bb4fc0b979cab37fe4e3f8a0947c3ab8f601이다. archive는 외부 실행 receipt 채택 전 snapshot이다. Metro0.83.8/RN Babel0.83.10의 Windows bundle을 실제 Windows Hermes1.0.0/revision94aa5e1d40a4ce99df79d951cbe45310ec40680c에서 source·optimized HBC99로 각각 실행해106 exact groups·22 tests/83 expectations PASS다. bundle SHA14fae633e55d8715cbdf12846a105964ba62cee4d8148628a52a56364ce964d4, HBC SHA91f3bf665d8c072dbe9db6b4a026308b79d3951a3770a53e8fd46855404a49e2다. SDK optional runtime/native app/GPU 실행은 이 묶음 증거에 포함되지 않는다.

**남은 경계·다음 작업.** 원본 ErrorWidget 대체·full diagnostics/profile·debug intrinsic 검사/release zero-or-null 결과는 미완료다. host는 speculative intrinsic/dry 조회를 모든 build에서 거부하고 예외를 전파하며 explicit recovery를 제공한다. generic runtime reification/ABI를 주장하지 않는다. DeviceOrientationBuilder·real sliver protocol/SliverLayoutBuilder와 text/image/gesture/scroll/app-system/Material/Cupertino 및 전체 W6 작업은 계속 남는다. W6-04 family 전체 checkbox와 전체 goal은 완료 처리하지 않았다. ABI1/wire5/supported1..5와 supplier w6-rounded-3e2a13223120d3ca/SHA3e2a13223120d3cac4d81bb3870513856ff2c46e2d79fefd128307ca553e5b47의 compiled source146/consumer header3 hashes를 재확인했다. 새 native compile/runtime는 없으며 Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/clean-machine notVerified, Apple/Linux native 사용자 SKIPPED/provider notVerified다.

**작은 재현 입력.** Align 안의 SizedBox(70,30,LayoutBuilder(...))에서 builder는 실제70×30 constraints와 layout phase/BuildOwner.building=true를 본다. 동일 widget과 constraints로 다음 frame을 실행하면 builder 호출은 늘지 않는다. 하위 State만 setState하면 idle 중 render geometry는 clean이고 다음 transient→layout에서 child만 rebuild한다. parent width를40으로 바꾸면 동일 State/render/ticker를 보존하며 builder가 새 constraints로 호출된다. 다른 View의 live render를 그 callback 안에서 변경하거나 callback을 nested로 실행하면 거부한다. builder/하위 build가 실패한 뒤 원인을 고치고 frame을 다시 요청하면 scope 상태를 복구한다.

**정리 표식.** 완료한 scratch `.tmp/work6/layout-builder`만 marked allowlist로 preview/-Execute 정리한다. Flutter pin/Dart SDK·모든 native supplier caches는 보존한다. 실행 결과·listing fingerprint·정리 후 hash 검증은 아래 기록과 evidence에 남긴다.

**정리 완료.** marked allowlist `.tmp/work6/layout-builder`의764 files/43 directories/485548523 bytes를 preview/-Execute의 동일 listing SHA821bfd170c5171e9d2db8052b637212aa8b6a2e15f0b964f8dd802ad1b304db6로 확인해 제거했다. workspace/ancestor/link/process 경계 PASS, links/process references=0이다. 초기 preview의 PowerShell Split-Path parameter-set 오류는 삭제 전에 중단됐고 .NET parent 경로 조회로 수정한 뒤 preview/execute를 수행했다. 원본 oracle·fixtures·selection analysis/coverage drafts·archive/isolated consumer·Metro/Hermes bundles·raw logs를 정리하고 Flutter pin/Dart SDK·모든 native supplier caches를 보존했다. source/fixture/log fingerprints·cleanup receipt는 ledger evidence에 남는다. 정리 후4309 reviews/4353 source hash references/current product hashes·이전32 envelopes·compiled source146/consumer header3 PASS다. 일회성 helpers/preview/result 네 plain files도 별도 preview/-Execute의 동일 listing SHA81ce87eaa8644ccaf8b5036719fdead8730fd8dd13304b22a0007c7f552ecc07로 제거했다. git diff --check PASS이며 전체 goal은 active다.

### 2026-10-12 — 오류 보고·ErrorWidget·앱 기본 font 선정 범위

**구현.** direct foundation/diagnostics·assertions·stack-frame·binding과 framework/rendering/error-box를 추가했다. ErrorWidget은 원본처럼 framework 모듈에 실제 LeafRenderObjectWidget으로 구현해 ESM 기반 class 초기화 순환을 피했다. ComponentElement를 Stateless/Stateful/Proxy의 실제 기반으로 연결해 build/child render 생성 실패의 original exception/stack을 먼저 보고하고 ErrorWidget.builder로 대체한다. BuildScope는 render update 오류를 보고한 뒤 다른 dirty Element를 처리하고 LayoutBuilder는 두 catch/finally 경로에서 error child·needsBuild·constraints cache를 정리한다. global FlutterError.onError 이후 해당 View observer에 같은 details를 전달한다. 명시적으로 던지는 reporter는 frame을 중단할 수 있고 build flags를 복원한다. scheduler 기본 callback은 structured report 후 다른 callback을 처리한다.

**listen 초기화 구분.** listen1.0.1의 원래 기본 onError는 stack을 보존해 재던진다. notifier를 그 원본 기본값으로 유지하고 foundation/binding의 initializeFoundationBindings를 실제 FrameworkRoot 생성에서 한 번 실행한다. 원본 BindingBase._initListenable처럼 listener는 foundation context의 FlutterErrorDetails로 보고하고 assertion은 FlutterError로 던진다. 기존 FlutterError의 identity와 이후 custom hook을 보존한다. BindingBase class를 만들어 낸 것으로 기록하지 않는다. 실제 standalone/초기화/중복초기화/custom hook/연속 listener 검증은10 expectations다.

**emergency render·font.** RenderErrorBox는 finite100000 fallback·parent sizing·max intrinsics·hitTestSelf·source padding 경계와 배경을 제공한다. base RenderBox의 protected self-hit hook은 기존 pointer/semantics 기본 동작을 보존한다. TextPainter 없이 low-level TextLayoutService로 paragraph를 만들며 교체/해제 때 producer를 반환하고 취득한 frame lease는 유지한다. 2차 text/paint 오류를 억제한다. ViewServices.defaultFont(ResourceId), WidgetApplicationOptions.defaultFont(asset id 또는 ResourceId)를 연결했다. Text는 explicit font/fontId 또는 app default를 사용하고 core의 sample-font 암묵 조회를 제거했다. sample/template은 자기 bundled asset을 명시한다.

**version·provider·template.** core0.3.0 /SDK0.5.0, provider coreRange >=0.3.0 <0.4.0, SDK validator·6개 generated descriptor/schema·CLI 생성 기본값·6개 template runner manifests·root lock을 맞췄다. schema에 남아 있던 wire4 상수는 registry의 실제 wire5와 일치하도록 수정했고 native ABI1/wires1..5는 바꾸지 않았다. 생성한6 target 코드/package 구성과 validator의 옛 SDK/wire 거부를 확인했다. Apple/Linux target native 검증은 사용자 지정 SKIPPED다. sample은 실제 local tgz 공급을 갱신했다. Android node_modules의 실제0.2/0.4와 숨은 npm lock의0.3/0.5 기록 불일치는 plain cache 파일 하나를 경로/hash/ancestor 검사·preview/Execute로 제거하고 실제 재설치해 수정했다. 타입 alias로 오류를 숨기지 않았다. 추가로 공급 CLI는 lock-only 작업 전 실제 설치 hidden lock을 보존/복원한다. cache 제거만으로는 같은 version archive 교체를 감지하지 못하는 npm 동작도 실제5 package fixture로 확인했고 원래 설치 archive identity를 보존해 다음 npm install이 모두 교체하도록 수정했다. 이미 불일치한 sample cache는 actual installed files와 기존 공급 archive 전체 byte 대조로 복구한 뒤 최종 설치를 검증했다.

**원본·host 검증.** pin71e4717a61786faab4c7aa39825989305ed29e8a와 listen1.0.1의 raw UTF16 span/full-file hash를 확인했다. Dart3.14.0-296.0.dev의 별도 debug/assertions 및 release 프로세스에서 원본 StackFrame·PartialStackFrame·StackFilter·RepetitiveStackFrameFilter·defaultStackFilter 102 groups/5 spans, 오류/diagnostic/error-widget/component/layout/binding 138 groups/20 spans, RenderErrorBox와 두 상수72 groups/3 spans, 총312 groups PASS다. 반복 사용을 포함한28 spans/24 unique identities이며 source 원문을 수정하지 않았다. 좁은 diagnostics/tree/Element/widget/render/ui paragraph receivers는 Flutter engine·전체 tree style/profile·font-family/native pixels 수락이 아니다. preparation을 재확인한9 oracle/case/span 파일 byte hash가 동일했다. actual FrameworkRoot21 tests/138 expectations는 오류 대체와 복구·State/child 수명·dirty queue·fatal reporter 정리·Global/View 보고·명시적 font·padding·producer/frame lease·2차 실패/retry·diagnostic/stack 정책을 검증했다.

**도구·채택.** reviewed Dart class-member selection을 exact inventory ID/hash로 허용하고 _initListenable은 실제 standalone-function으로 대응했다. _ErrorDiagnostic/_FlutterErrorDetailsNode는 실제 private class를 public anchor로 식별하고 StackFrame ==는 equals로 대응했다. Diagnosticable interface를 runtime mixin으로 채택하지 않았다. C#24/Dart244 reviewed selections다. 기존4309 reviews 중269 rows/279 declaring+export refs의 소스 hash 변경을 saved AST tokens로 재검토했다. 실제 token 변경은 RenderBox.hitTest·BuildOwner·BuildScope/_flushDirtyElements·Element.rebuild·_LayoutBuilderElement/_rebuildWithConstraints 7선언이다. 이전 목적지 subset과33 evidence envelopes를 보존했고 새224 reviews를 더했다. 현재4533 reviews/4579 source refs,74143 records/47282 public/778 files/15 entrypoints/diagnostics0, missing68950/partial916/adapted4270/implemented7이다. fresh compiler regeneration의 전체 items/evidence deep equality PASS이며 이 집계는 전체 구현률이 아니다. 증거 key는 w6-error-reporting-20261012다.

**외부 소비·Hermes.** real fresh consumer에 core0.3.0 /SDK0.5.0 archive를 설치해 양쪽 src/dist bytes, core122 direct ESM·129 source/declaration files·484 relative .js declaration imports, actual lock/readonly/private/abstract/protected/named-factory/defaultFont contracts와 SDK provider를 확인했다. installed Node strict 비교, Metro0.83.8/RN Babel0.83.10, actual Windows Hermes의 source 및 -O optimized HBC99가 모두 동일312 groups·actual21 tests/138 expectations·binding10 expectations PASS다. SDK build·root/fixture/tool/CLI/external types와 Dart244 selection 분석 PASS다. 각 test process timeout은20분이며 초기 실패 logs를 보존했다. Archive coverage는 packing 시점 snapshot이고 이후 같은 새 envelope의 최종 receipt metadata가 보강되므로 자기 참조 archive hash를 주장하지 않는다.

**남은 경계.** whole diagnostic tree styles/TextTreeRenderer·inspector serialization·debug/profile/release suppression, source font-family/weight/system-font/전체 text, retained engine/layer·native AssertionError/VM stack/hash ABI는 미완료다. 오류 console sink는 host injectable adapter이고 conditional IO/Web backend class는 채택하지 않았다. 현재 native supplier146 compiled-source/3 consumer-header hash 일치와 ABI1/wire5를 재확인했으며 새 native compile/app/GPU 실행은 없다. Windows/Android/Web physical input/IME/reader/performance/scanout/recovery/signing/deployment/clean-machine notVerified, Apple/Linux native 사용자 SKIPPED/provider notVerified다. 전체 work6 goal은 active다.

**최종 공급·정리.** source/version/coverage/외부/Hermes 검증 후6개 sample target의 concrete archive identity/manifest/lock을 대조했다. 실제 Android JS 설치2526 files는 각각 공급 archive와 모든 bytes가 일치하며 sample types PASS다. 플랫폼 native build/run 수락으로 집계하지 않는다. 최종 compiler regeneration의 전체 items/evidence·이전33 envelopes·4533 reviews/4579 source hashes PASS다. marked scratch .tmp/work6/error-reporting의2375 files/458 directories/712655676 bytes를 preview/-Execute 동일 listing SHA BF83FC9BA1D75635FFEBF1F9ABBD4261E2CE538F0972F2C6A97029FF11DBFA7B로 제거했다. root/ancestor/reparse/process 경계 PASS, links/process references=0이다. source/fixture/log/Metro/Hermes/archived package fingerprints와 실패/수정 이력은 ledger evidence에 보존했다. Flutter pin/Dart SDK·모든 native supplier caches를 보존했으며 전체 goal은 active다.

정리 후 product/source4533 reviews/4579 refs·이전33 envelopes·native146 source/3 headers hash PASS, git diff --check PASS다. 일회성 helper/preview/result/postcheck 네 plain files도 별도 preview/Execute의 동일 byte/hash 검사를 거쳐 제거했다.


### 2026-10-12 — 진행 중: diagnostics tree·serialization·mode

source tree renderer·prefixed wrapping builder와10개 TextTreeConfiguration을 foundation/diagnostics-text에, default serialization delegate를 foundation/diagnostics-serialization에 구현했다. DiagnosticsNode의12 style·prefix/empty/uppercase/error footer·source truncation 경계·timeline·delegate recursive JSON/FIFO iterative JSON 경로를 연결했다. literal __proto__/constructor property names를 보존한다. foundation/constants의 FoundationBuildMode는 debug/profile/release를 명시하고 default release이며 FlutterError.debugMode와 공유한다. builder.add·DiagnosticableNode builder/cache/description/style은 source assertion/mode gates를 따른다. FlutterError는 release summary와 profile/debug의 non-wrapping detailed renderer를 구분한다. DiagnosticsProperty/StringProperty JSON metadata와 known String/void label을 제공하며 erased generic typeName은 explicit host adapter다.

원본 Flutter pin의 diagnostics/assertions/StackFrame 본문과 objectRuntimeType/debugFormatDouble 함수를 수정하지 않고 실행했다.67 top-level span과 full diagnostics body hash56f24a591ce10dfe40eb20e35b598bcb80122a8c10872ea58564e6d0f7c79335를 확인했다.80 cases×3 separate debug/assertions·profile·release processes=240 groups PASS이며 3000-deep iterative tree·특수 timeline key·real FlutterError profile/debug/release long text/details를 포함한다. imports/mode flags/annotations/clampDouble/console sink와 fixture node/delegate는 narrow receivers다. 원본 전체 class compile을 미실행 method/API 수락으로 확장하지 않는다. workspace dist ESM3 entry orders와12 host assertions(이전2 log의13은 집계 metadata 오류, 현재 emitted-serialization.log에12로 정정) PASS다. SDK/current core build·root/strict fixture types·diff check PASS, 각 test process timeout20분이다. 실제 설치/Metro/Hermes/native proof는 새로 수행하지 않았다.

**남은 작업:** Message/numeric/flag/iterable/enum/object flag/summary property families, 실제 Diagnosticable/Tree/TreeMixin runtime 구현, profile timeline의 source FlutterError identity(현재 generic host Error text adaptation), tool mappings/selection·기존 hash token 재검토·coverage 채택, shared mode/default serialization/nullable builder version-provider-CLI-template migration과 fresh external/Metro/Hermes·최종 sample archive 검증이다. 현재 ledger는 직전4533 reviews/4579 refs·34 envelopes의 불변 baseline이며 공통 source hash 변경 상태다. native supplier146 compiled-source/3 header hashes는 일치하고 ABI1/wire5는 유지한다. Windows/Android/Web 물리 수락 notVerified, Apple/Linux native 사용자 SKIPPED/provider notVerified다. scratch는 이 묶음 완료까지 KEEP한다.


### 2026-10-12 — 진행 중: diagnostic property·runtime mixin·오류 class 이행

MessageProperty와 _NumProperty/DoubleProperty/IntProperty/PercentProperty, FlagProperty, IterableProperty, EnumProperty, ObjectFlagProperty/has, FlagsSummary를 direct foundation/diagnostic-properties에 구현했다. foundation/debug는 explicit doublePrecision·음수0/NaN/무한대/precision formatting과 collection diagnostic delimiters를 제공한다. typed DoubleProperty.lazyNumber는 원본 lazy named constructor adapter다. IntProperty는 JS safe integer domain을 명시적으로 admission하며 Map/value와 iterable input을 빌려 live owner 변경을 보존한다. null/undefined callback failure도 원래 값을 유지하며 error로 보고한다. source Dart throw-null의 native TypeError wrapper와 JS null payload 차이는 명시적·제한적 정규화이며 실패를 성공으로 처리하지 않는다.

Diagnosticable/DiagnosticableTreeMixin은 실제 typed class factory이고 constructor tuples·readonly owner fields·base method override 순서를 보존한다. DiagnosticableTree/DiagnosticableTreeNode, shortHash/describeIdentity/describeEnum/objectRuntimeType도 연결했다. supplied hashCode low20 bits는 유지하고 미지정 object identity는 WeakMap 기반 host policy다. reified Dart generic/type/hash ABI를 주장하지 않는다.

오류 경로의 순환을 피하면서 profile에서도 실제 FlutterError identity를 제공하도록 canonical declarations를 옮겼다. FlutterError/dumper/debugPrintStack/stack policy classes는 foundation/flutter-error, ErrorSummary/Description/Hint/Spacer와 private _ErrorDiagnostic은 foundation/diagnostics, details/DiagnosticsStackTrace는 foundation/assertions에 남는다. compatibility re-export barrel은 만들지 않았다. TypeScript AST로 기존 import와 inline import types를 분리·수정했고 selection stable IDs/pin은 유지하며 목적지를 갱신했다. 현재 개발 package는0.3/0.5지만 **core0.4/SDK0.6·provider/schema·CLI/template/lock·concrete supply 이행 전 release 수락은 PENDING**이다.

원본 diagnostics/assertions/StackFrame 전체 본문과 objectRuntimeType/debugFormatDouble/clampDouble 원문을 hash 확인 후 별도 debug/assertions·profile·release에서 실행했다.68 top-level spans,174 cases×3=522 groups PASS다. property79 cases·mixin/identity13·profile error identity와 borrowed-list/truncation mutation을 포함하며 원본 method는 수정하지 않았다. generic type suffix 및 정확히 확인한 VM null-throw wrapper만 정규화한다. source whole-class compile은 미실행 API 수락이 아니다. private default serialization factory도 실제 _DefaultDiagnosticsSerializationDelegate를 생성하며, caller list와 delegate 반환 list의 source mutation을 보존한다.

새 emitted ESM은 diagnostics/flutter-error/assertions 각각의 첫 import 순서에서522 groups/12 host expectations PASS다. 실제 FrameworkRoot의 error child 대체·State 복구·global/View details identity·3 mode 배경36 expectations(3 tests)와 별도 live collections/safe-int/null-undefined/profile identity19 host checks PASS다. service receivers를 사용한 공통 framework 실행이며 native UI 검증이 아니다. SDK 및 최신 core ESM/declarations build·root/strict fixture/tool types PASS다. 테스트 timeout20분, 실패 logs와 모듈 이행 전 source snapshots를 보존했다.

Compiler는 실제 nested mixin class/private numeric/prefixed builder/default delegate class를 public anchor로 찾고 DoubleProperty.lazy를 lazyNumber로 대응한다. 새 code의 coverage draft는 채택 전 후보일 뿐이다. Widget/Element/State/RenderObject에는 아직 diagnostic inheritance/owner child/property 연결이 없어 이를 다음에 구현한다. 그 뒤 private/global-member mappings·Dart selections·기존 AST/hash/module migration 재검토와34 evidence 보존, 실제 외부 설치/Metro/Windows Hermes source/HBC99·최종 sample archives를 검증한다. 전체 goal은 active, scratch는 KEEP이다.


### 2026-10-12 — 선정 diagnostics 상속·버전·coverage·실제 engine 연결

Widget/Element는 실제 DiagnosticableTree, State는 Diagnosticable factory, RenderObject는 DiagnosticableTreeMixin을 상속한다. Widget type/key·dense style, Element 실제 child/dependency/dirty·defunct/stateful JSON, State created/initialized/ready/defunct와 owner 정보, RenderObject 실제 constraints/parentData·relayout/layout/disposed 및 RenderBox size를 연결했다. ErrorWidget은 base 진단 설정을 호출한다. FrameworkRoot.describeTree의 기존 host 출력은 유지한다. 공통 render container의 numbered child labels와 State dispose configuration clearing은 명시적 host 차이이며 paint/compositing/layer/creator/semantics 진단은 값을 꾸미지 않고 PARTIAL로 남는다.

추가 actual FrameworkRoot3 modes90 expectations와 기존 error replacement/recovery36 expectations PASS다. 원본 unchanged3 units+3 functions의175 cases×3=525 groups 및68 top-level spans를 확인했다. private details builder의 debug-only gate·copy-on-getter까지 포함한다. default serialization factory와 caller/delegate list 소유권을 원본에 맞췄다. 새로 설치한 core0.4.0/SDK0.6.0의 ESM/declarations와 Metro0.83.8/Babel0.83.10·실제 Windows Hermes source 및 optimized HBC99에서도 동일525 groups/126 actual framework expectations PASS다. native UI/GPU 검증은 아니다.

canonical error declarations 이동에 맞춰 core/SDK version·dependencies·provider range(>=0.4.0 <0.5.0)·schema·CLI defaults·6개 template·root lock을 이행했다. compiler는 private _ElementDiagnosticableTreeNode와 실제 class factory, global/static build-mode·precision adapter를 확인한다. inherited generic _NumProperty.lazy는 숫자 constructor로 잘못 집계하지 않으며 DoubleProperty.lazyNumber만 대응한다. Dart284 manual selections(+40)과 C#24 selections를 유지한다.

coverage4743 reviewed rows/4801 declaring+export refs·35 envelopes를 채택했다. 이전34 envelope는 deep-equal 보존했고 기존4533 reviews의4539 selected destinations/4579 refs를 canonical module 이동을 포함해 모두 유지했다. 원본 snapshot이 없는50 render references는 이번 추가의 역 AST 편집으로 이전 whole-file SHA256과 정확히 일치하는 bytes를 복구한 뒤 검토했다. 변경된 파일의 선언 token268개는 동일,64개는 명시적 재검토이며 snapshot 누락0이다. 새 AST match 전체를 기존 selection에 자동으로 추가하지 않았다.

검증 중 Node strip-only의 parameter property 제한은 source fixture를 Bun으로 실행하고 설치 검증은 compiler emitted JS로 처리했다. 초기 Metro fixture가 JSON의 __proto__ key를 JS object literal로 읽은 오류는 JSON.parse로 보정했으며 제품 정규화는 추가하지 않았다. root types의 기존 Android core0.3 설치본 불일치는 새 archive 설치 후 PASS로 회복했다. 실패 log는 보존하고 모든 test process timeout은20분이다. 전체 W6 goal은 ACTIVE이며 Render/layer/text/sliver/input/semantics/Material/Cupertino·플랫폼 수락 등 미완료 범위는 유지한다. Apple/Linux native 사용자 SKIPPED/provider notVerified, 기타 물리 수락 notVerified다.

최종 공급 receipt:6개 archive의2582 files가 workspace bytes와 일치하고 실제 Android5 packages2571 files·fresh external core/SDK1056 files는 목록·내용까지 일치했다. 최종 외부 실행525 groups/126 framework expectations도 PASS다. root/sample types·CLI types·131 direct subpaths/138 declarations/502 relative .js imports·coverage 재생성의4743 reviewed destination/evidence 보존도 PASS다. `.tmp/work6/diagnostics-tree/checkpoint.json`과 `resume-progress.md`, current35-envelope baseline/qualified-source snapshots를 보존한다. 남은 diagnostics33 missing/partial은 실제 source helper/runtime 및 명시적 TS adapter로 계속 닫으며 전체 W6 완료로 판정하지 않는다.


### 2026-10-12 — diagnostics 잔여 source helper·타입·lazy/FIFO 대응

ComputePropertyValueCallback<T>와 실제 immutable _NoDefaultValue singleton을 추가했다. marker는 원본처럼 object이며 diagnostic 문자열도 원본 marker 표현을 보존한다. 기존 unique Symbol API에서 바뀌므로 core0.5.0/SDK0.7.0·의존 package·provider range >=0.5.0 <0.6.0·schema·CLI defaults·6개 template·root lock을 함께 이행했다. Numeric base는 자기 protected initializeLazy adapter를 실제 DoubleProperty.lazyNumber에서 호출하며 constructor의 options/unit 초기화와 lazy callback 설정을 나눈다. inherited generic DiagnosticsProperty.lazy를 숫자 constructor로 잘못 집계하지 않는다.

실제 _addTooltip/_maybeCacheValue helper와 callback/cache/value/private block/render field 대응, private wrapping state union/_isSingleLine, JSON/queue type aliases를 연결했다. 원본은 no-default marker의 isInteresting에서 value를 읽지 않는데 기존 구현이 callback을 먼저 실행하던 차이를 고쳤다. callback 참조를 원본처럼 유지하고 iterative FIFO는 소비한 참조를 지우고 prefix를 amortized compaction한 뒤 비운다. source/helper/retention/numeric-base14 cases를 더해189 cases×3 separate Dart modes=567 groups PASS다. 원본3 units+3 functions/68 spans는 그대로이며3000-deep/3301-node 순서 및 private queue drain까지 비교했다. 실제 FrameworkRoot36 error+90 diagnostic expectations와 emitted3 first-import orders/12 host checks도 PASS다.

Dart compiler는 DiagnosticLevel/DiagnosticsTreeStyle/_WordWrapParseMode constructor 호출3개를 모두 "Enums can't be instantiated."로 거부했다. analyzer의 합성 constructor record는 호출 가능한 공개 API가 아니므로 해당3개만 notApplicable로 분류하고 실제 enum 값의 string-union adaptation을 유지한다. diagnostics source298 records의 missing/partial은0이다. 전체 inspector transport나 RenderObject layer/compositing/semantics 진단 수락을 뜻하지 않는다.

coverage4773 reviews/4828 source refs·36 envelopes를 채택하며 이전35 envelope를 deep-equal 보존했다. 기존4743 reviews의4749 selected destinations/4801 refs를 유지했고 변경 파일의 선언212개는 token 동일,25개는 원본/567 groups로 재검토했다. snapshot은 직전 qualified-source bytes와 SHA256 일치한다. manual Dart selection290개(+6), C#24개다. 초기 AST type/literal 중첩 편집은 compiler가 거부해 해당 method만 이전 snapshot에서 복구했고 이후 non-overlap/parse gate를 적용했다. 초기 감사의 반복 선형 lookup은 확인한 자체 Node PID를 중단한 뒤 Map으로 바꿔 완료했다. 실패 log를 보존하며 모든 test process timeout20분이다. 전체 W6는 ACTIVE/PARTIAL, Apple/Linux native 사용자 SKIPPED/provider notVerified 및 기타 물리 수락 notVerified다.

최종 실제 소비: fresh installed core0.5.0/SDK0.7.0 ESM/types·Metro0.83.8/Babel0.83.10·실제 Windows Hermes source/optimized HBC99에서567 source groups/126 FrameworkRoot expectations PASS다. SDK/latest core build·strict fixture/tool/root types(실제 Android 설치 후)·131 direct subpaths/138 declarations/502 relative .js imports·6개 provider/template·root lock·coverage 재생성 보존도 PASS다. 최종6개 archive2582 files는 workspace bytes와 일치하고 Android5 packages2571 files·fresh external1056 files는 목록·내용까지 일치한다.

CLI supply의 실제 결함도 수정했다. owned native archive를 다시 공급할 때 매번 SHA256 suffix를 덧붙여 파일명 제한을 넘던 경로를 현재 byte/hash가 맞는 owned path 재사용으로 바꿨다. 수정 중 loop 변수 shadow로 생긴 잘못된 dependency key6개는 정확한 allowlist로 제거·복구했다. 6개 target의 native archive6개 경로가 유지됐고 최종 실제 설치 CLI로 Android의215-character native archive를 재공급해 파일명/의존 key/hidden installation lock 보존을 확인했다. 공급/설치 검증이며 native target 실행은 아니다.

현재 authoritative 인계는 `.tmp/work6/diagnostics-completion/checkpoint.json`·`resume-progress.md`·current36-envelope baseline/qualified-source다. 이전 diagnostics-tree 기록은 과거 증거로 보존한다. 다음 foundation/basic_types의 실제 CachingIterable/Factory/callback·print의 throttling/wrapping 등과 나머지 W6를 계속한다. 전체 RenderObject layer/compositing/semantics 진단·inspector transport와 물리 플랫폼 수락은 미완료다.

### 2026-10-12 — foundation basic-types·print·IO/Web 오류 출력

**전체 판정: ACTIVE/PARTIAL.** 이전 진단 묶음 이후 basic_types.dart/print.dart/두 conditional dumper의 실제 source 의미를 구현했다. 새로운 `foundation/basic-types`와 `foundation/print` direct subpath를 제공한다. 기존 unrelated dirty 변경과 사용자 지침을 보존했고 commit/push·임시 자료 삭제는 하지 않았다.

CachingIterable은 caller의 하나의 Iterator와 cache를 모든 reader·파생 view가 공유한다. current/moveNext와 JS iterator를 함께 제공하고 early for-of break로 source를 닫지 않는다. map/where/expand/take/skip 계열은 callback throw 뒤 source 진행·종료 상태를 보존하는 실제 iterator다. fixed toList는 복사본의 요소 대입은 허용하고 길이 변경은 거부한다. callback 타입은 실제 함수 계약이며 Async 계열은 Promise다. Factory는 T 대신 명시적 type token을 받으며 실제 readonly own constructor callback을 미리 호출하지 않는다. own constructor field 때문에 objectRuntimeType이 creator 이름을 보고하던 문제는 prototype의 class identity를 사용해 고쳤다. lerpDuration은 host milliseconds·microsecond endpoint/결과 반올림·finite safe-microsecond 범위의 대응이며 Dart Duration/int64 ABI와 arbitrary collection equality/hash ABI는 포함하지 않는다.

print는 실제 DebugPrintController가 buffer/stopwatch/completer/scheduled/task를 소유한다. UTF16 12*1024 character budget·긴 line 전체 출력·FIFO·1초 pause·strict elapsed>1000ms reset·pending Promise identity를 보존한다. 소비한 buffer 참조를 지우고 prefix를 compaction한다. debugPrint는 실제 mutable export let이고 DebugPrint.callback으로 대입하며 저장한 callback은 이전 대상을 유지한다. DebugPrint.done이 원본 debugPrintDone getter에 대응한다. Hermes는 idle Promise.resolve(undefined)를 재사용해 원본 Future identity와 달랐으므로 idle마다 새 resolved Promise를 만들도록 수정했다. 최초 실패 log와 재빌드 전 stale dist 실패 log를 보존하고, 새 core build·실제 fresh 설치본에서 source/HBC99 PASS를 확인했다. debugWordWrap은 원본 오류 메시지용 ASCII break/indent·Dart trimLeft 문자·hash bypass·오류 경계를 보존하며 일반 Unicode line-break 구현으로 집계하지 않는다.

ErrorToConsoleDumper는 assignable dump hook을 유지하면서 IO의 현재 debugPrint와 Web의 console.error/listeners branch를 제공한다. listener 변경의 ConcurrentModificationError도 source 반복 규칙을 따른다. SDK bootstrap은 asset 초기화 전에 provider target으로 useWebConsole을 선택하며 custom hook을 유지한다. 한 JS realm에서 branch를 공유한다. 실제 bootstrap의 Windows/Web identity와 의도한 asset 실패에서 선택·오류 전파·4개 service dispose16 expectations를 확인했다. native backend 실행 수락은 아니다.

원본5 source units/30 top-level spans의 raw UTF16 SHA256과 file SHA256을 확인했다. 본문은 그대로 두고 imports·Timer/Stopwatch/print·Web string/console receiver만 제공해267 cases×IO/Web×3 별도 Dart mode processes=**1,602 groups PASS**다. 동시 iterator·callback 실패·파생 iterator·fixed list·Factory·duration·180 wrapping cases·UTF16 saturation·pause 경계·Future/listener/captured callback을 포함한다. 기존 diagnostics567 source groups와 actual FrameworkRoot36 error+90 diagnostic expectations도 함께 PASS다. print private enum의 합성 constructor1개는 pinned Dart compiler가 "Enums can't be instantiated."로 거부해 notApplicable로 분류했고 나머지67개는 실제 declaration/type/runtime에 대응했다. 이68개 source records missing/partial은0이다.

coverage는 **4841 reviewed rows/4895 declaring+export refs·37 envelopes**, missing68569/partial983/adapted4580/implemented7/notApplicable4다. 이전36 evidence envelope를 deep-equal 보존하고4773 rows의4776 selected destinations/4828 refs를 유지했다. 변경 파일 중67개 declaration tokens는 동일하며 objectRuntimeType 변경과 inherited error-details constructor의 export hash 이동2개를 별도 검토했다. 선언 source가 같은 inherited constructor는 확장 채택하지 않았다. Dart selection319개(+29)와 C#24개다. 도구는 print globals의 실제 instance owner-member와 static getter를 구별하고 private enum/regex/const·실제 _LazyListIterator를 qualified identity로 연결한다. 전체 재생성에서도 이전 선정 subset과 근거가 보존된다.

core**0.6.0**/SDK**0.8.0**·provider range >=0.6.0 <0.7.0·schema·CLI defaults·6개 template·root lock을 이행했다. IterableFilter는 assertions에서 basic-types로 이동하며 compatibility re-export는 없다. core133 direct subpaths/140 declarations/503 relative .js imports, core/SDK build·root/fixture/tool/CLI/Metro/external types PASS다. emitted3 first-import orders·fresh external ESM/types·Metro0.83.8/Babel0.83.10·실제 Windows Hermes source/optimized HBC99에서1,602+567 source groups·FrameworkRoot126·bootstrap16 expectations PASS다. 최종6개 archive2592 files는 workspace bytes와 일치하며 Android5 packages2581 files·fresh core/SDK1066 files는 내용·목록까지 일치한다. 6개 target30 archive/lock 공급·6개 owned native path 유지, 실제 설치 CLI의 Android 재공급/hidden lock 보존도 PASS다. Apple/Linux 공급은 플랫폼 실행 검증이 아니다.

Native supplier146 source hashes/3 consumer headers를 재확인했고 ABI1/wire5는 그대로다. 새 native build/runtime은 수행하지 않았다. 실제 wall-clock 출력 처리량·native UI/GPU·물리 입력/IME/reader·scanout/FPS·성능/복구·서명/clean-machine 수락은 notVerified다. Windows Move-editor-right InvokePattern 수락 이슈도 남는다. Apple/Linux 코드는 범위에 두고 native 검증은 사용자 지정 SKIPPED/provider notVerified다.

현재 authoritative 인계는 `.tmp/work6/foundation-basic-print/checkpoint.json`·`resume-progress.md`·37-envelope adopted baseline/qualified-source다. 이전 diagnostics-completion/tree는 과거 증거와 실제 owner/inspector 후속 작업을 위해 KEEP한다. Flutter checkout/Dart/native supplier cache도 보존한다. 나머지 foundation419 source records(공개 API 분모와 다름)와 rendering/text/gestures/sliver/services/Material/Cupertino·플랫폼 수락을 계속한다. 다음에는 platform.dart와 conditional platform의 실제 host 선택/debug override를 현행 SDK boundary에 연결할 범위를 검토하고, 실제 owner/layer/semantics 진단·inspector transport를 별도 미완료로 유지한다. W6 전체 missing/partial 및 필수 제품 수락이 남아 goal을 완료로 표시하지 않는다.

### 2026-10-12 — foundation platform·Web host cache·conditional import inventory

**전체 판정: ACTIVE/PARTIAL.** 이전 턴은 실제 basic/print 구현·검증·패키지 수락을 마친 progress다. 이번에는 플랫폼 정책과 실제 SDK host 연결을 구현하고 inventory의 conditional import 누락을 보완했다. 기존 unrelated dirty·사용자 지침을 보존했으며 commit/push나 scratch pruning은 하지 않았다.

`foundation/platform`에 TargetPlatform string union(android/fuchsia/iOS/linux/macOS/windows)과 실제 FoundationPlatform owner를 추가했다. source enum의 fuchsia는 일곱 번째 SDK native target을 뜻하지 않는다. host는 typed native/Web 환경을 configure한다. native OS 선택·unknown FlutterError·FLUTTER_TEST key의 명시적 isTest 대응·debug override의 mode guard를 원본대로 보존한다. Web은 override/test/browser 우선순위·test의 browser OS override·unknown→android·lazy browser cache를 따른다. 같은 환경의 재구성은 cache를 유지하고 명시적 host 교체는 초기화하는 host adapter다. 원본 VM의 불변 compile-time mode와 추가 host mode 전이 검증을 구별했다.

SDK direct `backends/browser/platform`은 navigator를 주입받는 실제 BrowserPlatformEnvironment다. Mac touch-count>2인 desktop-site iPad·iPhone/iPad/iPod 이름·Android UA 우선순위·Linux/Windows 판별, OS/UA lazy cache·debug override·명시적 detector 입력을 보존한다. getBrowserPlatformEnvironment는 built-in Web 앱이 공유하는 realm cache를 소유한다. Web services가 이를 전달하며 SDK bootstrap은 assets 전에 provider identity/BackendServices.foundationPlatform으로 core를 구성한다. custom Web metadata 생략은 unknown OS에 대한 원본의 android mapping을 따르고 native unknown과 구별한다. core는 DOM/Node/RN platform API를 읽지 않는다. 설정은 realm에서 공유하며 Material/Cupertino styling·전체 ui_web engine 구현은 미완료다.

원본 platform.dart/_platform_io.dart/_platform_web.dart 본문3 units/10 top-level spans와 analyzer AST로 추출한 원본 BrowserDetection OS/UA/TestEnvironment10 spans의 raw UTF16/file SHA256을 확인했다. imports·navigator/dart:io·annotation/error receiver만 제공하며 본문은 그대로다. library cache를 실제 Dart isolate마다 초기화해97 scenarios×3 별도 mode processes=**291 groups PASS**다. native6종/Fuchsia/unknown·test/override·Mac touch 경계·UA precedence/cache·browser/test override 순서를 포함한다. TargetPlatform 합성 constructor1개만 pinned Dart compiler가 "Enums can't be instantiated."로 거부했다. platform/IO/Web17 source records는16 adapted/1 notApplicable이며 missing/partial0이다. setter는 getter와 별도 실제 compiler write declaration에 연결했다.

기존 frontend는 conditional export만 추적하고 conditional import의 대체 구현을 누락했다. 현재는 실제 참조한 default binding의 top-level identity를 대체 export namespace에 연결하며 show/hide를 적용한다. matching 대체 선언을 dependency root/edge로 추가하고11개 branch/15개 binding metadata를 보존한다. 사용하지 않는 namespace 전체를 넣거나 새 공개 export로 승격하지 않는다. 새 analyzer inventory는**74297 declarations/788 files/0 diagnostics**, 기존74143 declarations의 source hash/공개 여부 변경0·삭제0, 추가154개 모두 구현 의존성이다. 공개 분모47282개는 그대로다. cache decoder/coverage regeneration에서74297개 identity/source/member/dependency/export set과 conditional metadata를 전부 대조해 보존했다. frontend hash가 바뀌었으므로 이전 baseline을 현재 cached generation 입력으로 쓰지 않으며 새38-envelope baseline을 사용한다. pinned source checkout은 clean이다.

coverage는**4858 reviewed rows/4911 declaring+export refs·38 envelopes**, missing68706/partial983/adapted4596/implemented7/notApplicable5다. 이전37 envelope를 deep-equal 보존하고4841 reviews의4843 selected destinations/4895 refs를 변경 없이 유지했다. 신규 dependency154개를 자동 완료 처리하지 않았다. manual Dart selection329개(+10)와 C#24개다. AST helper의 구 analyzer name/members 접근과 cache codec exactOptional 오류는 수정 후 compiler/analyzer PASS이며 최초 실패 log를 보존했다.

core**0.7.0**/SDK**0.9.0**·provider range >=0.7.0 <0.8.0·schema·CLI defaults·6개 template·root lock을 이행했다. SDK-only build 뒤 provider JSON이 이전 version으로 남은 것을 package contract가 잡아 explicit generator/CLI assets를 실행한 뒤 최종 pack했다.134 core direct subpaths/141 declarations/504 relative .js imports, core/SDK build·root types(실제 Android 설치 후)·strict source/external fixture·tool TS/Dart frontend+extractor·provider/template/package contract PASS다.

최종 실제 소비에서 emitted3 first-import orders(platform/sdk/flutter-error)·fresh ESM/types·Metro0.83.8/Babel0.83.10·실제 Windows Hermes source/optimized HBC99가**291 platform+1602 basic/print+567 diagnostics groups**, actual FrameworkRoot126 expectations·SDK bootstrap/cache30 expectations를 통과했다. Windows/Web bootstrap은 asset 실패 전에 platform/console 선택과 custom hook, 오류 전파·4개 service dispose를 확인했다. 추가 shared-cache/host mode 전이 검증은 portable host 증거다. 최종6 archive2602 files는 workspace bytes와 일치하며 Android5 installed packages2591 files·fresh core/SDK1076 files는 내용·목록까지 일치한다. 6개 target30 archive/lock 공급과6개 owned native path 유지, 실제 설치 CLI의 native filename/dependency keys/hidden npm lock 보존도 PASS다.

Native supplier146 source hashes/3 consumer headers 재확인, ABI1/wire5 유지이며 새 native build/runtime은 없다. Windows/Android/Web의 물리 입력/IME/reader·scanout/FPS·성능/복구·서명/clean-machine 및 Windows Move-editor-right InvokePattern 수락은 notVerified로 남는다. Apple/Linux 코드는 범위에 두고 native 검증은 사용자 지정 SKIPPED/provider notVerified다. 이번 OS 문자열 비교·공통 TS 검증이나 archive 공급을 해당 target native 검증으로 집계하지 않는다.

현재 authoritative 인계는 `.tmp/work6/foundation-platform/checkpoint.json`·`resume-progress.md`·38-envelope adopted baseline/qualified-source다. platform/basic-print/diagnostics scratch와 Flutter/Dart/native supplier cache는 KEEP한다. 다음 실제 구현은 pinned serialization.dart의 ReadBuffer/WriteBuffer와 기존 ui/frame-wire·service/channel 경계에서 binary ownership·alignment/endian/typed-view 수명을 확인해 연결한다. 원본에 맞는 기능·수명을 구현하며 빈 API나 default 반환으로 좁히지 않는다. rendering/text/gestures/sliver/services/Material/Cupertino, 실제 owner/layer/semantics 진단·inspector transport 및 필수 물리 플랫폼 수락이 남아 전체 goal은 계속 active다.

### 2026-10-12 — foundation serialization·message/method codecs·실제 frame/exception 연결

**전체 판정: ACTIVE/PARTIAL.** 원본 ReadBuffer/WriteBuffer와 Binary/String/JSON/Standard message·method codec을 구현하고 실제 frame encoder 및 오류 보고에 연결했다. 기존 unrelated dirty와 사용자 지침을 보존했고 commit/push·scratch pruning은 하지 않았다. 이번 source·package·engine 수락을 W6 전체 완료로 확장하지 않는다.

새 direct module은 `foundation/serialization`, `services/message-codec`, `services/message-codecs`다. WriteBuffer/ReadBuffer는 실제 private storage·capacity growth·mode gate·endian·정렬·실패 후 position·typed view 공유·one-shot done transfer를 보존한다. DataView와 native typed arrays를 쓰며 int64는 bigint, 정수 number 입력은 정확한 safe integer로 제한한다. typed 읽기는 logical DataView의 길이보다 실제 underlying buffer 범위와 byteOffset을 따른다. scalar Float32는 실제 frame wire를 위한 명시적 host 확장이다. 원본 bulk append의 inclusive growth 때문에 예약 zero를 scalar로 써 exact-size backing buffer 소유권을 보존했다.

Standard codec은 JS number를 Dart double, signed-int64 bigint를 Dart int로 구별한다. tag0..14·size·typed-list 정렬과 custom writeValue/readValueOfType dispatch를 구현했다. reserved tag5는 원본 hex string decode만 제공한다. decoded Map은 정수/double key 동등성·첫 key 타입/-0·별도 NaN key·iterator/forEach의 구조변경 검사를 보존한다. JSON decode는 Map이며 signed-int64 integer token precision을 bigint로 유지하고 소수/지수는 number다. typed list·custom toJson·cycle/미지원 오류를 처리하며 일반 record encode는 host 확장이다. UTF8 검증·surrogate 치환·BOM과 Binary DataView identity도 구현했다. 내부 UTF8/JSON/value-string helper는 public aggregate로 노출하지 않는다.

MethodCall은 실제 readonly method/arguments 필드를 가진다. strict JS의 생성자 parameter만 args로 표현한다. nullable message를 가진 PlatformException/MissingPluginException은 JS Error를 상속하지 않고 foundation/errors의 Exception symbol protocol을 구현한다. JS stack과 native stacktrace를 구별하며 foundation은 services를 import하지 않는다. FlutterErrorDetails formatting/summary/labels와 실제 FrameworkRoot·BuildScope·notifier·scheduler·focus 오류 경로가 protocol을 인식한다. 실제 method success/error shape 검증·custom codec dispatch를 제공하지만 BinaryMessenger·native plugin/channel routing·transport 수명 수락은 남는다.

pin71e4717a61786faab4c7aa39825989305ed29e8a의 **4 complete units/15 top-level raw UTF16 spans**와 file hashes를 확인하고 원문 그대로 real dart:typed_data/convert/math로 실행했다.372 cases×3 실제 Dart mode processes=**1,116 groups PASS**다. number/double·bigint/int receiver와 동일한 NaN input bits를 명시했으며 product output은 정규화하지 않았다. typed-list indexed mutation 범위 검사는 fixture receiver이며 Dart typed-list/collection/VM ABI 전체 수락이 아니다. 원본 full diagnostics/StackFrame와 서비스 예외의 오류 형식21 groups, 기존 diagnostics567 groups도 PASS다. VM range/assertion wording만 명시적으로 제외했다.

별도 actual FrameworkRoot fallback/recovery·notifier/scheduler continuation은 **144 expectations PASS**, 기존 FrameworkRoot126·SDK bootstrap/cache30도 PASS다. 실제 새 frame encoder와 exact previous source의 **61 cases/510 expectations/222,848 bytes** 대조는 모든 paint/path/full-matrix/full-RRect/resource/header branches·4096 limit·admission errors·exact-size zero-copy 소유권을 확인했다. ABI1/wire5는 유지하고 새 native build/runtime은 수행하지 않았다.

coverage는 **4,982 reviewed rows/5,035 declaring+export refs·39 envelopes**, missing68,582/partial983/adapted4,720/implemented7/notApplicable5다. 새3 source families124 records는 모두 adapted이며 missing/partial0이다. 이전38 envelope를 deep-equal로 보존하고4,858 reviewed subsets/4,859 destinations를 유지했다. 영향받은221 refs 중213개는 실제 declaring tokens/file이 같고8개 exception-reporting spans를 원본 진단/실제 계속 실행 증거로 재검토했다. inherited·old class-line·overload anchor는 실제 declaring identity로 대조하며 기존 subset을 확대하지 않았다. Dart343/C#24 selections이며 이전 objectRuntimeType를 중복 선택하지 않았다. cache roundtrip74297 declarations/public47282와 conditional11 branches/15 bindings 전체 보존 PASS다.

core**0.8.0**/SDK**0.10.0**·provider range >=0.8.0 <0.9.0·schema·CLI defaults·6개 template·root lock·영/한 문서를 반영했다.137 direct core subpaths/146 declarations/509 relative .js imports, core/SDK build·root types(최종 실제 Android 설치 후)·strict source/external fixtures·tool types·package contract PASS다. emitted3 first-import processes는 requested module 뒤 fixture를 dynamic import하도록 보정했으며 모두 PASS다. fresh external ESM/types·Metro0.83.8/Babel0.83.10·실제 Windows Hermes source/optimized HBC99에서1,116+21+291 platform+1,602 basic/print+567 diagnostics groups 및 실제 wire/integration/Root/bootstrap 검증이 PASS다. 최초 Windows .cmd typecheck 호출 오류는 node로 compiler를 실행해 수정했고 실패 log를 보존했다.

최종6 archive**2,627 files**는 workspace bytes와 같고, Android5 installed packages**2,616 files**·외부 core/SDK**1,101 files**는 내용·목록까지 일치한다.6개 target30 archive/lock 공급·6개 owned native path 유지와 실제 설치 CLI의 filename/dependency keys/hidden lock 보존도 PASS다. 문서 blank whitespace 정리 후 동일 file reference를 npm이 갱신하지 않은 문제를 byte 비교로 잡았다. 외부 소비의 archive reference를 SHA-qualified 이름으로 바꿔 실제 재설치·runtime/types·bytes/listing을 통과했다. fresh Metro bundle SHA가 실제 Hermes 실행 receipt와 동일하다. 최종 archive·공급·설치·bytes receipts를 갱신했고 source/ledger는 그대로다. native supplier146 source hashes/3 consumer headers를 재검증했으며 이를 새 GPU/native 실행 수락으로 집계하지 않는다.

authoritative 인계는 `.tmp/work6/foundation-serialization/checkpoint.json`·`resume-progress.md`·39-envelope adopted baseline/qualified-source다. 이전 platform/basic-print/diagnostics와 Flutter/Dart/native supplier cache는 KEEP한다. 다음에는 원본 binary_messenger.dart/platform_channel.dart와 ServicesBinding default messenger/channel buffers를 실제 SDK host/native 소유권에 연결할 범위를 구현한다. 현재 generic transport가 없으므로 무응답 stub으로 채널을 채우지 않는다. remaining foundation/rendering/text/gestures/sliver/services/Material/Cupertino·실제 layer/semantics/creator/inspector와 Windows/Android/Web 물리 입력/IME/reader·scanout/FPS·복구·서명/clean-machine 수락은 남는다. Windows Move-editor-right InvokePattern 이슈도 유지한다. Apple/Linux는 코드 범위를 유지하고 native 검증 사용자 SKIPPED/provider notVerified이며 전체 goal은 계속 active다.

### 2026-10-12 — 진행 중: 채널 버퍼·기본 messenger·SDK 전송 소유권

**전체 판정: ACTIVE/PARTIAL.** 직전 serialization/codecs 채택·패키지 수락은 progress다. 이번에는 원본 channel_buffers.dart와 binary_messenger.dart/ServicesBinding의 기본 messenger를 실제 core에 구현하고 SDK가 주입된 전송 port의 byte/callback/종료 수명을 소유하도록 연결했다. 새 high-level Basic/Method/Event 채널·기본 binding·native/DOM plugin bridge와 새 채택/패키지 수락은 아직 남는다. 기존 unrelated dirty를 보존했고 commit/push·subagent·scratch pruning은 하지 않았다.

core direct `ui/channel-buffers`는 FIFO·microtask drain·listener 교체/해제/재진입·capacity/overflow·callback/context 캡처와 standard/legacy control parser를 구현한다. consumed 참조를 해제하고 bounded prefix를 compact한다. 실제 source의 음수 초기 capacity와 capacity<=0에서 새 message reply를 호출하지 않는 동작, positive overflow warning 규칙을 보존한다. safe integer capacity와 주입된 scheduling/context/native update/print는 host adaptation이며 Dart Zone/collection/VM ABI를 주장하지 않는다. direct `services/binary-messenger`는 raw send·legacy receive·buffered handler·오류/finally 응답·중복 completion 보고와 synchronous send 실패를 구현한다. API 이름만 있는 무응답 messenger로 대체하지 않았다.

`hosting/platform-messages`의 PlatformMessagePort와 SDK direct `runtime/platform-messages`의 실제 PlatformMessageConnection을 연결했다. per-app ingress gate·native listening update·control messages·offset을 보존한 exact-size byte snapshot·pending inbound/outbound 응답을 소유한다. 종료는 새 작업을 막고 listener/ingress를 해제하며 incoming reply를 한 번 마친 뒤 **실제 port.dispose의 native retirement를 기다리고** 응답 없는 outgoing send를 null로 완료한다. send의 synchronous failure는 native 미수락을 증명하지 않으므로 snapshot을 drain까지 유지한다. drain 실패는 port/bytes/application/services를 보존하며 confirm된 종료 뒤 late reply는 보고한다. 여러 앱의 messenger를 한 global latest owner로 덮어쓰지 않는다.

SDK bootstrap은 assets 전에 port를 attach하고 ApplicationStartupContext·ViewServices·ComposedApplication에 선택적 binaryMessenger를 전달한다. BackendServices와 Web options/common React Native surface props가 주입된 port 소유권을 전달하며 remount에는 새 port가 필요하다. **built-in native/DOM plugin bridge는 아직 없다.** 실제 SDK 연결/receiver 검증을 native plugin 실행 수락으로 확장하지 않는다. 종료 중 message drain 실패가 프레임 scheduling을 남길 수 있어 AppSession/ViewRuntime.beginClose를 추가했다. 먼저 admission/예약·forced frame을 막고 resource/controller/renderer는 drain까지 보존한다. 성공한 drain 뒤 기존 dispose가 실제 소유자를 정리한다.

원본 pin의 **12 raw spans**를 hash 확인했다. ChannelBuffers의 engine @Native external sendChannelUpdate 선언 하나만 trace receiver로 바꾸고 나머지 선택 class/helper/hook/messenger 본문은 그대로 실행했다. real Dart collection/Zone/Future/typed_data/convert와 명시적 dispatcher/error/microtask receivers다.161 cases×3 실제 Dart mode processes=**483 groups PASS**이며 VM _Exception 이름만 공개 Exception으로 정규화하고 range/assertion/format wording은 제외했다. 실제 SDK/bootstrap/AppSession/ViewRuntime **15 scenarios/114 expectations PASS**는 FIFO/snapshot/offset·중복/오류·cancel/late replies·retirement wait·unknown send/failed drain 참조 보존·attach/asset 실패·context/다중 owner·scheduling/resource quiescence를 확인했다. 기존 SDK bootstrap/cache30도 PASS다.

core/SDK ESM+d.ts build·root types·strict fixture types·diff check, workspace public-import ESM·Metro0.83.8/Babel0.83.10·실제 Windows Hermes source/optimized HBC99에서483 groups/114 expectations PASS다. timeout은20분이다. 이번 consumer는 **workspace dist**이며 fresh external archive/6개 target 재공급 증거가 아니다. native supplier146 source hashes/3 headers는 같고 ABI1/wire5 유지, 새 native build/run은 없다.

현재 version은 core0.8.0/SDK0.10.0의 **개발 상태**이고 core direct exports는140개다. version/provider/schema/CLI/template/lock·source selections/private mappings·새 coverage 채택·fresh installed qualification/최종 archive 공급은 PENDING이다. 기존39-envelope ledger/manifest는 수정하지 않았으며4,982 reviewed rows/5,035 declaring+export hashes는 현재도 모두 일치한다. 과거 runtime/package receipt는 과거 선정 범위의 증거로 유지한다. authoritative 개발 인계는 `.tmp/work6/platform-messages/checkpoint.json`·`resume-progress.md`다. 다음에는 원본 platform_channel.dart의 Basic/Method/Optional/Event 채널·profiling/default binding·broadcast 수명을 이 전송 경로 위에 구현하고 native/DOM port와 실제 OS service를 연결한다. 나머지 W6 API/플랫폼 수락도 그대로 범위에 남는다. Apple/Linux native 검증 사용자 SKIPPED/provider notVerified, Windows/Android/Web 물리 입력/IME/reader·scanout/FPS·복구·서명/clean-machine 및 Move-editor-right InvokePattern은 미완료다. 모든 관련 scratch/cache를 KEEP하며 goal은 계속 active다.

### 2026-10-12 — 플랫폼 채널·broadcast/default binding·SDK retirement·선정 패키지 수락

**전체 판정: ACTIVE/PARTIAL.** 직전 버퍼/messenger 개발 기록에서 이어 실제 BasicMessageChannel·MethodChannel·OptionalMethodChannel·EventChannel, typed invoke/lazy native collection views, broadcast subscription·profiling/default owner를 구현했다. 실제 SDK 종료·retired 참조 해제를 보강하고 source 선택/coverage 채택·core/SDK version·패키지 공급까지 수락했다. 기존 unrelated dirty를 보존했고 commit/push·subagent·scratch pruning은 하지 않았다.

core direct services/platform-channel·channel-binding·event-stream을 제공하며 casts는 내부 구현이다. malformed method decode·handler exception/error envelope·MissingPlugin/Optional 응답을 원본 경로에 연결했다. erased generic에는 입력을 검증하고 그대로 반환하는 ChannelCast를 요구하며 변환은 거부한다. list/map helper는 backing storage를 공유하는 lazy live view다. EventChannel은 원본처럼 injected messenger로 events를 받고 default messenger로 listen/cancel을 보낸다. 네 번째 인수 controlBinaryMessenger는 두 경로를 같은 per-app owner로 연결하는 명시적 host 확장이다. realm default는 opt-in/refcount이며 다른 동시 owner를 거부하고 concurrent app은 explicit messenger를 사용한다. 완전한 ServicesBinding/background/root isolate 자동 transport를 구현한 것으로 기록하지 않는다.

broadcast는 비동기 data/error/done·nested pause/resume·resumeSignal·cancelOnError·asFuture·async iteration/concurrent next를 구현했다. cancel은 native 응답을 기다리지 않고 paused listener는 end acknowledgement를 지연한다. SDK onClosing에서 동기 취소 send/handler 해제를 수락한 뒤 native gate/drain을 진행한다. reentrant dispose는 같은 Promise를 반환한다. confirmed retirement에서 profiling target 참조를 해제해 module-scoped channel을 새 default owner에 연결할 수 있다. retirement가 확인된 cleanup observer 오류는 나머지 앱 자원을 해제한 뒤 보고하며, 실패/불명 drain은 owner·bytes·자원을 보존한다. late callback은 retired native reply를 호출하지 않고 보고한다. AppSession/ViewRuntime scheduling quiescence와 resource/controller/renderer 보존을 유지한다.

profiling은 실제1,000ms byte/count window·bandwidth 정렬·method suffix·type/codec label·NaN 평균을 보존한다. source globals/functions는 실제 PlatformChannelProfiler owner members, rate는 내부 constant에 대응한다. bounded1,024 host timeline/선택적 sink는 native TimelineTask 수락이 아니다. bare messenger cache는 원본 동작을 유지하고 SDK lifetime capability가 있는 target만 confirmed retirement에서 참조를 해제한다.

원본6 complete unchanged units/33 top-level spans·real Dart broadcast StreamController/Future·3 modes **498 groups**, 이전 buffer/helper/messenger12 spans·3 modes **483 groups PASS**다. 명시적 default/background/error/timer/timeline/context receivers와 native update external 선언의 trace receiver 경계를 기록했다. event/broadcast는 bounded action microtask settling 뒤 관찰하고 미응답 listen/cancel gate를 관찰 사이에 유지한다. 초기 raw26/20 mismatch와 receiver 보정 전 traces/logs를 보존했다. expected/output 정렬·정규화는 하지 않으며 Dart Future microtick/Zone/collection/typed-list VM ABI를 주장하지 않는다.

실제 SDK 계약 **65 expectations**와 bootstrap/AppSession/ViewRuntime owner **16 scenarios/120 expectations**가 PASS다. fresh external ESM/types·실제3 first-import processes·Metro0.83.8/Babel0.83.10·Windows Hermes source/optimized HBC99에서498+483과 이전 serialization1,116/error21/platform291/basic-print1,602/diagnostics567 groups, frame61 cases/510 expectations/222,848 bytes·error integration144·FrameworkRoot126·bootstrap30 회귀가 PASS다. final installed Metro bundle은 실제 Hermes 실행 receipt의 bytes와 동일하다. 모든 검증은20분 timeout이다. version 이행 직후 Android의 이전 설치본과 생긴 nominal type 충돌은 실제 재공급/설치 후 해결했고 실패 log를 보존했다.

coverage는 **5,100 reviews/5,153 declaring+export refs·40 envelopes**다. 이전39 envelopes·4,982 subsets/4,983 destinations·5,035 hashes를 그대로 보존했다. 선정119 records 중 실제 TS 대응118개를 adapted로 채택하고 ChannelBuffers._sendChannelUpdate native 선언1개는 missing으로 남겼다. static update forwarding의 per-owner callback 대응을 native binding으로 승격하지 않았다. private storage/profiling classes·owner methods의 실제 compiler identity를 기록했고25 top-level manual selections를 추가해 Dart368/C#24=392다. inventory74,297/public47,282·conditional11 branches/15 bindings cache roundtrip PASS, missing68,462/partial985/adapted4,838/implemented7/notApplicable5다.

core **0.9.0**/SDK **0.11.0**·range >=0.9.0 <0.10.0·6 providers/schema·CLI defaults/templates/root+runner locks·영/한 문서를 이행했다.143 core direct subpaths/153 declarations/519 relative .js imports이며 core/SDK build·root/strict source+external/tool/CLI types·package contract·diff check PASS다. 최종6 archives **2,667 files**는 workspace bytes, Android5 packages **2,656 files**·외부 core/SDK **1,141 files**는 bytes/listing과 일치한다.6 targets30 archive/lock 공급·6 native archive paths 유지, 실제 installed CLI의 반복 공급 filename/dependency keys/hidden lock 보존 PASS다. native supplier146 source hashes/3 consumer headers·ABI1/wire5가 같으며 새 native build/run은 없다.

authoritative 인계는 .tmp/work6/platform-channels/checkpoint.json·resume-progress.md·40-envelope adopted baseline/qualified-source다. **built-in native/DOM PlatformMessagePort/plugin bridge·typed OS services는 아직 없다.** 다음에는 pinned ServicesBinding/SystemChannels와 기존 browser/RN interaction/native host를 검토해 실제 bridge와 worker/dispatcher 소유권을 연결한다. 남은 foundation/rendering/layer/text/gestures/focus/editing/sliver/semantics/app/Material/Cupertino·6개 target 코드와 Windows/Android/Web 물리 입력/IME/reader·scanout/FPS·복구·서명/clean-machine 수락을 계속한다. Move-editor-right InvokePattern도 미완료다. Apple/Linux native 검증은 사용자 SKIPPED/provider notVerified이며 코드 범위는 유지한다. scratch/cache는 KEEP하고 전체 goal은 active다.

### 2026-10-12 — 사용자 요청으로 현재 시점 중간 마무리

**현재 상태: PAUSED/PARTIAL, 전체 W6 미완료.** 추가 구현·native 실행·패키지 재생성은 중단했다. 마지막 선정 수락은 플랫폼 채널/broadcast/default binding/SDK retirement 묶음이다. core0.9.0/SDK0.11.0, coverage40 envelopes·5,100 reviews·5,153 refs와119개 중118 adapted/1 native external missing을 보존한다. 원본498+483 groups·실제 SDK65/owner120 expectations·이전 serialization/진단/frame 회귀, ESM/types·Metro·Windows Hermes source/optimized HBC99는 직전 수락 결과다. archive2,667 files·Android2,656·외부1,141 bytes/listing도 직전 수락 결과로 유지하며 이번 중간 마무리에서 재실행하지 않았다.

중간 마무리 시 최신 checkpoint의 product hashes 전체와6개 최종 archive SHA256을 재대조해 변동 없음을 확인했다. 진행 중인 W6 빌드/검증 job은 없었으며 도구용 REPL 프로세스는 유지했다. working tree의 기존 수정/미추적 파일·runner 설치본·실패 logs·qualified-source·Flutter/Dart/native cache를 보존했다. commit/push·삭제·scratch pruning은 수행하지 않았다.

재개할 때는 먼저 .github/copilot-instructions.md·현재 diff·이 pause 기록과 .tmp/work6/pause-checkpoint.json을 읽고, .tmp/work6/platform-channels/checkpoint.json·resume-progress.md·flutter-coverage-adopted.json·qualified-source를 기준으로 소스 변동을 확인한다. migrate/select/adopt/finalize는 one-shot이므로 그대로 재실행하지 않는다. 우선순위는 아직 없는 built-in Web/native PlatformMessagePort/plugin bridge와 typed OS services, 그 다음 ServicesBinding/background/root isolate/worker·dispatcher 소유권이다. 기존 embedding port/실제 SDK owner 검증을 native bridge 수락으로 확대하지 않는다.

남은 foundation/rendering/layer/text/gestures/focus/editing/sliver/semantics/app/Material/Cupertino와6개 target 코드는 계속 W6 범위다. Windows/Android/Web 물리 입력·IME·reader·scanout/FPS·복구·서명·clean-machine 및 Windows Move-editor-right InvokePattern은 notVerified/미완료를 유지한다. Apple/Linux 코드는 범위에 포함하고 native 검증은 사용자 지정 SKIPPED/provider notVerified다. 사용자가 재개를 요청하기 전에는 후속 구현을 진행하지 않는다.
