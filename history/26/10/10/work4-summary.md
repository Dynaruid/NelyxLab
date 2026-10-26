# W4 — 제품 구조 정리와 검증 구성 제거 요약

원문: `work4.md` · 작성·실행일: 2026-10-10 KST · 아카이브: 2026-10-27 KST

상태: **W4-00~08 COMPLETE**. 구조 정리와 선정 확인의 완료이며 W3 제품 전체는 **PARTIAL**이다.

## 변경

- SDK build·provider 생성·native 준비를 `Nelyx/eng`와 `Nelyx/skia/eng`로, 앱 생성·bootstrap·runner archive·RNL 공급을 CLI로 모았다. 앱 runner가 runtime dependency와 native project를 소유한다.
- Windows/Linux host·개발/종료 연결과 Apple teardown 상태는 SDK native, GPU/JSI/component는 Skia에 두었다.
- W1~W3 검증 전용 probe·fixture·fault injection·강제 지연·전역 통계·대조 renderer와 sample hook을 제거했다. `tools/nelyx`, 옛 root template·tests·`Nelyx/docs`·과거 출력도 삭제했다.
- 실제 ABI/cohort/hash/byte-limit·generation·GPU retirement·close drain과 오류 cleanup은 유지했다. license/notice는 제품과 배포 패키지에 보존했다.
- 필수 Windows binary 입력과 provenance lock, private v60 RNW patch·header는 보존했으나 v60을 stock Core에 채택하지 않았다.

## 기록된 검증

| 범위 | 당시 결과 |
| --- | --- |
| 공통 공급 | SDK build·공통/Metro/CLI types·template sync, 소스/선언/map/license와 여섯 archive·runner 설치 확인 PASS |
| Windows | RNW Vulkan binding/Core·C ABI build, x64 Release Ready·카운터·정상 종료 PASS |
| Android | Temurin JDK21·x86_64 Release build, Pixel_5/API33 host Vulkan AVD의 Ready·입력·Back PASS |
| Web·외부 CLI | 외부 앱 생성·설치·typecheck·Web build와 Edge headless 텍스트/버튼 PASS |
| Linux | exact RNL prepare/build/pack·Vulkan binding/module compile PASS. GTK4 개발 package 부재로 GTK host 실행 미수행 |
| Apple | header·patch·pin/hash·template/package 구성 확인. native 실행·Metal·서명 미검증 |

초기 GraalVM jlink·SwiftShader adapter·삭제된 counter 참조 실패는 각각 JDK/host Vulkan/소스 보정 후 다시 확인했다. 실행 소유 임시 script·log·screenshot·외부 앱과 emulator를 정리했고 별도 검증 기록 체계를 남기지 않았다.

## 미완료 경계

stock RNW reload·v60 qualification·전체 GPU loss/teardown, Linux GTK/GPU, Android ARM64·물리 IME/reader, Apple native·서명, scanout/FPS·clean-machine 수락은 이 작업의 PASS 범위에 포함하지 않는다.

[전체 이력](../../../README.md) · [W3](../09/work3-summary.md) · [W5 프레임워크 이식](work5-summary.md)
