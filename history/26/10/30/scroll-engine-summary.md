# Flutter 소스 비교와 스크롤 엔진 개선 요약

원문: 루트 `work.md` · 작성: **2026-10-30 KST** · 실행·갱신: **2026-10-30~11-02 KST** · 보관: **2026-11-04 KST**

상태: **CLOSED / SUPERSEDED · 제품 PARTIAL**. 미완료 작업은 [work2 요약](../../11/02/work2-summary.md)을 거쳐 [work3 요약](../../11/02/work3-summary.md)으로 이관했다. `performanceAccepted=false`, `resizePerformanceAccepted=false`를 유지한다. 이 요약 작성에서는 새 빌드·실행·성능 검증을 수행하지 않았다.

## 검토와 구현 범위

- Flutter와 Nelyx의 Widget/Element/RenderObject·sliver·retained Layer/Picture·프레임 생산 경로를 비교했다. 기존 TypeScript UI Runtime과 Skia/Graphite를 유지하며 dirty paint 경계, clock·deadline, cold section 생성, 입력·geometry·semantics의 반복 비용을 개선하는 P0~P7 계획을 세웠다.
- 사용자 요청으로 이후 비교를 **Hermes bytecode / optimized / Release**에 한정했다. 앞선 Static AOT 기록은 과거 근거로만 남기며 bytecode의 검증 결과로 승계하지 않았다.
- 기본 비활성·bounded RAM의 `FrameDiagnostics`, native recording finish/snap 관측, RNW source/native frame 연결 도구를 추가했다. CPU callback·JS dispatch·native worker·surface 갱신을 구분하고, 독립 GPU 시간·개별 GC pause·scanout 미관찰을 보존했다.
- **clock wire version 2**로 DWM 예측 start/target·refresh interval·wake/dispatch·불확실성·revision을 전달했다. 이미 지난 값이나 불확실한 예측은 optional deadline으로 사용하지 않으며 한 장 CPU 선행 정책을 유지했다.
- eager `/mixed-scroll` 페이지를 추가했다. 편집기 **12개·버튼 36개**를 첫 진입에 모두 생성하고, 전송·횟수·초기화·처음/끝 이동·Gallery 복귀를 제공한다. 24개 구성은 기존 paragraph 예산을 넘어 채택하지 않았다.
- Windows build/run에 **`appInputsSha256`**를 연결했다. SDK가 같아도 앱 소스·에셋·설정의 내용이나 목록이 달라지면 재빌드하고, 빌드 실패·빌드 중 실제 입력 변경 시 이전 제품 실행을 막는다. 같은 입력의 다음 실행은 공급·재빌드를 생략했다. 관련 회귀는 **16/16 PASS**였다.
- 화면 밖 편집기의 불필요한 native geometry 공개를 줄이고 부분 교차 좌표는 계속 갱신했다. scroll metrics가 paint를 다시 무효화하던 경로는 semantics 갱신으로 바꿨다. 유효한 pending CPU frame의 우선 제출, 동일 mouse annotation 집합의 중복 처리 감소, commit 내부 공통 변환·가시성 공유와 affine transport 등도 유지했다.

## 비교·철회와 남은 긴 프레임

| 후보 | 당시 판정 |
| --- | --- |
| dirty repaint boundary 중심 paint·Gallery 네 child 분할 | CPU 일부 개선에도 cold/hover tail 악화로 **NOT_ADOPTED**, 원복 |
| Column 전체 cache·Material physical shape의 별도 repaint boundary | surface 간격 악화로 철회 |
| Graphite pipeline executor | cold snap 감소와 별개로 warm/focus tail 악화, serial 정책 복구 |
| 추가 transport 공통 조상 변환 후보 | 일부 간격 개선에도 전체 비용·할당 순이득 불명확, 철회 |
| Form만 별도 lazy child로 분리 | cold 최대 감소와 별개로 warm/focus 악화, 철회 |
| packet 재설계·GPU raster cache | 조건부 **비진입** |

10월 31일 최종 공통 후보의 전체 범위 직접 native 비교는 장면별 callback당 JS 할당 약 **27.7~30.6% 감소**와 CPU 중앙값 감소를 관찰했다. 그러나 no-hover p99·일부 p95가 늘고 긴 프레임이 남아 전체 잔끊김 해결을 수락하지 않았다. 앞선 **96px 왕복**은 좁은 진단으로 재분류하고, 후속 비교를 실제 maxScrollExtent의 전체 양방향·빠른 왕복으로 바꿨다.

RNW cold frame의 callback **237.25ms** 중 layout **151.61ms**, paint **23.43ms**, semantics **20.12ms**, native snap **13.59ms**를 연결했다. 별도 attribution에서는 child 생성·Element rebuild·text layout의 큰 기여를 확인했으나 범주 간 중첩 시간을 합산하지 않았다. snap의 host wall·현재 스레드 CPU를 GPU 실행 시간으로 해석하지 않았다.

## 당시 검증과 마지막 공급

- 일반 Windows 명령에서 전체 OS wheel 왕복·첫/마지막 편집기 입력·재클릭 없는 후속 입력·전송 상태·정상 close를 확인했다. native 버튼 경계 픽셀 검사는 **28,325 pixels 불일치 0**, delivered shadow/DPR·resource drain과 관련 회귀도 통과했다. 버튼 소실의 수정 전 native 재현은 없어 원인을 확정하지 않았다.
- 공통 변경 당시 Chrome catalog·대표 컨트롤·route/상태와 Android Release/x86_64 에뮬레이터 입력·스크롤·복원 검사를 수행했다. Windows 최종 후보의 성능을 다른 플랫폼 수락으로 확대하지 않았다.
- 실제 설정을 일시적으로 60Hz로 바꾸어 DWM **16.666ms** 예측 전달과 RNW cold 이동을 확인했다. **60Hz CPU 3회 기준은 미완료**이며 마무리 때 **165Hz로 복원**했다.
- 마지막 일반 제품의 bytecode는 `c65deb051b75980ab9b742d4517d06502c2b66f9b66c14d1b6d7a70f1d4bdc4c`였다. 후속 중단 시 on-disk package는 진단 bytecode `496bef8cea4b5df2d77a9546432c5b714cf26fbba6c0d95aacf7819d4ef822c3`였으므로 일반 제품과 구분했다. App 원문·임시 fixture는 복구했고 소유 앱·빌드 프로세스는 종료했다.
- Windows package export에서 private AOT staging 7개 파일, 합계 **363,413,730 bytes**를 제외했다. 기존 build 디렉터리 자체의 삭제나 다른 캐시 정리는 이 변경의 범위가 아니었다. 과거 자동 승인 검토가 거부한 중간 native cache 정리도 미완료 기록으로 남겼다.

## 종료·이관

11월 1일 사용자 요청으로 **PAUSED** 상태에서 마무리한 뒤, 11월 2일 잔여 체크리스트 30개를 work2로 이관했다. 실제 60Hz 기준, cold 생성·텍스트 비용, 실제 한국어 IME, 물리 트랙패드와 표시 수락은 당시 **notVerified/PARTIAL**이었다. 이 문서 종료는 성능 목표 달성이 아니다.

[이력 목록](../../../README.md) · [별도 선행 기록: 10월 27~30일](work-summary.md) · [다음: 공통 비용 검토](../../11/02/work2-summary.md)
