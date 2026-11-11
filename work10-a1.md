# work10-a1 — Windows 트랙패드 주기적 멈춤: 코드 분석·수정 우선

작성: **2026-11-11 KST** · 상태: **IN PROGRESS / PARTIAL** · 상위 계약: [work10.md](work10.md) · 성능 판정: **PARTIAL / performanceAccepted=false**

## 1. 이번 작업의 기준

사용자가 Windows Demo를 다시 빌드·실행한 뒤 **“트랙패드 스크롤때 중간마다 주기적으로 1초 내외정도로 끊김”**을 보고했다. 약1초는 **멈춤의 지속시간에 대한 사용자 관측**이다. 발생 간격·빈도·정확한 단계 시간은 아직 측정하지 않았다. 매1초마다 발생하는 timer 문제라고 단정하지 않는다.

앞으로 이 Windows 후속 작업은 **코드를 읽어 잘못된 경로를 찾고, 관련 수정을 묶어서 구현한 다음, PowerShell로 조작·확인한다.** 자동 실행·장시간 계측을 반복하면서 원인을 찾는 방식을 기본 순서로 삼지 않는다. Computer Use/CUA/sky로 앱을 조작하지 않는다.

이 문서는 work10의 Windows W10-00/06/07에 대한 실행 계약이다. work10의 데이터 공유·소유권 계약과 §8의 잔여 의무는 유지한다. work10 전체를 종료하거나 이미 구현한 W10-01–05를 처음부터 다시 만들지 않는다. **최초 문서 작성은 계획만 수행했다. 이후 구현·빌드·Windows 실행과 입력 주입 결과는 §7 이후에 별도로 기록한다.**

### 범위와 보존할 계약

- 대상은 **Windows App SDK 일반 CLI 앱**과 그 앱이 쓰는 공통 TS/Core/native 경로다. 기본 조사 화면은 Demo의 일반 목록과 날짜 선택기 월 이동이다. Web·Android·Linux·Apple 실행 검증은 이번 범위에서 제외한다.
- JSI, TS Widget/Element/State 및 callback/controller 순서, C++ layout/hit-test/gesture/scroll 권위, App/Content/Render/UI owner를 유지한다. 독립 HWND host나 별도 렌더러를 추가하지 않는다.
- [work10 §22](work10.md#22-2026-11-11-source-후속-실험-철회와-검증-보강--paused--partial-인계)에서 철회한 Source capture·게시 대기 생략을 복원하지 않는다. `waitForContent` 제거, stale 무시, terminal 유실, 미완료 GPU 자원 재사용으로 멈춤을 숨기지 않는다.
- 기존 [work10 §23](work10.md#23-2026-11-11-windows-native-소스-수정--실행-검증-중단)의 native clip·Snapshot·메모리 예약·문단 캐시 변경은 현재 diff로 이어받아 검토한다. 별도 완료 확인 없이 이 변경을 멈춤 해결로 간주하지 않는다.

## 2. 계획 작성 시 확인한 현재 상태

| 구분 | 확인 내용과 한계 |
| --- | --- |
| 현재 소스 변경 | `platform/common/skia_provider.hpp`, `platform/windows/skia_provider.hpp`, `work10.md`에 기존 변경이 있다. reset/stash/덮어쓰기를 하지 않는다. |
| 공급 메타데이터 | engine manifest와 Windows app manifest의 공급 연결은 `840b22465d0759c7df1032095b7e1935e2ddd23163f733f5ef43612f2d1a447e`, ABI2/schema313408118이다. **JSON 읽기만 수행했으며 현재 전체 파일 hash·sourceIdentity·실행 중 프로세스의 일치 검증은 하지 않았다.** |
| 사용자 실행 결과 | 재빌드·실행 후에도 트랙패드 스크롤에 약1초 멈춤이 남았다는 최신 보고다. 이전 자동 PASS로 이를 덮지 않는다. |
| 미해결 회귀 | 이전 Windows 날짜 앞자리 잘림·월/header/grid 정합성과 과거 `stale` scroll을 함께 보존한다. 이번 사용자 보고는 이 문제들의 해결 확인을 포함하지 않는다. |

### 2.1 현재 코드에서 확인한 조사 지점

아래는 **코드의 실행 구조와 조사 후보**다. 특정 후보가 현재 약1초 멈춤의 원인이라는 결론은 아니다.

| 경계 | 현재 소스에서 확인한 사실 | 우선 분석할 내용 |
| --- | --- | --- |
| OS precision → UI → Core | [WindowsPrecisionTrackpad.h](Nelyx/engine/platform/windows/input/WindowsPrecisionTrackpad.h)의 DirectManipulation update/reset/관성 상태와 [host.cpp](Nelyx/engine/platform/windows/host.cpp)의 `precisionInput`이 연결된다. `precisionInput`은 상태 inspect 후 input을 보낸다. | UI callback 지연, reset/READY 전환, wheel 소유권, 동기 Core 진입의 lock 대기, begin/update/end/cancel 순서 |
| App 완료·timer·microtask | `host.cpp` App loop가 notification/service/completion을 전달하고 `drainMicrotasks`, timer pump, heap accounting을 수행한다. | 완료가 도착해도 긴 JS continuation 때문에 입력·builder ACK가 늦어지는지, 한 번에 비우는 작업량과 GC/할당·timer 관리의 상한 |
| Source build → Content | [host.ts](Nelyx/runtime/app/host.ts)의 `perform`/`rebuildFromContent`/`waitForContent`가 builder 응답과 게시 fence를 조정한다. native Content loop의 측정·`provider.prepare`는 Core step 바깥에서도 실행된다. | 작은 이동마다 build/capture/commit을 반복하는지, 다음 입력·필수 builder 응답을 긴 prepare가 기다리게 하는지 |
| lazy coverage·재방문 | [scroll.ts](Nelyx/runtime/app/scroll.ts), [native-sliver.ts](Nelyx/src/framework/rendering/native-sliver.ts), [list.hpp](Nelyx/engine/core/layout/list.hpp)에 demand/coverage/세대와 보존 범위가 있다. | 같은 resident 영역도 새로 준비하는지, 경계마다 refill·퇴거·대기·재시작이 반복되는지. [problem.md §14–16](problem.md#14-2026-11-10-주기적인-목록-경계-정지--사전-준비-복원)의 과거 수정과 현재 호출자를 대조 |
| Core 상태 lock·snapshot | [engine.cpp](Nelyx/engine/core/protocol/engine.cpp)에 dispatch와 snapshot의 mutex 경계가 있다. 일부 transaction 작업은 lock 밖에서 실행된다. | 모든 작업이 전역 lock 안이라는 가정 없이 실제 lock 범위, frame/interaction snapshot 복사·생성·설치, 입력이 기다리는 작업을 추적 |
| native 준비·재생·회수 | [공통 provider](Nelyx/engine/platform/common/skia_provider.hpp), [Windows provider](Nelyx/engine/platform/windows/skia_provider.hpp)가 문단/Picture/캐시, clip, Snapshot, path/layer 예약을 관리한다. | 화면 밖·미변경 노드의 반복 작업, 전량 캐시 교체·참조 해제 비용, heap/external credit·pressure 퇴거의 동시 집중 |
| Render → GPU → 게시 | [device.cpp](Nelyx/engine/render/vulkan/device.cpp)의 현재 `presentWindowFrame`은 `present(..., true)`로 연결된다. 획득은 timeout0, 제출은 async 분기의 `SyncToCpu::kNo`다. [frame_clock.hpp](Nelyx/engine/platform/windows/frame_clock.hpp)는 high-resolution waitable timer를 사용한다. | 이미 반영된 비동기 경로의 실제 busy 재시도·wake·완료/게시·retirement를 검토. 다른 동기 분기의1초 획득 timeout이나 `SyncToCpu::kYes` 문자열만 보고 현재 Windows 원인으로 단정하지 않음 |

## 3. 구현 순서

각 단계는 **소스의 결함/비용 경로 → 소유자와 불변식 → 코드 수정 → 필요한 확인 항목**을 짧게 남긴다. 새로운 수집기나 계측이 꼭 필요한 경우에도 이미 존재하는 정보를 먼저 재사용하고, 구분되지 않는 한 경계만 보강한다.

### W10A1-00 — 현재 diff와 호출 인과를 코드로 감사

1. 위 경계를 `OS 수신 → UI admission → Core 소비 → App/Source 요청·ACK → Content ready → Render/GPU 완료 → 게시`로 연결한다. 어떤 owner가 어떤 작업을 기다리는지, 그 작업 중 lock을 쥐는지 표시한다.
2. 약1초 멈춤을 만들 수 있는 경로를 **입력 미수신 / 입력 큐 정체 / resident coverage 부족 / 준비 재시작 / 긴 JS·native 작업 / GPU·게시 정체**로 구분한다. 호출되지 않는 fallback과 종료 전용 drain은 정상 스크롤 경로와 분리한다.
3. 현재 native 변경의 subtree skip·Snapshot 좌표계·메모리 예약·문단 캐시를 호출자까지 읽는다. 코드상 결함, 아직 근거가 없는 가설, 이미 반영한 해결을 구분한다.
4. 첫 수정 묶음은 확인된 잘못된 반복·대기·수명 경계를 기준으로 고른다. 코드만으로 결함이 확인되면 장시간 기준선 측정을 선행 조건으로 만들지 않는다. 구별이 안 되는 후보는 최소한의 targeted trace로 남겨 원인을 만들어내지 않는다.

**완료 조건:** 첫 수정 위치·잘못된 조건·최악 경로·보존할 불변식·영향받는 소비자가 구체적이다. 이 단계만으로 성능 해결을 체크하지 않는다.

### W10A1-01 — 입력과 owner 작업의 정체 경로 수정

- UI의 inspect/input 및 interaction 동기화가 큰 snapshot·다른 owner 작업을 불필요하게 기다리는 경계를 고친다. 상태 snapshot을 재사용한다면 metrics/publication/generation의 유효성을 함께 보장한다.
- native 완료 mailbox와 App notification이 도착했는데 후속 build·microtask·timer 작업 때문에 처리가 밀리는 경로를 줄인다. budget은 단순 작업 개수뿐 아니라 긴 한 작업의 비용도 포함한다.
- 입력·필수 Source 요청·terminal의 진행을 보장하면서 한 owner의 전량 drain이나 즉시 재시도 루프를 제한한다. 기존 bounded quota와 wake revision을 유지한다.
- DirectManipulation의 contact/reset/READY/관성·wheel suppression을 검토한다. 입력 update를 합치는 경우에도 begin/end/cancel, focus·편집·command terminal 순서는 보존한다.

### W10A1-02 — 목록 경계·새 월 준비의 반복 왕복 수정

- resident 이동, 새 영역 진입, 퇴거 후 재방문을 코드에서 구분한다. 이미 준비된 범위의 작은 이동에서 delegate generation·child window·layout/paragraph를 다시 만드는 원인을 제거한다.
- demand 발생부터 필수 Source builder 응답·ACK·Content 재개까지 중복 rebuild/전체 capture와 준비 재시작을 줄인다. 단순 cache 크기 확대를 기본 해법으로 삼지 않는다.
- 기존 속도별 선행 준비·방향 반전·visible coverage·bounded children·Key/KeepAlive·Ink·resize anchor를 유지한다. 원래200ms animation과 controller/callback 순서를 바꾸어 시간을 줄이지 않는다.
- 게시 대기는 다른 구조가 정확성을 보장할 때만 좁힌다. 준비 미완료 상태의 무조건 통과나 §22 실험의 재도입은 하지 않는다.

### W10A1-03 — native CPU·할당·회수의 집중 비용 수정

- `ContentProvider::prepare`와 frame/interaction 생성의 전체 방문·재기록·객체 생성·참조 해제 구간을 추적한다. 수정량과 무관한 반복 비용부터 줄인다.
- 캐시 key·font/metrics/device revision·메모리 quota를 보존하면서 불변 데이터와 문단/Picture 재사용을 연결한다. 이전 준비나 폐기된 세대의 결과를 재사용하지 않는다.
- 화면 밖 subtree 생략과 layer/path/mask 예약을 일치시키되 physical shadow와 Snapshot의 다른 좌표계를 보존한다. 그림이 보이지 않는 이유를 기능 삭제로 바꾸지 않는다.
- Hermes heap/external credit, native cache 퇴거와 마지막 reader 해제를 검토한다. GC 강제 호출, 매번 전체 purge, 무제한 보존으로 주기적 멈춤을 우회하지 않는다. GC가 약1초 원인이라는 주장은 해당 구간 근거가 있을 때만 한다.

### W10A1-04 — Render/GPU 진행과 게시 수명 수정

- 현재 비동기 경로의 busy 획득·GPU completion·present resource fence·게시 재시도를 끝까지 대조한다. normal scroll이 resize/device-loss/종료 전용 drain으로 잘못 진입하는 조건도 확인한다.
- Content나 App가 준비하는 동안 기존 게시 프레임의 스크롤 진행이 막히는 연결을 찾는다. Core state lock을 쥔 채 GPU·큰 그림 준비·UI 작업을 기다리는 경로를 만들지 않는다.
- 재사용은 GPU/reader/scene lease의 실제 완료 뒤에 한다. timeout이나 publication만으로 자원을 조기 반환하지 않는다. 버퍼 수 증가·독립 present 큐 추가는 근거와 상한 없이 도입하지 않는다.

**W10A1-01–04 적용 방식:** 모두를 무조건 재설계하는 목록이 아니다. W10A1-00에서 확인한 원인에 해당하는 관련 코드와 소비자를 묶어 수정한다. 나머지는 검토 결과와 미해결 이유를 남긴다. 매 작은 편집마다 전체 build/install/UI 검증을 반복하지 않는다.

### W10A1-05 — PowerShell 기반 조작·수집 경로 구성

실행 파일은 `Nelyx/eng/check-windows-scroll.ps1`이며 §8에서 구현했다. helper는 메모리 내 `Add-Type` C#/Win32/UI Automation으로 구성하며 Computer Use를 호출하지 않는다. 아래 표는 실행 도구의 구현·증거 계약이다.

| 조작/관측 | 구현 기준과 증거의 한계 |
| --- | --- |
| 앱 시작·식별 | 일반 CLI로 실행하고 앱 PID·시작 시각·창 handle·실행 경로를 연결한다. 창 제목만으로 대상이나 공급을 추정하지 않는다. helper 콘솔은 숨기고 대상 앱 창을 사용한다. |
| 화면 이동·버튼 | UI Automation 또는 Win32 입력으로 drawer→Selection→달력 등을 조작한다. 요소/좌표는 해당 창의 현재 DPI·client 좌표·상태를 기준으로 얻는다. 다른 앱에 입력하지 않는다. |
| OS wheel·drag | `SendInput`으로 일정한 입력 구간·반전·정지를 구성한다. **wheel/마우스 drag를 실제 precision trackpad 입력으로 기록하지 않는다.** PowerShell sleep의 부정확성을 앱 stall로 계산하지 않는다. |
| precision 상태 회귀 | 필요할 때만 진단 실행에 한정한 bounded 입력 통로를 추가한다. UI owner에서 기존 `Host::precisionInput`으로 start/update/end/cancel을 전달해 같은 처리 경로를 재사용한다. Core offset을 직접 쓰지 않으며, `injected-precision`으로 표시한다. 이 방식도 실제 하드웨어/DirectManipulation 수신 검증은 아니다. |
| 기존 계측 재사용 | stdin `stats`·`trace`·`profile-start/stop`과 [WindowsInputTrace.h](Nelyx/engine/platform/windows/input/WindowsInputTrace.h)의 선택적 memory-mapped ring을 우선 검토한다. `NELYX_WINDOWS_INPUT_TRACE=1`, `Local\NelyxInputTrace.v1.<pid>`의 magic/version/PID/creation time·sequence를 확인하고 안정된 record만 읽는다. **stage enum이 있다는 사실을 v2의 모든 단계가 연결됐다는 근거로 쓰지 않는다.** |
| 누락 경계 보강 | 현재 `V2_TRACE`의 request/input/document/preparation/publication과 QPC를 재사용한다. 실제 누락된 v2 입력 수신·큐·소비·Source/게시 단계만 추가한다. 고정 ring과 요약 집계로 제한하고 overwrite 수·누락 범위를 남긴다. |
| 표시 확인 | UIA의 월·날짜·선택 상태와 실제 창의 화면 결과를 구분한다. 필요하면 PowerShell/C#에서 대상 창을 캡처해 날짜 첫 열·인접 월·header/grid 정합성을 확인한다. UIA 텍스트만으로 잘림 해결을 판정하지 않는다. |

조작 중 매 frame UIA 전체 tree·`stats`·스크린샷을 요청하지 않는다. stdout/stderr는 비동기로 계속 비워 콘솔/pipe 정체를 앱 멈춤으로 만들지 않는다. 수집은 기본 메모리에서 집계하고 켜짐/꺼짐 차이도 필요한 한 짧은 구간으로 확인한다.

PowerShell이 물리 트랙패드 접촉을 만들어낸다고 가정하지 않는다. 합성 회귀 후 실제 트랙패드는 사용자가 확인하며, 필요한 기존 ring 수집은 PowerShell로 수행한다. 사용자 체감 결과를 자동 입력 결과로 대체하지 않는다.

### W10A1-06 — 수정 묶음 뒤 Windows 통합 확인

1. 변경 입력에 필요한 Core/package/engine·Windows 앱을 챕터 끝에 갱신한다. 같은 입력의 `build:sdk`/`build:core` 중복 실행을 피한다. 빌드 도구가 다른 profile도 생성하는 것과 해당 플랫폼을 테스트하는 것을 구분한다.
2. 실제 실행할 Windows source/manifest·App 입력·ABI/schema 연결을 확인한다. 이전 공급의 통과 결과를 현재 변경의 결과로 사용하지 않는다.
3. 아래 최소 시나리오를 PowerShell로 각1–2회 수행한다. 실패 시 해당 원인의 코드·영향 범위만 수정하고 필요한 시나리오만 다시 확인한다. 실행을 늘려 우연한 PASS를 얻지 않는다.
4. 기능·입력 진행·멈춤 구간·메모리·정상 종료와 사용자 물리 결과를 각각 기록한다. 해결되지 않은 문제는 다음 소스 수정의 정확한 위치와 함께 남긴다.

## 4. 확인 시나리오와 완료 기준

| 시나리오 | 확인할 내용 |
| --- | --- |
| 일반 목록의 warm 연속 이동·반전 | resident 위젯 왕복에서도 멈추는지, 입력은 들어오는데 Core 소비/게시만 멈추는지, coverage 경계와 무관한 반복인지 |
| 새 목록 구간·퇴거 후 재방문 | 새 Source 준비, retained window 교체·캐시 회수 시점과 정체가 겹치는지. warm과 동일 조건으로 섞지 않음 |
| 달력의 연속 월 이동·방향 반전 | 버튼·주입 precision·사용자 트랙패드를 구분. 현재 월/header/grid·모든 날짜·첫 열 잘림·선택/확정, KeepAlive/Ink·Source 진행 보존 |
| 입력 종료·짧은 resize·정상 close | end/cancel 뒤 관성 종료·명령 terminal·resize anchor, pending/lease/worker 회수와 예외 없는 종료 |

멈춤은 **활성 입력 구간**의 입력 수신/소비 간격, 연속 frame 게시 간격, Source/Content 대기, App 작업·GC, GPU 완료/게시 간격으로 나누어 본다. idle이나 입력 주입 자체의 공백을 앱 stall로 세지 않는다. QPC·JS·PowerShell 시간의 단위를 맞추고 중첩 시간을 합산하지 않는다. `submitElapsedMs`와 present fence는 순수 GPU 시간이나 실제 scanout의 증거가 아니다.

- ≥100/250/500/1000ms 정체 횟수·최댓값·발생 단계와 입력량/이동 범위를 적는다. 소표본에서 전체 p95·실제 FPS·scanout을 만들어내지 않는다.
- 이번 핵심 목표는 **보고된 약1초의 주기적 멈춤 제거**다. 정한 짧은 활성 입력 시나리오에서 ≥500ms 정체가 남으면 핵심 목표 미달로 기록한다. 이것만 통과해도 work10 전체의 latency/refresh/성능 목표가 완료되는 것은 아니다.
- 입력·callback/command terminal 유실, 월/header/grid 불일치, 날짜 잘림, stale 은폐, 무제한 pending·메모리 증가가 없어야 한다. 정상 close의 worker/lease/예약 회수를 확인한다.
- **사용자가 물리 트랙패드에서 여전히 약1초 멈춤을 보고하면 완료하지 않는다.** 합성 입력 PASS와 사용자 성능 완료를 분리한다. `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`는 각 해당 조건이 실제로 충족되기 전까지 유지한다.

## 5. 실행·정리 규칙

- [.github/copilot-instructions.md](.github/copilot-instructions.md)에 따라 검사별 **20분 timeout**, 대부분 **30회 이내**를 적용한다. 기본은 위 시나리오별1–2회이며 반복 수를 채우는 작업을 하지 않는다.
- 임시 입력 helper·캡처·trace·설치본이 필요하면 실행 하나의 owned 경로만 쓰고 `try/finally`로 닫고 삭제한다. 새 기록은 이 문서의 현재 결과로 요약한다. JSON receipt/history·로그·PNG·archive·이전 dist/staging을 누적하지 않는다.
- 파일 정리 전 절대 경로와 workspace 범위를 확인한다. 자신이 띄운 프로세스·창·mapping·핸들만 회수하며 사용자의 앱·emulator·캐시를 일괄 종료/삭제하지 않는다.
- 기존 `.tmp/w10-windows-guCeXo`의 삭제 차단 기록은 [work10 §23](work10.md#23-2026-11-11-windows-native-소스-수정--실행-검증-중단)에 남긴다. 이를 원인 조사나 빌드의 선행 조건으로 삼거나 차단을 우회하지 않는다.
- 공통 TS/Core/native를 수정하면 다른 플랫폼의 영향·공급 갱신 필요를 기록하되 이번 Windows 확인을 다른 플랫폼의 통과로 확대하지 않는다. wire/ABI를 바꿔야 하는 경우에는 source/schema/소비자와 미갱신 플랫폼을 함께 명시한다.

## 6. 진행 체크리스트와 시작점

- [x] 최신 사용자 보고, 코드 수정 우선, Windows 한정, PowerShell 조작 원칙을 기록했다.
- [x] 현재 소스의 주요 조사 경계와 이미 비동기화된 Windows GPU 경로를 대조했다.
- [x] W10A1-00 상세 코드 감사로 첫 수정 묶음과 보존할 불변식을 확정했다.
- [x] W10A1-01–04의 첫 원인 수정 묶음과 소비자 연결을 구현했다. 남은 Source 비용은 §12에 분리한다.
- [x] W10A1-05 PowerShell 조작·bounded 수집 경로를 구성했다.
- [x] W10A1-06 현재 공급의 Windows 기능·성능·수명 결과와 실패 범위를 기록했다.
- [x] 추가 요청의 관찰 역할·delegate 수명·typed 의존성/동기 build batch·Core 준비 창 개편과 소비자 검증을 수행했다(§13–15).
- [ ] 연속12개월의 ≥500ms 정지를 제거했다.
- [ ] 사용자가 실제 트랙패드의 주기적 멈춤 제거를 확인했다.

**현재 실행점:** 최신 변경과 결과는 **§19**, 남은 개편 경계는 **§16과 §19의 잔여 범위**다. §7–12는 첫 묶음, §14–15는 이전 공급의 결과다. 합성 기능 확인을 물리 트랙패드의 멈춤 해결로 확대하지 않는다.

## 7. 2026-11-11 상세 감사와 구현

실행 시작 시 `git status --short`는 비어 있었다. §2가 가리킨 이전 native clip/Snapshot/예약/문단 변경은 이미 현재 소스에 포함돼 있었다. 이를 되돌리거나 §22의 Source capture/게시 fence 생략 실험을 복원하지 않았다.

| 경계 / owner | 코드에서 확인한 비용·진행 조건 | 이번 수정과 보존한 조건 |
| --- | --- | --- |
| DirectManipulation → UI → Core | UI가 state-only inspect 후 입력을 동기 접수한다. Core 입력은 bounded FIFO이며 Render tick이 정해진 cut/quota까지 소비한다. | normal DM contact/reset/READY와 wheel suppression은 유지했다. 수평 delta에도 기존 velocity 추정 이력을 적용한다. 기존 Windows 코드는 `deltaY`만 읽어 수평 page 이동의 속도·선행 준비 힌트를 0으로 만들었다. |
| Render → Core frame | Windows `takeFrame`이 모든 row/paint/paragraph/semantics를 mutex 안에서 직렬화한 뒤, host가 이를 버리고 `frameSnapshot`을 다시 가져왔다. | `Engine::dispatchNativeFrame`은 동일 take/release/publish admission을 사용하고 native 불변 reader와 작은 state 응답을 한 호출에서 전달한다. C/JS wire 경로는 그대로이며 ABI2/schema313408118을 유지한다. reader 복사 전에 별도 ledger credit을 예약하고 실패한 미발급 frame은 취소한다. |
| UI interaction snapshot | 같은 publication/document/focus/editor 상태에서도 Frame vector 복사와 UIA/TSF 전체 동기화를 반복할 수 있었다. | 이전 snapshot의 scene/id, 문서 포인터, focus/session, metrics/device/scale/visibility, editor 값 포인터를 모두 대조한 경우에만 재사용한다. 같은 snapshot이라도 뒤늦게 도착한 matching Prepared는 editor/paragraph 갱신을 수행한다. |
| App 완료·continuation | `__v2Changed`의 unbounded Hermes drain이 이미 도착한 engine reply보다 먼저 실행됐다. service 완료도 continuation을 매번 실행하며 전량 비울 수 있었다. | ready engine mailbox를 먼저 resolve/drain하고 service 전달을 turn당 8건/4ms의 호출 budget으로 묶는다. wake revision과 정상 dispose/terminal을 유지한다. pinned Hermes는 `maxMicrotasksHint`를 무시하므로 단일 긴 JS continuation의 선점/시간 상한이 생겼다고 주장하지 않는다. |
| Source controller → 새 문서 | retained controller가 예전 viewport 관찰을 보유한 채 새 Source build/transaction 뒤에 scroll을 보내면 `invalidHandle`이 발생할 수 있었다. Windows 실행에서 opcode16/status16 앱 종료를 관측했다. | `NativePosition`은 Source build 중, transaction 진행 중, viewport 관찰의 activeDocument와 최신 ACK 문서가 다른 동안 명령을 보내지 않는다. 다음 owner 관찰로 현재 handle/generation을 얻은 뒤 원래 controller 요청을 보낸다. 오류를 성공으로 치환하거나 잘못된 index를 다시 보내지 않는다. |
| resident / 새 coverage → Content | `nativeListCacheRange`의 resident 유지·속도별 lookahead·row budget과 Source builder의 세대/constraints 검사는 이미 존재한다. Content의 측정/Picture 준비는 Core step 밖이지만 같은 Content owner의 뒤따르는 job을 지연시킬 수 있다. | cache 크기 확대나 무조건 publication 통과를 추가하지 않았다. 동일 generation Entry 재사용, builder ACK, layout continuation, KeepAlive/Key와 원본 animation을 유지한다. 새 월의 긴 build/capture/native 준비는 여전히 별도 해결 대상이다. |
| Render/GPU → 게시/회수 | 현재 Windows는 acquire timeout0, async `SyncToCpu::kNo`, GPU 완료와 acquired image의 presentation fence를 구분한다. 종료·resize 전용 drain을 정상 스크롤의 원인으로 단정할 근거는 없다. | 별도 present 큐/추가 slot/조기 자원 반환을 추가하지 않았다. Core mutex를 쥔 채 GPU를 기다리는 경로를 만들지 않았다. frame submission/completion/publication과 diagnostic viewport offset을 기존 bounded ring에 연결했다. |

기존 native subtree skip의 physical shadow 예외, Snapshot 캡처/변환 좌표계 예외와 Windows path/layer/mask 예약의 대응을 호출자까지 검토했다. 이번 실행에서 이를 다시 설계하지 않았다. 공통 native/header/Core 수정의 Android 실행과 기존 Android 공급 갱신은 이번 Windows 범위에서 **notVerified**다.

## 8. PowerShell 실행 도구와 증거 범위

[check-windows-scroll.ps1](Nelyx/eng/check-windows-scroll.ps1)은 Windows PowerShell 5.1에서 실행한다. [helper](Nelyx/eng/windows-scroll-helper.cs)는 메모리에 컴파일되며 일반 CLI의 자식 PID·실행 경로·생성 시각과 그 PID의 HWND를 확인한다. [identity 검사](Nelyx/eng/check-windows-scroll-identity.mjs)는 sourceIdentity 및 실제 engine/App manifest의 전체 hash·ABI/schema·공급 연결을 확인한다. stdout/stderr는 C# 비동기 reader로 계속 비우고, 저장하는 출력/trace 수를 제한한다.

```powershell
# 저장소 루트. 현재 Core/package, engine와 Windows App을 빌드한 뒤 실행.
powershell.exe -NoProfile -File .\Nelyx\eng\check-windows-scroll.ps1

# 사용자가 추가 요청한 12개월 분량의 연속 60Hz 합성 pan-zoom.
powershell.exe -NoProfile -File .\Nelyx\eng\check-windows-scroll.ps1 `
  -Scenario Calendar -RapidMonths 12 -PrecisionHz 60

# 월 제목의 게시 확인 직후 다음 OS 클릭을 보내는 별도 버튼 시나리오.
powershell.exe -NoProfile -File .\Nelyx\eng\check-windows-scroll.ps1 `
  -Scenario Calendar -RapidMonths 12
```

일반 목록은 OS `SendInput` wheel, 버튼은 현재 UIA bounds의 OS 좌표 입력을 사용한다. 이름이 없는 tooltip 버튼은 UIA HelpText를 대조한다. 게시 중 사라진 peer는 bounded transition 조회에서 다시 읽는다. 새 월의 polling은 특정 header만 조회하며 매 frame 전체 UIA tree를 덤프하지 않는다.

`NELYX_WINDOWS_SCROLL_DIAGNOSTICS=1`인 실행만 UI owner의 기존 `Host::precisionInput`을 재사용하는 stdin 통로를 연다. 60Hz driver는 전용 high-resolution waitable timer로 sample을 보내고 UI의 diagnostic wake를 게시한다. 일반 Win32 16ms timer에 샘플이 합쳐지는 현상과 sender 지연을 구분한다. 전달 시각은 같은 QPC 도메인이며 start/update/end/cancel을 보존한다. 이 통로는 Core offset을 직접 쓰지 않는다. **초당 60개의 합성 입력은 실제 precision trackpad/DirectManipulation 수신이나 60fps 표시/scanout의 증거가 아니다.**

ring은 magic/version/PID/creation FILETIME/record size/capacity를 검사하고 sequence 전후가 같은 record만 읽는다. overwrite/unstable/요약 용량 초과를 별도로 센다. `V2_TRACE`의 제한된 과거 범위와 전체 ring 집계를 구분한다. diagnostic `FrameRetired` record는 surface 필드에 viewport handle, a/b에 그 frame의 표시/요청 offset을 기록한다. 간격이 짧은 동일 그림 게시도 offset 진행과 구분하기 위한 정보다.

정상 close는 `status0 / reservedBytes0 / memoryTotal0 / workersJoined=true / exitCode0`를 따로 확인한다. 실패 시에도 이 실행의 writer/CLI/native PID/mapping만 회수한다. optional 캡처의 경로는 호출자가 소유하고 확인 뒤 삭제하며, receipt/history·설치 소비자 사본·browser profile·이전 dist를 만들지 않는다.

## 9. 첫 Windows 결과와 60Hz에서 재현된 미해결

아래는 **최종 재빌드 전의 각 명시된 공급**에서 얻은 증거다. 최종 공급의 성능 PASS로 옮기지 않는다.

- `8a0eac54572b6a0be74858bf60343e7b94932da1b62a14dd136cea6b8dfdbfcb`: Core native frame/semantics/list/page/clip/precision/coverage/lease 검사 PASS. native frame 전달은 wire row0, 정상 wire oracle 유지, reader quota 거부/재시도·metrics/visibility fence·close 뒤 독립 reader 수명을 검사했다. Windows native reply의 노드 직렬화는0이었다.
- 같은 공급의 OS wheel 각1회: 첫 이동0→192는 cache 준비가 포함돼 순수 resident로 보지 않는다. 반전192→0은 layoutWork/paragraphLayouts/Pictures 증가0. 새 구간0→2304 및 재방문2304→0을 분리했다. 활성 구간 게시 간격 최대48.702/36.800/43.473/36.631ms, ≥100/250/500/1000ms 모두0. 이 후 달력 도구 조회 실패가 있어 전체 시나리오 PASS로 기록하지 않았다.
- 같은 공급의 합성 precision 24 update씩: next/reverse/cancel의 활성 게시 간격 최대73.381/53.366/54.703ms. App turn 최대302.244/113.442/60.674ms. 아직 긴 App 작업이 남는다. cancel은 마지막 offset에서 정지하므로, 후속 resize 검사는 새 zero-velocity contact/end로 page snapping을 명시적으로 재개한 뒤 수행한다. partial page 자체를 날짜 누락 해결로 간주하지 않는다.
- `8a0e…`의 실제 창 캡처에서 2026년12월의 첫 열 `13/20/27` 앞자리를 확인했다. 인접 월과 첫 열의 일반적 표시/resize/모든 조건을 완료했다는 판정은 아니다.
- `8a0e…` engine + Source 문서 fence를 추가한 App의 빠른 버튼 표본은 **2026-11→2027-11의12개월**을 모두 관찰했다.12개의 click→게시 header 관측은 전부≥500ms, 최대1010.172ms였고 전체 약9.571초였다. 그 뒤 추가 next 버튼 검사에서 예상 월 assertion이 실패했으므로 이 실행 전체를 기능 PASS로 쓰지 않는다. header 관측에는 UIA 호출·polling이 포함되며 순수 renderer/scanout 지연이 아니다.
- `e0ae2c8d5137370e1ce4c1c6fba7c07843220de1f55b6ed2d08056df2dfd7e8d`의 **60Hz 연속 표본**: 6,000.117ms 동안 update360개, start/end 포함362개 모두 접수·소비, injected 거부0. sender gap 최대17.223ms, lateness 최대0.855ms, native 입력 수신 gap 최대37.885ms, 입력 Core dispatch 최대1.467ms였다. 그런데 활성 게시 gap 최대**716.839ms**, ≥100/250/500/1000ms는 **5/4/2/0**으로 핵심 목표에 실패했다. App turn은 최대453.224ms였다.344 logical px ×12개월 분량을 보냈지만 최종 제목은 2027년10월(+11)이었다. 입력 거부와 달리 coverage/deferred의 한 viewport 목표 상한·준비/게시·마지막 page 정합성을 후속 대조해야 한다. 이 표본만으로 단일 원인을 확정하지 않는다.

Source build 중 명령 dispatch 차단과 Windows 수평 velocity 보강 후의 최종 공급·결과는 다음 절에 기록한다. **보고된 약1초 멈춤 해결은 아직 미달 / performanceAccepted=false**다.

## 10. 연속 입력의 거리 보존과 병목 구분

`b5069a7362f7a773891e7961a20153386cc99e9af409230f51542657f9aaf204`의 비프로파일 실행은 6,000.466ms/update360개, start/end 포함362개 접수·소비, 거부0으로 **2026-11→2027-11의12개월**을 이동했다. header/전체 날짜, cancel 뒤 별도 snapping 재개, resize, `2027-11-15` 선택·OK, 정상 close는 PASS였다. ring 누락0/output drop0, native 직렬화 row0, close의 status/reservedBytes/memoryTotal은 모두0·workersJoined=true·exitCode0이었다.

그러나 같은 활성 구간의 게시·표시 offset gap 최대는 **577.571/577.576ms**였고, 게시 gap ≥100/250/500/1000ms는 **7/4/1/0**이었다. 입력 sender gap19.695ms·수신44.065ms, Core 개별 호출 최대11.368ms, record/submit12.764ms, submit→관측 GPU 완료11.636ms였다. 마지막 수치는 owner polling을 포함하며 순수 GPU/scanout 시간으로 쓰지 않는다. 기능 PASS와 **syntheticStallGoal=FAIL**을 분리한다.

선택적 `-CpuProfile`은 기존 Hermes sampler를 해당6초 동안만 켜고 종료 때의 기존 App 진단과 함께 메모리에서 요약한다. 샘플링을 켠 실행은 성능 기준 표본으로 쓰지 않는다. 소스·공급을 바꾸지 않은 profile 실행에서 최종11개월이 다시 나와 이동 거리 손실도 재현했다. 첫 profile 출력은 assertion 뒤에 요약이 배치된 도구 결함으로 회수하지 못했고, 요약을 finally로 옮긴 뒤 한 번만 다시 수집했다. 이 진단의 핵심은 다음과 같다.

- CPU sample1250개 중 Young Gen GC self293개, LayoutBuilder의 `_rebuildNativeWithConstraints` 경로 inclusive466개였다. inclusive 항목은 중첩되므로 합산하지 않는다.
- App75 pass의 build/capture/scene 최대는237/99/194ms였다. 이 진단의 wall clock에는 Source callback·RPC 기다림·다른 App continuation이 포함된다. Scene observation 최대458/343ms를 순수 encode/JS 실행 시간으로 해석하지 않는다.
- GC 기록은 startup부터 누적400회, 총1.636초, 최대 pause46.929ms, 총 allocation 약1.467GB였다. 새 월의 객체 할당·GC가 의미 있는 비용이라는 근거이며, 하나의 GC가 보고된1초 멈춤이라는 근거는 아니다.

확인된 별도 결함은 `View::applyDelta`가 coverage 부족 중 stream의 `requested`를 현재 offset±한 viewport로 덮어쓰면서, 그 밖의 **이미 접수한 contact 거리**를 버리는 것이었다. [scheduler.cpp](Nelyx/engine/core/scheduler/scheduler.cpp)와 [Overlay](Nelyx/engine/core/state.hpp)에 scalar `deferredContactDelta`를 연결했다. 실제 Source 준비 목표는 기존 한 viewport 상한을 유지하고, coverage가 진행할 때 남은 거리를 나누어 전달한다. 정상 lift는 잔여 거리를 기존 destination activation/ballistic 시작점에 합치며, 반전·cancel·새 contact는 기존 의도 취소 규칙대로 잔여량을 버린다. 유한 extent 및1e12 좌표 상한을 유지한다. 입력 큐·child window·cache를 확대하거나 wire/schema를 바꾸지 않았다.

현재 새 native library에서 거리 보존·준비 상한·catch-up·lift·반전·cancel·finite extent 회귀 및 기존 delayed/reversing Source list, late-page coverage, original spring/RTL calendar, frame/semantics/native reader/quota/lease 검사는 PASS했다. 이 변경 뒤 Windows 실제 결과는 §11에 기록한다.

## 11. 최종 공급과 Windows 통합 결과

이 절은 첫 수정 묶음의 공급이다. 추가 요청 이후의 최신 공급은 §15에 기록한다.

현재 source/engine/App 연결은 **`67f326f469c5f71f02674d84144be8fb6ce889aefbfebeda428ae31ae2fe5f5c`**, ABI2/**schema313408118**이다. native·두 Wasm profile·Windows App SDK 공급을 다시 생성했고, App은 modules892의 HBC로 갱신했다. engine356/App10 files의 실제 hash 및 source 연결을 실행마다 대조했다. 두 Wasm profile이 빌드됐다는 사실을 Web 제품 UI 검증으로 확대하지 않는다. Android는 이번 변경의 재빌드·실행 **notVerified**다.

| 현재 공급의 시나리오 | 결과와 활성 구간 관측 |
| --- | --- |
| **60Hz 연속12개월 / trace 켬 / 1회** | update360개를 **6,000.529ms** 동안 전송, start/end 포함362개 접수·소비, 거부0. **2026-11→2027-11**, 이후 `2027-11-15` 선택·확정, cancel·resize·정상 close PASS. sender gap17.823ms/lateness1.497ms, 수신 gap47.128ms. |
| 같은 연속 구간의 남은 정지 | 게시 gap 최대**575.537ms**, 표시 offset gap 최대**575.525ms**. 게시 ≥100/250/500/1000ms **7/4/3/0**, App turn 최대464.282ms. Core 개별 호출 최대13.055ms, record/submit3.480ms, submit→관측 GPU 완료10.408ms. **syntheticStallGoal=FAIL**이며 거리 보존 수정으로 정지도 해결됐다고 주장하지 않는다. |
| **60Hz 연속12개월 / ring 끔 / 1회** | update360개/6,000.187ms, start/end 포함362개 접수·소비, 거부0, **2026-11→2027-11**. cancel·resize·`2027-11-15` 확정·close PASS. sender gap17.361ms. ring이 없으므로 게시·offset gap은 **notMeasured**, syntheticStallGoal은 **notVerified**다. 이 한 쌍으로 개선율이나 실제 FPS를 계산하지 않는다. |
| 목록 wheel 4구간 / 각1회 | 첫 이동0→192는 준비 포함, 반전192→0은 layout/paragraph/Picture 증가0. 새 구간0→2304와 재방문2304→0은 별도 기록. 게시 gap 최대**42.657/41.440/36.838/36.718ms**, ≥100ms 모두0. Source layoutWork 증가870/0/13448/9989, paragraph 증가11/0/110/111로 구분했다. |
| 버튼·precision·OS mouse drag 기능 / 보강한 종료 관측에서1회 | next/previous 각각 정확히1개월, precision next/reverse/cancel, OS drag next/reverse 각각1개월, resize·`2026-11-15` 확정·close PASS. precision next/reverse/cancel 게시 gap 최대43.139/38.487/43.020ms, OS drag next/reverse37.660/42.545ms. 이 짧은 왕복의 PASS를 연속12개월에 옮기지 않는다. |
| 실제 창의 날짜 픽셀 | 현재 공급의12월 캡처에서 **13/20/27의 앞자리와 첫 열**, 12월1일의 화요일 배치·현재 월 grid·인접 월 노출 없음 확인. 일반적 모든 프레임/resize/DPR의 픽셀 수락과 scanout은 별개다. |
| 정상 종료·bounded 수집 | 최종60Hz trace 실행의 ringLost0/outputDropped0, native row 직렬화0. 해당 구간 memory466831119→509903922 bytes, peak557408351 bytes. 종료 전체 peak563088681 bytes, **status0/reservedBytes0/memoryTotal0/workersJoined=true/exitCode0**. ring 끔/짧은 달력/이전 실패 실행도 각각 같은 정상 종료 조건을 확인했다. |

목록을 포함한 첫 통합 실행은 OS drag 반전 뒤 header/grid assertion에서 멈췄다. 당시 도구의 `Settle`은 문서 ACK/게시만 확인해 Core page spring이 진행 중이어도 반환했다. 이를 최종 정합성 실패나 해결로 단정하지 않았다. `renderWake` flag를 기다리도록 보강한 첫 재실행에서는 App가 접수된 버튼 callback을 아직 보내기 전 Core가 idle인 경계를 다시 확인했다. 현재 도구는 **재클릭 없이 그 action의 예상 월 게시를 bounded15초 안에 먼저 기다리고**, Core 이동 종료와 header/모든 날짜를 검증한다. 이 보강 뒤 달력 기능 묶음을 한 번 재확인해 PASS했다. 전체 `All` 한 번이 처음부터 끝까지 통과했다고 기록하지 않으며, 앞서 완료된 목록4구간을 불필요하게 반복하지 않았다.

검사별20분 timeout을 유지했다. 현재 native suite, `check-page-observation.mjs`, 실제 Core를 사용하는 `check-immediate-reads.mjs`의 Source/ACK/publication fence·완료/close, 변경 JS/TS lint·format·PowerShell parser·`git diff --check` PASS다. native suite는 이 최종 build가 만든 library를 직접 지정해 검사했으며, 교체 전 dist의 library와 혼용하지 않았다. 전체 repository의 이전 lint/다른 플랫폼 제품 검증을 새로 완료한 것은 아니다.

## 12. 첫 수정 묶음 뒤의 잔여 작업과 다음 지점

이번 요청의 **60Hz 합성 입력과12개월 이동 실행** 및 첫 소스 수정 묶음은 구현·확인했다. **work10-a1의 주기적 멈춤 제거는 IN PROGRESS / PARTIAL**이다. 최종6초 구간에 ≥500ms 정지3회가 있으므로 핵심 성능 완료 조건을 충족하지 못했다. `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, physical/display/scanout **notVerified**를 유지한다.

다음 소스 작업은 [host.ts](Nelyx/runtime/app/host.ts)의 `perform` retained LayoutBuilder 갱신·`rebuildFromContent`, [scroll.ts](Nelyx/runtime/app/scroll.ts)의 `NativeListState.didUpdateWidget/reset/fill`, [layout-builder.ts](Nelyx/src/framework/widgets/layout-builder.ts)의 실제 callback/BuildScope 비용을 연결하는 것이다. 현재 App의 build/capture/scene 최대242/134/147ms와 60Hz의464ms turn, profile의 LayoutBuilder 경로가 좁힌 조사 지점이다. delegate의 `shouldRebuild`, 원래 page callback·200ms animation·Key/KeepAlive/Ink를 보존하면서, 같은 Source 결과의 반복 처리와 전체 Scene 준비를 줄여야 한다. 단일 GC·GPU submit·입력 수신을 이미 확정 원인처럼 바꾸지 않는다.

거리 보존을 위해 wire에 잔여 contact delta를 추가하거나 child window를 확대할 필요는 없었다. 동일 scalar/coverage 계약을 유지하며 후속 Source 최적화를 검증한다. §22의 capture/게시 fence 생략 실험, 무조건 stale 성공 처리, physical 입력의 합성 대체는 재도입하지 않는다.

실행에서 소유한 프로세스·mapping·timer·writer는 모두 finally로 닫았다. 임시 캡처/진단 helper는 이 차수의 단일 `.tmp/w10a1-scroll-e9791da4`만 사용했다. 재귀 삭제가 자동 승인 검토에서 `blocked by policy`로 거부되어, 실제 경로·일반 파일9개·native 프로세스 잔류 없음부터 다시 확인했다. 고정된 절대 경로의 해당9개 파일을 개별 삭제하고 비어 있는 폴더도 비재귀 삭제해 경로가 없어졌음을 확인했다. 현재 dist와 사용자의 기존 cache·emulator·§23의 삭제 차단 경로는 보존했다. 새 로그·profile·receipt/history·설치 소비자 사본·이전 dist/staging을 남기지 않았다.

## 13. 추가 요청에 따른 더 넓은 개편

사용자는 첫 묶음 뒤 **“더 넓게 개편 방안을 구상하고 고쳐줘”**라고 요청했다. 한 단계의 시간 조정에 한정하지 않고, 준비 요청·Source 자식 수명·관찰 데이터 소비·Hermes 실행 경로를 함께 개편한다. Source callback 생략이나 child window 확대는 해법으로 쓰지 않는다.

| 경계 | 확인한 구조 문제 | 구현한 변경 / 보존 조건 |
| --- | --- | --- |
| layout / publication 관찰 | native dictionary는 역할별인데 `EngineViewClient`의 단일 tail과 `SceneWriter`의 단일 drain이 두 역할을 다시 직렬화했다. 게시 관찰을 기다리는 동안 다음 Source 준비에 필요한 선택 layout도 기다렸다. | 두 계층 모두 역할별 진행으로 분리한다. 같은 역할의 delta base·resync는 계속 직렬이다. writer는 역할마다 in-flight1개+최신 pending1개만 유지한다. 완료 직후 도착한 demand의 lost wake, close·오래된 관찰의 state 역행, 교체된 layout callback의 호출을 막는다. |
| PageView / NativeList 자식 수명 | 같은 PageView의 constraints만 바뀌어도 LayoutBuilder가 새 delegate를 만들었다. NativeList는 itemExtent와 delegate 교체를 하나의 generation으로 처리해 자식을 다시 만들 수 있었다. | PageView Widget이 자신의 delegate를 보유하고 `ListView.custom`에 전달한다. NativeList의 delegate generation과 native geometry generation을 분리한다. extent/axis 변경은 geometry를 갱신하고 같은 delegate의 실제 child Widget은 보존한다. 새로운 Widget/delegate의 `shouldRebuild`와 새 count·Key·KeepAlive는 계속 적용한다. |
| capture 역방향 의존성 | collection index를 읽는 소비자도 조상의 Ink/opacity repaint에 무조건 전파됐다. | 의존성마다 children/layout/paint/semantics/interaction/resource mask를 합산한다. IndexedSemantics의 collection 조회만 children/layout에 제한하고, 알 수 없는 실행형 paint·reference는 전체 의존성을 유지한다. target 퇴거는 mask와 무관하게 모든 reference 소비자를 무효화한다. |
| 동기 Source build 안의 반복 전파 | 같은 render/kind의 여러 setter가 capture 전에 같은 역방향 의존성 그래프를 다시 걸었다. | `batchInvalidations`를 실제 동기 build/Content builder 답변 범위에만 적용한다. setter·callback·revision 기록은 실행하고 같은 kind의 capture 전파만 합친다. batch 안의 capture/commit을 거부하고 finally에서 끝낸다. capture·ACK·Content 대기는 범위 밖이다. 중첩·예외·연쇄 소비자의 최종 값과 다음 pass 무효화를 검사한다. |
| observation 조회 | layout callback마다 새 string-key Map과 행별 tuple을 만들고, list/focus 조상 조회는 같은 행을 반복 선형 탐색했다. | 기존 immutable cohort의 generation 확인 index를 공유한다. index 생성도 tuple 배열 없이 한 번만 순회한다. 서로 다른 snapshot·재사용 slot/generation은 섞지 않는다. |
| Source 구성 객체 | capture/relink 및 accepted record에서 내용이 고정된 SceneNode마다 배포 클래스의 undefined field 초기화와 대입·Hermes helper를 반복했다. | 내부 `sceneConfiguration`은 동일 prototype·own field descriptor·기본값의 구성 객체를 바로 만든다. 공개 생성자와 wire 검증은 유지한다. 실제 배포 ESM과 pinned VM에서 descriptor/instanceof·상속 setter·값을 비교한다. 2,000개 생성의 작은 비교는 생성자2ms/내부 구성1ms였으며 앱 전체 성능 근거로 사용하지 않는다. |
| Hermes continuation | pinned VM이 지원하는 async/await까지 ES2015 Promise/generator helper로 낮췄다. | Windows의 검증된 syntax policy에 native async/await를 추가한다. pinned compiler와 실제 VM에서 receiver/arrow arguments·thenable·예외/finally·super·비동기 완료를 확인한다. 기존 class lowering·optimizer pass 제외는 유지한다. |
| legacy fixed-list 준비 | 수평 velocity를 고쳐도 legacy demand의 `offset-height…offset+2*height` 계산은 속도를 쓰지 않았다. 페이지 callback의 Source rebuild와 창 교체가 연달아 진행되면 현재 coverage가 끝난 뒤에야 준비가 따라갈 수 있었다. | `legacyListCacheRange`는 같은 3-viewport 공간 범위를 `velocity*0.5s`, 최대 한 viewport만큼 이동 방향으로 앞당겨 선택한다. Source build/capture/ACK가 약500ms까지 걸린 현재 Windows 그래프에 맞춘 준비 시간이며 기한 보장이 아니다. deferred의 requested는 이미 실제 위치보다 앞설 수 있으므로 추가 예측을 끈다. 현재 requested viewport와 이동 방향 경계를 덮는 완성된 resident 창은 유지해, 속도 일시 정지/종료 시 이전 창으로 되돌리는 churn을 막는다. 1-page extent의 기존 4개 page window, 실제/deferred viewport 포함·반전·finite extent를 검사한다. 준비할 index의 힌트이며 실제 offset·target·coverage·ballistic clock은 바꾸지 않는다. |

JSI, TS Widget/Element/State, Core의 최종 layout/input/scroll 권위, App/Content/Render/UI owner는 유지한다. ABI2/schema313408118은 변경하지 않는다. §16/§22에서 철회한 별도 준비 queue나 Source capture·게시 fence 생략을 복원하지 않는다.

## 14. 개편 중간 결과와 철회한 가설

최종 준비 힌트 적용 전, 같은 engine `67f326…`의 **App JS/HBC를 별도로 식별**해 각 변경의 결과를 구분했다. engine hash가 같다는 이유로 다른 TS 번들의 결과를 섞지 않는다.

| 변경 상태 / 60Hz 연속12개월 각1회 | 결과 |
| --- | --- |
| 관찰 역할·delegate·capture 의존성 분리, JS `afc4b293…` / HBC `3cd71b0e…` | 360 update/6,000.568ms, start/end 포함362개 접수·소비·거부0. 2026-11→2027-11, cancel·resize·2027-11-15 확정·close PASS. 게시 최대546.550ms, ≥100/250/500/1000ms 7/5/2/0. App turn529.925ms. **syntheticStallGoal=FAIL**. |
| 같은 번들의 별도 CPU 진단 | sample1314 중 young-GC self301, LayoutBuilder rebuild inclusive430, generator resume inclusive878. 중첩 stack은 합산하지 않는다. GC 통계는 시작부터 누적398회/1.694초, 최대37.233ms, 총 할당1,459,868,664 bytes였다. GC 하나가 전체 정지라는 증거는 아니다. 프로파일을 켠 이 실행의 게시793.377ms를 비진단 기준선과 직접 비교하지 않는다. |
| native async·공유 node index 추가, JS `65262288…` / HBC `16b4af3c…` | 360 update/6,000.583ms,362개 접수·소비·거부0, 같은12개월·선택/종료 기능 PASS. 게시 최대569.534ms, ≥100/250/500/1000ms 6/5/3/0. App turn402.916ms. **syntheticStallGoal=FAIL**. 단일 실행의 최대값 차이를 개선율로 만들지 않는다. |

객체의 undefined field들을 공유 descriptor로 한 번에 초기화하는 방식도 pinned VM에서 확인했다. 실제 ES2015 class lowering과 같은 비교에서 6,000개 객체 생성은 개별 field68ms/묶음79ms였다. 이 비교가 전체 앱 성능은 아니지만 채택할 근거가 없어, 해당 helper·SemanticsProperties 변경·실험 fixture를 모두 철회했다. 기본 field 의미나 class policy를 느슨하게 바꾸지 않았다.

그다음 첫 legacy 준비 힌트(`1e700ec2…`, JS `65262288…` / HBC `58f03569…`)의12개월 실행도 기능·362개 접수/소비·정상 close는 PASS했지만 게시 최대859.871ms, ≥500ms2회로 실패했다. 이를 개선으로 남기지 않는다. 코드 대조에서 **requested와 displayed의 차이를 무시한 추가 예측**, 속도 감소에 따른 **이전 창 재선택**을 확인했고, §13의 deferred 제외·resident 유지 조건과 회귀를 추가했다. 이후 Source build의 전파 batch도 묶어 최종 공급에서 다시 확인한다.

350ms 힌트의 deferred/resident 보강+Source 전파 batch 실행(`43fed6b8…`, JS `3c522ce7…` / HBC `da51b0e0…`)도 기능 PASS·게시576.085ms/≥500ms2회로 핵심 목표는 실패했다. 이 실행에서는 중복 전파7,816건을 합친 카운터가 확인됐다. 내부 Scene 구성 경로까지 추가한 다음 번들(JS `11bff42a…` / HBC `2e80b053…`)의 기능 전체 묶음은 PASS했지만, 별도12개월은 게시537.253ms/표시 offset537.269ms·≥500ms1회로 실패했다. App의 긴 한 pass에서 build218ms/capture70ms/scene209ms가 기록돼 350ms 준비 시간보다 긴 처리 경로가 남았다. 이 숫자는 중첩 owner 시간을 합친 GPU/scanout 시간이 아니다. 따라서 §13의 준비 시간은500ms로 맞추되 기존 한 viewport/4페이지 상한을 유지하고, 다음 공급에서 검증한다.

## 15. 추가 개편의 현재 공급과 최종 통합 결과

engine/source는 **`38eeb446989f07c884c5f8be944fa96566a74238d09a4e8aac847cac98926cc2`**, ABI2/**schema313408118**이다. App JS는 **`11bff42afe900ab49828b3b8142f5835f28a72697ad153a79b859958ecf3989b`**, HBC는 **`41d947f544a57a5d9f49538b703445e11737b45635ca26fad0f2ef673c2e2d8b`**, modules892다. 일반 CLI 실행마다 현재 sourceIdentity·engine356/App10 files의 hash·공급 연결·실제 자식 PID/HWND/DPI192를 검증했다. native·Windows App SDK·두 Wasm 공급은 갱신됐고, ESM/declaration/type 검사와 App HBC 빌드도 통과했다. Android 공급 갱신·실행과 다른 플랫폼 제품 UI는 **notVerified**다.

| 검증 / 각 변경 뒤 필요한 실행1회 | 관측 결과와 한계 |
| --- | --- |
| **현재 공급 / 60Hz 연속12개월** | update360개/**6,000.571ms**, start/end 포함362개 접수·소비·거부0. **2026-11→2027-11**, cancel·resize·`2027-11-15` 선택/확정·정상 close PASS. sender gap21.038ms/lateness4.465ms, 수신 gap49.668ms, admission 최대0.843ms. 합성 sender의60Hz를 렌더링 FPS로 표기하지 않는다. |
| **같은 활성 구간 / 핵심 정지 목표** | 게시 gap 최대**563.731ms**, ≥100/250/500/1000ms **3/3/1/0**. 게시된 viewport offset의 진행 공백 최대**617.656ms**, ≥500ms1회. **syntheticStallGoal=FAIL**. 두 지표가 다르므로 게시 수만 늘어난 것을 scroll 진행으로 간주하지 않는다. |
| 긴 게시 공백의 위치 | 주입 시작 뒤 **2,492.272ms**에서419.291ms(input163→188, doc49→52), **3,547.159ms**에서563.731ms(input225→259, doc54→57), **4,995.705ms**에서391.757ms(input313→336, doc59→62). 시작 전 idle을 포함한 값이 아니다. 도구는 이 목록을 최대8개로 출력하고 파일로 남기지 않는다. 문서 전환과의 연관이며 단일 함수의 인과 확정은 아니다. |
| owner별 구분 | 활성 App turn 최대**520.091ms**, Core 개별 호출12.274ms, record/submit5.642ms, submit→관측 GPU 완료12.284ms. 전체 시나리오 App99 passes에서 build/capture/scene 최대256/128/260ms, 전파 합침7,231건을 확인했다. 각 최대값·중첩 비동기 구간을 더하지 않으며 GPU 완료 관측을 순수 GPU 시간/scanout으로 확대하지 않는다. |
| **현재 공급 / 짧은 달력 기능 묶음** | 버튼 next/previous, precision next/reverse/cancel, OS mouse drag next/reverse, resize anchor·`2026-11-15` 확정·close PASS. precision next/reverse/cancel 게시 최대49.358/60.396/42.617ms, mouse drag next/reverse37.113/48.060ms, 모두 ≥100ms0. 이 짧은 PASS를 연속12개월의 결과로 옮기지 않는다. |
| 직전 공급의 전체 기능 묶음 | `43fed6b8…`/같은 App JS의 **All** 한 번이 목록4구간부터 달력·close까지 PASS했다. 목록 게시 최대43.258/36.714/42.299/48.231ms, warm reverse의 layout/paragraph 증가0. 이후 변경은 nonzero velocity의 준비 시간350→500ms다. velocity0의 목록 wheel 분기는 동일해 목록을 반복하지 않았고, 변경 영향의 달력은 위 현재 공급에서 다시 확인했다. |
| 현재 창의 픽셀 | 현재 공급의 **December2026**과 **November2027** 캡처를 확인했다. 첫 열13/20/27와14/21/28의 앞자리, 해당 월의 날짜/요일 배치, 인접 월의 노출 없는 grid를 확인했다. 선택된 날짜를 보여주는 왼쪽 패널은 월 탐색 중 기존 선택일을 유지하는 정상 동작이다. 모든 동적 프레임·DPR·scanout 수락은 아니다. |
| bounded 수집·종료 | 연속12개월 ringLost0/outputDropped0, native frame row 직렬화0. memory466829592→515692690 bytes, 활성 peak563616086 bytes, close 전체 peak567555363 bytes. **status0/reservedBytes0/memoryTotal0/workersJoined=true/exitCode0**. 짧은 달력 실행도 동일한 정상 회수를 확인했다. bounded dispatch/App sample ring의 overwrite와 실제 수집 유실을 구분한다. |

현재 library의 native frame/reader/quota/lease·거리 보존·준비 상한·resident/반전/deferred/finite extent·delayed Source list·late page·spring/RTL/date 회귀가 PASS했다. 현재 Core Wasm의 observation delta/full oracle·quota rollback·resync·Source/ACK/publication fence·close, TS의 역할 분리/lost wake·delegate/constraint 수명·typed dependency/retirement·동기 build batch/예외·incremental journal, pinned Hermes+배포 ESM의 async와 내부 Scene 구성 의미도 PASS했다. 검사별20분 timeout, 변경 JS/TS lint·format·PowerShell parser·`git diff --check`를 적용했다. 이 결과를 전체 저장소 검사나 다른 플랫폼 제품 수락으로 확대하지 않는다.

이 차수의 임시 경로는 `.tmp/w10a1-source-20261111` 하나였다. 현재 캡처를 검토하고 실제 절대 경로·일반 디렉터리·파일5개와 owned 앱 정상 종료를 확인한 뒤, 해당 PNG5개와 빈 디렉터리를 고정 경로의 비재귀 삭제로 회수했다. 경로가 없어졌고 native host가 남지 않은 것을 확인했다. 이번 build staging/이전 dist도 회수됐으며 현재 dist와 기존 `engine-vTz0Je`·§23의 차단 경로는 보존했다. 새 profile·로그·receipt/history·설치본·archive를 남기지 않았다. Windows 한정 범위로 Web App 번들 재생성·제품 UI 검증은 수행하지 않았다.

## 16. 미완료 범위와 다음 개편 경계

이번 추가 요청의 **공통 경로 개편과 소비자 연결·통합 검증은 반영**했다. 그러나 연속12개월에서 여전히 ≥500ms가 남으므로 **주기적 멈춤 제거는 IN PROGRESS / PARTIAL**이다. 첫575ms와 최신564/618ms의 작은 실행별 차이를 개선율로 제시하지 않는다. `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, physical/display/scanout **notVerified**를 유지한다. 사용자 물리 트랙패드의 해결 확인도 남는다.

다음 구현은 준비 힌트/캐시/반복 실행을 더 늘리는 방향이 아니라, **Source callback이 만든 한 결과를 capture와 SceneWriter가 다시 정규화·복제하는 경계**를 줄이는 묶음이다.

1. [host.ts](Nelyx/runtime/app/host.ts)의 `perform/rebuildNativeContent/captureNode`에서 필수 Source builder 답변과 일반 Widget invalidation의 반복 구성량을 구분한다. 원래 callback·`shouldRebuild` 실행은 보존하고 같은 결과의 재투영·등록/연결만 합친다. `.syncRenderTree()`는 이미 dirty-owner commit이므로 전체 트리 순회라고 가정해 제거하지 않는다.
2. [capture.ts](Nelyx/runtime/app/capture.ts)에서 children/layout/paint/semantics/interaction/resource별 **owner가 소유한 불변 payload와 revision**을 보존하고, [scene.ts](Nelyx/runtime/engine-client/scene.ts)의 `records/encode/diff`가 그 payload를 함께 소비하도록 연결한다. 공개 producer의 mutable/accessor 입력과 실행형 reference는 현재 보수적 경로를 유지한다. callback snapshot·generational handle 배정은 SceneWriter의 ACK/게시 checkpoint 권위를 유지한다. 현재 `sceneConfiguration`은 구성 비용 일부만 줄였으며 중간 SceneNode 계층 전체를 없앤 구현이 아니다.
3. payload의 동일 값/새 callback·참조 generation 교체·reparent/KeepAlive·NACK/메모리 거부·close oracle를 묶어 검사한 뒤, 새 공급의 같은12개월을1회 확인한다. Source/게시 fence 생략, 별도 optional 준비 큐, row window 확대, stale 성공 치환이나 자원 조기 회수로 시간을 숨기지 않는다.

## 17. 2026-11-12 기본 명령 공유와 바이트 비교 개편

추가 요청의 아이디어를 실제 diff 경로에 적용했다. 새 노드 생성 시 `SceneWriter.diff`는 생성 flag를 판별하고 기본 명령을 생략하기 위해 같은 properties/paint/constraints/layout/eventPolicy 패킷을 노드마다 다시 인코딩했다. 이를 모듈 내부의 고정된8개 기본 패킷으로 공유한다. 생성 기본값 비교에서만 destination handle의8–15바이트를 제외하며, accepted record 비교와 blob 충돌/관찰 검증에서는 전체 바이트를 비교한다. 공유 패킷은 비교에만 사용하고 transaction에 직접 전달하지 않는다.

Scene·SceneBlobJournal·ObservationStream의 `Uint8Array.every` 바이트별 callback도 인덱스 순회로 대체했다. 출력의 생략 조건과 바이트 동등성은 유지하면서, 비교용 패킷 재생성과 바이트마다 발생하는 JS 함수 호출을 제거한다. 새 노드 diff 단계의 기본 명령 인코더 호출0회, non-default 너비/색상 보존을 검사했으며, 실제 pinned Hermes와 배포 ESM에서도 같은 조건을 확인했다. 기존 incremental journal·generation·NACK·blob collision·관찰 full oracle·Source/ACK/publication/close 회귀가 통과했다.

ObservationStream은 provider module graph에도 포함되므로 App만 빌드한 첫 실행은 sourceIdentity 검사가 차단했다. 해당 실행은 앱 성능 측정에 포함하지 않고 engine/native/Windows App SDK/두 Wasm 공급도 갱신했다. 이 변경은 중간 SceneNode 계층 전체 제거와 별개이며 §16의 남은 payload 공유 범위는 유지한다.

공급은 **`974192113590c65bd6991598cefca3b2426a06abd65664f67970956ede7b8918`**, ABI2/schema313408118, modules892다. 채택한 App JS는 **`c5f7293e0759a59bf092faa0927aaf50f060c041ebdaaf16c6077c8d8e2e31d1`**이다. 해당 JS/HBC `5f5d0db3…`의60Hz12개월 실행에서360 update/6,000.658ms, start/end 포함362개 전량 접수·소비·거부0, 2026-11→2027-11·cancel·resize·2027-11-15 확정·close가 PASS했다. 그러나 게시 최대**576.029ms**, offset 진행 최대**576.016ms**, 각각 ≥500ms1회로 **syntheticStallGoal=FAIL**이다. 긴 게시 공백은 약2,496/3,507/4,496ms의 doc51→54/55→58/60→63 전환에서474.536/368.962/576.029ms였다. App turn433.990ms, Core 개별 호출8.658ms, record/submit6.704ms, 관측 GPU 완료12.470ms를 구분한다. 정상 close status0/reserved0/memory0/workersJoined=true/exit0, ringLost0/outputDropped0, 전체 peak569982535 bytes였다.

두 번째 아이디어로 full-page의 준비 창 교체를 `onPageChanged`의 반 페이지 경계에 맞추어 Source build를 합치는 변경도 구현·검사했다. deferred·부분 페이지·명시적 목적지는 Core demand로 남겼고 국소 회귀는 PASS했으나 실제12개월에서 게시937.700ms/offset1,022.372ms로 더 긴 공백이 나타났다(JS `9dc787cf…`). 이 변경과 전용 fixture는 **철회**했으며 기존 PageView/Core demand 정책을 복원했다. 실패한 실험을 현재 구현이나 개선으로 남기지 않는다.

이번에 채택한 것은 비교용 기본 패킷 재생성 제거와 바이트 비교 변경이다. 기능/불변식은 통과했지만 전체 주기적 멈춤은 해결되지 않았으므로 **IN PROGRESS / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, physical/display/scanout notVerified를 유지한다. 사용자 요청을 해결 완료로 표시하지 않는다.

실험 철회 뒤 ESM·declaration/type·Windows App을 다시 빌드했다. 복원된 JS hash는 위 `c5f7293e…`와 정확히 같고, 현재 HBC는 **`1dbbd5dc092ba5afa6bb11f6ddfbe75efacf3d5daff2b9c784621be06373ddd8`**다. sourceIdentity와 engine356/App10 files를 재검증했다. 복원 공급의 별도 짧은 달력 실행에서 버튼·precision·OS mouse drag 왕복·cancel·resize·2026-11-15 확정·정상 close가 PASS했다. precision next/reverse/cancel 게시 최대54.470/57.035/41.293ms, mouse drag next/reverse48.395/41.793ms, ≥100ms 모두0이다. 이 짧은 PASS를 위12개월 성능 실패에 덮어쓰지 않는다. 현재 HBC의 정상 종료 status0/reserved0/memory0/workersJoined=true/exit0, ringLost0/outputDropped0도 확인했다. 이번에는 캡처/profile/로그 파일을 만들지 않았고, 검사 임시 경로와 build staging은 각 도구의 finally로 회수했다. Android/Web 제품 UI는 검증하지 않았다.


## 18. 2026-11-12 추가 실험: 기본 명령 지연 생성과 날짜 조회 할당 제거

사용자의 **“더 실험 해보고 고쳐줘”** 요청에 따라 Source 구성 비교·명령 생성·달력 값 객체를 차례로 확인했다. 다음 두 변경을 채택했다.

- [scene.ts](Nelyx/runtime/engine-client/scene.ts)의 Source 소유 기본 설정은 **8개 고정 명령과 작은 비교 입력**을 노드 사이에서 공유한다. 이전 §17은 diff의 비교 대상만 공유했지만, 이번에는 records 단계에서도 기본 properties/paint/constraints/layout/eventPolicy를 재인코딩하지 않는다. 공유 명령은 placeholder handle을 가지며 외부로 직접 전송하지 않는다. diff가 같은 generational record를 선택한 뒤 값을 비교하고, 실제 생성 후 변경·기본값 복원 명령을 전송할 때만 복사본에 현재 slot/generation을 쓴다. 공개 producer·accessor/실행형/비기본 설정은 기존 검증·인코딩 경로를 유지한다. 임의 payload를 보관하는 무제한 캐시는 추가하지 않았다.
- [date-time.ts](packages/material/src/internal/date/date-time.ts)의 `DateTime.year/month/day/weekday`가 호출마다 `toDate()`를 통해 새 `Date`를 만들던 경로를 고쳤다. 생성할 때 이미 만든 civil date를 private WeakMap에서 해당 값의 수명 동안 재사용한다. epoch·동등성·지역 날짜 계산은 유지하며, `toDate()`는 계속 독립적인 가변 복사본을 반환한다. 년·월·일 숫자를 고정 캐시하지 않아 생성 이후 호스트 시간대 변경도 현재 시간대의 getter로 계산한다. 생성된 Flutter 달력 코드나 사용자 callback은 변경하지 않았다.

세 변경 상태마다 필요한 60Hz·12개월 실행을1회씩 했다. 같은 engine hash라도 App JS/HBC가 다르므로 결과를 구분한다.

| 실험 / App JS · HBC | 기능과 활성 구간 결과 | 판단 |
| --- | --- | --- |
| 압축 Source 스냅샷 / `63d634fd…` · `196c8eb8…` | 360 update/6,000.175ms, start/end 포함362개 전량 접수·소비·거부0, 2026-11→2027-11·선택/resize/close PASS. 게시597.563ms/offset597.559ms, ≥500ms 각각2회. | 비교와 복사를 한 descriptor 순회에 합쳤지만 records 총1,466ms로 직전1,470ms와 비슷하고 전체 정지도 남았다. helper·전용 fixture를 철회했다. 해당 측정은 현재 코드의 결과가 아니다. |
| 기본 명령 지연 생성 / `615a41ff…` · `94d41876…` | 360 update/6,000.246ms,362개 전량 접수·소비·거부0, 동일12개월과 선택/resize/close PASS. 게시607.208ms/offset607.228ms, ≥500ms 각각2회. Source 기본 명령 공유 hit93,796건, records1,395ms/diff514ms. | 기본 명령의 per-node 생성 제거는 확인했으나 전체 정지는 해결하지 못했다. hit에는 이전 accepted record로도 재사용할 수 있던 경우가 포함되므로 순수 절감 건수로 해석하지 않는다. |
| **위 변경+DateTime 조회 / 현재 `da791e91…` · `f502caa3…`** | 360 update/**6,000.572ms**,362개 전량 접수·소비·거부0, **2026-11→2027-11**, cancel·resize·**2027-11-15** 확정·정상 close PASS. 게시**522.686ms**/offset**522.612ms**, ≥100/250/500/1000ms 각각**5/4/2/0**. | **syntheticStallGoal=FAIL**. 실행별 최대값 차이를 개선율로 제시하지 않는다. 불필요한 기본 명령/날짜 객체 생성 제거를 채택하지만 주기적 멈춤 해결로 선언하지 않는다. |

현재 공급은 engine/source **`974192113590c65bd6991598cefca3b2426a06abd65664f67970956ede7b8918`**, ABI2/schema313408118, App JS **`da791e913cba58366c5b57e7be17b23ae3c868ed631dbbfcb1b235969df596bd`**, HBC **`f502caa3a80fbca1ea70de996c3145a368647a240a6fcb7bc79cff39f080b160`**다. 이번 채택 변경은 App 경로에 한정된다.

현재 실행의 sourceIdentity와 engine356/App10 files 및 실제 PID/HWND/DPI192 연결을 검증했다. Core/native는 변경하지 않았으며 기존 현재 공급을 사용했다. Core ESM/declaration/type, Material ESM/declaration/type, engine-v2 Windows App 번들을 빌드했다. 중간에 잘못 호출한 기존 testbed RNW 빌드는 그 공급의 `generated/jsi/engine.cmake` 불일치로 종료됐으며 현재 engine-v2 앱 측정에 포함하지 않았다. 그 명령이 바꾼 testbed `app-config.json` 경로는 복원했다.

현재12개월 활성 구간의 App turn 최대577.160ms, Core 개별 호출20.432ms, record/submit5.506ms, submit→관측 GPU 완료12.751ms다. 긴 게시 공백은 시작 후 약1,992/2,996/4,502/5,101ms의 doc47→50/52→55/57→59/59→62에서377.834/522.686/436.250/515.996ms였다. 전체 시나리오106 Source passes의 build/capture/scene 최대238/120/206ms, records1,281ms/diff529ms, 기본 명령 공유 hit96,758건을 기록했다. 중첩·서로 다른 구간의 시간을 합쳐 원인을 만들거나 GPU 완료 관측을 scanout으로 취급하지 않는다.

현재 공급의 별도 짧은 달력 묶음에서도 버튼 next/previous, precision next/reverse/cancel, OS mouse drag next/reverse, resize anchor·2026-11-15 확정·close가 PASS했다. precision 게시 최대42.856/65.199/49.854ms, mouse drag41.960/42.066ms, 각 ≥100ms0이다. 이 짧은 synthetic PASS는 연속12개월 FAIL을 대체하지 않는다. 두 현재 공급 실행 모두 ringLost0/outputDropped0, close status0/reservedBytes0/memoryTotal0/workersJoined=true/exitCode0이다.12개월 memory461,833,248→519,215,936 bytes, peak562,470,815 bytes; 짧은 묶음 peak589,937,905 bytes다.

검사는20분 timeout 아래 다음 의미를 확인했다.

- incremental capture/journal의 reparent·parking generation·in-flight update 회귀와 함께, 공개 producer를 oracle로 기본/비기본 전환·초기화·NACK/재시도·삭제 후 remount의 **실제 전송 바이트 전체가 동일**함을 확인했다. Source 기본 노드의 properties/paint/constraints/layout/eventPolicy 인코더 호출은0회다. 실제 pinned Hermes/배포 ESM에서도 기본값 reset의 대상 handle을 확인했다.
- [check-date-value.mjs](Nelyx/eng/check-date-value.mjs)는 필드 반복 조회의 `Date` 할당0회, 반환/입력 Date의 가변성 격리, UTC/서울/뉴욕의 윤년·DST·연도99·음수 연도·월 넘침·기존 값의 시간대 변경을 실제 JS Date oracle과 대조했다. 실제 Hermes에서도 날짜 값·복사본 격리를 확인했다.
- 실제 Core의 Source/ACK/publication/close, notification/lost-wake, 변경 파일 lint/format 및 `git diff --check`가 PASS했다. 기존 전체 native suite를 이번 App-only 변경의 결과처럼 다시 표기하지 않는다. Android/Web 제품 UI, 물리 트랙패드, 표시 픽셀/scanout은 이번에 검증하지 않았다.

이번 실행은 캡처/profile/로그 파일을 만들지 않았다. 스크립트의 finally가 소유 프로세스·mapping·timer를 회수했고 Hermes 검사 임시 폴더와 App build staging이 남지 않았음을 확인했다. 현재 dist와 기존 사용자 cache는 보존했다.

**잔여 범위:** 주기적 멈춤은 여전히 **IN PROGRESS / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, physical/display/scanout **notVerified**다. Core의 기존4페이지/한 viewport 준비 창은 유지한다. 창 이동을 무조건 한 단계로 제한하면 실제 coverage miss 준비를 늦출 수 있어 새로운 제한을 넣지 않았다. 다음 개편 경계는 §16의 Source build 결과와 capture/SceneWriter 사이 payload 공유이며, 현재의 긴 retained LayoutBuilder/Widget 갱신과 뒤따르는 capture를 함께 줄여야 한다. 기본 명령 공유가 일반 payload·중간 Scene 구성 전체를 제거한 것은 아니다. 원래 callback·shouldRebuild·200ms animation·Key/KeepAlive/Ink·Source/ACK/게시/자원 수명 fence는 계속 보존한다.


## 19. 2026-11-12 Flutter 원본 대조와 Source 요청·자식 재사용 보강

사용자의 **“플러터 엔진에서 힌트를 찾아보고 해결책을 고안해보고 고쳐줘”** 요청으로 공식 Flutter engine/framework 소스를 읽었다. 확인한 upstream revision은 **`a2886f44205b1c46388a1e17e4e75d0a71541edf`**이며, 원본 전체를 복제하거나 별도 Flutter 실행 환경을 만들지 않았다.

| 공식 원본 / 확인한 원리 | Nelyx에 적용한 변경 |
| --- | --- |
| [Animator::RequestFrame/BeginFrame](https://github.com/flutter/flutter/blob/a2886f44205b1c46388a1e17e4e75d0a71541edf/engine/src/flutter/shell/common/animator.cc): 프레임 요청을 합치고 build를 시작할 때 그 요청을 소비한다. [Pipeline](https://github.com/flutter/flutter/blob/a2886f44205b1c46388a1e17e4e75d0a71541edf/engine/src/flutter/shell/common/pipeline.h)은 유한한 producer/consumer 용량을 유지한다. | `host.ts`의 state/Content 대기 중 도착한 변경은 직후의 동기 Source build에 포함된다. 그 요청의 rerun flag를 **build 직전** 소비해 동일 내용을 다음 capture에서 반복하지 않는다. 이미 더 최신 metrics/device/font 관찰이 있으면 rerun을 남긴다. capture·ACK·게시·retirement·입력 checkpoint 이후의 새 요청도 그대로 남긴다. 기존 Content/게시 대기나 Source capture를 생략한 §22 실험과 다르며, 별도 준비 큐/GPU reader 조기 회수를 추가하지 않았다. |
| [Element.updateChildren](https://github.com/flutter/flutter/blob/a2886f44205b1c46388a1e17e4e75d0a71541edf/packages/flutter/lib/src/widgets/framework.dart): 앞에서 일치하는 자식을 먼저 갱신하고 나머지를 키로 찾는다. | `framework.ts`의 다중 자식 reconcile이 선언 순서대로 일치하는 prefix를 재사용한다. 전체 형제가 안정적이면 기존 자식의 KeyMap과 retirement Set을 만들지 않는다. 미일치 suffix만 색인하며, callback에 의해 다른 부모로 옮겨진 자식은 제외한다. 중복 키 사전 검사·Key.equals/hash·callback·slot·GlobalKey·실패 정리는 유지한다. Nelyx의 기존 미일치 unkeyed positional 동작은 바꾸지 않았으며 Flutter 전체 알고리즘을 그대로 대체한 것은 아니다. |
| [SliverMultiBoxAdaptorElement.performRebuild](https://github.com/flutter/flutter/blob/a2886f44205b1c46388a1e17e4e75d0a71541edf/packages/flutter/lib/src/widgets/sliver.dart): Widget 갱신은 보유 자식을 갱신하고, 필요한 자식 범위는 layout이 결정한다. | `NativeListState.reset`은 같은 유효 count의 PageView 준비 창을 유지한다. 늦게 관찰된 `desiredPage`가 창 밖이라는 이유만으로 헤더 갱신이 Core 요청 범위를 뒤로 돌리지 않는다. 최초 페이지·count 변경·Core의 실제 반전/explicit target/coverage demand는 계속 범위를 정한다.4페이지 상한과 delegate/geometry generation을 유지한다. 기존 teardown 진단에 `preservedRequestedWindows` 단일 카운터를 추가했다. |

변경 전 현재 번들(`da791e91…`/`f502caa3…`)로 CPU 진단을1회만 실행했다. 표본1,276개에서 young-GC self282, class field helper self54, LayoutBuilder 경로 inclusive488이 관찰됐다. 전체 GC 누적373회/1.538초, 최대26.901ms, 누적 할당1,366,553,280 bytes였다. inclusive stack을 합산하지 않으며 GC 한 번이500ms 정지라는 결론은 아니다. 이 진단 실행은 별도의 비진단 성능 기준선으로 쓰지 않았다. 강제 GC·임의 heap 확대·Dart VM 교체도 적용하지 않았다.

### 19.1 회귀와 의미 검증

- 새 [check-child-reconciliation.mjs](Nelyx/eng/check-child-reconciliation.mjs): 안정된 keyed 형제4개에서 hash 조회는 중복 키 사전 검사에 필요한7회뿐이다. 기존 자식 검색 색인 비용이 추가되지 않으며 Element identity와 update callback 순서를 유지했다. hash 충돌 키의 재정렬/삭제/추가, IndexedSlot의 이전 형제, 중복 키의 사전 거절, 뒤쪽 update 실패 시 retained prefix 생존, GlobalKey의 부모 간 이동, unkeyed positional identity를 확인했다.
- [check-immediate-reads.mjs](Nelyx/eng/check-immediate-reads.mjs): 실제 Core를 통해 capture 전 재진입 update가 **1 commit/1 Source pass**로 최신 Widget을 반영하는 것을 확인했다. ACK 중 invalidation은2번째 pass를 유지하며, real pending Content와 acquire/release 후 미게시 frame을 계속 기다린다. inspect 이후 도착한 새 metrics cohort도2번째 pass와 최종 sceneMetrics 갱신을 유지한다.
- [check-page-observation.mjs](Nelyx/eng/check-page-observation.mjs): Source가 page10을 관찰 중이고 Core 요청 창이18–22인 상황에서 Widget 갱신이 창을 되돌리지 않는다. 이어진 Core demand9–13은 반영하며, count2로 줄면 범위를0–2로 다시 제한한다. 기존 resize anchor·명시적 scroll command/ACK fence·delegate 교체 검사를 함께 통과했다.
- LayoutBuilder의 deferred frame 취소/새 invalidation/close, Ink parking·fresh generation, incremental capture/journal 회귀도 PASS했다. Core ESM/declaration/type와 Windows App을 다시 빌드하고 변경 파일 lint/format·PowerShell parser·`git diff --check`를 확인했다. 이번 production 변경은 App/framework에 한정되므로 기존 engine/native 공급을 다시 만들지 않았다.

### 19.2 Windows 결과와 현재 공급

첫 두 변경만 적용한 App JS `8a82bc400866caa07170c2ae0252931ee6da96614090d2db16561a4996205ce0` / HBC `184d8e5e51a03a60f8dce737e4c26c4063583fff9f42e2ea342e01e9e8c381f5`의 비진단60Hz12개월 실행은 기능 PASS,360 update/6,000.459ms·start/end 포함362개 전량 접수/소비·거부0이었다. 게시558.325ms/offset558.328ms, ≥500ms 각각2회로 **FAIL**이며 Source pass97회였다. 같은 번들의 **All** 실행은 목록4구간부터 달력 버튼/precision/OS drag 왕복·resize·선택·close까지 PASS했다. 목록 게시 최대47.978/42.480/48.615/48.379ms였고 warm reverse의 layout/paragraph 증가는0이었다. 이 기능 PASS를 연속12개월의 정지 해결로 바꾸지 않는다.

준비 창 보강까지 포함한 **현재 engine/source**는 `974192113590c65bd6991598cefca3b2426a06abd65664f67970956ede7b8918`, ABI2/schema313408118이다. **현재 App JS**는 `716f79a659914bf4be4c5dc276c228c2bfd16cd0d86d142f6607ad0195245dc1`, **HBC**는 `2a51ebda3f91353dbe58bbd37fa1e180b9c113be027e078c6c48e840f7d1f09b`다. 실행 전에 sourceIdentity·engine356/App10 files·실제 자식 PID/HWND/DPI192를 검증했다.

| 현재 공급 검사 | 관측 결과 |
| --- | --- |
| 60Hz 연속12개월 | 360 update/**6,000.156ms**, start/end 포함362개 접수·소비·거부0. **2026-11→2027-11**, cancel·resize·2027-11-15 확정·close PASS. sender lateness 최대0.617ms. |
| 활성 구간의 게시/offset 진행 | **539.352ms / 539.351ms**, 각각 ≥100/250/500/1000ms **5/5/1/0**, **syntheticStallGoal=FAIL**. 약1,494/1,991/2,502/3,517/4,496ms에서257.658/357.393/475.392/334.085/539.352ms 공백이 있었다. |
| owner별 구분 | App turn527.618ms, Core 개별 호출14.185ms, record/submit6.147ms, 관측 GPU 완료11.813ms. 전체102 Source passes의 build/capture/scene 최대298/113/179ms. 각각 별도/중첩 구간이므로 합산하지 않는다. |
| 준비 창 보강의 실제 발생 | `preservedRequestedWindows=0`. 위 재현 fixture에서는 조건을 검증했지만 이번 실제 연속 이동에서는 발동하지 않았다. **현재 정지의 원인이나 성능 개선으로 이 변경을 설명하지 않는다.** |
| 현재 공급의 짧은 달력 묶음 | 버튼 next/previous, precision next/reverse/cancel, OS mouse drag next/reverse, resize·2026-11-15 확정·close PASS. precision 게시 최대65.335/42.335/51.616ms, mouse drag37.427/37.506ms, 각 ≥100ms0. 준비 창 보강 카운터는 이 실행도0이다. |
| 회수·bounded 수집 | 현재12개월과 짧은 달력 모두 ringLost0/outputDropped0, status0/reservedBytes0/memoryTotal0/workersJoined=true/exit0.12개월 memory461,896,152→507,425,526 bytes, 전체 peak561,480,346 bytes; 짧은 묶음 peak585,346,210 bytes. 직전 All의 전체 peak581,228,082 bytes와 정상 종료도 확인했다. |

이번 단계에서 캡처/profile/로그 파일을 만들지 않았고 진단 출력은 기존 bounded 수집기를 사용했다. 소유 프로세스·mapping·timer는 finally로 닫았으며 build staging/검사 임시 폴더의 잔류 없음과 현재 dist 보존을 확인했다. 최신 변경의 ordinary list 분기는 동일하므로 직전 All의 목록을 반복하지 않고 바뀐 PageView를 현재 공급에서 재검증했다. Android/Web 제품 UI와 실제 픽셀·물리 트랙패드·scanout은 이번에 검증하지 않았다.

**잔여 범위:** Flutter 원본의 요청 합치기/자식 재사용/범위 소유권을 적용했으나, 월 경계의 긴 Source build·capture·Scene 준비는 여전히 남는다. 이전523ms, 중간558ms, 최신539ms의 실행별 차이를 개선율로 주장하지 않는다. 전체 작업은 **IN PROGRESS / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, physical/display/scanout **notVerified**다. §16의 kind별 불변 payload 공유와 필수 LayoutBuilder 응답 이후의 반복 구성 경계가 계속 남으며, 별도 optional 준비 큐·게시 fence 생략·callback/animation 단축으로 이를 우회하지 않는다.
