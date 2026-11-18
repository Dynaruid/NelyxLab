# W10 · Windows Demo 왼쪽 열에서 컨트롤을 지날 때의 스크롤 끊김

2026-11-18 · **계획 작성 완료 / 구현 대기** · 검토 기준 `3458f23d`와 현재 작업 트리의 W9 변경분 · `performanceAccepted=false`

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
