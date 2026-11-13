# Windows·Web 우선 엔진 v2 구현·호스트 전환 요약

원문: 루트 `work9.md` · 작성: **2026-11-05 KST** · 갱신·종료: **2026-11-10 KST** · 보관: **2026-11-13 KST**

문서 상태: **CLOSED / work10 이관** · 제품: **PARTIAL**. 문서 종료는 API 호환·전체 플랫폼·물리 입력·성능·기본값 전환의 완료가 아니다. `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리/display/scanout **notVerified**를 유지한다.

## 문서 구성과 날짜

원문 작성일로 배치했으며 실행·종료일이나 파일 수정 시각으로 날짜를 바꾸지 않았다. 10월의 같은 이름 이력과는 별도 작업이다.

| 원문 | 작성일 | 보존 범위 |
| --- | --- | --- |
| `work9.md` | 11-05 | 이 목차·차수·종료/이월 요약 |
| `work9-1.md` | 11-05 | [범위·Windows host·공통 경계](work9-1-summary.md) |
| `work9-2.md` | 11-05 | [공개 API·렌더링·입력·Web](work9-2-summary.md) |
| `work9-3.md` | 11-05 | [W9 단계·통합·공급·수락 gate](work9-3-summary.md) |
| `work9-4.md` | 11-05 | [Android 부분 구현·Linux 계획](work9-4-summary.md) |
| `work9-5.md` | 11-05 | [iOS·macOS 후속 계획](work9-5-summary.md) |
| `work9-a.md` | 11-08 | [단일 frontend·구조 개편·레거시 제거 조건](../08/work9-a-summary.md) |
| `work9-b.md` | 11-09 | [App SDK 단일화·실제 API 이식·Gallery/Demo 연결](../09/work9-b-summary.md) |
| `work9-c.md` | 11-09 | [Range/editor·종료 수정·날짜 선택기·성능 잔여](../09/work9-c-summary.md) |

## 채택한 구조와 개발 순서

- 원래 TypeScript Widget/Element/State·Key·BuildContext와 Material/Cupertino의 theme·controller·callback을 유지한다. C++는 최종 layout·geometry·hit-test·gesture·편집 document·scene·자원 수명을 소유한다. 별도 C++ 디자인 컴포넌트나 숨은 TS/RN renderer fallback은 해법이 아니다.
- 기본 차수는 **Windows/Web → Android/Linux → iOS/macOS**다. 11월 7일 사용자 지정으로 Android를 먼저 부분 구현했으나 Windows/Web 전체 완료나 Linux/Apple 착수를 뜻하지 않는다.
- Windows는 11월 8일 교정에 따라 **Windows App SDK 단일 host**로 통일한다. 플랫폼 API는 **Windows RNW / Android·iOS RN / macOS RNM / Linux RNL**의 실제 소스를 수정 이식하고 기존 소비자를 교체해야 한다. 참고만 한 자체 구현은 이식 완료가 아니다.
- Web single-worker/threaded를 함께 유지한다. Single-worker의 `contentIndependent=false`, App/Content/Render 소유권·ACK/NACK·세대·게시 geometry·예산/lease·close/drain을 보존한다.
- **W9-13 기술 gate**와 **W9-14 대상/profile별 물리·표시·성능·기본값 수락**을 분리한다. 이전 단계의 부분 PASS를 전체 API나 후속 플랫폼으로 복사하지 않는다.

## 주요 경과

| 날짜 | 변경·결론 |
| --- | --- |
| 11-05~06 | Work8 미완료를 W9-00~14의 15단계로 이월하고 5개 분할 문서로 구성했다. API 실행 모델 선행 판정, Linux GTK 최소 4.22, 기술/제품 gate와 공급·clock·복구 조건을 보완했다. |
| 11-07 | Asset/font/buffer/image/network와 Android standalone·입력·복구·reload를 구간 구현했다. 사용자 요청으로 독립 테스트·fixture/감사·실험 도구 등 **504파일**, 루트 npm 진입점 **107→20개**를 정리했다. 당시 build/type/lint/format·공급 검사는 PASS지만 UI·물리·성능 재수락은 아니다. 폐기된 명령은 실행 지시로 보존하지 않는다. |
| 11-08 | Work9-a의 단일 frontend·직접 SceneWriter 연결을 진행하고 종료했다. Windows 단일 host·실제 upstream 소스 이식 방침을 확정했다. |
| 11-09 | Work9-b의 App SDK 단일화·RNW 이식·여러 실제 controls/목록/편집 흐름을 확인하고 work9-c로 이관했다. Work9-c에서 Range/editor 초안을 완성하고 종료·입력·관측/캡처 문제를 수정했다. |
| 11-10 | Flutter 원본 생성 날짜 선택기와 초기 월·반복 이동·KeepAlive/Ink 수명을 연결했다. 종료/누적 지연 일부는 개선됐지만 새 월 준비·빠른 이동 끊김은 남아 9개 문서를 work10으로 이관했다. |

11월 7일의 Core **419/419** 등 구간 검사, 이후 다른 공급의 PASS·hash·실패는 각 요약에서 구분한다. 서로 다른 시점의 수치를 합산한 최종 통과 수나 호환 완료율은 만들지 않는다.

## 종료·후속 상태

종료 당시 Windows/Web **PARTIAL**, Android **stale/notVerified**, Linux·iOS/macOS **DEFERRED**다. 전체 API **4 packages / 834 subpaths**와 서명 의무, 실제 OS 소스 이식·전체 앱/설치·복구·제품 수락·마지막 소비자 이후 레거시 삭제 의무는 [work10 잔여 대응표](../11/work10-summary.md#work9-잔여-의무-이관)에 보존한다.

후속 성능 기록은 [work10](../11/work10-summary.md) → [Windows work10-a1](../11/work10-a1-summary.md) → [work11](../../../../work11.md)이다. 보관일 현재 work11도 **PAUSED / PARTIAL**이며 이번 보관으로 제품 검증이나 자동 재개를 수행하지 않았다.

[이력 목록](../../../README.md) · [선행 work8](../04/work8-summary.md)
