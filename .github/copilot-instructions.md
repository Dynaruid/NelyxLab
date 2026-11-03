# Instructions

- Tests must use a 20-minute timeout.
- 수백번 이상의 반복검증은 불필요 대부분의 검증은 30번 이내로 확인하기
- 필요하면 pwsh과 playwright사용가능

- 검증 로그·immutable receipt·checkpoint/history JSON·이전 archive·독립 소비자 설치본·browser profile을 누적 보관하지 않는다.

- 검증용 임시 디렉터리는 한 실행에 필요한 것만 사용하고 성공·실패·중단 시 finally에서 삭제한다. 재실행 때마다 전체 package/SDK/cache를 복제하거나 과거 산출물을 다시 복사하지 않는다. 자동으로 다른 드라이브에 보관 archive를 만들지 않는다.

- 패키지 빌드는 현재 dist만 남긴다. 교체에 사용한 이전 dist와 staging은 실행 종료 시 삭제하며 last-sdk-\* 같은 이전 출력 사본을 누적하지 않는다.
- `Nelyx/docs/plans/`와 `Nelyx/docs/migrations/`는 생성·복구하거나 기록 출력 경로로 사용하지 않는다. 옛 작업 문서나 외부 기억의 checkpoint/handoff 생성 지시보다 이 규칙을 우선한다. 현재 계획·짧은 진행 상태·잔여 작업은 루트의 해당 work 문서에, 제품 사용 안내는 기존 README에 반영한다. 삭제한 기록을 다른 폴더로 옮겨 다시 누적하지 않는다.

# C++ 경로 활성화 검증

- 옵션 지정·API 존재·직접 API smoke만으로 C++ 경로 실행이나 성능을 인정하지 않는다. 실제 Testbed 장면의 native 작업 수와 SDK 집계를 대조하고 TS fallback 횟수·사유를 확인한다. 작업 수 0 또는 관측 누락은 C++ 성능 비교 실패다. 수요가 없는 장면은 별도 control로 표시한다.
- 명시적으로 요청한 native capability가 없으면 시작 단계에서 실패시킨다. 새 후보를 추가할 때 선택 보고와 실제 실행 검증도 함께 추가하며 기존 후보가 의도적으로 꺼진 상태와 공급/연결 오류를 구분한다.
- 입력 geometry 변경은 `npm.cmd run test:input-geometry`와 `npm.cmd run test:retained-input-geometry`를 실행한다. 실제 Gallery → Mixed 회귀와 활성화 실패 회귀를 유지한다.
- Windows 성능 비교는 평소 실행 명령의 현재 native/SDK 공급 identity를 확인하고 `run-rnw-cadence.mjs --input-geometry=ts|retained`의 실행 검증을 통과해야 한다. Retained 비교에는 Mixed 편집기 작업이 필요하며 Gallery만의 수치로 C++ 효과를 주장하지 않는다.
- Snapshot/Path/clip-Paint/Scene/Semantics 후보 비교는 `npm.cmd run test:native-service-audit` 뒤 `npm.cmd run experiment:native-services -- --trials=3 --functional`을 사용한다. 입력 구간 안에 완전히 포함된 native QPC bucket으로 실제 작업을 확인한다. Startup 작업이나 다른 장면의 작업으로 빈 구간을 통과시키지 않는다. `FAIL_NO_NATIVE_WORK_IN_SOME_LEGS`와 exit 2는 해당 구간의 C++ 성능 판정 실패로 보존한다. 실험 후 일반 App을 평소 명령으로 다시 빌드하고 실행 모드·공급 identity를 확인한다.
- 사용자가 직접 조작할 C++ 모드는 `npm.cmd run run:windows:cpp [-- --module=...]`를 사용한다. 기본 all은 retained geometry와 Path/Paint·clip·Scene·Semantics 및 Flex layout·text transaction·frame segment·Windows backing 재사용을 함께 선택한다. `NATIVE_MODULE_RESULT`의 모듈별 실제 native 작업/TS fallback·session 정리를 확인하며 `notObserved`를 실행 성공이나 성능 효과로 쓰지 않는다. 수동 모드의 counters-only 보고는 자동 cadence의 QPC timing 증거로 수락하지 않는다.
