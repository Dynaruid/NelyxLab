# Windows 엔진 성능 개선과 Hermes TDZ 검사

원문 `work.md` · 작성 2026-11-16 KST · 마지막 실행 11-17 · 보관 11-20 · 원문 스냅샷 `ffe5c5a2`

**PARTIAL · `performanceAccepted=false`**. Windows Demo의 활성 스크롤에서 평균 30 FPS 이상과 긴 진행 정체 감소를 함께 목표로 삼았다. 11월 16일 두 중단 시점 이후 17일 재개해 lowering 후보의 구현·비교와 최종 기본 공급 회귀를 마쳤다.

## 엔진 및 공급 변경

- 레이아웃 큐의 정렬·임시 할당, retained paint의 구조 비교와 배열 복사, intrinsic·dry layout·baseline 캐시 조회의 callback 할당을 줄였다. 조립 호출 경계의 native scene 배치는 Windows direct Hermes에서 `sceneBatch=paint`를 사용했다. Paragraph transaction은 geometry·UTF-16·해제 검사를 통과했으나 warm CPU 이득이 일관되지 않아 기본 옵션을 껐다.
- Windows 키보드의 `VK_PACKET` surrogate 보존을 수정해 한글과 이모지 입력을 함께 받았다. Resize 때 이전 viewport delta가 버려지면 다음 접근성 게시의 기준도 초기화하도록 complete reset을 연결했다.
- PowerShell 가상 입력을 약 60Hz로 보정했다. GDI가 합성 데스크톱 표식에서 본 프레임 번호로 표시 FPS 하한을 집계했다. 엔진 프레임·surface fence·데스크톱 관측의 끝점은 각각 다르다. 물리 트랙패드와 패널 scanout은 미검증이다.
- 일부 typed 큐 내부 함수와 Static Hermes 공급까지 확인했으나 부분 전환으로 달력의 이득을 입증하지 못했다. 제품 실행 모드는 Hermes bytecode다.

## TDZ 후보와 최종 회귀

- TDZ·const 쓰기·반복별 capture를 보존하면서 이미 초기화됐음을 증명할 수 있는 중복 검사만 제거했다. Babel compact 출력에서 생긴 raw expression을 statement로 정규화하는 수정은 기본 경로에 반영했다. Hermes assertion 46개와 Source lowering 20개 사례를 통과했다.
- 같은 조건의 달력 3회씩에서 helper 호출 감소는 확인됐지만 FPS와 진행 정체의 일관된 개선은 확보하지 못했다. TDZ 제거는 `customTransformOptions.nelyxTemporalRefOptimization: true`에서만 켜진다.
- 최종 기본 공급에서 Gallery와 Testbed 실제 가변 목록 각 3회는 표시 FPS 하한이 모두 30 이상이고 100ms 이상 진행 정체가 없었다. MixedScroll 기능과 일반 Windows Demo 첫 프레임·정상 종료도 확인했다.
- 같은 기본 공급의 달력 기능 1회는 138개 가상 터치, 월 정착과 UIA를 통과했다. 보통 정방향·빠른 정방향·빠른 역방향의 표시 FPS 하한은 **31.056 / 24.516 / 14.827**, 100ms 이상 표시 진행 정체는 **8 / 5 / 7회**였다. 전체 달력 목표와 Android·물리 입력·IME 조합·스크린 리더·장시간 자원은 미수락이다.

후속 검토는 월 단위 갱신·생산·회수와 render 자식 동기화의 기여를 추적했다. [달력 성능 원인 분석](../17/performance-cause-analysis-summary.md)
