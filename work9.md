# work9 — Windows·Web 우선 엔진 v2 구현과 호스트 전환

작성: **2026-11-05 KST** · 재검토: **2026-11-06 KST** · 상태: **ACTIVE / Windows·Web 우선 계획, 신규 구현 미착수, 기존 구현 PARTIAL**

[work8 종료 요약](history/26/11/04/work8-summary.md) · [종료 시 API·검증 기록](history/26/11/05/work8-2a-summary.md#현재-구현-현황) · [Flutter 엔진 비교](history/26/11/05/work8-2a-summary.md#flutter-엔진-c-비교)

`work9.md`는 전체 목차이며 본문은 **1~4부와 그 후속인 5부**로 나눴다. 원문의 절 번호와 **W9-00–14의 15단계**, 기존 구현·미완료 상태를 유지한다.

## 분할 문서

| 문서 | 범위 | 작업 차수 |
| --- | --- | --- |
| [1부 — 범위·기준선·Windows 호스트·공통 경계](work9-1.md) | §1–4·§7: 우선 범위·work8 기준점·Windows App SDK·RNW 선별 재사용·최소 embedder | Windows/Web 1차 기반 |
| [2부 — 공개 API·렌더링·입력·Web](work9-2.md) | §8–11의 공통·Web 계약: API 호환·Widget/디자인·graphics/text·frame·입력·Web 두 profile·OS 코드 재사용. Android/iOS 상세 구현은 4·5부 | Windows/Web 1차 기능 |
| [3부 — 구현 순서·통합 검증·공급](work9-3.md) | §12–14: 실행 묶음·W9 단계/체크리스트·API/host/물리·성능 gate·공급/정리 | Windows/Web 1차 통합·판정 |
| [4부 — Android·Linux 호스트](work9-4.md) | §11.4·§5: Android standalone·InputConnection/접근성·RN 분리, GTK4/DMA-BUF·IM/AT-SPI·배포 | **2차 / Windows/Web 1차 완료 후 / DEFERRED** |
| [후속 5부 — iOS·macOS 호스트](work9-5.md) | §11.5·§6: UIKit/UITextInput·AppKit/Metal·접근성·Apple 공급 | **3차 / Android/Linux 2차 통합 완료 후 / DEFERRED** |

**개발 순서는 Windows/Web(threaded·single-worker) 1차 → Android/Linux 2차(4부) → iOS/macOS 3차(후속 5부)다.** 현재 구현 대상은 Windows/Web이며 Android/Linux는 1차 완료 후, iOS/macOS는 Android/Linux의 API·host·공급 통합 완료 후 착수한다. 후속 플랫폼의 toolchain·prototype·입력 adapter·배포를 앞선 차수의 완료 조건에 포함하지 않는다. 아직 착수하지 않은 대상은 모두 DEFERRED로 유지한다.

차수 전환의 ‘완료’는 **앞선 차수 모든 대상의 W9-13 기술 gate 통과**다. W9-14의 물리 입력·성능 수락·기본값 전환은 대상/profile별로 따로 판정한다. 전체 플랫폼의 기술 완료와 제품 수락도 각각 구분한다. [완료·차수 전환 기준](work9-3.md#125-차수-전환과-완료-판정)

1~3부는 같은 Windows/Web 계획을 역할별로 나눈 문서다. 실제 구현은 [3부 §12.2의 실행 묶음](work9-3.md#122-windowsweb-1차-실행-순서)을 따라 **W9-00 → W9-06-A → W9-01/02-A/B**부터 진행한다. 파일 번호와 원문 절 번호를 W9 단계의 순번으로 해석하지 않는다.

**이월 상태:** 전체 공개 API gate는 **FAIL**, 새 App SDK host는 미착수, 기존 engine/host 구현은 **PARTIAL**이다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 IME/reader/trackpad·display/scanout `notVerified`를 유지한다. Windows/Web 1차 완료와 전체 플랫폼 완료는 별도 판정이다.

## 원문 절 목차

기존 `work9.md#절-앵커` 링크도 아래 목차에서 해당 부의 본문으로 이동할 수 있다.

## 1. 이번 계획의 결정과 범위

[1부 본문으로 이동](work9-1.md#1-이번-계획의-결정과-범위)

## 2. work8에서 이어받는 기준점

[1부 본문으로 이동](work9-1.md#2-work8에서-이어받는-기준점)

- [이월 대응표](work9-1.md#이월-대응표)

## 3. 플랫폼별 채택 구조

[1부 본문으로 이동](work9-1.md#3-플랫폼별-채택-구조)

## 4. Windows — Windows App SDK 호스트

[1부 본문으로 이동](work9-1.md#4-windows--windows-app-sdk-호스트)

- [4.1 Windows RNW 소스 선별 재사용](work9-1.md#41-windows-rnw-소스-선별-재사용)

## 5. Linux — GTK4 호스트

[4부 본문으로 이동](work9-4.md#5-linux--gtk4-호스트)

## 6. macOS — AppKit 호스트

[후속 5부 본문으로 이동](work9-5.md#6-macos--appkit-호스트)

## 7. 공통 embedder·runtime 경계

[1부 본문으로 이동](work9-1.md#7-공통-embedderruntime-경계)

- [7.1 호스트 전환에서 보존할 공통 조건](work9-1.md#71-호스트-전환에서-보존할-공통-조건)

## 8. 기존 공개 API 호환 작업

[2부 본문으로 이동](work9-2.md#8-기존-공개-api-호환-작업)

- [8.1 검사 환경과 실행 모델의 선행 판정](work9-2.md#81-검사-환경과-실행-모델의-선행-판정)

## 9. 렌더링 표현력·재사용·frame 일정

[2부 본문으로 이동](work9-2.md#9-렌더링-표현력재사용frame-일정)

## 10. 입력·편집·semantics·가상화와 복구

[2부 본문으로 이동](work9-2.md#10-입력편집semantics가상화와-복구)

## 11. Web·모바일에서 유지할 범위

[2부 본문으로 이동](work9-2.md#11-web모바일에서-유지할-범위)

- [11.1 채택 방침과 앞선 소스 검토](work9-2.md#111-채택-방침과-앞선-소스-검토)
- [11.2 중립 adapter와 상태 계약](work9-2.md#112-중립-adapter와-상태-계약)
- [11.3 Web — 기존 DOM·Worker host 유지](work9-2.md#113-web--기존-domworker-host-유지)
- [11.4 Android — 기존 Nelyx OS 코드를 먼저 분리](work9-4.md#114-android--기존-nelyx-os-코드를-먼저-분리)
- [11.5 iOS — UIKit 입력 endpoint와 RN 예외 처리 이식](work9-5.md#115-ios--uikit-입력-endpoint와-rn-예외-처리-이식)
- [11.6 도입 순서와 의존성 gate](work9-2.md#116-도입-순서와-의존성-gate)
- [11.7 공통 입력·수명 검증 corpus](work9-2.md#117-공통-입력수명-검증-corpus)

## 12. 구현 단계와 완료 조건

[3부 본문으로 이동](work9-3.md#12-구현-단계와-완료-조건)

- [12.1 검토에서 수정한 선행 관계](work9-3.md#121-검토에서-수정한-선행-관계)
- [12.2 Windows/Web 1차 실행 순서](work9-3.md#122-windowsweb-1차-실행-순서)
- [12.3 단계별 범위와 완료 조건](work9-3.md#123-단계별-범위와-완료-조건)
- [12.4 실행 체크리스트](work9-3.md#124-실행-체크리스트)
- [12.5 차수 전환과 완료 판정](work9-3.md#125-차수-전환과-완료-판정)

## 13. 검증과 판정

[3부 본문으로 이동](work9-3.md#13-검증과-판정)

- [변경 범위별 필수 회귀](work9-3.md#변경-범위별-필수-회귀)
- [구현 시 사용할 기존 검사 명령](work9-3.md#구현-시-사용할-기존-검사-명령)

## 14. 공급·정리와 문서 운영

[3부 본문으로 이동](work9-3.md#14-공급정리와-문서-운영)

- [이번 문서 작업의 검증과 다음 시작점](work9-3.md#이번-문서-작업의-검증과-다음-시작점)

## 문서 분할 기록

**2026-11-05 KST:** `work9.md`를 전체 목차로 두고 1~3부는 Windows/Web 1차, 4부는 Android/Linux 2차, 후속 5부는 iOS/macOS 3차로 정리했다. Android §11.4·Linux §5를 4부, iOS §11.5·macOS §6을 5부에 배치했다. 원문 14개 주요 절·W9-00–14의 15단계와 Windows/Web 1차 실행 순서를 유지했다. W9-12-B는 Android 2차·iOS 3차의 target별 범위로 나누고 각 플랫폼의 완료 조건·체크리스트·문서 링크를 맞췄다.

플랫폼 상세 설계 보존, 절·단계 누락/중복, 차수·선행 관계, 로컬 링크·앵커, 표·코드 fence·공백을 확인했다. 제품 소스·공급 변경, 빌드·API audit·runtime·물리 입력·성능 검증은 수행하지 않았다. 분할 전 문서 검토와 work8 실행 기록은 각 본문의 과거 근거로 유지한다.

## 이번 재검토 반영

**2026-11-06 KST:** 여섯 계획 문서를 현재 CMake·API audit·host/runner·protocol 및 Microsoft·GTK·HTML 공식 계약과 대조했다. Linux 최소 GTK를 **4.22**로 올려 접근성 caret/selection 변경 의무와 맞췄다. W9-13 기술 완료와 W9-14 제품 수락·차수 전환을 구분하고, API 검사 환경/분모·동기 실행 모델의 판정, App SDK 앱 로컬 초기화/종료, 연속 입력/scene 진행·wire/lease 회귀, frame clock·Web profile/새 canvas/reload·후속 플랫폼 공급 조건을 보완했다. 필수 콘텐츠 W9-11-A는 기본 수명 W9-09-A 뒤 시작할 수 있도록 불필요한 재사용 최적화 선행 조건을 해제했다.

원래 주요 절·W9-00–14의 15단계와 Windows/Web → Android/Linux → iOS/macOS 순서를 유지한다. 제품 소스·공급 변경, 빌드·API audit·앱 실행·물리 입력·성능 검증은 이번 요청 범위에 포함하지 않았다. API **FAIL**, 기존 구현 **PARTIAL**, 후속 플랫폼 **DEFERRED**, 두 성능 flag **false**·물리/display **notVerified** 상태를 유지한다.

로컬 링크·앵커·표·code fence/공백, 주요 절 14개·단계 15개와 문서의 npm 명령 존재 여부를 검사하고 `git diff --check`를 통과했다. 상세 검사 범위와 수치는 3부 §14에 기록했다.

**다음 구현 시작점:** [W9-00의 현재 공급·Windows/Web 기준선·API 검사 입력 정상화](work9-3.md#123-단계별-범위와-완료-조건), 필요한 RNW 사례·출처 선정, 이어 [W9-06-A의 원래 consumer별 실행 모델 판정](work9-2.md#81-검사-환경과-실행-모델의-선행-판정).
