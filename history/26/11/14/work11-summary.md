# Work11 — Source 실행·직접 렌더 투영 개편 중단 요약

원문: 루트 `work11.md` · 작성·갱신 표기: **2026-11-14 KST** · 본문 구현·검증: **11-13~14** · 중단·보관: **2026-11-14 KST**

상태: **STOPPED / PARTIAL — 사용자 요청으로 작업 종료·요약 보관**. 이전 PAUSED 상태를 중단으로 확정하며 자동 재개하지 않는다. 구현 완료·성능 해결·제품 수락을 뜻하지 않는다. 원본은 요약 후 삭제했고 기존 제품 코드·공급은 되돌리지 않았다.

## 목적과 당시 실행 계약

[Windows work10-a1](../11/work10-a1-summary.md)의 새 월 준비 정체를 대상으로, 필수 Source 실행을 유지하면서 접근성 반복 구성과 capture→Scene 변환을 줄이려 했다. 접근성 비용 분리, 모듈별 고정 투영 절차, 기존 writer의 RenderBinding·불변 command program, 제한된 생성기 최적화를 결합했다.

TS Widget·Element·State·Key·사용자 callback과 native layout/scroll 소유권, 원래 resident·200ms animation·coverage·ACK/publication·자원 fence를 유지하는 것이 당시 계약이었다. 이 소유권 배분을 새 설계의 정답으로 승인한 것은 아니며, 이후 [원본 충실 이식 계획](../../../../work12.md)에서 다시 검토한다.

## 채택한 구현과 검증 범위

| 영역 | 구현·당시 확인 | 남은 한계 |
| --- | --- | --- |
| 접근성 소비 | App의 전량 의미 목록·rect Map 대신 현재 publication과 공유 관찰 index에 묶인 lazy rect resolver. stale action·generation·metrics/device·visibility·close 검사 유지 | 실제 외부 UIA 소비자·비청취/실행 중 접속·reader 전체 수락은 미완료 |
| 비용 분리 | Source metadata / App 관찰 / Core 의미 조립 / Windows packet·provider·notification을 분리 | 관측 표본에서 Core/UIA가 긴 Source보다 작았지만 접근성 전체의 기여율을 확정하지 않음 |
| 직접 binding | 닫힌 module data→기존 codec·writer, destination-free program과 참조 fixup·dependency 재사용, 스칼라 인수 encode 생략 | 전체 setter journal·모든 adapter·cold Source 생성 제거는 아님 |
| Source 값 구성 | 정확한 base SemanticsProperties·TextStyle의 반복 필드 정의를 줄이되 descriptor·새 identity·subclass·getter/예외 순서 보존 | 작은 값 factory의 효과를 전체 월 생성 개선율로 확대하지 않음 |
| 생성기 | null-aware 단일 지역 읽기, final-field schema, 날짜·연도 두 method의 지역 helper 정적 결합 | 사용자 resolver·State/FocusNode·callback은 계속 실행 |
| 준비 관측 | 기존 bounded 기록에 retained builder·자손 build·render commit과 capture/ACK/publication 연결 | 실제 demand 생성→coverage-ready→첫 실제 이동의 전 인과는 미완료 |
| 입력·resize 회귀 | geometry가 같은 precision 접촉의 게시 경합 처리, wheel 종료의 page spring, fixed-page resize 진행도·원본 페이지 허용오차 복원 | 기능 회귀 PASS와 물리 resize·연속 성능 수락은 별개 |

생성기 전체 대조는 최종적으로 **시스템 Dart 3.12.2 / 75개 선언 / errors 0**, 원본 oracle **12 dates / 11 inputs / 4 decimal cases PASS**였다. 초기 임시 dev SDK 사용 기록 뒤 도구 pubspec 하한을 조정했으며 lockfile 버전·hash는 바꾸지 않았다. 초기의 “analyzer 자체가 새 SDK를 요구한다”는 설명은 정정됐다.

원문 §17.5의 cold pass에서 retained **178ms** 중 descendant **173ms**, render commit **4ms**가 관측됐다. 원래 LayoutBuilder callback 단독 비용이나 constructor 단독 원인의 증명은 아니었다.

## 철회한 후보

- Element descriptor 일괄 구성, Source Focus/Gesture 추가 revision·동결은 효용 근거 부족 또는 결합 실행 악화 뒤 철회했다.
- 구조화된 명령 인수 tree/flat-key 비교는 인코더 호출 감소만으로 전체 효용을 입증하지 못해 제거했다. 제한된 원시 스칼라 인수 재사용만 유지했다.
- 작은 native class 그래프 성공 뒤 전체 App이 실패한 사례를 별도 기록했다. 로컬 class-spill 수정은 중간 공급에 사용했으나 이후 upstream 고정 공급으로 대체했다.
- Web single-worker resize에서 두 월이 함께 노출된 실패는 검사 완화로 덮지 않고 page anchor를 고친 공급에서 재검증했다.

## Hermes 공급 전환과 당시 측정

원문 §19는 Windows 직접 compiler·VM·JSI를 **Hermes 260318099.0.7 / `b464dba92ad87bcfb77fae381a49a2394d9836d9` / HBC 99**로 전환했다. 같은 소스의 JSI를 빌드하고 최신 직접 cohort에는 표준 `-O`·upstream spill 정책·`native-upstream-v1`을 사용했다. 이전 no-CFG/no-inline·로컬 spill 패치를 최신 공급에 재적용하지 않았다. ICU 79.1 공급·출처를 연결했다. stock RNW·다른 플랫폼은 별도 cohort다.

§19 engine source는 `9e03625ee2e2ce1f5f2d5099a387b44033f966805d6753ffdba02caeeb4b1e26`이었다. 아래는 **그 공급의 기존 1배속 기록**이며 최신 후속 공급과 혼합하지 않는다.

| 시나리오 | 기능 | 이동 게시 p95 / 최대 | offset 정체 최대 / 100ms 이상 |
| --- | --- | --- | --- |
| All / 12개월 / 60Hz / YearMode | PASS | 66.916 / 122.494ms | 127ms / 4회 |
| Fast / 역방향 24개월 / YearMode | PASS | notVerified | 278ms / 11회 |
| All / NoTrace | PASS | notVerified | notVerified |

동일 공급의 언어·전체 App debug/optimized 모듈 초기화, native/Wasm/Windows host 빌드·네 App 공급 identity를 확인했다. 직접 native host의 C++ compile/link PASS는 전체 App/static-AOT 실행 수락이 아니었다. 최신 Web UI나 native instance-field 효과도 이 차수에서 검증하지 않았다.

그 뒤 public field·journal·3배속·SH native unit·할당·private field·V8 진단이 [work11-1](work11-1-summary.md)로 이어졌다. 최종 기준은 그 요약의 **§13.31 공급 / §13.33 실패 지점**이며 위 공급을 현재 제품의 재검증 결과로 쓰지 않는다.

## 성능 기준과 미수락

표시 주기 $T$에 대해 입력→실제 이동 게시 지연 **p95 $\le 2T$, 최대 $\le 4T$**, 진행해야 하는 활성 구간의 **offset 무진행 100ms 이상 0회**를 요구했다. 60Hz의 $T=1000/60\,\mathrm{ms}$에서 약 33.3/66.7ms다. 정지 명령·끝 경계·0 delta·정상 반전 순간을 제외한다.

입력 접수·최종 월 도착·높은 게시 빈도·과거 500ms 경보 PASS는 성능 수락을 대신하지 않는다. NoTrace·손실/불완전 표본은 0ms가 아니라 notVerified다. 서로 다른 pass의 최대·중첩 elapsed·다른 공급 수치를 합산하거나 시간순 개선율로 만들지 않는다.

원문 후속의 실제 빠른 트랙패드에서도 사용자가 멈춤·점프를 보고했다. 그 실행의 App turn p95/최대 **269.683/352.259ms**, 활성 publication gap **211.810ms**는 물리 사용감 실패의 보조 근거이며 scanout 지연이나 최신 공급의 재측정은 아니다.

## 후속 정리 이력

원문 §18.3에는 11월 13일 별도 사용자 요청에 따라 구형 출력·일회성 자료 **38경로 / 118,708파일 / 19,804,584,445 bytes(18.44GiB)**를 기존 임시 삭제 대기 영역으로 **이동**한 기록이 있다. 복사·압축 archive 추가나 디스크 공간 반환으로 설명하지 않았다. 현재 공급·필요한 toolchain·reference·원래 소스는 보존했다.

이전 승인 거부 당시의 잔존과 이후 정리 요청은 서로 다른 이력이다. 이번 문서 보관에서 그 임시 자료를 다시 이동·복제·삭제하거나 현재 잔존 상태를 재검증하지 않았다.

## 미완료와 중단 경계

- 전체 setter별 필드 journal·남은 adapter, 원본 Source 필수 실행/할당 분리와 일반 소비자/API 대응.
- native demand 생성→Source→Content/provider-ready→activation→실제 이동의 완전한 시간 연결.
- 실제 UIA/reader·원본 시각·물리 입력·display/scanout·물리 resize 성능, 다른 플랫폼·일반 CLI/native 기본값 전환.
- [W10-R01~08](../11/work10-summary.md#work9-잔여-의무-이관)의 공개 API·OS 소스 이식·SDK/CLI·전체 앱·제품 전환·레거시 제거 의무.

**`compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`**, 제품 **PARTIAL**을 보존한다. 위 항목은 미해결 이력이지 자동 재개 명령이 아니다. [work12](../../../../work12.md)는 별도 원본 충실 이식 계획이며, 이전 native 소유권·최적화 제안을 그대로 실행하도록 이관하지 않는다.

이번 보관은 현재 원문 요약·링크 정리·원문 삭제만 수행했다. 새 빌드·runtime·원본 oracle·성능·물리 수락은 추가하지 않았다.

[후속 구현·최종 공급](work11-1-summary.md) · [기술 검토](report-summary.md) · [결론 보고서](result-summary.md) · [이력 목록](../../../README.md)
