# Hermes 달력 분할 생산과 선택 실행

원문 `work5.md` · 작성·실행 2026-11-17 KST · 보관 11-20 · 원문 스냅샷 `ffe5c5a2`

**실제 날짜 선행 생산 PASS-scoped · 전체 성능 PARTIAL · `performanceAccepted=false`**. 기본은 `legacy`이며 `split`은 선택 실행이다. [선행 게시·격리 설계](work4-summary.md)

## 구현과 동작 범위

- 준비 단계의 GlobalKey 공개와 양방향 retake, Focus 획득, ticker 실행이 게시 트리와 섞이던 네 반례를 막았다. 분리 pipeline에서 취소·실패·닫기 시 준비 자원과 State를 회수하고, 필수 가시 영역은 같은 생산 cursor를 동기로 완결해 실제 부모 pipeline에서 layout 후 게시한다.
- View당 미게시 세대 1개, optional retained와 합산 Element 2,048개, 중첩 finite grid·고정 리스트당 자식 최대 64개를 사용했다. LayoutBuilder를 통한 추가 생산은 builder 호출 전에 거절하며, 작업 deadline을 관측할 수 없는 Web host는 선택 준비를 시작하지 않는다.
- 첫 진단은 필수 동기 완결 3회에 189.710ms가 들었고 실제 날짜 선행 생산이 없었다. 이후 `requestOptionalWork`를 CPU 프레임 요청에서 분리하고, GPU credit 또는 renderer retirement에서 다음 host tick을 예약했다. 예산을 일시 소진했을 때만 유한하게 재시도한다. [ViewRuntime](../../../../Nelyx/src/hosting/runtime.ts)
- 실제 Hermes 후속 진단에서 finite child **162개**를 선행 생산해 날짜까지 도달했다. 준비 4세대 중 게시 3회·취소 1회, 필수 동기 완결 1회 **8.174ms**, 종료 시 준비 세대·Element·producer hold 0이었다. 최대 slice 9.725ms와 원자 작업 8.379ms, 빠른 역방향의 필수 layout 최대 177.683ms가 남았다. 두 진단은 표시 관측을 끈 단일 실행들로, 3회씩의 제품 성능 비교는 미실행이었다.

## 기능 회귀와 실행 경로

Source의 게시·취소·복구, Windows Testbed 혼합 입력, Windows 기본 실행, Web의 legacy·opt-in 기능을 확인했다. 사용자가 제공한 간헐 종료 로그의 `null.hidden`은 semantics 조립 대상의 누락된 조상 geometry를 계산하도록 수정했다. Source에서 같은 예외를 재현한 뒤 20개 사례를 통과했고, Windows 선택 실행에서 가상 입력으로 달력 열기·선택·resize·정상 종료를 확인했다.

선택 실행은 `npm.cmd run run:windows:prepared --workspace @nelyx/demo` 또는 일반 명령 뒤 `-- --preparation split`이고, 기본 실행은 `npm.cmd run run:windows --workspace @nelyx/demo`다. [Demo 실행 설명](../../../../sample/nelyx-demo-app/README.ko.md) · [후속 슬리버 최적화](../18/work6-summary.md)
