---
name: designing-relation-diagrams
description: Draws node-link diagrams in the Version B visual language for four named relation types - execution_flow, goal_means, whole_part and is_a - and validates and renders them with bundled scripts. Use when the user asks for a flowchart, pipeline, process, architecture, module structure, goal tree, taxonomy or concept hierarchy, or asks to visualize how steps, goals, parts or concepts relate (도식, 흐름도, 구조도, 파이프라인, 분류 체계).
---

# Designing relation diagrams

> **경고: 요청한 관계 유형이 이 skill에 없을 수 있다.**
> 이 skill은 네 가지 관계 유형만 규칙으로 정의한다. 그리기 전에 반드시 요청의 관계 유형부터 판정한다.

Agent는 **IR(JSON)과 `decisions.json`만 쓴다.** SVG·HTML·PNG는 `node scripts/drd.mjs finalize`만 만든다. 손으로 쓰거나 고치지 않는다.

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

1. 유형 판정(위 표) → 유형 파일 READ → [ir.md](references/ir.md)로 `diagram.json` 작성. 표현을 위한 묶음·추상화는 Agent가 먼저 정해 그리고 사후 검토를 받는다(DEC-132·133·143). 그리기 전에는 요청의 요소·관계와 IR의 뜻이 정합하는지 점검한다(DEC-137). 묶음 `source:"request"`는 요청에 실제로 명시된 묶음에만 쓴다. 색·Legend·점선 등 표현은 [expression-rules.md](references/expression-rules.md).
2. **L0을 먼저 그린다.** 가장 추상 단계다. 이 명령의 non-zero 종료는 어느 것도 성공이 아니다.

   ```
   node scripts/drd.mjs finalize diagram.json --out out/L0 --level 0
   ```

3. exit 0이면 `out/L0/diagram.png`를 **이미지로 직접 READ**해 식별·대조를 판정하고, 이미지가 실제 내용과 같은 뜻인지 의미 정합 대조표로 평가하고([cli.md](references/cli.md) "exit 0 이후" 2), 렌더링을 Human에게 보여 피드백을 받는다. Human이 고치라고 하면 IR을 고쳐 L0부터 다시 그린다. 관계 유형마다 규칙이 다르다(유형 파일). PNG가 없으면 S7 UNKNOWN(이미지 READ 보류)으로 이유와 함께 보고한다.
4. L0 피드백을 반영한 뒤 L1(필요하면 L2)을 같은 IR에서 그린다: `finalize diagram.json --out out/L1 --level 1`. 한 IR에서 단계만 바꾼다(design-system.md §7). 각 단계마다 `node scripts/drd.mjs verify <out>`.
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

- [references/](references/): `expression-rules.md`(순위경쟁·공통 표현), `ir.md`(IR 필드), `information-amount.md`(Main 9개 초과), `human-decisions.md`(경우 2·3, 보류, 결정 기록), `cli.md`(종료 코드, 수리 루프, decisions.json, verify). 위 트리거에 해당할 때만 읽는다
- [relation_types/](relation_types/): 유형별 모양·의미·위상
- [rules/design-system.md](rules/design-system.md): Default가 아닌 세부 규칙 전체. 위 파일에 없는 규칙이 필요할 때만 읽는다
- `scripts/drd.mjs`: `finalize`·`verify`·`check` (Node.js 18+, 외부 패키지 없음). finalize는 `out/receipt.json`에 입력·산출물 해시를 남긴다

## 5. Output

보고에는 `out/` 절대 경로, 마지막 `STATUS`와 `verify` 결과, 이미지 READ 여부(했으면 판정, 못 했으면 S7 UNKNOWN과 이유), 의미 정합 대조표, Human 결정·보류 기록(결정 주체 포함), 남은 WARN을 적는다. 출력 끝줄은 `SELF-CHECK ONLY — NOT DONE`이다. exit 0은 자기 일관성만 뜻하므로, 확인하지 않은 완료·시각 품질을 주장하지 않는다. non-zero 종료를 성공으로 보고하지 않는다. 안내한 상호작용(hover, [+])은 직접 시험한 것만 시험했다고 적는다.
