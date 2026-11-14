# Nelyx 결론 보고서 — 관측 결과에 대한 귀추적 추론

작성·개정일: **2026-11-14 KST**

검토 기준: checkout `ff42f46`, [기술 검토 보고서](report.md), [W11 설계·판정 기준](work11.md), [W11-1 구현·측정 기록](work11-1.md), 현재 구현

범위: **Windows Original App의 기존 데이터와 코드에서 가장 설명력 있는 가설을 선택한다. 신규 성능 측정·구현 변경·중단된 작업의 재개는 하지 않았다.**

## 1. 결론부터: 가장 설득력 있는 설명은 새 콘텐츠의 공급 지연이다

**현재 가장 설명력이 높은 가설은 “화면을 계속 그리지 못한다”가 아니라, “새 UI를 사용할 수 있게 만드는 선행 작업이 필요한 시점을 놓치고, coverage 보호가 그 지연을 표시 offset의 정체와 후속 추종으로 드러낸다”는 것이다.** 그 선행 작업 중에서는 실제 긴 구간이 관측된 **App의 동기 Source 생성·투영을 첫 조사 대상으로 선택**한다.

이는 원인을 모두 확인했다는 선언이 아니다. 다만 모든 후보를 같은 무게로 나열하는 대신, 다음과 같이 판단을 구분한다.

| 판단 | 현재 지위 | 이유 |
| --- | --- | --- |
| 최신 공급은 성능 수락 기준에 미달한다 | **확인된 결과** | 이동 지연·offset 정체가 정해 둔 문턱을 초과 |
| 새 콘텐츠의 가용 시점과 coverage 제한의 결합이 정체를 설명한다 | **우선 채택할 잠정 설명** | 게시 지속·준비된 구간의 짧은 지연·cold 비용·실제 제한 코드가 함께 부합 |
| 그 지연의 주된 발생지는 App의 선행 생산 작업이다 | **먼저 검증할 하위 가설** | 긴 build·capture와 실행 모드 차이라는 직접 단서가 있으나 동일 정체와의 인과 연결은 미완성 |
| GC 하나, Hermes 하나 또는 GPU 하나가 전체 실패의 원인이다 | **단독 설명으로 채택하지 않음** | 각각으로 모든 관측을 설명할 증거가 부족 |

따라서 권고는 **기존 엔진을 버리는 것보다 새 내용의 생성부터 사용 가능해질 때까지의 임계경로를 줄이는 것**이다. App이 주 병목이라는 가설이 틀리면 Content·Core·활성화 경계로 우선순위를 바꾼다. 성능 수락 보류는 확정적이지만, 전면 재설계의 필요성까지 확정적이지는 않다.

## 2. 추론 방법: 설명을 선택하되 뒤집을 조건도 정한다

귀추법(abduction)은 **관측된 결과를 가장 잘 설명하는 원인을 잠정 선택하는 추론**이다. “이 원인이 있으면 이런 현상이 가능하다”는 코드 경로의 발견만으로 “실제 원인이 이것이다”라고 확정하지 않는다.

이 보고서는 다음을 구분한다.

- **관측:** 실제 실행 기록의 수치·실패·성공. 측정한 범위 안의 사실이다.
- **메커니즘:** 코드상 가능한 실행·대기·수명 경로. 해당 실행에서의 비용 크기까지 증명하지 않는다.
- **귀추적 판단:** 여러 관측을 함께 설명하면서 추가 가정이 적은 가설의 선택이다.
- **검증 예측:** 그 가설이 맞으면 새로 보여야 할 현상과, 우선순위를 낮추게 할 반대 결과다.

평가 기준은 **관측의 포괄성, 경쟁 설명과의 구별력, 코드와의 일치, 추가 가정의 수, 반증 가능성**이다. 근거 없는 확률·기여율은 부여하지 않는다. 같은 구현 계보에서 반복된 실패는 독립된 실험 여러 개처럼 세지 않으며, 단순한 성공·실패 횟수로 가설의 신뢰도를 누적하지 않는다.

## 3. 설명해야 할 관측

### 3.1 최신 공급: 입력과 게시는 이어지지만 이동은 늦다

[§13.31 Calendar](work11-1.md#1331-public-staticinstance-private-field의-native-저장소-후보--통합-기능-pass-calendarfast-성능-fail)는 **360 updates / 2,000.453ms / 180Hz 입력으로 12개월 이동**한 일반 실행이다. 입력 시계만 3배속이며 거리·표본·animation·resident/lead는 유지했다. **180Hz는 입력 표본 속도이지 180fps 표시 요구가 아니다.**

| 증거 | 관측 | 설명에 주는 제약 |
| --- | --- | --- |
| **E1 · 이동 실패** | 이동 게시 지연 p95/최대 **200.279/241.915ms**, offset 정체 **최대 234ms / 100ms 이상 11회**. 입력 **360/360 반영·누락·거부 0**, 지정 기능·종료 PASS | 입력을 최종적으로 반영하는 능력과 제때 이동하는 능력은 다름 |
| **E2 · 게시와 App의 비대칭** | publication gap 최대 **26.819ms**, 활성 App turn p95/최대 **145.279/165.368ms**, 입력 driver lateness 최대 **0.792ms** | 전체 Render가 200ms급으로 멈췄다는 단독 설명보다, 게시와 이동 가능 상태가 분리된 설명에 부합 |
| **E3 · 긴 cold 준비** | 한 pass의 build/capture/scene **78.705/43.249/53.054ms**, wait **19.752ms**, 신규/captured entry **784/827**, App 투영 `paragraphPreparations` **76** | App 측 선행 비용은 가상의 문제가 아님. 다만 이 pass가 최대 정체를 만들었다는 인과는 미확인 |

같은 공급의 **Fast 역방향 24개월**도 기능은 PASS지만 offset 정체 **최대 246ms / 100ms 이상 4회**로 FAIL이다. 비단조 궤적의 이동 p95는 `notVerified`다. 두 실행의 ring/output loss는 0으로 기록됐다.

E3의 build·capture는 각각 60Hz 한 표시 주기보다 길지만 **순수 JS CPU 시간은 아니다.** native 호출·GC·대기가 포함될 수 있고 scene은 비동기 처리도 포함한다. 이 값들을 더해 234ms를 설명하거나, 서로 다른 구간의 최대값을 합산하지 않는다. 784/827은 [capture entry 카운터](Nelyx/runtime/app/capture.ts)이며 Widget 전체 수·Core nodeCount가 아니다. 76도 [App 투영 카운터](Nelyx/runtime/app/host.ts)이지 Content의 SkParagraph 실행 횟수가 아니다.

### 3.2 이전 대조: 무엇이 달라지면 현상도 달라지는가

| 증거·출처 | 관측 | 추론의 범위 |
| --- | --- | --- |
| **E4 · 준비된 구간**, [§13.17](work11-1.md#1317-같은-source의-실제-native-unitbytecode-대조--기능-pass--성능-fail) | 네 Contact의 최대 입력→게시 지연 **26.521/13.338/12.034/15.408ms** | 준비된 내용의 이동은 짧은 지연으로 가능했다. cold와 이동 범위·궤적까지 통제한 단일 변수 실험은 아님 |
| **E5 · native/HBC**, 같은 §13.17 | 같은 App/engine에서 이동 p95 **237.218/379.392ms**, 양쪽 성능 FAIL | 실행 모드는 영향을 줄 수 있지만 이 native 전환은 충분한 해법이 아니었음. 각 1회 대조로 보편적 개선율을 정하지 않음 |
| **E6 · 할당·GC**, [§13.27](work11-1.md#1327-기존-source-시각과-같은-app-owner의-힙-관측-연결--진단-pass--일반-성능-fail) | 한 build **119.873ms / 12,511,600 bytes 할당 증가 / GC 완료 4회**. runtime 누적 GC **556.026ms**, 최대 단일 pause **13.948ms** | 메모리 비용을 조사할 직접 근거. 최신 공급의 GC 비율이나 234ms 정체의 원인은 아님 |
| **E7 · 국소 작업 축소**, [§13.30](work11-1.md#1330-fitted-grid의-소유-숫자-식-공유--반복-할당-감소-확인--전체-성능-fail)·[§13.31](work11-1.md#1331-public-staticinstance-private-field의-native-저장소-후보--통합-기능-pass-calendarfast-성능-fail) | 42셀 내부 숫자 graph 소유 객체 **1,175→241**, App JS의 private get helper textual 호출 지점 **4,009→20**. 전체 성능은 FAIL | 해당 중복 제거는 실제 성과. 전체 실행비용·GC·스크롤 개선율로 환산할 수 없음 |
| **E8 · 물리 피드백**, [§12.7](work11-1.md#127-실제-트랙패드-확인과-최종-경계) | 사용자가 빠른 트랙패드 스크롤의 멈춤·점프를 보고 | 검사 도구만의 착시라는 설명을 약화. 최신 공급의 물리 재검증은 아님 |
| **E9 · V8 비교 미완료**, [§13.33](work11-1.md#1333-v8-jit-직접-host-진단과-사용자-요청에-따른-정지--paused--partial) | 진단 host 빌드·Demo 모듈 초기화 PASS, GUI는 app-ready 전 실패 | **V8의 스크롤 성능에 관한 증거는 없음**. 빠르다·느리다 어느 쪽으로도 갱신하지 않음 |

[§12.3의 field/helper × direct/reference 네 조합](work11-1.md#123-source와-projection의-같은-공급-비교)도 모두 기능 PASS·성능 FAIL이며 각 1회 대조의 순위는 일관되지 않았다. 서로 다른 공급·시나리오의 숫자를 시간순 개선 추세로 연결하지 않는다.

## 4. 경쟁 가설의 비교

### 4.1 어느 경계가 지연을 주도하는가

아래 가설은 **지배적인 지연 위치**에 대한 비교다. 여러 구간이 동시에 느릴 수 있으므로 배타적인 원인 목록으로 읽지 않는다.

| 가설 | 설명력과 현재 근거 | 약점·반대 관측 | 잠정 판단 |
| --- | --- | --- | --- |
| **H-A · App 선행 생산 지연**: 동기 Source 생성·투영이 새 coverage의 공급을 늦춤 | E3의 긴 실제 구간, E4의 준비 상태별 차이, E5의 실행 모드 민감도를 함께 설명. 새 내용 공급이 늦으면 게시 지속 중 정체도 가능 | E3가 해당 정체의 필수 선행 작업이었는지 미연결. App 종료 뒤의 대기가 더 클 수 있음 | **첫 조사 대상으로 채택. 주원인 확정은 아님** |
| **H-B · 하류 준비 지연**: Core·Content·provider의 queue·잠금·문단·기록 작업이 주도 | E1·E2·E4와 양립하며 App이 끝나도 이동하지 못하는 현상을 설명할 수 있음 | 최신 정체에서 각 경계의 기여 시간을 제시한 근거가 없음 | **주요 경쟁 설명으로 유지. H-A와 같은 시간축에서 비교** |
| **H-C · 준비·활성화 계약 문제**: 필요한 내용은 준비됐지만 cohort·coverage·활성화 연결의 지연 또는 오류로 사용되지 못함 | 게시와 offset의 분리를 설명할 수 있음. 계산량 축소만으로 해결되지 않을 가능성 | 해당 정체 전에 유효한 내용이 이미 준비됐다는 직접 증거가 없음 | **배제하지 않음. 준비 완료가 확인되면 우선순위를 높임** |
| **H-D · 전체 Render/GPU 정지 하나로 설명** | 이전 물리 실행의 긴 publication gap 일부와는 부합 | 최신 E2의 짧은 publication gap과 큰 offset 정체, E4를 함께 설명하기 어려움 | **최신 실패의 단독 설명으로는 우선순위를 낮춤** |
| **H-E · 입력 누락·주입 지연·진단 착시만의 문제** | 검사·시계 오류라면 지연을 잘못 판정할 수 있음 | E1의 반영·loss 기록, E2의 작은 driver lateness, 일반 실행과 E8의 물리 실패가 반대 근거 | **현재 현상의 단독 설명으로는 낮음** |

H-A를 먼저 선택하는 이유는 “Source가 원래 느릴 것”이라는 선입견이 아니라 **실제로 긴 App 구간과 실행 모드 차이가 관측됐기 때문**이다. 다만 시간 인과가 연결되지 않아 H-B를 크게 열등한 설명으로 판정할 근거는 없다. GPU가 Content 준비에 영향을 주거나 입력·관찰 오류가 일부 섞일 가능성도 위 표만으로 제거하지 않는다.

### 4.2 GC·VM은 구조 가설과 경쟁하는 별개의 원인이 아니다

**H-A가 지연 위치라면, GC·allocator·동기 native 작업·언어 실행 방식은 그 위치가 비싸지는 이유의 후보**다. “구조 문제인가, GC 문제인가”라는 양자택일은 잘못된 비교다.

| 하위 설명 | 지지하는 단서 | 현재 선택할 수 있는 결론 |
| --- | --- | --- |
| 실제 Source·투영 작업량이 큼 | E3, E7 이후에도 남은 긴 구간 | 더 넓은 작업량 축소를 검토할 이유는 있음. 남은 비용 전부가 필수 객체 생성이라는 뜻은 아님 |
| VM의 단위 실행비용이 큼 | E5의 같은 Source native/HBC 차이 | VM·실행 모드가 영향을 줄 가능성. Hermes 결함·부적합 또는 JIT만의 해법은 미입증 |
| 할당·GC·회수가 준비 지연을 키움 | E6와 수거·외부 버퍼 finalizer 경로 | 조사 가치가 높음. 지배적인 기여율·최신 공급의 동일 패턴은 미확인 |
| App의 동기 native 작업이 큼 | [동기 문단 API](Nelyx/engine/platform/common/app_text_jsi.hpp)와 [App 호출부](Nelyx/runtime/app/text.ts) | App elapsed를 순수 JS로 해석하지 말아야 함. 실제 실행 시간 비중은 미측정 |

GC가 크지 않으면 GC 패치 없이 다른 경로로 진행할 수 있다. 반대로 Source 작업량이 많더라도 회수·잠금 개선만으로 기한을 맞출 여지는 남는다. 어느 한쪽을 먼저 입증하거나 수정해야만 다른 설명을 검토할 수 있는 것은 아니다.

## 5. 우선 설명의 인과 구조와 한계

### 5.1 관측에서 가설로 이어지는 논증

1. **E1은 최종 도착과 적시 반응의 분리를 보여 준다.** 입력 누락이나 최종 결과만으로는 사용감 실패를 설명하거나 반박할 수 없다.
2. **E2는 프레임 게시와 표시 위치의 갱신이 다른 조건에 의존함을 시사한다.** 전체 렌더링 중단을 가정하지 않아도 정체가 발생할 설명이 필요하다.
3. **E4는 이미 준비된 내용의 이동 경로가 항상 느린 것은 아님을 보여 준다.** 통제 실험은 아니지만 “모든 입력·그리기가 본질적으로 느리다”보다 새 내용 준비를 우선 의심하게 한다.
4. **E3는 새 내용을 위한 App 선행 작업이 실제로 길다는 단서다.** E5의 실행 모드 차이는 이 작업의 실행비용도 중요할 수 있음을 보탠다.
5. **coverage 제한 코드는 이 비용이 정체로 나타날 수 있는 연결 메커니즘을 제공한다.** 표시 가능한 범위가 늘지 않으면 입력 목표는 진행해도 표시 offset은 제한될 수 있다.

이 다섯 항목을 함께 설명하는 잠정 모델은 다음과 같다.

> 새 내용 요구 → App의 생성·투영 및 Content 준비 → 유효 coverage의 가용 시점 지연 → 표시 offset 제한 → 준비 후 남은 목표를 추종

이 모델은 **확인되지 않은 200ms급 단일 GC pause나 전체 GPU 중단을 새로 가정하지 않고도** 주요 관측을 설명한다는 점에서 우선한다. 다만 “새 내용이 늦어서 정체했다”를 관측 없이 되풀이하면 설명이 아니라 재진술이 된다. 따라서 **필요한 내용이 실제로 언제 준비됐고, 무엇이 그 완료를 늦췄는지**를 확인해야 하며 §6의 반증 조건을 둔다.

### 5.2 코드가 뒷받침하는 부분과 뒷받침하지 않는 부분

| 구현 근거 | 확인한 메커니즘 | 이 근거만으로 주장할 수 없는 것 |
| --- | --- | --- |
| [App host](Nelyx/runtime/app/host.ts)·[capture](Nelyx/runtime/app/capture.ts) | build·render tree 동기화·capture에 연속 동기 구간이 있음. Promise가 내부 작업을 자동 분할하지 않음 | 모든 입력·렌더 프레임이 Source rebuild를 기다린다는 주장 |
| [scheduler](Nelyx/engine/core/scheduler/scheduler.cpp) | 요청 위치와 표시 offset을 구분하고 coverage 밖 이동을 제한·후속 처리 | 최신 234ms 정체 전부가 이 분기를 거쳤다는 주장 |
| [Core protocol](Nelyx/engine/core/protocol/engine.cpp)·[Windows host](Nelyx/engine/platform/windows/host.cpp) | accepted·layout ready·providerReady·active·published가 구별됨. Core는 공유 mutex를 쓰며 transaction staging은 이미 잠금 밖에서 실행 | Core가 독립된 다섯 번째 스레드이거나 모든 native 작업이 하나의 잠금 안에 있다는 주장 |
| [App의 `waitForContent`](Nelyx/runtime/app/host.ts) | 일부 후속 invalidation은 게시를 기다리지만 유효한 layout build 요청은 예외 | 모든 작업이 무조건 직렬이거나 장벽 삭제만으로 안전하게 해결된다는 주장 |

coverage의 `needChildren`과 Content layout의 `layoutBuildRequest`는 같은 요청이 아니다. **최신 demand 생성→Source→Content ready→activation→publication의 전체 인과 연결은 여전히 `notVerified`**다. H-A가 그럴듯하다는 판단은 이 누락을 채운 것으로 간주하지 않는다.

### 5.3 기존 최적화의 실패가 뜻하는 것

E7과 네 조합 대조는 **그 수정만으로는 충분하지 않았음**을 보여 준다. 이것으로 전체 최적화 가능성이 소진됐거나, 원래 Flutter 의미의 보존 자체가 불가능하다고 추론할 수는 없다. 수정한 비용이 임계경로의 작은 일부였거나, 개선이 다른 구간에 가려졌거나, 대조 변동이 컸을 수 있다.

동시에 “helper를 더 없애면 언젠가 해결될 것”도 근거 없는 확장이다. **국소 감소량을 성과로 인정하되, 다음 후보는 전체 임계경로를 줄일 이유가 있는 경우에만 선택**하는 것이 현재 증거에 맞다.

## 6. 이 설명을 뒤집거나 구체화할 관측

다음은 **후속 검증의 예측이며 이번에 실행한 결과가 아니다.** 가장 구별력이 높은 것은 더 많은 평균값이 아니라, 같은 정체에서 요청 위치·유효 coverage·App 작업·준비·활성화의 선후 관계다.

| 검증할 예측 | 가설을 지지하는 관측 | 우선순위를 바꿀 관측 |
| --- | --- | --- |
| **P1 · 실제 coverage 대기인가** | 진행해야 하는 정체 동안 목표는 coverage 밖이고 표시 offset은 해당 경계에 제한됨. 유효 범위 확장·활성화 뒤 이동 재개 | 같은 document·metrics·device·font 조건의 충분한 coverage가 이미 active인데도 정체. 공급 지연 설명을 낮추고 H-C·입력/표시 계약을 조사 |
| **P2 · App이 기한을 놓치게 하는가** | 해당 coverage에 필수인 App 작업이 늦게 끝나며, 그 경로만 줄인 대조에서 coverage도 앞당겨지고 정체가 감소 | 필요한 App 응답은 충분히 일찍 끝났지만 Content·활성화 대기가 길게 남음. H-B/H-C를 우선 |
| **P3 · GC·회수가 큰 부분인가** | 같은 실패 구간의 수거·진입 대기·finalizer/native 해제가 임계경로의 상당 부분을 차지하고 해당 경로 개선이 준비를 앞당김 | 비용의 겹침을 제외해도 기여가 작음. GC 가설의 우선순위를 낮추고 GC 패치를 필수 단계로 삼지 않음 |
| **P4 · 하류 준비가 지배하는가** | App 제출 이후 queue·Core lock wait/held·Content measure/record가 준비 지연을 주도 | 이 구간은 짧고 필요한 App 결과의 도착을 기다림. H-A를 강화 |
| **P5 · 실행 모델을 바꾸면 충분한가** | 같은 앱·의미·입력·Core·메모리 계약의 다른 runtime에서 준비와 이동 기준을 함께 충족 | Source 일부만 짧아지고 정체는 유지. VM 단독 해법을 낮추고 남은 준비·활성화 경로를 조사 |

**최소 확인은 P1·P2와 P4를 같은 시간축에서 연결하는 것**이다. [기존 host trace](Nelyx/engine/platform/windows/host.cpp)의 `queueMs`·`lockWaitMs`·`lockHeldMs`와 Content의 `measureMs`·`recordMs`, 기존 pass/document/preparation/publication 식별자를 먼저 사용한다. 필요한 누락 경계만 추가하며 중첩 시간은 합집합으로 처리한다. GC 시간을 뺀 elapsed도 자동으로 CPU self time이 되지는 않는다.

상관만으로 원인을 확정하지 않고, 가설이 지정한 경로 하나만 바꾼 대조가 실제 준비 시점과 offset에 영향을 주는지 확인한다. 준비 기한을 넘는 병목은 여러 개일 수 있으므로 개선량과 정체 감소가 선형 비례해야 한다고 요구하지 않는다. V8 비교는 이 판단을 바꿀 수 있을 때만 제한적으로 진행하며 필수 선행 작업으로 두지 않는다.

## 7. 귀추적 판단에서 도출되는 설계 결정

### 7.1 지금 선택할 것과 선택하지 않을 것

| 결정 | 근거와 적용 조건 |
| --- | --- |
| **제품·성능 수락은 보류** | E1의 명시적 실패. 기능 PASS·최종 도착·높은 게시 빈도로 대체할 수 없음 |
| **기존 Core·플랫폼 자산은 우선 보존** | E4와 실제 실행·재사용 성과가 있음. 전면 폐기가 준비 지연을 제거한다는 증거는 없음 |
| **다음 수정은 임계경로의 설명에 연결** | H-A면 Source·투영·동기 native, 회수 기여가 크면 수명/할당, H-B면 하류 준비, H-C면 cohort·활성화 계약을 수정 |
| **UI 생성 모델 변경은 조건부** | App의 일반 생성·변환 작업량이 핵심으로 남고 작은 수정으로 목표를 맞추기 어렵다는 근거가 생길 때 |
| **VM 교체·GC 설정·GPU 교체를 선결론으로 삼지 않음** | 해당 경로의 기여와 같은 앱의 수락 결과가 아직 없음 |

이미 [dirty rebuild](Nelyx/src/framework/widgets/framework.ts), [capture 재사용](Nelyx/runtime/app/capture.ts), [직접 binding](Nelyx/runtime/engine-client/scene.ts), [native fitted-grid](Nelyx/runtime/app/grid.ts), [Document](Nelyx/engine/core/scene/document.hpp)·[PagedStorage](Nelyx/engine/core/scene/paged_storage.hpp)의 공유/COW, [native Frame 전달](Nelyx/engine/core/protocol/engine.cpp)이 존재한다. **“retained로 바꾸자”, “달력을 C++로 배치하자”, “프레임마다 JS를 없애자”만으로는 새 해법이 되지 않는다.** 전체 zero-copy라는 뜻도 아니다.

유지 대상은 검증한 범위의 layout·입력·scroll·hit test·문단·자원 수명, Windows IME/UIA·표면·종료 계약, TS 비즈니스·날짜 의미와 기능 fixture다. 보존은 무결점 선언이 아니라 이미 확보한 성과와 재구현 비용을 고려한 결정이다.

### 7.2 H-A가 남으면 생성 이전의 표현을 바꾼다

TypeScript UI SDK를 유지하면서 H-A가 핵심으로 남는다면 **반복 UI의 정적 구조와 데이터를 분리해, 새 항목마다 생성·변환하는 비공개 표현을 실제로 줄이는 모델**이 합리적인 다음 후보가 된다. 이미 만든 RenderObject를 더 빠르게 보내는 것과는 다른 변경이다.

단, 현재 증거로 Widget·State·callback 자체의 제거가 필수라고 결론내리지는 않는다. 공개 identity·State/Key 수명·callback 순서·Focus·Semantics·키보드·locale/RTL을 유지하고, 계약을 바꾸면 opt-in·버전·지원 범위를 드러내야 한다. 임의 builder·날짜 predicate·테마 resolver가 자동으로 native로 이전된다고 가정하지 않는다.

달력 특수 C++ 화면 하나보다 **같은 모델이 가변 길이 텍스트 목록에도 적용되는지**가 SDK 방향의 더 강한 근거다. 새 모델이 결국 같은 Source graph로 돌아가거나 원래 경로에서만 핵심 기능이 동작한다면 확대 근거가 약해진다.

### 7.3 제품 목적과 기술 원인을 혼동하지 않는다

[프로젝트 목적](README.ko.md)처럼 SDK 자체가 목표라면 선택적 재설계의 연구 가치가 있다. 반대로 앱 출시가 우선이고 TypeScript UI가 필수가 아니라면 **Flutter/Dart를 우선 평가**할 수 있다. 자체 변환기·TS 프레임워크·투영 경계를 유지할 이유가 줄어들기 때문이다.

이는 **유지 책임과 이전 비용에 관한 의사결정이지, Flutter가 이 앱에서 더 빠르다는 실험 결과가 아니다.** Flutter도 GC를 쓰며 전환은 GC 제거가 아니다. 필수 기능·플러그인·TS UI 이전과 동일 시나리오 성능을 별도로 평가해야 한다.

## 8. 추론의 경계와 현재 상태

### 8.1 GC·AOT·V8에 관한 과잉 해석을 제한한다

- **E6은 과거 별도 profiling이다.** §13.31 field 변경 후 heap 재관측은 없다. 누적 allocation은 live bytes·누수량이 아니며 GC 완료 수는 정지 횟수가 아니다. runtime 누적 GC 시간을 짧은 profile 길이로 나눠 점유율을 계산하지 않는다.
- [Hades slow path](.nelyx/windows-hermes/source/lib/VM/gcs/HadesGC.cpp)는 수거 통계 시작 전 background pause·잠금 대기를 거칠 수 있다. [응답 backing](Nelyx/engine/platform/windows/host.cpp)의 finalizer 수명도 native 해제와 연결된다. 따라서 짧은 최대 pause로 GC 관련 대기 전부를 배제하지 않는다. 동시에 경로의 존재로 긴 대기·누수·234ms 단일 정지를 입증했다고 하지 않는다.
- [App 문단](Nelyx/runtime/app/text.ts)의 명시적 release·Core snapshot·GPU retirement는 서로 다른 수명이다. 모든 native 자원을 JS GC 문제로 묶지 않는다.
- [현재 native unit](Nelyx/sdk/tooling/cli/src/engine-v2-native-unit.mjs)은 `typed: false`, `requireNumeric: false`의 실제 기계어 실행이지만 같은 Hermes 객체·GC를 쓴다. “bytecode 해석만의 문제”나 “AOT 실패가 GC를 반증한다”는 추론은 성립하지 않는다.
- [Windows toolchain](Nelyx/sdk/tooling/cli/src/windows-native-hermes-toolchain.mjs)은 JIT를 끄며 고정 Windows x64 공급을 옵션 하나로 optimizing JIT로 바꿀 수 있는 상황이 아니다. 다른 VM에서 차이가 나더라도 JIT·GC·allocator·외부 메모리·host 차이를 구분해야 한다.
- E9의 V8 startup 실패에는 [Scene 관찰](Nelyx/runtime/engine-client/scene.ts)의 publication 부재 응답과 [App metrics 관찰](Nelyx/runtime/app/host.ts)의 live state 요구가 섞일 수 있다는 별도 가설이 있다. callback 원본은 없어 확정 원인이 아니며 **Hermes 스크롤 정체의 원인 증거로 전용하지 않는다.**

### 8.2 공급·플랫폼·작업 상태

| 항목 | 기준 |
| --- | --- |
| 최신 일반 실행 / 마지막 작업 지점 | [§13.31 Calendar·Fast](work11-1.md#1331-public-staticinstance-private-field의-native-저장소-후보--통합-기능-pass-calendarfast-성능-fail) / [§13.33 V8 진단 중단](work11-1.md#1333-v8-jit-직접-host-진단과-사용자-요청에-따른-정지--paused--partial) |
| Engine source SHA-256 | `7fde85bf683331939cbefdd47c0a1fb417805db05f37a3f1dec29e15c56ebf1a` |
| Demo Windows JS SHA-256 | `c296ecf9b217df968cc2e17adf2edd7d76e086cd392314b8d8cf2dde8f1be360` |
| 실행·공급 자격 | Demo는 명시적 SH native unit 후보. Testbed HBC·일반 빌드 기본값과 구분. [Engine manifest](Nelyx/engine/dist/engine-manifest.json)는 `host-integration-candidate` |
| 작업·수락 상태 | **`PAUSED / PARTIAL`**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false` |

[App manifest](sample/nelyx-demo-app/engine-v2/dist/v2-windows/app-manifest.json)의 공급·Source 식별자와 App JS 해시는 기존 기록과 대조했지만 전체 바이너리·runtime 재검증은 아니다. 이번 개정은 기존 증거의 해석·구성 변경이지 새 관측의 추가가 아니다. 현재 공급의 Reversal·Contact·Web UI·heap을 다시 실행한 것으로 표시하지 않는다. 좁은 기능 PASS는 전체 호환 완료가 아니며, 전체 미수락이 모든 기능의 실패를 뜻하지도 않는다.

[v2 공급 도구](Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs)의 대상은 Windows/Web/Android다. [별도 Apple runner](Nelyx/sdk/tooling/cli/src/apple-runner.mjs)의 존재가 v2 iOS 완성을 뜻하지 않는다. 일반 iOS 대상의 no-JIT/native 배포 경로는 Hermes 종속성을 뜻하지 않지만, Windows 성공도 iOS 실행·서명·배포·성능을 보장하지 않는다. Web 기능 검사 역시 Windows 성능의 반증이나 다른 플랫폼 성능의 입증이 아니다.

### 8.3 가설 채택과 제품 수락은 다른 기준이다

가설은 상대적으로 더 잘 설명하면 조사 우선순위로 채택할 수 있다. **제품 수락은 실제로 정해 둔 기준을 통과해야 한다.** [기존 기준](work11.md#63-새-성능-판정안)은 표시 주기 $T$에 대해 이동을 반영한 게시 지연 **p95 $\le 2T$, 최대 $\le 4T$**, 진행해야 하는 구간의 **offset 무진행 100ms 이상 0회**다. 60Hz에서 $T=1000/60\,\mathrm{ms}$이므로 약 33.3/66.7ms다.

정지 명령·끝 경계·델타 0·정상 반전 순간은 제외하고, 기존 3배속 입력·거리·resident/lead·animation 조건을 유지한다. 준비된 구간과 새 내용 구간을 나눠 판단하며 missing·loss·overwrite가 판정에 영향을 주면 `notVerified`다. FPS·입력 접수·`consumedThrough`만으로 이동 완료를 세지 않는다.

공개 동작·전체 setter/API·adapter·UIA 소비자, 원본 visual·물리 트랙패드·resize·실제 표시와 다른 플랫폼의 기존 의무는 남는다. software publication은 scanout이 아니다. 준비 창 확대·입력 감속·placeholder·callback/접근성 생략은 별도 계약 변경이며 동일 조건의 해결로 계산하지 않는다.

후속 검사는 20분 timeout과 필요한 반복만 사용하며 보통 30회 이내로 확인한다. 임시 자료는 성공·실패·중단 시 `finally`에서 회수하고 로그·profile·이전 출력 사본을 누적하지 않는다. 이번 문서 작성으로 중단 상태나 수락 상태를 바꾸지 않는다.

## 9. 종합 결론

**가장 합리적인 현재 설명은 새 콘텐츠의 가용 시점이 입력 수요를 따라가지 못하고 coverage 보호가 이를 정체로 드러낸다는 것이다. 실제 긴 비용이 관측된 App의 동기 생성·투영을 우선 의심하되, Content 준비와 활성화 계약이 지연을 주도할 가능성을 같은 시간축에서 겨뤄야 한다.** GC·native 회수·VM 실행비용은 이 설명과 배타적인 대안이 아니라 지연을 만드는 하위 메커니즘일 수 있다.

이 판단은 **기존 Core·플랫폼 자산을 유지하고, 임계경로를 설명하는 수정부터 선택하라**는 결론을 지지한다. App 작업량이 끝내 핵심이면 UI 생성 모델의 부분 재설계를, 하류 준비·계약이 핵심이면 그 경계의 수정을 선택한다. SDK 자체가 목적이 아니라면 기존 프레임워크로의 전환을 평가한다.

현재 성과는 실제 앱 실행·증분 처리·수명 계약·국소 작업 제거다. 현재 실패는 성능 수락이며, **남은 과제는 그 실패의 모든 가능성을 나열하는 것이 아니라 우선 설명을 반증 가능한 방식으로 좁히는 것**이다. 전면 폐기·Hermes/GC 단독 책임·V8 전환 성공은 이 자료에서 따라오는 결론이 아니다.
