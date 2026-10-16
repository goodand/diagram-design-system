# DDS 목적별 평가 증거 대조 — 2026-10-16

## 결론과 판정 범위

전체 ALL PASS는 아니다. 아래 PASS는 명시한 사례·상태·판정 대상에 한정한다. 기존 Human PASS, 이번 Agent IMAGE READ, 과거 Agent 관찰 기록, Tool System 자동 검사를 구분한다. 미검증은 실패나 Human 재검수 요청을 뜻하지 않는다.

Ultimate Goal: **Human의 이해를 돕기 위해 Agent가 Human이 이해하기 적합한 Diagram으로 표현한다.**

G1(적합한 의미의 일관된 표현)과 G2(Human이 이해하기 적합한 UX)는 교집합이 있다. 아래 분류는 대조를 위한 작업 분류이며 새롭게 승인된 목적 계층이 아니다. Workflow·판정 기록은 이를 지원하는 목적이다. 구현 수단을 달성 목적과 혼동하지 않는다.

## 경로와 평가 주체

아래 `O/`는 `C:/Users/INTEC/Documents/Codex/2026-10-07/path-cwd-window-pc-github-repo/outputs/`, `R/`는 같은 workspace의 `work/diagram-implementation/`이다. 경로 패턴은 평가 대상 선택자이며 그 패턴의 모든 파일을 READ했다는 뜻이 아니다.

평가자는 Tool Developer Agent이며 Human 원문은 별도 판정 근거다. 이용 주체는 Human 또는 Tool Using Agent다. 두 주체의 역할을 혼합하지 않는다. 정적 이미지로 동작이나 시간 가독성을 PASS 처리하지 않는다.

| ID / 상위 목적·평가 대상 | 이용 주체 / Workflow 단계 / View | sweet case path | 평가 파일·근거 | PASS 조건 / 현재 판정 / test action |
|---|---|---|---|---|
| G1-01 Node·Edge / Data·Process의 의미 구별 | Human·Tool Using Agent / 초안 검토 / Common 정적 도식 | O/dds-semantic-review-20261016/role-flow/A.svg | 같은 폴더 preview.png, A.ir.json, human-response.raw.json | 원문→추출→목록 순서와 데이터·처리 구별. **기존 사례 PASS**: 이번 IMAGE READ에서 양쪽 원형 데이터와 사각 처리, 화살표 순서 확인. 최신 CLI의 모든 View PASS는 아님. |
| G1-02 Character / text·number·unit | Human·Tool Using Agent / 의미 검토 / Common 정적 도식 | O/dds-semantic-review-20261016/number-state/A.svg | 같은 폴더 preview.png, human-response.raw.json | 12건에서 9건·3건 결과와 단위 보존. **기존 사례 PASS**: 이번 IMAGE READ와 저장된 Human 양쪽 PASS. 가로·세로 우위 판단으로 확대하지 않는다. |
| G1-03 분기·합류 관계 | Human·Tool Using Agent / 구조 검토 / 정적 도식 | O/dds-semantic-review-20261016/parallel-join/A.svg | 같은 폴더 preview.png, cases.json은 상위 폴더 | 두 검토가 직렬이 아니며 두 결과 통합으로 연결. **기존 사례 PASS**: 이번 IMAGE READ에서 양 분기와 합류 확인. 시간적 동시 실행 보장까지 이미지로 증명하지 않는다. |
| G1-04 Whole/Part 대응·공유 경계 | Human / Full 취합 검토 / Full Human | O/dds-product-layout-20261015/cli-workflow-trial/fold-state-revision/hover-trial/shared-boundary/out/full/full.human.html | O/dds-boundary-product-check-20261016/three-core/captures/full.human.state-*.png, capture.json, ../RESULT.md | 같은 경계는 한 번, 상세는 담당 Process에 대응, 연결·방향 보존. **3-Core 8상태 PASS**: 기존 Main IMAGE READ 기록과 경계 검사. 2-Core 36상태 전체의 시각 PASS는 미검증. |
| G1-05 Animation / state 의미 | Human / Full 실행흐름 검토 / Full Human | O/dds-animation-review-20261016/full-animation.gif | 같은 폴더 human-response.json; 현재 후보의 상태 문구·시간 관찰 기록 필요 | 상태가 단계 의미에 대응. **기존 sweet case PASS / 현재 후보 전체 미검증**. 기존 GIF의 승인을 변경된 모든 애니메이션에 이전하지 않는다. |
| G2-01 텍스트 가독성·잘림 | Tool Using Agent / Core 내부 설계 검토 / Independent Core | O/dds-human-ab-review-20261015/long-label-human-response.json (판정 원문, 참조 이미지 경로 포함) | O/dds-boundary-product-check-20261016/long-label-branch/viewport-1203.png, viewport-700.png, RESULT.md | 글자·관계가 읽히고 마지막 글자까지 온전함. **기록된 2화면 PASS**: 기존 Main 관찰. 모든 View·최대 길이 조합에는 확대하지 않는다. |
| G2-02 전체 조망·세부 접근 | Human / Full 읽기 / Full Human | O/dds-product-layout-20261015/full-size-review/v2/full-expanded.svg | R/docs/verification/dds-final-browser-20261016.log; O/dds-boundary-product-check-20261016/three-core/RESULT.md | 전체 조망과 확대·100% 스크롤로 세부 접근 가능. **동작 PASS**, 3-Core 전체 맞춤의 세부 글씨는 작다는 관찰을 유지. 전체 맞춤에서 즉시 세부 읽기까지 PASS 아님. |
| G2-03 연결 대상·방향의 명료성 | Human·Tool Using Agent / 각 단계 이미지 검토 / 5 View | O/dds-human-ab-review-20261015/rectangle-port-decision.json (결정 및 참조) | O/dds-boundary-product-check-20261016/topology/; O/dds-boundary-product-check-20261016/three-core/RESULT.md | 노드·선·화살촉을 구별하고 분기·반복을 추적. **부분 PASS / 고정 39상태×적용 항목 전체는 미검증**. 9조합 구조 검사나 이미지 동일 해시는 직접 시각 판정을 대체하지 않는다. |
| G2-04 Hover·Dimming / Whole·Part | Human / Full 탐색 / Full Human | O/dds-context-review-20261016/index.html (기능 PASS 한정; 중복 경계는 후속 issue) | O/dds-boundary-product-check-20261016/interactions.json; R/v3_8_cli/designing-relation-diagrams/test/interaction-policy.browser.mjs | 고유 부분·공유 합집합의 범위 및 이탈 초기화. **검사한 범위 동작 PASS / 부분 펼침·모든 edge의 실제 hit test·시각 명료성 전수는 미검증**. dispatch 검사는 실제 포인터 적중으로 기록하지 않는다. |
| G2-05 접기 전환 중 맥락 | Human / Core·Full 탐색 / Human | O/dds-view-names-20261015/core/core.human.html; 위 context-review의 기능 판정 | O/dds-boundary-product-check-20261016/core-hover-after/{collapsed,expanded}.png; three-core/captures/ | 상태별 원래 Process와 상세 대응. **기존 Core와 3-Core 상태 이미지의 대응 PASS / 현재 모든 전환 중 맥락 유지 미검증**. 정지 이미지 8장은 시간 관찰 8회가 아니다. |
| G2-06 애니메이션 읽기 속도 | Human / Full Hover 재생 / Full Human | O/dds-animation-review-20261016/full-animation.gif | 같은 폴더 human-response.json; interactions.json은 시작·중단 보조 검사 | 문구 읽을 시간과 변화 추적. **기존 1.8초 사례 PASS / 현재 후보 시간 관찰 미검증**. 1.6초는 허용 의견이고 직접 검수 PASS 아님. |
| W-01 점진적 설계·검토 | Tool Using Agent·Human / Function→Summary→Core→Full / 단계별 View·IR·receipt | 시각 sweet case 해당 없음 | O/dds-product-layout-20261015/RULE-BASED-COMPLETION-AUDIT.md; R/docs/verification/dds-final-tests-20261016.log | 참조·해시·승인·필수 산출물·종료 단계 계약. **기록된 규칙 검사 PASS**. 모의 승인과 실제 Human 승인 분리. 실제 Agent의 모든 사용 Workflow는 보증하지 않는다. |
| W-02 검토·판정의 충실한 보존 | Human·Tool Developer Agent / 검수 저장·복구 / 검수화면·응답 원문 | 도식 View sweet case 해당 없음 (메타 Workflow) | O/dds-product-layout-20261015/RULE-BASED-COMPLETION-AUDIT.md, rule-checklist-evidence.json | 원문·후속 조건·대상 버전·판정 보존. **격리 검수 구현의 RV-01~08 PASS**. 현재 배포 패키지 기능으로 통합됐다는 근거와 구분. |

## 해당 없음과 미검증 구분

- Function/Summary Common 및 Independent Core의 접기·Hover·애니메이션: **해당 없음**.
- Core Human의 Hover·Dimming·기본 애니메이션: **해당 없음**. 비활성 상태를 유지하는 구현 검사는 별도로 PASS.
- 지원 깊이 내의 미검토 상태: **미검증**. 깊이 확장은 현재 변경 범위 밖의 보류 사항이며 구현 PASS가 아니다.
- Ultimate Goal 자체의 Human 이해 달성: **전체 판정 미검증**. `DDS-UNDERSTANDING-ASSESSMENT-RECOVERY-001`에 과거 판단 방법 복구가 미해결로 남아 있다. 필요성을 DDS가 임의 판단하거나 Agent의 관찰을 Human 이해로 치환하지 않는다.

## 기존 기준·기록의 불일치

1. UX-CHECKLIST §6 및 UX-R08의 ‘전체 맞춤에서도 읽힘’은 후속 Human의 ‘확대하면 PASS’, ‘100% SVG+스크롤 PASS’ 조건과 함께 해석해야 한다. 기존 원문은 수정하지 않았으며, 이 대조에서는 전체 조망과 세부 읽기를 구분한다.
2. semantic-review/cases.json은 `awaiting-human`, preview에는 미판정 문구가 남아 있지만 Human 응답 원문은 존재한다. 생성 당시 화면 상태와 후속 판정을 구분한다. 화면 문구만으로 미응답 처리하지 않는다.
3. 기존 goal-audit 문서는 과거 검사와 후속 보완이 누적되어 있다. 최종 패키지 상태는 current-delivery 문서와 final 로그를 기준으로 한다.
4. UX 체크리스트의 수단(포트·구간 길이 등)은 목적 달성의 충분조건이 아니다. 수단을 만족해도 관계가 모호하면 시각 PASS가 아니다.

## 후속 실행 순서

2026-10-16 Human 후속 명확화: “'실제 시간 흐름에서 문구를 읽고 단계별 상태 변화를 따라갈 수 있는지 관찰' 이것도 pass로 해, 읽을 수 있으니깐 1.8초대 pass라고 한거지”. 이에 따라 G2-06의 시간 가독성 미검증 표기는 **검수한 1.8초대 사례에 대해 Human PASS로 해소**한다. 아래 2번의 문구 읽기 재검수는 필요 없다. 임의의 새 문구·속도까지 일반화하지 않는다. 의미의 적합성 결정과 Human 이해 달성은 개발 단계의 판정 대상에서 제외한다.

1. 고정 39상태의 항목별 관찰 공백을 채운다. 동일 렌더·입력·viewport가 입증된 기존 이미지 판정은 재사용하며 중복 검수를 요구하지 않는다.
2. 현재 후보의 부분 펼침 Hover 및 시간에 따른 상태 전환·문구 읽기를 직접 관찰한다. 범위·이탈 자동 검사는 함께 활용한다.
3. 변경 후보의 결함이 관찰되면 기존 sweet case와 동일 조건으로 비교한다. 실제 가치 판단이 애매할 때만 검수 화면에 올린다.

이번 작업은 증거 대조이며 제품 코드 수정, 새로운 Human 승인, 전체 UX ALL PASS, commit/push를 수행하지 않았다.
