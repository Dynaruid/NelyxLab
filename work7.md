# W7 · Nelyx 텍스트 선택과 확대경 후속 인수

**2026-11-22 · `PARTIAL` · Nelyx `tauri-backend` `0f31962f`와 작업 트리**

W6는 `CLOSED / PARTIAL`로 종료했다. W7은 Chrome PWA의 읽기 전용 선택 메뉴 실패를 해결하고, W6에서 남은 Windows 키보드·접근성, Android 확대경, 실기기·호스트와 스크롤 회귀 인수를 마무리한다. 재현 화면은 Demo의 **Explore components → Text selection**, 스크롤 비교는 **All components**다. [W6 구현과 검증 기록](work6.md#4-2026-11-22-중간-마무리)

## 1. 읽기 전용 선택 메뉴와 PWA

- [x] `checkPublicWidgets`의 `material-readonly`에서 **Select all → 선택한 글자 위 재우클릭 → Copy** 실패부터 조사한다. Material `SelectableText.rich`는 읽기 전용 `EditableText`를 사용한다. `selectAll` 직후 컨트롤러의 선택 범위, 메뉴 항목 실행 전후 포커스와 선택 초기화 여부, 선택 상자에 대한 `secondaryClick`의 좌표 판정, `contextMenuButtonItems`의 복사 조건 순서로 읽는다. 데스크톱의 `selectAll`은 툴바를 닫고, Material 위젯의 포커스 손실 리스너는 선택을 접을 수 있다. [Material 선택 위젯](packages/material/src/selectable-text.ts#L145) · [우클릭 판정](Nelyx/src/framework/widgets/editable-text.ts#L1700) · [전체 선택](Nelyx/src/framework/widgets/editable-text.ts#L2011)
- [x] 기존 검사에서 두 번째 우클릭은 Semantics 영역의 왼쪽 24px, 세로 중앙을 쓴다. 스크롤·RTL·줄바꿈 상태에서 해당 좌표가 실제 셰이핑된 글자 상자 안에 있는지 먼저 확인한다. 읽기 전용 범위는 위젯의 선택 상태나 콜백으로 추적한다. 기존 `readEditor()`는 활성 `EditContext` 또는 DOM 입력의 상태를 읽는다. 좌표 문제면 검사에서 실제 글자 위를 누르게 하고, 포커스·선택·메뉴 항목 문제면 실패한 경로를 수정한다. [PWA 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs#L201) · [선택 상자](Nelyx/src/framework/rendering/editable.ts#L449)
- [x] 글자 위 재우클릭에서 전체 선택 범위가 유지되고 `Copy`로 한글·영문·이모지가 복사되는지 확인한다. 이어서 Core `SelectableText.rich`와 다중 문단 `SelectionArea`에서 같은 흐름과 문단 간 선택을 실행한다. 범위 밖 우클릭, 유효한 선택 끝점이 하나뿐인 경우, `contextMenuBuilder: null`, 읽기 전용 메뉴의 Cut·Paste 제한도 확인한다. [Core 선택 위젯](Nelyx/src/framework/widgets/selectable-text.ts) · [다중 문단 선택](Nelyx/src/framework/widgets/selectable-region-state.ts) · [Demo 예제](sample/nelyx-demo-app/src/text-selection-screen.ts)
- [x] 기존 통합 검사를 `TextFormField`·`CupertinoSearchTextField`, 로컬 테마·RTL·한국어 라벨, 중첩 오버레이의 위치, 구형 메뉴까지 실행하고 Demo의 맞춤법 메뉴도 확인한다. 편집 가능한 빈 필드, 비밀번호·비활성·선택 비활성, 클립보드 조회 지연과 실패, 실행 취소도 변경된 경로에서 다시 확인한다. [W6 Core·디자인 인수 기준](work6.md#3-인수-기준)
- [x] 실제 Chrome UI에서 데스크톱 PWA 기본 메뉴, **Use Nelyx menus** 전환, Nelyx 표면 밖 DOM의 브라우저 메뉴를 확인한다. 같은 우클릭에 메뉴 하나만 뜨고, 바깥 클릭과 Escape 뒤 포커스가 각 동작에 맞게 이동하는지 확인한다. 클립보드 권한 UI 또는 사이트 설정에서 허용·거절을 확인하고, 사용자 선택 전 사전 읽기 여부와 허용 뒤 붙여넣기 결과를 기록한다. [브라우저 메뉴 브리지](Nelyx/sdk/src/backends/browser/selection-context-menu.ts) · [클립보드 경합 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs#L276)

## 2. Windows Tauri 키보드와 접근성

- [ ] W6의 실제 WebView2 창에서는 DOM에 키 이벤트가 도착했으나 `KeyboardEvent.code`가 비어 있었다. SDK가 전달하는 `key`·`code`·`location`·수정 키, Core의 키 정규화, 포커스된 위젯과 메뉴 컨트롤러의 처리 순서를 먼저 확인한다. 패키지 창에 PowerShell로 스캔코드를 보내 각 단계의 결과를 대조하고, 실제 키보드에서도 같은 동작을 확인한다. 재현된 경우 누락 지점의 입력 또는 포커스 경로를 수정한다. [W6 Windows 기록](work6.md#4-2026-11-22-중간-마무리) · [DOM 키 입력](Nelyx/sdk/src/backends/browser/input.ts#L111) · [키 정규화](Nelyx/src/services/hardware-keyboard.ts#L159) · [메뉴 키 처리](Nelyx/src/framework/widgets/context-menu-controller.ts#L16)
- [ ] 선택 범위와 캐럿을 각각 기준으로 메뉴 키·`Shift+F10`이 메뉴를 한 번 열고, Tab·방향키·Enter로 항목을 탐색·실행하며, Escape 뒤 같은 필드나 선택 영역에 포커스가 돌아오는지 확인한다. `Ctrl+A/C/V`와 메뉴 복사·붙여넣기로 한글 OS 클립보드를 왕복한다. 빈 필드에도 붙여넣기 항목이 나오고, 클립보드가 비면 항목이 비활성인지 확인한다. Narrator가 메뉴 항목의 이름과 비활성 상태를 읽는지 실제 창에서 확인하고, PowerShell 입력·실제 키 입력·Narrator 결과를 기록한다. [W6 Windows 인수 기준](work6.md#3-인수-기준)

## 3. Pixel 5 터치 확대경과 선택 수명

W6는 Pixel 5 API 33 / WebView 109에서 정지 상태의 확대 글자 픽셀, 손을 뗀 뒤 메뉴 전환, 취소·재시도, Cupertino 길게 누르기, OS 클립보드와 WebGL 복구 뒤 다음 제스처를 확인했다. 당시 입력 캐리어는 `INPUT`이었다. [W6 Android 기록](work6.md#4-2026-11-22-중간-마무리)

- [x] 편집기의 양쪽 손잡이를 각각 움직여 교차 방향으로 당기고, 줄을 넘고, 부모 스크롤과 필드 내부 스크롤의 가장자리에서 자동 스크롤을 유도한다. Android가 반대쪽 끝점을 넘는 입력에서 선택 범위를 유지하는지 확인한다. 포인터가 멈춘 상태에서도 스크롤 뒤 렌즈가 현재 선택 끝점의 글줄을 확대하는지, DPR과 좌표 변환을 거친 글자 픽셀과 선택 범위를 확인한다. Material·Cupertino의 한글·이모지·RTL, 키보드가 열린 상태에서 렌즈 위치를 확인한다. [편집기 확대경 갱신](Nelyx/src/framework/widgets/editable-text.ts#L2538) · [확대경 오버레이](Nelyx/src/framework/widgets/selection-overlay.ts#L176)
- [x] Material·Core 읽기 전용 텍스트와 다중 문단 `SelectionArea`에서 길게 누르기·손잡이 드래그를 확인한다. 문단이 바뀔 때 현재 끝점의 글줄로 렌즈가 이동하고, 정상 종료는 플랫폼 정책대로 메뉴를 열며, 취소는 렌즈와 드래그를 정리해야 한다. 비밀번호와 확대경 비활성 설정, 렌즈 빌더가 `null`을 반환하는 경로도 확인한다. [Core 확대경](Nelyx/src/framework/widgets/selectable-text.ts#L500) · [문단 선택 확대경](Nelyx/src/framework/widgets/selectable-region-state.ts#L745)
- [x] 확대 중 렌즈 엔트리 하나와 손잡이·Backdrop 레이어 순서를 확인한다. 손 떼기·취소·새 제스처·경로 이동 뒤 이전 렌즈, 자동 스크롤 타이머와 프레임 갱신이 해제되고 종료 애니메이션 뒤 추가 프레임이 계속 예약되지 않는지 확인한다. 정지 길게 누르기, 빠른 재시도와 WebGL 복구 검사를 변경 후 다시 실행한다. [확대경 컨트롤러](Nelyx/src/framework/widgets/magnifier.ts) · [Android 제품 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs)

## 4. W5 대비 스크롤·웹 클리핑 회귀

- [ ] 메뉴를 닫은 **All components**에서 W6 비교에 사용한 W5 최종 APK(PWA 빌드 ID `274f63c0108cd5dbd9e996bedc5d845c9ba28e88d6ba4052cdb0e32d4bb27d5a`)와 W7 후보를 같은 Pixel 5에서 비교한다. 당시 비교는 종료 카드가 달랐고 컴포지터 표시 간격이 비어 있었다. 실제 설치 APK 해시와 PWA 빌드 ID를 대조하고, 같은 WebView·하드웨어 WebGL2·래스터 크기·DPR·접근성 설정을 사용한다. `--editor-entry-only`로 **Sliders → Switches → Text fields**에서 **Write something**이 처음 보이는 플링을 실행한다. 시작과 종료에 보이는 카드 목록이 둘 다 같은 실행을 비교한다. [W5 빌드와 측정](work5.md#15-관성-중-첫-편집기와-이미지-비용) · [편집기 관성 동선](work5.md#첫-편집기에-도달하는-관성-경로)
- [ ] W5 방식으로 기준과 후보를 번갈아 세 쌍 비교한다. 앱 프로브를 끄고 Perfetto로 해당 창의 SurfaceFlinger 표시 간격을 수집한다. 첫 표시 지연, 활성 이동과 손을 뗀 뒤 관성 구간의 표본 수·p95·p99·최장 간격·33.3ms 이상 횟수, CSS 대조를 기록한다. 확대경이 열린 제스처에서도 표시 간격과 종료 후 정리를 확인한다. HWUI 수치는 원인 조사에 쓴다. 기준 APK·일치하는 동선·유효 표시 표본을 확보하지 못한 비교는 `PARTIAL`로 기록한다. Pixel 5 활성 이동의 기존 목표는 p95 ≤ 33.33ms다. [W5 인수 기준](work5.md#4-인수와-종료) · [이전 비교의 한계](work6.md#4-2026-11-22-중간-마무리)
- [x] Demo Web 개발 러너에서 `check-web-scroll-clipping.mjs`를 실행한다. Chromium DPR 1·2에서 양쪽 스크롤 클립 경계와 역방향 이동의 버튼 픽셀을 확인한다. [웹 클리핑 검사](sample/nelyx-demo-app/eng/check-web-scroll-clipping.mjs)

## 5. Galaxy·iOS·macOS·Linux 제품 인수

| 대상 | 통과 기준 |
| --- | --- |
| Galaxy Android Tauri | 실제 손가락으로 양쪽 손잡이 교차, 글줄·문단 전환, 가장자리 자동 스크롤, 취소 후 재시도를 확인한다. Gboard 한글 조합 중 메뉴 억제와 조합 완료 뒤 메뉴·OS 클립보드 동작을 확인한다. WebView 버전과 실제 입력 캐리어를 기록한다. |
| iOS Tauri 실기기 | Cupertino 렌즈가 글줄을 따라가고, 키보드·안전 영역에서 잘리지 않으며, 길게 누르기와 손잡이 제스처의 종료·취소에서 메뉴 전환과 정리가 동작한다. |
| macOS Tauri | 실제 패키지 창에서 선택 안팎의 우클릭 위치·포커스, 해당 플랫폼의 키보드 메뉴와 단축키, OS 클립보드 한글 왕복을 확인한다. |
| Linux Tauri | 실제 패키지 창에서 선택 안팎과 빈 필드의 메뉴 위치, 메뉴 키·`Shift+F10`·Escape, OS 클립보드 한글 왕복을 확인한다. |

각 호스트는 W6에서 미실행이다. 장치·호스트마다 패키지 식별값, 실제 입력 방식과 확인한 결과를 남긴다. [W6 제품 인수 기준](work6.md#3-인수-기준) · [Demo 호스트 실행 안내](sample/nelyx-demo-app/README.ko.md#pwa와-tauri)

## 6. 실행 순서와 기록

1. §1의 Material 실패 경로를 코드부터 추적한다. 확인할 원인과 수정안을 좁힌 뒤 집중 검증하고 나머지 공개 위젯으로 넓힌다. Windows 키 처리와 Pixel 5 선택 수명도 코드·호출 순서를 먼저 확인한다.
2. 관련 변경을 모아 SDK와 Demo를 통합 빌드한다. 소스, 러너에 설치한 공급, 게시 PWA의 `build.json`과 실제 실행 패키지가 같은 변경을 포함하는지 대조한다. 기기에서 테스트하기 전에 README의 JDK·SDK·러너 준비를 따른다. [SDK와 러너 준비](sample/nelyx-demo-app/README.ko.md#공급과-개발-실행) · [Android 준비](sample/nelyx-demo-app/README.ko.md#android에서-실행)

```powershell
npm.cmd run build:sdk
npm.cmd run prepare:sample -- web sample/nelyx-demo-app
npm.cmd ci --prefix sample/nelyx-demo-app/web/runner --workspaces=false
npm.cmd run build:pwa --workspace @nelyx/demo
node sample/nelyx-demo-app/eng/check-text-selection.mjs
```

Windows는 Demo README의 `prepare:windows`, `pack:windows`, `run:windows`로 패키지 창을 연다. Pixel 5는 README의 Android x64 준비와 W7 후보 빌드 후 아래 선택 검사를 실행한다. [Windows 패키지 실행](sample/nelyx-demo-app/README.ko.md#pwa와-tauri) · [Pixel 5 패키지 실행](sample/nelyx-demo-app/README.ko.md#x86_64-에뮬레이터)

```powershell
npm.cmd run run:android --workspace @nelyx/demo -- --device emulator-5554
node sample/nelyx-demo-app/eng/check-text-selection.mjs --android
```

관성 비교는 Pixel 5에 W5 기준 APK와 W7 후보를 교대로 설치하고, 설치 빌드를 확인한 직후 아래 명령을 한 번씩 실행한다.

```powershell
$env:NELYX_SCROLL_RUNS = '1'
$env:NELYX_TRACE_PROCESSOR = (Get-Command trace_processor_shell.exe -ErrorAction Stop).Source
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --timeline --editor-entry-only
```

웹 클리핑 검사 동안 Demo 개발 러너를 8081에서 실행한다.

```powershell
npm.cmd run dev --workspace @nelyx/demo
# 러너가 준비되면 별도 PowerShell에서 실행
node sample/nelyx-demo-app/eng/check-web-scroll-clipping.mjs
```

각 테스트의 제한은 20분이며 반복은 보통 30회 이내로 한다. 실행에 사용한 임시 추적·프로필·스테이징은 종료 시 정리하고, 현재 패키지 출력과 이 문서의 결과 요약을 사용한다. [저장소 검증 지침](.github/copilot-instructions.md)

기능·접근성·기기별 검증과 표시 간격은 각각 확인한 범위와 결과를 기록한다. 인수 기준을 충족한 항목에 체크하며, 실패·미실행이나 비교 불가 항목은 구체적인 지점과 함께 `PARTIAL`로 남긴다.

## 7. 2026-11-22 구현과 인수 기록

### 선택과 메뉴 수정

- Material의 이전 재우클릭 좌표가 현재 글자 상자 안에 들어가는 것을 확인했다. 검사에서는 셰이핑 결과로 실제 글자 내부 좌표를 얻어 전체 선택 유지와 한글·영문·이모지 복사를 확인한다. 브라우저가 입력 포커스를 다른 DOM 요소로 옮기면 이전 Nelyx 편집기가 포커스를 다시 가져가던 경로를 수정했다. 선택 끝점이 하나인 `SelectionArea`의 확대 글줄도 해당 문단에서 얻는다. [읽기 전용 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs) · [DOM 포커스 처리](Nelyx/src/framework/widgets/editable-text.ts)
- 웹 입력 이벤트에 물리 `code`가 비면 `location`과 `keyCode`, 필요한 경우 `key`로 키를 구분한다. 이 값이 비었던 이벤트에서 Shift와 F10이 같은 키로 처리되던 충돌을 제거했다. [키 정규화](Nelyx/src/services/raw-keyboard-web.ts)
- Android 삽입 핸들의 기준을 실제 그려진 캐럿의 가로 중앙으로 맞췄다. Doroti `025b8e62`에서 Android 삽입 핸들의 기준에 캐럿 사각형의 중심을 쓰도록 수정했고, 폭·오프셋·RTL·스크롤·DPR의 조합을 확인했다. Nelyx에서도 실제 캐럿을 그리는 사각형의 아래 중앙을 사용한다. [Doroti 수정](../DorotiLab/Doroti/src/Doroti.Framework.Rendering/editable.cs#L1918) · [Nelyx 선택 끝점](Nelyx/src/framework/rendering/editable.ts#L772)
- 수정 전 `d595fab1`에서 Pixel 5의 Android 터치 입력으로 첫 길게 누르기와 두 번 탭 메뉴 누락을 재현했다. 첫 길게 누르기 때 단어는 선택됐고, 키보드 포커스를 얻으면서 캔버스 위쪽이 `0 → 50` 논리 픽셀로 이동한 뒤에는 확대경과 메뉴가 사라졌다. Android WebView에서 길게 누르는 동안 Nelyx 포커스로 선택을 유지하고, 정상 종료 이후에 호스트 키보드를 요청하도록 바꿨다. Doroti의 선택 제스처를 참고해 두 번 탭의 단어 선택, 삽입 핸들 탭의 메뉴 전환, 범위 핸들 드래그 종료 뒤 메뉴 열기도 연결했다. [Doroti 선택 제스처](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/text_selection.cs#L2838) · [Nelyx 길게 누르기](Nelyx/src/framework/widgets/editable-text.ts#L2376)
- Galaxy에서 두 끝점과 두 핸들의 불투명도가 모두 유효했지만, 오른쪽 핸들의 레이어에 그리기 기록이 비어 있었다. 해당 부모를 한 번 다시 그리면 기록이 나타나는 것을 확인했다. Doroti와 같이 불투명도가 0을 지나면 합성 상태를 갱신한다. 새로 독립 그리기 경계가 된 객체는 부모가 그 레이어를 한 번 그린 뒤 독립 갱신을 사용한다. 두 끝점의 화면 픽셀을 따로 확인하는 회귀를 추가했다. [Doroti 불투명도 갱신](../DorotiLab/Doroti/src/Doroti.Framework.Rendering/proxy_box.cs#L1210) · [Nelyx 불투명도 갱신](Nelyx/src/framework/rendering/animated-opacity.ts#L93) · [Nelyx 부모 그리기 무효화](Nelyx/src/framework/rendering/object.ts#L2278)
- 확대경은 현재 선택 끝점의 affinity와 보이는 글줄을 사용한다. 정상 종료는 사라지는 애니메이션을 사용하고 취소·화면 이탈은 바로 정리한다. 새 제스처가 이전 렌즈의 종료 애니메이션과 겹칠 때 현재 렌즈를 유지한다. [확대경 수명](Nelyx/src/framework/widgets/magnifier.ts) · [선택 오버레이](Nelyx/src/framework/widgets/selection-overlay.ts)

### 실행 결과

- 메뉴 수정 PWA `0c88d6360983fecd3f70a147af6cfb2c88b8687b732f28a3768d080d3cd1f064`의 SDK·공급 준비·Demo 타입 검사와 헤드리스 Chrome PWA 검사가 통과했다. Chrome 실제 창의 브라우저 메뉴와 사이트 클립보드 허용·거절은 `d595fab1`에서 통과했다. 이후 우측 핸들 수정 빌드의 실제 창 재검사는 Windows 테스트 Chrome 창이 포커스를 잃어 중단됐다. [Chrome 제품 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs)
- Windows `d595fab1`의 WebView2 `157.0.4341.60`에서 PowerShell로 전달한 스캔코드, 캐럿과 범위를 기준으로 연 메뉴, 메뉴 탐색·실행·Escape, 한글 OS 클립보드 왕복이 통과했다. UI Automation에서 `Copy` 활성과 빈 클립보드의 `Paste` 비활성 상태를 확인했다. 실제 키보드와 Narrator 낭독은 미실행이다. [Windows 검사](sample/nelyx-demo-app/eng/windows-selection-input.ps1)
- Galaxy `SM-S931N` API 37, WebView `157.0.8103.50`에서 ADB로 보낸 첫 길게 누르기 도중 확대경이 유지됐고, 손을 뗀 뒤 `Copy`가 나타났다. 누르는 동안 시각 뷰포트의 높이는 `780`이었고 정상 종료 이후에 `487`로 바뀌었다. 이때 입력 캐리어는 `EditContext`였다. 두 번 탭과 메뉴 표시는 WebView에 전달한 터치 입력으로 확인했다. 캐럿과 핸들 중심의 가로 차이는 앞선 정렬 빌드 `d595fab1`의 Galaxy 렌더 좌표에서 `0`이었다. 기본 IME는 삼성 키보드이며, Gboard·사람이 직접 하는 나머지 선택 동작은 추가 인수가 필요하다. 현재 설치된 ARM64 APK는 `0c88d636`이며 로컬과 기기의 SHA-256은 `bf9497a95f74eba0f41baa738c4515123714a5df1063819c90a860477e1b24f6`이다. [현재 ARM64 APK](sample/nelyx-demo-app/.nelyx/tauri/android-arm64/app-universal-debug.apk)
- Pixel 5 API 33, WebView `109.0.5414.123`, DPR `2.75`, `INPUT`으로 `0c88d636`을 실행했다. 첫 길게 누르기·두 번 탭·삽입 핸들 메뉴, 캐럿 중심 LTR·RTL, 범위 핸들 이동과 교차 시도, 필드 안 자동 스크롤, Material·Cupertino·읽기 전용 확대, 취소·재시도·WebGL 복구가 통과했다. 정지 확대 픽셀 점수는 `0.816`이고 화면 이탈 뒤 추가 예약 프레임은 `0`이었다. 이전 검사에서 두 핸들의 조작을 확인했고, 최종 오른쪽 핸들의 표시 픽셀 검사는 재개 지점에 남겼다. [Android 제품 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs)
- Linux WSL2/Xvfb의 GTK `3.24.52`·WebKitGTK `2.52.6`에서 선택 안팎의 포인터 우클릭, 빈 필드 메뉴, 빈 필드 Escape와 `Shift+F10`을 확인했다. 선택 범위 메뉴의 Escape·메뉴 키와 한글 클립보드 왕복은 실패해 `PARTIAL`로 남긴다. iOS 실기기와 macOS 패키지 창 검증은 장치가 필요하다. [Linux 패키지](sample/nelyx-demo-app/.nelyx/tauri/linux-x64/package.json)

## 8. 중간 마무리와 재개 순서

사용자 요청으로 `PAUSED / PARTIAL`에서 중단한 당시의 기록이다. 오른쪽 핸들 수정 PWA `ef0787997e5dacb6c090250dbefe05e67d652cb87a2b25dd747d18072d321ff3`의 SDK 빌드, 러너 공급, Demo 타입 검사, 레이어 리더 검사와 `git diff --check`가 통과했다. Core의 캐시된 부모 아래에서 불투명도를 올리고 내리는 검사에서도 표시 레이어 수가 `0 → 1 → 1 → 0 → 1 → 1`로 갱신됐다.

ARM64 번들은 Gradle의 APK 조립이 중단 코드 `-1073741510`으로 끝나 새 APK를 게시하거나 설치하기 전에 종료됐다. 당시 Galaxy·Pixel 5 설치본과 Windows·Linux 패키지의 PWA는 메뉴·캐럿 정렬까지 반영된 `0c88d636`이었다. 재개 이후의 패키지는 §9에 기록한다.

1. 재개 시 `ef078799` PWA를 ARM64로 패키징하고 연결된 Galaxy에 설치한다. **Text selection → Material single line**에서 첫 길게 누르기 종료와 두 번 탭 뒤 양쪽 핸들의 실제 표시 픽셀을 확인한다. 이어서 Pixel 5에 같은 PWA를 x64로 패키징해 `check-text-selection.mjs --android`를 실행한다. 이 검사에는 왼쪽과 오른쪽 핸들의 화면 픽셀 검사가 들어 있다.
2. 같은 PWA로 Windows·Linux를 갱신한다. Windows 실제 키보드·Narrator, Linux의 선택 범위 Escape·메뉴 키·클립보드, Galaxy 실제 손가락과 Gboard, iOS·macOS 인수를 이어간다. Pixel 5 부모 스크롤 가장자리와 확대경 표시 중의 합성 간격도 남아 있다.
3. W5 Pixel 기준 APK `af53b3e4b61bf4bdc068ecbbd641606aab9aef29d5c9289dc87167852d375574`는 현 작업 환경에서 확보하지 못했다. W7 후보 단독 Perfetto도 중단 전 미실행이다. W5 원본을 확보하면 §4의 동일 종료 카드에서 교대 비교를 진행한다. Chromium DPR `1`·`2`의 양쪽 경계와 역방향 클립 픽셀 검사는 `0c88d636` 공급 단계에서 통과했다.

## 9. 2026-11-22 재개 결과

- Galaxy에서 키보드가 열린 상태로 목록이 다시 배치될 때 Cupertino 여러 줄 편집기와 이전 비활성 편집기가 같은 `TextEditingController`를 점유했다. 대체 편집기가 마운트될 때 이전 편집기가 비활성 상태라면 컨트롤러와 브라우저 입력 연결을 해제한다. 같은 엘리먼트를 `GlobalKey`로 이동하는 경로는 기존 연결을 사용한다. [편집기 연결](Nelyx/src/framework/widgets/editable-text.ts)
- Linux WebKitGTK는 수정 키 `keyup`에 놓기 전의 수정 키 비트를 전달한다. 이 입력을 받은 Core가 놓인 키의 `keydown`을 다시 만들어 하드웨어 키 상태와 충돌했다. 입력에서 다른 쪽 수정 키가 이미 눌려 있다면 그 상태를 유지하고, 방금 놓은 키는 해제한다. Raw 키 이벤트 버퍼는 메시지 처리가 끝날 때 성공과 실패 양쪽에서 비운다. [수정 키 처리](Nelyx/src/services/raw-keyboard.ts) · [키 메시지 처리](Nelyx/src/services/key-event-manager.ts)
- 회귀 검사에 놓기 전 비트가 남은 Shift `keyup`, 첫 길게 누르기와 두 번 탭 뒤 두 핸들의 픽셀, 부모 클립과 정지 포인터 아래 확대경 갱신을 추가했다. [제품 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs)

이 단계의 PWA 빌드 ID는 `d535f946e2eb369ae715cf5c168b04ef9218a60e73ceb4deb4fe4c70bdaf0835`다. SDK 통합 빌드, 러너 공급, Demo 타입 검사와 게시를 통과했다. 변경한 Core 파일의 원본과 러너에 설치한 소스맵의 `sourcesContent`가 일치했다. 같은 PWA로 패키징한 뒤 바이너리와 설치 APK의 SHA-256을 대조했다.

| 패키지 | SHA-256 |
| --- | --- |
| Pixel 5 x64 APK | `cce9647672905dd884542556a235ac4426562c25f8ea3bb5c97b62cc26098adf` |
| Galaxy ARM64 APK | `50360a40410eaa59637c5c098cc568708394e74e44b91fb8ffc32414fddfcdf1` |
| Windows x64 EXE | `95144723658840c99bdeb7c0414d36c4b222086a83b91a5b75676bf1f8c539e7` |
| Linux x64 바이너리 | `92ec57e9b33b3362da8d11cd4bdaf572dab887b461c03f04381882eeacc648ed` |

- Windows WebView2 `157.0.4341.60` 창에서 포커스가 바뀌어 중단된 뒤 단독으로 재실행했다. PowerShell 스캔코드로 캐럿의 `Shift+F10`, 선택 범위의 메뉴 키, Escape 뒤 동일 필드, Tab·방향키·Enter, 메뉴와 `Ctrl+A/C/V`의 한글 클립보드 왕복을 확인했다. UI Automation은 `Copy`를 활성 버튼으로, 클립보드가 빈 상태의 `Paste`를 비활성 버튼으로 표시했다. 실제 키보드와 Narrator 낭독은 미실행이다. [Windows 검사](sample/nelyx-demo-app/eng/windows-selection-input.ps1)
- Linux WSL2/Xvfb, GTK `3.24.52`, WebKitGTK `2.52.6` 패키지에서 X11 입력과 AT-SPI로 선택 안팎 우클릭, 메뉴 키·`Shift+F10`·Escape, 선택과 포커스 유지, 빈 필드 붙여넣기와 한글 OS 클립보드 왕복을 확인했다. 검사에서 X11 클립보드를 읽고 썼다.
- Chrome 헤드리스 PWA에서 공개 위젯과 키보드 메뉴, 놓기 전 비트가 남은 Shift `keyup`, 클립보드 권한·경합과 실행 취소 검사가 통과했다.
- Pixel 5 API 33, WebView `109.0.5414.123`, DPR `2.75`의 `INPUT`과 Galaxy `SM-S931N` API 37, WebView `157.0.8103.50`, DPR `3`의 `EditContext`에서 Android 제품 검사가 통과했다. ADB와 CDP로 Material 양쪽 손잡이와 교차 방향 드래그, 내부와 부모 가장자리의 자동 스크롤, Material·Cupertino 글줄 전환, 읽기 전용 선택과 문단 전환, 확대 제외 설정, 클립보드, 취소, WebGL 복구를 확인했다. 두 기기 모두 경로를 닫은 뒤 추가 프레임은 0개였다. Galaxy의 실제 손가락 입력과 Gboard 조합 검사는 남아 있다. 기기에서 확인한 IME는 Samsung Keyboard였다. [Android 제품 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs)

### Pixel 5 표시 간격

Pixel 5 API 33, WebView `109.0.5414.123`, DPR `2.75`, 786×1602 래스터에서 CanvasKit과 Android 합성기가 모두 RTX 4060 호스트 GPU를 사용했다. 접근성 서비스와 앱 프레임 프로브를 끄고 `--timeline --editor-entry-only`를 실행했다. **Sliders → Switches → Text fields**에서 출발해 **Switches → Text fields → Write something**으로 끝났다. [Android 스크롤 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs) · [Perfetto FrameTimeline](https://perfetto.dev/docs/data-sources/frametimeline)

| SurfaceFlinger 구간 | 첫 버퍼 지연 | 유효 간격 | p95 | p99 | 최장 | 33.3ms 이상 |
| --- | --- | --- | --- | --- | --- | --- |
| 편집기 플링 전체 | 90.98ms | 11 | 148.61ms | 148.61ms | 148.61ms | 5 |
| 손을 뗀 뒤 관성 | 31.19ms | 10 | 148.61ms | 148.61ms | 148.61ms | 5 |
| CSS 대조 | — | 89 | 18.38ms | 19.17ms | 19.17ms | 0 |

손을 떼기 전에는 간격 표본이 없었다. W5 원본 APK `af53b3e4…`를 확보하지 못해 교대 비교와 활성 이동 p95 인수는 `PARTIAL`이다.

같은 APK의 Text selection에서 확대경을 띄운 뒤 24단계 터치 이동을 한 차례 계측했다. 드래그의 표시 간격 52개는 p95 `50.46ms`, p99·최장 `51.13ms`, 33.3ms 이상 17개였다. 손을 뗀 뒤 간격 7개는 p95·p99·최장 `167.24ms`, 33.3ms 이상 4개였다. 확대경 엔트리가 사라지고 메뉴가 표시된 뒤 정지 구간에 새 버퍼가 0개였다. 구간 경계는 `/proc/uptime`의 10ms 단위 시각을 사용했다.

## 10. Cupertino 선택 핸들 누락

Pixel 5의 `d535f946`에서 **Text selection → Cupertino single line**의 첫 한글 단어를 길게 눌렀을 때 위쪽 핸들의 파란 픽셀이 0개였다. **Cupertino multiline**의 첫 단어와 두 번째 줄까지 확장한 범위에서도 재현됐다. 글자 선택 상자의 시작점 `x=26.795`가 편집기 왼쪽 `x=27`보다 0.205 논리 픽셀 앞에 있어 핸들 표시 조건에서 제외됐다. 같은 필드의 이모지와 RTL 단어에서는 두 핸들이 표시됐다.

Core `RenderEditable`에서 시작·끝 선택 앵커의 가로 좌표를 문단 폭 안으로 보정한 뒤 스크롤 오프셋을 적용한다. Flutter와 Doroti의 방향별 선택 끝점 계산과 같은 순서다. 스크롤로 실제 끝점이 화면 밖에 있으면 기존 표시 판정으로 핸들이 숨겨진다. Android 제품 검사에는 시작 한글 단어의 길게 누르기 중과 종료, WebGL 복구 후, RTL 범위, 여러 줄 선택의 양쪽 픽셀을 추가했다. [선택 끝점](Nelyx/src/framework/rendering/editable.ts#L772) · [핸들 픽셀 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs#L932)

### 수정본 빌드와 제품 검사

PWA `db6e29d0104052fa344187b3b1fd0d72e466d7cafb567382aff9571697b71ac7`로 SDK 통합 빌드, 러너 공급, Demo 타입 검사와 게시를 통과했다. 변경한 네 Core 파일의 소스가 공급한 소스맵에 들어 있는 것도 확인했다. 같은 PWA로 패키징했고 Android는 실제 설치 APK까지 검증했다.

| 패키지 | 검증한 SHA-256 |
| --- | --- |
| [Pixel 5 x64 APK](sample/nelyx-demo-app/.nelyx/tauri/android-x64/app-universal-debug.apk) | `8678f7b96620694958964c12f09efdedd62e2539a231eb59ddd9aa3368bc11e2` |
| [Galaxy ARM64 APK](sample/nelyx-demo-app/.nelyx/tauri/android-arm64/app-universal-debug.apk) | `503630e1031c5a4a9f21f11d0c7274ffb7296aa5b4db852ea29553f72f327117` |
| [Windows x64 EXE](sample/nelyx-demo-app/.nelyx/tauri/windows-x64/nelyx-tauri.exe) | `f4a667a4c868a776b56eae43894863561a9c41d5aa133cd6049f5c28e3e210ac` |
| [Linux x64 바이너리](sample/nelyx-demo-app/.nelyx/tauri/linux-x64/nelyx-tauri) | `492980026c090ac6bad81c55bea427b39c47bd0afb660c0c36698c4681295728` |

- Pixel 5와 Galaxy에서 전체 Android 제품 검사가 통과했다. Cupertino의 첫 한글 단어, 손을 뗀 뒤, WebGL 복구 후, RTL 단어, 두 줄에 걸친 범위에서 핸들 두 개를 검사했다. 각 핸들의 중심 8×8 논리 픽셀 영역에서 Pixel 5는 각각 484개, Galaxy는 각각 576개의 파란 픽셀을 확인했다. Material 두 핸들, 확대경, 클립보드, 자동 스크롤, 취소, 경로 종료 후 추가 프레임 0개도 확인했다. 입력은 ADB·CDP였다. [Android 제품 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs)
- Windows WebView2 패키지를 단독으로 실행해 `Shift+F10`, 메뉴 키, Escape 포커스 복귀, Tab·방향키·Enter, 한글 클립보드 왕복과 UI Automation의 `Copy` 활성·`Paste` 비활성을 재검사했다. 패키징 셸에서 `rustup which cargo`로 확인한 Rust 도구 체인의 폴더를 `PATH` 앞에 추가해 `pack:windows`를 실행했다.
- Linux 패키지에서 선택 안팎 우클릭, 메뉴 키·`Shift+F10`·Escape, 같은 필드 포커스, 한글 X11 클립보드 왕복과 빈 필드 붙여넣기를 재검사했다. Chrome 헤드리스와 실제 창의 PWA 선택 검사, Chrome 네이티브 메뉴 정책, 개발 러너의 DPR 1·2 스크롤 클립 검사도 통과했다.
- Pixel 5에서 Material·Core 읽기 전용 예제와 `SelectionArea`의 끝 핸들 픽셀을 찾은 뒤 그 위치에서 드래그해 선택이 늘어나는 것을 확인했다. Material·`SelectionArea`는 손을 뗀 뒤 렌즈가 사라지고 메뉴가 열렸고, Core 읽기 전용은 취소 뒤 렌즈와 메뉴가 닫혔다.
- Pixel 5의 실제 렌더 트리에서 확대 중 Material은 Backdrop과 두 핸들 순으로, Cupertino는 두 핸들과 Backdrop 순으로 합성됐다. 둘 다 Backdrop은 하나였다. Material 여러 줄의 끝 핸들을 가장자리에 고정해 내부 스크롤을 유도한 뒤, 화면 픽셀에서 확대된 글자의 일치 점수 `0.808`을 확인했다. 부모 목록의 자동 스크롤 뒤 같은 픽셀 검사는 `0.675`였고 취소 렌더링 뒤 사라진 렌즈 영역과 비교했다. [확대경 합성](Nelyx/src/framework/widgets/selection-overlay.ts#L176)
- Pixel 5의 네이티브 키보드가 열린 상태에서 Material 한 줄과 Cupertino 여러 줄의 `안녕하세요`, `👋`, `שלום`을 각각 길게 눌러 렌즈의 포인터와 글줄 좌표를 확인했다. Material 양쪽 핸들을 교차 방향으로 당겼을 때 Android는 반대쪽 끝을 넘는 입력에서 선택 범위를 유지했다. [핸들 드래그](Nelyx/src/framework/widgets/editable-text.ts#L2495)

### 수정본 Pixel 5 표시 간격

§9와 같은 장치와 GPU에서 편집기 진입 플링과 확대경 드래그를 각각 한 번 측정했다. 플링 시작과 종료 카드가 §9와 일치했다.

| SurfaceFlinger 구간 | 첫 버퍼 지연 | 유효 간격 | p95 | p99 | 최장 | 33.3ms 이상 |
| --- | --- | --- | --- | --- | --- | --- |
| 편집기 플링 전체 | 61.42ms | 19 | 100.08ms | 100.08ms | 100.08ms | 3 |
| 손을 뗀 뒤 관성 | 1.95ms | 18 | 100.08ms | 100.08ms | 100.08ms | 3 |
| CSS 대조 | — | 89 | 20.30ms | 33.94ms | 33.94ms | 1 |
| 확대경 드래그 | — | 49 | 52.41ms | 67.36ms | 67.36ms | 10 |
| 확대경 드래그에서 손을 뗀 뒤 | — | 8 | 151.20ms | 151.20ms | 151.20ms | 5 |

플링에서 손을 떼기 전의 간격 표본은 없었다. 확대경 엔트리가 정리된 뒤 정지 구간에는 새 버퍼가 없었다. W5 원본 APK를 확보해야 §4의 교대 비교와 활성 이동 p95 인수를 진행할 수 있다.

### 남은 인수

- Windows 실제 키보드 입력과 Narrator 낭독, Galaxy 실제 손가락과 Gboard 한글 조합, iOS 실기기와 macOS 창은 해당 입력·호스트 환경이 필요하다.
- W5 원본 APK를 확보하면 §4의 동일 경로에서 교대로 측정한다.
