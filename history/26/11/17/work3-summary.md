# Hermes 객체·descriptor 비용 선별과 게시 계약

원문 `work3.md` · 작성·실행 2026-11-17 KST · 보관 11-20 · 원문 스냅샷 `ffe5c5a2`

**H3-00 PASS · H3-01 선별 종료 · H3-02/03 미착수 · PARTIAL · `performanceAccepted=false`**. Hermes factory와 일반 제품 기준선을 확인했고, 유효 달력 3회에서 전체 목표가 미달했다. [이전 JSC 진단 및 공급 경계](work2-summary.md)

## 보류한 성능 후보

- 후보 A는 작은 WidgetState 집합의 내부 표현 특수화다. 진단에서 실제 제거 가능한 비용을 확정하지 못해 DartSet·WidgetState adapter·생성 달력 코드를 바꾸지 않았다.
- 후보 B는 Hermes 불변 descriptor 해석의 재사용이다. 직접 측정한 후보 구역이 작았다. 후속 `GetById` accessor 탐색과 `executeCall0` getter 재진입도 계측했지만 15% 선별선을 지지할 제거 가능 비용을 확보하지 못했다. cache·호출 프레임 변경은 보류했다. clock 계측이 CPU와 프레임 길이에 영향을 줘 진단 FPS는 일반 표본과 비교하지 않았다.
- 후보 C인 큰 닫힌 실행 구역의 typed AOT 역시 조건부 상태였다. A/B 적용이나 성능 A/B 비교는 수행하지 않았다. 진단·실패 차단 회귀를 보존하고 일반 Hermes 공급을 복원했다.

## 큰 구조 검토와 S0 구현

단일 live tree에서 동기 build/layout을 중간 반환하면 게시된 hit test, focus, key, geometry를 바꿀 수 있다. 고립된 준비 세대와 원자적 게시를 별도로 검토했다. [구조안과 S0 계약](work4-summary.md)

`FrameworkRoot`의 준비 프레임에 원래 `FrameBuildToken`을 보존해 View ID·세대와 입력 sequence·timestamp를 조기 재사용 자격에서 확인했다. 실제 AppSession·ViewRuntime·FrameworkRoot를 연결한 당시의 `check-frame-publication.mjs`에서 foreign View generation이 조기 자격을 통과하던 경우를 재현하고 수정 후 통과시켰다. 렌더러 직전의 owner 검사도 당시 존재했다. S0 동기 계약의 Source 검증까지 진행했으며 해당 문서 시점의 세대 격리와 분할 생산은 미구현이었다. [후속 분할 준비](work5-summary.md)
