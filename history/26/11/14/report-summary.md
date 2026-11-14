# Report — 구조·기술 스택 재검토 중단 요약

원문: 루트 `report.md` · 작성·개정: **2026-11-14 KST** · 중단·보관: **2026-11-14 KST**

상태: **STOPPED — 사용자 요청으로 분석·권고 작업 종료·요약 보관**. checkout `d0f6c5f`와 당시 [work11](work11-summary.md)·[work11-1](work11-1-summary.md), 실제 코드·공식 자료의 정적 검토다. Windows Original App 범위이며 새 runtime·GC 설정 변경·빌드·성능 측정은 없었다. 원문은 삭제했다.

## 핵심 판단

초기 기술 스택·설계 전제를 재검토할 근거는 있지만, 엔진 전면 폐기나 Hermes·GC·GPU 중 하나의 단독 책임은 입증되지 않았다. 확인한 것은 긴 App 준비와 성능 기준 미달이다. **Source 실행·할당, 동기 native 문단 호출, GC·회수, mailbox·Core 잠금, Content 준비·coverage 의존**을 같은 실패 구간에서 나누자는 권고였다.

구조와 GC는 양자택일 원인이 아니다. native AOT도 같은 runtime 객체·GC를 사용한다. VM을 바꾸면 JIT뿐 아니라 allocator·GC·backing accounting·host 수명도 바뀌므로 성능 차이를 JIT 단독 효과로 해석해서는 안 된다.

## 코드에서 구별한 실제 경계

| 경계 | 당시 확인과 해석 |
| --- | --- |
| owner | Windows는 UI/App/Content/Render owner를 가진다. **Core는 별도 다섯 번째 스레드가 아니라 호출 owner가 공유 잠금으로 실행하는 상태·알고리즘**이다. Web/Android에 그대로 일반화하지 않았다. |
| App | Promise로 시작해도 build·reconcile·capture는 긴 동기 구간을 포함한다. JSI 문단 layout/query는 같은 App 스레드의 C++ 작업이므로 Source elapsed를 순수 JS CPU로 볼 수 없다. |
| 입력·coverage | 준비된 native scroll은 매 프레임 App 응답 없이 이동할 수 있다. 미준비 영역은 표시 offset을 제한하고 필요 콘텐츠를 요청한다. App 승인 분기는 조건부다. |
| 요청·준비 | coverage의 needChildren과 layoutBuildRequest는 서로 다르다. Source 응답 transaction이 기존 preparation을 resume할 수 있어 정체 한 번을 왕복 한 번으로 환산할 수 없다. |
| 게시 | accepted/ACK → layout ready → providerReady → active → published는 별개다. publication도 GPU 완료 관측 뒤의 소프트웨어 경계이지 물리 scanout이 아니다. |
| Core 잠금 | transaction staging은 이미 잠금 밖에서 수행하고 provider measure/prepare도 Core 잠금 밖이다. contentStep·tick·Frame 구성 등 실제 직렬 구간의 비용은 미측정이었다. |
| 기존 최적화 | dirty queue·capture/binding 재사용·Document/COW·fitted-grid native layout·C++ Frame 전달이 이미 있다. 전체 트리 복사·매 프레임 JS 경유·완전 zero-copy라는 단순 설명을 모두 배제했다. |

## 기존 측정이 말하는 것과 말하지 않는 것

마지막 일반 공급은 [work11-1 최종 기록](work11-1-summary.md#최종-공급과-측정)의 engine `7fde85bf…c56ebf1a`다. Calendar 3배속의 이동 p95/최대 **200.279/241.915ms**, offset **234ms / 100ms 이상 11회**로 실패했다. 같은 실행의 publication gap 최대 **26.819ms**와 App turn **145.279/165.368ms**는 게시와 실제 이동의 분리를 보여 준다.

이전 native/HBC 단일 대조의 p95 **237.218/379.392ms**는 runtime 영향 가능성을 보여 주지만 양쪽 FAIL이었다. 준비된 Contact의 **12~27ms** 반응은 cold 생산과 준비된 이동을 구별할 근거다. V8는 초기화·빌드만 통과하고 GUI가 실패해 앱 스크롤 성능 증거가 없다.

이전 별도 profiling의 build **119.873ms / 12,511,600 bytes / GC 완료 4회**와 최대 pause **13.948ms**는 메모리 비용 조사 근거다. 최신 field 변경 뒤 heap 재관측은 없었다. 누적 allocation은 live bytes·누수량·해제량이 아니며 runtime 누적 GC 시간을 짧은 활성 profile 길이로 나누어 점유율을 계산하지 않았다.

## GC·회수 수명의 추가 검토

- 당시 Windows 설정은 Hades·concurrent GC다. young 할당 slow path는 App 작업 중 수거를 실행할 수 있고 concurrent라는 말이 모든 mutator 정지를 없애지는 않는다.
- `ensureBackgroundTaskPaused`의 `gcMutex_` 대기는 young 통계 시작보다 앞설 수 있다. 최대 pause 통계만으로 GC 관련 모든 대기가 그 이하라고 단정할 수 없다. 실제 큰 경합이 있었다는 증거도 아니었다.
- 50ms 목표 상수는 주기·상한 보장이 아니고 young 크기 조정 10/20ms 휴리스틱과 구별했다. 25ms incremental budget은 비동시 분기여서 현재 concurrent 실행의 매회 예산으로 인용하지 않았다.
- 외부 응답은 vector·ExternalLease를 가진 ArrayBuffer backing과 별도 pressure NativeState의 수명으로 연결된다. 마지막 holder의 파괴가 lease 반환·vector 해제와 만날 수 있지만, pressure 차감과 backing 파괴는 동일 finalizer·동일 시각이 아니다.
- lease 반환의 Ledger 잠금은 vector free 전에 풀린다. mutex 존재만으로 긴 경합·deadlock·누수·pressure 오류를 확정하지 않았다.
- App 문단의 명시적 release, C++ snapshot/shared ownership, GPU Frame/Prepared retirement는 서로 다르다. 모든 native 자원을 JS GC 문제로 묶지 않았다. 관찰 row compaction도 이미 존재했다.

강제 full GC, pressure 삭제, 무제한 heap·pool, 상수 하나 축소는 초기 해법으로 채택하지 않았다. 회수 지연 처리는 bounded queue·실제 해제까지 회계·overflow·shutdown drain·스레드별 파괴 규칙이 필요한 **미채택 후보**였다.

## runtime·iOS와 대안의 당시 지위

현재 Demo의 SH native unit은 **typed=false / requireNumeric=false**의 실제 기계어지만 정적 TS 타입 최적화나 GC 제거와 다르다. 고정 Hermes의 JIT backend·실행 모드는 현재 Windows x64에서 옵션 하나를 켜는 해결책이 아니었다.

일반 iOS의 no-JIT/native 배포 요구는 Hermes 종속성이 아니다. JSC·V8 JIT-less·Dart/native 등은 서로 다른 비용·공급 검증을 요구한다. 특수 브라우저 entitlement를 범용 SDK의 권한으로 취급하지 않았고, no-JIT라는 사실만으로 서명·실기기·배포 자격이 입증되지도 않았다. v2 공급 Windows/Web/Android와 별도 Apple runner의 존재를 구별했다.

당시 대안은 다음과 같은 **조건부 설계 판단**이었다. 다른 프레임워크와 동일 앱을 실행한 성능 순위가 아니다.

| 대안 | 당시 조건·권고 |
| --- | --- |
| 현재 Core·VM 유지, 확인된 수명·회수·중복 비용 개선 | 같은 실패 구간의 기여를 입증한 작은 수정부터 비교 |
| V8/JSC 교체 | 원인 분리 목적에 제한. host 완성 비용이 계속 늘면 중단 |
| TS + 제한된 UI 표현·native 생성 계약 | 실제 신규 생성량이 핵심이고 TS SDK가 목적일 때만 검토 |
| 원본 Flutter/Dart | TS UI보다 앱 출시가 우선일 때 평가. 성능 해결·GC 제거가 검증된 대안은 아님 |
| RN·Compose·WebView·C++/Rust 재작성 | 언어/API·플랫폼·유지 책임 변경 비용을 비교. 전면 재작성은 현재 근거로 비추천 |

QuickJS의 C 출력, AssemblyScript/Wasm, Typed Hermes 연구 확대, C++→Rust/GPU 교체도 현재 앱의 해결로 채택하지 않았다. 제한된 UI 표현 제안은 원본 Source 전체 실행을 줄일 수 있는지 검증해야 하는 당시 대안이며, 새 [work12](../../../../work12.md)의 **Flutter 원본 충실 이식**과 혼합해 자동 실행하지 않는다.

## 중단한 권고와 남은 불확실성

기존 queue/lock/measure/record trace를 우선 사용하고, 필요한 동기 문단·GC 진입/정지·외부 buffer 회수 경계만 같은 clock·document/preparation/publication·offset에 연결하려 했다. 중첩 시간은 합집합으로 처리하고 elapsed를 CPU self time으로 바꾸지 않는 계획이었다. 구현·측정은 하지 않았다.

V8 startup의 notFound publication/live-state 혼합은 유력한 코드 가설이나 실패 callback 원본이 없어 확정 원인이 아니었다. GC·UI 생성 모델·VM 비교 중 어느 한 수정도 다른 조사의 절대 선행 조건으로 두지 않았다.

기능·공개 API·UIA/IME·물리/display/scanout·resize·다른 플랫폼은 계속 미완료이며 **`compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`**다. 이번 중단·보관은 위 제안을 실행하거나 기존 제품 수락을 바꾸지 않는다.

[관측 기반 결론](result-summary.md) · [실험·최종 실패](work11-1-summary.md) · [이력 목록](../../../README.md)
