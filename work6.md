# W6 · Nelyx 텍스트 선택 메뉴와 확대경

**2026-11-22 · PAUSED / PARTIAL · Nelyx `tauri-backend` 작업 트리 `37e2b4d8` 기준 · 계획 비교 기준 Nelyx `e0ff7b73` · Doroti `main` `c1ba6327`**

Material `TextField`와 `CupertinoTextField`에서 선택 위치에 맞는 편집 메뉴를 열고, 터치로 길게 누르거나 선택 손잡이를 움직일 때 확대경이 실제 글줄을 따라가게 한다. 읽기 전용 텍스트는 `SelectableText`와 `SelectionArea` 안의 `Text` / `Text.rich`를 대상으로 한다. `Text`의 선택 참여는 기존 `SelectionArea` 방식으로 지정한다. Windows Tauri의 우클릭과 Android Tauri의 길게 누르기를 첫 인수 동선으로 삼고, 브라우저 PWA에서 메뉴 소유권과 클립보드도 확인한다. [W5의 Demo 입력·스크롤 기준](work5.md#16-중간-마무리)

## 1. Doroti와 Nelyx 소스 비교

| 경로 | Doroti에서 확인한 동작 | Nelyx에서 보완할 부분 |
| --- | --- | --- |
| 편집기 메뉴 | `EditableText`와 `TextSelectionOverlay`가 선택 범위, 우클릭 위치, 클립보드 상태를 메뉴에 전달한다. Material과 Cupertino의 기본 빌더는 지원되는 iOS 필드에서 `SystemContextMenu`를 사용하고 다른 경로는 adaptive toolbar를 사용한다. 루트 오버레이에 메뉴를 만들 때 호출 위젯의 테마를 캡처한 뒤 그 아래에서 빌더를 호출한다. [Doroti 선택 오버레이](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/text_selection.cs#L124) · [Doroti 메뉴 컨트롤러](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/context_menu_controller.cs#L24) · [Doroti Material 기본 메뉴](../DorotiLab/packages/Doroti.Material/src/text_field.cs#L351) · [Doroti Cupertino 기본 메뉴](../DorotiLab/packages/Doroti.Cupertino/src/text_field.cs#L698) | 두 디자인 패키지에 `contextMenuBuilder`와 기본 툴바가 연결돼 있다. `EditableText` 우클릭은 포커스를 요청하고 위치를 `toolbarLocation`에 저장하지만, 해당 위치는 구형 `selectionControls.buildToolbar`에만 전달된다. 기본 빌더의 `contextMenuAnchors`는 선택 끝점만 읽는다. `ContextMenuController`도 루트 오버레이의 빌드 컨텍스트에서 테마를 캡처하므로 필드 주변의 로컬 테마가 메뉴에 전달되지 않는 경로가 있다. [Nelyx 우클릭](Nelyx/src/framework/widgets/editable-text.ts#L1594) · [기본 앵커](Nelyx/src/framework/widgets/editable-text.ts#L1651) · [메뉴 컨트롤러](Nelyx/src/framework/widgets/context-menu-controller.ts#L18) |
| 편집기 확대경 | Android와 iOS의 편집기 제스처는 길게 누르기가 성립할 때 확대경을 요청한다. 움직이는 동안 위치를 갱신하며, 정상 종료에서는 확대경을 닫고 메뉴를 연다. 취소에서는 확대경을 닫는다. `RenderEditable`에서 현재 글줄 양 끝과 캐럿을 얻어 실제 오버레이 좌표로 변환한다. [Doroti 제스처](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/text_selection.cs#L2701) · [종료와 취소](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/text_selection.cs#L2838) · [확대경 좌표](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/text_selection.cs#L491) | 길게 누르기 시작에서 메뉴를 요청하고, 이동 콜백의 `applyHandleDrag`에서 확대경을 처음 연다. 손가락을 움직이지 않는 경우에는 이 확대경 경로를 타지 않는다. 종료와 취소가 같은 `endHandleDrag`를 호출해 취소에서도 메뉴 복원 조건을 평가한다. 확대경이 받는 글줄의 좌우 경계는 필드 전체 너비다. [Nelyx 길게 누르기](Nelyx/src/framework/widgets/editable-text.ts#L1574) · [확대경 좌표와 종료](Nelyx/src/framework/widgets/editable-text.ts#L2239) |
| 읽기 전용 텍스트 | Material `SelectableText`는 읽기 전용 `EditableText`를 사용한다. `SelectionArea`의 `SelectableRegion`은 여러 문단의 선택을 모으고, 손잡이 드래그에서 확대경을 갱신한다. Doroti의 Region 길게 누르기는 단어 선택과 손을 뗀 뒤 메뉴에 연결된다. [Doroti SelectableText](../DorotiLab/packages/Doroti.Material/src/selectable_text.cs#L710) · [Doroti Region 길게 누르기](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/selectable_region.cs#L1065) · [Doroti 손잡이 드래그](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/selectable_region.cs#L1310) | Material `SelectableText`는 같은 읽기 전용 편집기 경로를 타고 `Text` / `Text.rich`는 `SelectionContainer`에 참가한다. `SelectableRegionState`에도 손잡이 확대경이 있지만 좌표 계산은 변환의 이동 성분과 영역 전체 경계에 의존한다. 길게 누르기 도중의 확대경과 실제 문단 글줄 경계는 W6에서 연결한다. Core의 독립 `SelectableText`는 별도 `TextSelectionController`를 쓰는 경로로, 현재 노출된 복사·선택 기능에 메뉴와 확대경 연결이 필요하다. [Nelyx Material SelectableText](packages/material/src/selectable-text.ts#L245) · [Text 선택 등록](Nelyx/src/framework/widgets/basic.ts#L1156) · [Region 확대경](Nelyx/src/framework/widgets/selectable-region-state.ts#L710) · [Core SelectableText](Nelyx/src/framework/widgets/selectable-text.ts#L21) |
| 브라우저와 클립보드 | 데스크톱 Web에서는 브라우저 메뉴를 우선하고 모바일 Web에서는 프레임워크 선택 UI를 쓴다. 빈 데스크톱 입력창에는 클립보드가 비었거나 조회 중이어도 비활성 붙여넣기 항목을 보였다. [Doroti Web 정책](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/editable_text.cs#L1624) · [Doroti 빈 필드와 클립보드 기록](../DorotiLab/history/26/09/06/clipboard-host-and-empty-field-menu.md) | Nelyx의 데스크톱 브라우저 우선 조건은 `SelectableRegionState`에 있고 `EditableText.showToolbar`에는 같은 조건이 없다. Tauri도 PWA와 같은 브라우저 서비스 경로를 쓴다. 메뉴를 열 때의 `Clipboard.hasStrings`가 브라우저 `readText()`를 호출한다. 조회 실패 시 기존 상태가 남고, 상태가 `unknown`이면 붙여넣기 콜백이 있을 때 복사·잘라내기·전체 선택 항목도 생성되지 않는다. `notPasteable`일 때는 현재 전달된 붙여넣기 콜백으로 활성 항목을 만들 수 있다. [Region 메뉴 분기](Nelyx/src/framework/widgets/selectable-region-state.ts#L262) · [편집 메뉴와 조회](Nelyx/src/framework/widgets/editable-text.ts#L1730) · [항목 조합](Nelyx/src/framework/widgets/text-selection.ts#L52) · [브라우저 Clipboard](Nelyx/sdk/src/backends/browser/platform-messages.ts#L115) |
| 확대경 렌더링 | Doroti는 호스트가 제공하는 확대경 세션을 쓸 수 있고, 위젯 경로는 `RawMagnifier`의 행렬 backdrop filter로 뒤에 그려진 픽셀을 샘플링한다. Android 에뮬레이터 확인 기록의 범위는 당시 Material `TextField`다. [Doroti 확대경 위젯](../DorotiLab/packages/Doroti.Material/src/magnifier.cs#L92) · [Doroti RawMagnifier](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/magnifier.cs#L468) · [Doroti Android 확인 기록](../DorotiLab/history/26/08/28/android-text-selection-overlay-summary.md) | Nelyx에는 `RawMagnifier` → `BackdropFilterLayer` → `SceneBuilder` → CanvasKit `saveLayer` 경로가 있다. 이 경로로 메뉴와 렌즈를 구현하고, Android WebView에서 실제 글자 픽셀이 확대되는지 확인한다. 호스트별 확대경 연동과 iOS 시스템 메뉴는 WebView 경로에서 해결할 수 없는 동작과 호스트 capability를 확인한 뒤 후속으로 판단한다. [Nelyx RawMagnifier](Nelyx/src/framework/widgets/magnifier.ts#L161) · [Backdrop 레이어](Nelyx/src/framework/rendering/layer.ts#L1050) · [CanvasKit 재생](Nelyx/skia/packages/web/src/library.ts#L1504) |

## 2. 구현 순서

### W6-01 · 편집기 기본 메뉴와 앵커

- [ ] `EditableTextState`의 보조 버튼 처리에서 클릭이 기존 선택 안에 있으면 범위를 유지한다. 선택 밖에서는 Windows/Linux는 클릭한 위치의 캐럿, Apple 계열은 기존 플랫폼의 단어 선택 정책을 적용한다. 현재 `RenderEditable`의 위치 판정과 편집 액션을 재사용하고, 빈 필드에서도 포커스와 클릭 앵커로 메뉴를 열 수 있게 한다. 메뉴 키와 `Shift+F10`은 포커스된 선택 또는 캐럿을 사용한다.
- [ ] 메뉴를 요청한 위치는 열린 메뉴의 수명 동안 유지한다. 우클릭·키보드 위치와 터치 선택 끝점을 `contextMenuAnchors`에 반영하고, `TextSelectionToolbarAnchors`와 기존 toolbar 레이아웃으로 화면 가장자리 배치를 계산한다. 앵커에 쓰는 변환과 `CompositedTransformFollower`의 보정이 중복 적용되는지 스크롤·중첩 `Overlay`에서 확인한다.
- [ ] `ContextMenuController.show`가 호출 위치의 `InheritedTheme`을 루트 `Overlay`까지 캡처하고, 캡처된 트리 안의 `Builder`에서 메뉴를 만든다. 로컬 테마·RTL·한국어 라벨과 `contextMenuBuilder`의 사용자 항목 및 `null`, 구형 `selectionControls.buildToolbar`, 맞춤법 메뉴를 각각 확인한다. 열린 메뉴를 갱신할 때는 같은 오버레이 엔트리와 현재 소유자를 사용한다. 메뉴 버튼을 해당 `TextFieldTapRegion` 그룹에 넣어 입력 연결을 유지한다. 메뉴 항목에 키보드 탐색과 활성 상태를 연결하고 `Escape`로 닫으면 해당 필드나 영역에 포커스를 복귀시킨다. [Core 오버레이](Nelyx/src/framework/widgets/selection-overlay.ts#L335) · [Material adaptive toolbar](packages/material/src/adaptive-text-selection-toolbar.ts#L148) · [Cupertino adaptive toolbar](packages/cupertino/src/adaptive-text-selection-toolbar.ts#L99)

### W6-02 · 메뉴 소유권과 편집 명령

- [ ] 브라우저 PWA와 Tauri의 메뉴 정책을 SDK에서 한 번 결정해 편집기와 선택 영역에 같은 기준으로 전달한다. 데스크톱 PWA는 기존 브라우저 메뉴를 기본으로 두고 앱의 `BrowserContextMenu` 설정에 따라 프레임워크 메뉴를 선택한다. 모바일 PWA와 Tauri에서는 Nelyx 선택 표면의 메뉴를 프레임워크가 소유하도록 한다. `getWebDeployment().host`로 호스트를 판별하고, `contextmenu` 억제는 소유하는 캔버스·선택 DOM·입력 캐리어에 적용한다. 메뉴를 연 포인터 입력당 메뉴 한 개, 페이지의 다른 DOM에서는 기존 브라우저 메뉴가 열리는 것을 확인한다. [호스트 판별](Nelyx/sdk/src/platforms/web/environment.ts#L57) · [브라우저 메뉴 서비스](Nelyx/src/services/browser-context-menu.ts) · [DOM 메뉴 브리지](Nelyx/sdk/src/backends/browser/selection-context-menu.ts#L137) · [입력 캐리어](Nelyx/sdk/src/backends/browser/interaction.ts#L318)
- [ ] 복사·잘라내기·전체 선택은 현재 범위와 편집 상태로 즉시 계산한다. 붙여넣기 항목은 클립보드 능력과 상태를 읽어 결정한다. 편집 가능한 빈 데스크톱 필드에서 붙여넣기 항목을 유지하고, 빈 클립보드에는 비활성 상태를 표시한다. 미확인·거절·미지원 상태를 처리하고, 브라우저에서 사전 조회가 실제 읽기를 유발하는 경우에는 사용자 클릭으로 붙여넣기를 시도할 수 있게 한다. 조회는 메뉴를 열 때의 소유자와 요청 순서로 검증한다. 기존 `flutter/platform`으로 OS 클립보드 왕복을 검증하고, 제품 WebView에서 읽기나 쓰기가 막히면 그 호스트의 클립보드 구현을 같은 SDK 채널 뒤에 연결한다. [클립보드 호스트 계약](Nelyx/sdk/src/runtime/clipboard-service.ts#L7)
- [ ] 버튼은 폼·포맷터·실행 취소와 동일한 편집 경로로 실행한다. 비동기 붙여넣기와 메뉴 잘라내기는 완료 시 동일 편집기, 현재 범위와 리비전, 포커스, 조합·읽기 전용·활성 상태를 다시 확인한다. 메뉴 잘라내기는 클립보드 쓰기가 성공한 선택에만 삭제를 적용한다. 읽기 전용은 복사와 전체 선택 정책을 적용하고, 비밀번호는 평문 복사·잘라내기·공유를 제한하며 확대경은 닫는다. 선택 비활성·필드 비활성·IME 조합 중에는 편집 메뉴를 닫는다. 기존 단축키와 `onChanged` 호출·실행 취소 이력을 함께 검사한다. [편집 명령](Nelyx/src/framework/widgets/editable-text.ts#L1814) · [브라우저 EditContext](Nelyx/sdk/src/backends/browser/edit-context.ts)

### W6-03 · 터치 확대경과 편집기 수명

- [ ] 모바일 편집기에서 길게 누르기가 확정되면 현재 선택과 유효한 좌표를 받아 손가락 이동 없이도 확대경을 연다. 움직이는 동안 선택과 렌즈를 갱신하고, 손을 떼면 확대경을 닫고 메뉴를 연다. 손잡이 드래그는 시작에서 메뉴를 닫고 확대경을 열며, 정상 종료의 메뉴 재표시는 기존 플랫폼 정책을 적용한다. 길게 누르기 취소와 손잡이 `PanGestureRecognizer.onCancel`은 드래그·확대경을 정리한다. 포커스 이탈, 경로 이동, 가려짐, dispose, 새 제스처에서 이전 엔트리·타이머·지연 콜백을 폐기한다. `TextMagnifierConfiguration.disabled`나 `null`을 반환하는 빌더도 검사한다. [Nelyx 손잡이 이벤트](Nelyx/src/framework/widgets/selection-overlay.ts#L633) · [확대경 엔트리 수명](Nelyx/src/framework/widgets/magnifier.ts#L355)
- [ ] 현재 패러그래프의 캐럿과 글줄 범위를 사용한다. `RenderEditable.getLineBoundary`, 캐럿 및 셰이핑된 글자 상자에서 실제 줄 경계를 얻고, 전체 변환으로 오버레이에 투영한다. 변환, DPR, 편집기의 내부 스크롤과 부모 스크롤이 각각 한 번씩 반영되는지 확인한다. 이동과 자동 스크롤에는 동일한 스냅샷의 글줄·캐럿·포인터 좌표를 쓴다. 손이 정지해도 이미 발생한 레이아웃·스크롤 프레임에서 좌표를 갱신하고, 활성 선택 제스처가 끝나면 갱신을 해제한다. [RenderEditable 좌표](Nelyx/src/framework/rendering/editable.ts#L429) · [Doroti 프레임 뒤 좌표 갱신](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/text_selection.cs#L531)
- [ ] Material `TextMagnifier`와 `CupertinoTextMagnifier`에 기존 Android·iOS 기본 스타일을 적용한다. `SelectionOverlay` 엔트리 하나와 `MagnifierInfo` 갱신을 사용하고, `RawMagnifier`의 기존 클립·행렬 backdrop으로 그린다. 키보드 occlusion·safe area와 실제 뷰 경계 안에서 렌즈를 배치하고 선택 손잡이의 레이어 순서를 확인한다. 확대경의 그림자·테두리는 확대 대상의 뒤쪽 픽셀과 분리해 그린다. 확대경 표시 중 글자 픽셀, 빠른 취소 후 재표시, GPU 컨텍스트 복구를 먼저 확인한 뒤 렌더러 수정 여부를 결정한다. [Material 확대경](packages/material/src/magnifier.ts) · [Cupertino 확대경](packages/cupertino/src/magnifier.ts) · [뷰 occlusion](Nelyx/sdk/src/backends/browser/environment.ts)

### W6-04 · 읽기 전용 텍스트와 다중 문단

- [ ] Material `SelectableText`와 `.rich`는 W6-01~03의 읽기 전용 `EditableText` 동작을 사용한다. 사용자 빌더와 복사·전체 선택 옵션을 그대로 읽는다. `SelectionArea`의 `Text` / `Text.rich`는 기존 `SelectionContainer`를 통해 문단·줄 사이 선택 범위를 확장하고, 현재 드래그하는 끝점의 fragment에서 확대경용 글줄·캐럿 경계를 얻는다. Region의 길게 누르기·손잡이 드래그 모두 W6-03의 표시·종료·취소 순서를 사용한다. `contextMenuBuilder: null`, 끝점이 하나뿐인 선택, 선택 영역 밖 우클릭을 검사한다. [Material SelectionArea](packages/material/src/selection-area.ts) · [문단 fragment의 선택 끝점](Nelyx/src/framework/rendering/paragraph-fragment.ts#L126) · [Region 메뉴](Nelyx/src/framework/widgets/selectable-region-state.ts#L808)
- [ ] Core `SelectableText`의 읽기 전용 `TextSelectionController`와 `onSelectionChanged`·`onCopyError` 계약을 사용한다. `RenderSelectableParagraph`의 선택 범위와 shaped paragraph 좌표를 `SelectionOverlay`에 연결하고, 동일한 선택을 두 recognizer가 수정하지 않도록 기존 제스처 아레나에 길게 누르기와 보조 클릭을 연결한다. Core에서 메뉴와 렌즈의 모양을 지정할 수 있도록 기존 빌더·설정 타입을 사용하고, Material 스타일은 디자인 패키지에서 제공한다. [Core 위젯](Nelyx/src/framework/widgets/selectable-text.ts) · [읽기 전용 문단 렌더러](Nelyx/src/framework/rendering/selectable-paragraph.ts#L32)

### W6-05 · Demo와 제품 경로 인수

- [ ] `@nelyx/demo`에 선택 동작을 재현하는 화면을 추가한다. Material과 Cupertino 단일·여러 줄 입력창, 빈 입력창, 읽기 전용·비밀번호·선택 비활성 필드, `SelectableText.rich`, 여러 `Text`가 들어간 `SelectionArea`를 둔다. Core `SelectableText`, `TextFormField`, `CupertinoSearchTextField`는 각 공개 위젯 경로로 확인한다. 한글·영문·이모지·RTL이 섞인 줄과 스크롤 가장자리에 놓인 텍스트를 넣는다. [Demo 카드](sample/nelyx-demo-app/src/components.ts#L978) · [TextFormField](packages/material/src/text-form-field.ts) · [CupertinoSearchTextField](packages/cupertino/src/search-field.ts)
- [ ] 소스와 호출 순서를 먼저 검토하고 W6-01~04에서 바뀐 분기의 집중 검증을 수행한다. SDK·Demo를 한 차례 통합 빌드한 뒤 실사용 패키지에서 아래 인수 항목을 확인한다. `npm.cmd run build:sdk`와 Demo README의 러너 준비·PWA·Tauri 명령을 사용하고 설치 빌드 ID와 실제 제품의 코드 일치를 확인한다. 테스트 타임아웃은 20분으로 두고 반복은 보통 30회 이내로 제한한다. [Demo 실행 명령](sample/nelyx-demo-app/README.ko.md) · [저장소 검증 지침](.github/copilot-instructions.md)

## 3. 인수 기준

| 환경 | 확인할 동작 |
| --- | --- |
| Core 및 디자인 패키지 | hold → drag → release와 hold → cancel의 메뉴·렌즈 상태, 오래된 프레임 및 Clipboard 콜백 무효화, 선택 핸들 교차, 여러 줄·RTL·이모지 경계, 스크롤·변환·클립 앵커, 빈 필드와 클립보드 상태별 항목, 사용자 빌더·테마·콜백, 선택 비활성·읽기 전용·비밀번호 상태를 확인한다. |
| Windows Tauri | PowerShell로 실제 창을 조작해 우클릭·메뉴 키·`Shift+F10`·`Escape`를 확인한다. 선택 안팎과 빈 필드에서 메뉴가 한 번 열리고, 메뉴와 단축키로 OS 클립보드의 한글 텍스트가 왕복해야 한다. 탭·키보드로 메뉴 항목을 실행하고 스크린 리더가 레이블과 비활성 상태를 읽는지 확인한다. |
| 브라우저 PWA | Playwright로 메뉴 소유권 전환, 권한 허용·거절·조회 지연, 다른 DOM의 메뉴, 바깥 클릭과 포커스 복귀를 확인한다. 브라우저 기본 팝업과 실제 클립보드 권한 UI도 수동으로 확인한다. |
| Android Tauri | Pixel 5 에뮬레이터에서 정지 hold 중 글자가 확대되고 손을 떼면 메뉴만 표시되는지 캔버스 픽셀과 선택 범위로 확인한다. Galaxy에서는 실제 손가락으로 양쪽 손잡이·줄 전환·가장자리 자동 스크롤·취소 뒤 재시도, Gboard 한글 조합과 메뉴 동작을 확인한다. `EditContext`와 실제 기기에서 선택된 입력 캐리어 경로를 기록한다. |
| iOS 및 그 밖의 Tauri 대상 | iOS 실기기에서 Cupertino 렌즈, 스크롤·키보드와 메뉴 전환을 확인한다. macOS·Linux에서는 데스크톱 메뉴 위치·키 입력·OS 클립보드를 확인하고 실행한 호스트별로 인수 상태를 남긴다. |
| 스크롤·리소스 회귀 | 메뉴가 닫힌 상태의 `All components` 첫 편집기 진입과 관성 구간을 W5의 같은 동선과 비교한다. 확대경이 활성일 때 오버레이 엔트리 수와 실제 표시 간격을 확인하고, 손을 뗀 후 추가 프레임·타이머·Backdrop 레이어가 정리되는지 확인한다. [W5 스크롤 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs) · [웹 클리핑 검사](sample/nelyx-demo-app/eng/check-web-scroll-clipping.mjs) |

## 4. 2026-11-22 중간 마무리

**PAUSED / PARTIAL.** 사용자 요청으로 구현과 실행 검증을 여기서 멈췄다. 코드 변경과 Demo 검증 스크립트를 작업 트리에 보존했다. §2의 체크박스는 구현과 해당 인수 조건이 함께 충족될 때 닫는다. 명시적인 재개 요청이 오면 아래 실패 지점부터 확인한다.

| 범위 | 작업 트리에 반영한 내용 |
| --- | --- |
| W6-01 | 편집기와 읽기 전용 선택 표면의 우클릭 앵커, 선택 범위 보존, 키보드 메뉴와 닫기, 루트 오버레이의 로컬 테마·방향·지역화, 구형 메뉴 경로를 공통 메뉴 수명에 연결했다. |
| W6-02 | SDK에서 브라우저와 Tauri의 메뉴 소유권을 결정한다. 클립보드 권한과 상태를 메뉴에 반영하고, 완료가 늦은 편집 명령은 현재 편집기·선택·포커스를 다시 확인한다. Tauri Demo와 CLI 템플릿은 기존 SDK 채널 뒤에 OS 클립보드를 연결했다. |
| W6-03·04 | 편집기, Core `SelectableText`, `SelectionArea`에 글줄 좌표를 사용하는 확대경과 터치 종료·취소 정리를 연결했다. Material `SelectableText.rich`는 읽기 전용 편집기 경로를 사용한다. |
| W6-05 | Demo의 **Explore components → Text selection**에 Material·Cupertino 입력, 읽기 전용 텍스트와 다중 문단, 폼·검색, RTL·중첩 오버레이·사용자 빌더 예제를 추가했다. [Demo 화면](sample/nelyx-demo-app/src/text-selection-screen.ts) · [제품 실행 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs) |

SDK 통합 빌드, Demo TypeScript 검사, PWA 패키징, Android x64 패키징·설치, Windows x64 실행 파일·NSIS 패키징을 통과했다. 검증에 사용한 빌드 ID는 `71c775247cb46a80ec37f6c8958c0fe7806ebe615a0ca521e552de350fc18c8b`다. 패키지 영수증 기준 Android APK SHA-256은 `eeee4ca6d00f8c174e0656e8240902475ad07045568dd097cd08ca05123313b2`, Windows EXE는 `a9f32e0eda6f99dc6b0cc9ba146ac1a0ad0471be1af63cec6dd9ed6c4b67d5b2`다.

| 실행 | 확인한 결과 |
| --- | --- |
| Pixel 5 `emulator-5554`, API 33, WebView 109 | 실제 ADB 터치로 손가락을 움직이지 않고 길게 누르는 동안 글자 픽셀을 캡처했다. 렌즈와 확대 원본 글자 마스크의 점수는 `0.816`, 새로 나타난 어두운 픽셀은 `166`이었다. hold 동안 메뉴가 닫혀 있고 손을 떼면 메뉴가 열렸으며 선택 범위가 유지됐다. 길게 누른 뒤 이동·취소·재시도, Cupertino 길게 누르기, Android OS 클립보드로 한글 복사 및 한글·이모지 붙여넣기, WebGL 컨텍스트 강제 손실·복구 뒤 다음 선택 제스처까지 통과했다. 입력 캐리어는 `INPUT`이었다. |
| Chrome PWA | `EditContext`에서 브라우저 메뉴 소유권 전환, 외부 DOM 이벤트, `Shift+F10` 및 메뉴 키, Tab·Enter·Escape, 권한이 허용된 한글·이모지 붙여넣기와 실행 취소를 확인했다. 권한 미허용 모의 분기에서 사전 읽기가 없고, Escape 이후 도착한 Paste를 폐기하며, 쓰기 거절 시 Cut이 원문·선택을 보존했다. 최신 통합 검사는 `Material SelectableText.rich`에서 `Select all` 후 선택 안 재우클릭 시 `Copy`가 보이지 않아 실패했다. 뒤의 Core·Region 검사는 이 실행에서 도달하지 못했다. |
| Windows Tauri | PowerShell로 실제 패키지 창에서 우클릭, 선택 안 재우클릭, Escape, 메뉴에서 Windows 클립보드로 한글 복사, 빈 클립보드의 붙여넣기 비활성 UI Automation 상태를 확인했다. 우클릭으로 연 메뉴에서 Tab·Enter로 OS 클립보드 붙여넣기도 실행했다. `Shift+F10`·메뉴 키와 Ctrl+A로 선택 범위를 잡는 검사는 미통과다. WebView2 DOM에 키가 도착한 진단 실행에서 `KeyboardEvent.code`가 빈 문자열이었다. 이 결과로 실물 키보드 경로의 성공 여부를 판정할 수 없다. |
| W5 스크롤 비교 | 같은 Pixel 5에서 `--editor-entry-only`를 W5 `274f63c0108cd5dbd9e996bedc5d845c9ba28e88d6ba4052cdb0e32d4bb27d5a`와 W6에 각각 1회 실행했다. W5의 HWUI p95는 `85.86 ms` (`n=18`, `33 ms` 초과 4건), W6는 `117.27 ms` (`n=15`, 초과 2건)였다. 두 실행 모두 `Sliders → Switches → Text fields`에서 출발했고, 종료 카드와 HWUI 표본 수가 달랐다. 컴포지터 표시 간격은 양쪽 모두 미수집 상태로, 이 값으로 관성 성능이나 60fps를 판정할 수 없다. |

### 재개 지점

1. `check-text-selection.mjs`의 `checkPublicWidgets`에서 `material-readonly`의 **Select all → 선택 안 우클릭 → Copy**부터 재현한다. 먼저 `EditableText.selectAll` 이후 실제 선택과 셰이핑된 글자 상자의 클릭 판정을 확인한다. 이어서 Core와 여러 문단, 메뉴 null, 단일 끝점, 맞춤법 예제를 검증한다.
2. Windows Tauri에서 스캔코드가 전달되는 실제 키 입력으로 메뉴 키·`Shift+F10`, 포커스 복귀와 Ctrl+A/C/V를 다시 확인한다. Narrator가 메뉴 레이블과 비활성 상태를 읽는지도 남긴다. PWA의 브라우저 기본 팝업과 실제 권한 UI는 수동 확인이 남아 있다.
3. Pixel 5에서 양쪽 손잡이 교차, 글줄 전환, 스크롤 가장자리, 읽기 전용 렌즈와 표시 중·해제 후 레이어 및 프레임 수명을 확인한다. W5와 같은 종료 카드에 맞춰 관성·표시 간격을 다시 수집하고 웹 클리핑 검사를 실행한다. Galaxy의 실제 손가락과 Gboard 한글 조합, iOS 실기기, macOS·Linux 제품 인수는 미실행이다.

다시 실행하는 경우 저장소 루트에서 아래 명령을 사용한다. APK 재패키징 전에는 `README.ko.md`의 Android JDK/SDK 설정과 SDK 공급 갱신 순서를 사용한다. [Demo 실행 안내](sample/nelyx-demo-app/README.ko.md)

```powershell
node sample/nelyx-demo-app/eng/check-text-selection.mjs
npm.cmd run run:android --workspace @nelyx/demo -- --device emulator-5554
node sample/nelyx-demo-app/eng/check-text-selection.mjs --android
$env:NELYX_SCROLL_RUNS = '1'
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --editor-entry-only
```
