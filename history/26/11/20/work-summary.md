# Demo의 Windows Tauri 호스트 실험

2026-11-20 · 구현·검증 완료 · 원문: `work.md` (`git show 1c51f17d:work.md`)

- **구현:** 기존 Web 갤러리를 Windows x64 WebView2에 넣었다. 릴리스는 정적 자산을 EXE에 내장하고, 개발 창은 Metro를 사용한다. Rust IPC 응답을 창 제목에 반영해 호스트 연결을 확인했다.
- **검증:** Metro를 끄고 빈 디렉터리에서 28.1 MiB EXE만으로 시작했다. 내장 JS·Wasm·폰트·이미지 해시, WebGL2, 스크롤·텍스트·Tab·리사이즈 후 클릭이 통과했다. 개발 창의 HMR·새로고침과 종료 후 포트 반환, 빌드 중단 시 이전 EXE 보존도 확인했다.
- **범위:** Chrome과 기존 Windows Hermes 실행은 유지했다. Demo 한정 실험을 앱 공통 CLI로 옮긴 결과는 [W2](work2-summary.md)에 있다.
