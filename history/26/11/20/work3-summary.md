# Vite 단일 PWA와 Tauri 플랫폼별 검증

2026-11-20 · 전환 구현 / 환경별 인수 PARTIAL · 원문: `work3.md` (`git show 1c51f17d:work3.md`)

Vite로 PWA를 한 번 빌드해 브라우저에 배포하고 Tauri 패키지에도 같은 자산과 빌드 ID를 공급하도록 전환했다. 개발 서버도 Vite로 통일했다.

| 환경 | 당시 확인 | 남은 범위 |
| --- | --- | --- |
| Windows Chrome PWA | 루트·하위 경로 설치, 서버 종료 후 실행·딥 링크, 손상된 Wasm 갱신 거부와 정상 버전 활성화 | 모바일 홈 화면 설치·오프라인 재실행 |
| Windows WebView2 | Demo·Testbed EXE와 NSIS 생성, 단독 EXE의 네트워크 차단 첫 실행, 자산 해시·WebGL2·개발 HMR | 배포 서명 |
| Android | x86_64 에뮬레이터에서 디버그 APK 오프라인 첫 실행, 입력·회전·복귀·개발 HMR, 릴리스 AAB 생성 | 서명된 배포본과 실기기 인수 |
| Linux | WSL2에서 ELF·deb 생성, 추출본을 Xvfb 소프트웨어 GL에서 실행해 갤러리·IPC 확인 | 배포판 설치, 내부 자산 해시, 실물 GPU·IME·스크린 리더 |
| macOS·iOS | 공용 호스트와 패키징 경로 구현 | Xcode 빌드·설치·WKWebView 실행, 서명·공증 등 배포 검증 |

GitHub Actions의 플랫폼 간 전달은 구성했지만 실제 CI 실행은 미검증이다. 별도 디자인 검사는 NavigationRail에서 중단됐고 Material BottomSheet와 일부 Cupertino 단위 검사도 통과하지 못했다.
