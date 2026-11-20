# Windows Demo 컨트롤 경계와 정밀 트랙패드 갱신

원문 `work10.md` · 작성·실행 2026-11-19 KST · W9 기준 공급 `a7b891e3` · 보관 11-20 · 원문 스냅샷 `ffe5c5a2`

**Windows 구현·조건별 검증 완료 · `performanceAccepted=false` · `physicalInputAccepted=notVerified`**. 사용자가 물리 트랙패드로 왼쪽 열의 텍스트필드와 슬라이더를 지날 때 작은 끊김을 보고했다. 앞선 휠 측정에서는 필드 최초 mount와 재방문 paint가 별도 비용이었다. [W9 측정](../18/work9-summary.md)

## 반영한 변경과 확인 범위

- `RangeSlider` hover·overlay의 paint 갱신을 값·geometry·semantics 및 라벨 변경과 분리했다. 같은 기본 손잡이 상태의 hover 18개에서 layout 18 → 0회, 접근성 갱신 요청 36 → 0회였다. 사용자 정의 모양·커서, 값 표시기, 키보드·UIA·RTL·폰트 갱신도 확인했다. W9 대비 경계 실험에서 기본형과 사용자 정의형은 각각 2쌍·3쌍에서 두 주 지표가 함께 개선됐고 일부 여백에는 지연이 남았다. [RangeSlider 회귀](../../../../packages/material/eng/check-range-slider-hover.mjs)
- 정밀 트랙패드의 접촉 시작, 무스크롤 필드에서 상위로 전달되는 delta, 실제 내부 편집기 스크롤, 취소·재접촉을 확인했다. GC와 겹친 긴 Scene과 surface가 끝난 후 desktop 표식까지 발생한 간격이 둘 다 관측됐다. 합성 desktop의 GDI와 DXGI 관측을 대조했고 패널 scanout은 미측정이다.
- W9 대비 가상 접촉의 filled 필드 위·아래 경계는 p95와 30 FPS 초과 시간의 쌍별 기준을 충족했다. 휠 여백은 쌍별 기준 미달이었다. 사용자는 그 기본 Windows Demo에서 전반적인 개선을 느꼈다. 뒤이은 합성 수정으로 `LeaderLayer`가 있는 가지를 따라가게 바꿔 482개 레이어 fixture의 형제 링크 조회를 480 → 62회로 줄였다. 추가 표시 개선은 3쌍 중 1쌍에서만 두 지표가 함께 개선돼 체감 효과가 미확정이다. [레이어 합성](../../../../Nelyx/src/framework/rendering/layer.ts)

## 최종 공급의 60 FPS 관측

호스트 활성 갱신 타이머를 14 → 8ms로 줄이고 Text fields 카드의 머리말·버튼, filled, outlined를 독립 항목으로 생성했다. UIA 위치·크기를 보존했고 진단에서 16ms 입력의 첫 하강 Scene 최장이 두 쌍 각각 46.20 → 18.80ms, 48.69 → 21.57ms였다. 최종 제품 `src/index.ts`의 host는 `a560719f…`, HBC는 `147a8233…`였다. DXGI 콘텐츠 이동을 20개 스트로크씩 관측했다.

| 가상 입력 주기 | 평균 이동 FPS | 스트로크 하한 FPS | 표시 간격 p95 / 최장 |
| --- | ---: | ---: | ---: |
| 8ms (125Hz) | 75.32 | 67.19 | 19.44 / 54.48ms |
| 16ms (62.5Hz) | 58.11 | 53.98 | 30.47 / 56.12ms |

8ms 주기는 두 60 FPS 기준을 충족했고 16ms 주기는 미달했다. 물리 장치의 실제 입력 주기와 이 빌드의 접촉·감속·반전 결과는 미측정이다. 기본 16ms인 검사는 `-InputIntervalMs 8`로 125Hz 입력을 선택할 수 있다. [PowerShell 검사](../../../../sample/nelyx-demo-app/eng/test-all-components-scroll.ps1)
