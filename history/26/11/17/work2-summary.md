# Windows 스크롤 자식 수명과 JSC 실행 비교

원문 `work2.md` · 작성·실행 2026-11-17 KST · 보관 11-20 · 원문 스냅샷 `ffe5c5a2`

**PAUSED / PARTIAL · `performanceAccepted=false`**. 원문은 사용자 중간 마무리 요청 시점의 범위와 자동 재개 금지를 기록했다. 최종 일반 설치 제품은 기존 Hermes였으며 새 JSC 공통 factory·CLI는 Source 작성 단계였다.

## 자식 수명과 Core 변경

- 실제 달력 월에는 일반 `GlobalKey`가 각 5개 있었고, 월별 Element 898~1,017개·State 247~281개가 관측됐다. 보존 자격 통과는 0이었다. 일반 키의 재취득, gesture, 접근성 소유권을 보존하는 계약이 필요해 dormant 월, 새 delegate 세대 API, 실제 달력 opt-in을 보류했다.
- 진단에서 owner 등록 중복 제거는 이미 작동했다. 해당 계열보다 mount, 첫/후속 rebuild와 회수의 누적 부담이 컸다. 중첩 시간의 합을 전체 CPU 비율로 사용하지 않았다.
- Inherited 조상 조회와 최초 RenderObject 설정의 중복을 줄였다. 그리지 않는 Ink의 조상 변환도 생략했다. 각각의 국소 회귀를 확인했으나 달력 전체 목표는 미달했다. 기본 Material 지역화 소유 후보는 3회 비교에서 기준을 충족하지 못해 철회하고 일반 공급을 복원했다. [직전 원인 분석](performance-cause-analysis-summary.md)

## JSC direct host 진단과 중단 지점

같은 앱 JS와 renderer, 48/30/60개 가상 터치 및 같은 월 정착으로 세 모드를 각 3회 비교했다. desktop FPS 하한 중앙값은 다음과 같다.

| 실행 모드 | 보통 정방향 | 빠른 정방향 | 빠른 역방향 |
| --- | ---: | ---: | ---: |
| Hermes | 29.160 | 26.230 | 22.373 |
| JSC interpreter | 11.476 | 15.703 | 8.693 |
| JSC JIT 허용 | 39.934 | 43.889 | 37.566 |

- JIT 허용은 매 실행·입력 구간에서 엔진과 표시 하한 30 FPS를 충족했다. 100ms 이상 표시 정체의 중앙값은 Hermes 8 / 4 / 7회에서 JIT 3 / 1 / 2회로 감소했다. 이 진단 공급의 달력과 native boundary·Gallery·Testbed 기능은 **PASS-scoped**였다. Interpreter는 성능 기준을 통과하지 못했다.
- 이후 공통 C++ factory에 Hermes/JSC와 DLL 수명을 분리하고 native CLI의 명시적 엔진·모드 선택을 연결했다. 초기 JSC 공급 생성은 성공했으나 verifier가 이후 바뀌었다. 새 C++ compile/link/run, 최종 공급 및 설치, CLI 전체 타입·패키징과 같은 조건의 성능은 미검증이다. JS runner 정책 32개 사례까지 통과했다. workspace SDK·CLI와 당시 설치본은 서로 다른 공급이었다.
- 앞선 JIT 판정은 진단 host 공급에 한정한다. 물리 입력·scanout·스크린 리더·장시간 자원은 미수락이다. 이후 Hermes 분석은 별도 과제로 기록했다. [Hermes 후보 선별](work3-summary.md)
