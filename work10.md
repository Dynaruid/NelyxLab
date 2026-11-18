# W10 · Windows Demo 왼쪽 열에서 컨트롤을 지날 때의 스크롤 끊김

2026-11-19 · **Windows Demo 구현 및 검증** · 기준판 `a7b891e3`의 W9 공급 · `performanceAccepted=false` · `physicalInputAccepted=notVerified`

[최종 Windows 패키지 검증과 W9 대조](#523-타이머를-반영한-최종-공급과-w9-비교)

사용자가 기본 Demo에서 물리 트랙패드로 스크롤했을 때 작은 끊김이 남았다. 특히 왼쪽 열의 텍스트필드나 슬라이더가 커서에 닿는 순간이 의심된다는 관찰이다. **첫 수정 후보는 두 손잡이 슬라이더(`RangeSlider`)의 hover가 라벨·레이아웃·접근성까지 갱신하는 경로다.** 텍스트필드에서는 W9가 이미 측정한 섹션 최초 생성과, 생성이 끝난 필드가 커서 아래를 지나는 순간을 따로 다룬다. 이번 검토는 소스와 W9 기록을 사용했다. 각 경로가 물리 입력에서 차지하는 시간은 아직 미측정이다.

## 1. 어떤 경로가 실제로 실행되는가

| 상황 | 현재 코드에서 확인한 동작과 의미 |
| --- | --- |
| 기본 Demo의 왼쪽 열 | `run:windows`는 native host를 선택한다. `All components`에서 가용 폭이 1,000 논리 px를 초과하면 왼쪽 `firstScroll`의 연속된 6·7번 슬롯이 `Sliders`와 `Text fields`다(0부터 시작). 슬롯 6에는 `slider-value`, `range-value`, 기본으로 사용자 정의 모양을 쓰는 `range-custom`이 있다. 슬롯 7에는 `field-filled`, 기본 여러 줄인 `field-outlined` 등이 있다. 이 다섯 대상을 따로 식별한다. [실행 경로](sample/nelyx-demo-app/eng/run-windows.mjs#L33) · [열 구성](sample/nelyx-demo-app/src/components.ts#L356) · [슬라이더](sample/nelyx-demo-app/src/components.ts#L777) · [필드](sample/nelyx-demo-app/src/components.ts#L892) |
| 두 손가락을 댄 위치 | Windows DirectManipulation은 접촉 스트림이 RUNNING이 될 때 커서 위치를 저장한다. host는 그 원점과 pan delta를 `trackpad`로 보낸다. GestureBinding은 `panZoomStart`의 hit path를 보관해 update/end에 사용한다. 도중에 필드가 커서 아래로 들어와도 이 경로의 제스처 대상은 다시 선정되지 않는다. 휠 신호는 매번 hit test한다. 따라서 **컨트롤에서 시작**한 경우와 **스크롤 도중 진입**한 경우의 수정 지점이 다르다. [Windows 입력](Nelyx/engine/platform/windows/input/WindowsPrecisionTrackpad.h#L159) · [host 전달](Nelyx/sdk/native/windows-hermes/main.cpp#L74) · [경로 수명](Nelyx/src/framework/gestures/binding.ts#L445) |
| 커서를 가만히 두고 콘텐츠만 이동 | 장면 처리 후 root가 `MouseTracker.updateAllDevices()`를 호출한다. 이전 mouse/pen 위치가 등록돼 있으면 현재 트리에서 다시 hit test해 사라진 annotation에는 exit, 새 annotation에는 enter를 보낸다. wheel이나 trackpad 패킷 자체는 mouse 상태를 등록하지 않는다. 이 경로가 만드는 것은 경계 전환이며, 컨트롤의 `onHover`는 별도 `PointerHoverEvent`에 반응한다. 커서를 움직이지 않아도 추가 작업이 생길 수 있는 이유다. [프레임 끝](Nelyx/src/framework/widgets/root.ts#L1105) · [장치 등록과 재검사](Nelyx/src/framework/rendering/mouse-tracker.ts#L114) · [실제 hover 전달](Nelyx/src/framework/rendering/mouse-region.ts#L81) |
| 커서 모양 전환 | 후보 annotation에서 최종 커서를 고른 뒤 이전 커서와 같으면 반환한다. 실제 모양이 바뀌면 플랫폼 채널과 Windows UI 큐를 거쳐 `SetCursor`를 호출하고 비동기 응답을 보낸다. 경계 프레임의 서비스 요청·지연이 보일 때 이 비용을 조사한다. [커서 중복 제거](Nelyx/src/services/mouse-cursor.ts#L156) · [native 서비스](Nelyx/sdk/native/windows-hermes/main.cpp#L215) |

## 2. 수정 우선순위와 반증 조건

**① RangeSlider의 순수 hover 갱신 범위를 줄인다.** 현재 enter/exit 양쪽이 `setState`를 호출한다. 재빌드하면 테마·커서·두 손잡이의 접근성 자식을 다시 구성한다. render model을 받는 `update()`는 두 라벨에 `TextPainter.layout()`을 호출하고 layout·paint·semantics를 모두 dirty로 표시한다. 실제 마우스 이동이 있으면 `hover()`도 손잡이 판정 결과가 이전과 같아도 공통 `animationChanged()`를 호출한다. overlay와 손잡이 위치 애니메이션이 같은 listener를 써서 overlay tick도 layout·semantics와 존재하는 overlay entry의 build를 요청한다. 고정 커서 비교에서는 enter/exit의 후속 프레임을, 실제 이동 비교에서는 여기에 더해 hover 패킷과 tick을 본다. 라벨 layout **호출**과 캐시를 벗어난 실제 문단 layout은 따로 센다. [경계 콜백](packages/material/src/range-slider.ts#L909) · [실제 hover](packages/material/src/range-slider.ts#L714) · [공통 listener](packages/material/src/range-slider.ts#L325) · [render 갱신과 라벨](packages/material/src/range-slider.ts#L962) · [TextPainter의 동등성 검사](Nelyx/src/framework/painting/text-painter.ts#L348)

첫 패치는 입력 상태별로 필요한 갱신을 나눈다. 기본 모양에서 색·손잡이 강조만 달라질 때는 해당 render의 paint를 갱신하고, 동일한 손잡이 상태가 반복되면 overlay를 재시작할 필요가 있는지 기존 진행 방향까지 확인한다. 값·위치가 움직이면 두 손잡이의 접근성 bounds와 값이 따라가야 한다. 라벨·폰트·배율·방향이 바뀌면 라벨을 다시 배치한다. 사용자 정의 모양이나 상태별 커서·색이 해석된 테마의 치수를 바꾸는 경우에는 기존 갱신을 유지한다. 기본/사용자 정의 두 Demo의 결과를 개별 판정한다. 경계를 지날 때 이 경로가 실행돼도 정상 프레임만큼 짧고 다음 프레임에도 추가 비용이 없으면 끊김의 설명에서 제외한다. [단일 Slider의 적용 조건](packages/material/src/slider.ts#L564) · [RangeSlider 테마와 치수](packages/material/src/range-slider.ts#L816) · [손잡이 위치 배치](packages/material/src/range-slider.ts#L1020)

**② 텍스트필드와 단일 Slider에서는 이미 적용된 최적화의 범위를 먼저 확인한다.** Demo 필드의 enter/exit는 `ValueNotifier`를 변경한다. 기본 스타일에서는 장식이 hover를 받아 테두리와 채움을 다시 그리며, 테두리 치수나 내용 스타일이 달라질 때 다시 빌드한다. 필드에는 editor 재사용과 repaint boundary도 있다. 단일 Slider도 조건이 맞으면 hover를 paint에 한정한다. mounted 필드에서 끊기면 장식 상태 해석, hit test, 해당 경계의 실제 paint 기록과 다음 프레임을 순서대로 좁힌다. 클릭 없이 편집기 활성화나 포커스 전환이 일어나는지도 확인한다. [필드 상태](packages/material/src/text-field.ts#L248) · [editor 재사용](packages/material/src/text-field.ts#L359) · [장식 분기](packages/material/src/input-decorator.ts#L287)

**③ 첫 노출의 긴 프레임에는 별도 수정 경로가 있다.** W9 최신 왼쪽 진단에서 offset 1,152px의 `Text fields` 최초 생성은 37.49ms, 이를 포함한 layout은 57.62ms, Scene은 82.45ms였다. 같은 commit의 UI 적용은 0.236ms였다. 별도 재하강에는 슬롯 생성 없이 paint가 22.33ms인 프레임도 있었다. 이 값들은 휠 진단 기록이며 커서가 실제 필드에 들어간 시각은 담고 있지 않다. 여백에서도 같은 최초 mount 프레임이 늦으면 슬롯 내부 구성별 build/layout을 나눠 가장 비싼 부분의 초기 작업을 줄인다. 재방문에서 paint만 남으면 다시 기록된 repaint boundary와 표시 목록을 확인한다. W9에서 긴 정체 기준을 넘긴 dormant 슬롯 4개 보존은 채택 후보에서 제외한다. [W9 긴 프레임](work9.md#L179) · [최신 최초 생성](work9.md#L189) · [보존 비교](work9.md#L191)

**④ 시작 위치에서만 멎으면 입력 소유권을 추적한다.** 편집기의 내부 Scrollable은 한 줄이면 가로, 여러 줄이면 세로다. 슬라이더에는 가로 drag recognizer가 있다. 필드나 손잡이 위에서 접촉을 시작할 때만 바깥 열의 첫 이동이 늦다면 start hit path에 등록된 recognizer, arena 승자, 내부·외부 offset과 첫 소비 delta를 대조한다. 편집기에 실제 내부 스크롤 범위가 있는 경우와 없는 경우를 구분한다. 실제 scroll owner가 잘못 선택되거나 delta가 사라진 경계가 확인될 때 해당 recognizer의 축·스크롤 가능 조건을 수정한다. [편집기 내부 축](Nelyx/src/framework/widgets/editable-text.ts#L3654) · [PanZoom 등록](Nelyx/src/framework/widgets/raw-gesture-detector.ts#L233) · [단일 Slider drag](Nelyx/src/framework/widgets/slider-control.ts#L565)

## 3. 작업 순서와 비교 장면

1. **W10-1 · 소스에서 첫 패치와 회귀 사례를 작성한다.** ①의 경계 이벤트에서 다음 render 갱신까지 이어지는 호출을 기준으로 변경 범위를 정한다. 기본 Demo에서 이미 화면에 올라온 RangeSlider의 고정 커서 진입·이탈과 실제 손잡이 hover를 확인한다. 기본 장식만 바뀌는 동안 두 라벨의 layout 호출, 손잡이 geometry·접근성 갱신, dirty Widget 수를 기준판과 비교한다. 실제 값 변경·키보드·UIA 조작과 사용자 정의 도형에는 필요한 갱신이 남아야 한다.
2. **W10-2 · 같은 스크롤 구간에 커서 위치만 바꿀 수 있게 한다.** W9 휠 측정은 왼쪽 열에서 창 너비 22%, 높이 62%의 한 점을 사용했다. W10에서는 기본 Demo를 열고 PowerShell로 커서 위치를 지정한다. 원인 구분에 필요한 경우 실행 중인 앱에서 대상 ID·현재 hit 대상·enter/exit 프레임을 한시적으로 관측한다. 화면 좌표는 현재 컨트롤 bounds와 DPI로 산출하고 시작 전에 mouse 위치를 등록한다. 왼쪽 내부 여백은 같은 목록이 스크롤되면서 해당 컨트롤 annotation이 없는 점으로 고른다. 가로 여백이 없으면 같은 열 안에서 고정 y를 바꾸어 같은 offset에 경계 진입 시각만 달리한다. 유효한 대조점과 실제 진입이 확인된 쌍만 채택한다. [W9 비교 기록](work9.md#L142)
3. **W10-3 · 아래 순서로 원인을 구분한다.** 같은 창·DPI·테마·편집 상태에서 시작 offset, 방향, 속도, 이동량을 맞춘다. 각 비교는 왼쪽 `firstScroll` 진행과 오른쪽 `secondScroll` 정지를 함께 확인한다. 경계만 왕복하는 구간은 목표가 계속 mount되어 있고 새 슬롯 생성이 없는지 해당 프레임의 슬롯 생성 횟수로 확인한다.

   | 비교 | 무엇을 판단하는가 |
   | --- | --- |
   | 이미 보이는 구간에서 커서를 고정하고 짧게 왕복한다. 왼쪽 여백 ↔ 단일 Slider ↔ 기본/사용자 정의 RangeSlider ↔ filled/outlined 필드를 짝짓는다. | 같은 offset의 정상 프레임과 비교해 특정 enter/exit 또는 바로 다음 프레임에만 추가 build/layout/paint와 표시 지연이 모이는지 본다. |
   | 같은 컨트롤에서 스크롤을 멈추고 커서만 경계·트랙·손잡이 위로 움직인다. | 순수 hover 패킷과 애니메이션의 비용을 분리한다. 이때의 입력→표시 지연과 작업량을 기록한다. 목록 이동 FPS는 이 장면에 적용하지 않는다. |
   | 새 프로세스에서 왼쪽을 처음 내리고 되돌린 뒤 같은 속도로 다시 내린다. 컨트롤 위치와 여백에서 각각 비교한다. | 긴 프레임이 커서의 경계 시각을 따라 움직이는지, 같은 슬롯의 최초 생성 또는 재방문 paint를 따라가는지 판단한다. |
   | 기본 Demo 물리 트랙패드에서 여백에서 시작해 컨트롤을 통과하는 경우와, 같은 컨트롤 위에서 시작하는 경우를 비교한다. | 접촉 중 정속·손을 뗀 뒤 감속·반전/재접촉을 구분한다. 실제 수신이 panZoom인지 wheel fallback인지 표시한다. 물리 입력의 강도 차이는 offset·속도가 겹치는 구간에서 비교한다. |

4. **W10-4 · 프레임 단위로 원인을 판정한다.** 제품에 있는 `mouse-tracking` stage를 출발점으로 삼는다. 경계 전후의 소수 프레임에만 viewport 세대, 입력 sequence, frame ID, offset, target ID, enter/exit 수, 실제 hover 수, 슬롯 생성, 라벨 layout, build/layout/paint와 desktop 이동 간격을 연결한다. 경계 콜백이 frame N 끝에 요청한 일이 N+1에서 수행될 수 있다. `mouse-tracking` 하나의 소요 시간이나 전체 평균만으로 귀속하지 않는다. 여러 컨트롤에서 hit test 자체가 공통으로 늦을 때만 annotation 경로·transform 계산을 좁히며, 스크롤·clip·분리·겹침 순서 변경 후의 재판정과 커서 우선순위를 보존한다. [기존 stage](Nelyx/src/framework/widgets/root.ts#L1105)

## 4. 완료 기준과 현재 실행 가능한 명령

- 기준판은 **현재 W9 변경분을 포함한 공급**으로 잡는다. 후보와 번갈아 3쌍, 동일 장치·모니터·창·배율·기본 Hermes bytecode·legacy 준비 모드에서 비교한다. 수정한 Material/Core의 dist, 설치된 패키지, 실행 HBC와 native host를 식별한다. 상세 프로파일링은 원인 판정에 사용하고 채택 수치는 상세 계측을 끈 실행에서 얻는다.
- 주 지표는 컨트롤 통과 구간의 **실제 desktop 이동 간격 p95와 30FPS 예산 초과 시간(ms/s)**이다. 경계 표본 수와 인접 정상 프레임, 33.33~50ms·>50ms 횟수, p99·최장도 제시한다. 짧은 구간은 같은 조건의 반복 통과를 모으고 개별 실행 결과를 남긴다. 증상이 나타난 대상에서 두 주 지표의 3회 중앙값이 줄고 3쌍 중 2쌍 이상 같은 방향이며, 예상한 소스 단계의 작업도 줄어야 한다. W9 일반 화면 기준인 활성 구간 엔진·desktop 하한 각각 ≥30 FPS, ≥100ms 간격·진행 정체 0회를 함께 적용한다. [W9 판정 기준](work9.md#L111)
- 재현 대상은 Demo의 `All components`다. 왼쪽을 조작하는 동안 오른쪽 열의 기준 버튼 위치를 확인한다. 양쪽 손잡이 값·조작·접근성 위치, RTL·사용자 정의 모양, hover 색·커서·이탈, 텍스트·선택·포커스·편집기 내부 스크롤을 확인한다. 수직 통과 중 슬라이더 값·편집 상태 변화와 입력 손실을 검사한다.
- PowerShell 가상 트랙패드의 송신 간격, 기본 앱에서의 물리 트랙패드 체감, desktop 캡처 하한을 각각 기록한다. 물리 확인 전에는 사용자 증상의 개선을 미확정으로 남긴다. 여백과 컨트롤의 차이가 재현되지 않으면 최초 mount 등 독립적으로 확인된 결과만 기록한다. 검사당 제한은 20분, 반복은 통상 30회 이내로 한다. [저장소 지침](.github/copilot-instructions.md)

루트에서 아래 명령을 실행한다. 스크립트는 마지막으로 빌드한 기본 Demo bytecode 패키지를 별도 창에 열고, 최대화한 `All components`의 왼쪽 열을 두 손가락 입력으로 내렸다가 되돌린다. 처음이거나 소스를 변경했으면 `npm.cmd run run:windows --workspace @nelyx/demo`로 패키지를 먼저 갱신한다. 가상 정밀 터치패드를 지원하는 Windows와 가용 폭 1,000 논리 px를 넘는 디스플레이가 필요하다.

```powershell
pwsh -NoProfile -File sample/nelyx-demo-app/eng/test-all-components-scroll.ps1
```

커서는 기본으로 왼쪽 열 너비의 50%, 높이의 80% 지점에 머문다. 같은 구간에서 여백과 비교할 때는 `-CursorX 0.02`로 실행한다. 테스트 도중에는 Demo 창을 전경에 두고 커서를 그대로 둔다. Windows에 두 접점의 위치를 16ms마다 보내며, 종료 시 DirectManipulation의 `panZoomStart/Update/End`, 편집기 도달, 처음 버튼 위치로의 복귀를 확인한다. `SendP50Ms/P95Ms/MaxMs`는 송신 간격이다. 컨트롤 목록은 제스처 사이 UI Automation 관측값이며 실제 hover 이벤트와 표시 프레임 간격은 §3의 별도 관측 대상이다. [실행 스크립트](sample/nelyx-demo-app/eng/test-all-components-scroll.ps1) · [Windows 터치패드 주입 API](https://learn.microsoft.com/en-us/windows/win32/input-precisiontouchpad/precision-touchpad-guide#injecting-touchpad-input)

물리 트랙패드의 입력 경로는 기본 앱의 DirectManipulation 로그로 확인할 수 있다. 최대화한 `All components`에서 컨트롤이 커서 아래로 지나가는 시작점과 컨트롤 바로 위 시작점을 번갈아 쓴다. 각 스트로크에서 접촉 중 이동, 손을 뗀 뒤 감속, 반전 때의 체감을 적는다. 한 방향으로 움직인 실행을 종료하면 `panZoomStart/End`와 `NELYX_NATIVE_EXIT`의 휠 수신량을 대조할 수 있다. [DirectManipulation 진단](Nelyx/engine/platform/windows/input/WindowsPrecisionTrackpad.h#L143)

```powershell
$previousTrackpadDiagnostics = $env:NELYX_TRACKPAD_DIAGNOSTICS
try {
    $env:NELYX_TRACKPAD_DIAGNOSTICS = '1'
    npm.cmd run run:windows --workspace @nelyx/demo -- -- 120000
} finally {
    $env:NELYX_TRACKPAD_DIAGNOSTICS = $previousTrackpadDiagnostics
}
```

## 5. 구현 및 원인 판정

- 기본 `RangeSlider`의 손잡이 hover와 overlay tick은 그리기만 갱신한다. 동일한 손잡이 상태가 반복되면 현재 애니메이션의 진행 방향을 확인해 재시작을 건너뛴다. 사용자 정의 손잡이도 위치가 그대로이고 값 표시기가 숨겨져 있으면 그리기만 갱신한다. 상태별 커서·색, 손잡이 위치가 움직이는 트랙, 조작 중이거나 표시 중인 값 표시기도 갱신한다. [경계 처리](packages/material/src/range-slider.ts#L723) · [호버 갱신](packages/material/src/range-slider.ts#L338) · [손잡이 위치 확인](packages/material/src/range-slider.ts#L1018)
- 라벨, 스타일, 방향, 배율 또는 문단 컨텍스트가 바뀔 때 해당 라벨의 레이아웃을 갱신한다. 시스템 폰트 변경 시 두 라벨을 다시 배치한다. RTL에서는 이미 방향을 반영한 그리기 좌표를 손잡이 ID에 그대로 연결했다. 제어값 애니메이션과 키보드·접근성 값 변경은 손잡이 값과 위치를 함께 갱신한다. [라벨 갱신](packages/material/src/range-slider.ts#L1010) · [손잡이 배치](packages/material/src/range-slider.ts#L1064)
- 원인 확인용 Hermes 엔트리는 일반 Demo 트리를 띄우고 viewport·입력 sequence·장면 ID·양쪽 offset을 연결한다. 상세 모드는 경계와 후속 프레임의 슬롯 생성, 그리기, 라벨 호출·실제 문단 layout, 편집기 소비 delta를 더 수집한다. 채택용 비교에서는 상세 모드를 껐다. Windows desktop 픽셀의 프레임 표식과 장면 offset을 연결해 이동한 프레임을 집계했다. [진단 엔트리](sample/nelyx-demo-app/eng/scroll-hover-probe.mjs)

### 5.1 소스 회귀와 최초 생성

실제 FrameworkRoot에 붙은 기본 RangeSlider에서 기준판의 고정 커서 진입·이탈은 각각 위젯 3개를 빌드하고 라벨 layout을 2회 요청했다. 최종 후보는 두 경우 모두 0회였다. 손잡이 위에서 같은 상태의 hover를 18회 보내면 기본형의 render layout이 18→0회, 접근성 갱신 요청이 36→0회였다. 기준판의 중복 라벨 요청은 이 비교에서 문단을 다시 만들지 않았다. 사용자 정의 커서는 재해석됐고 overlay 색과 이탈, 손잡이 값과 bounds, RTL, 폰트 변경도 검사했다. [회귀 검사](packages/material/eng/check-range-slider-hover.mjs)

여백에서 시작한 상세 진단에서 첫 하강 offset 1,152px에 커서 대상 없이 `Text fields` 슬롯 7이 생성됐다. 슬롯 생성 44.42ms와 위젯 빌드 569회가 layout 60.04ms 안에 들어갔고 Scene은 76.88ms였다. 두 필드의 외부 render layout은 filled 4.04ms, outlined 2.33ms였고 프레임 전체의 실제 문단 layout 25회는 9.13ms였다. 같은 슬롯이 이미 유지된 재하강에서도 그림 17.67ms가 걸린 별도 프레임을 관측했다. 최초 생성 뒤의 수정과 비교는 §5.5에 있다.

### 5.2 Windows에서 렌더 변경 비교

Windows 2560×1459 물리 px, DPI 192, 165Hz, 기본 Hermes bytecode·legacy 준비 모드에서 기준판과 렌더 후보를 교대로 3쌍 실행했다. 이동 예산 초과량은 각 실제 desktop 이동 간격에서 33.33ms를 뺀 양수 합계를 구간 초로 나눈 값이다. 각 대상에 대해 48 논리 px 구간을 2회 왕복했다. 상세 진단에서 양쪽 대응 위치의 경계 진입·이탈과 슬롯 생성 0회를 확인했다. 처음 `field-outlined`에 사용한 1,776~1,824px 구간은 재생성 2회가 확인돼 1,752~1,800px에서 다시 비교했다. 오른쪽 열 offset과 기준 버튼 위치는 유지됐다.

| 대상과 커서 | 이동 간격 수 | p95 중앙값(ms) | 예산 초과 중앙값(ms/s) | p99 중앙값/최장(ms) | 33.33~50ms/>50ms 횟수 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `slider-value` 여백 | 65→64 | 35.05→36.78 | 12.96→20.90 | 36.78/42.20 → 36.91/47.17 | 5/0 → 5/0 |
| `slider-value` 경계 | 63→66 | 36.41→37.54 | 14.84→42.33 | 36.53/42.49 → 42.38/48.65 | 6/0 → 10/0 |
| `range-value` 여백 | 64→60 | 35.74→36.25 | 29.50→19.72 | 42.40/42.56 → 36.26/55.91 | 4/0 → 8/1 |
| `range-value` 경계 | 66→64 | 35.84→30.26 | 29.85→19.35 | 43.86/56.01 → 36.92/42.23 | 4/2 → 4/0 |
| `range-custom` 여백 | 67→62 | 30.25→34.56 | 9.12→29.27 | 36.85/42.38 → 42.44/59.80 | 4/0 → 4/1 |
| `range-custom` 경계 | 55→70 | 55.83→30.60 | 81.72→6.97 | 55.83/56.16 → 36.18/42.46 | 14/2 → 4/0 |
| `field-filled` 여백 | 65→67 | 30.40→30.90 | 0.00→20.35 | 32.43/36.44 → 42.11/42.17 | 1/0 → 2/0 |
| `field-filled` 경계 | 71→75 | 32.55→29.42 | 21.50→0.00 | 41.08/42.31 → 30.33/31.45 | 3/0 → 0/0 |
| `field-outlined` 여백 | 69→61 | 30.57→30.52 | 7.18→0.00 | 36.43/42.14 → 31.55/36.27 | 2/0 → 1/0 |
| `field-outlined` 경계 | 73→69 | 30.62→29.98 | 0.00→5.51 | 30.91/44.10 → 35.66/36.52 | 1/0 → 2/0 |

| 대상과 커서 | 실행별 p95(ms) | 실행별 예산 초과(ms/s) |
| --- | --- | --- |
| `slider-value` 여백 | 26.11 / 35.05 / 42.20 → 36.78 / 30.36 / 47.17 | 0.00 / 12.96 / 36.80 → 20.90 / 7.21 / 38.36 |
| `slider-value` 경계 | 42.49 / 36.31 / 36.41 → 37.54 / 42.09 / 36.71 | 44.75 / 14.84 / 14.83 → 42.33 / 59.77 / 28.98 |
| `range-value` 여백 | 35.74 / 35.87 / 31.63 → 36.25 / 30.86 / 55.91 | 30.54 / 29.50 / 0.00 → 19.72 / 7.45 / 102.86 |
| `range-value` 경계 | 35.84 / 31.72 / 50.39 → 30.05 / 36.92 / 30.26 | 29.85 / 24.21 / 117.20 → 22.54 / 19.35 / 7.78 |
| `range-custom` 여백 | 30.25 / 35.92 / 29.63 → 36.32 / 34.56 / 31.32 | 7.58 / 29.94 / 9.12 → 29.27 / 11.68 / 64.28 |
| `range-custom` 경계 | 56.16 / 44.28 / 55.83 → 30.60 / 42.31 / 23.35 | 81.72 / 80.04 / 124.19 → 6.97 / 54.17 / 0.00 |
| `field-filled` 여백 | 30.58 / 29.93 / 30.40 → 30.90 / 30.23 / 31.02 | 7.38 / 0.00 / 0.00 → 20.35 / 0.00 / 21.63 |
| `field-filled` 경계 | 32.55 / 36.01 / 29.51 → 27.71 / 29.42 / 30.16 | 21.50 / 23.51 / 0.00 → 0.00 / 0.00 / 0.00 |
| `field-outlined` 여백 | 30.57 / 31.25 / 30.54 → 36.27 / 30.52 / 24.39 | 0.00 / 7.18 / 20.98 → 7.38 / 0.00 / 0.00 |
| `field-outlined` 경계 | 30.62 / 29.56 / 31.99 → 29.98 / 28.92 / 30.52 | 0.00 / 0.00 / 25.53 → 0.00 / 5.51 / 8.03 |

- `range-value`의 경계 4건 직후 layout은 1.83~2.03ms에서 0.03~0.49ms로, semantics는 4.27~6.84ms에서 0.03~0.05ms로 줄었다. 후속 위젯 빌드 12→0회, 해당 라벨 호출 8→0회였다. `range-custom` 경계 8건의 후속 위젯 빌드는 24→0회, 해당 라벨 호출은 16→0회였다. 기본형 경계의 p95는 3쌍 중 2쌍에서, 사용자 정의형은 3쌍 모두에서 줄었다. 예산 초과는 두 대상 모두 3쌍에서 줄었다.
- 단일 Slider 경계 뒤에는 위젯 빌드 없이 9~13ms대 paint가 두 공급에서 관측됐다. 두 필드의 경계 시점과 다음 프레임을 비교한 결과는 일반 hit test 변경을 뒷받침하지 않았다. 채택 비교의 filled·outlined 변화는 RangeSlider 패치의 효과 집계에서 제외했다.
- 목록이 멈춘 상태에서 대상별 hover 패킷 13개를 관측했다. 기본 RangeSlider의 경계와 접근 가능한 후속 프레임 전체에서 라벨 호출 4→0회, 위젯 빌드 23→0회였다. 대응하는 desktop 프레임까지의 p95는 84.09→65.82ms였다. 사용자 정의형은 라벨 호출 4→0회, 위젯 빌드 22→19회, 대응 프레임 p95 88.07→107.78ms였다. 패킷별 후속 관측 프레임에는 변경된 픽셀이 없는 반복 hover도 포함된다.
- 두 RangeSlider 경계의 후보 최소 엔진·desktop 이동 FPS는 기본형 52.24·38.31, 사용자 정의형 45.31·32.94였다. 두 대상의 경계 구간에서 100ms 간격·정체는 0회였다. 전체 판정에서는 기본형 여백 하한 27.93 FPS와 첫 하강 108.48ms 간격이 남았다. 첫 하강/복귀/재하강의 후보 실행별 desktop FPS 하한은 34.99/40.86/45.08, 38.62/37.81/43.64, 37.40/41.99/39.77이었다. desktop 샘플링 간격의 최댓값은 34.68ms였다.

### 5.3 Windows 트랙패드 시작 지연

가상 정밀 터치패드로 좌표를 고정하고 약 0.8초의 짧은 수직 입력을 보냈다. 동일 offset의 여백에서 시작하면 세로 Scrollable이 일찍 이동을 시작했다. 슬라이더 위에서는 가로 recognizer와의 arena 경쟁 때문에 세로 recognizer가 터치 이동 임계값을 기다렸다. 우승 뒤 `DragStartBehavior.start`가 경쟁 중의 누적 delta를 소비하지 않는 경로를 확인했다.

Windows native의 스크롤 recognizer는 DirectManipulation의 pan에 축 우세와 정밀 포인터 임계값을 적용하고, 이 스트림이 arena에서 수락될 때 누적한 첫 delta도 전달한다. 두 손잡이를 포함한 가로 조작과 세로 스크롤 경쟁을 회귀 사례로 검증했다. 짧은 세로 입력 9px과 손잡이 값 유지, 가로 입력에 따른 손잡이 값 변경과 목록 위치 유지를 단언했다. [축 선택과 누적 delta](Nelyx/src/framework/gestures/monodrag.ts#L365) · [Windows Scrollable 설정](Nelyx/src/framework/widgets/scrollable.ts#L454) · [회귀 검사](packages/material/eng/check-range-slider-hover.mjs)

| 시작 위치 | 왼쪽 시작 offset(px) | 첫 desktop 이동까지(ms) | 바깥 열 최종 이동(px) | 최종 소비 위치 |
| --- | ---: | ---: | ---: | --- |
| `slider-value` | 1,200 | 300.04→43.45 | 24.75→43.11 | left |
| `range-value` | 1,344 | 311.48→68.27 | 24.75→43.11 | left |
| `range-custom` | 1,344 | 348.85→67.94 | 23.57→43.11 | left |
| `field-filled` | 1,632 | 49.73→53.83 | 43.11→43.11 | left |
| `field-outlined` | 1,776 | 43.11→50.63 | 43.11→41.93 | left |

모든 쌍에서 `panZoomStart/Update/End`를 관측했다. 최종 `range-value` 여백 대조는 47.60ms에 이동을 시작해 43.11px 이동했다. 내부 범위가 0인 두 필드에서는 바깥 열이 첫 delta를 받았다. 긴 텍스트의 내부 범위가 216px인 outlined 필드에서는 안쪽 offset이 24.75→43.11px 이동했고 바깥 열은 0px 이동했다. 두 RangeSlider의 접촉 중 desktop p95는 최종 공급에서 42.68ms·54.41ms였다. 표의 최종 이동량에는 접촉 종료 뒤 이동이 포함된다.

### 5.4 카드 분할 전 공급과 검증

- Core와 Material 빌드, source/dist와 설치본의 파일 동일성, 최종 기본 Demo 실행을 확인했다. 최종 기본 HBC는 `765d73e653fc22b133ed8b9e199d8efd132171acbf6d8622e6fe0f29a589c478`이며 공통 native host는 `5b0d990359f7f5a6aa54071af8ce162bfaf0153fd92e2af26baef785bcb5251e`다. 기본 HBC 기준판은 `5653cd02…`이고, §5.2의 진단 HBC는 `0b64d063…`(기준)과 `57d0b561…`(렌더 후보)이다. §5.3의 최종 진단 HBC는 `4d5bce90…`이다.
- 최종 기본 앱에서 UI Automation의 양쪽 손잡이 값 변경과 bounds, 포커스와 방향키, 사용자 정의형의 RTL/LTR, 한글·이모지 입력과 선택, 긴 문장의 내부 스크롤 검사를 통과했다. 오른쪽 기준 버튼은 유지됐다.
- 가상 터치패드 실행은 제스처 사이에 중간 컨트롤을 관측할 수 있도록 한 스트로크를 장치 좌표 30mm로 조정했다. 최종 기본 앱에서 왼쪽 열 중앙과 여백을 각각 19개·20개 스트로크로 한 번씩 왕복했다. 두 실행 모두 다섯 컨트롤 관측, 시작 위치 복귀, 오른쪽 고정, host 입력 거부 0건을 확인했다. 송신 간격 p95는 두 실행 모두 16.03ms였다. [PowerShell 실행](sample/nelyx-demo-app/eng/test-all-components-scroll.ps1)
- 이 공급에서 여백의 슬롯 7 최초 생성은 39.24ms였다. 위젯 빌드 569회, Scene 79.39ms를 관측했다. 이 프레임의 버튼 12개 build는 8.14ms, 기본 스타일 구성은 그중 1.38ms였다.
- Core 수정 뒤 상세 계측을 끈 추가 실행에서 기본·사용자 정의 RangeSlider 경계의 p95는 각각 29.05ms·41.01ms였다. 첫 하강의 desktop 이동 간격은 최장 119.95ms였다.

### 5.5 Text fields 최초 진입

`Text fields`를 머리말과 편집기, 편집 옵션, 메시지 스크롤 조작의 세 항목으로 나눴다. 각 항목은 기존 왼쪽 목록이 해당 위치를 처음 layout할 때 생성한다. 열을 배정한 뒤 목록 항목을 확장하므로 슬라이더와 오른쪽 열의 배열은 유지된다. 겉으로 이어진 카드의 여백, 테두리, 동작 순서를 보존한다. 각 항목은 마운트 이후 기존 편집기 카드와 같은 keep-alive를 사용하고, 편집 값과 설정은 기존 상태 소유자와 알림을 공유한다. [목록 구성](sample/nelyx-demo-app/src/components.ts#L361) · [카드 항목](sample/nelyx-demo-app/src/components.ts#L477) · [테두리](sample/nelyx-demo-app/src/gallery-section.ts#L69)

같은 native host에서 W9 재빌드와 최종 후보를 비교했다. 최초 하강은 60Hz 가상 휠의 각 12 논리 px를 160회 보내 offset 0에서 1,920px까지 갔다. 최초 생성 프레임에서 다섯 컨트롤의 hover는 관측되지 않았다. 슬롯 생성 시간이 들어간 layout과 전체 Scene은 상세 계측 값이다.

| 공급·커서 | 슬롯 및 offset(px) | 슬롯 생성(ms) | 위젯 빌드 | layout(ms) | Scene(ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| W9 · 중앙 | 7 · 1,152 | 36.93 | 569 | 53.71 | 68.31 |
| W10 · 중앙 | 7 · 1,152 | 17.45 | 200 | 27.32 | 40.87 |
| W10 · 중앙 | 8 · 1,488 | 14.16 | 196 | 18.01 | 28.17 |
| W10 · 중앙 | 9 · 1,584 | 11.34 | 226 | 17.49 | 33.56 |
| W10 · 여백 | 7 · 1,152 | 17.80 | 200 | 29.58 | 42.31 |
| W10 · 여백 | 8 · 1,488 | 10.77 | 195 | 14.92 | 27.65 |
| W10 · 여백 | 9 · 1,584 | 14.73 | 226 | 19.31 | 33.27 |

상단 복귀 뒤 두 경로의 재하강에서 세 항목의 재생성은 0건이었다. offset 1,920px에서 편집기 및 조작 요소 13개의 UI Automation bounds는 두 공급의 비교 12회에서 모두 같았다.

### 5.6 W9와 카드 분할 후보의 Windows 데스크톱 비교

W9와 카드 분할 후보의 진단 HBC는 각각 `df3a0a1d…`와 `741e9fee…`였다. host는 §5.4와 동일했다. 두 공급을 번갈아 실행해 중앙과 여백을 각각 3쌍 비교했다. 상세 계측을 끄고 첫 하강·복귀·재하강을 기록한 뒤 각 컨트롤의 48 논리 px 구간에서 6px씩 2회 왕복했다. 별도 상세 실행에서 중앙의 다섯 대상은 각각 진입과 이탈 2회씩, 여백은 각각 0회였고, 경계 구간의 슬롯 생성은 0건이었다. 두 RangeSlider는 경계 직후 각각 위젯 빌드 12→0회와 라벨 layout 호출 8→0회였다. 모든 비교에서 오른쪽 열 offset과 기준 버튼 bounds가 유지됐다.

| 최초 하강·복귀·재하강 | 이동 간격 수 | p95 / p99 중앙값(ms) | 초과 예산 중앙값(ms/s) | 최장(ms) | 33.33~50ms / >50ms | W10 최소 엔진 / desktop FPS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 중앙 첫 하강 | 360→383 | 41.99→36.76 / 66.42→62.45 | 79.26→48.81 | 109.02→66.99 | 39/8 → 27/11 | 53.62 / 45.90 |
| 중앙 복귀 | 382→406 | 41.04→36.37 / 51.56→49.80 | 46.65→28.41 | 79.18→66.90 | 36/6 → 22/5 | 55.87 / 50.44 |
| 중앙 재하강 | 377→394 | 42.26→36.54 / 58.56→56.16 | 53.76→39.04 | 66.77→67.99 | 31/12 → 26/7 | 55.84 / 46.64 |
| 여백 첫 하강 | 391→379 | 36.40→36.64 / 55.41→60.26 | 55.49→54.97 | 115.03→75.95 | 26/6 → 25/12 | 54.75 / 45.50 |
| 여백 복귀 | 376→384 | 40.88→38.27 / 52.13→55.16 | 49.71→46.90 | 83.37→65.49 | 42/6 → 28/8 | 55.12 / 46.87 |
| 여백 재하강 | 381→388 | 36.51→37.13 / 55.99→54.66 | 37.76→45.77 | 77.27→68.77 | 33/7 → 30/8 | 55.87 / 47.35 |

첫 하강의 100ms 이상 desktop 이동 간격은 중앙 1→0건, 여백 2→0건이었다. 카드 분할 후보의 열 왕복 및 컨트롤 경계에서 활성 구간 엔진·desktop FPS 하한은 각각 37.50·31.56 이상이었다. Desktop 관측기의 최장 샘플 간격은 35.30ms였고 판독 오류는 없었다.

| 컨트롤·커서 위치 | 이동 간격 수 | 실행별 p95(ms) | 실행별 초과 예산(ms/s) | p99 중앙값 / 최장(ms) | 33.33~50ms / >50ms |
| --- | ---: | --- | --- | ---: | ---: |
| `slider-value` · 경계 | 65→62 | 40.78 / 31.54 / 36.71 → 42.09 / 36.36 / 36.48 | 13.97 / 6.00 / 35.30 → 53.99 / 30.79 / 28.43 | 40.78→42.92 / 48.79→46.72 | 4/0 → 9/0 |
| `range-value` · 경계 | 60→64 | 64.61 / 42.26 / 54.40 → 30.17 / 42.27 / 36.34 | 119.54 / 39.71 / 144.31 → 5.09 / 55.95 / 23.12 | 54.40→42.66 / 64.61→54.24 | 9/3 → 4/1 |
| `range-custom` · 경계 | 67→69 | 37.13 / 41.70 / 43.86 → 25.92 / 35.43 / 36.26 | 22.49 / 51.90 / 56.93 → 0.00 / 14.13 / 16.51 | 42.31→36.53 / 50.47→36.68 | 8/1 → 6/0 |
| `field-filled` · 경계 | 72→68 | 25.86 / 29.85 / 30.36 → 30.78 / 30.42 / 24.94 | 0.00 / 13.44 / 16.21 → 5.86 / 2.45 / 0.00 | 40.50→34.64 / 41.98→36.46 | 2/0 → 2/0 |
| `field-outlined` · 경계 | 72→73 | 36.40 / 36.35 / 29.78 → 25.90 / 30.61 / 30.25 | 22.15 / 12.10 / 0.00 → 0.00 / 18.59 / 0.00 | 36.76→31.88 / 42.09→43.25 | 4/0 → 1/0 |
| `slider-value` · 여백 | 67→71 | 29.91 / 36.34 / 36.09 → 26.56 / 29.93 / 30.43 | 0.00 / 30.27 / 24.88 → 19.29 / 13.76 / 5.56 | 43.85→40.67 / 44.07→43.62 | 5/0 → 3/0 |
| `range-value` · 여백 | 66→63 | 41.11 / 45.44 / 29.36 → 35.91 / 30.62 / 29.57 | 35.82 / 88.44 / 0.00 → 13.22 / 5.75 / 0.00 | 44.66→36.40 / 50.58→37.80 | 5/1 → 3/0 |
| `range-custom` · 여백 | 65→64 | 36.29 / 30.94 / 30.33 → 29.62 / 30.58 / 33.74 | 55.88 / 1.41 / 0.00 → 2.92 / 19.96 / 40.71 | 34.08→43.98 / 54.87→54.64 | 4/1 → 3/1 |
| `field-filled` · 여백 | 71→63 | 30.99 / 30.46 / 32.16 → 37.75 / 36.48 / 44.17 | 25.02 / 20.41 / 6.18 → 50.16 / 31.80 / 77.97 | 44.22→55.67 / 46.68→60.46 | 3/0 → 5/2 |
| `field-outlined` · 여백 | 67→60 | 36.10 / 30.14 / 29.80 → 41.94 / 32.36 / 30.85 | 47.93 / 8.50 / 25.03 → 29.19 / 5.30 / 18.03 | 46.68→41.94 / 53.60→42.95 | 4/1 → 5/0 |

기본 RangeSlider 경계의 두 주 지표 중앙값은 54.40→36.34ms와 119.54→23.12ms/s였고 2쌍에서 함께 줄었다. 사용자 정의형은 41.70→35.43ms와 51.90→14.13ms/s였고 3쌍에서 함께 줄었다. `field-filled` 여백에서는 두 주 지표 모두 3쌍에서 늘었다. `slider-value` 경계의 초과 예산과 `range-custom` 여백의 초과 예산도 증가했다. 전체 수락은 `performanceAccepted=false`로 둔다.

`field-filled` 여백을 추가 계측한 실행에서 offset 1,686px의 Scene 27.57ms 중 `compose`가 25.06ms였다. 해당 프레임에서 슬롯 생성과 위젯 빌드는 0건이었다. 세 일반 비교 중에는 엔진 22.04ms 뒤 surface 간격이 52.81ms까지 늘어난 사례와, Scene 자체가 43.62ms였던 사례도 있었다. 여백에서 반복된 표시 간격 증가를 한 단계에 귀속하는 근거는 아직 부족하다. [Scene 조립 경로](Nelyx/src/framework/painting/context.ts#L581)

### 5.7 기본 패키지 검증

- `npm.cmd run run:windows --workspace @nelyx/demo -- -- 2500`으로 기본 `src/index.ts` 엔트리를 다시 빌드해 실행했다. HBC SHA-256은 `f979c28c365b559a4540474d3f855f6e92a3d209c6b8ae4caa51e69649efc334`다. Core의 `monodrag`·`scrollable`과 Material의 `range-slider`는 dist와 설치본 파일이 일치했다.
- 기본 패키지의 가상 정밀 트랙패드가 중앙 18회, 여백 19회 스트로크로 다섯 컨트롤을 통과해 처음 위치로 돌아왔다. 오른쪽 열 기준 버튼이 유지됐고 host 입력 거부는 양쪽 모두 0건이었다. 송신 p95는 각각 16.03ms였다. [PowerShell 검사](sample/nelyx-demo-app/eng/test-all-components-scroll.ps1)
- 합성 카운터를 추가한 뒤 기본 실행 명령을 다시 확인했다. 제품 HBC와 native host의 해시는 동일했고, DirectManipulation 진단이 초기화된 상태로 종료 코드 0을 받았다.
- 오른쪽 열을 그대로 두고 왼쪽을 상단까지 되돌렸다 재진입했을 때 편집기의 한글·이모지 값, 선택, 키보드 포커스와 위치가 유지됐다. 긴 텍스트를 불러온 뒤 스크롤 컨트롤러 전환, 한 줄·여러 줄 전환, 다크 테마와 단일 열 `Text inputs` 이동도 확인했다. 별도 상세 진단에서 메시지 내부 스크롤이 0→216→0px로 바뀔 때 바깥 offset은 1,920px로 일정했다.
- 실제 물리 트랙패드 입력 경로와 체감은 아직 확인하지 않았다. 패키지 판정은 `physicalInputAccepted=notVerified`다.

### 5.8 카드 분할과 여백 지연의 대조

같은 W10 Core·Material과 Windows host를 사용하고 카드 구현만 분할 전후로 바꿨다. 단일 카드 진단 HBC는 `e2708279…`, 분할 카드 진단 HBC는 `9511d7b6…`다. 편집기를 예열한 다음 여백에 커서를 고정하고 offset 1,680~1,728px를 6px씩 네 번 왕복했다. 필드 bounds, 오른쪽 열 offset, 오른쪽 기준 버튼 bounds가 일치했다.

| 쌍 | 데스크톱 이동 간격 수 | p95(ms) | 초과 예산(ms/s) | 최장(ms) |
| --- | ---: | ---: | ---: | ---: |
| 1 | 42→45 | 35.70→35.78 | 14.78→22.02 | 41.94→46.87 |
| 2 | 46→46 | 34.08→30.22 | 7.15→18.54 | 36.78→53.11 |
| 3 | 50→46 | 30.33→30.06 | 1.43→0.00 | 34.86→31.38 |

중앙값은 p95 34.08→30.22ms, 초과 예산 7.15→18.54ms/s였다. 양쪽 모두 100ms 이상 이동 간격은 0건이었다. 분할 카드의 가장 긴 53.11ms 사례는 1,704→1,698px 복귀였다. 해당 두 입력의 도착 간격은 16.72ms, 두 Scene 완료 사이 간격은 40.08ms, surface 완료 사이 간격은 44.14ms였다. 뒤 입력부터 Scene 시작까지 15.66ms, 이어진 Scene은 13.78ms였다.

별도 상세 실행에서 두 카드 모두 슬롯 생성과 대상 hover가 0건이었다. 프레임당 Scene 명령 중앙값은 61개, 다시 기록한 경계는 2개, 재사용한 경계는 6개였다. 합성 스코프·구조 캐시 누락 중앙값은 0건이었다. `compose` p95는 단일 카드 3.93ms, 분할 카드 3.75ms였다. Scene 조립 비용과 함께 경계·합성 재사용을 재현할 수 있도록 상세 진단에 해당 카운터를 기록한다. [진단 엔트리](sample/nelyx-demo-app/eng/scroll-hover-probe.mjs) · [합성 경로](Nelyx/src/framework/painting/context.ts#L581)

§5.6과 같이 첫 하강·복귀·재하강 뒤 세 슬라이더 구간을 먼저 왕복하고 `field-filled` 여백을 두 번 왕복한 경우의 결과다. 두 형태 각각 3회이며 상세 계측을 껐다.

| 쌍 | 데스크톱 이동 간격 수 | p95(ms) | 초과 예산(ms/s) | 최장(ms) |
| --- | ---: | ---: | ---: | ---: |
| 1 | 23→20 | 31.38→44.43 | 16.21→60.28 | 41.98→51.65 |
| 2 | 17→21 | 55.65→30.70 | 67.66→25.92 | 55.65→47.16 |
| 3 | 20→20 | 36.08→35.92 | 33.83→69.23 | 48.62→67.67 |

이 순서에서도 상세 실행의 Scene 명령 수와 경계·캐시 카운터 중앙값은 같았다. 단일 카드에서 offset 1,686px의 `compose`가 19.82ms인 프레임을 관측했고 그중 Scene 내보내기가 19.79ms였다. 여백 지연은 두 카드 구현에서 발생하며, 분할 뒤 합성 작업량 증가를 확인할 수 있는 반복 신호는 현재 없다.

목록이 각 항목에 자동으로 추가하는 repaint boundary를 활용해 `Text fields` 내부의 중첩 경계 하나씩을 덜어낸 후보(`b2bff81f…`)도 같은 순서로 비교했다. 세 쌍의 p95는 34.55/31.69/30.28→30.87/29.85/36.10ms, 초과 예산은 42.22/19.30/0.00→45.44/0.00/16.03ms/s였다. 상세 실행의 Scene 명령, 다시 기록한 경계와 재사용한 경계 중앙값은 각각 61·2·6으로 같았다. 두 지표가 함께 개선된 경우는 1쌍으로, 이 후보는 채택 기준에 미달했다. [자동 repaint boundary](Nelyx/src/framework/widgets/scroll-delegate.ts#L75)

### 5.9 목록을 멈춘 상태의 포인터 이동

카드 분할 이후 각 대상에 마우스를 두 번 넣고, 안쪽에서 위치만 바꿨다가 여백으로 뺐다. 각 대상에서 진입 2건, 이탈 2건, 대상 위 hover 6건을 관측했다. 입력 sequence가 같은 최초 Scene의 표시 표본으로 지연을 구했다. 각 단계에서 편집기와 슬라이더 위치, 양쪽 열 offset과 오른쪽 기준 버튼 bounds가 유지됐다.

| 대상 | 고정 offset(px) | 표시 표본 수 | 입력→desktop p95(ms) | 대응 최초 Scene의 위젯 빌드 / 라벨 layout 호출 |
| --- | ---: | ---: | ---: | ---: |
| `slider-value` | 1,440 | 6 | 53.30 | 0 / 0 |
| `range-value` | 1,512 | 7 | 69.69 | 0 / 0 |
| `range-custom` | 1,608 | 7 | 90.46 | 6 / 0 |
| `field-filled` | 1,680 | 7 | 37.63 | 0 / 0 |
| `field-outlined` | 1,752 | 6 | 35.63 | 6 / 0 |

사용자 정의 RangeSlider에서 손잡이 강조 애니메이션이 진행되는 동안 paint가 10.91~18.26ms인 Scene을 관측했다. outlined 필드의 위젯 빌드는 이탈 두 번에 3개씩 발생했고, 두 Scene은 9.42ms와 8.45ms였다. 이 표는 입력과 연결된 Scene 및 표시 시간의 상세 계측이다.

### 5.10 사용자 정의 RangeSlider 손잡이 호버

사용자 정의 트랙에서는 매 호버 tick에서 손잡이의 현재 중심을 접근성 자식의 배치 위치와 대조한다. 대기 상태에서 값 표시기가 숨겨져 있고 두 위치가 같으면 그리기만 갱신한다. 움직이는 트랙의 두 접근성 bounds와 표시 중인 값 라벨은 계속 갱신된다. 소스 회귀 검사에서 기본·사용자 정의·상태별 커서의 손잡이 호버 모두 위젯 빌드, 레이아웃, 접근성 갱신이 0건이었다. 트랙을 12px 옮기면 두 접근성 bounds가 함께 12px 이동했다. [호버 갱신](packages/material/src/range-slider.ts#L338) · [회귀 검사](packages/material/eng/check-range-slider-hover.mjs#L459)

같은 Windows host와 Hermes 도구 체인에서 변경 전후 HBC `7a2a0157…`와 `3b4ec49f…`를 비교했다. 두 번들의 소스맵에 공통된 878개 모듈 중 `range-slider.js`의 내용만 달랐다. 배율 200%의 최대화 창에서 offset 1,608px에 멈추고 두 손잡이를 번갈아 네 번 호버했다. 각 실행은 포인터 이동 16건으로 구성됐다. 상세 실행 두 번 모두 대상 진입 4건, 이탈 4건, 손잡이 위 hover 12건을 확인했다. 양쪽 열의 offset, 두 손잡이와 오른쪽 기준 버튼 bounds는 유지됐다.

상세 실행에서 위젯 빌드 합계는 57→0건이고 라벨 layout 호출은 양쪽 모두 0건이었다. Scene p95는 28.66→22.54ms, layout p95는 1.29→0.05ms, semantics p95는 5.66→3.23ms, paint p95는 16.06→14.94ms였다. 프레임당 다시 기록한 경계의 p95는 6→2개였다.

| 상세 계측을 끈 비교 | 진입·이탈 입력→desktop p95(ms) | 연결된 전체 입력→desktop p95(ms) | Scene p95(ms) |
| --- | ---: | ---: | ---: |
| 1 | 77.33→63.82 | 99.93→95.22 | 26.99→22.43 |
| 2 | 77.23→58.22 | 95.82→96.15 | 28.01→21.73 |
| 3 | 75.68→58.96 | 94.89→118.82 | 29.00→21.07 |

진입·이탈은 실행당 표시 표본 8개였고, 표의 세 쌍에서 p95 중앙값은 77.23→58.96ms였다. 내부 이동을 포함하면 실행당 표본은 10~12개였고 p95 중앙값은 95.82→96.15ms였다. 각 실행의 포인터 이동 4~6건은 같은 입력 sequence의 Scene이 없었다. 계측 구간의 desktop 표식 판독 오류는 0건이었다. 이 비교는 정지 상태의 손잡이 호버에 해당한다. 스크롤 중 `field-filled` 여백과 실제 물리 트랙패드의 수락 기준은 보류한다.

최신 기본 `src/index.ts` 패키지를 §5.7의 명령으로 빌드하고 실행했다. HBC SHA-256은 `c431ccf189c66c81053dd53df9d83b42ee882173da7d720ec78b84197fc9c3b9`이고 Windows host는 §5.4와 같다. Material dist와 설치본의 `range-slider.js` 해시도 일치했다. 기본 패키지의 가상 정밀 트랙패드는 중앙 20회, 여백 19회 스트로크에서 다섯 대상을 통과해 시작 위치로 돌아왔다. 송신 p95는 양쪽 모두 16.03ms였으며 수락 입력은 812·773건, 거부 입력은 양쪽 모두 0건이었다. [PowerShell 검사](sample/nelyx-demo-app/eng/test-all-components-scroll.ps1)

### 5.11 여백의 긴 프레임과 Hermes GC

같은 W10 공급의 별도 진단 HBC `555c1ce0…`에서 `field-filled` 여백을 예열한 뒤 offset 1,680~1,728px를 6px씩 네 번 왕복했다. 방향마다 휠을 따로 보내면 반전 시 입력 간격이 3.80ms까지 짧아졌고, 앞뒤 입력이 한 프레임에서 상쇄돼 같은 offset을 다시 표시하는 경우가 있었다. 한 스케줄에서 방향을 바꾸도록 바꿔 세 번 비교했다. 실제 반전 간격은 16.50~17.34ms였다. 각 실행에서 휠 64건을 모두 수락했고 오른쪽 열은 고정됐다.

| 상세 실행 | 이동 간격 수 | desktop 이동 p95 / 최장(ms) | Scene p95(ms) | compose p95(ms) |
| --- | ---: | ---: | ---: | ---: |
| 1 | 51 | 36.46 / 55.46 | 12.39 | 4.74 |
| 2 | 52 | 35.60 / 44.18 | 9.83 | 4.36 |
| 3 | 49 | 38.10 / 42.29 | 10.32 | 6.00 |

Scene 전후의 Hermes 누적 카운터를 231개 장면에서 읽었다. 42개 장면에서 young-generation GC 시간이 증가했고 가장 큰 증가량은 16ms였다. full GC 시간 증가량은 모두 0ms였다. `compose`가 17.09~18.58ms였던 네 장면은 대부분의 시간이 Scene 내보내기 구간에 있었고, 그중 한 장면의 GC 증가량은 15ms, 나머지 세 장면은 3~4ms였다. 네 장면의 실제 스트리밍 루프는 0.20~2.38ms였다. [Scene 내보내기](Nelyx/src/framework/rendering/layer.ts#L634) · [스트리밍 경로](Nelyx/src/ui/scene.ts#L699)

55.46ms 이동 간격에서는 복귀 뒤 첫 표시 offset이 1,680→1,698px로 바뀌었다. 사이의 offset 1,686px Scene에는 surface 완료 표본이 없었고, 1,692px Scene은 surface 완료가 있었으나 desktop 표식에서 관측되지 않았다. 1,698px Scene은 4.42ms에 끝났고 GC 시간 증가량은 0ms였다. 여백에서는 GC와 겹치는 Scene 지연, Scene·surface 완료 뒤의 표시 간격이 모두 관측됐다. 여백 성능 수락과 물리 트랙패드 검증은 계속 보류한다.

### 5.12 여백의 장면 제출과 데스크톱 표식

Windows native 호스트에서 바쁜 GPU 때문에 제출이 거절된 Scene은 CPU에 보존됐다가 최신 Scene으로 교체될 수 있다. 제출이 수락된 경우 Graphite 녹화는 Windows 작업 스레드로 넘어가고, UI 스레드의 DirectComposition 제출과 copy fence 확인을 거친다. 상세 진단에서 입력 수신·JS 전달, 프레임 콜백, Graphite 제출 시도 및 결과, copy fence와 desktop 표식을 같은 viewport 및 frame ID로 연결했다. [미제출 Scene 교체](Nelyx/src/hosting/runtime.ts#L718) · [Windows surface](Nelyx/sdk/native/windows-hermes/WindowSurface.h#L115) · [진단 엔트리](sample/nelyx-demo-app/eng/scroll-hover-probe.mjs)

같은 호스트에서 진단 HBC `460566a4…`로 §5.11의 여백을 실행당 네 번 왕복했다. 세 실행에서 이동한 Scene 181개 중 1개는 제출 시 busy였고, 나머지 180개는 copy fence 완료까지 연결됐다. 그중 desktop 캡처에 표식이 나타나지 않은 Scene은 36개였다. 이동 간격 p95는 36.33/39.54/35.96ms였고 실행별 최장은 46.56/67.02/66.63ms였다. 상세 실행 3회의 p95 범위는 Scene 완료→제출 시작 0.12~0.17ms, 제출 완료→copy fence 8.07~9.81ms, fence→관측된 표식 10.12~13.31ms였다.

67.02ms 간격에서 1,722→1,728→1,722→1,716px의 Scene은 모두 제출돼 copy fence가 완료됐다. 1,728px 표식만 캡처에서 관측되지 않았고, 나머지 offset의 표식 시각은 0·36.19·67.02ms였다. 두 Scene 사이에 반전점 표식이 빠지면 이동 간격 집계가 길어질 수 있다. 같은 offset·paint revision으로 연속 제출된 Scene은 세 실행에서 16·15·15개였다.

직전 수락 Scene과 render, paint revision, viewport·renderer·native surface 세대 및 출력 명령의 직렬화 값이 모두 같을 때 제출을 생략하는 후보를 비교했다. 두 진단 HBC는 `a9a33d1a…`와 `a43c4df2…`였고 명령 비교는 양쪽에서 실행했다. 상세 실행의 후보에서는 여백 같은 위치의 2개 Scene을 생략했고 위치가 바뀐 61개는 모두 제출됐다. 나머지 세 쌍에서는 상세 계측을 껐다.

| 쌍 | 이동 간격 수 | p95(ms) | 초과 예산(ms/s) | p99·최장(ms) | 33.33~50ms / >50ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 55→52 | 32.00→36.12 | 7.50→25.29 | 40.97→49.87 | 1/0 → 5/0 |
| 2 | 50→47 | 31.15→32.05 | 21.84→5.46 | 52.54→36.36 | 1/1 → 2/0 |
| 3 | 44→50 | 42.95→31.20 | 75.24→16.02 | 66.25→48.10 | 4/2 → 2/0 |

두 주 지표의 중앙값은 p95 32.00→32.05ms, 초과 예산 21.84→16.02ms였다. 두 지표가 함께 줄어든 경우는 1쌍으로 후보는 채택 기준에 미달했다. 상세 실행 3회와 이 일반 비교 6회에서 50ms 초과 간격 6개는 모두 휠 방향이 바뀌는 구간에 있었다. 상세 실행의 같은 방향 이동 p95는 30.70/31.37/34.96ms였다. 여백 지연의 판정에는 반전 직전 offset의 표시 관측 여부를 함께 사용한다. 전체 수락에는 실제 물리 트랙패드의 접촉·감속·반전 확인이 남아 있다.

### 5.13 같은 데스크톱에서 GDI와 DXGI 대조

정속으로 방향을 전환하는 똑같은 네 번의 여백 왕복에서 GDI 픽셀 표식과 DXGI Desktop Duplication을 함께 관측했다. DXGI에서는 표식이 든 1픽셀 높이의 띠를 읽고 desktop 이미지 갱신의 QPC 시각을 사용했다. 관측기가 받은 desktop 이미지 갱신은 실행별 96·91·90회였고 누적돼 건너뛴 갱신과 표식 판독 오류는 모두 0건이었다. [DXGI 프레임 시각·누적 갱신](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_2/ns-dxgi1_2-dxgi_outdupl_frame_info)

| 실행 | GDI→DXGI 이동 간격 수 | p95(ms) | 최장(ms) |
| --- | ---: | ---: | ---: |
| 1 | 55→56 | 35.62→36.16 | 50.20→54.85 |
| 2 | 52→56 | 36.38→30.42 | 54.50→54.74 |
| 3 | 55→54 | 36.33→36.39 | 49.82→48.30 |

위치가 바뀐 표식 중 DXGI에만 나타난 것은 12개였다. 12회의 반전점 중 9회는 두 관측기 모두에서 1,728px를 확인했고 3회는 해당 입력과 연결된 반전점 Scene이 없었다. 같은 방향으로 1,710→1,704px 이동하는 동안에도 DXGI의 54.85ms 간격을 관측했다. 해당 Scene 처리 40.78ms 중 접근성 처리가 34.00ms였고, 장면 완료 0.08ms 뒤 Graphite 제출을 시작했다. 반전점 표식이 관측된 다른 54.74ms 구간에서는 Scene이 31.37ms였고 접근성은 0.11ms였다. 두 관측기를 함께 실행한 진단에서 확인된 지연이며, 여백 성능 수락은 보류한다.

접근성 flush·스냅샷·freeze와 입력 좌표 준비·게시를 나눠 기록하는 진단 HBC `ea413b73…`로 같은 조건을 세 번 추가 검사했다. Scene 238개 중 접근성 flush는 13회였다. 접근성 단계 최장은 실행별 8.75·4.36·4.33ms였고, 하위 단계의 최장은 각각 flush 4.85ms, 스냅샷 5.62ms, freeze 0.60ms였다. 장면 합성에서 22.09ms와 20.64ms, 입력 좌표 준비에서 21.71ms인 사례가 각각 관측됐다. 이번 세 실행에는 desktop 이동 간격 50ms 초과가 없었다. 여백의 긴 장면은 여러 단계에서 산발적으로 나타나며, 34.00ms 접근성 지연의 하위 원인은 미확인이다. [접근성 단계](Nelyx/src/framework/widgets/root.ts#L918) · [입력 좌표 준비](Nelyx/src/framework/widgets/root.ts#L818)

진단을 추가한 뒤 기본 실행 명령으로 `src/index.ts` 패키지를 다시 빌드해 종료 코드 0을 확인했다. 제품 HBC는 §5.10의 `c431ccf1…`였다.

### 5.14 VM 실행량과 합성 중 GC

명시적 CPU 진단 모드에서 Scene 진입·복귀 전후의 VM 스레드 CPU 시간, Hermes GC 누계, 경과 시간을 읽었다. 기존 호스트와 HBC `2811bc24…`에서는 Scene 307개 중 CPU 시간이 0ms인 표본이 203개였고, Scene 경과 시간보다 1ms 이상 큰 표본이 99개였다. CPU 시간의 증분은 약 15.63ms 단위였다. 이 표본은 장면별 대기 시간 산출에 사용하지 않았다. [스레드 CPU 시간](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getthreadtimes)

같은 Hermes·Core·Material에 CPU 사이클 진단만 추가한 호스트 `bbcbe40f…`와 HBC `2aada169…`로 네 번 더 비교했다. 총 315개 Scene에서 8ms 미만이고 GC가 없었던 장면의 사이클 중앙값은 실행별 1,867만~1,912만이었다. 18ms 이상 걸린 장면은 네 개였고 모두 합성 단계의 시간이 가장 컸다. 사이클은 실제 실행량의 비교에 사용했다. [사이클 진단 포트](Nelyx/sdk/native/windows-hermes/EngineHermes.cpp#L55) · [Windows 사이클 계수](https://learn.microsoft.com/en-us/windows/win32/api/realtimeapiset/nf-realtimeapiset-querythreadcycletime)

| 실행·offset(px) | Scene(ms) | CPU 사이클(백만) | 합성(ms) | young GC 증가량(ms) |
| --- | ---: | ---: | ---: | ---: |
| 1 · 1,686 | 20.09 | 35.16 | 12.57 | 3 |
| 2 · 1,698 | 21.55 | 60.69 | 18.42 | 12 |
| 3 · 1,698 | 19.67 | 34.13 | 12.18 | 4 |
| 4 · 1,692 | 19.38 | 61.57 | 13.83 | 11 |

이 관측에서 긴 Scene 네 개에는 실행량 증가와 young GC가 함께 있었고 full GC 시간 증가량은 0ms였다. 55.98ms와 55.68ms의 GDI 이동 간격에서는 반전점 Scene의 copy fence 완료를 확인했으며, 두 표식은 캡처에서 관측되지 않았다.

### 5.15 Picture 캐시 조회 비용 대조

Scene 내보내기는 같은 Picture를 재생할 때도 캐시 조회에 앞서 임시 캡처를 생성한다. 캐시 적중에 한해 캡처를 생략하는 후보를 만들었다. 소스 검사에서 캐시가 기존 native handle을 다시 반환하고, GPU가 보유한 Picture는 캐시에서 제거된 뒤에도 해당 프레임이 반환될 때까지 유지됨을 확인했다. 캐시 재편입, 이전 리소스의 폐기, Picture dispose, 컴파일 실패 후의 정리도 확인했다. HBC 기준 `2aada169…`과 후보 `4d4f1d68…`은 `hosting/pictures.js` 한 모듈만 달랐으며 host는 §5.14와 동일했다. [Picture 조회](Nelyx/src/hosting/pictures.ts#L49)

상세 계측 한 쌍에서 Scene p95는 12.12→8.82ms, 합성 p95는 4.61→3.97ms였다. 8ms 미만이고 GC가 없었던 장면의 사이클 중앙값은 1,892만→1,898만이었으며, GC가 동반된 장면은 74개 중 8개→77개 중 11개였다. Scene 명령과 다시 기록한 경계의 중앙값은 각각 61개, 2개로 같았다.

상세 계측을 끈 실행은 §5.14와 같은 `field-filled` 여백에서 6px 정속 반전을 네 번 반복했다. 유효 실행마다 Win32 합성 휠 입력 64개가 수신됐고 왼쪽 offset은 기준점으로 돌아왔으며 오른쪽 열은 유지됐다.

| 쌍 | 이동 간격 수 | p95(ms) | p99·최장(ms) | 초과 예산(ms/s) | 33.33~50ms / >50ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 52→51 | 36.37→35.60 | 40.60→42.53 | 18.00→19.88 | 5/0 → 3/0 |
| 2 | 49→50 | 36.66→44.16 | 65.31→55.95 | 58.58→52.76 | 2/2 → 2/2 |
| 3 | 45→47 | 36.61→36.54 | 67.42→37.71 | 80.41→13.19 | 6/2 → 4/0 |

100ms 이상 이동 간격과 표식 판독 오류는 0건이었다. 입력 예정 시각 허용 범위를 벗어난 첫 시도는 제외했고, 동일 조건의 유효 실행으로 대체했다. p95와 초과 예산의 중앙값은 36.61→36.54ms, 58.58→19.88ms였으나 둘 다 줄어든 것은 세 쌍 중 한 쌍이었다. 캐시 후보는 원복했다.

### 5.16 상세 계측을 끈 VM 관측

캐시를 원복한 뒤 HBC `b6382781…`에서 프레임 단계와 위젯 관측을 끄고, 명시적 CPU 진단 모드의 사이클·GC 누계만 Scene 전후에 읽었다. 같은 host에서 §5.14의 여백 입력을 세 번 실행했다. 234개 장면 중 GC를 동반한 36개에서 young GC 증가량의 최장은 12ms였고 full GC 증가량은 모두 0ms였다. GC가 없고 8ms 미만인 장면의 사이클 중앙값은 실행별 1,837만·2,027만·1,847만이었다. [진단 엔트리](sample/nelyx-demo-app/eng/scroll-hover-probe.mjs)

| 실행 | 이동 간격 수 | Scene p95(ms) | desktop 이동 p95 / 최장(ms) |
| --- | ---: | ---: | ---: |
| 1 | 51 | 9.77 | 32.99 / 42.45 |
| 2 | 58 | 10.01 | 34.46 / 36.59 |
| 3 | 46 | 10.26 | 44.18 / 56.17 |

18ms 이상인 장면은 한 개였다. 시작 offset 1,680px로 복귀한 이 장면은 19.24ms, 6,736만 사이클, young GC 12ms였고 표시 표식도 관측됐다. 가장 긴 56.17ms의 표시 간격에 포함된 Scene은 모두 5ms 이내였고 GC 증가량은 0ms였다. 반전점 1,728px의 copy fence는 완료됐으며 해당 표식만 GDI에서 관측되지 않았다. 단계 계측을 꺼도 긴 Scene과 young GC가 겹치는 사례 및 Scene이 짧은 상태에서 표시 간격이 길어지는 사례가 각각 나타났다.

기본 `src/index.ts` 패키지를 §5.7의 명령으로 재빌드해 종료 코드 0을 확인했다. 제품 HBC는 `c431ccf189c66c81053dd53df9d83b42ee882173da7d720ec78b84197fc9c3b9`, host는 `bbcbe40f4dc8b23d010103d03c0d63f8a4767a146cc82bcdf147a95277cedd8e`다. 이 패키지에서 중앙과 여백 모두 20회 가상 트랙패드 스트로크로 다섯 대상을 통과하고 시작 위치로 돌아왔다. 양쪽 모두 오른쪽 열 기준 버튼은 유지됐고 입력 거부는 0건이었다. 송신 p95는 16.02·16.03ms였다. RangeSlider의 호버·접근성 소스 회귀 검사도 통과했다. `field-filled` 여백의 W9 대비 수락 및 물리 트랙패드 검증은 남아 있다. [PowerShell 검사](sample/nelyx-demo-app/eng/test-all-components-scroll.ps1) · [RangeSlider 소스 검사](packages/material/eng/check-range-slider-hover.mjs)

### 5.17 정밀 트랙패드 취소와 재접촉

창 비활성화, 크기 변경, 취소 메시지는 DirectManipulation의 진행 중 접촉을 중단한다. 기존 Windows 어댑터는 Core가 정의하지 않은 `panZoomCancel`을 보냈다. 기존 기본 패키지에서 가상 두 손가락을 댄 채 `WM_CANCELMODE`를 보내자 `panZoomCancel` 직후 0.77ms 만에 같은 접촉의 `panZoomStart`가 추가로 발생했다. 앱은 이 취소 경로에서 `Cannot read property 'original' of undefined`를 기록하고 비정상 종료했다. [취소·리셋 경로](Nelyx/engine/platform/windows/input/WindowsPrecisionTrackpad.h#L70) · [Windows 취소 메시지](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-cancelmode)

Windows 어댑터는 공용 `cancel`을 보내며 Core는 장치 종류를 trackpad로 유지해 저장한 경로를 해제한다. 취소로 끝난 드래그는 관성을 시작하지 않고, 정상 종료는 기존 속도를 사용한다. Windows는 `ReleaseAllContacts`·`Stop`·`ZoomToRect` 중의 상태 콜백을 억제하고 수동 갱신이 끝난 뒤 READY를 확인한다. 소스 회귀 검사에서 취소 직전까지 입력한 42px 반영, 취소 후 관성 없음, 같은 장치의 다음 입력 9px 반영, 정상 종료 관성을 확인했다. [Core 취소 처리](Nelyx/src/framework/gestures/monodrag.ts#L398) · [소스 회귀 검사](packages/material/eng/check-range-slider-hover.mjs#L426)

첫 수정의 진단 앱에서 취소 후 재접촉까지 왼쪽 offset은 77.30px였고, 이어진 제스처로 148.00px까지 이동했다. 오른쪽은 고정됐다. 정상 종료 뒤에는 `interaction END`가 리셋 중에 들어와 무시됐고, 입력이 없는 약 494ms 동안 수동 갱신이 23회 더 실행됐다. `END`를 받으면 리셋 중에도 활성 접촉 상태를 해제하도록 수정했다. [입력 갱신과 상호작용 상태](Nelyx/engine/platform/windows/input/WindowsPrecisionTrackpad.h#L129)

최종 host `f88edc09…`와 진단 HBC `3605e3a8…`에서 지정한 위치에 두 손가락을 댄 채 취소하고, 접점을 뗀 뒤 같은 장치로 다시 시작했다. 각 실행에서 시작 2건, 취소 1건, 정상 종료 1건이 수락됐다. 첫 접촉은 취소 후 남은 시간 동안 이어졌으나 그동안 추가 시작은 없었고 재접촉까지 offset은 고정됐다. 사용자 정의형의 UI Automation 값은 취소 전후 모두 25·75였다.

| 시작점 | 왼쪽 offset, 시작 → 취소 → 재접촉 후(px) | 오른쪽 | 정상 종료 END 이후 유휴 구간의 추가 갱신 |
| --- | ---: | --- | ---: |
| 왼쪽 여백 | 0 → 77.30 → 148.00 | 고정 | 1회 |
| 사용자 정의 RangeSlider 시작 손잡이 | 1,344 → 1,421.30 → 1,492.00 | 고정 | 1회 |

두 실행에서 마지막 갱신 뒤 타이머가 해제된 상태로 종료했다. 제스처 중 휠 대체와 입력 거부는 0건이었다. 접촉 중 실제 수신한 유효 `panZoomUpdate` 간격 p95는 네 스트로크에서 26.91~36.97ms, 최장은 39.84ms였다. 이 표본은 취소 검증에서 얻은 host 입력 시각이다.

최종 기본 `src/index.ts` 패키지 HBC는 `ebf1ffc9189d743b0b0198754deedc7f4df6d31ab86678dc313a338ea650da4f`, host는 `f88edc09a5a59a0fa2c8f8361c7f89c1c9fc421c5b616306869f25d5127ce5a0`이다. 기본 실행 명령으로 종료 코드 0을 받았다. 중앙과 여백에서 각각 20회 가상 두 손가락 입력으로 다섯 컨트롤을 통과해 시작점에 복귀했다. 오른쪽 기준 버튼이 유지됐고 입력 거부는 0건이었다. 송신 p95는 16.04·16.03ms였다. `field-filled` 여백의 성능 수락 및 물리 입력 검증은 계속 남아 있다. [PowerShell 검사](sample/nelyx-demo-app/eng/test-all-components-scroll.ps1)

### 5.18 가상 정밀 트랙패드의 접촉 중 표시 비교

W9 `a7b891e3`의 Core·Material·Demo 구현을 복원한 진단 HBC는 `2a822c44…`, 현재 구현의 진단 HBC는 `3605e3a8…`다. 소스맵에서 Core 6개, Material 1개, Demo 2개 모듈만 달랐고 나머지 869개는 일치했다. 두 번들의 Hermes VM, 리소스, §5.17의 host `f88edc09…`는 같았다. 호스트를 고정해 두 번들의 장면 처리와 표시를 비교했다. [장면·입력 진단 엔트리](sample/nelyx-demo-app/eng/scroll-hover-probe.mjs)

같은 최대화 창과 200% 배율에서 양쪽 모두 `field-filled`를 예열한 뒤 왼쪽 offset 1,632px에서 시작했다. 가상 두 손가락을 댄 상태로 16ms 간격의 전진·반전을 실행당 6번 반복했다. 고정 커서 여백에서 offset 1,680~1,728px의 같은 방향 이동만 집계했다. 실행별 실제 소비 속도 중앙값은 W9 254.52~262.29px/s, W10 253.19~264.40px/s였다. 두 방향에서 동일한 offset 구간을 사용했으며 오른쪽 열은 유지됐다. 상세 계측을 끈 여섯 실행은 제스처 중 `panZoom` 경로를 사용했다. 입력 거부, 휠 대체, GDI 표식 판독 오류는 0건이었다.

| 여백 비교 | 이동 간격 수 | p95(ms) | p99 / 최장(ms) | 초과 예산(ms/s) | 33.33~50ms / >50ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 91→96 | 41.61→41.23 | 54.95/54.95→48.85/48.85 | 49.45→40.08 | 12/1 → 13/0 |
| 2 | 89→90 | 42.86→37.30 | 49.60/49.60→54.60/54.60 | 70.77→36.03 | 18/0 → 10/1 |
| 3 | 87→102 | 41.56→31.75 | 54.39/54.39→42.35/42.95 | 45.95→13.93 | 15/1 → 5/0 |

여백 p95 중앙값은 41.61→37.30ms, 30FPS 예산 초과 시간은 49.45→36.03ms/s였다. 두 지표가 세 쌍에서 함께 줄었다. 같은 방향 구간의 W10 이동 Scene 완료와 desktop 표식의 FPS 하한은 46.80·47.14였다. 반전까지 포함한 접촉 중에는 100ms 이상의 이동 간격이 없었다. 별도 상세 실행에서는 양쪽 모두 모든 구간 장면에서 필드가 마운트돼 있었고, 대상 호버와 새 슬롯 생성은 0건이었다. 합성 p95는 5.02→3.88ms로 줄었으며 layout p95는 0.70→0.69ms였다.

### 5.19 같은 접촉에서 filled 필드의 위·아래 경계 통과

§5.18의 두 번들과 접촉 스케줄을 사용했다. UI Automation bounds로 커서 위치를 계산한 뒤 상세 실행으로 실제 호버 경계를 확인했다. 화면 좌표 (654, 1,199)에 커서를 고정했을 때 위쪽 경계 전환은 offset 1,676.05~1,688.31px, 아래쪽은 1,747.52~1,755.60px에서 관측됐다. 경계마다 여섯 왕복에서 진입·이탈 합계 12건을 양쪽 공급에서 확인했다. 두 구간의 모든 관측 Scene에서 `field-filled`가 마운트돼 있었고 새 슬롯 생성은 0건이었다.

| 경계 · 쌍 | 이동 간격 수 | p95(ms) | p99·최장(ms) | 초과 예산(ms/s) | 33.33~50ms / >50ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 위 · 1 | 87→88 | 42.16→36.59 | 61.11→54.41 | 53.17→29.83 | 11/1 → 7/1 |
| 위 · 2 | 84→92 | 41.92→35.80 | 68.55→41.87 | 59.70→14.21 | 9/2 → 5/0 |
| 위 · 3 | 95→94 | 37.02→36.81 | 42.76→49.95 | 22.26→34.17 | 7/0 → 8/0 |
| 아래 · 1 | 96→95 | 31.37→36.36 | 42.00→44.17 | 7.79→17.51 | 3/0 → 6/0 |
| 아래 · 2 | 93→96 | 36.28→36.40 | 48.50→41.79 | 29.67→11.69 | 7/0 → 5/0 |
| 아래 · 3 | 87→94 | 36.58→36.63 | 48.08→43.14 | 21.73→23.89 | 9/0 → 8/0 |

상세 계측을 끈 위쪽 1,660~1,708px 구간의 중앙값은 p95 41.92→36.59ms, 초과 예산 53.17→29.83ms/s였다. 두 지표는 두 쌍에서 함께 줄었다. 아래쪽 1,728~1,776px의 중앙값은 p95 36.28→36.40ms, 초과 예산 21.73→17.51ms/s였다. 아래쪽 경계는 두 지표 동시 개선 기준을 충족하지 않았다. 같은 offset의 여백 비교에서는 아래쪽 p95가 36.76→31.63ms, 초과 예산은 34.55→13.21ms/s였다. 양쪽 열 위치를 확인하면서 수집한 제스처 중 W10 전체 접촉의 왕복당 FPS 하한은 Scene 45.98, desktop 45.91이었다. 반전 포함 100ms 이상 이동 간격은 0건이었다.

상세 비교에서 아래쪽 경계 장면과 뒤 두 Scene에는 두 공급 모두 위젯 빌드가 없었다. 그 Scene의 최장은 W9 18.19ms, W10 9.38ms였다. W10의 상세 실행 중 60.60ms 표시 간격에서는 1,760.17px의 Scene이 13.97ms에 끝났고 copy fence가 완료됐으며, GDI에서는 해당 표식이 관측되지 않았다. 아래쪽 경계에서의 지연을 필드 위젯 빌드에 귀속할 근거는 없었다.

### 5.20 현재 공급의 휠 여백 재확인

같은 W9·W10 번들과 host로 첫 하강·복귀·재하강을 예열하고 세 슬라이더 여백을 왕복했다. 이어 `field-filled` 여백 1,680~1,728px에서 60Hz Win32 `SendInput` 휠을 6px씩 보내 네 번 왕복했다. 각 실행에서 64개 입력을 모두 수락했고, 각 왕복은 기준 offset으로 돌아왔다. 오른쪽 열은 고정됐으며 표식 오류와 100ms 이상 이동 간격은 0건이었다. 송신 간격 p95는 16.71~16.79ms였다.

| 쌍 | 이동 간격 수 | p95(ms) | p99·최장(ms) | 초과 예산(ms/s) | 33.33~50ms / >50ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 54→53 | 37.54→36.43 | 55.12→42.69 | 36.71→24.65 | 3/1 → 5/0 |
| 2 | 54→58 | 36.11→30.53 | 42.70→51.30 | 14.20→16.84 | 3/0 → 0/1 |
| 3 | 55→54 | 36.61→36.38 | 40.61→48.54 | 13.28→20.04 | 3/0 → 3/0 |

중앙값은 p95 36.61→36.38ms, 초과 예산 14.20→20.04ms/s였다. 두 지표가 함께 줄어든 것은 한 쌍이었다. §5.6에서 세 쌍에 걸쳐 늘었던 p95는 이번 실행에서 줄었고, 초과 예산은 여전히 수락 기준에 미달했다. W10의 최장 51.30ms 간격은 1,728px 반전점에 도달한 Scene이 39.53ms였던 사례다. 현재 공급의 `performanceAccepted=false`, `physicalInputAccepted=notVerified`를 유지한다.

### 5.21 현재 공급의 DXGI 데스크톱 비교

§5.18의 W9 HBC `2a822c44…`와 W10 HBC `3605e3a8…`를 같은 native host `f88edc09…`에서 번갈아 실행했다. Hermes VM과 리소스는 동일했다. 배율 200%, 165Hz 모니터의 최대화 창에서 상세 계측과 GDI 읽기를 끄고 DXGI Desktop Duplication만 사용했다. 12회 모두 표식 판독 오류와 누적 이미지 갱신은 0건이었다. 접촉 및 휠 반복 구간에서 desktop 이미지 갱신 4,055건을 수신했고, 실행별 이미지 갱신부터 표식 판독까지 p95는 4.41~4.97ms였다. 이동 간격은 각 이미지의 `LastPresentTime`으로 계산했다. GPU copy fence 뒤 UI 스레드가 받은 완료 통지는 대조 시각으로 사용했다. [DXGI 이미지 갱신 시각](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_2/ns-dxgi1_2-dxgi_outdupl_frame_info) · [DirectComposition 작업 순서](https://learn.microsoft.com/en-us/windows/win32/directcomp/architecture-and-components) · [호스트 완료 통지](Nelyx/sdk/native/windows-hermes/WindowSurface.h#L115)

| 구간·쌍 | 이동 간격 수 | p95(ms) | p99·최장(ms) | 초과 예산(ms/s) | 33.33~50ms / >50ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 위쪽 경계 1 | 89→97 | 41.97→30.41 | 54.54→36.35 | 41.43→1.67 | 7/1 → 1/0 |
| 위쪽 경계 2 | 96→98 | 30.61→30.60 | 36.40→42.41 | 6.62→8.13 | 4/0 → 3/0 |
| 위쪽 경계 3 | 98→95 | 36.48→30.54 | 54.69→42.46 | 24.48→9.76 | 6/1 → 4/0 |
| 아래쪽 경계 1 | 96→94 | 30.63→30.86 | 37.01→49.07 | 1.96→19.21 | 1/0 → 4/0 |
| 아래쪽 경계 2 | 93→90 | 36.37→36.32 | 50.28→49.04 | 31.48→25.69 | 8/1 → 8/0 |
| 아래쪽 경계 3 | 87→89 | 36.56→42.23 | 42.44→66.69 | 19.07→49.70 | 7/0 → 7/2 |
| 휠 여백 1 | 55→56 | 31.22→30.30 | 53.93→60.56 | 21.99→25.51 | 1/1 → 0/1 |
| 휠 여백 2 | 55→55 | 30.21→30.57 | 54.45→48.57 | 19.79→14.28 | 0/1 → 1/0 |
| 휠 여백 3 | 53→55 | 36.41→30.44 | 42.36→60.42 | 17.01→33.92 | 4/0 → 1/1 |

가상 정밀 트랙패드는 §5.19의 화면 좌표 (654, 1,199)에서 접촉을 유지한 여섯 왕복으로 위쪽 1,660~1,708px와 아래쪽 1,728~1,776px를 통과했다. 오른쪽 기준 버튼과 offset이 유지됐고 입력 거부와 휠 대체는 0건이었다. 송신 p95는 16.02~16.04ms, 아래쪽 경계의 실행별 이동 속도 중앙값은 251.63~262.17px/s였다. 스트로크별 이동률 하한의 최솟값은 Scene 46.41FPS, desktop 45.16FPS, 최장은 66.82ms였다. 휠 여백에서는 §5.20과 같은 화면 좌표 (72, 1,086)에서 1,680~1,728px를 6px로 네 번 왕복했다. 실행마다 휠 64건을 수락했고 반전·복귀와 오른쪽 열 고정을 확인했다. 두 장면에서 100ms 이상 이동 간격은 0건이었다.

위쪽 경계의 p95 중앙값은 36.48→30.54ms, 초과 예산은 24.48→8.13ms/s였고 두 지표는 2쌍에서 함께 줄었다. 아래쪽은 36.37→36.32ms, 19.07→25.69ms/s였고 함께 줄어든 것은 1쌍이었다. 휠 여백은 31.22→30.44ms, 19.79→25.51ms/s였고 함께 줄어든 쌍은 0쌍이었다.

W10 아래쪽의 최장 66.69ms는 1,768.58→1,760.17px의 이동이었다. 첫 표식 뒤 5.61ms에 입력이 도착했고 새 Scene 시작은 11.87ms, Scene 소요는 40.79ms, copy fence 완료 통지는 66.19ms였다. 휠 여백의 최장 60.56ms 구간은 다음 이동 Scene에 46.50ms를 썼다. 여백의 다른 60.42ms 구간에서는 기존 위치를 유지한 Scene이 19.15ms 걸린 뒤 다음 이동 Scene에서 세 휠 입력을 함께 반영했다. 아래쪽과 휠 여백에서 예산을 넘긴 간격 사이에 위치가 달라졌고 copy fence까지 완료된 미관측 Scene은 0개였다. [데스크톱 표식과 Scene 연결](sample/nelyx-demo-app/eng/scroll-hover-probe.mjs)

별도 W10 상세 실행에서는 아래쪽 경계의 최장 이동 간격이 36.39ms, 휠 여백은 36.37ms였다. 필드 통과에서 같은 표식을 GDI로 함께 읽었다. 접촉 중 DXGI에만 있었던 표식은 아래쪽 비교 구간 밖의 1개였다. CPU 프로파일링을 활성화한 추가 실행에서는 접촉 중 비교 구간의 최소 이동 표본 수를 충족하지 못했고, 앞 표의 긴 장면에서 시간을 쓴 세부 단계는 확인하지 못했다.

또 한 번의 W10 상세 실행에서 기존 Windows 입력 추적 버퍼로 접촉 중 poll과 컨텐츠 콜백을 연결했다. DirectManipulation poll 간격 491개에서 p95는 27.16ms, 최장은 41.03ms였다. 이동 delta가 있는 입력 간격 468개에서는 p95 28.96ms, 최장 42.07ms였다. 33.33ms를 넘긴 8개 중 3개는 사이에 poll이 없었고 5개는 poll을 실행했지만 컨텐츠 콜백이 없었다. 가장 긴 42.07ms에는 중간 poll이 있었고, 40.99ms에는 중간 poll 없이 그 사이 데스크톱 이미지 네 개가 갱신됐다. 입력 발생에서 JS 전달 시작까지 p95는 12.61ms였다. 이 결과는 poll 간격과 컨텐츠 콜백을 모두 관측해야 아래쪽 경계의 입력 간격을 해석할 수 있음을 보여준다. [DirectManipulation 갱신](Nelyx/engine/platform/windows/input/WindowsPrecisionTrackpad.h#L112) · [입력 추적 버퍼](Nelyx/engine/platform/windows/input/WindowsInputTrace.h)

기본 `src/index.ts`는 루트에서 `npm.cmd run run:windows --workspace @nelyx/demo -- -- 2500`으로 다시 실행했다. §5.17의 제품 HBC와 host를 확인했고 종료 코드는 0이었다. 아래쪽 경계와 휠 여백은 아직 W9 대비 수락 기준에 미달한다. `performanceAccepted=false`, `physicalInputAccepted=notVerified`를 유지한다.

### 5.22 정밀 트랙패드 갱신 주기

`WM_TIMER`는 UI 큐에 더 높은 우선순위의 메시지가 남으면 전달이 늦어진다. §5.21에서 40.99ms 동안 갱신을 호출하지 않은 사례에 대응해, native host의 메시지 대기에서 14ms 고해상도 one-shot 타이머도 함께 기다리도록 바꿨다. 타이머가 깨어나면 기존 DirectManipulation 갱신은 HWND 소유 스레드에서 실행된다. 접촉이나 리셋 처리가 남아 있을 때만 다음 타이머를 예약하고, 타이머를 지원하지 않는 환경에서는 기존 `WM_TIMER` 경로를 사용한다. [호스트 메시지 대기](Nelyx/sdk/native/windows-hermes/main.cpp#L75) · [Windows 타이머 메시지 우선순위](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-timer) · [고해상도 타이머](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-createwaitabletimerexw) · [타이머·메시지 동시 대기](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-msgwaitformultipleobjectsex)

비교용 host `dc8710af…`는 기존 `f88edc09…`와 동일한 컴파일러·링크 입력에서 메시지 대기 코드만 바꿔 만들었다. 진단 HBC `3605e3a8…`, Hermes VM, 리소스를 고정했다. 상세 실행 한 쌍에서 DirectManipulation poll 간격 p95는 27.16→14.66ms, 최장은 41.03→16.32ms였다. 이동 delta가 있는 입력의 p95는 28.96→28.65ms, 최장은 42.07→29.33ms였다. 33.33ms를 넘는 이동 입력 간격은 8→0건이었다. 후보 실행에서도 갱신 후 이동 콜백이 없는 표본은 남아 있다.

별도의 세 쌍에서는 상세 계측을 끄고 §5.21의 필드 통과를 반복했다. 두 host 모두 DXGI 표식 판독 오류와 누적 이미지 갱신, 휠 대체, 입력 거부가 0건이었고 오른쪽 열은 고정됐다. 아래쪽의 실행별 이동 속도 중앙값은 기존 254.83~257.53px/s, 후보 265.76~266.17px/s였다. 스트로크별 엔진·desktop 이동률 하한은 46.58→54.66FPS 및 45.30→52.48FPS였고 100ms 이상 간격은 0건이었다.

| 구간·쌍 | 이동 간격 수 | p95(ms) | p99 / 최장(ms) | 초과 예산(ms/s) | 33.33~50ms / >50ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 위쪽 경계 1 | 94→115 | 36.30→30.23 | 43.37/43.37 → 30.86/42.48 | 17.40→4.78 | 6/0 → 1/0 |
| 위쪽 경계 2 | 90→111 | 30.66→30.42 | 48.69/48.69 → 36.64/36.67 | 16.31→6.60 | 4/0 → 4/0 |
| 위쪽 경계 3 | 90→108 | 30.50→30.35 | 48.18/48.18 → 36.24/36.31 | 10.02→5.89 | 2/0 → 4/0 |
| 아래쪽 경계 1 | 91→111 | 34.95→30.44 | 49.70/49.70 → 36.35/37.27 | 28.63→3.71 | 5/0 → 2/0 |
| 아래쪽 경계 2 | 94→115 | 36.54→30.19 | 48.75/48.75 → 36.49/36.51 | 24.31→3.39 | 6/0 → 2/0 |
| 아래쪽 경계 3 | 89→106 | 35.39→30.91 | 37.07/37.07 → 36.38/43.03 | 7.84→11.48 | 5/0 → 5/0 |

위쪽의 두 지표 중앙값은 p95 30.66→30.35ms, 초과 예산 16.31→5.89ms/s로 모두 3쌍에서 줄었다. 아래쪽은 35.39→30.44ms, 24.31→3.71ms/s였고 두 지표가 함께 줄어든 것은 2쌍이었다. 이 비교의 기준은 W10 타이머 변경 전 host이며 §5.21의 W9와 교차 실행한 비교와는 별도다.

사용자 정의 RangeSlider 시작 손잡이에서 2접점으로 이동 중 취소하고 재접촉했다. 시작 2건, 취소 1건, 정상 종료 1건을 처리했고 오른쪽 열과 두 손잡이 값 25·75를 유지했다. 휠 여백 안전 확인 한 쌍에서는 두 host가 각 64개 입력을 수락했고 최종 offset과 오른쪽 열이 유지됐다. 이동 p95는 30.32→30.15ms, 초과 예산은 0→9.82ms/s였다. 후보의 43.81ms 이동 간격에는 35.59ms Scene이 포함됐다.

기본 Windows 명령으로 SDK 공급을 갱신해 제품 host `165cd86c6511157bccc13914c29660d863c165ac3a1469d45be6c7b2e1517f98`와 HBC `ebf1ffc9189d743b0b0198754deedc7f4df6d31ab86678dc313a338ea650da4f`를 실행했다. 종료 코드는 0이었다. 이 패키지에서 중앙과 여백의 가상 트랙패드 20회 스트로크가 각각 다섯 컨트롤을 통과하고 시작 위치로 복귀했다. 양쪽 모두 오른쪽 기준 버튼이 유지됐고 921건 수락, 거부 0건, 송신 p95 16.03ms였다. 사용자 정의 손잡이에서 취소와 재접촉도 다시 확인했다. 두 값은 25·75였고 목록은 왼쪽에서만 이동했다. RangeSlider 소스 회귀 검사도 통과했다. [PowerShell 통과 검사](sample/nelyx-demo-app/eng/test-all-components-scroll.ps1) · [RangeSlider 소스 검사](packages/material/eng/check-range-slider-hover.mjs)

### 5.23 타이머를 반영한 최종 공급과 W9 비교

§5.21의 W9 HBC `2a822c44…`와 공통 취소 보완을 포함한 host `f88edc09…`를 기준으로, W10 진단 HBC `3605e3a8…`를 실제 기본 패키지의 최종 host `165cd86c…`에 연결해 교차 실행했다. Hermes VM과 리소스, 창과 DPI, 입력 스케줄을 고정했다. 가상 정밀 트랙패드로 §5.21과 같은 위쪽 및 아래쪽 경계를 통과했다. 휠 비교도 같은 여백과 offset에서 실시했다.

| 구간·쌍 | 이동 간격 수 | p95(ms) | p99 / 최장(ms) | 초과 예산(ms/s) | 33.33~50ms / >50ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 위쪽 경계 1 | 88→108 | 30.82→30.45 | 47.85/47.85 → 36.34/42.54 | 19.72→8.06 | 4/0 → 3/0 |
| 위쪽 경계 2 | 97→114 | 30.54→30.33 | 42.39/42.39 → 30.53/36.45 | 6.56→1.61 | 2/0 → 1/0 |
| 위쪽 경계 3 | 90→111 | 37.13→30.23 | 42.84/42.84 → 36.17/42.52 | 24.47→6.40 | 8/0 → 2/0 |
| 아래쪽 경계 1 | 98→112 | 37.05→30.28 | 42.62/42.62 → 30.59/36.28 | 18.75→1.58 | 6/0 → 1/0 |
| 아래쪽 경계 2 | 96→118 | 30.33→30.30 | 36.80/36.80 → 30.50/31.10 | 3.63→0.00 | 2/0 → 0/0 |
| 아래쪽 경계 3 | 94→112 | 30.56→30.31 | 42.02/42.02 → 42.21/42.45 | 10.72→12.77 | 4/0 → 4/0 |
| 휠 여백 1 | 54→56 | 42.55→30.40 | 54.42/54.42 → 54.35/54.35 | 43.23→22.40 | 2/1 → 1/1 |
| 휠 여백 2 | 54→56 | 30.39→30.27 | 36.75/36.75 → 36.95/36.95 | 3.20→3.39 | 1/0 → 1/0 |
| 휠 여백 3 | 57→57 | 30.41→30.46 | 36.30/36.30 → 36.29/36.29 | 5.48→2.78 | 2/0 → 1/0 |

위쪽 경계에서 p95 중앙값은 30.82→30.33ms, 30FPS 초과 예산은 19.72→6.40ms/s였고 세 쌍 모두 두 지표가 줄었다. 아래쪽은 30.56→30.30ms, 10.72→1.58ms/s였고 2쌍에서 함께 줄었다. 스트로크별 이동률 하한의 최솟값은 Scene 45.74→55.21FPS, desktop 45.57→53.58FPS였다. 100ms 이상 이동 간격은 0건이었다.

휠 여백에서 두 지표 중앙값은 30.41→30.40ms, 5.48→3.39ms/s였고 함께 줄어든 것은 1쌍이었다. 최장 54.35ms 간격의 다음 이동 Scene은 17.22ms였다. 두 입력의 비교 12회 모두 오른쪽 열 고정, 입력 거부 0건, DXGI 표식 판독 오류 및 누적 이미지 갱신 0건을 확인했다. 접촉 및 휠 반복 구간에서 DXGI 이미지 갱신 4,037건을 받았다.

가상 정밀 트랙패드의 filled 필드 두 경계는 이 비교에서 정량 기준을 충족했다. 휠 여백은 쌍별 기준에 미달했다. 물리 트랙패드의 접촉 중 이동, 손을 뗀 뒤 감속과 반전 체감은 아직 확인하지 못했다. 기본 Windows 패키지는 `performanceAccepted=false`, `physicalInputAccepted=notVerified`다.
