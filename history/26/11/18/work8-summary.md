# 달력 동작을 유지한 Ink 및 렌더 트리 비용 개선

원문 `work8.md` · 작성·실행 2026-11-18 KST · 설계 `d6cfa40e` · 실행 기준 `129f1bae` · 보관 11-20 · 원문 스냅샷 `ffe5c5a2`

**초기 Core 후보 2건 미채택 · 후속 Ink·렌더 수명 구현 · `performanceAccepted=false`**. 기존 월 갱신과 날짜 전체의 생성 시점을 보존했다. [W7 생성·갱신 기준](work7-summary.md)

- layout 변경 허용 조상의 탐색과 render 자식 동기화는 실제 경로를 계측했다. 고정된 3월 첫 노출에서 권한 검사 전체는 첫 Scene 40.840ms 중 0.262ms였다. 반복 탐색과 목록 비교는 있었지만 긴 프레임에 대한 실익이 작아 두 후보를 제품에 적용하지 않았다.
- Material Ink는 그릴 효과를 실제로 쓸 때 컨트롤러를 조회하고 유휴 추적 컬렉션은 지연 생성한다. 3월 첫 노출에서 `Material.of`는 93 → 31회, 기존 월 중간점에서는 121 → 0회였다. Node 6쌍의 cold build+layout 중앙값은 26.13 → 23.38ms였다. Windows 순차 비교에서는 빠른 역방향 입력→surface p95 중앙값이 414.55 → 463.20ms였다. [잉크 구현](../../../../packages/material/src/ink-well.ts)
- Core는 연결·회수 상태를 `PipelineOwner`와 각 `RenderObject`에 저장한다. 입력 좌표 작업이 있는 가지의 변경만 상위에 전파한다. 3월 첫 노출에서 렌더 객체 368개를 그대로 연결하면서 기존 전역 컬렉션 연산 3,683회를 제거했다. 실패한 분리 훅, 파이프라인 이동·복구를 확인했다. [Core 렌더 수명](../../../../Nelyx/src/framework/rendering/object.ts)
- Core 교체 전후 순차 3회에서 빠른 역방향 표시 FPS 하한 중앙값은 18.081 → 20.628, 100ms 이상 표시 정체는 8·6·9 → 7·8·8회였다. 최종 Gallery·Testbed 가변 목록 각 1회는 100ms 이상 정체 0회였고 공급 및 일반 Demo 정상 종료를 확인했다.

## Flutter와의 실제 화면 비교

당시 `check-windows-calendar-content.mjs`의 날짜 픽셀 관측에서 빠른 역방향의 초당 내용 변화는 Nelyx 21.00, Flutter release 60.49였다. 100ms 이상 간격은 Nelyx 6회, Flutter 0회였으며 정착 이동량은 각각 −6개월과 −10개월이었다. 동일 가상 입력에서도 스크롤 물리와 런타임이 달라 FPS 차이를 개별 구현에 귀속할 수 없다. 패널 scanout·물리 트랙패드는 미검증이다. [일반 스크롤 후속](work9-summary.md)
