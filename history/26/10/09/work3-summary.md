# W3 — React Native 데스크톱 전환 요약

원문: `work3.md` · 작성일: 2026-10-09 KST · 중간 마무리·이관: 2026-10-10 KST · 아카이브: 2026-10-27 KST

상태: **PAUSED / PARTIAL**. 제품 구조 정리는 W4로 이관됐으며 W3 전체 기능은 완료되지 않았다.

## 방향과 구현

- W2의 Deno 데스크톱 계획을 폐기하고 Windows는 RNW, macOS는 RNM, Linux는 `lucid-softworks/react-native-linux` 기반으로 전환했다.
- 여섯 플랫폼의 독립 runner와 SDK/tooling, provider/config·native ABI·입력/semantics·Metro 개발 흐름·배포 경계를 구성했다.
- Windows Composition surface·Skia GPU 연결, Linux GTK/Vulkan·JSI port, Apple 코드 구성과 Android/Web 이행을 함께 관리했다.
- 최신 v60에서는 private RNW Core의 pre-unload ACK·process lease·factory 재진입 거부·detached Finalize·새 Composition session을 source와 소비자에 연결했다.

## 기록된 검증

v60의 실제 Metro reload 5회/Ready 6회/CLOSED 6회, 매회 카운터 초기화·편집·drain·정상 종료가 통과했다. 별도 Core/Hermes에서는 마지막 참조 해제·ACK 전 VM 유지·실패/기한/늦은 ACK·queued factory 등 다섯 사례와 Release groups 515/입력 2,131 검사가 통과했다.

이 결과는 private supplier의 선정 증거다. **기본 제품·다섯 archive·supplier는 v58**이었고 stock RNW reload 실패는 유지됐다. v60 성공을 기본 공급 승격이나 전체 SDK/GPU teardown 완료로 해석하지 않는다.

## 남은 범위와 이관

- stock RNW full reload, private v60 공급 채택, startup/fatal/forced teardown·loss/recovery·GPU 종료의 전체 qualification이 남았다.
- Apple은 코드 구성만 범위에 포함했다. Mac 부재로 Xcode/Pods·기기·Metal·서명은 **SKIPPED/notVerified**다.
- Linux GPU 실행은 사용자 범위에서 제외했다. Docker의 component/거부 경로 검사를 GPU 표시 수락으로 올리지 않는다.
- Android 물리 입력·한글 IME·reader, scanout/FPS·clean-machine 배포도 미검증이다.
- 중간 정리에서 재설치 가능한 dependency·native cache 352개를 제거했다. 당시 인계/checkpoint·`Nelyx/docs`는 이후 정리 정책에 따라 제거된 과거 경로이며 복구 조건이 아니다.

[전체 이력](../../../README.md) · [W4 구조 정리](../10/work4-summary.md)
