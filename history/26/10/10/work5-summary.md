# W5 — TypeScript 프레임워크 반자동 이식 요약

원문: `work5.md` · 작성일: 2026-10-10 KST · 구성 변경·선정 완료: 2026-10-11 KST · 아카이브: 2026-10-27 KST

상태: **W5-00~11의 선정 구현·대표 검증·외부 소비·정리 COMPLETE**. Flutter 전체 기능과 플랫폼의 물리 수락은 **PARTIAL/notVerified**다.

## 변경

- Doroti/Flutter 원본을 분석해 TS 초안·의존성 매핑·diff를 만들고 의미·플랫폼 경계를 검토해 채택하는 반자동 방식을 선택했다.
- 도구를 루트 `tools/Nelyx.FrameworkToTypeScript`의 독립 Bun/TypeScript 프로젝트로 분리했다. SDK와 앱은 채택된 제품 TS를 소비하며 Bun/.NET/Dart runtime을 요구하지 않는다.
- 기존 frame/resource 수명 위에 Widget·Element·State·RenderBox, scheduler·constraints·text·gesture·animation·고정 extent lazy list·복수 editor·navigation과 선정 디자인 조합을 연결했다.
- theme/locale·focus reveal·nested wheel·resize·semantics 후속 frame·native 세대 교체와 font/image 수명을 보강했다.
- 실제 Metro에서 발견한 `Padding is not a constructor` 순환 import를 수정했다. Web refresh 때 detached DOM 부모에 편집기가 붙던 오류는 원래 placeholder 부모/sibling을 복원하도록 고쳤다.

## 기록된 검증

- Chrome/CanvasKit WebGL2에서 pointer·theme/locale·lazy wheel·detail/dialog/Back·두 DOM editor·resize·DPR1/2를 확인했다. SDK close 뒤 canvas/input·등록 font 회수와 context 종료도 확인했다.
- packed 외부 앱의 실제 Web Fast Refresh에서 update 3/reload 0/errors 0, root State 초기화·옛 canvas retirement·font 수 유지를 확인했다. State 보존 reassemble은 제공하지 않았다.
- Windows x64 Release/Hermes/Graphite-Vulkan에서 실제 pixels·UIA·OS mouse·editor 값/focus 복원·wheel·resize와 협력적 close **exit 0**을 확인했다.
- Android x86_64 Release/Pixel_5 emulator에서 화면·tap·ASCII native input/Latin IME·focus/문서 복원·touch scroll과 잘못된 tap 억제를 확인했다.
- source/archive/설치 bytes·49개 Core 공개 module·선언/map/notice·외부 CLI 소비, 최종 SDK build·types·Web build가 통과했다. 실행 소유 UI helper·외부 앱·서버·emulator와 scratch는 정리했다.

## 남은 범위

위 결과는 선정 사용자 흐름의 수락이다. 한글 composing/candidate·물리 입력·Narrator/TalkBack·독립 GPU drain·scanout/FPS·서명/clean-machine은 미검증이다. 일반 layout/compositing·rich text·가변 목록·전체 Material/Cupertino·복원/deep link·State 보존 reload 등의 확대는 W6 이후로 이어졌다.

[전체 이력](../../../README.md) · [W6 잔여 기능](../11/work6-summary.md)
