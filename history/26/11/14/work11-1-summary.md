# Work11-1 — Source·투영 최적화와 runtime 비교 중단 요약

원문: 루트 `work11-1.md` · 작성·갱신 표기: **2026-11-14 KST** · 본문 구현·검증: **11-13~14** · 중단·보관: **2026-11-14 KST**

상태: **STOPPED / PARTIAL — 사용자 요청으로 종료·요약 보관**. 이전 PAUSED와 본문 중간의 active 표현을 현재 실행 지시로 사용하지 않는다. 새 구현·V8 비교를 자동 재개하지 않는다. 원문은 삭제했고 기존 코드·현재 dist를 롤백하지 않았다.

## 범위와 실제로 남긴 변경

[work11](work11-summary.md)의 잔여 Source 비용·직접 갱신을 다뤘다. warm 변경 journal과 cold 최초 생성은 별도 문제로 보았고 Widget·State·callback 생략, resident/lead 확대·입력 감속·animation 변경 없이 비교하려 했다.

| 묶음 | 원문에서 유지·검증한 변경 | 범위 제한 |
| --- | --- | --- |
| 필드·변환기 | 직접 Windows cohort의 public instance field 보존, 생성기 소유 중복 정수 검사 축소, 이후 public static·instance private field/brand 보존 | private method/accessor·static private·static block·stock RNW 등은 기존 lowering |
| dirty·고정 명령 | 원래 invalidator 필드 mask OR·재진입/abort 복구, 공통 13개 class의 직접 command 작성·일부 고정 body 공유 | 초기 setter 분모 263개 중 mapping 15개 / broad invalidation 109개 / 위임·추가 검토 139개. 전체 API/저널 완료율이 아님 |
| capture·Scene | 빈 Map/Set·중간 배열·노드별 closure 제거, stable depth 순서 bucket, 안전한 private handle key·최근 program/스칼라 재사용 | 공개 mutable/getter·callback·참조 generation·NACK/in-flight·이전 bytes는 기존 계약 |
| 관찰 | row index 전량 복사·등록 전수 순회 축소, reader 직접 호출, 검증된 membership·같은 불변 row 배열 index 재사용 | full resync·위조/재활용 generation·순서/삭제·quota·old reader 보호 유지 |
| paragraph·font | 검증 결과 중복 decode 제거·바로 다음 투영의 불변 payload 일회 소비, TextPainter inputRevision으로 입력 변화/TS cache 부재 구분, live font-family 전용 조회 | 임의 producer·custom style/scaler/span·원래 validation·font retirement 검사 유지 |
| Source 조회·grid | 선택적 Inherited 누락 표 분리, Material theme의 기존 provider link 활용, SDK grid wrapper 직접 투영·내부 숫자 식 봉인 공유 | custom context/override·동적 token·사용자 getter·State/Key·원본 delegate 실행 유지 |
| 실행 모드 | 같은 Hermes pin의 SH native unit을 Windows host/SDK의 명시적 Demo 실행 선택에 연결 | `typed=false / requireNumeric=false`; Testbed와 일반 build 기본값은 HBC. 전체 제품 AOT 전환 아님 |
| 제한된 진단 | QPC cohort/request·Source pass 연결, native 함수 지도 스택 표본, profiling에서만 heap·Element rebuild 관측 | bounded·시계/손실/실패 표시. 일반 실행에는 heap/Widget observer를 설치하지 않음 |

시스템 Dart **3.12.2 / 75개 선언**, 원본 날짜 oracle **12 dates / 11 inputs / 4 decimal cases**와 언어·wire·수명 검사는 당시 범위에서 PASS였다. 같은 공급의 field/helper × direct/reference 4조합은 각각 1회였고 **전부 기능 PASS / 성능 FAIL**이었다. 단독 효과·보편적 개선율은 확정하지 않았다.

공통 provider graph가 바뀐 경우 engine과 네 App을 함께 갱신했다. Gradle 보고서의 정확한 regular metadata 3개만 source identity 규칙으로 구분했고 원본 수정·디렉터리·링크는 계속 거부했다. compiler/VM 코드를 바꾸거나 hash 검사를 완화한 것으로 설명하지 않았다.

## 철회·실패한 후보

- page preparation을 앞당긴 후보는 Web 상주 월이 기존 3개에서 4개로 늘어 **회귀 FAIL**이었다. 검사 상한을 높이지 않고 관련 C++ 변경을 원복했다.
- Inherited 고정 슬롯 교체, 명시적 Element constructor forwarding, Scene 지연 command index는 의미 검사 뒤 실제 효용 근거가 없어 철회했다. 뒤의 별도 Inherited 누락 표 개선과 구분한다.
- generic layout encoder 임시 표현 제거와 FNV shift/add 후보는 효용 미입증으로 철회했다. raw-byte FNV의 indexed loop·iterator 제거는 유지했다.
- instance private method/accessor 보존은 유효 JavaScript의 일부 runtime TypeError를 compiler가 compile error로 거부해 철회했다. compiler 패치나 fixture 삭제로 우회하지 않았다.
- 초기 PowerShell BOM 진단 결합 실패, 연도 선택 settle·좌표 검사 실패 등은 후속 보강 결과와 구별했다. 실패 실행을 성능 통과 표본으로 편입하지 않았다.

## 실행 모드와 할당 대조

원문 §13.17의 **같은 App/engine 단일 대조**는 SH native/HBC의 이동 p95 **237.218/379.392ms**, 최대 **286.234/446.717ms**로 양쪽 성능 FAIL이었다. 같은 cold pass의 build/capture/scene은 **83.510/53.018/57.143 ↔ 136.536/78.467/73.269ms**였다. native도 동적 Hermes 객체·GC를 사용하며 JIT나 정적 TS 타입 최적화와 같지 않다.

같은 차수의 준비된 네 ±0.4/±0.8페이지 Contact 최대 입력→게시 지연은 **26.521/13.338/12.034/15.408ms**였다. 준비된 이동 경로가 동작한다는 근거이지 cold 생산·전체 물리 성능 수락이 아니다.

별도 §13.27 profiling의 한 build는 **119.873ms / 누적 allocation 증가 12,511,600 bytes / GC 완료 4회**, 그 안 Source는 **115.117ms / 11,898,800 bytes / 4회**였다. runtime 누적 GC **556.026ms / 최대 단일 13.948ms**는 짧은 profile만의 통계가 아니다. 중첩 category를 더하거나 GC 완료 수를 pause 횟수로 바꾸지 않는다.

§13.30의 42셀 숫자 graph 소유 객체는 **1,175→241**, 빈 자식 _GridView 두 할당 표본은 **752,672/641,408→223,744/196,216 bytes**로 줄었다. queue rebuild **26,109회 / 72종류** 중 관측은 **210구간**, 나머지 **25,899회**는 첫 표본 제한으로 제외됐다. 내부 중복 감소를 전체 Source 비중·CPU self time·전체 성능 개선율로 외삽하지 않았다.

## 최종 공급과 측정

아래는 **원문 §13.31의 마지막 일반 Calendar/Fast 검증 공급**이다. 후속 Source 편집이나 이번 보관의 재검증 공급이 아니다.

| 항목 | 당시 식별 |
| --- | --- |
| Engine source SHA-256 | `7fde85bf683331939cbefdd47c0a1fb417805db05f37a3f1dec29e15c56ebf1a` |
| Engine 계약 | 360 files / ABI 2 / schema 313408118 / host-integration-candidate |
| Hermes | 260318099.0.7 / `b464dba92ad87bcfb77fae381a49a2394d9836d9` / HBC 99 / JIT OFF |
| App syntax | `windows-hermes-260318099.0.7-native-fields-v1` |
| Demo Windows JS | `c296ecf9b217df968cc2e17adf2edd7d76e086cd392314b8d8cf2dde8f1be360` |
| Demo Windows HBC | `befad1bcb9677cf29ffd3c9582ab12083f941c5dc27f06724346c229cb412e6d` |
| 명시적 Demo native DLL | `a2f88dcc133b0cd8c374a82b99e22303667f9c2411cc1e64b49d3514a2809a05` |

공급·전체 파일·native map·타입·86개 수기 파일 format/lint·SDK·네 App 빌드를 당시 대조했다. 최종 App의 private get textual 호출 지점 **4,009→20**은 정적 출력의 수치이지 실제 호출 횟수나 성능 개선율이 아니다.

| 실행 | 입력·기능 | 성능 |
| --- | --- | --- |
| Calendar / 12개월 / YearMode | 360 updates / 2,000.453ms / 180Hz 입력, 승인 362·거부 0·반영 360·누락 0. resize·2027년/15일·종료 PASS | 이동 p95/최대 **200.279/241.915ms**, offset 정체 **최대 234ms / 100ms 이상 11회 — FAIL** |
| Fast / moving recontact 12회 | 96 updates / 755.228ms, 승인 120·거부 0·역방향 24개월·2024년/15일·종료 PASS | offset **최대 246ms / 100ms 이상 4회 — FAIL**. 비단조 이동 p95 notVerified |

Calendar publication gap 최대 **26.819ms**, 활성 App turn p95/최대 **145.279/165.368ms**였다. cold pass의 capture entry 신규/전체 **784/827**, App 문단 투영 준비 **76**, build/capture/scene **78.705/43.249/53.054ms**, wait **19.752ms**가 남았다. entry 수는 Widget/Core node 수가 아니고 문단 투영 횟수는 Content shaping 실행 횟수가 아니다. 비동기·중첩 시간을 합산해 234ms의 원인으로 만들지 않는다.

Source pending/overwrite는 0이었지만 마지막 **native close 전 관찰 pending 1**은 그대로 보존한다. 정상 close의 reserved/memory 0·workers joined·CLI/App exit 0은 별도 결과다. 변경 후 **Reversal·Contact·Web UI·heap은 재실행하지 않았다**. 해당 최신 기능 근거는 이전 §13.30 공급이며 최신 heap 결과로 옮겨 쓰지 않는다.

## V8 진단과 마지막 정지 지점

원문 §13.32–13.33은 작은 helper 제거 반복 대신 runtime 비용과 preparation/coverage 의존을 분리하려 했다. 고정 Hermes JIT backend는 ARM64 중심이고 현재 Windows x64에서 옵션만 켜는 해법이 아니었다. SH native 함수를 V8처럼 재최적화하는 경로도 아니었다.

보존한 진단 도구는 [runtime 비교 도구](../../../../Nelyx/eng/check-windows-runtime-comparison.mjs)와 [V8 adapter](../../../../Nelyx/eng/windows-v8-comparison.hpp)다. 고정 V8 24.1.10의 C ABI를 현재 직접 host의 JSI로 소비했다. 기존 SDK/App/engine dist를 바꾸거나 전체 설치본을 복제한 제품 전환은 아니었다.

- **PASS:** Promise/microtask·외부 32KB 버퍼의 동일 backing/단일 release, 실제 Demo 모듈 초기화, heap counter, 실제 SDK activation과 전체 진단 host 빌드.
- **FAIL:** GUI app-ready 전에 `Original App viewport is unavailable`. 최종 appReady=false / frames=0 / activeDocument=0 / document=1 / pendingDocument=1. 후속 mailbox 오류는 첫 실패 뒤 cleanup 오류다.
- **미검증:** 사용할 수 있는 V8 Demo·스크롤·JIT-less·3배속 비교·제품 timeout/전체 의미·성능. 마지막 close의 reserved/memory 0·workers joined=true여도 전체 CLI exit는 1이다.
- **미확정 가설:** 첫 publication 전 semanticsSnapshot의 notFound가 live state 대신 onState에 전달되고 observeMetrics의 viewport 요구와 충돌할 수 있다. 실패 callback 원본은 확보하지 못해 확정 원인·V8 결함·Hermes 성능 원인으로 표시하지 않는다. sleep·오류 무시 해법은 채택하지 않았다.

당시 finally로 다운로드·probe·host·MSBuild 임시 출력을 회수했고 소유 App/비교/compiler 프로세스가 없음을 확인했다. 이번 보관은 그 사실을 다시 실행·프로세스 전수 점검한 결과가 아니다.

## 중단 시 미완료

전체 setter/API/adapter·일반 소비자, 실제 demand 생성→coverage→첫 이동의 완전한 인과, UIA 실제 소비자·원본 시각·물리/scanout/resize·다른 플랫폼·일반 CLI/native 제품 전환은 미완료다. 문서/request QPC 연결은 일부 구현했지만 `actualDemandCreation=notObserved`, `demandToCoverage=notVerified`, `coverageReadyGoal=notVerified`였다.

**STOPPED / PARTIAL / `compatible=false` / `performanceAccepted=false` / `resizePerformanceAccepted=false`**를 유지한다. 새 [work12](../../../../work12.md)의 Flutter 원본 충실 이식은 별도 계획이며, 이 문서의 미실행 후보나 native 정책을 자동으로 재개·채택하지 않는다. 보관에는 문서 검증만 수행했고 테스트·빌드·성능 측정은 추가하지 않았다.

[work11](work11-summary.md) · [기술 검토](report-summary.md) · [결론 보고서](result-summary.md) · [이력 목록](../../../README.md)
