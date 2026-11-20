# Material·Cupertino 생성 후보와 변환 차단분의 패키지 이식

원문 `work11.md` · 시작 2026-11-19 KST · 후속 구현·정적 검증 및 보관 11-20 · 원문 스냅샷 `ffe5c5a2`

**패키지 이전 및 후속 구현 완료(정적 검증)**. 고정 Flutter 원본 `71e4717a61786faab4c7aa39825989305ed29e8a`의 공개 API와 핵심 동작을 대조해 TypeScript를 소유 패키지에 반영했다. 출처·라이선스를 유지하고 기존 구현과 동등한 동작은 해당 구현을 채택했다. 이후 변경은 제품 TypeScript에서 직접 관리하고 변환 도구·recipe는 동결한다. [Material 공개 위젯](../../../../packages/material/src/widgets.ts) · [Cupertino 공개 위젯](../../../../packages/cupertino/src/widgets.ts) · [변환 도구](../../../../tools/Nelyx.FrameworkToTypeScript/README.md)

## 이식 집계

| 입력 | 병합·직접 이식 | 기존 구현 채택 | 미완료 |
| --- | ---: | ---: | ---: |
| 후보 482개 파일 (Material 262, Cupertino 220) | 225 | 257 | 0 |
| 차단 884개 변환 단위 | 544 | 340 | 0 |

초기 이식에서 479개 파일과 868개 단위를 처리했고, 후속에서 3개 파일과 16개 단위를 이식했다. 차단의 단계별 집계는 emitter 871개·IR 13개다. 행별 차단 단계는 확정하지 않았고, 기존 범위에서 제외한 M2 기본값 클래스 24개와 해당 멤버의 집계 기준을 유지했다. 원본 위치·제품 경로·행별 대조 기록은 `git show 00d76390:work11-inventory.tsv`에서 조회할 수 있다.

## 주요 구현과 후속 과제

- SearchAnchor와 전체 화면 검색의 열기·전환·선택 결과, 비동기 Autocomplete, 메뉴의 키보드 탐색과 초점, 위치 및 상태 복원을 패키지 경로에 연결했다. Scaffold는 배너·SnackBar·FAB·하단 시트, 라우트 전환과 결과를 처리한다. Cupertino의 페이지·시트·팝업·컨텍스트 메뉴와 탭 탐색을 Core Overlay와 연결했다. [SearchAnchor](../../../../packages/material/src/search-anchor.ts) · [Scaffold](../../../../packages/material/src/scaffold.ts) · [Cupertino 라우트](../../../../packages/cupertino/src/route.ts)
- Material 달력·범위·시간 및 Cupertino 날짜·타이머의 선택과 현지화, 폼 복원과 길이 포매팅, 텍스트 선택 메뉴·맞춤법 서비스·접근성 동작을 대조했다. 슬리버 앱 바·Carousel·재정렬 목록, 테마·색상·글꼴과 로캘을 기존 Core와 연결했다. iOS 상태 표시줄 입력, 상태 표시줄 색상 annotation과 앱 정보의 표시 이름도 패키지·호스트 경로에 반영했다.
- 후속 이식은 M2 테마 선택과 관련 컨트롤 3개 파일·6개 단위, Web 독립 다이얼로그 창 4개 단위, 앱 진단·접근성 디버거 4개 단위, IME 조합 중 길이 제한 2개 단위였다. 독립 창이 막히면 Overlay로 열고 Web의 겹치는 IME 조합은 완료 시 길이를 제한한다. [M2 테마](../../../../packages/material/src/theme-data.ts) · [Web 창 호스트](../../../../Nelyx/sdk/src/platforms/web/dialog-windows.ts) · [Core 앱 진단](../../../../Nelyx/src/framework/widgets/app-diagnostics.ts)

## 당시 검증

초기에 고정 Flutter 라이브러리 175개와 추가 참조 파일 7개의 Git blob 및 소비 경로 193곳을 대조했다. 후속에서 Flutter 파일 15개를 대조했고 Core·디자인·SDK 빌드, 디자인 공개 경로 315개와 관련 Core·SDK 6개 경로의 엄격 모드 소비자 컴파일, 영향 진입점 7곳의 ESM 값 export가 통과했다. Windows 직접 호스트·RNW 입력 C++ 헤더 구문 및 Android 네이티브 Kotlin 컴파일까지 확인했다.

iOS 네이티브 컴파일, 플랫폼별 실행, 실기기 입력과 화면 일치는 미검증이다. 이전 Web Release에서 SearchAnchor가 클릭으로 열리지 않던 증상의 수정은 코드에서 대조했으며 재실행하지 않았다. 호스트의 디스플레이 분할 정보 자동 수집과 플랫폼 맞춤법 채널 구현도 당시 미확인 또는 후속 범위였다.
