# Windows Static AOT 연속 스크롤 원인 조사 요약

원문: `research.md` · 기준일: 2026-10-23 KST · checkout: `7a6be8f9` · 아카이브: 2026-10-27 KST

상태: **원인 조사·검증 보완 제안**. 이 조사에서 제품/실행 스크립트를 수정하거나 성능 개선을 수락하지 않았다.

## 결론과 증거

가장 강한 원인은 lazy 경계에서 새 Widget/Element/RenderObject를 동기 생성·layout하고 새 문단을 측정한 뒤 이전 항목을 해제하는 작업이었다. 기존 트리를 움직이는 indicator/route와 새 트리를 계속 요구하는 긴 스크롤의 비용은 달랐다. Static AOT에서도 대부분의 body는 동적 JS 의미를 유지하므로 이 객체·호출 비용이 남는다.

실제 Core pan 진단의 80px ×24회 이동에서 프레임마다 Element74개 생성·74개 해제를 관찰했다. 작은 왕복/전진/역방향 revisit의 CPU frame p95는 **3.018/16.773/12.096ms**였다. 이는 **Node V8 + CanvasKit의 계측 CPU 결과**이며 Windows Static AOT·물리 트랙패드·표시 시간 측정이 아니다.

갤러리는 개별 row보다 큰 section 전체가 lazy 생성 단위였고 text/style snapshot·문단 생성 비용이 반복됐다. 가변 높이 보정·연속 입력 mailbox·precision 접촉/관성/fallback의 기여 가능성은 확인했지만 native 원인별 시간이나 물리 끊김의 비중은 확정하지 않았다.

## 기존 검사의 공백

`list-warm`은 신규 mount/unmount0을 요구하는 작은 왕복이고, 먼 위치 검사는 `jumpTo` 사이에 대기/drain을 넣었다. 따라서 **새 항목 진입/퇴장 + 연속 입력 + frame deadline**이 겹치는 사용자의 흐름을 수락하지 못했다.

## 후속 우선순위

1. 고정80px ListView와 전체 Material/Cupertino 갤러리에서 여러 viewport를 연속 통과하고 역방향·revisit·최대화·속도/delta 분포를 나눠 검증한다. mount/unmount·실제 수신량·부호/절대 거리·누락을 확인한다.
2. mount/unmount·문단 miss·retained별 시간과 lazy build/finalizeTree를 분리하고 native input→offset→matching surface→실제 표시를 구별한다. 평균으로 entry spike를 희석하지 않는다.
3. subtree 생성/해제·inherited/theme·attach/reconcile·text/style snapshot을 실제 native에서 attribution하고 재사용 owner·해제 정책과 함께 줄인다.
4. section 작업 단위·제한된 보존·사전 준비는 같은 cold/revisit 부하·memory·최장 정지를 함께 비교한다. 입력 생략이나 검사 부하 변경으로 개선을 만들지 않는다.
5. 물리 precision·높이 correction·GPU/driver/import와 GC pause 기여는 별도로 확인한다. 각 검증은20분 timeout과 실행별 임시 정리를 따른다.

당시 실행본의 접근성 설정은false였으므로 증상을 접근성 비용만으로 설명하지 않았다. 접근성 on 구성의 semantics 비용, 실제 FPS·물리 입력·GC와 끊김의 직접 대응은 **notVerified**다. 이후 W18에서는 목적과 owner가 설명되는 메모리 보유를 허용하는 정책으로 발전했다.

[전체 이력](../../../README.md) · [W15A 당시 native 비교](work15a-summary.md) · [W16 엔진 개편](../24/work16-summary.md) · [W18](../25/work18-summary.md)
