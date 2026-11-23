# 텍스트 선택·확대경 후속 인수

2026-11-22 · PARTIAL · 원문: `work7.md` (`git show 1c51f17d:work7.md`)

- **수정:** 읽기 전용 선택 메뉴를 복구하고, 재배치된 편집기의 컨트롤러·입력 연결 인계와 WebKitGTK 수정 키 해제를 바로잡았다. 첫 한글 단어에서 Cupertino 시작 핸들이 사라진 원인은 선택 끝점이 경계보다 0.205 논리 픽셀 바깥에 있었던 것으로, 스크롤 적용 전 앵커를 문단 폭 안으로 보정했다.
- **검증:** Chrome PWA, Windows WebView2의 키보드 메뉴·클립보드·UI Automation, Linux X11/AT-SPI 경로를 확인했다. Pixel 5와 Galaxy에서 ADB·CDP로 한글·RTL·여러 줄 선택의 양쪽 핸들 픽셀, 확대경·자동 스크롤·취소·WebGL 복구를 확인했다.
- **남은 범위:** 수정본 Pixel 5 편집기 플링의 표시 간격 p95는 100.08ms였다. W5 원본 APK와 교대 비교하지 못해 성능 회귀 여부는 미정이다. Windows 실물 키보드·Narrator, Galaxy 손가락·Gboard 한글 조합, iOS 기기·macOS 창은 미검증이다.
