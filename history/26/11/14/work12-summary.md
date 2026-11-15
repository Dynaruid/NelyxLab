# Work12 — Flutter 원본 충실 이식·Source 전환 종료 요약

원문: 루트 `work12.md` · 작성: **2026-11-14 KST** · 구현·최종 확인: **11-14~15** · 종료·보관: **2026-11-15 KST**

상태: **CLOSED / PARTIAL — 사용자 요청으로 작업 문서 종료·요약 보관**. Source 전환과 현재 공급 반영, Windows Demo의 두 증상에 대한 사용자 실사용 확인을 보존한다. 전체 원본 동등성·제품·성능 수락은 미완료다. 원문은 요약 후 삭제했으며, 미완료 항목은 자동 재개 지시가 아니다.

## 목적과 채택한 경계

TypeScript 앱·사용자 위젯을 유지하면서 고정 Flutter 원본의 실행 의미를 충실하게 이식하려 했다. 초기 감사의 핵심은 C++ 사용 자체가 아니라 Source 프레임워크와 별도 native 정책이 같은 위젯의 의미를 나눠 소유한다는 점이었다. 기존 FrameworkRoot를 보수하고 Widget·Element·State·layout·gesture·scroll·편집·semantics 정책은 Source에서, drawing·Paragraph·GPU·자원·OS transport는 엔진/호스트에서 실행하는 방향을 채택했다.

사용자의 추가 결정에 따라 **deprecated alias·레거시 호환 경로를 남기지 않는 단절적 전환**을 적용했다. 두 번째 Widget 모델이나 이전 renderer로 자동 fallback하지 않는다. 원본 Dart의 deprecated API와 철거한 Nelyx 호환 alias는 구별한다. 이전 [work11](work11-summary.md)·[work11-1](work11-1-summary.md)의 native 정책 확대·V8 비교는 재개하지 않았다.

## 현재 구현과 확인 범위

아래 결과는 종료 당시 원문의 관측 범위다. 이번 보관에서 제품을 재검증한 결과가 아니며, 부분 PASS를 전체 Flutter 호환으로 확대하지 않는다.

| 범위 | 구현·당시 확인 | 남은 한계 |
| --- | --- | --- |
| W12-00 원본·목록 | Flutter pin `71e4717a61786faab4c7aa39825989305ed29e8a`의 Git blob·SHA-256 703개 확인. 로컬 reference는 690개 일치·13개 불일치·누락 0개라서 oracle는 immutable Git reader 사용. 공개 경로 852개·export 4,617개와 두 앱/runner 6곳을 inventory로 조회 | 직접 원본 대응이 없는 export 3,189개와 나머지 의미 감사 미완료. 이전 upstream 선언 74,297개의 상태 라벨은 현재 지원률이 아님 |
| W12-01 출처·변환 | 수동 출처 322개/목적지 342개와 신규 reviewed port 20개, 현재 목적지 SHA 반영. 날짜 생성기의 미사용 binding 정리·shorthand 참조 보존 | 과거 base·fingerprint·PARTIAL 보존. recipe를 일괄 resume/promote하지 않았으며 전체 재생성 폐쇄는 미완료 |
| W12-02–04 실행·입력 | FrameworkRoot의 Source build→layout→compositing bits→paint·hit path·gesture arena·semantics 실행. 사용자 RenderObject·CustomPainter·recognizer, LayoutBuilder scope·clip·취소 검사 | 전체 수명·자원·복구·shutdown 및 모든 확장점의 원본 대조는 미완료 |
| W12-05–06 스크롤·날짜 | PageView의 ListView 대체를 Source Scrollable·Viewport·SliverFillViewport와 원본 position/physics로 교체. fraction > 1·저장/복원·controller 교체·애니메이션 중단 포함. 날짜 native grid 주입을 generator와 출력에서 함께 제거 | drag/fling·다중 pointer·notification 경계·Key/KeepAlive·중첩 scroll의 전체 수명 대조는 잔여 |
| W12-07 편집·접근성 | EditableText의 Source Scrollable·gesture·caret·Focus·semantics 사용. Windows 자동 입력의 focus·전체 선택·문자·undo·UIA 동기화 관측 | 한국어 IME composition·candidate geometry·reader 미수락. Windows host의 editing geometry는 unavailable |
| W12-08 공급 | Core **0.17.0**, SDK **0.21.0**, CLI **0.11.0**, Material/Cupertino **0.2.0**. 앱·템플릿은 Source defineApp/createRoot 사용. 두 앱의 Web·Windows·Android runner에 공급·타입 검사. native helper 포함·digest와 Android Java helper 경로 수정 | runner 공급·빌드 성공과 각 플랫폼 제품 수락은 별개 |
| W12-10 철거 | native Widget adapter 등록·분기 97개, OriginalWidgetHost, 별도 v2 Widget/State·Scene/control frontend, engine export·CLI v2·관련 샘플/검사와 중복 구형 AnimationController/Tween export 삭제. 공용 자원/플랫폼 helper 28개 유지 | 남은 recipe/validator 연결·전체 재생성 폐쇄 및 일부 과거 로컬 산출물 정리는 미완료 |

원본 대조에는 pin의 실제 Flutter/flutter_test 소스 781개를 사용했다. PageView 18개와 가변 높이 목록/custom grid 2개, 이후 repaint 호출 관측 3개까지 **총 23개**가 일치했다. tester engine은 `371f77202a73e8dff57a8b3bff75bca55c090aee`, Dart는 **3.14.0**이며 engine/pixel 동등성 판정은 아니다. 날짜 75개 선언 재생성, 실제 Dart 날짜 12개·입력 11개·decimal 4개 oracle도 통과했다.

루트 타입·lint·format·CLI 타입, converter 타입·child reconciliation·source identity, native/RN source input 241개씩의 검사가 통과했고 Core·디자인·SDK·renderer를 빌드·공급했다. 실패한 Android/Web 빌드의 이번 실행 출력만 회수하는 2개 사례도 확인했다. 이 기록은 여러 변경 단계의 검증이며 이후 수정 전체에 모든 플랫폼 검사를 다시 수행했다는 뜻은 아니다.

## 플랫폼별 실행과 한계

- **Web:** 두 앱 Ganesh/WebGL2 static build와 Chrome 157 headless/SwiftShader 실행. Demo 버튼·대화상자·탐색·달력 및 Testbed 1,000행 목록의 자동 wheel·선택을 확인했다. RangeSlider의 scalar animation 값을 Dart wrapper로 풀던 Demo 오류를 수정했다. 실제 GPU·물리 입력·성능은 미수락이며 CanvasKit source rebuild·notice qualification은 기존 notVerified/PARTIAL이다.
- **Windows:** 현재 Skia·Hermes 공급으로 direct Hermes host를 컴파일·링크하고 bytecode 앱의 화면·callback·탐색·편집·UIA·정상 종료를 확인했다. 초기 실행은 입력 41개 수락·거절 0개, surface frame 380개였다. 이후 가상 입력 검사와 사용자 물리 트랙패드 결과는 아래에 구분한다. 기본 RNW host의 native 공급은 수락하지 않았고 displayed/scanout은 unobserved다.
- **Android:** Temurin JDK **21.0.11**로 x86_64 Release APK·Hermes bytecode 96·native library 12개 확인. GraalVM jlink 실패는 해당 실행의 표준 JDK 선택으로 해결했다. API 33 AVD의 SwiftShader 모드는 Vulkan adapter 선택 실패로 화면 전에 종료됐고, 같은 APK의 host GPU 모드에서는 Source 화면·터치·탐색·키보드·W12 입력·접근성 값 동기화를 확인했다. 실제 기기·ARM64·한국어 IME·reader·복구/수명·성능은 미수락이다. 후속 스크롤 수정은 공급 설치까지만 했으며 Android 실행을 다시 확인하지 않았다.
- **Apple/Linux:** 이 작업에서 플랫폼 수락을 추가하지 않았다.

## Demo 스크롤 개선과 가상 입력 측정

원문 §12에서 Flutter의 `RenderViewportBase.isRepaintBoundary=true` 누락을 복원하고 PaintingContext·공통 retained paint에서 root·viewport·사용자 repaint 경계를 처리했다. clean 조상의 반복 paint를 줄이면서 dirty 중첩 경계·detach·숨김·실패·재무효화와 제출 프레임의 독립 자원 보유를 유지했다. 별도 RenderRepaintBoundary 캐시·paintContents 확장점은 제거했고 원본 paint 훅으로 이전했다. FrameworkRoot의 post-frame callback에 따른 다음 프레임 중복 예약도 제거했다. 목록/cache/KeepAlive·입력 속도·font·semantics 간격 300ms는 바꾸지 않았다.

Windows direct Hermes·동일 host/VM·Vulkan, logical **1280×729.5**, physical **2560×1459**, DPR **2**, 보고 refresh **165Hz**에서 구간마다 가상 wheel 24개(±120, 간격 24ms, Source 이동 1,152px)를 비교했다. 아래 지연은 **OS 입력 timestamp→해당 sequence를 포함한 native surface-copy fence 완료**이며 displayed/scanout·물리 입력 측정이 아니다.

| Gallery 목록 구간 | 지연 p95 이전→이후 | 최대 지연 이전→이후 | Source frame CPU p95 이전→이후 |
| --- | --- | --- | --- |
| 첫 하강 | 96.7→61.6ms | 151.0→78.8ms | 45.7→39.6ms |
| 이미 본 구간 복귀 | 65.2→52.5ms | 77.2→62.9ms | 14.7→13.2ms |
| 재하강 | 55.0→45.4ms | 55.4→46.0ms | 25.2→22.0ms |

첫 하강 p95는 약 36% 감소했고 paint 방문은 1,137→739였다. 각 구간 1회 관측이며 장시간·전체 화면 개선율이 아니다. repaint·예약·자원 회귀 **20개**, 위의 원본 대조 **23개**, Windows 가상 wheel/drag·달력 선택·drawer·편집·undo·resize와 Web canvas callback/목록 재진입을 확인했다. 새 섹션 layout CPU 최대 **47.7ms**가 남았고 60Hz 목표 **p95 ≤33.3ms·최대 ≤66.7ms**를 충족하지 못했다.

## 고속 달력 스와이프와 Windows npm 실행 복구

원문 §13의 원인은 Windows direct host가 위치 패킷에 측정하지 않은 `deltaX`·`deltaY`를 **0**으로 넣어 Source drag 거리가 유실되는 것이었다. wheel/panZoomUpdate에는 실제 delta를, touch/pen/mouse 위치 패킷에는 delta 필드를 생략해 동일 contact·viewport의 좌표 차이를 사용하도록 고쳤다. 별도 달력 정책은 추가하지 않았다.

같은 viewport에서 달력 폭 **344 logical px**, 제스처 폭 **445 physical px**, down→8 move→up을 총 24회 가상 주입했다. 정방향 6회·더 빠른 정방향 6회·빠른 역방향 12회에서 모두 올바른 Source drag 방향과 최종 월/정수 page/UIA/화면 일치를 확인했다. touch **240개 전부 수락**, trace·surface 관측 누락 0개였다. 새 down이 이전 정착을 중단하므로 제스처 수와 이동 월 수는 같지 않다.

| 구간 | 실제 contact 시간 | 정착 월 변화 | 입력→surface p95 / 최대 | offset 진행 간격 최대 |
| --- | --- | --- | --- | --- |
| 정방향 6회 | 103.0–105.2ms | 2026-11→2027-03 / +4 | 233.5 / 266.4ms | 146.7ms |
| 더 빠른 정방향 6회 | 56.6–60.1ms | 2027-03→2027-07 / +4 | 408.2 / 417.0ms | 234.2ms |
| 빠른 역방향 12회 | 56.0–58.6ms | 2027-07→2026-12 / −7 | 525.3 / 571.3ms | 259.4ms |

기능은 확인했지만 성능은 미달이었다. layout CPU 최대 **84.7/116.9/155.5ms**, 마지막 구간 frame CPU 최대 **234.0ms**, native 입력 대기 최대 **129.6/272.3/328.3ms**, offset 진행 간격 100ms 이상 **5/3/5회**였다. 최초 잘못된 delta 실행과는 입력 경로가 달라 개선율을 계산하지 않았다.

원문 §14에서는 Demo README의 Windows npm 명령이 미공급 RNW host를 선택해 `ENOENT ... .nelyx/windows-native`로 실패하던 경로를 direct Hermes로 연결했다. prepare/build/run과 doctor/pack을 맞추고 앱·설치 SDK·Skia/Hermes 공급의 결합 hash로 stale 제품을 거절한다. 기본 run은 필요할 때 재빌드하고 변경 없으면 재사용하며, 명시적 `--package`는 선택 snapshot의 무결성을 검사한다. 기존 runner 사용자 설정은 보존했다.

루트에서 `npm.cmd run prepare:windows`, `build:windows`, `run:windows` 각각에 `--workspace @nelyx/demo`를 붙인 실제 실행을 확인했다. 가상 입력으로 drawer→Selection→Choose date·월 왕복, pointer 36개 수락·거절 0개·정상 종료를 관측했다. 최종 재실행에서는 manifest byte/mtime 불변으로 재빌드 없는 재사용도 확인했다. native 실행 회귀 **18개**와 lint·format·CLI 타입 검사가 통과했다. 당시 제품 host source SHA는 `c82ffbd0930fa2fc85abea2068f87a4bbf2b7a53b6c7a6268203087a30f772ed`, JS bytecode SHA는 `1cbf59f1949492a2d4c551022e8e1da372a17b13e8de50fe1411c2efdb314f45`였다.

## Windows Demo 사용자 실사용 확인

**2026-11-15 사용자가 Windows Demo를 직접 실행하고 물리 트랙패드로 확인한 결과**를 원문 §15에서 별도로 수락했다.

| 확인 항목 | 종료 시 판정 |
| --- | --- |
| 스크롤의 주기적 버벅임 | **해결 — 사용자 실사용 확인** |
| datepicker 고속 연속 월 전환의 애니메이션 누락 | **해결 — 낮은 FPS에서도 빠른 트랙패드 제스처에 애니메이션 정상 작동** |
| 평균 FPS | 여전히 낮고 상승은 확인되지 않음 |

두 증상의 실사용 해결은 보존한다. 정량 FPS 전후 값이나 displayed/scanout 계측은 없었으며, 앞선 가상 입력 지연값과 성능 미달 판정을 덮어쓰지 않는다. 평균 FPS·60Hz 성능 목표와 전체 원본/제품 수락은 별도 미완료다.

## 미완료와 종료 경계

- **W12-00/01/08:** 직접 미대응 export 3,189개와 나머지 공개 API·옵션·확장점의 원본 의미/언어 adaptation/승인 정책/미지원 판정. inventory의 behavior=unreviewed를 완료로 승격하지 않았다.
- **W12-05/06:** drag/fling·다중 pointer·notification depth/반올림, child 수·Key 이동·KeepAlive·중첩 scroll/focus reveal·가변 높이 텍스트의 전체 수명 대조.
- **W12-02/07/09:** 프레임 자원 보유·복구·취소·shutdown의 전체 대조, 실제 OS IME composition/candidate geometry·reader, 플랫폼별 시각·물리 입력·성능 수락. Windows Demo 두 증상의 사용자 확인 범위를 제외한 나머지 입력 수락은 잔여다.
- **W12-10:** 나머지 recipe의 현재 validator 연결·전체 재생성 폐쇄와 이전 로컬 산출물 정리. 당시 자동 승인 검토의 `blocked by policy`로 삭제가 거절된 대상은 `.nelyx/android-v2`, `Nelyx/skia/vendor/inputs/windows-x64/vendor-inputs.json`, Demo의 이전 `.nelyx/web/packages/1794670208245-3b018b16-8c6d-4d54-9c65-450e2802a346`, `.tmp/`의 `calendar-fast-entry.ts`·`calendar-fast-run.mjs`·`calendar-fast-ui.ps1`·`calendar-product-build.mjs`였다. 이번 문서 보관에서는 현재 잔존 상태를 재검증하거나 삭제를 재시도하지 않았다.

검증 runner는 20분 timeout을 적용했고, 실행별 oracle·diagnostic package·pack/build staging·UI 임시 파일 및 검증 앱/브라우저/서버/AVD는 원문에 적힌 거절 대상을 제외하고 회수했다. 당시 현재 dist·제품 패키지·현재 공급 archive를 유지했다.

이번 종료는 **요약 작성·이력 목차와 참조 링크 갱신·루트 원문 삭제** 범위다. 제품 구현·공급을 바꾸거나 빌드·runtime·원본 oracle·성능·물리 수락을 추가하지 않았다. 문서는 **CLOSED**, 전체 구현/수락 판정은 **PARTIAL**로 보존한다.

[선행 작업 중단](work11-summary.md) · [선행 최종 공급·V8 실패](work11-1-summary.md) · [이력 목록](../../../README.md)
