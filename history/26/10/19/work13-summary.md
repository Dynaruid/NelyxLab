# W13 — Core/Skia 자체 UI와 편집·성능 개선 요약

원문: `work13.md` · 작성·전면 검토일: 2026-10-19 KST · 종료일: 2026-10-21 KST · 아카이브: 2026-10-27 KST

상태: **CLOSED / SUPERSEDED BY W14 / 제품 PARTIAL**, `wholePlanComplete=false`.

## 제품 방향

- 기본 UI의 상태·layout/paint/hit/clip·text/caret/selection/composing·menu/dialog/picker를 **Core/Skia**가 소유한다. native/DOM은 비시각적 입력·IME·접근성·OS 서비스와 명시적 외부 view를 연결한다.
- 제품 TS를 실제 owner에서 직접 개발하고 Doroti의 책임 분리·단일 Core identity·M3 only·공통 Testbed를 유지했다. 샘플 painter·보이는 OS control로 미구현 기본 위젯을 대신하지 않도록 했다.
- 기존 Form·undo/formatter·font/paragraph·route·자원 수명과 채택 코드를 재사용했다. TypeScript 7 CLI/6 API emit은 유지하고 Oxlint는 선택 도구로 두었다.

## 주요 구현과 당시 검증

- `sample/nelyx-testbed-app-2`의 Material/Cupertino·theme/locale·State를 공통 앱에 연결하고 공개 export/identity·OverflowBar·배율을 보강했다.
- Core TextPainter/SkParagraph와 RenderEditable이 glyph·caret·selection·composing·hit/scroll geometry를 소유하도록 전환했다. controller·formatter/history/Form와 OS 조합/ACK의 owner를 구분했다.
- Web EditContext/비시각적 DOM, Android BaseInputConnection, Windows TSF/Skia surface·키·UIA를 연결하고 epoch/revision·focus/geometry·close fencing을 보강했다. 선정 Windows GPU caret/TSF·OS 키/Unicode·한국어 조합·resize·정상 종료 증거는 전체 provider/물리 수락과 구분했다.
- animation·접근성 geometry/전송·React 알림·root/layer/semantics snapshot의 중복 할당을 줄였다. 최종 관련 회귀72개·types·package/design ownership과 선정 source/설치 일치를 확인했다. 이전 진단의 약6MB/frame·GC 관찰은 특정 조건의 비용이며 보편적 값이 아니다.
- Windows resize 대응으로 오류 보고·대기열/수명 처리를 보강하고 Release/창 응답·협력적 exit0을 확인했다. 원래 멈춤·빈 영역의 원인은 재현하지 못해 미확정으로 남겼다.
- InkSparkle canonical 소스를 `packages/material/assets/shaders/ink_sparkle.sksl`로 분리하고 build 시 포함했다. Material build·types·회귀13개·CanvasKit/독립 소비는 PASS이며 이 변경 후 실제 native/browser 실행은 재검증하지 않았다.

## 승계한 미완료

W13-01~11 전부와 자체 렌더링 전환 R0~R6를 W14로 넘겼다. 디자인 family·locale·scroll·앱/복원·개발/inspector·플랫폼 공급·접근성/임베딩·최종 통합이 남았다.

기본 Windows provider/Fabric focus·OS 입력 순서와 최신 Android APK·물리 검증, 성능/실제 display pacing·GPU loss/drain·resize 원인·배포 수락은 완료로 올리지 않았다. 옛 보이는 editor 증거는 새 Core 렌더링 수락에서 제외했다. 과거 정리 거부/EPERM 예외도 삭제 완료로 바꾸지 않았다.

[전체 이력](../../../README.md) · [W14 테스트베드·엔진](../22/work14-summary.md)
