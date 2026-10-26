# W15 — Typed Static Hermes 선정 실험 요약

원문: `work15.md` · 기준일: 2026-10-22 KST · 아카이브: 2026-10-27 KST

상태: **CLOSED / SUPERSEDED BY W15A**. 선정 구현·평가 COMPLETE, 제품 PARTIAL, `wholePlanComplete=false`.

## 실험 범위

TypeScript 타입 정보를 보존한 native scalar IR을 같은 Hermes VM의 실제 제품 호출에 연결했다. Cubic loop·helper·lerp의 선정 body를 특화하고 타입/receiver/동적 연산 경계를 검증했다. 숫자 leaf의 성공은 전체 build/layout/rendering·class/array/closure/SCC 전환이 아니다.

후속 정책에서 standalone untyped AOT를 신규 개발·성능 후보·필수 대조군·배포 선택지에서 제외했다. 기존 untyped 측정은 과거 근거이며 이 정책 반영만으로 코드 제거가 완료된 것은 아니었다.

## 기록된 평가

이전 총27회 비교의 typed warm p95는 기본/최대화 **18.58/28.70ms**, bytecode **25.17/39.54ms**, V8 **6.00/8.30ms**였다. typed는 V8의 **3.10/3.46배**, 재방문 max **248.10/268.91ms**로 V8 대비1.10배·재방문100ms 미만 목표에 미달했다. callback CPU 예산은 물리 FPS가 아니다.

typed 실제 제품 호출·입력/수명·실패 경계·공개 공급을 확인했지만 **프레임 성능은 미수락**이다. 서로 다른 실행의 heap/live 중앙값·전체 process peak·DLL/HBC 크기를 같은 자원/수명 지표로 합치지 않았다.

## W15A 이관

- TA-07의 전체 rendering/layout/build·class/array/closure/SCC와 전체 앱 실행 경로.
- TA-13의 standalone untyped 경로 제거·V8/bytecode/Static Hermes 공급·비교 재정렬.
- 전체 성능·배포 비용, native PC/PDB→원본 TS 진단, 다른 OS와 물리 IME/reader/precision/scanout의 미검증 범위.

기존 `matrix`에 제외 후보가 남아 있던 상태는 새 검증 명령으로 수락하지 않았다. W15A는 이후 전체 native AOT와 선택적 타입 최적화로 목표를 다시 정의했다.

[전체 이력](../../../README.md) · [W15A 전체 앱 AOT](../23/work15a-summary.md)
