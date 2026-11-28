# Windows Tauri 창 Acrylic

원문 `work8.md` · 작성·실행 2026-11-27 KST · Nelyx 기준 `32e8c3bb` · Doroti 비교 `35475819` · 보관 2026-11-28 KST · 원문 조회 `git show 92b34484:work8.md`

**IMPLEMENTED.** Demo는 같은 창에서 Desktop Acrylic을 켜고 끌 수 있다.

## 구현과 사용

- `nelyx.targets.tauri.windows[]`에서 `windowsAcrylic: true`인 Windows 창에 투명 WebView2와 아크릴 명령 권한을 부여한다. 네이티브 어댑터는 호출 페이지와 창을 확인하고 DWM의 `DWMSBT_TRANSIENTWINDOW`와 `DWMSBT_AUTO`를 전환한다. [DWM 어댑터](../../../../Nelyx/backend/crates/tauri-plugin-nelyx-backend/src/window_acrylic.rs)
- SDK의 `windowAcrylicFor()`는 지원 창에 `enabled`와 `setEnabled(boolean)`을 제공한다. 성공 시 투명 CanvasKit과 DOM 배경, 반투명 위젯 표면을 조합한다. 요청이 실패하면 직전 배경과 스위치 상태를 유지한다. 지원 밖 환경은 불투명 배경으로 표시한다. [SDK 환경 API](../../../../Nelyx/sdk/src/frontend/dom/environment.ts)
- Windows Demo의 **Settings → Acrylic window**에서 전환한다. 새 창은 불투명하게 시작한다. [Windows Demo 실행 안내](../../../../sample/nelyx-demo-app/README.ko.md)

## 당시 검증

- Windows 11·WebView2의 200% 배율에서 direct·worker-shared·worker-transfer의 실제 뒤쪽 창 흐림을 확인했다. 비교한 배경 패턴의 원본 경계는 인접 픽셀 채널 차이가 최대 211이었고 Acrylic 상태의 Demo와 제목 표시줄에서는 각각 1·4였다. Acrylic을 끈 뒤 패턴을 바꿨을 때 같은 위치의 변화는 0이었다.
- 같은 HWND에서 DWM 속성 `0 → 3 → 0`, WebView 문서와 캔버스 유지, 크기 변경·최대화·복원·키보드 스위치 조작을 확인했다. Cupertino 입력값과 다크 모드가 유지됐다. Chrome 세 렌더 경로의 불투명 시작과 Windows 이외 타깃의 설정 생성도 확인했다.
- Windows EXE·프런트엔드 `4b4edeb060bb` 식별, IPC·클립보드·내장 자산과 Web 빌드 검사를 통과했다. 아랍어 대체 글꼴을 `TextFieldOptions.style`로 전달하는 수정 후 Demo 전체 타입 검사와 패키지 `2503b34c1615`의 현지화 입력·날짜 대화상자 검사도 통과했다. [Windows 패키지 검사](../../../../Nelyx/eng/check-tauri-windows.mjs)
