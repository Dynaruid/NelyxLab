# Windows C++ scroll 입력·프레임 재개·pointer·section 수명 요약

원문: 루트 `work7.md` · 최초 분석: **2026-11-03 KST** · 계획 재작성·구현: **2026-11-04 KST** · 보관: **2026-11-04 KST**

상태: **PARTIAL / scroll starvation 수정·자동 회귀 scoped-pass / 수정 후 물리 재확인 대기 / NO_ADOPTION / 60fps 미수락**. `performanceAccepted=false`, `resizePerformanceAccepted=false`를 유지한다. 아래의 최종 상태는 **원문 §11.9**이며 앞선 자동 wheel 통과로 사용자 물리 실패를 덮지 않는다. 이번 보관에서는 문서만 검증했다.

## 목표·구현과 자원 한도

사용자는 [work6](../03/work6-summary.md)의 C++ 구현 후에도 노트북 두 손가락 스크롤이 버벅인다고 보고했다. 숫자 kernel에 한정하지 않고 입력 생산/배치·native 완료 재개·지원되는 pointer 질의·bounded section 보존/준비 결정을 native에 연결했다. Widget/Element·사용자 callback·공개 framework 의미는 TS에 남긴다.

| 모듈 | 실제 구현 범위 |
| --- | --- |
| W7-P1 `scroll-input` | WindowsScrollCoordinator가 기존 compositor clock을 공유하고 활성 DirectManipulation 입력을 render/GPU 수요와 독립 poll. protocol 2 batch·packet별 callback/ACK·boundary flush·세대 검증 |
| W7-P2 `scroll-frame` | 실제 GPU retirement/recording slot credit으로 pending frame을 깨우고 JS mailbox·native 입력 경계를 확인해 재제출. credit wake에서 animation/옛 deadline 재사용 안 함 |
| W7-H `pointer-targets` | v2 `linear-prefix`: 순수 표준 단일 자식 ancestor 2~32개의 bounds/translation/transform을 native 계산 후 live TS boundary/self hook을 원래 순서로 실행 |
| W7-L `section-lifetime` | 기존 ViewWorkBudget·Element 실제 반환 회계에 native retain/evict/prepare 결정을 연결. optional row만 같은 layout scope에서 퇴출 |

`scroll`은 네 후보, `all`은 기존 후보와 네 후보를 선택한다. capability·실제 선택·독립 native/SDK 수와 close를 검증한다. P1 실제 contact는 OS wheel로 대체하지 않으며 L의 **prepare 0**은 준비 효과 미관찰이다.

원문 §3.3의 기존 상한을 유지했다. **공유 미소비 입력 256 packets, CPU pending 1/native recording 2**, 기존 optional Element 회계·Picture/cache 예산을 늘리지 않았다. Pointer 숫자 저장은 **16 trees×128 nodes/depth 32**, v2 prefix 최대 ancestor 32+TS boundary 1이며, native에 callback·RenderObject·GPU 자원 cache를 보관하지 않는다. root 보유는 WeakMap과 숫자 LRU로 제한했다.

## 구현과 실행 검증

첫 통합 공급은 Mixed 입력/한글을 통과했어도 Gallery 복귀 gap **1,000.6751/653.9973ms**로 350ms gate에 실패했다. 일반 wheel의 동기 dispatch는 기존 frame mailbox로 돌리고 실제 panZoom batch의 packet별 callback은 유지했다. H v1은 낮은 지원률·입력 구간 native work 0 때문에 성능 후보로 수락하지 않았다.

H v2는 custom/branch 뒤를 미리 읽지 않는 prefix로 범위를 줄였다. Bounds miss는 원래 TS traversal로 돌아가 one-product cache/self-hook 순서를 보존한다. Proxy 좌표는 descriptor trap을 읽기 전에 TS fallback하며 직접 만든 numeric point만 weak provenance marker로 native 지원을 증명한다. 실제 C++ differential은 callback 중 point/behavior/sibling 변경·getter/prototype·signed zero·overflow·원래 transform 참조를 검사했다.

UIA 전환 실패는 초기 Invoke 오류 해석을 정정했다. 실제 예외는 전환 뒤 `FocusedElement` 질의였으며, mounted 동안 weak root를 기억해 같은 살아 있는 canvas/island와 focus owner 조건에서만 반환하는 보완을 했다. 후속 owners에서는 재현되지 않았으나 일반적 해결로 확정하지 않는다. 앞선 L full-range coverage 실패도 후속 통과로 원인 해결을 선언하지 않았다.

좌표 provenance 수정 공급의 동일 package 3쌍 비교는 9 fresh owners의 전체 coverage·SDK/native 정리를 통과했다(2560×1459/DPI 192, Release Hermes bytecode/optimized).

| 모드 | primary 평균 surface FPS | secondary 평균 surface FPS | 입력 구간 판정 |
| --- | ---: | ---: | --- |
| TS control | 52.10 | 42.86 | 후보 off |
| pointer-targets | 43.06 | 33.84 | 6/6 legs 실제 prefix 작업, 총경로는 느림 |
| scroll | 45.72 | 35.25 | P2/H/L 관측, P1 contact 0. `FAIL_NO_NATIVE_WORK_IN_SOME_LEGS` |

이 공급의 TS/H/통합 기능 owners는 Gallery→Mixed 12 fields/36 buttons·재클릭 없는 입력·한글 IME/undo→Gallery 복귀·정상 종료를 통과했다. all 기능 owner도 기존 모듈·P2/H/L의 독립 native/SDK 집계·회수를 통과했으나 **수동 counters-only**, P1 notObserved였다. 위 표는 **이후 watermark 수정 전 공급**의 수치이며 최종 수정 공급의 성능으로 승계하지 않는다.

## 사용자 물리 FAIL과 입력 대기 범위 수정 — 원문 §11.9

사용자가 `--module=scroll`에서 **손가락을 움직이는 동안 반영되지 않고 손을 떼어야 스크롤이 들어간다**고 보고했다. 해당 공급의 물리 입력 결과는 **FAIL**이다.

회귀 검사에서 P2가 staged/sealed native 입력 전체가 비워질 때까지 제출을 미루어, 연속 producer가 새 packet을 계속 만들면 이전 ACK 뒤에도 frame 입장이 막히는 starvation을 재현했다. 수정 전 이 검사에서는 제출 0이었다.

수정은 **native 수신 serial watermark**를 capture하고 실제 대기 시작 범위를 GPU busy·CPU frame 교체 중에도 유지하는 것이다. 해당 범위가 ACK되면 더 새로운 packet이 남아도 최신 JS 입력을 drain/반영한 frame을 제출하고, 실제 accepted 때 watermark를 해제한다. 경계를 걸친 batch는 전체 ACK를 기다리며 staged packet도 capture 범위에 포함한다. 입력 순서·callback·ACK와 기존 큐/recording 상한은 유지한다.

선택 경로는 `inputAdmissionVersion=1`, `captureInputWatermark`, `hasPendingInputThrough` capability를 요구해 구 공급을 거부한다. staged/sealed·경계 batch·복수 view·partial seal·late ACK와 queue가 계속 차 있어도 frame이 진행하는 회귀가 통과했다. **native-scroll 58, native Engine 11, input geometry 2, retained/activation 7, startup/mode 5**, 타입·lint를 통과했다. 묶음 간 중복을 합산하지 않는다.

수정 manual scroll package의 실제 기능 owner 1개도 Gallery→Mixed 입력/IME→Gallery 복귀를 통과했다. 최대 gap **129.2093ms**, P2 실제 credit 제출 **95**, H queries/visits **12,429/37,287**, L 실제 retain/evict/prepare **69/13/0**, native/SDK 일치·모든 pending/mailbox/subscription 0·native drain·forced=false·exit 0이었다. 그러나 **P1 contact 0/notObserved, blockedInput=0**이므로 이 OS-wheel owner는 물리 접촉 중 starvation 해소 증거가 아니다. **수정 후 물리 재확인은 대기 중**이다.

## 최종 공급·정리와 다음 확인

| watermark 수정 후 공급 | SHA-256 |
| --- | --- |
| manual scroll manifest | `f3c26f50346b0203b5fe5fd9e0e62fc1a551db4fc7b1512394b3cebd26c9c5f4` |
| 복구한 일반 manifest | `0a6f152e2e7c28302eda5f74980b3599b37eaba3291a70cba9253737ffe9ea29` |
| 공통 EXE | `3351f8580368dbb00819f073db5b50fd7dd1d49bd1eb6a8e68a288a46faa56f6` |
| SDK inputs | `3ded3d59679d73344610ef34c2bde18635a1c65e43cad65227245e894a442d76` |
| native inputs | `85c636cbb66186e82285147b8b5aa9b8d23c2ff46108419c41a9bdc28706f1da` |

source-map inventory·설치 fingerprint·archive/lock integrity, native 공급 **1,795 files**·compiled inventory·runtime·SDK/App 입력을 대조했다. 일반 명령 `npm.cmd run run:windows --workspace @nelyx/testbed-2`로 원래 App을 실제 재빌드·실행해 TS/Scene·Semantics false/sceneBatch none, 응답하는 창·정상 exit 0을 확인했다. App/config diff 0·임시 fixture/staging/소유 process 0, 현재 archive 9개·Release 하나를 유지했다.

원문 §11.4의 중간 native 캐시 두 개는 당시 자동 승인 검토가 **blocked by policy**로 삭제를 거부해 보존했다. `sample/nelyx-testbed-app-2/.nelyx/windows-native/` 바로 아래의 `870db316ea43a53cba5c4896cd214d63423f4d6c6b311c7a219fda1206c3fc2c`, `b4052d41ede5db8c6f4748568ce51fd42b0439250392182f535946433e0c6e0f`이며 이번 문서 보관에서 삭제하지 않았다.

남은 확인은 **같은 `npm.cmd run run:windows:cpp -- --module=scroll`의 실제 두 손가락 접촉 중 갱신·반전·관성·재접촉과 체감**, 일반 사용 60fps·scanout·resize다. Android/Web runtime 수락도 추가하지 않았다. **NO_ADOPTION·제품 PARTIAL·물리 재확인 대기**를 유지하며 다음 설계인 루트 `work8.md`의 검토가 이 잔여 작업의 완료를 뜻하지 않는다.

[이력 목록](../../../README.md) · [선행 전체 구간·N1~N4](../03/work6-summary.md) · [후속 설계](../../../../work8.md)
