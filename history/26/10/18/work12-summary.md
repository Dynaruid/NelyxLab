# W12 — Doroti 참조 구조와 TypeScript 7 도입 요약

원문: `work12.md` · 작성일: 2026-10-18 KST · 종료일: 2026-10-19 KST · 아카이브: 2026-10-27 KST

상태: **CLOSED / SUPERSEDED BY W13 / 제품 PARTIAL**, `wholePlanComplete=false`.

## 결정과 구현

- 디자인 패키지는 Doroti.Cupertino/Material의 계층·파일·Widget/State/theme/helper 책임을 먼저 참고하고 Nelyx TS와 단일 Core에서 구현하도록 우선순위를 바꿨다. Flutter는 API·기본값·숫자 의미의 보조 원본이다.
- STRUCTURE-0~2와 기존 control/theme/버튼·route·RefreshIndicator·SafeArea·Card/Badge/Avatar 등을 재사용·보강했다. 생성 구조를 바꾼다는 이유로 유효 구현을 다시 만들지 않도록 했다.
- M3 only·기존 생성/채택 소유권·숫자 주석·출처/라이선스를 유지했다. 삭제한 fixture/checks·ledger/validator를 복구하는 의무는 두지 않았다.

## TypeScript 7 도입

- root와 변환기 타입검사 CLI는 `@typescript/native: npm:typescript@7.0.2`를 사용하도록 전환했다.
- AST 분석·custom declaration transformer·staged ESM emit은 `typescript: npm:@typescript/typescript6@6.0.2` 호환 alias를 유지했다. lock의 실제 API 구현은 **6.0.3**으로, **7로 검사 / 6 API로 emit**하는 구성이었다.
- Bun 타입1.4.3·명시적 Node types, nullish 식 정규화와 compiler 구현 bytes의 identity guard를 연결했다. 타입검사를 느슨하게 만들어 통과시키지 않았다.
- workspace/sample·CLI/Metro/변환기 types와 staged package build, 공개 ESM identity, 선언/map 각827개·숫자 출처 태그1,126개 및 평가 순서22벡터가 통과했다. native emit 전체 전환·빌드 속도 개선·플랫폼 전체 수락을 뜻하지 않는다.

## 중단·정리와 잔여

디스크 부족 후 2026-10-19 긴급 정리에서 누적 log/receipt/checkpoint/history JSON·임시 설치본/archive·browser profile·과거 build/test 출력을 제거했다. 현재 코드·필수 회귀·pin·출처/소유권은 유지하며 삭제한 증거 복구를 재개 조건으로 삼지 않는다.

마지막 OverflowBar/Core 배율 변경은 build/types·저장소 회귀까지 통과했으나 **독립 설치는 공간 부족으로 FAIL**, 공급 수락은 미완료였다. STRUCTURE-3·디자인/locale·scroll/runtime/editing/app·플랫폼/tooling·접근성/임베딩·최종 통합 등 **W12-01~11 전부**를 W13의 같은 단계로 넘겼다. Oxlint는 선택 backlog이며 제품 필수 관문이 아니다.

[전체 이력](../../../README.md) · [W13 자체 Core/Skia UI](../19/work13-summary.md)
