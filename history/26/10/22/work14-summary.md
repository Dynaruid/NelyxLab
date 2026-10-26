# W14 — 테스트베드·공통 엔진 완성 계획 요약

원문: `work14.md` · 폴더 기준일: 원문 현재 기준 2026-10-22 KST · W13 이관: 2026-10-21 KST · 아카이브: 2026-10-27 KST

원문 상태: **전체 개편 PAUSED / 제품 PARTIAL**, `wholePlanComplete=false`. 별도 AOT·스크롤·기반 개편은 W15~W18 기록으로 이어졌다.

## 목표와 우선순위

Doroti Components를 기준으로 공개 Core/Material/Cupertino API와 실제 sample 조작을 완성하도록 W13 잔여11단계·R0~R6를 재구성했다. Material29/Cupertino20 섹션은 출발점이며 기능 완료율이 아니다.

공통 엔진 E01 자원·E02 scroll/State·E03 text/입력 등과 frame/공급을 먼저 닫고 디자인 family를 확장하도록 순서를 바꿨다. 기본 UI의 Core/Skia 소유권과 M3 only·단일 Core·제품 TS 직접 수정은 유지했다.

## 구현과 검증

- Windows QPC/precision 입력·DirectManipulation·mailbox 경계, GPU worker/fence·backpressure·최신 dirty scene 교체·startup/show/resize epoch를 보강했다.
- 문단 증감 회계·View cache owner/lease·font/reentry fence, Overlay onstage·State/GlobalKey·semantics 갱신과 text/style/환경 projection을 개선했다.
- V8 ES2022 Metro 경로와 native replay의 무효 작업 생략을 연결하면서 React/RN 언어 처리·자원 admission·오류/retirement 의미는 유지했다.
- 선정 regression·gallery·types·package/design 경계가 통과했다. 공개 기준 Core782의 Windows/Web/Android build와 실제 Chrome·Windows TSF/UIA/resize/drain·Android emulator 조작은 각각 기록된 범위에서 PASS였다.

## 성능과 공급 차이

당시 공개 V8 기준의 warm CPU p95는 기본/최대화 **6.62/9.18ms**, 먼 재방문 max는 **83.95/119.17ms**였다. warm 결과와 별개로 큰 창 재방문·고주사율 목표는 미충족이었다. native surface 제안과 명목165Hz 조회는 실제 scanout/FPS 증거가 아니다.

중단 시 source/dist/archive/설치 Core 후보는 `e114c3b7…`, 공개 Windows/Web/Android 실행 출력은 기준 `782ad6f0…`였다. 후보의 진단 문자열 지연 생성·회귀를 보존했지만 당시 공개 출력을 후보로 다시 빌드하지 않았다. 이 차이는 W14 중단 시점의 기록이며 현재 공급 identity로 주장하지 않는다.

## 남은 범위

큰 창 재방문 후보118.51ms·기준119.17ms의 100ms 미만 수락, 실제 precision trackpad·IME 후보창/reader·DPI 이동·display, VM/GPU 분해·광범위 loss/refresh와 전체 디자인/공급이 남았다. 성능 수치를 바꾸기 위한 무제한 cache/모든 행 보존은 채택하지 않았다.

후속 W15의 선정 typed 실험은 W15A로 확대됐고 W16→W17→W18이 공통 기반 문제를 이어받았다. W14 머리말의 W15A NOT_STARTED는 작성 당시 상태이며 W15A의 최종 G3 COMPLETE 기록과 구분한다.

[전체 이력](../../../README.md) · [W15](work15-summary.md) · [W15A](../23/work15a-summary.md) · [W18](../25/work18-summary.md)
