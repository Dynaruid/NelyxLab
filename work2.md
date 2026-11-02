# 스크롤 잔끊김 개선 — 공통 엔진 비용 검토와 종료 기록

작성·종료: **2026-11-02 KST** · 상태: **CLOSED / SUPERSEDED BY work3.md**

> **2026-11-02 종료·이관:** work2 작업은 종료했으며, 이후 구현·검증·진행 상태는 [work3.md](work3.md)에서만 관리한다. 아래 계획·재개 지시·미체크 항목은 종료 당시 기록으로 보존하며 work2 작업을 다시 실행하지 않는다. 종료는 성능 목표 달성을 뜻하지 않는다. §6의 미커밋 후보·제품 식별·실패·철회와 `performanceAccepted=false`는 그대로 유지한다.

| 종료 시 남은 범위 | work3에서 이어갈 위치 |
| --- | --- |
| 미커밋 공통 후보·현재 일반 제품의 기준 확인 | C0 기준·계약 확정 |
| 입력 geometry·publication 반복 비용 | C1 C++ kernel → C2 JSI 통합 → 필요성이 확인된 C3 |
| source/dist/설치본/native/SDK/package 정합성과 플랫폼 회귀 | C4 실제 공급·플랫폼 회귀 |
| RNW 60fps 미달·최대화 Gallery 정지·전체 범위 비교·편집/실제 IME 확인 | C5 RNW 비교·최종 판정 |

`resizePerformanceAccepted=false`, 물리 트랙패드·실제 한국어 IME·scanout `notVerified`는 종료 시 상태로 보존한다. work2의 P0~P7을 별도 잔여 실행 계획으로 병행하지 않고, work3의 C0~C5에서 필요한 범위만 이어간다.

[work.md](work.md)의 미완료 항목 30개와 최신 중단 지점(§10.11)을 이관한 뒤, Doroti의 공통 엔진 개선과 현재 Nelyx 소스를 비교해 우선순위를 수정했다. **먼저 공통 Widget 생성·갱신·해제의 반복 작업과 할당을 줄이고, paint 파이프라인·Gallery 분할은 근거가 남을 때 조건부로 재검토한다.** 이 문서에서 수행한 실행 결과와 잔여 범위는 **§6**에 보존하며, 이후 잔여 작업의 실행·상태 갱신은 work3.md를 기준으로 한다. 소스 비교, 완료 검사, 후보별 측정·철회 이력은 원문에 남긴다. §1.1은 재개 전의 이관 기록이다.

**사용자 수락 기준 변경(2026-11-02): 모니터 설정은 변경하지 않는다. 현재 설정의 일반 사용에서 60fps 이상이면 수용하고, lazy load 중의 일시적 jitter는 허용한다.** 아래 실행·수락 계획은 이 기준을 우선한다. 이전의 60Hz 강제 검증·고주사율 매 주기 deadline 충족·cold 긴 frame 제거는 완료 조건에서 제외한다.

## 1. 종료 전 상태와 당시 재개 순서

### 1.1 이관 기준 상태

아래는 **2026-11-01의 마지막 실행 기록**을 요약한 것이다. 기록된 SHA·설정·제품을 현재 설치본이나 실행 중 프로세스의 확인으로 대신하지 않는다.

| 범위 | 완료·유지 상태와 남은 범위 |
| --- | --- |
| P0 계측 | bytecode 기준 3회, native snap CPU 관찰, RNW source/native 동일 frame 연결 완료. 현재 모니터 설정의 일반 사용 60fps 기준으로 판단하며, 60Hz 설정 변경·재측정은 제외. 개별 GC pause·독립 GPU 시간은 진단상 미관찰 |
| P0A 공통 엔진 비용 | **신규 계획 / 미구현·미측정.** 의존성 Map·실행 범위·keep-alive·명령 재사용의 기존 구현을 확인했다. 남은 reconciliation·중복 처리·임시 할당을 먼저 측정한다 |
| P1 clock | clock version 2와 DWM start/target/interval·deadline 전달 완료. 기존 한 장 CPU 선행 유지, 추가 예약 계약은 계측 후 판단 |
| P2/P3 | dirty paint와 Gallery 네 child 분할 묶음, 이후 Form 단독 분리 후보 모두 tail 악화로 **NOT_ADOPTED / 철회** |
| P4 입력 보조 작업 | 동일 annotation 집합의 임시 할당 감소와 이후 입력·geometry·semantics 개선은 원문의 최종 소스 범위를 따른다. 전체 잔끊김 수락은 미완료 |
| P5/P6 | packet 재설계·GPU raster cache는 조건부 미진입. executor·transport 공통 조상 변환 추가 후보도 비교 후 철회 |
| P7 제품 | 일반 제품의 OS 입력·전체 왕복·편집 상태 보존·정상 종료는 확인했다. 마지막 locator는 진단 제품이므로 재개 때 probe 없는 일반 제품 재빌드·식별 필요 |
| 수락 | 새 기준으로 아직 실행하지 않아 `performanceAccepted=false` 유지. 이후 일반 사용 60fps 기준의 수락과 scanout 관찰 상태를 구분한다. `resizePerformanceAccepted=false`, 물리 트랙패드·한국어 IME·표시/scanout `notVerified`는 과거 기록대로 보존 |

- 마지막 일반 제품 bundle은 `c65deb051b75980ab9b742d4517d06502c2b66f9b66c14d1b6d7a70f1d4bdc4c`다. 마지막 on-disk package/locator로 기록된 것은 진단 bundle `496bef8cea4b5df2d77a9546432c5b714cf26fbba6c0d95aacf7819d4ef822c3`, manifest `25fec277b19f63b5530c1ec265f9b9aa78e48da48f977d6fd05297ce9bd14146`다. source가 원복됐다는 사실과 일반 package 갱신 완료를 구별한다.
- RNW cold frame의 callback/layout `237.25/151.61ms`를 연결했고, 추가 attribution에서 child 2개 생성 `87.62ms`, text layout 40회 `38.05ms`를 관찰했다. 범주 간 시간은 겹치므로 합산하지 않는다. native snap wall·현재 스레드 CPU를 독립 GPU 시간이나 driver/compiler 내부 원인 확정으로 해석하지 않는다.
- 과거에는 실제 60Hz로 일시 변경해 DWM `refreshInterval=16.666ms` 전달과 cold callback/layout `212.34/145.68ms`를 확인했지만 CPU 기준 3회나 수락은 수행하지 않았다. 당시 종료 때 디스플레이 1 `NE140QDM-NX7` / 2560×1600 / 200% / 동적 새로 고침 끔 / desktop·active signal 165Hz로 복원했다. 이 내용은 과거 관찰이며 앞으로 설정 변경이나 60Hz 재검증을 요구하지 않는다.
- 원문의 §10.1~10.10에 남은 당시의 “다음 작업”은 후속 기록으로 대체됐을 수 있다. 아래 재개 순서도 work2 종료로 효력을 마쳤으며, 현재 실행 순서는 work3의 C0~C5를 따른다. 철회한 후보를 완료 항목으로 바꾸거나 근거 없이 다시 채택하지 않는다.

### 1.2 당시 재개 순서 — 종료된 계획

1. §5의 일반 명령으로 §6의 **probe 없는 Hermes bytecode / optimized / Release 제품**을 확인한다. source→dist/설치본→SDK acknowledgement·package manifest→실행 EXE·bytecode, 최신 locator와 앱 입력을 다시 검증하고 입력이 바뀌었으면 자동 재빌드를 확인한다.
2. **모니터 주사율·해상도·배율·동적 주사율 설정을 변경하지 않는다.** 현재 주사율·DPI와 실제 앱 frame cadence를 읽을 수 있는 범위에서 기록하고, 같은 제품 조건의 기존 기준을 우선 재사용한다. 추가 비교가 필요한 대표 장면만 새 프로세스 **3회** 측정하며 빌드·다른 검사를 timed phase와 겹치지 않는다. 목표는 현재 설정에서 일반 사용 **60fps 이상**이며, 모니터 최대 주사율을 모두 채우도록 요구하지 않는다. 이 요청을 앱의 60fps cap 신설로 해석하지 않는다.
3. 일반 스크롤·hover/focus의 지속 갱신이 60fps 아래로 떨어지는 구간부터 조사한다. 필요한 경우 Element rebuild·layout/text·native recording-finish와 의존성 처리·reconciliation·캐시 이동·capture의 기여를 연결한다. lazy load로 새 child를 만드는 동안의 일시적 jitter는 별도 관찰값으로 남기고 해소를 필수 작업으로 요구하지 않는다. 이미 완료한 RNW frame 연결은 재사용하고 개별 GC pause·독립 GPU 시간 등 미관찰 범위를 명시한다.
4. **P0A를 먼저 수행한다.** 실제로 반복되는 공통 엔진 비용을 골라 작은 변경별로 비교한다. Doroti에 있던 선형 의존성 저장소나 중복 AsyncLocal 범위가 Nelyx에도 있다고 가정하지 않는다. 키 없는 다중 자식의 임시 KeyMap, 중복 의존성 처리, 캐시 bookkeeping·닫힌 명령의 잔여 할당이 조사 후보이며 구현·이득은 아직 미확정이다.
5. 이어서 P4의 입력·geometry·semantics 비용을 확인한다. P1의 추가 credit 정책과 P2/P5/P6는 일반 사용 60fps를 막는 해당 병목이 관찰될 때만 진입한다. P3의 lazy 생성 단위 개선은 선택 사항으로 두고 일시적 jitter만으로 착수하지 않는다. 기존 P2/P3·Form·executor·transport 후보의 철회는 유지한다.
6. 계측을 끈 일반 앱에서 전체 위↔아래·빠른 왕복, pointer 이동·버튼, 편집 중 스크롤 뒤 재클릭 없는 입력, 한국어 IME, minimize/restore·close를 확인한다. 원문 §10.8의 진행 방식대로 에이전트가 직접 검증하며 **사용자에게 추가 체감 승인을 완료 조건으로 요청하지 않는다.** 자동 OS 입력으로 물리 트랙패드·scanout을 확인한 것으로 바꾸지 않는다.

실행 순서는 **P0 → P0A → P4 → 계측으로 필요성을 확인한 P1 잔여/P2/P3/P5/P6 → P7**이다. 조건부 단계의 비진입 판단도 기록하며 모든 구조 변경을 구현해야 종료하는 계획으로 해석하지 않는다.

## 2. 작업 범위와 유지 계약

- 이후 실행·성능 검토는 **Hermes bytecode / optimized / Release만** 사용한다. Static AOT 준비·빌드·실행·전용 검사·성능 재비교는 제외한다.
- 일반 스크롤 시작·연속·반전·재접촉, Button/TextField hover·focus와 화면 전체 움직임의 **60fps 이상**을 수락 기준으로 삼는다. 입력 지연·p95/p99·긴 frame은 원인 분석용으로 관찰한다. lazy load의 일시적 jitter와 cold 최초 생성은 별도로 기록하며 일반 사용 수락을 막는 기준으로 삼지 않는다.
- 입력·버튼 스크롤의 단일 eager Column과 편집기 12개 수명, 부분 버튼의 배경·테두리·그림자, 기존 개선을 보존한다. Gallery의 조건부 lazy 개선과 이 페이지를 구별한다.

구현 시 지켜야 할 조건:

- JS/TS 객체·callback·mutable canvas·JSI handle을 GPU worker로 넘기지 않는다. 새로운 native snapshot을 도입한다면 JS owner에서 해석·검증하고 worker가 소유할 native 값과 독립 resource hold로 변환한다. Graphite context/recorder의 thread affinity도 함께 검증한다.
- UI layout과 hit-test의 기준 scroll offset은 하나다. 일반 스크롤을 native에서만 별도로 움직이는 이중 offset 체계를 이번 1차 범위에 넣지 않는다.
- `contents dirty`, `layer properties dirty`, `semantics configuration dirty`, `geometry dirty`를 구분하되 외부 subclass/custom hook은 보수 경로로 처리한다.
- 한 view의 미제출 CPU frame은 최대 1개, native recording admission은 현재 2개 상한을 출발점으로 삼는다. **front recording·consumer·retirement의 슬롯 의미를 확인한 뒤** credit을 정하며 큐 크기를 키워 FPS를 가리지 않는다.
- stale frame은 제출 전에 폐기할 수 있지만 이미 승인된 GPU 작업의 upload·retirement·resource 해제는 끝낸다. owner/view/viewport/renderer/native context/surface 세대를 보존한다.
- Picture 캐시와 raster texture 캐시는 별도다. 기존 Picture **64-entry / 32MiB**, optional child **16개 / Element 2,048개**, Gallery capacity 2를 우선 유지한다. keep-alive 등 mandatory resident 비용도 별도로 집계한다.
- explicit redraw·forced geometry·persistent animation·caret blink는 계속 동작해야 한다. `accepted`, 같은 paint epoch, `present='unobserved'`만으로 다음 요청 제출을 생략하지 않는다. 이전 두 번째 제출 누락 회귀를 재도입하지 않는다.
- 매 프레임 입력 geometry의 최신 transform·clip·visibility와 TSF/IME 정합성을 유지한다. semantics를 더 늦추거나 hover를 없애는 방식은 해결 조건이 아니다.
- resize의 이전 front 보존·exact generation commit·native synchronization은 유지한다. 변경이 필요하면 resize 정합성과 성능을 별도 검증한다.

### 2.1 Doroti 개선법의 적용 검토 — 2026-11-02

근거는 [Doroti 공통 엔진 성능 개선 요약](../DorotiLab/history/26/11/01/shared-engine-performance-summary.md), [월 전환 상세 기록](../DorotiLab/history/26/11/01/date-picker-month-transition.md)과 아래 현재 소스다. **공통 경로에서 작은 비용이 반복되는 횟수와 할당을 줄이는 접근은 적용할 가치가 있다.** 다만 Doroti의 직접 수정 대상 중 상당수는 Nelyx가 이미 다른 구조로 처리한다.

| Doroti에서 줄인 비용 | Nelyx 소스 확인 | 이번 계획의 판단 |
| --- | --- | --- |
| 선형 DartMap의 의존성 검색·등록·삭제 | [InheritedElement](Nelyx/src/framework/widgets/framework.ts)의 dependents는 Map, Element.dependencies는 Set이다. [DependencyScope](Nelyx/src/runtime/dependency-scope.ts)는 공유 provider 연결과 최대 4개 조회 메모를 사용한다. 동적 typeToken은 조상 탐색 fallback을 유지한다 | 해시+연결 목록으로 다시 교체할 근거는 없다. P0A에서 중복 조회·등록, 메모 hit/miss, 알림 snapshot과 실제 해제량을 측정한다 |
| rebuild마다 같은 뷰의 콜백·AsyncLocal 범위 재생성 | Doroti의 [EnterDispatcher](../DorotiLab/Doroti/src/Doroti.Runtime/DorotiExecutionContext.cs)·[EnterViewScope](../DorotiLab/Doroti/src/Doroti.Ui/PlatformDispatcher.cs)와 달리 Nelyx Element.rebuild는 owner.currentElement를 저장하고 try/finally로 복원한다. BuildOwner는 기존 BuildScope·OwnerTransaction을 사용한다 | 해당 .NET 수정을 그대로 옮기지 않는다. per-Element 범위 객체를 새로 도입하지 않고, 실제 reconciliation·콜백 할당이 큰 경로를 조사한다 |
| 같은 부모·owner의 keep-alive 이동에서 detach/attach 반복 | [sliver adaptor](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts)의 _destroyOrCacheChild는 자식의 부모를 유지하고, _createOrObtainChild는 base move로 복귀한다. [RenderObject.move](Nelyx/src/framework/rendering/object.ts)도 같은 부모의 링크만 옮긴다 | 접속 보존은 이미 구현돼 있다. bucket 배열 생성·검색·slot 갱신의 잔여 비용만 후보로 둔다. [DormantChildCache](Nelyx/src/framework/widgets/dormant-child-cache.ts)의 detach/deactivate와 재활성화는 별도 수명 계약으로 보존한다 |
| 닫힌 명령·path·텍스트 기록의 반복 복사 | [frame.ts](Nelyx/src/ui/frame.ts)는 내부 captured command를 식별해 불변 값 공유·owned resource 이전을 하고, [scene.ts](Nelyx/src/ui/scene.ts)는 retained native Picture를 재사용한다 | 기존 재사용을 중복 구현하지 않는다. 남은 admission 순회·command 배열·resource hold 비용을 측정하고 검증된 불변 metadata 재사용만 작게 비교한다. 외부 mutable/getter와 매 frame의 owner·generation 검증은 유지한다 |
| Windows 장면 검사·MAUI 접근성 자식 목록의 임시 할당 | Nelyx는 RNW 경로다. [Windows semantics](Nelyx/sdk/src/backends/react-native/windows-semantics.tsx)는 이미 전체 트리에 한 번 구독하며, [packet](Nelyx/sdk/src/platforms/windows/semantics-packet.ts)은 각 commit·source·geometry·editing revision을 새로 전달한다 | P4에서 실제 transport 할당과 자식 참조·순서 비교 비용을 확인한다. 동일 topology여도 최신 좌표·commit·action 검증은 갱신하며 전체 packet을 이전 frame 값으로 재사용하지 않는다 |
| Android context 유지·Surface 교체·콜백 수명 정리 | Doroti의 Android host 변경이며 현재 Nelyx Windows cold layout의 직접 원인으로 확인되지 않았다 | 이번 우선 작업에 Android host 재설계를 추가하지 않는다. 공통 변경의 Web/Android smoke는 유지하고 별도 재현 근거가 있을 때 플랫폼 작업을 연다 |

[KeyMap](Nelyx/src/foundation/key.ts)도 이미 hash bucket과 삽입 순서를 관리한다. 사용자 Key의 equals/hashCode 및 hash 미제공 시 fallback bucket을 보존한다. Element.reconcile의 단일 자식 경로도 이미 Map/Set 생성을 피한다. **실제 남아 있는 후보는 키 없는 다중 자식에서도 만드는 임시 KeyMap 등이며, 일반 JS Map으로 무조건 바꾸는 작업이 아니다.**

현재 [Material catalog](sample/nelyx-testbed-app-2/src/catalog.ts)와 [Cupertino catalog](sample/nelyx-testbed-app-2/src/cupertino-catalog.ts)의 Date picker는 planned다. 이번 성능 계획에서 Date picker 구현을 새로 시작하지 않는다. 공통 비용 검증은 기존 Gallery cold 첫 진입·목록 행 생성/복귀·테마 갱신과 입력·버튼 페이지를 사용한다.

Doroti의 의존성 비교 10,240→20회, 중첩 할당 27,200→5,440 bytes, 6회 월 전환별 최대 UI 처리 시간 평균 75.673→19.009ms는 각기 다른 지표다. 이 숫자나 개선율을 Nelyx의 예상 성능·GC pause·표시 FPS로 옮기지 않는다. Nelyx의 적용 이득은 아래 새 비교에서 확인해야 한다.

## 3. 종료 시 단계별 기록 — 미완료 범위는 work3으로 이관

아래 체크리스트는 work2 종료 당시 상태다. 미체크 항목을 work2에서 추가 수행하거나 완료 처리하지 않으며, 후속 실행·채택/철회·수락 결과는 work3에 기록한다.

원문에서 이관한 항목에 P0A를 추가하고 P1 잔여/P2/P3의 진입 조건과 P4/P5의 범위를 조정했다. 각 단계의 부분 완료·철회 상태를 함께 읽고, 이미 확인한 작업을 불필요하게 반복하지 않는다. 원문 실행 기록을 가리키는 §10.x 참조는 [work.md](work.md)의 절 번호다.

### P0. 현재 제품에서 끊기는 프레임 찾기

이관 상태: bytecode 기준과 RNW 동일 frame 연결은 완료한 범위를 재사용한다. 남은 필수 범위는 현재 모니터 설정에서 일반 사용 60fps를 판단할 수 있는 관찰과 필요한 원인 분리다. 60Hz 재검증이나 모든 GC/GPU 진단 항목의 해소를 완료 조건으로 요구하지 않는다.

대상: [`runtime.ts`](Nelyx/src/hosting/runtime.ts), [`root.ts`](Nelyx/src/framework/widgets/root.ts), [`WindowsFrameTrace.h`](Nelyx/skia/packages/rn/native/windows/WindowsFrameTrace.h), [`windows-scroll-observer.ps1`](Nelyx/eng/windows-scroll-observer.ps1), 기존 native 측정 runner.

- [ ] idle/시작·재접촉, warm 왕복 no-hover, warm 버튼·TextField hover/focus를 일반 사용 장면으로 확인한다. cold 첫 섹션 진입·lazy load 구간은 별도로 식별해 일시적 jitter를 허용한다. 두 열은 왼쪽/오른쪽 및 pointer 이동을 포함하고 ListView·Cupertino를 회귀 장면으로 둔다.
- [ ] 기존 trace를 확장해 input→dispatch, build, layout, paint, compose, capture, geometry, semantics, post-frame hit-test, packet/validation/Picture compile/Graphite recording, GPU·publish·retirement를 동일 frame identity로 연결한다. host가 기록하지 않는 단계는 먼저 작은 계측을 추가한다.
- [ ] 시간뿐 아니라 dirty node 수, boundary 방문·재기록 수, command/packet bytes, mailbox 깊이·입력 나이, pending frame 나이, native credit, paragraph/Picture 생성·cache miss·GC를 기록한다. GC pause를 관찰할 수 없는 실행은 `unobserved`로 둔다.
- [x] 기본은 저비용 bounded RAM 표본, 느린 프레임에서만 상세 수집이다. source 내부 함수 monkey patch 진단의 오버헤드를 구분하고 최종 판정은 계측을 끈 동일 제품에서 한다.

완료 조건: Hermes bytecode에서 주 재현 장면별 기준 trial 3회로 어느 구간이 긴 frame 또는 제출 공백과 함께 발생했는지 설명할 수 있다. 이 기준 실행은 P7의 변경 전후 비교에 재사용하며 같은 조건을 불필요하게 다시 측정하지 않는다. 기존 Static AOT 수치를 bytecode 기준값으로 승계하거나 AOT 비교를 다시 실행하지 않는다. 모든 원인을 한 수치로 뭉치지 않는다. [`profile-gallery-scroll.mjs`](Nelyx/eng/profile-gallery-scroll.mjs)는 실제 sample Widget을 쓰는 **Node/CanvasKit CPU 진단**이므로 코드 기여 분석에만 사용하고 Hermes native 성능 수락으로 쓰지 않는다.

### P0A. 공통 Widget 생명주기·할당 비용 축소 — 우선

의존: P0의 현재 제품 식별·대표 장면 기준과 원인 관찰. 대상: [framework.ts](Nelyx/src/framework/widgets/framework.ts), [key.ts](Nelyx/src/foundation/key.ts), [dependency-scope.ts](Nelyx/src/runtime/dependency-scope.ts), [owner-transaction.ts](Nelyx/src/runtime/owner-transaction.ts), [sliver.ts](Nelyx/src/framework/widgets/sliver.ts), [sliver adaptor](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts), [frame.ts](Nelyx/src/ui/frame.ts).

**진행 방식:** 매번 위젯이 생기고 바뀌고 사라질 때 반복하는 공통 비용을 먼저 줄인다. P0의 제품 식별·기준과 해당 CPU 기여를 확인하면 착수하며, 개별 GC pause·독립 GPU 시간 등 모든 미관찰 항목의 해소를 착수 조건으로 요구하지 않는다. 아래 후보는 실제 기여를 확인한 것만 구현한다. 이미 최적화된 경로, 드문 오류 경로, 효과가 작은 후보는 무변경·비진입 사유를 남긴다.

- [ ] 기존 bounded RNW 관찰에 Element 생성/rebuild/reconcile/해제 수, 의존성 조회·등록·삭제와 snapshot 크기, provider memo hit/miss·fallback 깊이, keep-alive/dormant hit·퇴출, attach/detach·command capture 수를 필요한 범위에서 연결한다. 상세 계측과 CPU 기준 실행을 분리하고 호출 횟수·샘플 가중치를 CPU 시간으로 환산하지 않는다.
- [ ] 키 없는 다중 자식의 임시 KeyMap·Set·배열, 변경 없는 자식 구간의 반복 bookkeeping을 우선 비교한다. 기존 단일 자식 경로는 유지한다. 키 유무·순서·수명에 따라 안전한 경로만 분리하고 Widget.update·slot·custom hook·GlobalKey 예약/retake·중복 key 오류·부분 실패 cleanup을 보존한다. 사용자 Key의 equality/hash 계약을 빠뜨리지 않는다.
- [ ] 같은 Element/provider/aspect의 반복 조회·등록과 변경 없는 알림 준비가 실제 cold 비용인지 확인한다. 표준 구현에서 줄일 수 있는 중복만 비교하고, 동적 typeToken·명시적 outer dependency·aspect 전체 구독·해제 후 재등록 순서·알림 중 수정의 snapshot·다른 View/재부모화 검증을 보존한다. 현재 Map/Set·4개 memo를 성능 근거 없이 교체·확대하거나 중첩 실행 범위를 새로 만들지 않는다.
- [ ] 같은 부모·owner의 keep-alive 이동에서 기존 접속 보존을 검증하고 bucket snapshot·검색·sibling/slot 갱신·캐시 복귀의 불필요한 반복만 줄인다. dormant의 ticker/input/semantics 비활성화·fresh builder·의존성 갱신, 실제 eviction·다른 owner 이동·GlobalKey·예외 정리는 기존대로 실행한다. children/Element/Picture 예산과 마지막 복귀 후 live resource를 함께 확인한다.
- [ ] 닫힌 command/value의 기존 공유·owned 이전·native Picture hit를 먼저 확인한다. frame admission·resource 수집·배열 할당이 여전히 유의미할 때만 불변 recording의 검증 metadata 재사용을 비교한다. 매 frame token/owner/viewport/context 검증과 독립 resource hold·실패 시 rollback을 유지하고 외부 입력은 기존 capture를 거친다. native packet 복사·worker 이동은 P5의 별도 조건으로 남긴다.

완료 조건: 실제 수정한 경로의 관련 회귀와 작업량·할당 감소를 확인하고, 같은 모니터 설정·Hermes bytecode 제품 구성의 대표 장면 기준 3쌍으로 일반 사용 60fps와 기능·수명·메모리를 확인한다. CPU·surface tail은 진단값이며 lazy load의 cold max/jitter 악화만으로 기각하지 않는다. 일반 사용 기준을 충족하면 더 높은 cadence나 모든 p99 개선을 위해 계속 최적화하지 않는다. 공통 병목이 없으면 비진입을 기록한다. P0A 진행 자체가 성능 수락을 뜻하지는 않는다.

### P1. clock·deadline·생산 여유 — 잔여 생산 정책은 조건부

이관 상태: clock2·deadline 전달은 완료했다. 기존 한 장 CPU 선행을 유지하며 아래 생산 여유·수명 검증을 진행한다. 철회한 producer gate를 자동 복원하지 않는다.

진입 조건: P0/P0A에서 오래된 pending frame·credit 경합·완료 뒤 재시도 지연이 관찰된다. 이미 완료한 clock2·deadline 전달은 재작성하지 않는다. 대상: [`CompositorFrameClock.h`](Nelyx/skia/native/host/windows/CompositorFrameClock.h), [`RNSkWindowsHost.h`](Nelyx/skia/packages/rn/native/windows/RNSkWindowsHost.h), [`frame-clock.ts`](Nelyx/sdk/src/platforms/windows/frame-clock.ts), [`clock.ts`](Nelyx/src/foundation/clock.ts), [`runtime.ts`](Nelyx/src/hosting/runtime.ts), [`renderer.ts`](Nelyx/skia/packages/native/src/renderer.ts).

- [ ] 현재 한 장 CPU 선행 정책을 계측한 뒤, 필요하면 producer credit 예약·취소·반납을 추가한다. hint 조회와 실제 `nelyxReserve`의 경합을 구분하고, JS build 동안 GPU lock이나 WinUI 대기를 잡지 않는다.
- [ ] busy 상태에서도 입력 dispatch·필요한 forced geometry는 진행한다. 최신 dirty 상태로 미제출 frame을 교체하되 old lease는 새 capture 성공까지 유지한다. retirement/credit 알림 뒤 재시도와 숨김·복원·종료를 처리한다.
- [ ] animation/scroll의 다음 요청, explicit redraw, 여러 view의 공정성, clock callback 도중 재진입을 회귀 검증한다. 불필요한 polling이 크면 completion wake를 사용하되 정지 후 재개 누락이 없어야 한다.

완료 조건: deadline 없는 호스트는 기존 필수 경로로 동작하고 선택 작업은 비활성이다. busy 중 무한 CPU 재기록·credit 누수·입력 starvation·닫기 hang이 없고, 일반 사용 60fps와 정상 입력 처리를 유지한다. 입력→dispatch/submit tail과 실제 host deadline miss는 원인 분석값으로 남긴다.

### P2. dirty repaint boundary 중심의 공통 paint — 조건부 재검토

**판정: 후보 구현·구조 검사 후 native 전후 비교에서 묶음의 tail이 악화돼 철회했다([work.md §10.5](work.md)).** 아래 최종 채택 항목은 완료로 바꾸지 않는다.

진입 조건: P0A·P4의 비용 감소/비진입 판단 후에도 불필요한 paint 방문·재기록·compose가 일반 사용 60fps를 막는 주요 기여로 확인된다. P1은 필요한 생산 계약이 바뀌는 경우에만 선행한다. 기존 후보의 재채택은 새 단독 비교에서 판단한다. 대상: [`object.ts`](Nelyx/src/framework/rendering/object.ts), [`repaint-boundary.ts`](Nelyx/src/framework/rendering/repaint-boundary.ts), [`context.ts`](Nelyx/src/framework/painting/context.ts), [`layer.ts`](Nelyx/src/framework/rendering/layer.ts), [`root.ts`](Nelyx/src/framework/widgets/root.ts), [`scene.ts`](Nelyx/src/ui/scene.ts).

- [ ] dirty boundary와 layer 속성 변경을 소유하는 PipelineOwner 단계를 설계한다. 기존 layout·paint version·hidden retirement·nested boundary 캐시를 연결하고 같은 역할의 별도 트리를 만들지 않는다.
- [ ] 내용 변경은 해당 boundary의 recording을 갱신하고, offset/transform/opacity 등 내용이 같은 변경은 검증된 layer 속성만 갱신한다. compositing 필요 여부가 바뀌는 shape/clip/effect도 반영한다.
- [ ] attach·초기 frame·boundary 생성/제거·부모 변경·detached/hidden·custom paint의 안전한 fallback을 유지한다. dirty collection 순서와 부모/자식 중복 처리는 Flutter의 deepest-first 원칙을 참고해 수명 계약에 맞게 정한다.
- [ ] Root는 dirty layout/paint 수렴 후 scene을 compose·capture한다. 실제 요청 frame의 capture·submit과 post-frame 동작은 유지한다. 재사용하는 것은 검증된 recording이며 요청 자체를 취소하지 않는다.
- [ ] paint 도중 다시 무효화된 version을 clean으로 확정하지 않는다. 현재 refresh가 paint 이전 version을 잡는 규칙을 보존하고 다음 frame으로 남긴다.

완료 조건: 같은 화면에서 버튼·caret 하나의 animation이 정적인 형제 recording을 다시 만들지 않는다. 구조 fixture에서 방문·재기록 감소를 입증하고 Hermes bytecode native 실행의 일반 사용 60fps·정합성을 확인한다. frame CPU p99는 보조 진단값이다. 실측 이득 없이 복잡성만 늘어나면 해당 경로를 채택하지 않는다.

### P3. cold child의 동기 작업량을 줄이는 sliver 구성 — 조건부 재검토

**판정: Gallery 네 child 분할 후보는 P2와 함께 철회했고([work.md §10.5](work.md)), 이후 Form 단독 분리도 비교 후 철회했다([work.md §10.10](work.md)).** 추가 요청의 eager 혼합 페이지는 [work.md §10.4](work.md)의 별도 기능이며 P3 lazy 최적화의 완료로 계산하지 않는다.

진입 조건: lazy load의 일시적 jitter는 수용하므로 **필수 개선 단계에서 제외**한다. 생성 완료 후에도 일반 사용이 지속적으로 60fps 아래에 머물거나 입력 처리가 멎는 등 별도 문제가 있을 때만 남은 큰 단위를 검토한다. 선택적 준비는 유효한 P1 deadline·생산 여유 확인 후이며 기본 disabled를 유지한다. 대상: [`sliver.ts`](Nelyx/src/framework/widgets/sliver.ts), [`sliver-multi-box-adaptor.ts`](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts), [`sliver-list.ts`](Nelyx/src/framework/rendering/sliver-list.ts), [`view-work-budget.ts`](Nelyx/src/framework/widgets/view-work-budget.ts), [`gallery.ts`](sample/nelyx-testbed-app-2/src/gallery.ts), [`gallery-section.ts`](sample/nelyx-testbed-app-2/src/gallery-section.ts).

- [ ] P0에서 가장 비싼 section을 작은 lazy child 단위로 나눈다. 우선 header/control group 등 의미 있는 단위로 분할하고 샘플의 일회성 memo만으로 공통 엔진 문제를 덮지 않는다.
- [ ] 공통 delegate가 분할된 항목의 stable key·측정 extent·index lookup을 지원하도록 정리한다. 한 열↔두 열·filter·theme·font/DPI 변경에서 extent cache를 무효화하고 scroll anchor를 보존한다.
- [ ] controller·Form·selection/focus·IME 수명은 child 생성 단위와 분리한다. editor keep-alive를 유지하며 모든 section을 영구 보관하지 않는다.
- [ ] 비용이 충분히 작은 이웃 child만 선택적으로 준비하는 실험을 한다. 기존 1 child/tick·예상 2ms 이하·4ms reserve와 View 예산을 출발점으로 삼고 paint/submit tail까지 고려한다. 남은 시간이 없거나 새 입력·방향 전환·메모리 압력이 있으면 취소한다.
- [ ] 준비 작업의 p99·과소 추정·overrun을 측정한다. 동기 child 생성은 중간 취소할 수 없으므로 큰 작업을 잘게 나누기 전에는 자동 준비를 기본값으로 켜지 않는다.

진입한 경우의 완료 조건: 생성 완료 후의 일반 사용 60fps와 producer/paragraph·Element·native bytes 예산을 확인한다. cold 긴 frame·lazy jitter의 제거는 요구하지 않으며 별도 진단값으로 남긴다. ListView의 `dormant` 정책과 Gallery의 `bounded` 정책을 구분한다. 일시적 jitter만 남으면 조건부 비진입으로 마무리한다.

### P4. 입력·hover·semantics·IME의 중복 계산 정리

이관 상태: 완료한 입력 순서·post-layout hover와 최종 geometry/semantics 개선은 유지한다. 아래 항목은 남은 측정·중복 계산·IME 수락 범위다.

의존: P0·P0A의 측정·변경 판단 및 실제 layout/paint 경계. 대상: [`runtime.ts`](Nelyx/src/hosting/runtime.ts), [`root.ts`](Nelyx/src/framework/widgets/root.ts), [`mouse-tracker.ts`](Nelyx/src/framework/rendering/mouse-tracker.ts), [`scroll-position-with-single-context.ts`](Nelyx/src/framework/widgets/scroll-position-with-single-context.ts), [`semantics-pipeline.ts`](Nelyx/src/framework/rendering/semantics-pipeline.ts), [Windows semantics](Nelyx/sdk/src/backends/react-native/windows-semantics.tsx), [semantics packet](Nelyx/sdk/src/platforms/windows/semantics-packet.ts).

- [ ] mailbox burst의 dispatch·hit-test·알림 수를 측정한다. 우선 allocation·변환 snapshot·dirty 전파의 중복을 줄인다. delta를 합치려면 동일 view/device/gesture/viewport/target·transform 범위를 증명해야 하고, 경계 clamp·반전·listener side effect가 있으면 원순서를 유지한다.
- [ ] semantics의 configuration 변경과 위치 변경을 기존 큐에서 구분한다. 300ms/quiet 정책을 더 늘리지 않고 계산·transport 중복을 줄인다. RNW의 한 트리 한 구독을 유지하며, 자식 참조·순서가 같은 경우의 topology/목록 할당 재사용을 별도로 비교한다. 최신 bounds·commit·source·editing revision과 value/focus/action·지연 action의 revision 재검증은 매번 유지한다.
- [ ] text shaping/selection local geometry는 재사용하되 매 frame의 부모 transform·clip·TSF/caret 화면 좌표를 적용한다. 스크롤 후 재클릭 없이 입력·선택·조합이 계속돼야 한다.

완료 조건: hover/focus를 포함한 일반 사용 60fps와 정상 입력 처리를 확인하고, 입력 누락·중복, nested scroll·두 열 target 오류, accessibility/IME 회귀가 없어야 한다. p99는 추가 분석값으로 남긴다. 보간·가속도·마찰 계수 조정은 이 단계의 CPU 개선과 분리한다.

### P5. 남는 frame packet·native recording 비용 축소 — 조건부

진입 조건: P0A의 기존 command 재사용 확인과 P4 판단 후에도 packet/validation/Graphite recording이 일반 사용 60fps를 막는 주요 기여로 관찰됨. P2/P3의 구조 변경을 진입 전 필수로 요구하지 않는다. 대상: [`frame.ts`](Nelyx/src/ui/frame.ts), [`scene.ts`](Nelyx/src/ui/scene.ts), [`scene.ts(native)`](Nelyx/skia/packages/native/src/scene.ts), [`pictures.ts`](Nelyx/skia/packages/native/src/pictures.ts), [`JsiDisplayList.h`](Nelyx/skia/native/adapters/jsi/cpp/api/JsiDisplayList.h).

- [ ] 먼저 현재 retained Picture hit/miss와 바뀐 frame command 수를 확인한다. 이미 한 번 compile한 recording을 다시 캐시하는 계층을 추가하지 않는다.
- [ ] 내부에서 검증·소유한 immutable 명령은 admission metadata·resource hold를 재사용할 수 있는지 검토한다. 외부 mutable/frozen 배열·getter·custom hook에는 기존 검증을 유지한다.
- [ ] packet의 frame-local buffer 재사용 또는 native immutable scene handle을 작은 범위에서 비교한다. 기존 동기 replay와 수명·세대·오류 복구가 같아야 한다. JS buffer 공유·무검증 zero-copy는 채택하지 않는다.
- [ ] native scene/recording을 worker로 옮기는 경우 typed native resource와 generation 검증을 먼저 설계한다. 같은 Graphite recorder를 여러 thread에서 사용하거나 JSI 객체를 worker에 보관하지 않는다.

완료 조건: 실제 Hermes bytecode native 실행에서 해당 command bytes·할당/복사·recording 비용의 감소를 확인하고 일반 사용 60fps·memory/retirement를 유지한다. 전체 p99 감소를 별도 필수 조건으로 요구하지 않는다. 이득이 작으면 기존 경로를 유지하고 조건부 미진입 사유를 기록한다.

### P6. GPU replay·effect·raster 캐시 검토 — 조건부

진입 조건: CPU 작업을 정리한 뒤에도 GPU producer/publish가 일반 사용 60fps를 막는 주요 기여로 남음. 대상: 기존 native Picture backend, [`CompositionSurface.h`](Nelyx/skia/packages/rn/native/windows/CompositionSurface.h), Vulkan/Graphite 실행과 effect 경로.

- [ ] GPU 구간·upload·할당·fence 대기와 WinUI publish를 분리하고 shadow/clip/opacity/backdrop·surface 크기와의 관계를 본다.
- [ ] 먼저 재생 불필요한 scene 방문·불필요한 offscreen pass를 줄인다. 화면 효과·그림자 품질을 임의로 제거하지 않는다.
- [ ] 반복 replay가 비싼 정적 boundary에 한해 raster texture cache를 실험한다. 생성 비용, reuse 횟수, DPR·scale·transform·clip·context loss·fractional scroll의 cache key와 해제를 정의한다. blur·backdrop처럼 배경 의존 효과를 정적으로 캐시하지 않는다.
- [ ] Picture 한도와 별도의 GPU bytes·eviction 예산을 명시하고 warm/cold·GPU memory를 함께 비교한다. 기존 48 bytes/physical pixel 등의 allocator 설정은 병목 증거 없이 확대하지 않는다.

완료 조건: 해당 GPU 비용의 감소와 일반 사용 60fps를 확인하고, 소수점 위치의 글자·그림자·clip 정합성과 device/context 수명을 유지한다. Impeller 도입·Skia 교체는 이번 1차 계획의 기본 항목이 아니다.

### P7. 일반 실행 제품에서 통합 검증·정리

이관 상태: 기존 제품/공통 회귀와 후보 비교는 원문에 보존한다. 새 변경에 필요한 검사만 추가하고, 일반 제품 재빌드·식별은 §1.2를 먼저 따른다. 사용자에게 추가 체감 승인을 요청하지 않고 직접 확인 가능한 범위를 기록한다.

의존: P0/P0A/P4의 수행·판단, P1 잔여/P2/P3/P5/P6의 진입 여부·채택/철회 기록. 조건부 미진입을 구현 완료로 표시하지 않는다. 대상: 실제 Testbed, 기존 tests·SDK 공급·README·현재 문서.

- [ ] 물리 트랙패드 시작·연속·반전·재접촉, 두 열 사이 pointer 이동, Button hover/press, 편집 중 스크롤 후 입력·한국어 IME, minimize/restore·close를 확인한다. 자동 OS wheel은 물리 트랙패드 확인과 별도로 기록한다.
- [x] 계측을 끈 일반 명령에서 사용자 체감을 확인하고, 남은 문제는 장면·입력·단계별로 PARTIAL/notVerified를 유지한다. 사용 방법이 바뀐 경우에만 기존 한/영 README를 갱신한다.

## 4. 측정·수락 기준

### 4.1 비교 방법

P0에서 **Hermes / bytecode / optimized / Release**와 native inputs·실행 제품, 화면·창·DPI·모니터·주사율, semantics 설정, 입력 패턴과 cold/warm 조건을 고정한다. 변경 전후 성능은 같은 bytecode 조건에서 비교하며, 사용자의 일반 명령에서 문제를 재현하고 마지막에 같은 명령으로 확인하는 절차도 유지한다.

수락 장면은 **All Components 두 열의 일반 스크롤 no-hover / Button hover / TextField hover·focus와 입력·버튼 페이지의 전체 왕복**이다. 한 trial은 정지→시작→10초 이상 연속→왕복·반전→손을 뗀 뒤 재접촉을 포함한다. cold 첫 탐색·lazy load 중 새 child가 생성되는 구간은 별도 표시하고 일시적 jitter를 허용한다. 일반 사용 FPS와 함께 표본 수·측정 구간·관측 대상을 기록하며, 지연 생성이 끝난 뒤에도 지속되는 저하를 lazy load 예외로 분류하지 않는다.

원문 §10.9의 사용자 보정을 유지한다. 입력·버튼 페이지는 96px의 좁은 왕복 대신 현재 `maxScrollExtent`의 맨 위↔맨 아래 전체 왕복으로 비교한다. 일반 왕복은 편도 4초, warm 세 장면은 정지 후 편도 1.5초의 빠른 전체 왕복도 포함한다. focus 안정화 뒤 현재 extent를 읽고 실제 from/target/final·extent·viewport, 양 끝 도달·역방향·편집기 수명을 확인한다. 이 페이지의 네 장면과 All Components의 cold/warm을 같은 표본으로 섞지 않는다.

P0A는 같은 Widget 기능·자식 수·theme·키·캐시 정책에서 생성·갱신·제거를 비교한다. 구조 fixture의 비교 횟수·할당과 실제 RNW/Hermes timing은 구분한다. frame당/생성 Element당 할당을 정규화하고 phase 누적 할당·collection 수·관찰 가능한 GC 시간·복귀 후 live resource도 남긴다. 미관찰 개별 GC pause는 할당 감소율로 추정하지 않는다.

### 4.2 사용자 수락 기준 — 현재 모니터 설정·일반 사용 60fps

**60fps는 앱의 일반 사용 수락 기준이며 모니터를 60Hz로 설정하라는 뜻이 아니다.** 현재 주사율·해상도·배율·동적 주사율과 앱 cadence/cap을 관측 가능한 범위에서 기록한다. 설정을 바꾸거나 165fps 같은 모니터 최대 주사율을 수락 목표로 요구하지 않는다. 앱에 새로운 60fps 제한도 추가하지 않는다.

| 항목 | 수락·기록 방식 |
| --- | --- |
| 일반 스크롤·animation·hover/focus | 현재 모니터 설정에서 일반 사용의 지속적인 화면 갱신 **60fps 이상**이면 수용한다. 매 frame 16.67ms 이내 또는 모든 percentile 개선을 요구하지 않는다 |
| lazy load·cold 최초 생성 | 새 child가 만들어지는 동안의 **일시적 jitter는 수용**한다. 원인·구간·긴 frame은 별도 기록하며 이를 제거해야 수락하는 조건을 두지 않는다 |
| 생성 완료 뒤의 일반 사용 | 다시 일반 사용 60fps 기준으로 판단한다. 계속되는 정지·입력 불응·지속적인 60fps 미만을 lazy load 예외로 넘기지 않는다 |
| CPU·GPU·p95/p99·max·입력 지연 | 병목 분석과 후보 비교를 위한 진단값이다. 이전 10ms/16.67ms·cold 50ms·고주사율 target miss ≤1% 등의 수치를 필수 수락 기준으로 사용하지 않는다 |
| 입력·제출·수명 | 입력 누락·중복, stale publish, resource leak, shutdown failure 등 정합성 회귀가 없어야 한다 |
| 메모리 | 기존 child/Picture 예산과 같은 이동·복귀 후 live resource를 확인한다. lazy jitter 허용이 무제한 keep-alive·예산 확장을 뜻하지 않는다 |

FPS는 일반 사용의 연속 이동 구간에서 관측한 실제 갱신 수/시간과 대상(native surface·desktop 관측 등)을 함께 적는다. 정지·숨김·관찰 누락 구간을 FPS에 섞지 않고, lazy load는 별도 구간으로 보고해 제외 범위를 드러낸다. 제출 횟수·CPU callback 수·CPU 시간만으로 표시 FPS를 계산하지 않는다. native surface 갱신으로 평가했으면 **surface FPS**로 표기하고 scanout의 `notVerified`는 별도로 유지한다. scanout 추가 입증을 이번 일반 사용 수락의 필수 단계로 늘리지 않는다.

기존 `performanceAccepted=false`는 새 기준에서 실제 검증할 때까지 유지한다. 새 기준을 충족하면 관측 대상과 일반 사용 범위를 명시해 수락할 수 있으며, lazy jitter·미관찰 GC/GPU 세부 시간 때문에 자동으로 미수락 상태를 고정하지 않는다. 과거 실패·철회 기록과 `resizePerformanceAccepted=false`를 이 문서 수정만으로 다시 판정하지 않는다.

### 4.3 공통 엔진 후보의 채택 조건

- 한 후보씩 비교해 어느 공통 경로의 반복 작업·할당이 줄었는지 설명한다. 변경 없는 기준과 같은 기능·수명·현재 모니터 설정을 유지하고, 기존 기준 trial은 동일 제품 조건일 때 재사용한다. 필요한 대표 장면의 기준/후보 3쌍을 기본으로 하며 불필요한 반복은 늘리지 않는다.
- framework 변경은 의존성·재부모화·알림 중 수정·키 동등성·부분 실패를, 캐시 변경은 keep-alive/dormant·ticker·편집/semantics·eviction을, recording 변경은 외부 명령 격리·hold·rollback·retirement를 실제 변경에 맞춰 확인한다. 기존 Map/Set이나 캐시의 존재를 신규 개선 성과로 계산하지 않는다.
- 작업량 감소와 일반 사용 60fps·메모리·시각/입력 정합성을 함께 본다. 미세 fixture 개선만 확인됐거나 일반 사용이 지속적으로 60fps 미만이 되는 변경은 성능 개선으로 수락하지 않는다. p99/cold max의 일부 변화나 lazy load의 일시적 jitter만으로 자동 기각하지 않는다. 일반 사용 수락과 물리 입력·표시/scanout의 `notVerified`를 구분한다.

## 5. 실행 명령과 검증 경계

현재 locator는 §6의 probe 없는 일반 bytecode 제품을 가리킨다. 일반 명령은 최신 앱·SDK 입력을 검증해 같은 제품을 재사용하며, 입력이 바뀌었으면 실행 전에 자동 재빌드한다.

```powershell
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

`run:windows`는 마지막 package 설정을 유지한다. 재개 시 locator의 설정이 bytecode / optimized / Release가 아니면 아래 명시적 빌드로 맞춘 뒤 일반 실행을 사용한다. Static AOT 빌드로 진행하지 않는다.

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run build -- --engine hermes --hermes-mode bytecode --hermes-profile optimized --configuration Release
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

전환 뒤에는 일반 명령을 계속 사용한다. 실제 package manifest의 `cohort.engine=hermes`, `hermesExecutionMode=bytecode`, optimized/Release 설정과 실행 EXE·bytecode 식별을 확인한다. `test:windows-continuous-scroll`은 `.nelyx/windows/last-package.json`의 제품을 사용하므로 이 locator가 최신 bytecode package를 가리키는지도 먼저 확인한다.

직접 native 진단도 bytecode 모드를 명시하며 **모니터 설정을 변경하지 않는다.** 기존 동일 조건의 기준을 먼저 확인하고 필요한 CPU 비교만 3회 수행한다. stages·GC와 cold/lazy 상세 분석은 일반 사용 60fps 미달의 원인을 찾는 데 필요할 때만 선택한다. 아래 명령에 cold 장면이 포함돼도 그 일시적 jitter는 수락 실패로 계산하지 않는다.

```powershell
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --viewport maximized --scroll-scenes --scope cpu --repeat 3
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --viewport maximized --scroll-scenes --scope stages
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --viewport maximized --scroll-scenes --scope gc
```

입력·버튼 페이지의 전체 왕복 비교는 위 Gallery 진단과 분리해 아래 모드를 사용한다. 후보의 주요 병목 장면을 먼저 고르고 필요한 비교만 수행한다.

```powershell
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --viewport maximized --mixed-scroll-scenes --scope cpu --repeat 3
```

구현 뒤에는 변경 범위에 맞춰 다음 공통 회귀·타입·공급 검사를 선택한다. Static AOT 전용 검사나 AOT 실행을 추가하지 않는다. 이후 실제 실행 결과와 남은 범위는 이 문서에 짧게 갱신한다. 각 테스트 timeout은 저장소 지침대로 20분을 유지한다.

P0A의 구조 검증은 기존 [inherited lookup](Nelyx/eng/tests/inherited-lookup.test.mjs), [reconciliation](Nelyx/eng/tests/framework-reconciliation.test.mjs), [render 수명](Nelyx/eng/tests/render-tree-lifecycle.test.mjs), [bounded sliver](Nelyx/eng/tests/bounded-sliver.test.mjs), [dormant sliver](Nelyx/eng/tests/dormant-sliver.test.mjs), [frame recording](Nelyx/eng/tests/frame-recording.test.mjs)를 변경 계약에 맞춰 선택·보강한다. 아래 `test:scroll-engine`에 이미 포함된 fixture는 작은 묶음과 중복 실행하지 않는다. RNW transport를 바꾸면 `test:windows-semantics`를 추가한다. 문서만 갱신한 이번 검토에서는 이러한 실행을 시작하지 않는다.

```powershell
# P0A: framework/의존성만 바꿨을 때의 작은 묶음
npm.cmd run test:inherited-lookup

# clock·backpressure·입력 수명
npm.cmd run test:windows-animation
npm.cmd run test:native-paint-replay
npm.cmd run test:scroll-engine

# dirty paint·retained layer·geometry·반복 redraw
npm.cmd run test:paint-recording

# 실제 Windows 연속 OS wheel과 닫기 회귀
npm.cmd run test:windows-continuous-scroll

# 공통 Core 변경의 타입·공급 확인
npm.cmd run check:types
npm.cmd run test:runner-supply
git diff --check
```

특히 [`frame-visual-commit.test.mjs`](Nelyx/eng/tests/frame-visual-commit.test.mjs)의 unobserved admission 이후 explicit redraw, [`frame-backpressure.test.mjs`](Nelyx/eng/tests/frame-backpressure.test.mjs)의 forced/deferred 요청과 lease·busy 경합, [`repaint-isolation.test.mjs`](Nelyx/eng/tests/repaint-isolation.test.mjs)의 nested repaint, [`optional-sliver-work.test.mjs`](Nelyx/eng/tests/optional-sliver-work.test.mjs)의 deadline·선택 작업을 변경 계약에 맞게 보강한다. GPU/shadow를 바꾸면 `test:native-shadows`, native 공급·ABI를 바꾸면 해당 공급 검사도 추가한다. source test·빌드 통과를 물리 입력·표시 성능 PASS로 바꾸지 않는다.

[`copilot-instructions.md`](.github/copilot-instructions.md)의 임시 산출물·검증 로그·독립 설치본 누적 금지를 따른다. `Nelyx/docs/plans/`, `Nelyx/docs/migrations/`를 만들지 않으며 과거 archive를 새 checkpoint 저장소로 사용하지 않는다. baseline도 제품 전체 사본을 계속 쌓는 방식 대신 실행 중 비교 후 필요한 요약만 남긴다.

## 6. 실행 상태 — 2026-11-02

**종료 판정: 작업은 CLOSED, 성능 수락은 PARTIAL이다.** 공통 비용 후보는 구현·회귀 검사 상태이며, 실제 RNW 일반 사용 60fps를 충족하지 않아 성능 개선으로 최종 채택하지 않았다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 트랙패드·실제 한국어 IME·scanout `notVerified`를 유지한다. 아래는 종료 시 실행 기록이며, 해결·재판정은 work3에서 이어간다.

| 현재 일반 제품 | 식별 |
| --- | --- |
| 작업 트리 | HEAD `b2a9b70a49848224af13c0e281e7a84ce2abed15`, 변경은 미커밋·성능 미수락 후보 |
| 실행 | `npm.cmd run run:windows --workspace @nelyx/testbed-2`, Hermes bytecode / optimized / Release, HBC 99 |
| compiler policy | `windows-hermes-94aa5e1d-no-cfg-v1` |
| package manifest | `e40950929ba44af59fa70c2bfcb1503e0f5040667b457c48cb5bfbcce4de98dd` |
| EXE | `8d0789050a3edf481d60ee61f4180fef26f1abc17147ed3de192ae45479a8666` |
| bytecode bundle | `2612e8d3fd082a963b2d5cb8b1be80c4344367e0f901a042f1f7f5ef831f48e8` |
| native / SDK inputs | `264631e86c363796511abc2d6de4920050c32cea3ef8b2b73c8a6ebacb81badd` / `91800de8aefc10219e276c2bf1d7c56d1e07f96a22046e413058de068a5cbcca` |
| 원본 App source | `92d045b43f1316023328f5f2f0922f94e8f7395b9f499e29a84983eabb261bfb` |

- **최종 일반 FPS:** source probe·상세 native 로그·GDI 캡처를 끄고 2560×1459 physical / DPI 192에서 관찰했다. 입력 페이지 최대화/focus의 두 10초 구간은 `457 / 10.0235s = 45.59`, `416 / 10.0285s = 41.48 surface FPS`다. Gallery 최대화 좌열(pointer X 40%)은 두 5초 구간 `55.17 / 51.54`, 우열(X 80%)은 `50.28 / 51.36 surface FPS`였다. Gallery는 pointer motion을 포함했다. 모두 packet-defined 좁은 반전이며 전체 범위 성능·3쌍 수락 비교가 아니다. 모두 exit 0이지만 60fps 기준은 미달이다.
- **현재 제품의 기능·종료:** 입력 페이지에서 Unicode `Work2 한글` 입력 → OS wheel로 메시지 12까지 전체 이동 → 처음 복귀 → 재클릭 없이 ` after` 입력 → 전송·횟수 1 → 최소화/복원 시 값·상태 보존 → 초기화·Gallery 복귀·정상 종료를 확인했다. 별도 실제 OS wheel/close 회귀도 Material·ListView·Cupertino·입력 네 페이지 모두 exit 0, native drain 확인, hide `1.75–2.16ms`, close `181.88–272.36ms`로 통과했다. 이 회귀의 창 크기는 974×929 physical이며 native 로그·GDI 관찰을 켠 기능 검사다.
- **남은 최대화 liveness 실패:** 같은 현재 제품의 Gallery 우열(X 약 66.7%)에서 maximize/restore/maximize와 GDI 관찰을 더한 확장 검사는 선택 픽셀 영역의 최대 `751.40ms` 정지로 실패했다. native close exit 0·drain·hide `1.99ms`는 통과했다. 선택 영역의 정지와 전체 surface 정지 원인은 아직 분리하지 못했으며, 근거 없이 lazy jitter로 제외하지 않는다. 기존 창 크기의 네 페이지 통과와 이 실패를 구별한다.
- **최종 공통 회귀:** `test:paint-recording`, `test:scroll-engine` 290/290, `test:windows-animation` 28/28(bytecode), `test:native-paint-replay` 69/69, `test:windows-semantics` 12/12, RNW/FPS 29/29, 타입 검사와 공급 6/6이 통과했다. native supplier를 갱신한 뒤 실제 Windows 라이브러리의 direct/retained 그림자 연속성도 DPR 1/1.25/1.5/2에서 통과했다. Picture 64-entry / 32MiB, optional child 16 / Element 2,048, Gallery capacity 2와 CPU pending 1/native recording 2를 확대하지 않았다.
- **최종 Web/Android:** 같은 Core의 Web bundle `fb411567…`에서 Chrome catalog 49개·컨트롤·route/상태 검사가 통과했다. Android 재공급 시 Windows 그림자 보정의 private Skia 헤더 요구가 공개 SDK 빌드를 막는 것을 발견해 해당 보정을 Windows 경로로 한정했다. Android는 기존 Skia shadow 경로를 유지하며, Temurin 21.0.11로 최신 Release/x86_64 APK `bf20078f3ce1526452fc5d9159e85fd86c9a31e8b98fc7800e58c48e8279c6ac`를 다시 빌드했다. API 30 read-only 에뮬레이터에서 첫/마지막 편집기 입력·전송·전체 범위 복귀·값 보존·Home/복원 동일 PID·초기화·Back과 실제 화면을 확인했다. 임시 XML·화면·스크립트와 검증용 emulator-5580은 finally에서 정리했으며 기존 emulator-5554는 유지했다. 플랫폼 성능·물리 입력·한국어 IME 수락으로 확장하지 않는다.
- **최종 공급·정리:** 현재 Windows package/runtime 검증이 통과하고 일반 bytecode에 RNW probe marker가 없음을 확인했다. 추가한 recording metadata module은 root와 Windows/Web/Android 설치본의 SHA가 같으며 lint·format·diff 검사를 통과했다. 이번 중간 native 입력 `8a3ad1…`는 JSON 참조 0과 작업 소유·경로를 확인해 삭제했다. 작업 임시 디렉터리·스크립트·supply·dist staging과 실행 중인 Testbed·검증용 화면 키보드·작업 Metro worker는 남지 않았다.
- **다음 필수 작업:** 지속적인 RNW 60fps 미달과 최대화 Gallery의 위 liveness 실패를 해결한 뒤 §4.1의 전체 범위·hover/focus 장면과 대표 기준/후보 3쌍으로 재판정한다. 실제 한국어 조합도 계속 미관찰이다. 반복문 geometry·compiler 후보를 다시 켜거나 큐·캐시 예산을 늘려 실패를 가리지 않는다.

아래는 이번 실행의 후보·진단·철회 기록이다. probe 제품의 timing을 위 일반 제품의 성능 수락으로 사용하지 않는다.

- 착수 시 일반 명령으로 probe 없는 bytecode / optimized / Release 제품(bundle `c65deb…`, EXE `f98909…`, SDK `c507e4…`, native `ec2335…`)의 실행·정상 종료를 확인했다. 현재 모니터 설정은 변경하지 않았다.
- FPS 관찰을 보강했다. native 장면은 명시한 이동 구간의 전체 시간과 실제 copied content 수를 사용하고 정지 구간·중복 콘텐츠·갱신 없는 구간을 구분한다. 일반 RNW OS wheel 검사에는 native surface counter 관찰을 추가했다. 제출·callback·캡처 표본 수를 표시 FPS로 사용하지 않는다. 계산 회귀 13/13 통과.
- 변경 전 Gallery 새 프로세스 3회는 같은 host `b6f9fc…` / VM `de3140…` / 2560×1459 physical / DPI 192 / 보고된 165Hz에서 정상 종료했다. warm no-hover / button-hover / field-focus surface FPS의 trial 중앙값은 `79.94 / 79.48 / 75.49`다. 이 제품은 direct native 진단이며 실제 RNW 일반 제품 검증을 대신하지 않는다.
- P0A 후보는 다중 자식의 KeyMap을 첫 키를 만날 때 만들도록 제한했다. 키 검증의 선행 순서·사용자 equality/hash·GlobalKey·slot·update·실패 cleanup 경로는 유지한다. Core 287/287, paint 155/155, RNW/FPS 25/25, 공급 6/6과 타입 검사를 통과하고 일반 제품에 공급했다. 최종 채택 비교는 남았다.
- 입력·버튼 전체 범위 기준도 3회 수집했다. 그러나 **실제 RNW 최대화/focus·10초 OS wheel**은 화면 캡처·상세 로그를 끈 상태에서도 `38.03 / 36.99 surface FPS`라 수락 미달이다. direct native의 60fps 이상을 RNW 일반 사용 수락으로 확장하지 않는다. P4를 포함한 실제 RNW 추가 비용을 조사 중이다.
- 입력 페이지를 기존 OS wheel/close 회귀에 추가하면서, 정상 native drain 이후 늦은 React semantics packet이 닫힌 JS platform을 빌리는 오류를 발견했다. native close 시작 시 해당 peer를 먼저 퇴역시키고 정상 active 오류 전달은 유지하도록 수정했다. 일반 재빌드/종료와 Windows semantics 12/12가 통과했으며, 최종 네 페이지 close 회귀도 위 현재 상태처럼 통과했다.
- 일반 제품에서 한글 문자열 입력·전체 OS wheel 왕복·재클릭 없는 후속 입력·전송·횟수 1·최소화/복원·정상 종료를 확인했다. Unicode 문자열 입력은 실제 한국어 IME 조합 검증과 구분한다. 도구의 `Hangul` 키가 지원되지 않아 실제 조합은 `notVerified`다.
- 초기 Core의 Web build `de0132…`에서 Chrome의 49개 catalog·컨트롤·route/상태 검사가 통과했다. Android Release/x86_64 APK `667993…`는 API 30의 read-only 에뮬레이터에서 첫·마지막 편집기 입력·전송, 횟수 1, 전체 범위 왕복 뒤 값 보존, Home/복원 시 같은 PID·편집 값 보존, 초기화·Gallery/Back 복귀를 통과했다. 임시 XML·스크립트·화면과 에뮬레이터는 finally에서 정리했다. 최종 공통 후보 제품의 재공급·검증은 위 현재 상태를 따른다.
- 추가 RNW 진단의 JS callback 중앙값/p95는 약 `18.88/36.23ms`였고 UI 큐 지연은 작았다. identity paint 명령 생략 후보는 `39.76/37.80 surface FPS`, composition scope 계획 재사용을 더한 후보는 `40.46/35.93`으로 아직 수락 미달이다. 각 수치는 probe·GDI 캡처·상세 로그를 끈 실제 RNW의 두 10초 이동 구간이며 3쌍 수락 비교는 아니다. cache 재사용만으로 성능 향상을 확정하지 않는다.
- 닫힌 Path의 snapshot·wire record 수와 resource 없는 draw/clip/shadow 명령을 내부 소유 값에 한해 재사용했다. Path mutator·외부 frozen/getter·subclass 복사·image shader 독립 hold·custom record·closed Canvas 검사를 통과했다. 같은 native host/VM의 변경 전후 3회에서 frame당 할당 중앙값은 traverse/no-hover/button/focus 각각 `1,063,075→936,866 / 1,076,421→961,278 / 1,097,834→975,338 / 1,207,351→1,082,658 bytes`로 감소했다. surface FPS는 `72.17→70.98 / 64.78→56.77 / 64.01→63.87 / 61.32→61.56`으로 일관된 개선이 아니며, 빠른 개별 이동 구간의 60fps 미만도 남았다. 실제 RNW는 `41.08/41.13 surface FPS`여서 아직 성능 수락하지 않는다.
- RNW 기본 Babel의 class/super/spread lowering과 direct native의 기존 native Hermes frontend 차이를 비교했다. 동일 RNW compiler/HBC 99 제품에서 화면·그림자, 12개 편집기 전체 왕복 뒤 재클릭 없는 `Frontend 한글 after` 입력과 정상 종료는 통과했지만 `44.52/42.07 surface FPS`였다. 임시 Metro 설정은 finally에서 원복했으며 기본 변환기 교체를 성능 개선으로 채택하지 않았다.
- Path 후보의 RNW 진단은 같은 identity로 제출/producer/surface/retirement 831개를 연결했고 오류·실패·supersede는 0이었다. retained 표본의 owned callback 중앙값/p95는 `18.08/35.74ms`, input geometry `2.28/3.29ms`, geometry publication `1.40/1.82ms`, native submit 전체 `1.69/2.15ms`였다. 별도 native Hermes PC sampling에서는 입력 geometry 순회와 Layer detach/callback 경로가 관찰됐다. 표본 가중치는 CPU 밀리초나 RNW FPS로 환산하지 않는다.
- recorded Layer의 자식 제거를 위치 정보와 비어 있는 슬롯으로 처리하는 후보는 픽셀/retirement를 포함한 31개 검사를 통과했지만 실제 RNW `41.88/39.37 surface FPS`로 이득이 불분명해 철회했다. 별도 composition scope 계획 캐시도 철회하고 기존 전체 planning 경로를 복원했다.
- pinned compiler에서 CFG 최적화를 계속 제외하고 인라이닝만 켜는 후보는 실제 Core curve·행렬 bytecode 회귀 3개를 통과했지만 일반 RNW `42.32/38.69 surface FPS`로 개선이 없어 철회했다. workspace 정책을 기존 `windows-hermes-94aa5e1d-no-cfg-v1`으로 복원하고 해당 정책의 진단 빌드·정상 종료를 확인했다. native frontend는 이미 for-of를 보존하므로 별도 for-of 보존 변환기를 추가하려던 후보도 철회했다.
- captured resource ID의 key와 frame의 고유 resource 목록을 재사용하는 후보는 외부 getter·독립 lease·foreign owner 선행 검사·index 실패 cleanup 검사를 통과했다. 추가 RNW 진단에서는 798개 frame의 제출/producer/surface/retirement를 연결했고 오류·실패·supersede는 0, 정상 종료였다. callback 중앙값/p95 `18.82/36.40ms`, 그 안의 입력 dispatch `2.11/8.05ms`, 입력 이외 `15.62/33.42ms`로 입력 비용과 나머지 비용을 분리했다. 진단 제품의 OS wheel `35.81/36.15 surface FPS`는 일반 제품 수락값으로 사용하지 않는다.
- P4에서 기본 MouseRegion과 signal callback이 없는 기본 Listener의 wheel no-op dispatch만 생략하는 후보는 legacy callback·사용자 getter·prototype handler 교체·기존 local 좌표 검사 16/16을 통과했다. 원본 App과 기존 bytecode 정책의 일반 명령 재빌드·정상 종료는 통과했지만 `41.20/38.21 surface FPS`로 아직 개선을 수락하지 않는다.
- P5의 조건부 추가 후보로 private state program의 transform만 바뀔 때 접속을 유지하는 경로를 구현했다. 같은 명령의 모든 occurrence가 Picture 외부 state에 있고 동일한 새 값을 요구할 때만 적용한다. Root만 적용한 일반 제품은 `41.30/39.26 surface FPS`였고, 중첩 clip/effect와 기본 annotation 재사용까지 확장한 제품은 `43.49/39.99`였다. 진단에서 root/중첩 composition은 대부분 이미 재사용하지만 repaint boundary 약 2개가 매 frame 새 body를 만드는 것을 확인해 boundary 갱신에도 같은 검증을 적용했다. native Picture 하나를 감싼 identity Layer는 중복 compile을 피하며 기존 독립 hold를 유지한다. 외부 accessor·custom append/remove·Picture 내부 transform·공유 transform 충돌은 보수 경로다. paint 전체 166/166과 RNW 진단 15/15가 통과했다.
- boundary 확장 후 원본 App SHA `92d045…`와 기존 정책의 일반 명령으로 재공급/재빌드한 RNW(EXE `697235…`)는 최대화/focus 두 10초 구간에서 `45.00/43.09 surface FPS`, 정상 close exit 0이었다. 동일 2560×1459/DPI 192/165Hz이며 여전히 수락 미달이다. 추가 진단의 934개 source frame 중 transform 재사용은 770회, 제출/producer/surface/retirement는 914개씩이고 실패·supersede·오류는 0이었다. 이동 끝 retained 표본의 paint 중앙값은 직전 `3.37→2.45ms`, compose `2.38→2.36ms`, owned callback `17.60→17.04ms`였다. 이 두 10초 OS wheel은 packet-defined 좁은 반전이며 전체 페이지 성능 비교나 3쌍 수락 비교가 아니다.
- native 제출→producer의 약 11ms를 worker 대기·producer worker wall·UI 복귀 대기로 분리했다. 실제 RNW 832개 frame의 정상 종료/오류 0인 추가 진단에서 중앙값은 각각 `0.019 / 10.746 / 0.086ms`였다. source callback은 `16.84ms`, producer→surface는 `0.53ms`다. worker 작업이 큰 기여로 남으므로 큐를 늘리지 않고 Vulkan import·replay/submit·완료 대기·cleanup을 나누는 opt-in native 숫자 계측을 공급 중이다. 같은 frame identity와 기존 bounded RAM을 사용하며 GPU timestamp나 독립 GPU 실행 시간으로 해석하지 않는다.
- 위 계측을 native supplier `8a3ad1…`와 RNW에 공급한 진단은 901개 frame의 정상 종료/오류 0이었다. 이동 끝 retained 표본의 중앙값은 import `1.722ms`, replay/submit `0.806ms`, 완료 대기 `8.199ms`, cleanup `0.105ms`, context/recorder 준비 `0.073ms`다. 독립 GPU 시간은 계속 미관찰이다. 새로운 raster cache·import cache나 예산 확대는 아직 적용하지 않았다.
- 입력 geometry의 기본 child visitor만 반복문으로 실행하는 후보는 live child 배열 변경·custom visitor의 실패 후 재시도·sibling visibility를 포함한 검사를 통과했지만, 일반 제품은 `44.58/41.99 surface FPS`, 후속 RNW geometry 중앙값은 `2.38ms`여서 이득이 없었다. **NOT_ADOPTED / 소스 원복 완료.** callback 평균·기여 callback 간격의 진단을 추가했으나 between 값에는 idle/caret·다른 callback·폐기 작업이 포함되므로 clock 대기 시간으로 단정하지 않는다.
- pinned bytecode compiler의 CFG 정리를 SSA 변환 전에 한 번만 실행하는 별도 후보도 일반 제품 `44.80/42.36 surface FPS`로 이득이 없어 **NOT_ADOPTED / 소스·compiler 정책 원복 완료**다. 알려진 무한 루프 제어와 실제 Core curve/affine의 bytecode 회귀를 포함한 5/5는 통과했다. 정책이 다른 기존 package의 실행 거부를 확인했고, 명시한 bytecode / optimized / Release 재빌드 뒤 일반 명령으로 비교했다. 이후 기존 `windows-hermes-94aa5e1d-no-cfg-v1` 정책으로 RNW 진단 빌드를 다시 공급했다.
- 원복 뒤 RNW 진단에서 timer wake lateness 중앙값/p95는 `0.333/0.647ms`, JS dispatch queue는 `5.955/33.290ms`, owned callback은 `17.199/35.489ms`였다. native 900개 frame의 제출/producer/surface/retirement가 일치하고 실패·supersede·오류 0, 정상 종료였다. timer 정밀도 변경 근거가 없어 clock·credit 정책은 유지한다. native 완료 대기 중앙값 `7.719ms`는 worker wall 구간이며 독립 GPU 시간은 미관찰이다. 입력 후 100ms 이내 제출에 기여한 callback도 분리했지만 관찰 공백·다른 작업을 포함하므로 FPS·순수 idle로 사용하지 않는다.
- recording 비교 metadata는 구조 변경·빈 root·disposal 때 해당 recording에서 해제하도록 보강했다. 이전 frame의 독립 hold와 이동 가능한 live child recording은 유지하며, 다음 compose에서 조상 구조를 다시 검증한다. source 일반 제품에 남은 공통 변경은 **실험 후보 / 성능 미수락**이며 60fps 달성·3쌍 비교 없이 최종 채택으로 올리지 않는다.
- RNW 진단에는 입력 dispatch와 콜백 뒤 microtask까지의 간격, paint/recording/reuse 횟수를 구분해 추가했다. microtask 간격은 native polling·queued job을 포함하며 독립 React/GC CPU 시간으로 환산하지 않는다. 닫기 클릭이 적용되지 않아 마지막 retained 표본이 idle/caret 구간을 포함한 실행은 이동 구간의 전후 timing 비교에서 제외한다. 추가 direct native 실행은 foreground 확보 실패로 이동 표본 없이 종료돼 성능 비교에서 제외했고 임시 fixture를 정리했다.
- `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 트랙패드·실제 한국어 IME·scanout `notVerified`를 유지한다. 일반 제품 기능·종료 및 Web/Android 재검증을 성능 수락으로 올리지 않으며, 위 다음 필수 작업이 남았다.
