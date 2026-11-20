# 공통 슬리버 갱신과 달력 역방향 비용

원문 `work6.md` · 작성·실행 2026-11-18 KST · 기준선 `3c2b4335` · 보관 11-20 · 원문 스냅샷 `ffe5c5a2`

**W6-1~4 구현 및 검증 완료 · 부분 개선 · `performanceAccepted=false`**. 활성 구간 평균 30 FPS 이상과 100ms 이상 진행 정체 0회를 함께 판정했다. [선행 달력 준비 경로](../17/work5-summary.md)

- 활성 체인의 revision과 인덱스가 맞을 때 선행 자식을 재사용하고, 연속 삽입·회수를 자식 투영에 반영했다. 고정 extent·FillViewport·규칙 Grid는 같고 깨끗한 제약과 슬롯에 한해 기존 배치 결과를 재사용한다. dirty 자식, 사용자 정의 layout, 비연속 범위는 일반 경로를 사용한다. [슬리버 자식 조정](../../../../Nelyx/src/framework/widgets/sliver.ts)
- 단일 슬롯의 조정 배열 생성을 줄이고 규칙 타일의 불변 제약을 공유했다. `split` 준비의 방향·축·delegate·슬롯을 검사해 틀어진 세대를 취소한다. 당시 `check-child-reconciliation.mjs`에서 키 이동·retake·keep-alive·underflow·예외 후 복구와 콜백 순서를 확인했다.
- Windows의 `legacy`·`split` 전후에 각 3회 유효 표본을 얻었다. 달력 목표는 미달했다. 특히 `legacy` 빠른 역방향의 엔진 FPS 중앙값은 **20.45 → 17.63**이었다. Source, UIA·달력 옵션, 일반 Windows CLI, Testbed, Web을 별도로 확인했다.
- 진단 역방향에서 재진입한 여섯 월 모두 새 Element였다. 한 프레임은 layout 199.679ms 중 rebuild 배타 시간 142.840ms, 뒤이은 finalize 22.777ms를 기록했다. 같은 프레임의 Semantics 21.214ms 대부분은 flush였다. JS 노드 연결·분리 자체는 0.319ms이고 bridge 전달과 UI thread의 COM 수명은 다른 구간이다.
- 측정은 가상 터치, surface fence, desktop marker에 한정했다. 물리 트랙패드·scanout·COM provider 해제 시간·장시간 힙은 미검증이다. [부모 갱신 순서 후속](work7-summary.md)
