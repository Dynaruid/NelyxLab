# All components 전체 구간 검증과 C++ N1~N4 후보 요약

원문: 루트 `work6.md` · 작성·실행: **2026-11-03 KST** · 보관: **2026-11-04 KST**

상태: **IMPLEMENTED_AND_VERIFIED — 요청된 후보 구현·all 통합·실제 실행·기능 회귀·일반 App 복구 완료 / 기본 TS·NO_ADOPTION·제품 PARTIAL**. `performanceAccepted=false`, `resizePerformanceAccepted=false`를 유지한다. 이 상태는 요청 범위의 구현·평가 종료이며 지속 60fps·물리 표시 수락이 아니다. 이번 보관에서 새 성능 검증은 하지 않았다.

## 전체 lazy 구간을 확인하는 기준

원문 §2~3은 Gallery를 작은 반복 구간으로 측정하던 한계를 보완했다. **양 열의 모든 section을 실제 방문→각 열 최상단 복귀→각 열 top부터 현재 실제 bottom까지 측정**한다. 화면을 eager로 바꾸거나 모든 control 상태를 미리 펼치는 방식은 사용하지 않는다.

표시 section ID·현재 index measurement·실제 extent·폭/환경/owner/revision, image frame·등록 bundled font와 유효 submitted frame을 함께 관찰한다. 환경/폭/구조가 바뀌면 이전 완료를 철회한다. 최종 예열은 열별 expected/loaded/measured/표시 **7/7/7/7**, 총 **14 sections**였다.

도구는 원래 입력 시간 안의 bottom 도달·중간 section coverage·독립 native surface trace/counter 일치와 SDK/native 집계를 요구한다. 끝점 대기를 평균에서 임의로 빼지 않고 **전체 입력 surface FPS와 실제 첫 이동→bottom FPS를 구분**한다. 기존 짧은 cadence를 이 gate로 소급 통과시키지 않았다. `--full-range` 수동 관측은 자동 완료/timing 검사를 실행한 증거가 아니다.

## 구현 범위와 미구현 경계

| 후보 | 구현한 경계 | 완료로 표시하지 않은 범위 |
| --- | --- | --- |
| N1 `layout` | 한 Flex의 순수 숫자 두 단계: 제약 배분, root size·placement. TS child layout/callback 순서 보존 | 장기 subtree session·dirty delta·Stack/Wrap·dry/intrinsic/baseline 전체 이관 |
| N2 `text` | 기존 paragraph cache·font/query identity를 공유하는 native builder→layout→metrics transaction | 추가 intern/cache·section 전체 batch·TS description/key 준비 제거 |
| N3 `frame` | 한 frame의 닫힌 segment·resource snapshot을 native recording/GPU lease와 결합, 실제 retirement 회수 | frame 간 segment cache/reuse·Widget/capture·논리 resource registry 제거 |
| N4 `backing` | 동일 texture/device/context/format/size/generation의 import backing 재사용. frame fence/layout/ownership·hold는 별도 lease | fence·ACK 생략, 세대/외부 texture를 넘는 재사용 |
| N5 animation/physics | **비진입**, 이번 추가 요청 범위 밖 | 구현·성능 검증 완료 아님 |

N1의 실제 C++/TS 12조건 differential, N2 paragraph/봉인 GPU pixel 비교, N3 세대·resource·drain, N4 D3D/Vulkan pixel·consumer ACK·외부 texture 거부·세대 교체·idle eviction을 검사했다. API fixture와 실제 Testbed 실행의 증거는 별도로 유지했다.

## 전체 구간 실제 실행·성능 판단

모두 2560×1459 physical/DPI 192, optimized Release Hermes bytecode에서 fresh owners를 사용했다. N4와 N1~N3는 **다른 공급 cohort**이므로 한 before/after 비교로 섞지 않는다. source CPU 진단 owner도 cadence 평균에 넣지 않았다.

| 비교 cohort·모드 | primary 평균 surface FPS | secondary 평균 surface FPS | 결정 |
| --- | ---: | ---: | --- |
| N4 cohort TS | 53.447 | 44.100 | 대조 |
| N4 backing | 54.252 | 44.025 | NO_ADOPTION |
| 새 후보 cohort TS | 52.592 | 42.513 | 대조·기본 유지 |
| N1 layout | 52.641 | 41.784 | NO_ADOPTION |
| N2 text | 54.070 | 43.778 | NO_ADOPTION |
| N3 frame | 52.935 | 42.565 | NO_ADOPTION |

- **N4:** 교차 3쌍 전체 coverage·counter/trace 차이 0. native owner별 create/reuse/destroy **2/732/2, 2/729/2, 2/723/2**, SDK 일치·종료 live/bytes 0. 별도 진단의 import 준비는 약 **1.8~1.9→0.082ms/frame**으로 줄었지만 wait 증가와 전체 경로의 불일관한 이득으로 기본 미채택했다.
- **N1:** 각 owner plan/placement **197/203/200쌍**, 양 열 입력 안의 완전한 QPC bucket에서 실제 child 숫자 방문·SDK 일치·fallback 0을 확인했다. 지원 판정·왕복을 포함한 순이득은 없었다.
- **N2:** owner당 native transactions **218/op 651**, 입력 bucket의 실제 transactions primary **19/secondary 15**, fallback 0·SDK 일치. 국소 text layout 감소와 작은 평균 차이를 제품/물리 표시 개선으로 확대하지 않았다.
- **N3:** owner별 seal=admit=retirement **699/697/704**, SDK 일치·fallback 0·peak 2 segments·drain live/bytes 0. capture/submit의 총경로 이득은 확인하지 못했다.

각 후보는 실제 native 작업을 수행했지만 **지속 60fps와 체감 끊김 해소를 수락하지 못했다.** 실제 이동 최대 surface 간격도 primary 약 80~101ms·secondary 약 68~87ms로 남았다.

## 사용자 요청 all 통합과 최종 일반 제품

원문 §14에서 `npm.cmd run run:windows:cpp` 기본 all에 기존 retained/Path/Paint/clip/Scene/Semantics와 **N1/N2/N3/N4를 함께 연결**했다. 모듈별 독립 native/SDK 작업·fallback·frame/backing 회수를 검증하고 한 모듈의 작업으로 다른 모듈을 observed로 표시하지 않는다. all은 지원 경로 선택이며 모든 Widget·callback이 C++로 옮겨졌다는 뜻이 아니다.

기본 수동 창과 별도 fresh 기능 owner 모두 10개 모듈 observed, 12 fields/36 buttons·OS wheel 복귀 후 refocus 없는 키 입력·실제 한글 조합/commit/undo를 확인했다. 별도 owner는 창 최대화/복원/최소화와 Gallery→Mixed→Gallery를 통과했고 복귀 gap 최대 **96.80ms**, native GPU/input drain·forced=false·exit 0이었다. frame seal/admit/retire **3,543씩**, backing create/reuse/destroy **4/3,539/4**, drain 후 둘 다 live 0이었다. Geometry cold fallback 1·Semantics fallback 2,188은 별도로 남겼다. **수동 counters-only·기능 통과이며 통합 cadence나 물리 입력 수락이 아니다.**

새 회귀는 module/audit **7 PASS**, engine **6 PASS**, paint/resource/lifetime **71 PASS**, 실제 통합 기능 **1 PASS**였다. 앞선 Gallery **33 PASS/1 SKIP**, scroll engine **292 PASS**, layout·전체 구간·geometry·shadow·type/boundary 검사와 중복 합산하지 않는다.

| 당시 최종 통합/일반 공급 | SHA-256 |
| --- | --- |
| native inputs | `4d361037655c25510fab1e1282755b99a5acca1ad05f29394d50a095e97c74c0` |
| SDK inputs | `fc79f86467e919febb7e971f52cb4e76aa678783da5e0d497e481da56fe6c81d` |
| 수동 all manifest | `d30d9c83f69b844eb7bd4886b28713e4b95f4ea17f3305dfdd8a49bf3a544b62` |
| 복구한 일반 manifest | `f2d34308bc0e6b9f5306454d908b323d22dced7533f7dc17048303d94f2f2212` |

평소 `npm.cmd run run:windows --workspace @nelyx/testbed-2`로 일반 App을 다시 빌드·실행해 TS/Scene·Semantics false/sceneBatch none, 12 fields/36 buttons의 ActionsOnly·정상 exit 0을 확인했다. 이 마지막 일반 owner의 한글 IME 수락을 주장하지 않으며 IME 근거는 앞의 C++ 기능 owners에 한정한다.

9개 설치 SDK·source map·Skia native/RN canonical/generated/install **181 files**를 대조했다. App 원문을 복구하고 fixture·소유 process를 정리했으며 이번 이전 준비본만 참조/경로 preview 후 정리했다. 현재 dist·package별 현재 archive만 유지했다. **Static AOT·Web·Android native 실행, 물리 입력·scanout·resize 수락은 추가하지 않았다.**

[이력 목록](../../../README.md) · [선행 native 재실험·수동 모드](work5-summary.md) · [다음: scroll 입력·frame 재개](../04/work7-summary.md)
