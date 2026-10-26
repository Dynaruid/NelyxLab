# Nelyx SDK

Windows Release는 Hermes와 검증된 `optimized` compiler 정책을 기본으로 사용합니다. 기본 host는 RNW이며 V8/JSC는 명시적으로 선택합니다. 실험적 `--host native-hermes`는 같은 앱 definition·Core layout에 직접 Hermes JSI owner, native display-list, TSF와 가상 UIA를 연결합니다. [CLI 명령](tooling/cli/README.ko.md)을 참고하세요. bytecode·Static Hermes의 공급과 수락은 별도이며 기능/native coverage 통과를 성능·물리 표시 수락으로 사용하지 않습니다. iOS까지 이어지는 공통 native runtime 방향은 Hermes이고, 현재 직접 host는 Windows x64 Release 대상입니다.

EditableText는 scrollController·scrollPhysics·scrollBehavior·restorationId를 제공합니다. 실제 Scrollable/ScrollPosition 하나가 paragraph paint·hit 좌표·caret/선택 스크롤·wheel/touch·애니메이션을 구동합니다. 양쪽 디자인 TextField는 scrollController/scrollPhysics를 전달하며 차용 controller는 caller가 소유합니다. 기본 축은 한 줄에서 가로, 여러 줄에서 세로입니다. iOS 한 줄 필드는 사용자 스크롤만 막고 명시적/implicit 이동은 유지합니다. Core restorationId는 스크롤 위치를 저장하고 text 복원은 controller owner가 맡습니다. 디자인의 text/controller 복원은 잔여입니다. native/public formatter 오류는 원자적으로 보고하고 원래의 미포맷 입력을 유지합니다. native 선택/range-only 관측은 formatter를 다시 실행하지 않습니다. 비시각적 adapter는 실제 OS 조합을 수정하지 않고 확정 때 보존한 조합 전 문서를 기준으로 검증합니다.

EditableTextState는 TextSelectionDelegate를 구현합니다. userUpdateTextEditingValue(value, cause)는 사용자 formatter를 적용하고 onSelectionChanged에 선택 원인을 전달하며 native 선택 변경은 keyboard로 알립니다. copySelection/cutSelection은 동기 명령이며 pasteText는 clipboard 응답 뒤 같은 편집기의 현재 문서·선택을 사용합니다. 같은 text의 선택 변경은 OS bridge의 실제 observed composing range를 유지하고 active range 없는 교체는 실제 조합 취소를 기다립니다. 새 active composing value 생성/변경·lookup/search/share/live-text 서비스·전체 복원 API는 잔여입니다. enableInteractiveSelection은 Core에서 true, 양쪽 디자인 TextField에서 !readOnly || !obscureText가 기본값입니다. 비활성화하면 탭 focus는 유지하고 선택·clipboard shortcut을 막습니다.

EditableTextState.requestKeyboard()는 이미 주 focus인 필드의 기존 입력 연결을 표시하거나 Core focus를 요청합니다. gesture focus는 실제 View 입력 시각을 지연 focus와 carrier 재연결까지 보존합니다. Android input protocol4는 native Back key의 숨김 시각보다 오래된 요청의 IME 재표시를 억제하며 자동 복원은 이전 의도를 유지합니다. 키보드가 숨겨져도 Core 논리 focus는 유지하고 이후 새 tap이나 명시적 requestKeyboard로 다시 표시합니다. predictive Back gesture와 물리 기기 검증은 별도입니다. 첫 carrier가 늦게 붙으면 대기 중 명시적 focus를 처음 전달하고 이후 재연결만 복원으로 표시합니다.

Core 편집 키는 기존 플랫폼 shortcut map으로 Unicode 단어 이동/삭제·줄/문서 경계·방향 Shift 선택과 Mac Option/Command 정책을 처리합니다. 단어 경계는 실제로 그린 SkParagraph를 사용하며, keyboard 삭제는 UTF-16 선택이 grapheme 중간에 걸려도 원래 grapheme 전체로 확장합니다. read-only·obscure 정책도 Core가 처리합니다. 실제 Focus 문맥에서 지원 편집 Actions를 재정의하고 callingAction으로 기본 동작에 위임하며 가까운 custom shortcut을 먼저 처리합니다. 공통 AppFocus는 앱 탐색 shortcut 안쪽에 편집 shortcut을 설치해 방향키가 editor focus를 유지합니다. grapheme transpose·page/document scroll은 선택과 명시적 scroll을 paint·blink 뒤에도 유지합니다. Core outside-tap 그룹·콜백과 재정의 가능한 Actions는 실제 pointer hit를 사용하며 native 모바일 touch는 focus를 유지하고 데스크톱/브라우저 outside down은 해제합니다. 디자인 장식과 외부 control은 groupId를 공유할 수 있습니다. 상위 선택 edge 스크롤·나머지 공개 편집 API와 물리 keyboard/IME 검증은 잔여입니다. 첫 native 조합 capability의 `unavailable`→`none` 관측은 새 Core 값을 덮지 않고 transport 상태만 갱신합니다. 실제 조합 시작/종료·범위 변경은 native 편집으로 유지합니다.

편집 glyph·선택 영역·조합 표시·caret geometry는 Core TextPainter/SkParagraph가 소유합니다. 일반 Web EditContext와 Android 비시각적 View/BaseInputConnection, Windows 기본 surface의 비시각적 TSF 입력은 같은 Core 문서와 geometry를 사용합니다. Web secure/autofill·미지원 브라우저 입력은 Core 선택 키와 실제 compositionend 교체를 사용하는 비시각적 DOM carrier로 전환했습니다. 후보창 좌표·접근성/입력 수명 분리·실제 autofill service와 물리 검증 잔여는 [W14](../../work14.md)를 따릅니다. 선정 provider 구현을 제품 전체나 물리 IME 완료로 올리지 않습니다.

Core 입력 좌표는 정상 프레임 경계 뒤에 발행합니다. `updateGeometry(null)`은 불가용 geometry를 철회하며 adapter는 dirty 또는 다른 문서/epoch의 caret·문자 bounds를 전달하지 않습니다. 일반 EditContext는 철회한 bounds를 [표준의 초기 빈 bounds](https://www.w3.org/TR/edit-context/#concept-editcontext-controlbounds)로 되돌립니다. Android input protocol4는 캐시 좌표를 비우고 마지막 epoch를 유지해 이전 packet의 복원을 거부합니다.

일반 controller 명령은 native input View가 없는 동안에도 Core에 즉시 반영합니다. OS 쓰기는 요청 ID와 관측 revision으로 직렬화하며 늦은 응답으로 최신 Core 값을 덮어쓰지 않습니다. 조합 취소 교체는 실제 OS finish/close 뒤에 완료합니다. 거절·timeout은 대기 명령을 해제하며 완료 callback을 실행한 것으로 처리하지 않습니다. Android autofill도 실제 조합 종료를 기다리며 이후 Core 교체 명령이 대기 중 autofill보다 우선합니다. 잘못된 autofill text와 disabled field의 늦은 IME 편집은 거부합니다. 교체/종료한 연결은 현재 문서를 읽지 못하며 View 해제 때 보관한 입력 text를 비웁니다.

Android 입력 endpoint는 Core 편집 binding의 수명을 따르며 semantics 부모 교체·clip으로 재생성하지 않습니다. 접근성 노드는 기존 논리 트리에 남아 Core 값·방향 선택·상태를 제공하고 현재 endpoint로 focus를 전달합니다. endpoint 자체는 접근성 트리에서 제외합니다. `semanticsProtocol=2`와 input protocol4을 함께 공급해야 합니다. carrier 사각형은 확정 Core bounds를 따르며 View identity를 유지합니다. IME 좌표는 surface 원점, autofill 구조는 [부모 기준 pixel 좌표](https://developer.android.com/reference/android/view/ViewStructure#setDimens(int,int,int,int,int,int))로 전달합니다. 실제 reader와 autofill service 검증은 별도입니다.

Android는 현재 `inputConnectionProtocol=4`·`androidPointerProtocol=1`·keyboard host protocol3의 일치하는 native 소스를 요구합니다. Skia surface는 RN의 move 병합을 사용하지 않고 모든 contact와 MotionEvent history를 pointer identity·로컬 논리 좌표·buttons·timestamp로 전달합니다. SDK는 실제 native View를 검사하고 View/viewport가 바뀌면 묶음의 남은 좌표를 폐기합니다. pointer down은 Core가 focus를 바꾸기 전까지 기존 input focus/IME를 유지합니다. native 변경 후에는 APK를 다시 빌드하며 JS refresh만으로 provider를 교체하지 않습니다.

Android Gradle의 `copyNelyxSkiaFonts`는 `copyAndroidFontAssets`로 앱 font 선언·hash·notice를 검증하고 Skia loader에 `nelyx/fonts/<sha256>.ttf`와 `nelyx/fonts.json`을 공급합니다. 비시각적 input endpoint에는 native font registry·text layout이 없습니다. font 선언/bytes 변경 뒤에는 재공급·설치·APK 재빌드가 필요합니다. Windows Skia font도 선언한 bytes/hash로 공급합니다.

DOM semantics 부모가 바뀌어도 focus된 input port를 유지합니다. 지원 환경은 상태 보존 DOM 이동을 사용하며 fallback은 실제 조합 종료까지 부모를 유지한 뒤 가짜 Core focus 변경 없이 focus/selection을 복구합니다. 현재 Web build에서 `npm run test:web-input`으로 installed Chrome의 상태 보존 이동·이전 이동·EditContext 비활성 DOM 입력 경로를 검사합니다. 물리 OS IME·reader·GPU scanout/FPS는 별도 증거가 필요합니다.

Windows TSF 기반은 비시각적 `TextInputDocument`·`TextInputStore`·plain data object와 공유 `TextInputContext` UI owner를 사용합니다. `npm run test:windows-input`는 UTF-16/방향 선택·write lock·공급된 Core frame/문자/caret/hit 응답·readonly/secure/disabled/종료·sink 실패와 실제 TSF 조합/종료를 검사합니다. sink 알림 실패는 Core 명령 완료를 알리지 않고 store를 종료합니다. 제어된 geometry 응답은 실제 Core paragraph 연결이나 후보창 위치의 증거가 아닙니다. [TSF text-store 계약](https://learn.microsoft.com/en-us/windows/win32/tsf/text-stores)을 따릅니다.

Core text-field semantics의 typed `setText`·`setSelection`은 기존 사용자 편집 delegate를 통해 formatter/history·방향 선택·실제 조합 취소 ack를 사용합니다. `scrollRange`는 문서를 편집하지 않고 실제로 그린 Core 문단 범위를 표시합니다. host 요청은 `textInputRevision`·`textInputGeneration`을 전달할 수 있으며 text/revision이 같아도 controller/focus owner 교체는 이전 세대를 종료합니다. 비밀번호가 아닌 snapshot은 같은 Core 문단의 immutable grapheme·엔진 word·실제 wrapped-line 경계도 전달합니다. `SemanticsTextDocument.h`·`SemanticsTextProvider.h`는 apartment별 UIA Text/Text2/Value range와 Core 명령·비밀번호 보호·종료를 구현하며 `npm run test:windows-semantics`로 제어된 native COM 회귀를 실행합니다. 기본 Fabric 연결은 아래 경로를 따르며 reader 검증은 잔여입니다.

Core `textParagraph` semantics는 native 읽기 ticket·실제 문단 자원·정렬/스크롤 paint 원점을 확정 input geometry와 함께 전달합니다. private native 문단은 실제 platform context·Core View owner·자원 세대·원래 UTF-8 본문에 ticket을 연결합니다. native range/hit은 같은 문단을 조회하며 접근 gate가 사용 중이거나 relayout/dispose/다른 owner이면 unavailable을 반환합니다. 현재 native 소스와 함께 공급해야 하며 이전 native 앱은 재공급 후 재빌드해야 합니다. `TextParagraphGeometry`는 원래 range fragment와 Core grapheme hit을 확정 4x4 변환·스크롤 원점·Core clip·native 화면 mapper에 연결합니다. native 좌표 revision과 source ticket으로 빈 문서 및 재진입 좌표 변경을 포함한 응답 전체를 검사합니다. Core `textRevision`은 선택·포커스·transport ack와 별개로 실제 본문 변경만 세며 한 semantics frame 안의 변경 후 원복도 보존합니다. 아래 기본 비시각적 Fabric peer가 이 helper를 소비합니다.

`SemanticsSnapshot.h`·`SemanticsComponent.h`는 typed Core 데이터를 시각 콘텐츠 없는 Composition View로 복사하고 RNW fragment 상속 관계를 재사용합니다. SDK의 `createWindowsSemanticsTree` 플랫폼 adapter 경로는 비밀번호를 native props 전에 지우고 source/commit/편집 세대·revision으로 action을 검사합니다. 확정 Core 발행만 기존 provider의 Text/Text2/Value·live range·TextChanged/선택 알림에 반영합니다. 현재 Windows template은 `RegisterSemanticsComponent`와 `uiautomationcore.lib`를 등록합니다. 실제 GPU/TSF fixture는 별도 MTA UIA client로 Fabric tag·Text/Text2/Value 읽기·원본 문단 화면 좌표·Core 선택/교체·TextChanged/live-range 갱신을 검증합니다. 이는 자동 UIA client 증거이며 reader 검증은 아닙니다. 기본 Windows ApplicationSurface는 이 proxy들을 keyboard container 안에 배치합니다. native focus는 Core proxy를 따르며 routed key·TSF는 같은 surface가 소유하고 Core blur 뒤 canvas로 복귀합니다. UIA SetFocus는 같은 Core action을 요청하며 Invoke는 stamp를 검사하는 단일 activation을 발행합니다. native semantics protocol4를 요구하므로 재공급·host 재빌드가 필요합니다. `ITextRangeProvider.ScrollIntoView`는 복사한 범위를 같은 Core paragraph와 editor viewport로 전달하며 text·selection·composition·focus를 바꾸지 않습니다. `showOnScreen`의 선택적 UTF-16 범위·위/아래 정렬 payload를 사용하고 인자가 없는 요청은 기존 RenderObject를 표시합니다. RNW props finalization 뒤 Core가 덮어쓰는 readonly·password·pattern 가용성 변경을 알리며 name·enabled·focusable 알림은 RNW가 유지합니다. 비밀번호 전환에서 철회한 retained range는 되살리지 않습니다. reader 검증은 잔여입니다.

Windows frame pipeline2는 matching owner/viewport/surface/context의 첫 surface update 뒤 창을 표시합니다. `ApplicationSurface.onReady`는 앱 초기화 완료이며 선택적 `onFirstContentReady`는 첫 콘텐츠 준비를 한 번 알립니다. 후자는 모니터 표시/scanout 완료를 뜻하지 않습니다. preparing 동안 초기 frame을 허용하고 초기화 실패·30초 deadline·시작 중 Close는 명시적으로 종료합니다. Core/SDK/Skia archive·native supplier·host/template을 함께 갱신해 재빌드해야 합니다. native input timestamp는 QPC 수신 시각을 JS monotonic domain으로 보정하며 장치의 물리 발생 시각과 구분합니다. 실제 precision stream을 소유할 때만 중복 wheel을 억제하고 지원 불가 시 OS wheel 경로를 유지합니다.

Windows surface visibility protocol1은 backing 크기와 별도로 실제 AppWindow의 표시·최소화 상태를 사용합니다. 숨김에서 backing·문서를 보존하며 Core scheduling과 native presentation을 중단하고, 재표시 때 현재 frame을 요청합니다. native View 종료는 정상 drain 전에 session visibility 구독을 회수합니다. 이전 host와 함께 재공급·재빌드해야 합니다.

`TextInputIsland`는 ContentIsland keyboard pre-translation을 사용하고 `TextInputRoot`는 등록 provider 종료 뒤 TSF를 비활성화합니다. host/template은 실제 `ReactNativeWindow`를 전달합니다. ContentSiteBridge는 hosting·좌표의 기준이며, island가 focus를 받은 뒤 실제로 focus된 InputSite child HWND를 확인해 text store/context와 key filter를 연결합니다. bridge HWND만으로 입력 focus를 판정하지 않습니다. [InputFocusController 계약](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.input.inputfocuscontroller?view=windows-app-sdk-1.8)을 따르며 실제 TSF 문서 focus를 확인한 뒤에만 Core에 native focus를 알립니다. ContentIsland가 weak reference를 지원하지 않아 좌표 변경 관찰자는 source를 보유하고 event token을 명시적으로 해제합니다. [C++/WinRT event 해제](https://learn.microsoft.com/en-us/windows/uwp/cpp-and-winrt-apis/handle-events)를 따릅니다. 이전 문서 종료는 새 문서와 이전/외부 association을 보존합니다. 종료가 완료된 root·thread·service·session의 최종 참조는 RNW worker/property bag에서 해제할 수 있으며, 활성 native 자원의 해제는 계속 UI owner에서 수행합니다.

`TextInputSession`은 시각적 control 없이 root·text store·실제 TSF context와 UI dispatcher 취소 timer를 연결합니다. SDK port는 문서/frame/attachment를 확인한 Core 임의 caret·point-hit 응답을 지원합니다. geometry packet은 text/frame과 함께 캡처한 Core 방향 선택을 전달합니다. `TextInputProtocol`은 RNW command packet을 session에 연결하고 owner/좌표/stamp를 검사하며 native bounds/hit 요청과 정확한 명령 ack를 전달합니다. 잘못된 command는 입력을 종료하며 실제 TSF 회귀에서 UTF-16 bounds·stale/miss/hit 응답·선택의 원자적 전달·재진입 transport 종료를 확인했습니다. `npm run test:windows-input-island`는 현재 Skia host header를 컴파일하고 실제 WinAppSDK/RNW 소유권·pre-translation·provider drain/재시도·공급된 caret/hit 왕복·실제 island resize의 좌표 무효화·취소 timeout/재진입 요청 timer 소유권·관찰자/실패 context 종료를 검사합니다. geometry와 소비 키 응답은 제어된 값입니다. 이 제어된 fixture는 bound Skia surface를 실행하지 않으며 별도 surface 회귀가 제품 화면 좌표·GPU/입력 종료를 검사합니다. 현재 테스트베드 EXE·물리 IME는 별도 검증이 필요합니다.

`NelyxWindowsInput`은 View별 service/client 수명을 사용하는 비시각적 RNW module이며 host와 CLI template이 metadata를 등록합니다. `connect`에는 실제 surface의 `TextInputSurfaceResolverProperty` producer가 필요하며 없으면 명시적으로 실패합니다. `TextInputService`는 형제 서비스의 수명을 분리하고, UI 정리 전에도 새 TSF 읽기를 차단하며, 마지막 root owner 해제 때 실제 context를 반환하고 root 오류를 알립니다. SDK의 `WindowsInputService`는 Core client와 module을 연결하며 native 요청 id를 Core 요청에 대응시키고, 생성 대기/late 이벤트를 차단한 뒤 실제 native client/service 종료를 기다립니다. 이미 관측한 revision의 거부 응답은 새 편집 값 없이 동기화 요청을 처리합니다. `npm run test:windows-input-service`는 SDK 계약을 검사하며 `npm run test:windows-input-island`는 실제 RNW/Hermes 창/module과 제품 adapter로 focus/write 경쟁·한글/emoji 방향 선택 ack·암시적 id·blur·retired client/service 거부·재연결을 실행합니다. surface mapping은 제어된 값이며 별도 실제 surface 회귀가 Skia producer를 검사합니다. 기본 surface는 WindowsInputView와 순서 보장 keyboard 경로로 이 서비스를 사용합니다.

`WindowsInputView`는 기존 Core View 바인딩 목록의 client를 자동으로 소유합니다. port를 붙이거나 대기 중인 focus를 전달하기 전에 enabled/focusable·readOnly·multiline·Windows input scope를 설정하고, Core 바인딩 제거나 같은 id의 세대 교체 때 실제 native client 종료를 먼저 기다립니다. 접근성 clip/노드 제거는 입력 client를 닫지 않습니다. dispose는 ingress를 동기 차단하고 대기 중인 native open/disconnect를 기다리며, 연결 정리 실패는 실제 owner를 해제하지 않고 명시적 재시도를 유지합니다. 기본 Windows ApplicationSurface는 확정 Fabric tag·native View 세대로 이 lease를 열고 keyboard를 연결한 뒤 ready를 알립니다. 종료 때 ingress를 동기 차단하고 native retirement 후 Core/GPU 자원을 해제합니다. 실제 surface fixture는 이 공개 surface를 소비하며 현재 테스트베드·물리 검증은 별도입니다.

비시각적 입력은 일치하는 `NelyxWindowsInput` protocol3 바인딩을 요구합니다. `WindowsInputView.bindKeyboard(view, readNativeViewGeneration)`는 해당 View의 native key/focus packet·Core 단축키·실제 편집 응답의 순서를 맞춥니다. native Promise 완료만으로 다음 키를 처리하지 않습니다. 일반 문자는 focus된 TSF shadow에 쓰고 native 관측으로 알리며 readOnly/disabled/조합 중에는 이 쓰기를 거부합니다. TSF lock의 busy 응답만 제한된 시간 동안 재시도합니다. 이전 Core 응답은 암시적 요청 id를 포함해 새 명령의 완료로 처리하지 않습니다. 대기 중인 키는 종료 또는 5초 응답 기한으로 해제합니다. SDK 회귀와 surface fixture의 관측된 영문자를 사용하는 빠른 OS 키 묶음으로 이 경로를 검사합니다. native keyboard port2는 키/focus와 같은 sequence의 독립 WM_CHAR/Unicode 문자를 추가합니다. 실제 queued WM_CHAR 관측과 TSF focus 세대를 확인한 뒤 쓰며 dead/system/legacy IME 메시지를 이 관측으로 대신하지 않습니다. 실제 TSF가 소비한 keyup은 같은 canvas가 먼저 관측한 down의 해제를 전달하며, 이전 pending down을 먼저 발행합니다. focus/종료된 owner에는 전달하지 않고 관측한 down이 없는 소비 키로 raw packet을 만들지 않습니다. 물리 keyboard/IME 순서는 별도 검증이 필요합니다.

geometry/query 응답은 문자 입력 중에도 이어질 수 있으며 문서 키 대기를 막지 않습니다. 같은 확정 Core frame의 재발행은 현재 native 문자/caret 응답을 보존하고, 새 문서/frame이나 geometry 철회 때 무효화합니다. 현재 range bounds를 반복해서 비워 TSF가 같은 요청을 계속 보내는 순환을 방지합니다.

Windows host는 실제 bound Skia component와 정확한 Core owner를 요구하는 `TextInputSkiaSurface`를 설치합니다. surface는 정적인 SDK `NativeLayer` 안에 배치합니다. Core transform·clip은 Skia 안에서 처리하며 외부 RN/Animated container·native transform·둥근/사용자 native clip·native ScrollView는 전용 screen mapper가 필요하므로 이 producer에서 거부합니다. SDK 소유 container에 native animation을 붙이지 않습니다. 숨긴 SDK container는 살아 있는 View의 입력 lease를 유지하면서 화면 bounds를 철회합니다. 화면 bounds와 hit는 실제 ContentIsland converter·native clip 및 같은 Core frame의 native backing 세대를 사용합니다. 정수 bounds는 [명시적 native 반올림 모드](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.content.contentcoordinateroundingmode?view=windows-app-sdk-1.8)로 바깥쪽에 맞춰 소수 Core 사각형을 보존합니다. backing 교체 뒤 이전 caret·캐시 hit를 재사용하지 않으며 숨김/화면 밖 text는 빈 clipped bounds를 제공합니다. surface 종료는 해당 TSF service와 관찰자를 Skia binding 해제 전에 종료합니다. native admission은 Skia content id와 별도로 실제 Fabric React tag를 보존하며, tag/View owner가 교체되면 로컬 세대가 같은 값으로 재시작해도 거부합니다. 이 소스 경로와 default provider/현재 테스트베드 EXE·물리 IME 검증은 구분합니다.

`npm run test:windows-input-surface`는 현재 공급 header와 18개 라이브러리의 native input manifest(`NELYX_WINDOWS_NATIVE_INPUTS`, 기본 `Nelyx/.cache/native/windows/current/inputs.json`)를 사용합니다. 공개 기본 ApplicationSurface·WindowsInteraction으로 legacy editor module/font registry 없이 실제 GPU의 제품 Core 문단·caret을 그려 desktop glyph/caret 픽셀과 제품 TSF bounds를 대조하고, backing resize의 `NOLAYOUT`·문서 보존을 검사합니다. GPU/입력 drain 알림과 process 종료코드 0이 모두 필요합니다. `NELYX_WINDOWS_INPUT_DEBUG=1`은 한정된 native crash 진단이며 일반 실행의 종료 검증을 대신하지 않습니다. Windows Skia font loader는 이전 editor registry 없이 선언한 bytes/hash를 사용합니다. 정상 host/template의 visible editor 등록·font registry·protocol1 fixture는 제거했습니다. Skia font bytes/hash 검증은 유지합니다.


W8 cohort는 native ABI 1과 physical shadow/full-clip paint용 frame wire 9를 사용합니다. Native는 wire 1~8 수신을 유지하고 현재 RN startup·provider/native manifest는 일치하는 wire 9 build를 요구합니다. 아래 이전 wire 8 수락 기록은 과거 후보의 증거입니다. Windows offscreen Graphite 픽셀·Android build·Web UI의 증거는 구분하며 native 앱/window·물리 입력 수락은 남아 있습니다.

[English](README.md) | **한국어**

포커스된 Core 편집 binding 해제는 callback을 먼저 차단하고 React ref가 해제되기 전에 native blur를 전달합니다. 이전 필드의 해제가 새 focus owner를 blur하지 않으며 blur 실패에도 binding은 해제됩니다.

Android 키는 실제 Core의 handled/unhandled 응답까지 보유합니다. 응답 지연이나 대기 키 수로 unhandled 응답을 만들지 않으며, 명시적인 unhandled 응답만 같은 살아 있는 native focus 대상으로 재전달합니다. focus/owner 해제 때 대기 키를 폐기합니다.

현재 workspace는 Android keyboard host protocol3을 요구합니다. 실제 native codePoint/plainCodePoint·scan/device/source/flags/vendor/product와 raw/modern의 독립적인 문자 조합을 Core RawKeyEvent/KeyMessage 경로로 전달합니다. old protocol3 snapshot은 거부합니다. raw combiner는 down/up, modern combiner는 down에서만 진행하는 고정 원본 동작과 UTF-16 Character 투영을 유지하며 focus/retire 때 둘 다 초기화합니다. source scanCode0 raw ID와 modern keyCode opaque ID를 구분하므로 가상 Ctrl 조합도 동작합니다. 미지원 raw controller에는 기존 transport를 전달합니다.

최신 scroll motion 묶음은 scalar simulation·spring 해·painting 방향·scroll metrics/policy와 `ui/math` direct module을 추가합니다. 실제 finite vertical ScrollPosition의 drag/ballistic은 이 정책과 View별 viewport/DPR, `isScrollingNotifier`, 합쳐진 dimensions 보정과 owned ticker 해제를 사용합니다. 실제 layout에서 VerticalDrag recognizer를 구성하고 짧거나 비활성인 content에서는 제거합니다. 기존 `physics/spring`과 clamped programmatic jump는 호환 adapter로 유지합니다. Deprecated 전역 tolerance getter는 실제 global View가 필요하므로 현재는 `toleranceFor(actualMetrics)`를 사용합니다.

Scroll motion 예제는 제한된 cache의10,000고정 행, 원본 clamp/bounce/fast 정책, content 축소, 정책/controller 변경, 화면 종료와 phone 재진입을 소비합니다. 교체된 retained 자식에도 유효한 geometry를 주고 실제 scrolling 상태와 행 생성 수를 관찰합니다. 일반 가변/mixed/grid sliver와 전체 ScrollController/Activity/notification 계약은 남아 있습니다.

변경하지 않은 원본13개 Dart library body가 debug/release 각각49개 사례에서 일치했습니다. 실제 controller/ticker/scheduler/notifier 수명20groups와 Chromium/CanvasKit16flows/25exact runtime inputs, Core/SDK build·공통 types·strict direct declarations가 통과했습니다. 독립 source 감사는280spans·19refreshed anchors·77envelopes·1,066selections를 확인하며 전체 class 계약은 partial입니다. 이전 native/archive 증거는 당시 bytes를 유지합니다. related/I2 현재 native 공급, 물리/IME/reader/performance와 전체 W7-01..14는 계속 진행합니다.

이전 cursor/settings 묶음은 Web `basic`·unknown·`disappearing`의 고정 원본 fallback에 맞춰 inline cursor style을 제거하고 `none`은 숨김으로 처리합니다. 앱별 owner가 canvas와 실제 published DOM control/editor를 관리하며 재연결 전에 이전 editor를 해제하고 아직 소유한 style만 복원합니다. TapRegion은 custom `equals`·안정적인 `hashCode` group key를 받아 서로 다른 동등 객체의 callback을 묶습니다. 새 direct `ui/gesture-settings`는 physical 값·null을 유지하는 `copyWith`·값 동등성·local hash를 제공합니다. Android는 `ViewConfiguration.scaledTouchSlop`을 실제 DPR로 변환해 MediaQuery에 전달하며 관측하지 않은 값은 null입니다. 예제는 작은 화면의 스크롤과 실제 enter/hover/exit counter를 제공합니다.

Native cursor protocol1은 실제 View prop·JSI와 Windows/Android/AppKit/UIKit/GTK handler를 native View identity·owner 수명에 연결합니다. JSI version 조회는 필수 ViewApi receiver를 유지합니다. Windows26 IDC·Android33 최종 PointerIcon·macOS21 NSCursor 및 transparent none·Linux35 GTK 원본 mapping을 사용합니다. UIKit은 지원되는 beam/precise/hidden API와 나머지 desktop kind의 OS default를 사용합니다. MethodChannel 성공은 React prop staging이며 native 적용 완료와 정확한 pointer-icon 상태 확인은 별도입니다. Apple/Linux 전용 native build/run/harness는 SKIPPED, provider는 notVerified입니다.

Core 문단 예산은 Web/native provider가 공유합니다. View마다 정상 producer 256개 / resident layout 1,024개, 텍스트 65,536 / 262,144 UTF-16 units, 직렬화한 UTF-16 입력 데이터 4 / 16 MiB를 제한합니다. 정확한 교체와 동기 측정에는 producer reserve 1개를 허용하며 retained recording/GPU holder는 실제 해제까지 예산에 포함합니다. 부하 제한과 native heap·표시 FPS 측정은 구분합니다. [Core 텍스트 계약](../README.ko.md)을 참고하세요.

검증은 기록된 단계의 surface34+owner19groups, 원본 scalar debug/release 각각6cases, hover note 이전 browser75flows/81inputs와 현재 sample의 focused9flows를 보존합니다. 현재 API33/x86_64 Android APK는 touch·실제 OS mouse hover·group·drop·재진입·keyboard16flows와 process log 무오류, native touch slop8을 확인했습니다. Windows는 현재 native supplier·HBC99/source cohort 빌드를 확인했으며 Computer Use native pipe 연결 불가로 현재 UI는 notVerified입니다. 전체 W7·binary PointerData/semantics·물리/IME/reader/performance 수락과 related/I2 최종 공급은 남아 있습니다. 아래 이전 기록의 byte 범위는 유지합니다.

이전 Gesture surfaces 수락 기록은 direct `framework/gestures/drag`, `eager`, `multidrag`, `framework/widgets/tap-region`, `overlay`, `drag-target`, `framework/rendering/meta-data`, `services/mouse-cursor`를 추가합니다. Multi-drag/eager는 실제 View binding을 사용합니다. Draggable/LongPressDraggable feedback은 bounded Overlay에 표시되고 DragTarget은 실제 metadata hit path를 소비합니다. TypeScript에서 지워지는 데이터 타입에는 필수 `isDataType` guard를 지정합니다. TapRegion은 그룹별 inside/outside down/up과 외부 탭 소비를 지원합니다. Surface는 의도한 탭 영역을 감싸야 하며 내부 제어 버튼도 소비에 참여합니다. 같은 View의 retained semantics rect는 tap/long-press region에 알리고 선정 Navigator route visibility는 숨은 route의 알림을 억제합니다. Dart custom-equality group key·전체 ModalRoute/semantics ABI·content sizing/Portal overlay는 남아 있습니다.

MouseRegion·RenderMouseRegion·FocusableActionDetector는 실제 View service의 cursor session과 stationary 갱신을 소비합니다. Browser port는 해당 앱 canvas의 style만 바꾸고 종료 시 소유한 style을 복원합니다. Native cursor handler와 DOM control 범위는 남아 있습니다. 현재 `basic`/`disappearing` CSS 처리는 고정 engine과 차이가 있어 수정 대상으로 기록했습니다. MediaQuery의 inherited gesture settings가 실제 recognizer factory와 draggable에 전달되며 명시적 settings/null이 우선합니다. ScrollConfiguration과 native 관측 settings는 남아 있습니다. Callback에서 tree를 dispose하거나 예외가 나도 client·route·timer·avatar·overlay entry의 소유권을 정리합니다.

현재 surface20+owner/provider15+영향 회귀83 groups, Core/SDK build·공통/direct declarations가 PASS입니다. 원본 oracle은 변경하지 않은 library body14개를 보존하고 실제13개를 로드합니다(이번 entry에서 tap.dart는 사용하지 않음). assertions/debug-release 각각18개 시나리오가 일치합니다. Chromium147/CanvasKit63flows/75exact runtime inputs에는 새 surface14개 흐름이 포함되며 screenshot에서 제어 버튼 사용성을 검토했습니다. source/controlled/browser 범위의 증거입니다. 전체 W7·native/물리/reader/performance 수락·최종 공급은 남아 있으며 아래 이전 family/native/archive receipt의 byte 범위는 유지합니다.

전체 gesture family 흐름은 direct `framework/gestures/force-press`, `long-press`, `multitap`, `scale`을 추가합니다. 실제 View binding을 넣어 `new DoubleTapGestureRecognizer({binding: owner.gestureBinding})`, LongPressGestureRecognizer·MultiTapGestureRecognizer·SerialTapGestureRecognizer·ScaleGestureRecognizer·ForcePressGestureRecognizer를 생성합니다. GestureDetector는 tap/double/long/axis/pan/scale/force callback을 구성하며 RawGestureDetector factory에서 독립 multi/serial tap도 사용할 수 있습니다. Long press는 primary/secondary/tertiary 전체 callback, 기본500ms deadline과 선택적 duration을 지원합니다. Scale은 focal/span/rotation·접촉 구성 변경·trackpad panzoom/scroll factor를 처리합니다. retained long-press semantics는 down/start/press/end/up을 호출합니다. 실제 View settings는 명시적으로 주입하며 implicit MediaQuery/ScrollConfiguration과 전체 Source semantics ABI는 partial입니다.

native/browser logical device ID는 반복되므로 Root가 접촉마다 양수 Source pointer ID를 배정하고 legacy DTO/mouse callback에는 native ID를 유지합니다. Source hover/signal/orphan과 native control 관측은 pointer0을 사용합니다. Callback 안에서 dispose해도 진행 중인 tap tracker·보류 arena·route·timer를 동기 정리하며 실패 경로에서도 독립 정리를 시도합니다. Force는 실제 raw pressure range가 필요합니다. 현재 browser/RN logical producer는 그 범위를 공급하지 않으며 force 증거는 controlled Source event에 한정됩니다.

Gesture families 샘플은 double tap·long press/취소·두 손가락 확대·독립 multi tap·serial tap·화면 재진입을 소비합니다. import/export만 변경한 원본 Dart14개 library body와 명시적 harness fixture의 debug/release 각각24개 state 시나리오가 일치합니다. 현재 family35+ownership10+영향 회귀83 groups, Core/SDK build·공통/strict direct declarations와 Chromium147/CanvasKit49flows/59exact runtime inputs가 PASS입니다. source/controlled/browser 증거이며 native·물리·reader·performance·전체 W7은 남아 있습니다. 아래 이전 recognizer/arena/native/archive receipt는 당시 범위를 유지합니다.

이전 base recognizer 단계은 direct `framework/gestures/recognizer`, `tap`, `monodrag`, `drag-details`, `velocity-tracker`, `lsq-solver`, `gesture-details`에서 제공합니다. `new TapGestureRecognizer({binding: owner.gestureBinding})`처럼 실제 View binding을 주입합니다. Tap은 primary/secondary/tertiary callback과 global slop/deadline을 처리합니다. axis/pan은 투영된 details, start/down origin, fling, panzoom, latest/sum/average-boundary 다중 pointer 전략을 처리하며 평균 계산은 실제 View frame epoch를 사용합니다. VelocityTracker는 실제 sampling clock을 주입할 수 있습니다. GestureDebug callback trace도 invokeCallback에서 소비합니다. dispose는 callback/reporting 오류 뒤에도 실제 route·arena entry·deadline timer를 정리합니다.

`framework/widgets/gesture-detector`는 실제 tap/axis/pan recognizer를 구성합니다. options에 `onTapDown/Up/Move/Cancel`, secondary/tertiary tap, `onHorizontalDrag*`, `onVerticalDrag*`, `onPan*` callback을 받으며 기존 `onDrag(dx,dy)`/`onDragEnd(vx,vy)`는 pan details adapter입니다. 기본 `deferToChild`는 원본과 같으므로 자체 hit가 없는 빈 child에는 `behavior: HitTestBehavior.opaque`를 지정합니다. `framework/widgets/raw-gesture-detector`는 RawGestureDetector, 실제 constructor-token factory, SemanticsGestureDelegate를 제공합니다. Dart factory의 `constructor()`는 TS에서 `createRecognizer()`이며 같은 실제 View에 속한 정확한 선언 type을 반환해야 합니다. `framework/rendering/semantics-gesture-handler`는 retained semantics의 tap·방향 scroll action을 처리합니다. Source SemanticsConfiguration과 default long-press family는 남아 있습니다. Root는 생략된 logical movement delta만 같은 epoch의 실제 접촉 위치 차이로 계산하고 producer가 준 delta를 유지합니다.

Gesture recognizers 샘플에서 tap details·secondary/tertiary·취소·axis/pan·비활성화·재진입을 소비합니다. 현재 recognizer25·retirement/frame8·logical ingress4·영향 pointer46 groups, 변경하지 않은 원본 numeric body의 debug/release 각각29 cases가 PASS입니다. Core/SDK build·공통/direct declarations와 Chromium147/CanvasKit40 flows/54 exact runtime inputs도 PASS입니다. PositionedGestureDetails는 structural declaration contract로 runtime bundle과 별도 검사합니다. source/controlled/browser 범위이며 모든 class와 전체 W7은 partial입니다. 그 단계에는 double/long/scale/force가 없었으며 현재 family 증거는 위에 있습니다. implicit MediaQuery/ScrollConfiguration·allocation tracing·native producer/cohort·물리/reader 수락은 남아 있습니다. 아래 이전 arena/native/archive receipt는 당시 범위를 유지합니다.

`framework/gestures/arena`는 고정 Flutter의 실제 GestureDisposition·GestureArenaEntry·GestureArenaManager를 제공합니다. `entry.resolve(GestureDisposition.accepted/rejected)`를 사용합니다. 기존 bool 인수는 deprecated compatibility overload입니다. close의 단일 후보 승리는 microtask에서 일어나고, hold는 sweep만 지연합니다. sweep은 첫 후보를 먼저 accept한 뒤 나머지를 reject하며 explicit/eager 승리는 loser를 먼저 reject합니다. entry/default callback은 실제 arena identity를 capture하여 재사용된 pointer ID의 새 경쟁을 건드리지 않습니다. View cancel/dispose는 소유권을 먼저 제거하고 오류가 있어도 남은 rejection을 진행합니다.

`framework/gestures/team`의 `new GestureArenaTeam(owner.gestureBinding.gestureArena)`은 같은 실제 manager에서 경쟁합니다. `team.add(pointer, member)`와 nullable `team.captain`을 사용하며 captain은 직접 등록된 member가 아니어도 됩니다. process singleton을 만들지 않고 실제 owner arena를 명시적으로 주입합니다. ESM의 debug flag는 direct `framework/gestures/debug`의 `GestureDebug` 정적 field로 설정하며 Binding의 hit/hover/sampling margin과 arena 진단이 실제로 소비합니다. `debugAssertAllGesturesVarsUnset(reason)`은 원본처럼 hover flag를 검사에서 제외합니다. 이전 arena 단계에는 recognizer callback trace 소비가 없었으며 현재 위의 source 흐름에서 연결했습니다. 나머지 gesture 시스템과 전체 runtime 수락은 남아 있습니다.

이전 arena 단계의 legacy TapDragRecognizer/GestureDetector 소비 경로는 arena acceptance와 drag recognition을 분리하여 기본 승리 뒤 작은 이동을 tap으로 유지합니다. 전체 Flutter recognizer API 이식으로 주장하지 않습니다. 샘플 Gesture arena에서 실제 tap/drag slop, team의 first/explicit/captain/outside 선택과 재진입을 확인할 수 있습니다. 원본의 변경하지 않은 arena/team/debug body를 별도 Dart library로 실행한 assertions on/off 각각14 항목이 현재 TS debug/release와 일치합니다. 이 standalone 알고리즘 oracle의 foundation 출력/오류·binding context는 명시적 fixture이며 전체 Flutter/native 수락이 아닙니다. 추가 owner/실제 소비 계약12와 이전 pointer46, strict declarations/common types가 PASS이고 현재 Chromium/CanvasKit32 flows/45 exact inputs가 PASS입니다. 모든 class와 전체 W7은 partial이며 native/cohort·물리 timing/reader 수락은 별도입니다.

실제 pointer event는 `framework/gestures/events`, `PointerDeviceKind`는 `ui/pointer`에서 직접 import합니다. `kind`는 device enum이며 `position`은 전역 좌표, `localPosition`·`localDelta`는 event transform을 적용한 좌표입니다. PointerRouter와 MouseRegion callback은 실제 enter/exit/hover class를 받습니다. Root는 `framework/gestures/pointer-event-adapter`로 기존 logical transport를 변환합니다. `ui/input` PointerEvent는 hit target용 전역 좌표/local transform metadata를 가진 embedding DTO로 유지합니다. 새 cohort 공급 시 수동 router의 DTO x/y 소비를 source position/localPosition으로 이행해야 합니다.

`ui/pointer`의 PointerData/PointerDataPacket과 `framework/gestures/converter`는 공급받은 physical data를 View별 DPR로 lazy 변환합니다. `pointer-signal-resolver`는 같은 canonical signal의 첫 등록을 고르고, `gesture-settings`·`constants`는 logical slop 설정과20 constants를 제공합니다. Duration은 milliseconds입니다. 원본 copy/factory의 field 생략을 유지하며 정확한 공개 instance는 freeze하고 subclass의 추가 field는 허용합니다. transformed wrapper는 concrete type/canonical original을 유지합니다. button mask는 명시적인53-bit safe-integer adaptation이며 packet은 caller batch를 snapshot합니다.

`framework/gestures/binding`의 GestureBinding이 실제 View의 큐·입력 잠금·보관된 hit 경로·취소·pointer route·arena 연결·signal 선택을 소유합니다. Root의 render target을 먼저 호출하고 마지막 Binding target에서 전역 route를 실행합니다. `framework/gestures/hit-test`는 실제 HitTestEntry/Result와 변환 스택, `resampler`는 단일 스트림 보간을 제공합니다. `framework/widgets/listener`의 `new Listener(child, {behavior: HitTestBehavior.opaque, onPointerDown, onPointerSignal})`을 사용하며 HitTestBehavior와 RenderPointerListener·callback 타입은 `framework/rendering/pointer-listener`에서 직접 import합니다. 기존 `gesture-detector` Listener는 deprecated logical DTO 어댑터로 남습니다.

mounted Element의 `owner.gestureBinding.pointerSignalResolver.register(event, callback)`으로 첫 signal 소비자를 등록합니다. 선택된 callback이 `event.respond({allowPlatformDefault: false})`를 소유합니다. SingleChildScrollView/LazyList는 실제 이동 가능성을 먼저 검사하고 선택된 뒤에만 스크롤하므로 더 가까운 Listener가 우선할 수 있습니다. 기존 사용자 onPointer Boolean wheel callback은 동기 compatibility 경로이며 source signal arbitration과 동일한 API가 아닙니다.

resampling은 기본 off, samplingOffset은 -38 milliseconds입니다. Root는 실제 입력/frame clock과 scheduler를 사용하며 logical touch stream에는 내부 opaque 키를 사용합니다. 관찰하지 않은 physical device 번호를 만들어내지 않고 공개 device 기본값0을 유지합니다. cancelPointer의 front/microtask 취소도 같은 logical sampler를 사용하며 마지막 contact 취소·hide·dispose 뒤 timer/예약 frame의 재시작을 차단합니다. hit path·transform은 down부터 유지하고 retired render target과 hidden View 입력은 거부합니다.

앱 ServicesBinding은 실제 PlatformDispatcher의 typed onPointerDataPacket/onHitTest를 연결하고 공개 callback 교체를 보존합니다. supplied physical packet은 현재 DPR와 View delegate를 admission 때 capture하여 A→B→A 순서를 유지하며, 중간에 같은 View ID를 재등록해도 옛 packet을 전달하지 않습니다. HitTestRequest의 view는 실제 ID를 제공하는 최소 port이며 전체 FlutterView 이식이 아닙니다. native binary PointerData codec/생산자는 아직 연결되지 않았고 native-control의 별도 관찰 경로는 전역 route만 소비합니다.

Pointer dispatch 단계의 gesture/Root/app/cancel 계약34·global13과 이전 영향 회귀91, Core/SDK build·공통 types·직접 declaration 소비가 PASS입니다. 실제 Chromium147/CanvasKit24 흐름/40 source inputs에서 영역 밖 release·두 touch의 resampling/release·첫 signal 소비/부모 scroll·재진입을 확인했습니다. 전체 Source GestureBinding singleton/BindingBase·전체 recognizers/GestureDetector·native device/pressure/panzoom/settings·물리 timing/reader·새 archive/cohort는 미완료입니다. 이전 Windows5fc2e65a/Android33d27383 native 영수증은 현재 source 수락이 아닙니다. 전체 W7은 ACTIVE/PARTIAL입니다.

FrameworkRoot는 실제 keyboard·global pointer·semantics action handler를 함께 등록합니다. embedding은 View 소유 port를 명시해 `FocusManager.registerGlobalHandlers({pointerRouter, semantics, registerKeyMessageHandler})`를 호출할 수 있으며 실패 시 rollback, 종료 시 세 port 해제를 수행합니다. `framework/gestures/pointer-router`는 embedding PointerEvent의 pointer별/global snapshot·변환을 처리하며 현재 concrete event 계층은 위 안내를 따르며 전체 gesture binding/native 수락은 남아 있습니다. `ui/semantics-action`은 원본26개 SemanticsAction ID와 SemanticsActionEvent를 제공합니다. 기존6개 UI transport action 문자열은 ui/types에 유지합니다. `framework/semantics/binding`은 실제 action listener와 ByteData 해독을 current-node action보다 먼저 수행하며 enablement handle·accessibility features·전체 binding은 partial입니다.

native control의 실제 pointer/touch 관찰은 canvas hit-test를 다시 수행하지 않고 소유 router로 전달하며 노출된 accessibility focus action은 같은 semantics dispatcher로 전달합니다. Web nonediting semantics control은 실제 DOM focus 후에도 공통 입력 영역과 구체적인 element 소유권으로 키를 받습니다. 다른 소유자의 control과 native text 편집 기본 동작은 기존 경로를 유지합니다. 제어13 cases·Core91 회귀·실제 Web14 흐름/23현재 source inputs가 PASS입니다. 이전 Windows5fc2e65a/Android33d27383 native UI 영수증은 이번 global 변경 전 소스 범위이며 현재 native control·물리/reader와 archive/cohort 수락은 남아 있습니다.

현재 소스의 개발 APK는 explicit workspace 연결로 API33/x86_64의 raw callback·Ctrl/capture/focus/fallback·Actions/Enter를 통과했습니다. native overlay는 빌드 뒤 원본 bytes로 복원했고 새 archive/cohort는 아직 공급하지 않았습니다. 관련 keyboard 통합에서 새 SDK/Core 버전·provider/range/template/lock을 함께 이행해야 합니다. 물리 키보드/dead-key/IME/reader와 전체 native critical-key 알고리즘은 미수락입니다. SDK는 combiner 원본의 2013 engine notice를 자체 licenses에도 보존합니다.

Windows workspace도 대응 Skia view의 native keyboardVersion1을 요구합니다. View 세대·sequence와 실제 scan/VK/modifier/lock/repeat·CharacterReceived 문자를 key/focus packet으로 전달하며 stale packet은 거부합니다. canvas의 기존 JS key callback을 꺼 raw/modern 중복을 막고 editor sibling은 기존 경로를 유지합니다. modern scanCode0은 opaque keyCode ID로 구분하며 공개 raw는 원본 충돌을 유지합니다. Windows raw 단계 개발 EXE의17 관측 흐름에서 q/ShiftQ·Ctrl capture/focus/fallback·route/focus 재진입·editor q/첫 canvas 클릭·Actions/Enter/Space/pointer/hover/Tab을 확인했습니다. 두 최종 상태는 접근성 텍스트가 한 frame 늦어 실제 screenshot 관측으로 구별했습니다. native 두 header overlay는 정확히 복원했습니다. explicit workspace 경로는 portable map inventory에서 거부됐으므로 개발 EXE 증거이며 portable/cohort/archive 수락이 아닙니다. 전체 native handled/redispatch/menu 정책은 미완료입니다.

이전 public listener/owner 및 native observed-state 단계는 실제 Core 위젯의 Listener raw/modern 표시를 함께 검증했습니다. native method `getKeyboardState`는 protocol1의 실제 keyCode/scanCode 기록을 반환하고 SDK가 `flutter/keyboard` StandardMethodCodec으로 연결합니다. 기록은 React 컨텍스트별 focused canvas에 한정하며 handoff·repeat/layout·한도·retire를 처리합니다. OS 전체 held-state/전체 critical-key 알고리즘이나 다수 SDK bootstrap의 공용 RN 컨텍스트 격리는 수락하지 않았습니다. C++7/Kotlin7 및 실제 plugin/Core9 제어 검사, Windows11·Android9·Web10 개발 흐름이 PASS입니다. Windows EXE5fc2e65a/HBC99/812sources는 JS15·header5, Android APK33d27383/HBC96/813sources는 JS15·Kotlin7의 현재 bytes와 연결됩니다. native UI는 0개 조회, nonempty 기록은 제어 검사 범위입니다. native overlay는 정확히 복원했고 Web 선택적 조회는 unavailable입니다. portable map guard의 workspace 경로 거부를 보존했으며 새 공급 cohort는 아직 없습니다.

과거 W8 cohort는 core0.16.0 / SDK0.20.0, coreRange `>=0.16.0 <0.17.0`, Skia0.6.0·Metro/CLI0.10.0을 사용했습니다. 선정 디자인은 독립 패키지로 이동했으며 [Core import 안내](../README.ko.md#디자인-패키지-import)를 따릅니다. 현재 상태는 [work14.md](../../work14.md)에서 관리하며 아래 과거 버전 이력과 구별합니다.

SDK0.19는 Skia0.5의 Windows native pointer port1을 요구하므로 대응 view source로 Windows host를 다시 빌드해야 합니다. press/move/release/exit와 wheel은 native callback의 논리 좌표·surface 세대 검사를 거쳐 전달하며 SDK의 monotonic 수신 clock을 사용합니다. 기존 RNW pointer callback을 동시에 받지 않습니다. native producer에서 내부 좌표의 mouse-release leave와 실제 이동/이탈을 구분하고 pointerVersion1 없는 이전 view는 거부합니다. 전체 event hierarchy·cursor·물리 device와 native editor/semantic overlay 입력 수락은 partial이며 현재 native 실행 증거와 구별합니다.

SDK0.18은 Web pointerleave와 desktop RN onPointerLeave를 View 소유 mouse tracker에 전달합니다. Android keyboard protocol3의 optional flags로 virtual/soft key provenance를 유지하며 이전 flags 없는 snapshot도 받습니다. native ABI1·frame wire8·text-style1·boundary1은 유지합니다. native semantic button/editor의 전역 pointer/표시 경로·Android/iOS hover·cursor와 전체 platform keyboard 수락은 남습니다. 현재 변경의 개발 Web 확인을 새 native 설치 수락으로 확대하지 않습니다.

SDK0.16.1은 Windows native control을 focusable canvas host의 형제에 배치해 화면 복귀 후 editor가 다시 focus를 받을 수 있게 합니다. Windows button은 UIA InvokePattern에 필요한 native accessibility tap을 연결합니다. 대기 중인 semantics action은 같은 살아 있는 control의 새 paint snapshot을 허용하고 최신 action·disabled 상태를 사용합니다. control 제거·role 변경·서비스 종료는 이전 callback을 무효화합니다. native ABI·frame wire·keyboard protocol은 유지합니다. 현재 Windows runner는 패키지의 `src` 조건을, Android는 emitted `dist`를 선택합니다. workspace 코드를 연결할 때 대상의 실제 module 경로를 확인해야 하며 `dist`만 교체하면 Windows runtime은 갱신되지 않습니다.

Android의 포커스된 canvas와 비시각적 입력 endpoint는 공통의 순서 있는 hardware key 응답 대기열을 사용합니다. 명시적인 Core unhandled 응답만 key를 native 트리에 돌려주며 시간이나 대기 수로 unhandled를 추정하지 않습니다. native focus 상실/분리 때 대기 입력을 취소합니다. protocol3은 raw metadata·별도 modern 문자와 lock snapshot을 전달하고 focus gained/lost를 key와 같은 순서로 처리합니다. 앱 소유 HardwareKeyboard가 pressed state를 보정한 뒤 현재 focus의 Actions/Shortcuts와 deprecated onKey를 실행합니다. 물리/IME 소비 키 관측·전체 locale/dead-key 동작과 시작 상태 producer는 잔여입니다.

Windows는 canvas 자체가 native focus를 소유할 때 일반/Shift Tab을 예약해 framework 순회와 native semantic proxy 이동이 겹치지 않게 합니다. native editor의 Tab·텍스트 경로는 유지합니다. 표준 RNW 속성을 focus 알림 후 적용하는 정책이며 모든 shortcut의 동적 native 응답이나 focus 전환 timing stress를 수락한 것은 아닙니다.


core0.11.0 / SDK0.13.0의 coreRange는 `>=0.11.0 <0.12.0`이며 Skia-RN/Web·Metro·CLI0.3.0을 함께 사용합니다. Rich typography에는 `ParagraphBuilder.nelyxTextStyleVersion() === 1`을 제공하는 새 native binding이 필요하고 wire8/opaque ABI1은 유지합니다. 원래 Typeface 출처를 입증할 수 없는 `TextGlyphRun.fontSource`의 `unknown` 값도 처리하세요. 관련 runner archive와 native supplier를 함께 갱신해야 합니다.

앱 asset에는 `notice: {path: './assets/font-OFL.txt'}`를 선언할 수 있습니다. runner는 해시를 자동 계산하고 별도 regular file·notice1MiB 및 공통 입력64MiB 상한을 확인합니다. packager는 선언한 notice를 폰트와 함께 복사하고 Android APK assets·Windows Assets/licenses에도 포함합니다. 배포 artifact에 전체 font notice/license를 유지하세요. 명시적 notice 전달 기능이며 전체 license inventory나 법적 분류 서비스는 아닙니다.

`@nelyx/sdk`는 [core 계약](../README.ko.md)을 플랫폼 앱, 입력 서비스, 자산, Skia 렌더러와 네이티브 호스트 수명에 연결합니다. 전체 앱 구성은 [샘플 가이드](../../sample/nelyx-testbed-app-2/README.ko.md)를 참고하세요.

SDK는 core Widget 앱에 View별 text·assets·clock·editing·semantics 서비스를 제공합니다. native/DOM 편집·접근성 컨트롤을 framework layout에 연결하고 Widget·Element·RenderBox 상태는 core가 소유합니다. [Widget API](../README.md#widget-applications)와 [현재 수락 범위](../../work5.md)를 참고하세요.

에셋과 notice의 `sha256`은 생략할 수 있으며 기본 앱 구성에는 넣지 않습니다. runner 준비·타입 검사·Metro 시작 시 현재 파일에서 자동 계산해 생성되는 `runner/app-config.json`에만 저장하고 루트 패키지는 수정하지 않습니다. 각 runner main은 이 내부 자산 메타데이터를 확인한 뒤 등록합니다. 패키지 자산은 설치된 원본과 비교해 복사하며 수정된 기존 대상 파일은 보존하고 오류로 보고합니다. 명시한 해시가 있다면 일치 여부도 확인합니다.

## 앱 API

`@nelyx/sdk/platforms/<target>/<module>`에서 import합니다. 대상은 `windows`, `android`, `ios`, `macos`, `linux`, `web`이며 공개 하위 경로는 [`package.json`](package.json)에 있습니다.

| 모듈 | 용도 |
| --- | --- |
| `platforms/<target>/application` | 공통 앱을 플랫폼에 연결 |
| `platforms/<target>/surface` | 렌더링 표면 표시 |
| `platforms/<native-target>/controls` | 앱에서 사용하는 네이티브 컨트롤 |
| `runtime/config` | package.json 앱 구성 검증 |
| `runtime/assets` | 설정된 자산 로드와 검증 |
| `runtime/providers` | provider profile과 런타임 요구 조건 확인 |

정확한 모듈 하위 경로를 사용합니다. 플랫폼 모듈이 backend를 구성하고, 앱은 공통 상태와 장면을 `src/`에, 등록 코드와 플랫폼 설정을 `<target>/runner/`에 둡니다.

## 설정과 provider

샘플의 [`package.json`](../../sample/nelyx-testbed-app-2/package.json)의 `nelyx`에 앱 정보, 자산 식별자·경로와 대상별 profile·cohort를 선언합니다. 각 runner main은 앱 component를 import하고 `registerApplication`을 직접 호출합니다. CLI도 같은 패키지 구성으로 준비·빌드하며 별도 앱/config 매니페스트나 루트 bootstrap 파일은 필요하지 않습니다. 패키지 폰트는 `icon-assets`가 제공하는 메타데이터를 JSON으로 옮겨 `nelyx.assets`에 넣으며 `packageSource`와 notice를 함께 유지합니다.

[`providers/`](providers/)에는 생성된 대상별 manifest와 schema가 있습니다. Profile의 구현·capability와 qualification은 구분하며 qualification은 `notVerified`입니다. 렌더러 입력, React Native/Hermes 버전, ABI와 provider cohort를 일치시켜야 합니다.

## 책임과 수명

`NativeInteraction`의 service lifetime 반환은 편집기·semantics를 비운 뒤 아직 등록된 모든 observer에 통지합니다. observer 오류는 falsey throw까지 보존해 통지 뒤 보고합니다. 영구 dispose는 먼저 새 binding·구독을 닫고 정리한 뒤 retirement를 한 번 게시합니다. 이전에는 acquired lifetime의 빈 갱신도 별도로 게시할 수 있었습니다. service lease 반환은 새로운 편집기 generation을 가진 다음 lifetime을 허용합니다. 지연된 일반 semantics action은 원래 node lifetime의 현재 callback을 찾되 첫 전달 전에 요청을 소비합니다. 중복·재진입 전달, disabled·교체된 node와 callback 오류로 같은 요청을 다시 실행하지 않습니다.

| 계층 | 책임 |
| --- | --- |
| 공통 앱 | 상태, 장면 구성과 앱 정의 |
| SDK TypeScript | core session, 렌더러 구성, 입력, 자산과 view 수명 |
| SDK 네이티브 호스트 | 앱 bootstrap, 창·종료 정책과 개발 bundle 선택 |
| Skia 패키지 | GPU device/session, recording, 텍스트, JSI와 네이티브 렌더링 표면 |
| 플랫폼 runner | 의존성, 등록 코드, Metro/Babel과 Gradle/Xcode/MSBuild/CMake |

Windows 호스트 코드는 [`native/windows/`](native/windows/)에, Linux GTK 호스트 코드는 [`native/linux/`](native/linux/)에 있습니다. [`native/apple/AppleRuntimeTeardown.h`](native/apple/AppleRuntimeTeardown.h)는 CLI 런타임 patch에 Apple 종료 상태를 공급합니다. 런타임 overlay와 공급 patch는 [`../upstream/`](../upstream/)에 있습니다.

런타임은 cohort/ABI, 자산 hash·byte 제한, owner generation, GPU 작업 완료와 종료 drain을 확인합니다. Drain 실패 시 종속 자원을 보존합니다. 전체 startup/fatal/강제 종료와 graphics loss/recovery qualification은 미완료입니다. [프로젝트 상태](../../README.ko.md#프로젝트-상태)를 참고하세요.

## 빌드와 확인

저장소 루트에서 `npm ci` 후 실행합니다.

```powershell
npm run build:sdk
npm run check:types
npm run check:metro-types
npm run check:cli-types
```

`build:sdk`는 core·렌더러 패키지·SDK를 빌드한 뒤 provider와 CLI 패키지 자산을 생성합니다. Check 명령은 각각 패키지·샘플, Metro 선언, CLI 선언을 compiler로 확인합니다. SDK만 typecheck하려면 `npm run check --workspace @nelyx/sdk`를 사용합니다.

앱 생성과 대상별 명령은 [CLI 가이드](tooling/cli/README.ko.md), bundle·개발 설정은 [Metro 가이드](tooling/metro/README.ko.md)에 있습니다. 빌드와 compiler 확인은 기기·GPU 화면 표시·접근성·배포 수락과 구분합니다.

## 라이선스

Nelyx 작성 코드는 [BSD-3-Clause](LICENSE.md)를 따릅니다. 서드파티 고지는 [`licenses/`](licenses/)에 유지합니다.

Android template은 설치된 SDK의 editing/environment package와 native source 경로를 등록합니다. surface 종료 시 WindowInsets/layout observer를 해제하며 editor binding 교체는 native control을 remount합니다. 새 native counter와 기존 논리 revision을 구분하고 이전 token 이벤트를 거절합니다.

core0.8.0 / SDK0.10.0의 coreRange는 >=0.8.0 <0.9.0입니다. core가 foundation/serialization과 services/message-codec/message-codecs direct module을 제공합니다. int64는 bigint, wire buffer는 DataView/native typed array, JSON decode object는 Map입니다. MethodCall과 서비스 예외는 message-codec에서 직접 import하며 aggregate 재수출은 없습니다. nullable message 예외는 foundation/errors의 Exception protocol을 구현하고 JS stack과 native stacktrace를 구분합니다. 실제 frame encoder는 WriteBuffer를 사용하며 ABI1/wire5·기존 bytes·exact-size backing storage를 유지합니다. 원본·portable package·Windows Hermes 코덱 수락은 BinaryMessenger·native plugin transport·target UI 수락을 뜻하지 않습니다. 수치·Map·정렬·수명 차이는 core 문서를 따르며 Apple/Linux native 검증은 사용자 지정 SKIPPED입니다.

core0.9.0 / SDK0.11.0의 coreRange는 >=0.9.0 <0.10.0입니다. platform message는 BackendServices·공통 RN surface props·WebApplicationOptions로 owned PlatformMessagePort를 받습니다. bootstrap이 startup/View services와 ComposedApplication에 per-app binaryMessenger를 제공합니다. 단일 realm-default owner만 useDefaultBinaryMessenger를 선택하고 동시 앱은 messenger를 채널에 직접 주입합니다. 필요한 경우 core EventChannel의 네 번째 인수 controlBinaryMessenger로 listen/cancel도 같은 owner에 연결합니다. SDK 종료는 send gate 전에 동기 stream 정리를 수락하고 uncertain/pending snapshot을 native retirement까지 보존하며 자원 해제 전에 framework scheduling을 멈춥니다. 확인된 port retirement는 cached profiling 참조를 해제하고 module-scoped channel을 새 default owner에 연결할 수 있게 합니다. 이 시점 이후 정리 callback 오류는 앱 자원 해제를 막지 않으며 native drain 실패는 자원을 보존합니다.

기본 Web/RN surface가 앱 소유 OS plugin port를 만들고 startup/View services와 앱에 `platformServices`를 제공합니다. `writeText`, `readText`, `hasStrings`, `environment`, `addObserver`로 클립보드와 환경을 사용합니다. 권한 실패·미지원 호출은 typed PlatformException으로 반환합니다. browser history는 같은 origin으로 제한합니다. Android는 BackHandler, Windows·Apple·Linux는 소유 root 창의 종료 경로를 사용합니다. Navigator의 기본 Android Back 소유권을 연결하며 predictive Back은 미완료입니다. custom byte-only port는 OS protocol을 구현한 경우 `initializePlatformServices: true`를 지정합니다. 직접 plugin을 등록할 때는 `runtime/plugin-port`의 PluginPlatformMessagePort를 사용하고 앱 dispose를 await합니다.

선호 언어는 Windows GetUserPreferredUILanguages, Android Configuration.locales, Apple NSLocale.preferredLanguages, Linux GLib language names에서 읽습니다. Android/Windows runner가 NelyxPlatformServices를 등록하며 Apple Podfile은 SDK의 local podspec을 포함합니다. 구독 중 1초 polling과 RN lifecycle/configuration event로 갱신하고 `localeObservation`으로 방식을 표시합니다. 같은 조회 오류를 중복 통지하지 않으며 마지막 정상 환경을 보존하고 복구를 통지합니다. POSIX 언어 이름은 임의의 영어 기본값 없이 정규화합니다. module이 없는 host의 RN constants/`runtime` fallback은 출처를 구별합니다. 전체 locale/configuration·나머지 Flutter services는 PARTIAL이고 Apple/Linux native 검증은 사용자 지정 SKIPPED입니다.

background task는 `application.workerDispatcher`의 root에 MessageChannel endpoint와 cloneable `token`을 전송한 후 `runtime/worker-messages`의 BackgroundPlatformMessageConnection을 구성합니다. endpoint가 접근을 부여하고 token은 앱을 식별합니다. worker를 종료하기 전에 connection.dispose를 await합니다. 실제 Worker 생성은 host 책임이며 Hermes용 Worker runtime/Dart VM isolate를 제공하지 않습니다.

원본 대응 API는 core의 `ui/root-isolate-token`, `ui/platform-dispatcher`, `services/background-isolate-binary-messenger`에서 직접 import합니다. ServicesBinding.rootIsolateToken은 realm default를, platformServices.rootToken은 명시적 앱을 선택합니다. token은 toMessage/fromMessage로 직렬화합니다. 비Web worker에서 connection.initializeBackgroundIsolate를 await한 뒤 원본 background messenger 또는 messenger 생략 source channel을 사용할 수 있습니다. IO facade는 send-only·중복 초기화·pending drain을 유지하고 누락 plugin의 nullable 응답에도 요청 id를 붙여 완료시킵니다. 별도 background-isolate-binary-messenger-web은 원본처럼 UnsupportedError를 던집니다. browser DedicatedWorker 연결은 별도 SDK 확장입니다. PlatformDispatcher의 나머지 engine API는 PARTIAL입니다.

Web Metro transformer는 Babel CommonJS의 live property read로 순환 class 및 mutable named import를 처리합니다. 실제 Windows·Android emulator·Chromium/Web sample 수락은 기록한 개발 후보 범위입니다. 물리 입력·한국어 IME·reader·성능/복구·최종 배포는 별도 수락입니다.

W7 image/effect/native frame Picture의 provider/frame wire는 8이며 native ABI 1과 wire 1~7 입력을 유지합니다. SDK startup/View의 앱별 Picture cache를 FrameworkRoot가 자동 사용하며 GPU retire까지 native Picture 자원을 유지하고 context 복원 시 CPU 기록에서 재컴파일합니다. 전체 native layer tree와 raster cache는 남습니다. 설치된 RN 앱에서 새 API를 사용하기 전에 native supplier와 archive를 함께 갱신해야 합니다. 현재 증거는 workspace Web과 독립 Windows Graphite/Vulkan C ABI 범위이고 이전 OS-service 설치 후보는 이번 wire/binding 변경의 과거 증거입니다. 앱별 ImageService가 decode·asset/network IO/진행률·animation clock·cache 종료를 소유하며, 앱 종료는 진행 중 codec/IO를 drain한 뒤 backend를 닫습니다. native frame 해제에 실패하면 decoder 입력을 닫고 backend를 보존하며 codec drain 중 늦게 발생한 실패도 포함합니다. provider 위젯·value budget과 남은 경계는 [core 문서](../README.ko.md)를 따릅니다.

Unpackaged Windows deep link는 SDK native navigation protocol1을 사용합니다. 앱 installer가 URI scheme을 `"app.exe" --nelyx-uri "%1"`로 등록할 수 있습니다. activation마다 독립 process를 열며 single-instance broker는 공급하지 않습니다. 명시 URI가 없는 일반 시작은 null을 반환하여 저장 route를 보존하고, 잘못되거나 모호하거나 너무 긴 URI 인자는 실패합니다. 이 protocol이 없는 기존 host는 RN Linking fallback을 유지합니다. Scheme 등록은 앱의 책임이며 SDK가 registry를 변경하지 않습니다.

앱 종료의 `shutdownStatus`와 `retryDispose()` 및 `PendingDisposalError.retry()`는 안전한 완료 확인 callback이 있는 owner 경계에서 이어갑니다. 완료한 disposer를 반복하지 않으며 plugin/native bytes·앱·surface·Web 등록의 후속 해제를 보존합니다. Surface/host 종료는 경계마다 명시적 회복 callback을 최대 두 번 사용하고, 지속 실패나 일반 cleanup 오류의 종속 자원은 보존합니다. 초기 startup/stop·임의 native deletion 오류가 자동으로 재시도 가능해지는 API는 아닙니다. 물리 GPU loss·모든 플랫폼의 production teardown 수락은 별도입니다.
