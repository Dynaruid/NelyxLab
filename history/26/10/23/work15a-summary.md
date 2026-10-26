# W15A — 전체 앱 Static Hermes AOT와 JSC 확장 요약

원문: `work15a.md` · 기준·최종 판정일: 2026-10-23 KST · 구현 재개: 2026-10-22 KST · 아카이브: 2026-10-27 KST

상태: **Windows G3 COMPLETE**, `wholeAppNativeAot=true`, `typePolicyAccepted=true`, `wholePlanComplete=true`, **`performanceAccepted=false`**. 이는 W15A의 Windows 실험 범위 완료이며 W14·전체 제품의 완료가 아니다.

## 전체 앱 실행과 타입 정책

- Testbed의 전이 실행 graph를 한 Static Hermes native image/VM으로 공급했다. 유효한 타입만 guarded scalar로 특화하고 불명확한 body는 같은 image의 동적 JS 연산으로 native 컴파일한다.
- ES2022 frontend의 TDZ·destructuring·loop cell·constructor/field 평가 순서와 public subclass·getter/receiver·NaN/음수0 등 의미를 보강했다.
- 최종 graph는 initializer **1,369개 100%**, 원본 callable **40,624 native(19 typed/40,605 dynamic) + 98 proven-dead**, emitted **47,149 native + 14 proven-dead**였다. 미분류·미해결·runtime codegen은0이다. 타입 후보 분모와 전체 native 분모는 다르다.
- VM 내부 JS와 RNW JSI manager도 native unit으로 연결하고 eval/JIT·source/bytecode fallback을 차단했다. loader가 scope/ABI/순서/hash와 숨은 delegate 변조를 거절했다.
- DLL/PDB/RVA에 결합한 함수 범위 PC→원본 함수 검사를 통과했다. statement 단위 정확도는 수락하지 않았다.

## 공급·기능 검증

Windows x64 Release/JSI21·pinned Static Hermes/CRT cohort의 실험 공급이었다. source→dist→여덟 archive→설치 **7,038 files**와 package/ZIP의 길이·hash를 대조했다. vendor hybrid CRT의 experimental 표기를 보편적 qualification으로 바꾸지 않았다.

실제 packaged app의 first content·Visible/Responding·정확한 DLL·협력적 exit0, compiler cache 없는 실행, pointer/UIA/OCR의 theme/dialog/Form/route, 별도 TSF/UIA·GPU caret·키/Unicode·resize·drain을 범위별로 확인했다. source/CanvasKit 검사와 native 실행은 별도 증거다.

## 성능 판정

V8/동일 VM bytecode/Static AOT × 기본/최대화 ×3회, 최종 **18회 기능·입력·정상 종료 PASS**였다. 아래는 run별 CPU wall p95의 중앙값이며 표시 FPS가 아니다.

| 엔진 | 기본 warm p95 | 최대화 warm p95 | 재방문 max 기본/최대화 |
| --- | ---: | ---: | ---: |
| V8 | 5.16ms | 6.04ms | 108.85/102.71ms |
| Hermes bytecode | 14.29ms | 18.17ms | 208.09/249.28ms |
| Static AOT | 11.05ms | 14.36ms | 206.23/265.73ms |

AOT는 V8 대비2.142/2.378배로1.10배 목표와 재방문100ms 목표에 미달했다. 최종 전체 build는약12분23초였고 compiler OS peak 약10.09GB가 당시8GiB 예산을 넘어 빌드 메모리도 FAIL이었다. 당시 기본 V8을 유지했고 **성능 미채택**으로 완료했다. W17 이후 Hermes 중심 방향과 혼합하지 않는다.

## 별도 확장

- Windows JSC26.4의 `--engine jsc --jsc-mode jit|interpreter`를 공급·CLI/Metro·템플릿에 연결했다. VM 생성 전 codegen 정책과 Promise/microtask·JS 의미·두 모드 실제 first-content/응답/정상 drain을 확인했다. JSC 성능·전체 입력/reader·배포 수락은 notVerified다.
- `widgetApplication({accessibilityEnabled:false})`를 추가했다. 기본값true이며 입력 carrier 수명과 분리했다. 비용 비교 옵션이고 접근성 off를 최종 성능 해결로 수락하지 않았다.
- RefreshSdk의 삭제된 supplier locator 복구, 임시 접근성 스위치·환경 복원, Static AOT 반복 빌드 비용을 보강했다.

## 남은 경계

물리 IME 후보창·reader·precision trackpad·GPU timestamp/VRAM·scanout/FPS·다른 OS는 notVerified다. 이 계획 완료가 전체 design catalog·W14 개편을 완료시키지 않는다. 과거 외부 temp/JSC download 정리 거부는 당시 예외이며 이번 아카이브에서 재삭제하거나 현재 잔존 여부를 검증하지 않았다.

[전체 이력](../../../README.md) · [스크롤 원인 조사](research-summary.md) · [W16 공통 엔진](../24/work16-summary.md)
