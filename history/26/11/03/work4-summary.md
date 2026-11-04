# 반복 프레임 통지·입력 비용과 Windows shadow 회귀 수정 요약

원문: 루트 `work4.md` · 작성·실행: **2026-11-03 KST** · 보관: **2026-11-04 KST**

상태: **Gallery 후속 비용 감소·평가 완료 / 오른쪽 열 소폭 개선 / 제품 PARTIAL / 구 공급 4개 CLEANUP_BLOCKED**. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 입력·scanout **notVerified**를 유지한다. 아래는 당시 기록의 요약이며 이번 보관에서 빌드·앱 실행·성능 재측정은 하지 않았다.

## 구현·채택과 비진입

| 단계 | 당시 결과 |
| --- | --- |
| W4-0 귀속 | 같은 공급의 통지 모드 3쌍, 전체 범위와 별도 순수 warm 진단 확보. 모든 hover/focus 성능 수락은 미확보 |
| W4-1 frame status | **ADOPTED**: SDK 소유 Windows surface가 lifecycle 모드를 명시해 반복 Fabric payload 축소. 공개 SkiaGraphiteView 기본은 continuous 유지 |
| W4-2 viewport 변환 직접 연결 | **CONDITIONAL/비진입**: 비교·변환 갱신 중앙값 Gallery 0.157/mixed 0.071ms. root/public paint 생략 안 함 |
| W4-3 추가 geometry cache | **CONDITIONAL/비진입**: local cache는 이미 존재. frame 간 조상 연결 재사용은 미구현 |
| W4-4 native 회귀 | **ADOPTED**: filled RRect shadow로 큰 scratch 할당 실패 경로 수정. allocator 회수·clear 이동 후보는 철회 |
| W4-5 공급·일반 검증 | 기능·시각·공급 대조 완료, 성능 PARTIAL·이전 native 공급 정리 차단 |

`windowsSurfaceStatusMode: 'continuous' | 'lifecycle'`, protocol `surfaceStatusVersion: 1`을 연결했다. SDK는 실제 capability·응답 mode를 검증한다. native의 frame outcome·presented generation/size·resize·입력 observer는 계속 갱신하며, 첫 콘텐츠·emitter/mode 변경·close/unbound 계약도 유지했다. 전체 범위 진단의 **5,855 native frame 시도→Fabric frame payload 6개**, 전체 status payload/JS handler **20/20**을 관찰했다. payload 준비 감소를 확정 FPS 절감량으로 환산하지 않았다.

## native allocation 실패와 shadow 수정

Gallery 두 열 warm→mixed 마지막 send에서 일반 App도 allocator **198,279,232B + 요청 76,267,888B**로 256MiB cap 초과를 재현했다. frame/recording별 회수 여유, 실제 부족분 purge, clear recording 이동 후보는 오류 재발·upload 실패·FPS/픽셀 gap 악화로 철회했다.

rounded rect shadow가 drawPath·stroke-and-fill로 전달되어 analytic blur 경로를 쓰지 못하는 조건을 확인했다. spot은 filled RRect, 지원하는 ambient는 같은 외곽의 outset filled RRect로 전달하고 타원 모서리 stroke·일반/역방향 path는 기존 경로를 유지했다. **allocator 256MiB, Context 96~192MiB, Picture 64/32MiB, recording 2, completion/consumer fence를 확대하지 않았다.**

현재 archive의 실제 Vulkan shadow/DPR·direct/retained·clip·drain **1/1**, 실제 Windows input-surface의 caret/TSF/UIA·resize fence·수명 **1/1**을 통과했다. 단, 전체 범위 source 실행의 Gallery 복귀 gap **358.408ms**는 350ms gate를 넘은 **FAIL/exit 2**로 유지한다. 별도 일반 App 통과와 합쳐 PASS로 바꾸지 않는다.

## 비용 귀속과 Gallery 후속 변경

순수 mixed OS wheel의 전체 범위 진단은 4초 편도 **609 frames**, 1.5초 편도 **197 frames**였다. geometry 준비/공개 평균은 **2.496/1.690ms**, **2.586/1.726ms**, semantics는 **3.039/7.344ms**였다. 타이핑·전환이 섞인 평균과 구분하며, 현재 projection·clip·가시성·custom hook을 건너뛰는 근거로 쓰지 않았다.

Gallery 후속에서는 callback 없는 표준 hover listener의 빈 dispatch/좌표 변환, 내부 불변 matrix product·inverse, 표준 box의 임시 bounds·불변 child snapshot 재복사를 줄였다. 외부 mutable/frozen 배열·getter/prototype/handler override·탐색 중 children 변경·signed zero·기존 snapshot은 보존했다. frame당 약 **3ms**의 hit test와 paint/scene 준비의 큰 나머지 비용을 모두 제거한 것으로 설명하지 않았다.

같은 일반 명령·2560×1459/DPI 192·상세 진단/GDI 없이 최종 3 fresh owners를 측정한 평균은 다음과 같다.

| Gallery 열 | 기준 surface FPS | 최종 surface FPS | 범위 |
| --- | ---: | ---: | --- |
| 좌 | 53.547873 | 53.641015 | 거의 같음 |
| 우 | 52.476282 | 54.621647 | 약 4.1% 개선, 모든 leg는 60fps 미만 |

SDK lifecycle은 **반복 통지 작업량 감소**, shadow는 **확인된 회귀 수정**으로 채택했다. 모드 단독 비교에서 일관된 FPS 이득은 없었으며 위 오른쪽 열 개선도 전체 범위·체감 잔끊김 해결 수락이 아니다.

## 최종 검증·공급·미완료 정리

- 최대화 Gallery 3 owners 시각 회귀 **1/1 PASS**, 최대 pixel gap **115.9858ms**. mixed owner 1·4 **1/1 PASS**: 12 fields/36 buttons·전체 복귀 후 재클릭 없는 입력·한글 commit/undo·Gallery 복귀·정상 drain/exit 0. 물리 입력 수락은 아니다.
- 최종 Core **119/119**, RNW probe **19/19**, package boundary **4/4**, native clock **1/1**, 전체 타입·변경 lint/format·diff PASS. 앞선 Windows input **50/50**, paint **169/169**, native replay **69/69** 등과 중복 합산하지 않는다.
- Windows 9개 source/dist/설치·archive/lock·runtime/package를 대조했다. 최종 **1,794 files / 319,287,746B**, Hermes bytecode/optimized/Release, `qualification=notVerified`였다.

| 최종 일반 공급 | SHA-256 |
| --- | --- |
| manifest | `5137aa8c3d2700b9e5ddaa437e8aa6cf1c32d56c8549c33f2e0b266d9c44759b` |
| native inputs | `3283d2f3281f64468c815e337995f77ebb2499d0b2a1c3ebc8f4ddf594b58d4b` |
| SDK inputs | `a203a8bd0b02f089aff1cad0e623162e653c79ca113a057090f6854d48847b92` |

일반 명령 재실행의 버튼·양 열 이동·정상 종료도 확인했다. App 원문·fixture·staging·소유 process는 복구·정리했다. 최신 Android runner Core는 이 최종 Core와 다르며 재공급하지 않았다. 앞선 Android 실행은 Metro 준비 gate에서 중단돼 runtime/IME notVerified이고, APK·Web 결과를 이번 최종 코드의 제품 검증으로 확대하지 않았다.

원문 §8.6의 구 native 공급 4개는 절대경로·manifest·reparse 검사를 했으나 당시 자동 승인 검토의 **blocked by policy**로 삭제가 거부되어 남았다. 모두 `sample/nelyx-testbed-app-2/.nelyx/windows-native/`의 다음 직접 자식이며 이번 문서 보관에서는 삭제를 시도하지 않았다.

- `77700937011ea55aa019c141c71792df7bf5bb14dd63eb780c4e1630daefbb9e`
- `ffd05e60aaa00114fac59de0e93c1b23cf4896ab933099995413517479f9e1ae`
- `4851a710a9ec0353ea71222646872cce5e38771a993547f7506f3a602cb6957b`
- `f53e376e5f183f9a8eb66bf6138e1a6636dcf726b274441ba44d0e608c8045e0`

다음 구조 후보는 입력 대상 탐색의 반복 준비 공유, 변경된 viewport/boundary 중심 paint·immutable scene 구성이다. 이 문서에서 그 구조 구현·60fps·resize·물리 표시 수락을 완료 처리하지 않는다.

[이력 목록](../../../README.md) · [선행 C++ 평가](../02/work3-summary.md) · [다음: retained geometry·실행 증거 재감사](work5-summary.md)
