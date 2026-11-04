# 공통 엔진 비용 검토와 스크롤 작업 종료 요약

원문: 루트 `work2.md` · 작성·종료: **2026-11-02 KST** · 보관: **2026-11-04 KST**

상태: **CLOSED / SUPERSEDED BY work3 · 성능 PARTIAL**. 공통 비용 후보는 구현·회귀 검사 상태로 남았으며 지속 60fps 기준을 충족한 최종 성능 채택은 아니다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 트랙패드·실제 한국어 IME·scanout **notVerified**를 유지한다. 이번 보관은 문서 검증만 수행했다.

## 이어받은 목표와 구현

[선행 스크롤 계획](../../10/30/scroll-engine-summary.md)의 잔여 P0~P7을 이어받아 평균보다 입력 후 움직임·tail·전체 범위 왕복을 중시했다. 원문 §4의 기준은 **현재 모니터 설정과 사용자의 일반 RNW 명령에서 지속 60fps**이며, direct native 진단·좁은 packet 반전·기능 회귀를 제품 성능 수락으로 대체하지 않는다.

- Doroti의 공통 엔진 개선을 검토하고 Widget 생명주기·의존성·할당·recording·입력 반복 준비를 우선 분석했다. 다중 자식 KeyMap의 생성을 첫 key까지 늦추되 검증 순서·사용자 equality/hash·GlobalKey·실패 cleanup을 유지했다.
- 내부 소유 Path snapshot·wire record와 resource 없는 draw/clip/shadow 명령, captured resource key·고유 resource 목록을 재사용했다. 외부 getter·mutable 값·독립 resource hold·실패 cleanup은 보수 경로를 유지했다.
- transform만 변한 private recording의 연결을 유지하고, 중첩 scope·boundary·동일 annotation 재사용까지 확장했다. Picture 내부 transform·외부 accessor·충돌·custom 변경은 기존 planning을 사용한다. recording metadata는 구조 변경·빈 root·disposal 때 해제한다.
- 기본 MouseRegion·신호 callback 없는 Listener의 wheel no-op dispatch를 줄였다. 실제 callback·legacy handler·사용자 getter와 좌표 의미는 유지했다.
- 정상 native close 뒤 늦은 React semantics packet이 닫힌 JS platform을 빌리던 오류는 close 시작 시 peer를 퇴역시키는 방식으로 수정했다.
- FPS 계산과 RNW 진단을 보강했다. 실제 이동 시간·copied content, 입력 dispatch·callback·microtask 간격, native worker 세부 구간을 구분하며 독립 GPU 시간이나 GC CPU로 환산하지 않았다.

## 평가·철회

| 후보 | 결과 |
| --- | --- |
| Path/recording 재사용 등 공통 후보 | callback당 할당 감소는 관찰했지만 surface FPS 개선은 불일관. **성능 미수락 후보**로 work3에 이관 |
| Layer 제거 슬롯·별도 composition planning cache | 일반 RNW 순이득이 불명확해 철회 |
| input geometry 기본 visitor의 반복문 처리 | 일반 RNW **44.58/41.99 surface FPS**, 이득 없어 원복 |
| compiler inlining·CFG 변형·frontend 변경 | 개선 불충분, 기존 `windows-hermes-94aa5e1d-no-cfg-v1` 복구 |
| clock·credit·queue/cache 예산 확대 | 관찰 근거 없어 변경하지 않음 |

최종 일반 제품은 2560×1459 physical / DPI 192에서 mixed focus 두 10초 구간 **45.59 / 41.48 surface FPS**, Gallery 좌 **55.17 / 51.54**, 우 **50.28 / 51.36**이었다. source probe·상세 로그·GDI capture를 끈 관찰이지만 **좁은 packet 반전**이며 전체 범위·3쌍 성능 수락 비교는 아니다. 모두 정상 종료했어도 60fps에는 미달했다.

최대화·창 전환·GDI 관찰을 추가한 Gallery 우열 검사는 선택 픽셀 영역 최대 **751.40ms 정지로 FAIL**이었다. 전체 surface 정지와 영역 정지의 원인은 당시 미분리였으며 기본 창 4페이지 통과로 이 실패를 덮지 않았다.

## 당시 기능·플랫폼 검증

- 일반 제품에서 Unicode 문자열 입력→메시지 12까지 전체 OS wheel 이동→첫 행 복귀→재클릭 없는 후속 입력→전송·횟수·최소화/복원·초기화를 확인했다. **Unicode 삽입은 실제 한국어 IME 조합 검증이 아니다.**
- 기본 크기의 Material·ListView·Cupertino·mixed 4페이지 OS wheel/close·native drain은 통과했다. hide **1.75~2.16ms**, close **181.88~272.36ms**는 해당 기능 실행의 관찰값이다.
- 공통 회귀는 scroll engine **290/290**, Windows animation **28/28**, native paint replay **69/69**, Windows semantics **12/12**, RNW/FPS **29/29**, 공급 **6/6**, 타입 검사와 delivered shadow/DPR를 통과했다. 묶음 간 검사를 합산하지 않는다.
- 최종 공통 Core의 Chrome catalog 49개·route/상태 검사를 통과했다. Android의 private Skia 헤더 요구를 Windows 경로로 한정한 뒤 Temurin 21.0.11로 Release/x86_64 APK를 재빌드하고 API 30 에뮬레이터의 편집·전체 왕복·Home/복원·Back을 확인했다. 물리 입력·플랫폼 성능·IME 수락으로 확대하지 않았다.

## 종료 공급과 잔여 범위

Hermes bytecode / optimized / Release, HBC 99, 기존 compiler policy를 유지했다. 당시 일반 manifest는 `e40950929ba44af59fa70c2bfcb1503e0f5040667b457c48cb5bfbcce4de98dd`, native inputs는 `264631e86c363796511abc2d6de4920050c32cea3ef8b2b73c8a6ebacb81badd`, SDK inputs는 `91800de8aefc10219e276c2bf1d7c56d1e07f96a22046e413058de068a5cbcca`였다. 현재 실행 제품을 재인증한 값이 아니다.

Picture **64-entry/32MiB**, optional child **16/Element 2,048**, Gallery capacity **2**, CPU pending **1/native recording 2**를 유지했다. 실행 소유 임시 산출물·앱·검증용 emulator는 정리하고 기존 emulator-5554와 사용자 cache는 보존했다.

지속 60fps 미달·최대화 liveness 실패·C++ geometry/publication 후보·공급 정합성과 실제 IME/물리 수락은 [work3](work3-summary.md)으로 이관했다. 종료된 P0~P7의 미체크 항목은 새 작업 지시가 아니다.

[이력 목록](../../../README.md) · [선행 Flutter·스크롤 계획](../../10/30/scroll-engine-summary.md) · [다음: C++ 구현·평가](work3-summary.md)
