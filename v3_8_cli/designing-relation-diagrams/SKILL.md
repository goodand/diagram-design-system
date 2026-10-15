---
name: designing-relation-diagrams
description: Draws node-link diagrams in the Version B visual language for four named relation types - execution_flow, goal_means, whole_part and is_a - and validates and renders them with bundled scripts. Use when the user asks for a flowchart, pipeline, process, architecture, module structure, goal tree, taxonomy or concept hierarchy, or asks to visualize how steps, goals, parts or concepts relate (도식, 흐름도, 구조도, 파이프라인, 분류 체계).
---

# Designing relation diagrams

현재 출력 파일명은 [View 산출물 명명 계약](references/view-artifacts.md)을 따른다. 과거 예시의 `diagram.*` 대신 해당 View 이름과 receipt의 경로를 사용한다.

> **경고: 요청한 관계 유형이 이 skill에 없을 수 있다.**
> 이 skill은 네 가지 관계 유형만 규칙으로 정의한다. 그리기 전에 반드시 요청의 관계 유형부터 판정한다.

Agent는 **IR(JSON)과 `decisions.json`만 쓴다.** SVG·HTML·PNG는 `node scripts/drd.mjs finalize` 또는 아래 `independent-core` 명령으로 만든다. 손으로 쓰거나 고치지 않는다.

### ToolUsingAgent 전용 Independent Core View

### Core Human_View의 선택적 상태 이미지

Human 피드백 또는 UX 평가가 필요할 때 `node scripts/capture-core.mjs --html <core.human.html> --out <새 디렉터리> [--width 1200 --height 900]`를 호출한다. 실제 HTML을 브라우저에서 열고 UI 버튼으로 접힘·펼침을 만든 viewport 이미지 `core.human.collapsed.png`, `core.human.expanded.png` 및 `capture.json`을 저장한다. JSON으로 별도 재렌더하지 않는다. 두 이미지를 직접 READ하고 수정 대상이 내용인지 표현인지 판단한다. 기본 finalize에서는 실행하지 않는다.

실행 환경에 Playwright와 Chromium이 필요하다. 설치된 Playwright 경로는 `DRD_PLAYWRIGHT_MODULE`, 브라우저 채널은 `DRD_CAPTURE_CHANNEL`로 지정할 수 있다. 캡처 실패는 INCOMPLETE로 기록되며 이미지 생성 성공도 UX 합격이나 IMAGE READ 완료가 아니다. 현재 Core 양끝 상태만 지원하며 Full/중첩 전체 상태 열거·애니메이션 검토는 포함하지 않는다. 외부 HTTP(S) 리소스를 차단하므로 self-contained DDS HTML을 사용한다.

### Independent Core 실행

Core JSON 작성·수정 후 `node scripts/drd.mjs independent-core <Core.json> --out <새 디렉터리>`를 실행하고 `core.agent.png`를 직접 IMAGE READ한다. 이는 Human UI를 펼친 캡처가 아니라 Core 원본을 직접 렌더한 독립 View다. SVG·PNG·원본 IR·출처 해시 receipt를 생성하며 HTML, 접기 버튼, Hover, 애니메이션은 없다. 관찰한 문제는 원본 JSON에서 수정하고 새 디렉터리에 재생성한다. 이미지 생성 성공은 검토 완료를 뜻하지 않는다. 이후 Human 검토·Full 취합 절차는 별도로 유지한다.

현재 입력은 `Process_Core`이며 명시적 `parent`/`expandAt`/linked hierarchy는 의미를 임의 제거하지 않도록 거부한다. Summary 참조에서 생성하던 UI 자동 접기는 독립 렌더에 적용하지 않는다. PNG 변환 실패는 명령 실패로 보고한다.

확정된 표현 규칙은 이 Skill의 유형별 파일·공통 표현 지침·전체 규칙에 둔다. Decision 원장과 변경 이력은 Web에서 관리하며, 괄호의 DEC·ARG 번호는 추적용 ID다. 도식을 그릴 때 원장 전체를 읽을 필요는 없다. 도식별 Human 응답을 담는 `decisions.json`은 원장과 다른 실행 입력이므로 계속 기록한다.

## 1. 관계 유형 판정

| 경우 | 판정 | 다음에 읽을 파일 |
|------|------|------------------|
| 1. 명시된 유형 | 요청이 아래 네 유형 중 하나 이상이다 | 해당 유형 파일 + [references/ir.md](references/ir.md) |
| 2. 명시되지 않은 유형 | 네 유형 어디에도 맞지 않거나, 유형 파일이 "대상이 아님"이라고 적은 경우다. 예: 데이터로 항목을 몇 개 그룹으로 나누는 분석(군집화 등)은 이 skill이 다루지 않는다. 분석 산출물은 분석·데이터 시각화이며, Human이 관계 도식을 요청한 경우에만 분석 결과를 이 skill로 그린다 | [references/human-decisions.md](references/human-decisions.md) |
| 3. 애매하거나 판단할 수 없음 | 명시 여부 자체를 정할 수 없다 | [references/human-decisions.md](references/human-decisions.md) |

| 유형 | 뜻 | 파일 |
|------|----|------|
| `execution_flow` | 실행 흐름 (사용자 interaction 포함) | [relation_types/execution_flow.md](relation_types/execution_flow.md) |
| `goal_means` | 수단 → 목적 | [relation_types/goal_means.md](relation_types/goal_means.md) |
| `whole_part` | X는 Y의 부분 (부분과 전체) | [relation_types/whole_part.md](relation_types/whole_part.md) |
| `is_a` | 상위 ↔ 하위 분류 | [relation_types/is_a.md](relation_types/is_a.md) |

- 한 도식에 여러 유형이 함께 있으면 해당 유형 파일을 모두 읽는다. 표현이 겹치면 [references/expression-rules.md](references/expression-rules.md)의 순위경쟁 규칙을 따른다.
- 요청에 부분 관계("A는 B와 C로 이루어진다")가 있으면 whole_part.md도 읽고, 전체 A를 묶음으로 남긴다.

## 2. 빠른 경로

새 파이프라인 도식은 **Function_Definition부터 시작**한다. 새 Workflow Unit의 실제 `diagram_type`은 `Function_Definition`, `Process_Summary_Linear`, `Process_Summary_Router`, `Process_Core`, `Process_Full` 중 하나다. 단계 건너뛰기와 상위 JSON 참조 불일치는 CLI가 거부해야 한다. 계약과 순서는 [workflow-units.md](references/workflow-units.md), JSON 형식은 [workflow-units.schema.json](references/workflow-units.schema.json)을 따른다. 기존 `l0_summary/l1_partial/l1_full` 형식은 이전 자료 호환을 위해 유지되며 새 Workflow Unit과 혼용하지 않는다.

1. 새 작업은 Workflow context/schema를 확인하고 Function_Definition JSON만 작성한다. 정확히 입력 Entity 1개 → Process 1개 → 출력 Entity 1개로 제한하며, 중간 Entity나 별도 edge 라벨을 넣지 않는다. 이 단계에서 도식을 Human에게 보여 피드백을 받는다.
2. Human 피드백에 따라 다음 단계로 진행하며, Function 파일의 상대 경로, ID, 버전, SHA-256과 대상 Process `node_id`를 참조해 Process_Summary를 만든다. 2–3개 Process만 허용한다. Linear는 단일 직렬 체인이고, Router는 분기 그래프이며 `routing`을 `exclusive` 또는 `parallel` 중 하나로 명시한다. Summary에는 E2E 입력·출력만 Entity로 두고 중간 데이터 Entity와 표시용 edge 라벨은 넣지 않는다. Summary도 Human에게 보여 피드백을 받는다.
3. Human 피드백을 받고 Summary의 각 Process `node_id`에 Process_Core를 하나씩 연결한다. Core가 Summary의 모든 Process를 덮도록 하며, 각 Core는 최대 9개 노드다. Full 취합 전에는 Core들을 각각 Human에게 보여 피드백을 받는다. Summary는 Process 2–3개여야 하며, Process 1개인 Summary는 CLI가 거부한다.
4. Process_Full은 동일한 Summary 파일 hash에 연결된 Core 2–3개를 Human에게 제안하고, 실제 Human의 명시적 취합 결정과 각 Core 승인 기록을 받은 뒤 생성한다. 모든 Summary Process에 Core가 정확히 하나씩 대응해야 한다. Full 승인과 취합 기록은 파일 hash에 묶는다. 실제 Human 응답을 추정·생성하지 않는다.
5. 새 Unit은 Core부터 접기 기능이 있으며 Core와 Full의 초기 화면은 접힌 상태다. Function과 Summary는 E2E Entity만 표현하고 접기 기능이 없다. Full에서 접힌 Core 사이의 전달 Entity는 남긴다. 예시 애니메이션이 아닌 Semantic Flow Token은 Full에서만 E2E 최초 입력 Hover로 시작하고 다른 Hover/이탈 시 종료한다. 새 Full의 `animation_states`에는 edge ID별 처리 상태·산출물 유형을 쓴다. 입력 문구를 복사하지 말고 `접수됨 → 의도 분류됨 → 초안 작성됨 → 전달 완료`처럼 변환을 표현하되 단순 전달은 상태를 유지한다. `flow`는 기존 전달 데이터 이름으로 보존한다. 기본 이동 시간은 구간당 1.8초다.

새 Unit의 모든 단계는 기존 renderer 구현을 재사용하되, 실제 `diagram_type`을 바꾸거나 `l0_summary/l1_partial/l1_full` 값으로 대체하지 않는다. 기존 표현·검토 규칙은 아래를 유지한다.

유형 판정(위 표) → 유형 파일과 [expression-rules.md](references/expression-rules.md) READ → [ir.md](references/ir.md) 및 Workflow Unit schema로 `diagram.json` 작성. 표현을 위한 묶음·추상화는 Agent가 먼저 정해 그리고 사후 검토를 받는다(DEC-132·133·143). 그리기 전에는 요청의 요소·관계와 IR의 뜻이 정합하는지 점검한다(DEC-137). 묶음 `source:"request"`는 요청에 실제로 명시된 묶음에만 쓴다. 색·Legend·점선 등 표현은 [expression-rules.md](references/expression-rules.md).

기존 `l0_summary` 자료를 계속 렌더링하는 절차는 [workflow.md](references/workflow.md)의 레거시 계약을 따른다.

   ```
   node scripts/drd.mjs finalize diagram.json --out out/L0 --level 0
   ```

3. exit 0이면 `out/L0/function.common.png`를 **이미지로 직접 READ**해 식별·대조를 판정하고, 이미지가 실제 내용과 같은 뜻인지 의미 정합 대조표로 평가하고([cli.md](references/cli.md) "exit 0 이후" 2), 렌더링을 Human에게 보여 피드백을 받는다. Human이 고치라고 하면 IR을 고쳐 L0부터 다시 그린다. 관계 유형마다 규칙이 다르다(유형 파일). PNG가 없으면 S7 UNKNOWN(이미지 READ 보류)으로 이유와 함께 보고한다.
4. 이전 작업의 `l0_summary/l1_partial/l1_full` 입력을 유지보수할 때만 [workflow.md](references/workflow.md)를 따른다. 레거시 파일의 렌더 계약은 새 Workflow Unit의 단계 진행·승인을 충족하지 않는다.
5. `STATUS REVIEW_PENDING`이면 Human 검토를 기다리는 Agent의 묶음 결정이 있다는 뜻이다. Human의 보류·미결정으로 기록하지 않는다(DEC-136). 그 묶음은 실선으로(점선은 원천이 미정이라고 표현한 경우만, DEC-141) 그리고, 검토 대기는 REVIEW 보고 글로 알린다 (DEC-133). 출력된 `REVIEW` 블록을 최종 보고에 그대로 넣어 Human 검토를 받는다. Human 답에 따라 `source:"human"` + `decision_ref`를 넣거나 묶음을 지우고 다시 그린다.
6. IR을 고쳤다면 마지막 IR로 `finalize`부터 다시 돌린다.

## 3. non-zero 종료: 영수증 기반 수리

`REJECT <S-code> <rule-code>: <이유> -> <고칠 방법>` 줄만 근거로 IR/`decisions.json`을 고치고 같은 명령을 다시 돌린다. 요청한 의미는 바꾸지 않는다. 상세는 [references/cli.md](references/cli.md).

| exit | STATUS | 할 일 |
|---|---|---|
| 1 | `INCONSISTENT` | REJECT의 fix대로 IR 수정 |
| 2 | `BAD_INPUT` | 입력(JSON, 끊긴 edge, 모르는 id, decisions.json) 수정 |
| 4 | `NEEDS_ADJUSTMENT` | 정보량 조정: 접기 → `--focus` 측정 → Human에게 질문, 답은 `info_amount` 결정으로 기록 → [information-amount.md](references/information-amount.md) |

- **수리 한도**: 같은 REJECT 코드가 집중 수리 두 번 뒤에도 남으면 멈추고, 어떤 규칙이 왜 안 풀리는지 구체적 간극을 보고한다.
- 스크립트가 오류로 멈추거나 결과가 IR과 맞지 않으면 [issue/script_defects.md](issue/script_defects.md). `scripts/`는 고치지 않는다.
- Human 답이나 명시 요청 없이 `source`를 `human`/`request`로 쓰지 않는다.

## 4. 파일

- [references/](references/): `workflow-units.md`와 `workflow-units.schema.json`(새 Unit 순서·참조·구조), `workflow.md`와 `workflow.schema.json`(레거시 typed 입력), `expression-rules.md`, `ir.md`, `information-amount.md`, `human-decisions.md`, `cli.md`. 위 트리거에 해당할 때만 읽는다
- [relation_types/](relation_types/): 유형별 모양·의미·위상
- [rules/design-system.md](rules/design-system.md): Default가 아닌 세부 규칙 전체. 위 파일에 없는 규칙이 필요할 때만 읽는다
- `scripts/drd.mjs`: `context`·`schema`·`workflow`·`finalize`·`verify`·`check` (Node.js 18+, 외부 패키지 없음). finalize는 `out/receipt.json`에 입력·산출물 해시와 Workflow 상태를 남긴다

## 5. Output

보고에는 `out/` 절대 경로, 마지막 `STATUS`와 `verify` 결과, 이미지 READ 여부(했으면 판정, 못 했으면 S7 UNKNOWN과 이유), 의미 정합 대조표, Human 결정·보류 기록(결정 주체 포함), 남은 WARN을 적는다. 출력 끝줄은 `SELF-CHECK ONLY — NOT DONE`이다. exit 0은 자기 일관성만 뜻하므로, 확인하지 않은 완료·시각 품질을 주장하지 않는다. non-zero 종료를 성공으로 보고하지 않는다. 안내한 상호작용(hover, [+])은 직접 시험한 것만 시험했다고 적는다.
