# retained C++ geometry·실행 증거 재감사·수동 모드 요약

원문: 루트 `work5.md` · 작성·실행: **2026-11-03 KST** · 보관: **2026-11-04 KST**

상태: **후보 평가·재실험·직접 조작 C++ 모드 구현/검증 완료 / 일반 기본 TS / 후보 NO_ADOPTION / 제품 PARTIAL**. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 입력·표시 **notVerified**와 package `qualification=notVerified`를 유지한다. 이번 요약은 문서 보관이며 새 runtime 검증이 아니다.

## 초기 공통 엔진 후보의 평가

Doroti의 공통 엔진 개선을 참고해 TS가 트리를 매번 준비·전송하는 비용을 먼저 줄이고 C++가 지속 숫자 상태·변경분·질의를 맡는 경계를 검토했다. Widget·Element·의존성·사용자 callback은 TS 소유이며 기존 Skia/Graphite·native replay를 처음 C++로 옮기는 작업으로 설명하지 않았다.

| 후보 | 당시 결론 |
| --- | --- |
| A 생명주기·의존성 반복 작업 | 기존 Map/Set·dirty scope·keep-alive와 대조. 유의한 중복 근거 부족으로 추가 엔진 수정 **비진입** |
| B native hit-test 지속 상태 | 공개 getter/prototype·callback 사이 변경을 setter revision만으로 보존할 수 없어 최초 지원 계약 gate **비진입** |
| C Semantics payload 분리 | TS prototype·회귀 97/97을 구현했지만 필드 구성 전 준비를 제거하지 못하고 총비용 이득이 없어 **철회** |
| D recording 변경 생산 | 앞선 조건이 성립하지 않고 의미 보존 근거도 부족해 **비진입** |

위 최초 종료 이후 사용자 추가 요청으로 아래 retained **편집기 좌표** 경로를 구현했다. 전체 hit-test 탐색의 C++ 이관과 구분한다.

## retained geometry 구현과 활성화 오판 정정

숫자 상태의 native session·변경분·prepare/commit/discard·query와 SDK 수명을 연결했다. 세대/viewport/context/surface 교체·custom hook fallback·편집기 부재·owner 종료에서 상태를 닫고, callback/JS 객체를 native에 보관하지 않았다.

초기 선택 모드는 옵션·API는 있었지만 **실제 Gallery→Mixed가 전부 TS fallback**이었다. 이를 C++ FPS/IME 검증으로 해석한 판정은 **철회**했다. 직접 compiled kernel·framework differential과 설치 JSI API smoke는 좁은 범위에서만 유효하다. desktop sampling을 끈 기본값 0도 정지 없음의 증거가 아니다.

후속으로 실제 `ComponentsGallery`→`show-mixed-scroll`의 12 editors를 검사하고, 표준 Overlay/Offstage/Proxy/Shifted/sliver/decorator 지원을 연결했다. custom getter/prototype은 원래 TS 순서로 fallback한다. 명시한 capability 부재는 startup에서 실패시키며 요청 모드·SDK commit/fallback·독립 C++ prepare/commit/editor-query/close를 분리 보고한다.

`run-rnw-cadence.mjs --input-geometry=retained`는 Mixed native query > 0·SDK/native 일치·session close/0 bytes·warm 처리율 **95% 이상**을 요구한다. Gallery 무수요를 실행 성공으로 쓰지 않으며 Gallery만의 retained 비교는 거부한다. fallback-only·잘린 보고·다른 mode 혼입·미해제 등 오판 회귀와 저장소 지침을 보강했다.

동일 native/SDK의 실제 비교에서 Mixed 평균은 TS **49.314698**→retained **40.292055 surface FPS**, 약 **18.30% 감소**였다. 실제 native 실행은 확인했으나 eligibility·visitor·변경 생산·JSI/result 비용을 포함한 전체 경로가 느려 **NO_ADOPTION**, 일반 기본 TS를 유지했다.

## 이전 실험 재감사와 독립 native 재실험

원문 §15는 당시 tool result·tracked source·현재 JSI/C++ 경계를 대조했다. 초기 snapshot 대표 화면은 TS fallback, Path/clip/Paint는 submit 전 source-stage 항목, Scene/Semantics는 해당 source 진단의 호출 근거로 재분류했다. Semantics는 C++/TS 혼합이었다. **과거 각 무계측 FPS owner의 native 실행률을 소급 확정하지 않았다.** 진단 필드 `executed`는 `apiSmokeExecuted`로 바꾸어 구분했다.

사용자 요청 재실험에서는 실제 C++ 내부 counter·완전히 입력 구간 안에 포함된 QPC bucket·SDK 집계를 대조했다. TS 3 owners를 다섯 후보에 공통 사용한 **6 modes×3회=18 owners/108 legs**이며 독립 TS 대조 15회로 세지 않는다. 2560×1459/DPI 192, optimized/Release Hermes bytecode의 결과는 다음과 같다.

| 모드 | Mixed 평균 surface FPS | 실행·채택 판단 |
| --- | ---: | --- |
| TS control | 49.370187 | 선택 후보 작업 0 확인 |
| snapshot geometry | 38.639496 | Mixed 6/6 legs 실제 C++, cold fallback 각 1·처리율 약 99.89%. NO_ADOPTION |
| Path | 50.568783 | 우열·Mixed 실행, **좌열 native Path 작업 부족으로 귀속 실패**. NO_ADOPTION |
| clip/Paint | 50.189382 | 세 장면 모든 full-second bucket에서 실행. 작은 차이는 변동과 겹침, NO_ADOPTION |
| Scene composition | 48.498853 | prepare/commit·SDK 일치·TS fallback 0. NO_ADOPTION |
| Semantics geometry | 48.416234 | native query 28,725·TS fallback 5,807, 약 83.14~83.24% 혼합. NO_ADOPTION |

Path 좌열의 startup/다른 장면 작업으로 빈 입력 구간을 통과시키지 않았다. **`FAIL_NO_NATIVE_WORK_IN_SOME_LEGS`·전체 명령 exit 2**를 유지한다. 개별 평균 차이는 C++ 전반의 성능 한계나 지속 60fps·체감 해결의 증거가 아니다.

## 사용자가 직접 조작하는 C++ 모드

`npm.cmd run run:windows:cpp`와 `--module=all|retained|snapshot|path|paint|composition|semantics|ts`를 추가했다. 이 단계의 기본 all은 retained 좌표·Path/Paint·clip·Scene·Semantics를 함께 선택한다. 후속 all의 추가 모듈은 [work6](work6-summary.md), [work7](../04/work7-summary.md)에 기록했다.

launcher는 native/SDK·App/manifest identity를 검증하고 App 원문을 복구한 뒤 창을 열어 사용자가 닫을 때까지 기다린다. 입력·장면 전환·시간 제한은 주입하지 않는다. 화면의 `C++ all`은 **선택값**, 종료 `NATIVE_MODULE_RESULT`는 모듈별 실제 작업·fallback·정리다. 수동 `counters-only`를 자동 `qpc-buckets` timing/성능 증거로 수락하지 않는다. 작업 0은 `notObserved`/`fallbackOnly`로 남긴다.

실제 기본 명령의 Gallery/Mixed 제목·실행과 별도 최종 all package의 mixed **1/1 PASS**를 확인했다. 후자는 12 fields/36 buttons·재클릭 없는 입력·한글 commit/undo·Gallery 복귀를 통과했고 retained queries **11,688**, Path **909**, Paint **3,489**, clip **4,931**, Scene prepare/commit **3,671씩**, Semantics **11,702**를 독립 native/SDK와 대조했다. Geometry cold fallback 1·처리율 **99.8974%**, Semantics fallback **2,162**도 공개했다. 최대 ack **140.8497ms**, 복귀 gap **102.4178ms**, native drain·session close/0 bytes·exit 0은 기능 범위의 통과다.

## 최종 일반 공급·회귀와 남은 수락

일반 명령으로 원래 App을 재빌드·실행하고 TS/Scene·Semantics off/sceneBatch none, 제목·버튼·정상 exit 0을 확인했다.

| 당시 최종 공급 | SHA-256 |
| --- | --- |
| 수동 all manifest | `8957eda44f8e036d7dd66d998efb7c9c409cbd198a007b5c4cade431d02d7c95` |
| 일반 TS manifest | `fff1972c2e6ad278415cfe90e6924c940a6f2d0600ade8626bdbc08a73ff12d8` |
| 공통 native inputs | `6226f5fc53906610ba613b8ddce94fc718e0b3125449c8664ff51181588d9235` |
| 공통 SDK inputs | `8e8b2c9dc1cba80a0371fa65d93cf40eb5ec526f01851231f10853d6672129d1` |

audit **4/4**, geometry **2/2**, retained/activation **7/7**, native replay **71/71**, Windows animation **32/32**, 수동 모드/활성화 **6/6**, 전체 타입·lint/format·parser·diff를 통과했다. 묶음 간 중복을 합산하지 않으며 timeout은 20분이었다. 9개 source/dist/설치·archive/lock, native 공급 **1,795 files/compiled 178 entries**, 일반 package **1,795 files**를 대조했다.

App·fixture·staging·소유 process는 복구·정리하고 현재 dist/Release/archive만 유지했다. 기존 사용자 cache/emulator와 work4의 삭제 차단 구 공급 4개는 보존했다. 최종 수동 공급은 재실험 성능 공급과 다르므로 이전 FPS를 재인증하지 않는다. **지속 60fps·resize·전체 hit-test 이관·물리 입력/표시, Android/Web·Apple/Linux의 새 runtime 수락은 미완료/notVerified**다.

[이력 목록](../../../README.md) · [선행 반복 비용 개선](work4-summary.md) · [다음: 전체 구간과 N1~N4](work6-summary.md)
