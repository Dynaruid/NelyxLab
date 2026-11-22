# W7 · Nelyx 텍스트 선택과 확대경 후속 인수

**2026-11-22 · 계획 작성 · 실행 미착수 · Nelyx `tauri-backend` `09ebe7cb` 기준**

W6는 `CLOSED / PARTIAL`로 종료했다. W7은 Chrome PWA의 읽기 전용 선택 메뉴 실패를 해결하고, W6에서 남은 Windows 키보드·접근성, Android 확대경, 실기기·호스트와 스크롤 회귀 인수를 마무리한다. 재현 화면은 Demo의 **Explore components → Text selection**, 스크롤 비교는 **All components**다. [W6 구현과 검증 기록](work6.md#4-2026-11-22-중간-마무리)

## 1. 읽기 전용 선택 메뉴와 PWA

- [ ] `checkPublicWidgets`의 `material-readonly`에서 **Select all → 선택한 글자 위 재우클릭 → Copy** 실패부터 조사한다. Material `SelectableText.rich`는 읽기 전용 `EditableText`를 사용한다. `selectAll` 직후 컨트롤러의 선택 범위, 메뉴 항목 실행 전후 포커스와 선택 초기화 여부, 선택 상자에 대한 `secondaryClick`의 좌표 판정, `contextMenuButtonItems`의 복사 조건 순서로 읽는다. 데스크톱의 `selectAll`은 툴바를 닫고, Material 위젯의 포커스 손실 리스너는 선택을 접을 수 있다. [Material 선택 위젯](packages/material/src/selectable-text.ts#L145) · [우클릭 판정](Nelyx/src/framework/widgets/editable-text.ts#L1700) · [전체 선택](Nelyx/src/framework/widgets/editable-text.ts#L2011)
- [ ] 기존 검사에서 두 번째 우클릭은 Semantics 영역의 왼쪽 24px, 세로 중앙을 쓴다. 스크롤·RTL·줄바꿈 상태에서 해당 좌표가 실제 셰이핑된 글자 상자 안에 있는지 먼저 확인한다. 읽기 전용 범위는 위젯의 선택 상태나 콜백으로 추적한다. 기존 `readEditor()`는 활성 `EditContext` 또는 DOM 입력의 상태를 읽는다. 좌표 문제면 검사에서 실제 글자 위를 누르게 하고, 포커스·선택·메뉴 항목 문제면 실패한 경로를 수정한다. [PWA 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs#L201) · [선택 상자](Nelyx/src/framework/rendering/editable.ts#L449)
- [ ] 글자 위 재우클릭에서 전체 선택 범위가 유지되고 `Copy`로 한글·영문·이모지가 복사되는지 확인한다. 이어서 Core `SelectableText.rich`와 다중 문단 `SelectionArea`에서 같은 흐름과 문단 간 선택을 실행한다. 범위 밖 우클릭, 유효한 선택 끝점이 하나뿐인 경우, `contextMenuBuilder: null`, 읽기 전용 메뉴의 Cut·Paste 제한도 확인한다. [Core 선택 위젯](Nelyx/src/framework/widgets/selectable-text.ts) · [다중 문단 선택](Nelyx/src/framework/widgets/selectable-region-state.ts) · [Demo 예제](sample/nelyx-demo-app/src/text-selection-screen.ts)
- [ ] 기존 통합 검사를 `TextFormField`·`CupertinoSearchTextField`, 로컬 테마·RTL·한국어 라벨, 중첩 오버레이의 위치, 구형 메뉴까지 실행하고 Demo의 맞춤법 메뉴도 확인한다. 편집 가능한 빈 필드, 비밀번호·비활성·선택 비활성, 클립보드 조회 지연과 실패, 실행 취소도 변경된 경로에서 다시 확인한다. [W6 Core·디자인 인수 기준](work6.md#3-인수-기준)
- [ ] 실제 Chrome UI에서 데스크톱 PWA 기본 메뉴, **Use Nelyx menus** 전환, Nelyx 표면 밖 DOM의 브라우저 메뉴를 확인한다. 같은 우클릭에 메뉴 하나만 뜨고, 바깥 클릭과 Escape 뒤 포커스가 각 동작에 맞게 이동하는지 확인한다. 클립보드 권한 UI 또는 사이트 설정에서 허용·거절을 확인하고, 사용자 선택 전 사전 읽기 여부와 허용 뒤 붙여넣기 결과를 기록한다. [브라우저 메뉴 브리지](Nelyx/sdk/src/backends/browser/selection-context-menu.ts) · [클립보드 경합 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs#L276)

## 2. Windows Tauri 키보드와 접근성

- [ ] W6의 실제 WebView2 창에서는 DOM에 키 이벤트가 도착했으나 `KeyboardEvent.code`가 비어 있었다. SDK가 전달하는 `key`·`code`·`location`·수정 키, Core의 키 정규화, 포커스된 위젯과 메뉴 컨트롤러의 처리 순서를 먼저 확인한다. 패키지 창에 PowerShell로 스캔코드를 보내 각 단계의 결과를 대조하고, 실제 키보드에서도 같은 동작을 확인한다. 재현된 경우 누락 지점의 입력 또는 포커스 경로를 수정한다. [W6 Windows 기록](work6.md#4-2026-11-22-중간-마무리) · [DOM 키 입력](Nelyx/sdk/src/backends/browser/input.ts#L111) · [키 정규화](Nelyx/src/services/hardware-keyboard.ts#L159) · [메뉴 키 처리](Nelyx/src/framework/widgets/context-menu-controller.ts#L16)
- [ ] 선택 범위와 캐럿을 각각 기준으로 메뉴 키·`Shift+F10`이 메뉴를 한 번 열고, Tab·방향키·Enter로 항목을 탐색·실행하며, Escape 뒤 같은 필드나 선택 영역에 포커스가 돌아오는지 확인한다. `Ctrl+A/C/V`와 메뉴 복사·붙여넣기로 한글 OS 클립보드를 왕복한다. 빈 필드에도 붙여넣기 항목이 나오고, 클립보드가 비면 항목이 비활성인지 확인한다. Narrator가 메뉴 항목의 이름과 비활성 상태를 읽는지 실제 창에서 확인하고, PowerShell 입력·실제 키 입력·Narrator 결과를 기록한다. [W6 Windows 인수 기준](work6.md#3-인수-기준)

## 3. Pixel 5 터치 확대경과 선택 수명

W6는 Pixel 5 API 33 / WebView 109에서 정지 상태의 확대 글자 픽셀, 손을 뗀 뒤 메뉴 전환, 취소·재시도, Cupertino 길게 누르기, OS 클립보드와 WebGL 복구 뒤 다음 제스처를 확인했다. 당시 입력 캐리어는 `INPUT`이었다. [W6 Android 기록](work6.md#4-2026-11-22-중간-마무리)

- [ ] 편집기의 양쪽 손잡이를 각각 움직여 서로 교차시키고, 줄을 넘고, 부모 스크롤과 필드 내부 스크롤의 가장자리에서 자동 스크롤을 유도한다. 포인터가 멈춘 상태에서도 스크롤 뒤 렌즈가 같은 선택 끝점의 글줄을 확대하는지, DPR과 좌표 변환을 거친 글자 픽셀과 선택 범위를 확인한다. Material·Cupertino의 한글·이모지·RTL, 키보드가 열린 상태에서 렌즈 위치를 확인한다. [편집기 확대경 갱신](Nelyx/src/framework/widgets/editable-text.ts#L2538) · [확대경 오버레이](Nelyx/src/framework/widgets/selection-overlay.ts#L176)
- [ ] Material·Core 읽기 전용 텍스트와 다중 문단 `SelectionArea`에서 길게 누르기·손잡이 드래그를 확인한다. 문단이 바뀔 때 현재 끝점의 글줄로 렌즈가 이동하고, 정상 종료는 플랫폼 정책대로 메뉴를 열며, 취소는 렌즈와 드래그를 정리해야 한다. 비밀번호와 확대경 비활성 설정, 렌즈 빌더가 `null`을 반환하는 경로도 확인한다. [Core 확대경](Nelyx/src/framework/widgets/selectable-text.ts#L500) · [문단 선택 확대경](Nelyx/src/framework/widgets/selectable-region-state.ts#L745)
- [ ] 확대 중 렌즈 엔트리 하나와 손잡이·Backdrop 레이어 순서를 확인한다. 손 떼기·취소·새 제스처·경로 이동 뒤 이전 렌즈, 자동 스크롤 타이머와 프레임 갱신이 해제되고 종료 애니메이션 뒤 추가 프레임이 계속 예약되지 않는지 확인한다. 정지 길게 누르기, 빠른 재시도와 WebGL 복구 검사를 변경 후 다시 실행한다. [확대경 컨트롤러](Nelyx/src/framework/widgets/magnifier.ts) · [Android 제품 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs)

## 4. W5 대비 스크롤·웹 클리핑 회귀

- [ ] 메뉴를 닫은 **All components**에서 W6 비교에 사용한 W5 최종 APK(PWA 빌드 ID `274f63c0108cd5dbd9e996bedc5d845c9ba28e88d6ba4052cdb0e32d4bb27d5a`)와 W7 후보를 같은 Pixel 5에서 비교한다. 당시 비교는 종료 카드가 달랐고 컴포지터 표시 간격이 비어 있었다. 실제 설치 APK 해시와 PWA 빌드 ID를 대조하고, 같은 WebView·하드웨어 WebGL2·래스터 크기·DPR·접근성 설정을 사용한다. `--editor-entry-only`로 **Sliders → Switches → Text fields**에서 **Write something**이 처음 보이는 플링을 실행한다. 시작과 종료에 보이는 카드 목록이 둘 다 같은 실행을 비교한다. [W5 빌드와 측정](work5.md#15-관성-중-첫-편집기와-이미지-비용) · [편집기 관성 동선](work5.md#첫-편집기에-도달하는-관성-경로)
- [ ] W5 방식으로 기준과 후보를 번갈아 세 쌍 비교한다. 앱 프로브를 끄고 Perfetto로 해당 창의 SurfaceFlinger 표시 간격을 수집한다. 첫 표시 지연, 활성 이동과 손을 뗀 뒤 관성 구간의 표본 수·p95·p99·최장 간격·33.3ms 이상 횟수, CSS 대조를 기록한다. 확대경이 열린 제스처에서도 표시 간격과 종료 후 정리를 확인한다. HWUI 수치는 원인 조사에 쓴다. 기준 APK·일치하는 동선·유효 표시 표본을 확보하지 못한 비교는 `PARTIAL`로 기록한다. Pixel 5 활성 이동의 기존 목표는 p95 ≤ 33.33ms다. [W5 인수 기준](work5.md#4-인수와-종료) · [이전 비교의 한계](work6.md#4-2026-11-22-중간-마무리)
- [ ] Demo Web 개발 러너에서 `check-web-scroll-clipping.mjs`를 실행한다. Chromium DPR 1·2에서 양쪽 스크롤 클립 경계와 역방향 이동의 버튼 픽셀을 확인한다. [웹 클리핑 검사](sample/nelyx-demo-app/eng/check-web-scroll-clipping.mjs)

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
