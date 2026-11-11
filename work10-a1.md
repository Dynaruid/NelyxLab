# work10-a1 — Windows 트랙패드 주기적 멈춤: 코드 분석·수정 우선

작성: **2026-11-11 KST** · 상태: **READY / 구현 착수 전** · 상위 계약: [work10.md](work10.md) · 성능 판정: **PARTIAL / performanceAccepted=false**

## 1. 이번 작업의 기준

사용자가 Windows Demo를 다시 빌드·실행한 뒤 **“트랙패드 스크롤때 중간마다 주기적으로 1초 내외정도로 끊김”**을 보고했다. 약1초는 **멈춤의 지속시간에 대한 사용자 관측**이다. 발생 간격·빈도·정확한 단계 시간은 아직 측정하지 않았다. 매1초마다 발생하는 timer 문제라고 단정하지 않는다.

앞으로 이 Windows 후속 작업은 **코드를 읽어 잘못된 경로를 찾고, 관련 수정을 묶어서 구현한 다음, PowerShell로 조작·확인한다.** 자동 실행·장시간 계측을 반복하면서 원인을 찾는 방식을 기본 순서로 삼지 않는다. Computer Use/CUA/sky로 앱을 조작하지 않는다.

이 문서는 work10의 Windows W10-00/06/07에 대한 현재 실행 계획이다. work10의 데이터 공유·소유권 계약과 §8의 잔여 의무는 유지한다. work10 전체를 종료하거나 이미 구현한 W10-01–05를 처음부터 다시 만들지 않는다. **이번 요청은 계획 작성이며, 이 문서 작성 중 제품 코드 수정·빌드·앱 실행·입력 주입은 하지 않았다.**

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

계획상 실행 파일은 `Nelyx/eng/check-windows-scroll.ps1`이다. **현재 존재하거나 구현 완료한 스크립트가 아니다.** 필요한 helper는 최소한의 `Add-Type` C#/Win32/UI Automation으로 구성하며 Computer Use를 호출하지 않는다.

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
- [ ] W10A1-00 상세 코드 감사로 첫 수정 묶음과 보존할 불변식을 확정했다.
- [ ] W10A1-01–04에서 실제 원인에 해당하는 수정과 소비자 연결을 구현했다.
- [ ] W10A1-05 PowerShell 조작·bounded 수집 경로를 구성했다.
- [ ] W10A1-06 현재 공급의 Windows 기능·성능·수명 결과를 기록했다.
- [ ] 사용자가 실제 트랙패드의 주기적 멈춤 제거를 확인했다.

**정확한 다음 작업:** W10A1-00부터 현재 diff와 `host.cpp`의 precision→Core 진입·App/Content loop, `host.ts`의 Source/게시 fence, 목록 demand·native 준비/회수·Render 게시를 소스에서 연결한다. 확인된 원인의 첫 코드 수정 묶음을 만들고 그 뒤 PowerShell 확인을 진행한다. 이번 계획 작성으로 새 엔진 수정이나 성능 개선을 완료했다고 기록하지 않는다.
