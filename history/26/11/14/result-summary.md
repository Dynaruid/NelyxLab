# Result — 관측 기반 원인 추론 중단 요약

원문: 루트 `result.md` · 작성·개정: **2026-11-14 KST** · 중단·보관: **2026-11-14 KST**

상태: **STOPPED — 사용자 요청으로 분석·후속 검증 제안 종료·요약 보관**. checkout `eca7856`, [기술 검토](report-summary.md), [W11](work11-summary.md)·[후속 측정](work11-1-summary.md), 당시 구현과 **11월 14일 20:51 KST 사용자 관찰**에 근거한다. 보관 직전 미커밋 개정까지 반영했으며 원문은 삭제했다. 새 계측·성능 측정을 추가한 보고서는 아니다.

## 결론의 핵심 수정

사용자는 **한 번 표시된 목록의 스크롤 시작과 DatePicker 월 스와이프가 모두 버벅인다**며 공통 원인을 의심했다. 공유 scroll adapter·offset 관찰 경로가 실제로 있으므로 검토 가치가 있지만, **한 번 표시됨과 Widget/Element가 계속 유지됨은 다르다**. 따라서 cold 생성 가설을 제보만으로 배제하지 않고 다음을 구분했다.

1. 현재 유지된 자식·active coverage 안에서 첫 입력→첫 실제 이동이 늦는가.
2. 보관 범위를 벗어난 항목을 다시 방문해 실제 재생성·준비가 필요한가.
3. 달력 page 반올림 경계의 callback·setState·후속 갱신이 추가 비용인가.

관찰 당시 Demo에는 목록당 화면 밖 일반 섹션 최대 2개를 추가 보관하는 bounded 정책과 편집 KeepAlive가 있었다. 이후 사용자 요청으로 Demo 전용 설정이 제거되고 PageView 화면 밖 기본 layout cache가 0으로 바뀐 사실을 최신 개정에 구분했다. native 페이지 창은 일반적으로 최대 4개이며 Focus/KeepAlive 예외가 있다. **기존 관측·측정에 후속 수명 변경이 반영됐다고 쓰지 않았다.**

## 증거와 범위

| 증거 | 당시 관측 | 의미·한계 |
| --- | --- | --- |
| E1·E2 최신 Calendar | 이동 p95/최대 **200.279/241.915ms**, offset **234ms / 100ms 이상 11회**, 360개 전량 반영. publication gap 최대 **26.819ms** | 최종 반영·게시 빈도와 제때 이동은 별개. 전체 GPU 정지 하나로 설명하기 어려움 |
| E3 cold 비용 | build/capture/scene **78.705/43.249/53.054ms**, entry **784/827**, 문단 투영 **76** | 실제 비용은 있지만 순수 JS CPU·Widget 수·shaping 횟수·정체 원인의 확정치가 아님 |
| E4 준비된 Contact | 최대 입력→게시 **26.521/13.338/12.034/15.408ms** | 준비된 이동 가능성. 모든 시작에 큰 고정 지연이 필연이라는 설명의 반대 근거 |
| E5 native/HBC | 이동 p95 **237.218/379.392ms**, 양쪽 FAIL | 실행 모드 영향 가능성, 단일 대조의 보편적 개선율은 아님 |
| E6 heap | 이전 build **119.873ms / 12,511,600 bytes / GC 완료 4회**, runtime 누적 GC **556.026ms / 최대 pause 13.948ms** | 최신 field 변경 뒤 heap 재측정이 아니고 단일 234ms GC 정지의 증거도 아님 |
| E7 국소 감소 | 숫자 graph **1,175→241**, private-get textual 지점 **4,009→20**, 전체 성능 FAIL | 중복 감소 성과와 전체 임계경로 해결을 구별 |
| E8 물리 피드백 | 이전 빠른 트랙패드 멈춤·점프 보고 | 도구만의 착시 설명을 약화하지만 최신 공급의 물리 재검증은 아님 |
| E9 V8 | 모듈 초기화·host 빌드 PASS, GUI app-ready 전 FAIL | V8 스크롤 성능을 판단할 증거 없음 |
| E10 새 제보 | 목록 시작·월 스와이프 버벅임, 당시 자식 유지·정확한 시각 미계측 | 동일 병목은 가설이며 제보만으로 cold·warm 상태를 확정하지 않음 |

3배속은 **360 updates / 약 2초 / 180Hz 입력 표본**이며 180fps 표시 요구가 아니다. 마지막 일반 공급 identity·기능/성능·미재검사 범위는 [W11-1 최종 공급](work11-1-summary.md#최종-공급과-측정)을 따른다. 서로 다른 공급·진단 실행·중첩 구간의 수치를 합산하지 않았다.

## 경쟁 가설과 인과의 제한

- **H-S 공통 상호작용 병목:** 유지된 범위에서도 target/hit·owner wake·공유 잠금·관찰/알림/갱신의 같은 긴 구간이 두 증상의 실제 이동을 지연하는지 검증한다.
- **H-I 범위별 추가 비용:** 일반 목록 재생성/시작과 달력 월 변경·새 준비가 별개로 느리거나 공통 비용 위에 더해질 수 있다.
- 지연 위치 후보는 **H-A App 동기 작업, H-B Core/Content/provider, H-C 입력 시작·활성화 경계**다. 모두 경쟁·공존 가능하다.
- 전체 GPU 정지나 입력 누락·주입 지연·계측 착시만의 단독 설명은 기존 관측과 잘 맞지 않았다. 새 warm 시작의 wake/draw 지연까지 배제한 것은 아니다.
- GC·allocator·동기 native 호출·VM은 H-A 등이 비싸지는 하위 메커니즘이다. 구조 대 GC의 양자택일은 성립하지 않는다.

**offset 관찰 뒤 controller·onPageChanged가 실행되므로 그 후행 통지만으로 같은 offset의 첫 Core 이동 지연을 설명할 수 없다.** 이전 작업·다음 frame·공유 잠금·document/geometry 의존 등 실제 연결이 필요하다. 준비된 native 이동이 매번 App 응답을 기다리는 것도 아니다. 공유 함수나 긴 App elapsed만으로 공통 원인을 확정하지 않았다.

needChildren과 layoutBuildRequest, accepted·ready·providerReady·active·published를 구별했다. 실제 demand 생성→Source→준비→activation→이동 게시의 전체 인과는 notVerified였다. 기존 최적화의 실패가 원본 의미 보존 불가능이나 모든 최적화 소진을 증명하지도 않는다.

## 중단한 검증 제안

최소 시작점은 **P0 warm 시작 / P6 월 반올림 경계 / P7 최초 한 번과 재접촉마다의 차이**였다. 첫 contact, 첫 유효 delta, Core offset 변경, 이동 게시, page callback, lift/정착을 나누고 자식 수명·coverage·입력 방식·hit 대상·대기 조건을 맞추려 했다.

필요하면 **P1 실제 coverage 대기 / P2 필수 App 결과의 지각 / P3 GC·회수 기여 / P4 하류 queue·lock·measure/record / P5 다른 runtime**을 연결하는 계획이었다. 기존 bounded trace를 우선 사용하고 누락 경계만 추가하며, 동일 경로 하나의 수정이 두 증상의 실제 이동 지연을 함께 줄이는지 확인해야 했다. **이번 분석에서 실행하지 않았고 보관으로도 재개하지 않는다.**

## 당시 설계 판단과 현재 경계

제품 수락을 보류하고 기존 Core·플랫폼·수명 자산을 우선 보존하되, 입증된 공유 경로의 작은 수정부터 판단하자는 결론이었다. 실제 신규 생성량이 끝내 핵심일 때만 UI 생성 모델 축소를 검토했다. TS보다 앱 출시가 목적이면 Flutter/Dart 평가도 가능하지만 성능 해결·GC 제거가 검증됐다는 뜻은 아니었다.

이전 권고의 native 표현 확대를 새 실행 방침으로 이관하지 않는다. 이후 사용자가 선택한 [work12](../../../../work12.md)는 **TypeScript UI를 유지하며 Flutter 원본을 충실하게 이식하고 독자 정책을 제거하는 별도 계획**이다. 이번 중단은 그 계획을 구현한 것이 아니다.

수락 기준은 [W11 성능 기준](work11-summary.md#성능-기준과-미수락)의 p95 $\le 2T$ / 최대 $\le 4T$ / 활성 offset 무진행 100ms 이상 0회다. source/runtime·입력·resident/lead·animation을 맞추며 물리/scanout·IME/reader·resize·전체 API·다른 플랫폼 의무는 별도다.

**STOPPED**, 제품 **PARTIAL**, **`compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`**를 보존한다. 가설 우선순위와 제품 수락을 혼동하지 않으며, 원문 삭제·요약 보관은 구현 완료나 실패 원인의 확정을 뜻하지 않는다.

[기술 검토](report-summary.md) · [W11](work11-summary.md) · [W11-1](work11-1-summary.md) · [이력 목록](../../../README.md)
