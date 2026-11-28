# 날짜 선택기와 앱 현지화

원문 `work6.md` · 작성·실행 2026-11-26 KST · 기준 `main` `c5dbc005` · 보관 2026-11-28 KST · 원문 조회 `git show 92b34484:work6.md`

**IMPLEMENTED.** Demo와 Testbed의 지정 플랫폼에서 현지화 회귀를 확인했다.

## 구현

- Core의 `IntlProvider.forLocale()`가 브라우저·WebView의 `Intl` 포매터를 공용으로 제공한다. Material 단일·범위 달력과 독립 날짜 필드는 같은 Gregorian 포맷·힌트·파서를 쓰고 Cupertino 월 이름도 공용 provider에 연결했다. 사용자 delegate와 명시적 다이얼로그 로케일을 존중한다. 이미 열린 달력의 표시 월과 편집 중 입력·파서를 유지하고 확정 뒤 새 형식으로 표시한다.
- `WidgetsApp`은 선택한 delegate 로드가 모두 성공하면 로케일·리소스·앱 문구·fallback을 함께 확정한다. 최초 실패 때 지원 목록의 첫 로케일로 한 번 복구하고, 이후 실패 시 마지막 정상 화면을 유지한다. 문서·뷰·다이얼로그와 활성 DOM 편집기에 유효한 `lang`·`dir`를 적용한다. 별도 Material 창은 자체 `Overlay`를 갖는다.
- Flutter 고정 리비전 `71e4717a61786faab4c7aa39825989305ed29e8a`에서 Widgets 117개, Material 116개, Cupertino 115개로 ARB 348개를 가져왔다. 지역·스크립트 기본값과 상속을 적용한 최종 카탈로그는 각각 122·121·120 태그다. 자리표시자와 복수형 검증, 원본 blob·SHA-256·정규화 기록과 Flutter 고지를 세 공급본에 포함했다. [일괄 가져오기](../../../../tools/Nelyx.FrameworkToTypeScript/import-flutter-localizations.mjs)

## 당시 검증

| 환경 | 확인 결과 |
| --- | --- |
| Demo Web `3822cd6f0128` | 단일·범위·독립 날짜 입력, 사용자 delegate, 연속 요청과 실패 복구, RTL·별도 다이얼로그, 입력 포커스·선택·한글 조합 유지. |
| Testbed Web `555ce0ddbd59` | Material 날짜·시간 다이얼로그, Cupertino 날짜·타이머 휠. 액션 시트 클릭 타이밍에서 한 번 실패한 뒤 마지막 W11 전체 회귀 통과. |
| Windows x64 `831c4e855590` | NSIS 추출본·WebView2에서 날짜 입력, RTL, EditContext 포커스·선택·한글 조합 유지. |
| Android x86_64 `831c4e855590` | API 33 에뮬레이터의 서명된 Debug APK에서 명시적 영어 다이얼로그와 시스템 언어 테스트 이벤트, 편집 포커스·선택 확인. |

두 시간대에서 윤일 왕복·잘못된 날짜·로케일 변형을 검사했다. ARB 재생성 `--check`와 Core·Material·Cupertino 배포 아카이브의 카탈로그·출처·라이선스 검증도 통과했다. Demo의 **Language and dates**에서 단일·범위 날짜와 로케일 전환을 확인할 수 있다. [현지화 검사](../../../../sample/nelyx-demo-app/eng/check-localization.mjs)

시스템 언어 이벤트는 테스트에서 주입했고 Web·Windows 한글 조합은 CDP 입력으로 확인했다. Android 13에서 앱별 언어를 `ko-KR`로 바꿨을 때 WebView 109의 `navigator.languages`는 `en-US`를 유지했다. OS 전체 언어 변경, 기기 키보드 조합과 스크린 리더 발화는 실기기 확인이 남았다.
