---
name: designing-relation-diagrams
description: Draws node-link diagrams in the Version B visual language for four named relation types - execution_flow, goal_means, whole_part and is_a - and validates and renders them with bundled scripts. Use when the user asks for a flowchart, pipeline, process, architecture, module structure, goal tree, taxonomy or concept hierarchy, or asks to visualize how steps, goals, parts or concepts relate (도식, 흐름도, 구조도, 파이프라인, 분류 체계).
---

# Designing relation diagrams

> **경고: 요청한 관계 유형이 이 skill에 없을 수 있다.**
> 이 skill은 네 가지 관계 유형만 규칙으로 정의한다. 그리기 전에 반드시 요청의 관계 유형부터 판정한다.

## 1. 관계 유형 판정

| 경우 | 판정 | 다음에 읽을 파일 |
|------|------|------------------|
| 1. 명시된 유형 | 요청이 아래 네 유형 중 하나 이상이다 | [common.md](common.md) + 해당 유형 파일 |
| 2. 명시되지 않은 유형 | 네 유형 어디에도 맞지 않거나, 유형 파일이 "대상이 아님"이라고 적은 경우다. 예: 데이터로 항목을 몇 개 그룹으로 나누는 분석(군집화 등)은 이 skill이 다루지 않는다. 분석을 끝낸 뒤 결과를 그릴 때 이 skill을 쓴다 | [common.md](common.md) §5 |
| 3. 애매하거나 판단할 수 없음 | 명시 여부 자체를 정할 수 없다 | [common.md](common.md) §5 |

| 유형 | 뜻 | 파일 |
|------|----|------|
| `execution_flow` | 실행 흐름 (사용자 interaction 포함) | [relation_types/execution_flow.md](relation_types/execution_flow.md) |
| `goal_means` | 수단 → 목적 | [relation_types/goal_means.md](relation_types/goal_means.md) |
| `whole_part` | X는 Y의 부분 (부분과 전체) | [relation_types/whole_part.md](relation_types/whole_part.md) |
| `is_a` | 상위 ↔ 하위 분류 | [relation_types/is_a.md](relation_types/is_a.md) |

- 한 도식에 여러 유형이 함께 있으면 해당 유형 파일을 모두 읽는다. 표현이 겹치면 [common.md](common.md) §1의 순위경쟁 규칙을 따른다.

## 2. 작업 순서

다음 체크리스트를 **최종 답(또는 notes)에 복사**하고, 단계마다 `[x]`(완료) 또는 `[ ]`와 그 이유를 적는다. 각 단계의 방법은 [common.md](common.md)에 있다.

> **완료 조건**: 체크리스트의 모든 단계가 `[x]`이거나, `[ ]`인 단계마다 이유와 보류 기록이 있을 때만 완료다. `RESULT pass`는 완료가 아니다. WARN이 남아 있으면 완료가 아니다.

```
- [ ] 1. 관계 유형 판정 (위 표)
- [ ] 2. 해당 유형 파일 READ. 요청에 부분 관계("A는 B와 C로 이루어진다")가 있으면 whole_part.md도 READ하고, 전체 A를 묶음으로 남긴다
- [ ] 3. IR(JSON) 작성                      → common.md §2
- [ ] 4. 규칙 검증: node scripts/check_ir.mjs diagram.json   → common.md §3
- [ ] 5. 렌더: node scripts/render_svg.mjs diagram.json out.svg   → common.md §3
- [ ] 6. 이미지 READ: 렌더 결과를 이미지로 직접 본다 (SVG를 못 보면 node scripts/to_png.mjs out.svg out.png --ir diagram.json)   → common.md §3
- [ ] 7. WARN VB-MAIN-COUNT가 있으면 정보량 조정: 접기 → --focus 측정 → 필요하면 Human에게 분할 질문   → common.md §4
- [ ] 8. IR을 고쳤다면 4~7을 마지막 IR로 다시 실행
- [ ] 9. 출력. 안내한 상호작용(hover, [+] 등)은 직접 시험한다
```

## 3. 파일

- [common.md](common.md): 모든 유형에 적용되는 Default 규칙과 절차
- [relation_types/](relation_types/): 유형별 모양·의미·위상
- [rules/design-system.md](rules/design-system.md): Default가 아닌 세부 규칙 전체(Mode, 애니메이션, 외부 도구 등). 위 파일에 없는 규칙이 필요할 때만 읽는다
- `scripts/`: `check_ir.mjs`(검증, `--focus`로 강조 효과 측정), `render_svg.mjs`(렌더, `--focus`로 정적 강조), `to_png.mjs`(PNG 변환). 세 스크립트는 실행 기록을 `.drd/log.jsonl`에 스스로 남기므로 따로 기록할 필요가 없다. Node.js 18 이상, 외부 패키지 없음
- [issue/](issue/): 예외 Case 대응. 스크립트 결과가 IR과 맞지 않으면 [issue/script_defects.md](issue/script_defects.md)를 읽는다
