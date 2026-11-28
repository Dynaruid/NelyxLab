# Web·Tauri 위젯 핫 리로드와 빌드 재사용

원문 `work5.md` · 작성·실행 2026-11-25 KST · 조사 `a30b5771`·`daba4751` · Vite `8.3.8` · 보관 2026-11-28 KST · 원문 조회 `git show 92b34484:work5.md`

**위젯 상태를 보존하는 개발 갱신과 반복 빌드 재사용을 구현했다.**

## 개발 모드

- `dev:web`과 `dev:tauri`에서 호환되는 앱 TypeScript의 `build()` 본문은 기존 클래스·모듈 바인딩과 `State`로 실행한다. AST로 선언·상속·필드와 참조를 검사한 뒤 최신 정상 구현을 프레임 사이에 적용한다. 마운트된 트리는 기존 빌드·레이아웃·그리기·semantics 순서로 다시 그린다.
- CSS는 Vite HMR로 처리한다. HTML·엔트리·클래스 구조 변경은 사유를 표시하고 뷰 정리 후 문서를 한 번 재시작한다. 문법 오류나 잘못된 자산 설정에서는 마지막 정상 화면과 파일을 유지한다. 소켓 재연결 때 세션과 변경 순번을 대조한다.
- Web의 Rust 수정은 검증된 Wasm과 바인딩을 게시한 뒤 문서를 재시작한다. Tauri는 호스트를 교체하는 동안 Vite와 워처를 유지한다. 컴파일 오류를 고쳐 저장하면 새 호스트의 `describe`에서 백엔드 ID를 확인한다. [Vite 개발 설정](../../../../Nelyx/sdk/tooling/vite/src/config.mjs) · [Tauri 개발 실행](../../../../Nelyx/sdk/tooling/cli/src/tauri-runner.mjs)

## 빌드와 배포

- SDK 컴파일·압축, 앱 설치, Rust 공급, Wasm 바인딩과 기본 Vite 출력은 입력 지문과 현재 산출물의 해시를 대조해 재사용한다. 손상된 npm 패키지는 해당 패키지만 복구하고 손상된 릴리스는 같은 ID로 다시 만들었다. 사용자 Vite 설정은 다시 실행한다. 동시 실행은 게시 잠금으로 보호하며 기존 정상 릴리스를 보존한다.
- Android 기기용 `deploy`는 `--apk-only`로 지정 ABI의 서명된 Debug APK를 만든다. x64·ARM64에서 Release AAB 호출은 0회였고 기존 AAB는 보존됐다. 일반 패키징은 APK와 AAB를 함께 생성했다. 검증된 기본 Android Debug APK와 Windows NSIS도 입력 일치 시 재사용한다.

| 당시 Testbed 측정 | 캐시를 채운 실행 | 동일 입력 반복 |
| --- | --- | --- |
| Windows 루트 Web 빌드 | 156.98초 | 중앙값 4.33초, SDK·npm·bindgen·Vite 실행 0회 |
| Windows 루트 Tauri 빌드 | 61.32초 | 중앙값 4.42초, SDK·npm·Vite·패키징 실행 0회 |
| Android x64 Debug APK | 패키징 68.45초 | 7.58 / 1.90 / 1.84초, 마지막 두 회차 Gradle 호출 0회 |

측정은 로컬 도구 캐시가 있는 환경이다. 동일 입력의 릴리스 ID와 산출물 해시를 대조했다. Gradle 출력 캐시 실험에서 `FROM-CACHE`는 0개였으며 기본값은 설정 캐시만 유지했다.

## 당시 확인 범위

Chrome의 세 렌더 경로와 외부 생성 Web 앱, Windows WebView2, Android x64 에뮬레이터, WSL의 Linux WebKitGTK에서 호환되는 수정 후 상태 보존을 확인했다. 브라우저의 한글 편집·선택과 Testbed 스크롤 360px, Windows의 Rust 오류 복구, Android의 동일 PID와 여백 구독을 점검했다. Android Debug APK는 에뮬레이터와 Galaxy에서 실제 설치본 해시·ABI·앱 IPC·딥링크를 확인했다. Linux 검증은 Xvfb의 소프트웨어 렌더링까지다.

macOS·iOS 패키징과 실행, iOS 시뮬레이터의 로컬 개발 소켓과 실기기 HTTPS/WSS는 당시 미검증이다.
