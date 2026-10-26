# Nelyx SDK 설계 초안 v2 요약

원문: `nelyx-draft-v2.md` · 작성·검토일: 2026-10-07 KST · 아카이브: 2026-10-27 KST

상태: **구현 착수 전 설계 제안**. Nelyx 구현·빌드·기기 실행 결과가 아니다.

## 설계 방향

- Nelyx를 Flutter의 Widget·Element·RenderObject 책임 구분을 참고하는 TypeScript UI SDK로 정의했다. 앱은 화면·도메인 상태를, SDK는 framework·공통 계약·host/graphics provider를 소유한다.
- Widget은 불변 구성, Element는 트리·State 수명, RenderObject는 layout·paint·hit test를 담당한다. 공통 계약은 RN·Deno·Skia 구현에 의존하지 않는다.
- AppSession이 서비스와 앱 종료를, ViewRuntime이 각 View의 root·BuildOwner·PipelineOwner·scheduler를 소유한다. 공유 서비스는 owned/borrowed 등록과 호출 lease로 수명을 구분한다.
- 당시 모바일 출발점은 RN/Hermes/RN Skia, 데스크톱 제안은 Deno와 별도 native Skia host였다. RN/RN Skia는 필요하면 fork·축소·재구성할 수 있는 기반으로 취급했다.
- SDK는 표준 ESM·타입·exports·provider metadata를 제공하고, Metro 설정·entry·개발 서버·bundle 생성은 템플릿과 소비 앱에 둔다. Deno 기본 소비는 ESM, Metro 연결은 선택 실험이었다.
- 불변 프레임·consumer lease·GPU retirement, 제출량 제어, font/paragraph 측정과 한글 IME를 위젯 확장보다 먼저 검증하도록 했다.

## 초기 범위와 관문

Windows 단일 창과 Android 단일 View에서 기본 배치·Text/Image/Button·유한 scroll·native TextField·focus/semantics를 먼저 확인하고, iOS·다른 데스크톱·복수 View·가상화·고급 조합은 후속으로 두었다. Flutter 전체 API·패키지 호환이나 완전한 Material/Cupertino는 초기 범위가 아니었다.

진행 순서는 의존성·최소 앱 고정 → 실제 Skia 출력/수명/입력 → 공통 코어의 동일 화면 → 실제 사용자 흐름 → 플랫폼·성능 → 배포였다. 창 생성·PNG·CPU raster·합성 입력만으로 GPU 표시·물리 IME·reader·scanout을 수락하지 않는 경계를 명시했다.

## 이후 변경과 해석

공식 자료·RN Skia 소스와 DorotiLab의 책임·수명 계약을 검토한 제안이다. 문서의 API·디렉터리·버전 후보는 당시 설계이며 현재 구현 명세가 아니다. Deno 데스크톱은 후속 W3에서 RN 기반으로 대체됐고, 기본 UI의 자체 Core/Skia 렌더링과 직접 Hermes host 방향은 이후 계획에서 발전했다.

[전체 이력](../../../README.md) · [W3 데스크톱 전환](../09/work3-summary.md) · [W18 기반 개편](../25/work18-summary.md)
