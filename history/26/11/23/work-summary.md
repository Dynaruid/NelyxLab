# Nelyx Rust 백엔드와 Web·Tauri 빌드 개편

원문 `work.md` · 작성 2026-11-23 KST · 기준 `tauri-backend` `ba26ba1a` · 보관 2026-11-28 KST · 원문 조회 `git show 92b34484:work.md`

**당시 판정은 구현 완료, 로컬 인수는 아래 환경에 한정한다.**

## 구현

- Demo·Testbed·스타터를 `nelyx.app/v4`로 전환했다. 두 타깃은 TypeScript UI의 `src/index.ts`와 Rust 라이브러리의 `backend/src/lib.rs`를 공유한다. CLI는 타깃별 Cargo 잠금과 앱 크레이트의 경로 의존성에서 Wasm 또는 Tauri 호스트를 생성한다. 호스트 정보, 클립보드 정책과 Android 화면 여백은 SDK에서 공급한다.
- Web은 `.nelyx/web`에 정적 웹 또는 PWA를 게시하고 `runtime/backend/`에 백엔드 Wasm을 넣는다. 앱 Rust를 생략한 웹 앱은 SDK 기본 Wasm을 쓴다. Tauri는 `.nelyx/tauri/frontend`를 패키지에 내장하고 같은 앱 백엔드를 네이티브로 링크한다. CI는 `--frontend-only`로 만든 UI를 OS별 `pack --frontend` 작업에 전달한다.
- 빌드 식별에 앱 소스·Cargo 입력·SDK와 실제 프런트엔드 자산의 해시를 반영한다. 샘플은 앱 루트에서 npm을 각각 설치한다. 기존 `src-tauri`와 `web/runner`는 앱 설정·`platform/` 및 SDK 템플릿으로 이관했다. [CLI와 타깃별 실행 절차](../../../../Nelyx/sdk/tooling/cli/README.ko.md)

## 당시 검증

| 환경 | 확인 결과 |
| --- | --- |
| SDK와 외부 앱 | SDK·두 샘플 타입 검사와 Rust 정책 검사 통과. 외부 앱에 SDK tarball만 설치한 뒤 Rust 함수 한 곳을 수정하자 양쪽 호출 결과가 21에서 22로 바뀌었다. 웹 Cargo 그래프의 Tauri 의존성은 0건이었다. |
| Web·PWA | 두 샘플의 루트와 `/demo/`에서 호출·Wasm MIME·해시와 오프라인 재시작을 확인했다. 손상된 업데이트에서 이전 PWA가 유지됐다. 정적 스타터는 Rust 도구 없이 기본 Wasm으로 실행됐다. |
| Windows x64 | 두 앱의 EXE·NSIS를 만들고 오프라인 WebView2에서 IPC, 창 제목, 앱별 클립보드 권한과 실제 내장 빌드 ID를 확인했다. 백엔드 Wasm 요청과 서비스 워커 등록은 0건이었다. Testbed Rust 수정 후 호스트 재시작에서 21 → 22를 확인했다. |
| Android | Demo x64·ARM64의 디버그 서명 APK와 서명 전 AAB를 만들었다. API 33 x64 에뮬레이터와 외부 생성 앱에서 Rust 호출·여백을 확인했다. Demo의 한글 입력·선택·클립보드·회전과 개발 세션의 여백 구독 교체도 통과했다. |
| Linux x64 | WSL Ubuntu에서 공용 Tauri 프런트엔드로 ELF·DEB를 생성했다. DEB의 실행 파일을 Xvfb에서 열고 네이티브 `describe`와 Linux 제목을 확인했다. |

다른 앱·타깃·프로토콜, 변조된 자산과 오래된 Rust 입력은 거절됐다. 패키징이 실패하거나 실행 중인 EXE로 교체할 수 없을 때 이전 패키지가 보존됐다. 최종 Web 백엔드 Wasm은 Demo 76,507바이트, Testbed 76,515바이트였다. 마지막 클립보드 수정 전 Chrome 세 번의 콜드 스타트 중앙값은 983 → 968ms였고, Windows 개발판의 지정 휠 스크롤 중 IPC는 0건이었다.

브라우저 전체 갤러리 검사에서 NavigationRail `Recent`와 Cupertino Action Sheet 결과가 시간 초과됐다. Android ARM64 실기기 실행, 배포 서명, macOS·iOS의 빌드·실행·서명·공증과 GitHub Actions 실행은 당시 미검증이다. Tauri 6타깃 CI는 YAML 파싱까지 확인했다.
