# Work10-a1 — Windows 트랙패드 정체·Source/페이지 준비 개편 요약

원문: 루트 `work10-a1.md` · 작성: **2026-11-11 KST** · 구현/검증: **11-11~12** · 후속·중간 마무리: **11-13** · 보관: **2026-11-13 KST**

상태: **PAUSED / PARTIAL**. [Work10](work10-summary.md)의 Windows W10-00/06/07 실행 후속이며 데이터 소유권과 [W10-R01~08](work10-summary.md#work9-잔여-의무-이관)을 유지한다. 11월 13~14일 후속/당시 공급은 [work11 요약](../14/work11-summary.md)에 있으며, 후속도 11월 14일 STOPPED로 중단·보관해 자동 재개하지 않는다.

## 조사·실행 계약

사용자는 재빌드 후 트랙패드 이동 중 **약 1초 내외 정체**를 보고했다. 지속시간 보고와 발생 간격·timer 원인을 구분하고 **소스 분석→확인한 원인/소비자 수정 묶음→PowerShell Windows 통합 확인** 순서로 진행했다.

대상은 App SDK 일반 CLI와 공통 TS/Core/native 경로다. PowerShell/C#/Win32/UIA를 사용하고 CUA/Computer Use로 조작하지 않았다. OS wheel/drag·주입 precision과 **사용자 실제 DirectManipulation 입력**을 분리한다. JSI·원래 TS Widget/State/controller/callback·Core layout/input/scroll 권위·owner·200ms animation·coverage/ACK/publication·GPU/lease fence를 유지하며 게시 대기 무조건 해제·stale 무시·무한 page cache는 해법으로 쓰지 않았다.

## 11월 11일 첫 수정과 남은 정지

- Windows Render가 mutex 안에서 전체 frame wire를 직렬화한 뒤 버리던 경로를 **불변 native reader + 작은 state**로 대체했다. 동일 admission·ledger·실패 rollback과 C/JS wire는 유지했다.
- UI interaction snapshot/cohort 재사용·뒤늦은 matching Prepared, App ready mailbox 우선 처리·service batch, 수평 precision velocity, Source build/transaction/ACK 문서 fence를 연결했다.
- Coverage 부족 중 접수 거리를 한 viewport target으로 덮어쓰던 결함은 **scalar deferredContactDelta**로 보존했다. 준비 창/입력 큐를 늘리지 않고 lift·반전·cancel·유한 extent를 검사했다.
- 역할별 layout/publication 관찰, PageView delegate와 NativeList geometry/child generation 분리, typed 역방향 의존성·동기 invalidation 합침·공유 관찰 index·내부 Scene 구성·pinned VM native async를 추가했다.

첫 최종 60Hz/6초의 12개월은 **362개 접수·소비/거부0**·선택/resize/close PASS지만 게시 gap **575.537ms / ≥500ms 3회**였다. 넓은 개편 뒤에도 게시 **563.731ms**, offset **617.656ms**, App turn **520.091ms**로 **syntheticStallGoal=FAIL**이다. Core/GPU 개별 호출보다 큰 Source build/capture/scene과 왕복이 남았으며 GC pause 하나를 1초 정체의 확정 원인으로 세지 않았다.

## 11월 12일 데이터 공유·취소된 준비 복구

8개 기본 명령 template·바이트 비교 loop·실제 전송 시 handle 적용, DateTime의 private civil Date 재사용, Source 요청 소비/일치 자식 prefix 재사용을 연결했다. 이어 순수 Source payload snapshot을 capture/accepted command 입력에서 공유하되 **새 callback record는 항상 갱신**했다. 공개 mutable producer·accessor·실행형 reference는 보수적 경로를 유지하고 full bytes oracle·NACK/재시도·generation/event-policy·pinned Hermes로 검증했다.

속도를 개선하지 못한 압축 snapshot·field descriptor 초기화·page callback 경계 창 교체 실험은 철회했다. 일부 창 교체 후보는 offset 공백 **1,022.372ms**로 악화됐다. 채택한 payload 공유도 별도 12개월에서 **671.085ms** offset 공백이 남아 전체 정체 해결로 주장하지 않았다.

실제 트랙패드 뒤 월 이동/날짜 선택이 영구 정체된 기능 결함은 별도 수정했다.

1. 준비가 `superseded`로 취소돼 게시할 owner가 없는데 **accepted > published**만으로 기다리던 `waitForContent`를 수정했다. 실제 pending/preparation 또는 active 미게시 frame 대기는 유지한다.
2. 취소된 page 창을 in-flight로 남겨 대체 demand를 억제한 fence를 최신 accepted 관찰·transaction 상태에 한해 해제했다.
3. Precision release에서 빠진 기본 **8,000px/s fling 상한**을 적용했다. 접촉 delta/누적 거리와 release physics를 구분한다.

수정 전 실패하는 실제 Core/Source 회귀를 확인했고 사용자 물리 실행에서 **이동·선택 회복**, `recoveredCanceledWindows=1`, document=active=published **117**·입력 취소 **0**을 관측했다. 그러나 사용자는 **약 1초 멈춤 잔존**을 확인했다. 기능 회복과 성능 미해결은 별개다.

## PageView 논리 위치·실시간 contact와 coverage

빠른 접촉에서는 한 viewport target·4 viewport/s/2,400px/s catch-up·coverage에서 멈춘 spring clock·재접촉 target 되감기가 실제 진행 문턱이었다. PageSnapping의 **논리 requested**와 **coverage 안 표시 offset**을 분리해 접수 delta를 보존하고, 최신 목적지에 못 미쳐도 전진하는 완성 checkpoint를 활성화하며 논리-only 변화도 관찰 wake로 전달했다. Source 우선 게시 별도 pass/flag 실험은 효과가 없어 철회했다.

필수 visible 1/2페이지 처리만 settled PageView에도 적용한 초기 구현은 비동기 Source/Content에서 첫 delta에 움직일 이웃 픽셀이 없는 오류였다. 이를 **첫 page 게시 후 중심+양쪽 이웃의 3페이지**, 기존 **4페이지 상한** 내 contact-ready 준비로 보완했다. Coverage miss/먼 backlog는 필수 visible 1/2페이지부터 회복하며 최초 표시를 이웃 준비로 막지 않는다.

각 frame의 `consumedThrough`까지 누적 입력과 **실제 offset/draw transform**을 대조하는 회귀를 추가했다. 0.4/0.8페이지 왕복은 오차 **0.000001px 미만**이었으나 빠른 새 월은 준비를 앞질러 coverage edge 정체·최종 월 점프가 남았다. 게시 횟수만 늘어나는 것을 진행으로 보지 않도록 선행/후행 offset 공백도 포함하고 **게시 또는 offset 공백 ≥500ms이면 FAIL**로 도구를 보강했다.

과거 일반 CLI의 `exit1 / native mailbox closed`는 후속 오류로 최초 원인 미확정이다. 별도 수동 창의 30초 wrapper 정상 종료나 UIA helper 실패를 앱 크래시 재현/해결 근거로 혼용하지 않는다.

## 새 월 격자의 Source 왕복과 반복 할당 제거

원문 §24. Flutter 날짜 생성기의 실제 pin **`71e4717a61786faab4c7aa39825989305ed29e8a`**와 `_DayPickerGridDelegate.getLayout`을 대조했다. 7열·실제 viewport/문자 배율의 행 높이로 유한 날짜 자식이 모두 들어가는 **명시적 원본 delegate**만 기존 Core 숫자 layout program으로 연결했다.

- 원래 Widget/Element/State·Key/KeepAlive·callback/controller를 유지하면서 **격자 LayoutBuilder→행 ListView의 Source 왕복**을 없앴다. 일반 lazy/custom grid를 임의 일반화하지 않았다.
- GridView Element별 현재 숫자 program 1개와 독립·깊게 동결된 내부 payload를 공유한다. 공개 mutable producer나 과거 월/scene cache를 추가하지 않는다.
- ThemeData별 날짜 기본값/불변 Color/resolver를 재사용하되 **각 caller의 Theme.of 의존성은 매번 등록**한다. 상태별 해석 결과나 첫 Element/context를 cache하지 않는다.
- 기본 사각 scrollViewport에 원래 `Clip.hardEdge`를 전달했다. 축소 캡처의 날짜 앞자리 잘림은 원본 픽셀/확대로 정상임을 확인해 **재현 판정을 철회**했고 그 가정의 paragraph Picture 실험/진단도 제거했다. Hard-edge 수정은 실제 정책 정합성 수정이지 잘림 원인 해결 주장이 아니다.

## 최종 공급과 Windows 통합 검증

원문 §24.3. 최종 engine/source **`d900a3719162f865b9672ee7a2fd532a8e7790dc2514077965e5d29f90b321d9`**, ABI **2 / schema 313408118**, App JS **`3f1a0dab7a5dde419b06e3390509fe5be6d032221076ef6aaeec7564b024e045`**, HBC **`302c88e15d7f1e63ebcaf6168cd561c2d6101976af1e222dafd78e8fe23b0bfb`**다. Engine **356 files**·App **10 files**와 실행 owner를 대조했다. 이는 11월 13일 work11의 새 공급이 아니다.

| 최종 Windows 흐름 | 결과와 판정 한계 |
| --- | --- |
| Calendar 기능·픽셀 | 버튼/precision/OS drag 왕복·cancel·resize·2026-11-15 확정·close PASS. 활성 offset 공백 최대 **53/42/48/42/44ms**, 각 ≥100ms0. 초기/다음 월·첫 열 정상 픽셀 확인은 해당 장면 범위 |
| 양방향 0.4/0.8페이지 contact | 각600ms/36 updates, 서로 다른 offset 각 **35개**, 누적 delta 오차 **0.000001px 미만**, 수신→게시 최대 **26.336/17.441/17.947/19.010ms**. 하드웨어 latency/scanout은 아님 |
| 60Hz 연속 과거 12개월 | 6,000.416ms·입력 **362개 접수=소비/거부0**, 2026-11→2025-11·날짜 확정/close PASS. **Offset 공백279ms**, ≥100/250/500/1000ms **10/2/0/0**. 게시 gap **35.413ms**와 구분 |
| 빠른 재접촉 12회·과거 24개월 | 2,218.868ms·입력 **120개/거부0**, 2026-11→2024-11·확정/close PASS. **Offset 공백403ms**, 초과 횟수 **7/4/0/0**, 게시 gap **94.460ms**, 표시/논리 backlog 최대 **2,752px** |
| Source/owner 비용 | 연속/빠른 활성 App turn **364.554/362.271ms**, Core 개별 호출 **9.801/6.558ms**. 전체 Source build/capture/scene 최대 **198/150/177ms**, **178/91/153ms**는 서로 다른 구간일 수 있어 합산하지 않음 |
| 마지막 All의 범위 | 목록4구간 PASS 뒤 새 픽셀 검사 함수의 PowerShell 배열식 오류로 helper FAIL. 함수 수정 뒤 별도 Calendar PASS이며 **All 전체 PASS가 아님** |
| 종료 | 마지막 네 실행 ringLost/outputDropped **0**, exit/status **0**, reservedBytes/memoryTotal **0**, workersJoined **true**. 최근128 Source sample의 overwrite는 전체 무유실과 구분 |

원본 격자·날짜 기본값 oracle, native/Source·ACK/게시·취소/복구·page/child/notification·Hermes/배포 ESM·수명 회귀는 PASS다. 날짜 생성기 전체 `--check`는 당시 **Dart3.12.2 / analyzer 언어3.13** 차이로 미완료였고 adapter template/TS suffix·pinned SHA 확인으로 구분했다. [이후 work11](../14/work11-summary.md)의 생성기 PASS를 당시 결과로 소급하지 않는다. 전체 repository lint도 기존 생성 파일 경고와 구분한다.

## 잔여 판정·후속

최종 짧은 표본의 ≥500ms **0회**는 부분 목표 PASS일 뿐 **100~403ms 끊김·빠른 접촉 backlog·긴 Source build/capture/scene**은 남았다. `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 사용자 물리/연속 표시/scanout **notVerified**와 제품 **PARTIAL**을 유지한다. Android 최신 native 공급/실행·Web 제품 UI 검증으로 확대하지 않는다.

당시 후속은 필수 원본 Source 구성과 반복 capture/records의 처리량·demand→coverage 게시 인과였다. 제거한 격자 왕복·추가 cache/보간·fence 생략으로 우회하지 않는 계약이었다. 이후 work11의 Source/직접 투영·생성 helper/Hermes 공급을 거쳤으나 해결하지 못했고, 11월 14일 후속도 **STOPPED / PARTIAL**로 중단했다. [미완료·중단 경계](../14/work11-summary.md#미완료와-중단-경계)와 [후속 최종 공급](../14/work11-1-summary.md#최종-공급과-측정)을 보존한다.

검사는 당시 **20분 timeout**, bounded 수집·finally 회수를 사용했다. 승인 거부됐던 진단 폴더의 당시 잔존과 [이후 별도 정리](../14/work11-summary.md#후속-정리-이력)는 구분하며 이번 보관에서 재실행·새 검증 자료/공급 사본을 만들지 않았다.

[Work10 상위 계약·잔여 의무](work10-summary.md) · [work9 보관 목차](../05/work9-summary.md) · [이력 목록](../../../README.md)
