# View 명명 변경 의존성 감사

작성자: chatgpt_gpt6 · 2026-10-15

## 실행 의존성

`view-names → drd finalize → receipt.outputs → verify / browser tests / Agent 지침`

`render.mjs → runtimeIr → DDS.render → HTML runtime`

`capture-core / capture-full → 공유 capture 모듈 → 실제 HTML UI → 상태 PNG / capture.json`

## 확인 및 수정

- typed CLI 테스트2곳이 diagram.html을 고정 참조해 ENOENT로 실패. receipt 경로로 수정. 새 Function/Full 명칭을 별도로 assert.
- 브라우저 검사3개도 output-path.mjs 공통 reader로 수정하여 구·신 receipt 모두 소비.
- Agent의 활성 CLI/문제대응 문서 및 capture-core 도움말을 현재 파일명/receipt 기준으로 수정. SPEC에 명명 계약 명시.
- 오래된 browser-workflow의 12초 완료 가정은 1.8초/구간 현재 동작에 맞지 않음. 입력의 비순환 edge수×1800ms+여유로 변경. 속도 UX 합격 판정이 아니라 유한 종료 검증.
- 타입 없는 legacy CLI 테스트와 demo/build_demo의 untyped fixture, 과거 산출물은 diagram.*가 맞으므로 유지.
- 공유 캡처 코드의 core 명칭 metadata는 기존 키이며 Full에서도 들어간다. 출력 파일명/타입과 별개이고 향후 metadata 명칭 정리 대상으로 남긴다. l1_partial 호환명 이관도 이번 범위 밖.

## 검증

최초 CLI67개 중65 PASS/2 파일명 참조 FAIL. 수정 후 관련8개 전부 PASS(나머지59개 이전 실행 통과). 실제 browser-workflow 14개 동작 검증 PASS, browser errors 없음. 이는 이미지 UX 전체 판정이 아니다.

## 배포 경계

루트 designing-relation-diagrams-v3.8-cli.skill은 작업 시작 전부터 변경된 파일이다. ZIP 엔트리를 읽어 확인했으며 새 capture-core/full 및 view-names 모듈이 없다. 따라서 현재 소스와 패키지는 동등하지 않고, 이 패키지로 최신 기능을 설치할 수 없다. 원래 변경을 덮어쓰지 않았고 최신 배포 패키지라고 주장하지 않는다. 새 패키지 생성/검증은 별도 릴리스 작업이다.

과거 실험 outputs는 소급 변경하지 않았다. 새로운 CLI 소비자는 고정 파일명이 아닌 receipt.outputs를 읽어야 한다. 이번 감사는 v3_8_cli 활성 소스·테스트·문서와 루트 패키지 중심이며 PC 전체의 외부 소비자를 모두 보장하지 않는다.
