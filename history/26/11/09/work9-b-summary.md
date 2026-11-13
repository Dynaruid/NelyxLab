# Work9-b — App SDK 단일화·API 이식·실제 앱 연결 요약

원문: 루트 `work9-b.md` · 작성·종료: **2026-11-09 KST** · 이관 갱신: **2026-11-10 KST** · 보관: **2026-11-13 KST**

문서: **CLOSED / work9-c, 이후 work10 이관** · 종료 당시 구현: **PAUSED / PARTIAL**. 원문 중 11월 8일 사용자 교정은 계약 변경의 날짜이며 작성일 표기와 구분한다.

## 첫 재개 W9B-00

[work9-a](../08/work9-a-summary.md)의 미검증 MouseRegion/Wrap/Flex/Stack 묶음을 검토·보완했다. Pressed mouse의 live enter/exit·이전 inverse, 두 baseline·음수 Wrap 간격·positioned Stack/dry/intrinsic, malformed wire·rollback, 가변 목록 seek와 Web route 안내 수명을 수정했다.

당시 Source/Core **33 cases / 641 values**, 잘못된 wire **19 cases**, 새 **8 packages** offline strict 선언·설치 CLI·Chrome 두 profile과 Windows 두 host·Android x86_64 설치/첫 frame/정상 종료를 확인했다. source **`cc66ae1c…` / ABI 2 / schema 3719990506 / layout 192 bytes**, Windows/Web **343 files**·Android **42 files**였다. 원래 Gallery는 exclusive MouseRegion을 지나 **RenderPointerListener 미지원**에서 멈췄다. 첫 화면/catalog 전체 PASS가 아니다.

## App SDK 단일화와 RNW 실제 이식

**W9B-00-H 범위 완료.** Windows 제품·CLI create/doctor/build/run/dev/pack·template/sample·공급/설치 graph를 **App SDK 하나**로 통일하고 독립 `windows-hwnd` executable/profile·fallback 및 전용 Hermes DLL 사본을 제거했다. 공통 native Core/provider와 AppWindow의 HWND interop는 유지했다.

고정 RNW **0.83.2 / af0b597c…**의 ClipboardModule 원본을 실제 가져와 ReactContext/Promise 대신 DispatcherQueue·값 completion으로 수정하고 public Clipboard 소비자를 교체했다. 원본/수정 소스·hash·integrity·MIT license를 공급하며 늦은 OS 완료·미실행 write 취소·terminal 전 credit과 STA drain을 확인했다.

최대화 **2560×1459**에서 allocator **256 MiB**를 초과한 WSI MSAA는 **4×→2×**로 조정하고 실제 오류 범위를 노출했다. 한도를 늘리거나 frame/GPU fence를 생략하지 않았다. 해당 공급 `42d60bd9…`, Windows/Web **347 files**·Android **42 files**에서 설치 앱의 clipboard 한글/emoji·빈값/길이·실제 OS 실패·close, Windows mouse/key·resize, Web 두 profile·Android emulator 영향 회귀가 PASS였다. 이는 public Clipboard 첫 이식이며 전체 RNW API 완료가 아니다.

## 후속 Core·디자인·Gallery/Demo 연결

| 묶음 | 실제 구현·주요 결론 |
| --- | --- |
| Pointer/Tooltip/Overlay | 원래 Source callback·State/timer·theme, retained child-first hit·capture·기본 Tooltip 위치, overlay/Ink/Focus의 지연 해제·builder starvation 수정 |
| Layout·paint | TS 모듈의 수치 layout/paint 프로그램을 C++가 실행. ListTile·toolbar·InputDecoration·Divider/Badge·progress·clip/shadow·animated opacity·paragraph fade를 연결하고 경로/layer/mask의 실제 크기 예약으로 예산 실패 수정 |
| 목록·명령 | dormant/KeepAlive·fixed/indexed/sequential 가변 목록·유한 box sliver·0높이·resize/seek·Navigator home 갱신. 기본 명령 생략으로 4096-command 한도 내 실제 생성/교체를 유지 |
| 실제 controls·편집 | Chip 입력/hit·동적 paint, 기본 RangeSlider·표시기/paragraph, 외부 controller/min-maxLines의 Core 편집 viewport·caret reveal·Enter/submit·undo/secure 연결 |
| Geometry·수명 | 게시 bounds를 Source focus/hit 소비자에 전달하고 stale list coverage·standalone wheel/stream·retained leader/follower의 삭제 handle 참조를 수정 |
| Semantics·key/focus | identifier·OrdinalSortKey·custom action ID/출처·방향 문자열 병합, UIA 가상 action/Web ARIA, RNW key/code/modifier와 Source key identity, 부모 Focus·DOM pointer/focus/key FIFO와 ACK checkpoint |

고정 RNW KeyboardUtils·AccessibilityInfo도 실제 수정/컴파일·출처 공급에 포함했다. modifier/Tooltip 알림에 이어 key/code 소비자를 연결했으나 국제 layout/dead key·IME/capture/UIA provider/settings 등 전체 소스 이식은 남았다. [현재 플랫폼 API 대응표](../../../../Nelyx/engine/platform/native-api-ports.md)는 과거 부분 PASS와 별도로 관리한다.

Chrome/Edge × single-worker/threaded의 실제 Gallery/Demo에서 목록·drawer/theme/dialog·입력·Range·semantics/key/focus를 **각 기능 묶음 범위**로 확인했다. Windows App SDK도 실제 OS 입력·UIA/GPU 화면·resize/정상 close를 확인했다. 새 설치 **8 packages**의 TypeScript **7.0.2 strict** 선언·create/doctor/build/pack은 여러 시점에 PASS했으나 후반 모든 수정의 설치본 native run이나 전체 catalog 완료를 뜻하지 않는다.

## 마지막 검증 공급과 미검증 초안

마지막 완료 묶음은 부모 Focus/입력 큐·게시 geometry다. provider 공급 **`95c74477…` / ABI 2 / schema 2115239553 / 355 files**, 원래 **4 packages / 834 subpaths** 기준 hash와 RNW 출처 **6 files**를 유지했다. Source focus 계약 **18 cases**, Core transform/bounds **6 cases**, Web 원형/Demo/Range 각 **4/4**와 Windows 실제 흐름·정상 close가 PASS였다.

그 뒤 §3.22에서 **custom Range 5역할·공유 track/thumb 정책·표시기 자원**, **Curve 최대 32 nodes/depth16·56-byte 기존 scroll body + 선택 tail**, editor 양수 duration/취소 관련 초안을 작성했다. Source는 **schema 905102333 / identity 2dbcec2c…**였지만 dist는 위 이전 공급이었다. Core check는 이전 dist의 Curve export 누락/TS7053으로 실패했고 새 Core build는 하지 않았다. Format/schema/diff만 통과한 초안을 기능 PASS로 세지 않는다.

## 종료·잔여 판정

초안의 compile·수치/수명·실제 Demo custom Range/curved editor·공급/설치/Windows/Web 확인을 [work9-c의 W9C-00](work9-c-summary.md#rangeeditor와-종료-결함-수정)으로 이관했다. 전체 API/custom 동기 계약·전체 디자인/catalog·SDK/CLI/설정·OS 이식·복구/설치·기본값/레거시 삭제는 미완료다.

**compatible=false**, 두 성능 flag **false**, 물리/display/scanout·외부 UIA Invoke/reader **notVerified**, Android **stale/notVerified**, Linux·iOS/macOS **DEFERRED**를 유지한다. 당시 일부 임시 자료/프로세스 정리의 승인 거부는 별도 미완료 기록이며 이번 보관의 정리 실적으로 바꾸지 않는다. 최종 이월은 [work10 대응표](../11/work10-summary.md#work9-잔여-의무-이관)에 보존한다.

[work9 보관 목차](../05/work9-summary.md) · [work9-a](../08/work9-a-summary.md) · [이력 목록](../../../README.md)
