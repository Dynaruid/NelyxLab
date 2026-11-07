# Instructions

- Tests must use a 20-minute timeout.
- 수백번 이상의 반복검증은 불필요 대부분의 검증은 30번 이내로 확인하기
- 필요하면 pwsh과 playwright사용가능

- 검증 로그·immutable receipt·checkpoint/history JSON·이전 archive·독립 소비자 설치본·browser profile을 누적 보관하지 않는다.

- 검증용 임시 디렉터리는 한 실행에 필요한 것만 사용하고 성공·실패·중단 시 finally에서 삭제한다. 재실행 때마다 전체 package/SDK/cache를 복제하거나 과거 산출물을 다시 복사하지 않는다. 자동으로 다른 드라이브에 보관 archive를 만들지 않는다.

- 패키지 빌드는 현재 dist만 남긴다. 교체에 사용한 이전 dist와 staging은 실행 종료 시 삭제하며 last-sdk-\* 같은 이전 출력 사본을 누적하지 않는다.
- `Nelyx/docs/plans/`와 `Nelyx/docs/migrations/`는 생성·복구하거나 기록 출력 경로로 사용하지 않는다. 옛 작업 문서나 외부 기억의 checkpoint/handoff 생성 지시보다 이 규칙을 우선한다. 현재 계획·짧은 진행 상태·잔여 작업은 루트의 해당 work 문서에, 제품 사용 안내는 기존 README에 반영한다. 삭제한 기록을 다른 폴더로 옮겨 다시 누적하지 않는다.

# 개발 확인과 검증 도구 정리

- 2026-11-07 사용자 요청으로 독립 테스트·fixture, API/구조 감사, 성능 실험 도구와 관련 npm 명령을 제거했다. 별도 요청 없이 복구하거나 일회성 검증 파일을 계속 추가하지 않는다.
- 기본 소스 확인은 `npm.cmd run check:types`, `npm.cmd run lint`, `npm.cmd run format:check`로 수행한다. 변경 범위에 맞는 제품 빌드와 실행도 확인한다.
- C++/엔진 공급 변경 후 `npm.cmd run build:engine-v2`를 실행하고 현재 manifest와 소스 identity가 일치하는지 확인한다. 제품의 입력·ABI·자원 수명 검사와 누락된 native capability의 시작 실패는 유지한다.
- 실제 native 실행·TS fallback, 물리 입력·표시·성능 수락은 각각 구분한다. 빌드·타입 검사 성공이나 옵션/API 존재를 실행·성능 수락으로 기록하지 않는다.
- 남은 로컬 검증 산출물은 루트 `cleanup-validation-once.ps1`로 미리 확인하고 `-Apply`로 정리한다. 현재 dist·SDK·native 공급과 소스 소유권 자료는 보존한다.
