# W11 — M3 디자인 패키지와 공통 control 요약

원문: `work11.md` · 작성·실행·종료일: 2026-10-18 KST · 아카이브: 2026-10-27 KST

상태: **CLOSED / SUPERSEDED BY W12 / 제품 PARTIAL**, `wholePlanComplete=false`.

## 방향과 구현

- W10의 잔여를 TypeScript 제품·기능 동등성 기준으로 승계하고 Cupertino/Material을 family 단위로 일괄 개발했다.
- 사용자 결정으로 **Material은 M3 only**다. M2·`useMaterial3`·M2 전용 factory/overlay·2014/2018 typography·deprecated alias를 제외하고 current/2023 M3와 공통 색/shape·명시적 ink factory·hairline을 유지했다.
- App·named route/Router·locale, theme/swatch·progress/activity·Slider/RangeSlider, Ink/InkResponse/InkWell·Feedback, Chip·Icon/전체 icon font·Tooltip과 control 상태를 보강했다.
- 마지막에는 Material Checkbox·CupertinoCheckbox/adaptive, toggle theme/defaults·motion, 공통 입력·Color/Size·HSL/HSV·typed const List를 연결했다.
- 초기 변환기 `checks` 전체와 `dart/bin/extract_platform_fixture.dart`를 사용자 요청으로 제거했다. 제품 TS·변환기 본체·생성 소유권·출처/숫자 주석은 유지했다.

## 검증과 미완료

선정 source/Root/Babel·외부 archive 소비·영향 회귀와 생성 recipe27/fixture6의 과거 PASS를 유지했다. 전체 native·물리 공급은 notVerified이며 삭제한 validator의 과거 명령을 그대로 재실행하지 않는다. recipe 재사용에는 현재 제품의 명시적 검증 경로가 필요하다.

| 종료 시 범위 | 상태와 W12 이관 |
| --- | --- |
| 디자인·locale, scroll, runtime/paint/text/input, 편집, 앱/복원, 플랫폼/tooling | PARTIAL → 같은 번호 W12-01~06 |
| 개발 갱신·inspector | OPEN → W12-07 |
| 실제 환경·감사·공급 | PARTIAL → W12-08 |
| 접근성·native/HTML 임베딩 | DEFERRED → W12-09/10 |
| 최종 통합·정리 | OPEN → W12-11 |

다음 선정 범위였던 완전한 M3 Radio/Switch·세 toggle ListTile, 전체 locale/assets·복합 family와 물리 IME/reader/FPS·배포 잔여를 전부 넘겼다. 계획 이관과 도구 정리는 제품 구현·native 검증 재개가 아니다.

[전체 이력](../../../README.md) · [W12 구조 개선](work12-summary.md)
