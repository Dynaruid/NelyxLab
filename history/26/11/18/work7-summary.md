# 부모 위젯 갱신 순서와 달력 최초 배치

원문 `work7.md` · 작성·실행 2026-11-18 KST · 설계 `0b934a96` · 구현 기준 `471df5eb` · 보관 11-20 · 원문 스냅샷 `ffe5c5a2`

**구현·기능 회귀 완료 · 달력 성능 미수락**. 부모가 기존 자식에게 새 설정을 전달할 때의 관측 순서를 Flutter와 비교했다.

## 표준 Element 갱신

- 같은 활성 BuildScope에서 표준 자식의 `didUpdateWidget` / `updated` 이후 rebuild를 그 호출 안에서 진행한다. 두 형제는 각각 update → build → child 순을 밟는다. 중복 dirty·동일 Widget·재무효화, keyed 목록의 이동과 GlobalKey 재부착을 검사했다. 사용자 정의 Element, 다른 scope와 준비 중인 세대는 큐 경로를 사용한다. 실제 Hermes 128단은 인라인 깊이 32 이후 큐로 이어졌고 leaf identity를 보존했다. [Framework](../../../../Nelyx/src/framework/widgets/framework.ts)
- Sliver의 delegate 판단은 새 설정 적용 뒤에 이루어지며 기존 슬롯 갱신은 layout에서 한다. Flutter의 기존 슬롯 갱신 시점과 남은 차이다. 최초 render는 Semantics·MouseRegion·Listener·Padding·Center의 검토한 구성에서 동등한 초기 update를 생략한다. 다음 설정과 사용자 정의 hook은 정상 갱신한다.
- 당시 `check-calendar-interaction.mjs`에서 기존 59개 날짜의 Element·State·FocusNode를 보존했고 이탈 후 돌아온 월의 31개 날짜는 새로 생성됐다. 3월 최초 10% 노출 장면의 날짜 하위 render 생성은 279회로 같고, 초기 중복 update는 **248 → 0회**였다. 키보드 LTR/RTL, 클릭과 선택, locale·접근성, 재열기·취소를 확인했다. Node 첫 CPU Scene과 Flutter 테스트 pump는 각각 끝점과 런타임이 다르다.

## Windows 제품 범위

Legacy 달력의 변경 전후 각 3회에서 빠른 역방향 후보의 엔진 FPS·desktop 하한 중앙값은 **22.384 / 20.242**였다. 후보의 desktop 최장 간격은 193.065~320.255ms였다. Split은 전후 각 1회에서 준비·게시·취소·종료 회수를 확인했으나 성능을 수락하지 못했다. Gallery·Testbed 목록 각 1회는 100ms 이상 진행 정체가 없었고, MixedScroll·한글/이모지 편집·UIA 목록도 확인했다. 물리 입력과 scanout은 미검증이다. [후속 렌더링 비용 분석](work8-summary.md)
