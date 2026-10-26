# W16 — Hermes 공통 스크롤 엔진 개편 요약

원문: `work16.md` · 폴더 기준일: 계획 개정 2026-10-24 KST · 최초 구현 기록: 2026-10-23 KST · 종료: 2026-10-25 KST · 아카이브: 2026-10-27 KST

상태: **CLOSED / SUPERSEDED BY W17 / 구현 PARTIAL / `performanceAccepted=false`**.

## 방향과 구현

- cache/prefetch·갤러리 분할을 먼저 바꾸던 순서에서 **동일 부하 비용 계측 → 항목/갱신 owner·최초 생성/문단 단가 → 필수/선택 layout 분리 → 자원 보존/준비**로 우선순위를 바꿨다.
- 주 비교를 같은 qualified VM의 Hermes bytecode·Static Hermes로 통일하고 HBC/compiler/VM/AOT/host identity·접근성 on/semantics50ms를 확인하도록 했다. V8/JSC는 비교·호환 경로다.
- sliver 구조·보존·선택 pass와 bounded child policy를 구현했다. 관측 deadline을 광고하지 않는 현재 Windows host에서는 `observed-budget` 자동 준비가 비활성이다. 합성 host 검사를 실제 준비/성능 수락으로 올리지 않았다.
- 공통 RenderChildStore를0/1/N 구조로 바꾸고 layout scope callback·Flex 측정/배치의 임시 Map·객체를 줄였다. 사용자 getter/iterator·ParentData/State·오류/rollback 의미는 유지했다.
- 실제 ListView 트리410개 RenderObject에서 child Map410→21을 관찰했지만 store410개는 남았다. 이 구조 계수를 전체 heap·GC·native 개선율로 해석하지 않았다.

## 당시 검증과 실패

12회 baseline과 설치 후보 비교는 모드/창/부하/identity가 같은 범위에서만 사용했다. OS coalescing은 주입 수와 수신 수를 분리하고 거리·방향·sequence·queue 대응을 확인하도록 보강했다.

후속 bounded/observed-budget 진단은 bytecode **2,880→2,892px**, AOT **2,880→2,928px** 거리 불일치로 실패했다. 후보의 일부 완료 구간을 전체 수락으로 올리지 않았다. RenderChildStore/layout 회귀65개·Flex10개와 선정 Node/CanvasKit1개는 통과했으나 최신 구조의 native 성능 matrix는 재실행하지 않았다.

당시 C 공급은 source624/dist2,496/package를 합한 **3,121 files**의 설치 일치를 확인했다. B 후보의 native 결과는 C의 성능 증거가 아니다. 최종 Static Hermes 일반 Release 시작·응답 창·정상 exit0은 통과했지만 전체 catalog/IME·성능은 별도였다.

## 실행·이름 변경

- PowerShell에서 없는 환경값을 null로 복원할 때 빈 문자열이 남아 CLI가 실패하던 문제를 수정했다. launcher는 없거나 빈 값을 실제 삭제하고 명시적 true/false·임시 override를 복원한다. 회귀2개·9시나리오와 기본 명령 실행을 확인했다.
- 제품/패키지/CLI/config/native/schema·환경변수를 Nelyx로 바꾸고 옛 호환 alias를 제거했다. 이름 변경 전 native hash/실행을 새 이름의 검증으로 승격하지 않았다.
- 당시 옛 CanvasKit 출력은 제거돼 새 source build가 필요했다. 이름 변경 후 package/types·공급 계약은 PASS였지만 초기 디자인258개 중 **248 PASS/10 FAIL**(문단 기대9·image 기대1)이 남았다. 이는 이후 W17/W18의 최신 상태와 구분한다.

## 이관

두 모드 G6·실제 공개 제품/표시·물리 입력과 공통 할당/layout·text/scene/semantics 구조의 잔여를 W17로 넘겼다. W16 종료는 스크롤 문제 해결이나 기본 host 전환의 수락이 아니다.

[전체 이력](../../../README.md) · [원인 조사](../23/research-summary.md) · [W17 직접 host](../25/work17-summary.md)
