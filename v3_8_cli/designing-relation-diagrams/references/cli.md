# CLI: drd.mjs

**읽는 때**: `finalize`가 non-zero로 끝났을 때, `decisions.json`을 써야 할 때, `verify`를 돌릴 때. 아래에 번들 사용에 필요한 명령·종료 코드·결정 기록 형식을 둔다.

```
node scripts/drd.mjs finalize <ir.json> --out <dir> [--decisions f] [--level N] [--expand a,b] [--collapse a,b] [--focus id]
node scripts/drd.mjs verify <dir> [--ir <ir.json>]
node scripts/drd.mjs check <ir.json> [옵션 동일]   # 진단만, 아무것도 쓰지 않음
```

- `--level N`: 추상화 단계 L0–L2(Z0–Z2와 같은 뜻). `--expand`/`--collapse`: 특정 전체 node만 펼치거나 접는다. 그룹을 하나씩 펼치는 화면을 만들 때 쓴다.
- `--decisions` 기본값은 IR 옆 `decisions.json`(없으면 결정 없음).
- 실행 기록은 스크립트가 남긴다. 따로 기록하지 않는다. Node.js 18 이상.

## 종료 코드 (첫 실패에서 멈춘다)

| exit | STATUS | 뜻 | 할 일 |
|---|---|---|---|
| 0 | `CONSISTENT` | 산출물 기록됨(자기 일관성만 확인) | 이미지 READ, 아래 "exit 0 이후" |
| 0 | `REVIEW_PENDING` | 산출물 기록됨, Human이 정하지 않은 묶음은 실선으로(점선은 원천이 미정이라고 표현한 경우만, DEC-141) 그리고, 검토 대기는 REVIEW 보고 글로 알린다 (DEC-133) | `REVIEW` 블록을 최종 보고에 넣음 → [human-decisions.md](human-decisions.md) |
| 1 | `INCONSISTENT` | VB-* 규칙 위반(S2) | `REJECT` 줄의 fix대로 IR 수정 |
| 2 | `BAD_INPUT` | JSON 오류, 끊긴 edge, 모르는 id, 잘못된 decisions.json | 입력 수정 |
| 4 | `NEEDS_ADJUSTMENT` | `VB-MAIN-COUNT`, Human 결정도 유효한 `--focus`도 없음(S3) | [information-amount.md](information-amount.md) |

non-zero 종료는 어느 것도 성공이 아니다. 실패하면 `--out`의 이전 `diagram.svg/html/png`, `ir.json`, `receipt.json`이 **삭제**되고 새로 쓰지 않는다. 남은 산출물을 낸 적이 없다고 간주한다.

`REJECT <S-code> <rule-code>: <이유> -> <고칠 방법>` 한 줄이 경계마다 나온다. 그 줄만 근거로 고친다.

## 수리 루프

1. 첫 `REJECT` 줄을 읽고 해당 IR(또는 decisions.json)만 고친다. 요청한 의미는 바꾸지 않는다.
2. 같은 명령을 다시 돌린다. IR을 고칠 때마다 마지막 IR로 다시 돌린다.
3. **같은 REJECT 코드가 집중 수리 두 번 뒤에도 남으면 멈추고** 어떤 규칙이 왜 안 풀리는지(구체적 간극)를 보고한다. 스크립트 결과가 IR과 맞지 않거나 스크립트가 오류로 멈추면 [../issue/script_defects.md](../issue/script_defects.md).

## decisions.json 형식

```json
{ "decisions": [
  { "id": "D-grp-1", "subject": "Human", "status": "decided", "topic": "group_source",
    "question": "REVIEW grp — A(이대로 묶음) / B(묶지 않음) / 보류", "answer": "A", "answered_at": "2026-01-01T00:00:00Z" },
  { "id": "D-info-1", "subject": "Human", "status": "decided", "topic": "info_amount",
    "answer": "내부/외부로 분할", "answered_at": "2026-01-01T00:00:00Z" }
] }
```

- 묶음 결정: 유효한 `decision_ref` = `subject:"Human"`, `status:"decided"`, 비어 있지 않은 `answer`, `answered_at`을 가진 항목의 `id`. 그 묶음 node에 `"source":"human","decision_ref":"<id>"`.
- 정보량 결정: `topic:"info_amount"`, `subject:"Human"`, `status:"decided"`. 또는 `--focus`의 판정이 `effective`/`not_needed`.
- 기록은 결정 주체를 적는다([human-decisions.md](human-decisions.md)). Human이 답하지 않았으면 쓰지 않는다.

## exit 0 이후

1. **이미지 READ(건너뛸 수 없음)**: `<out>/diagram.png`를 이미지로 **직접** 본다. 상하좌우가 잘리거나 여백 없이 가장자리에 붙거나, 선이 node를 관통하거나, 모양이 뜻과 다르면 IR로 돌아가 `finalize`를 다시 돌린다. 식별·대조가 지켜지는지 판정한다. 파일을 만들었다는 사실이나 SVG 코드를 읽은 것은 이미지 READ가 아니다.
2. **의미 정합(건너뛸 수 없음, DEC-137~140)**: Human이 이 내용을 이해하지 못한 상태라고 가정하고, 렌더된 이미지가 실제 내용(요청·코드·자연어 등 원천)과 **같은 뜻**인지 평가한다. 원천의 요소·관계마다 한 줄씩 대조표를 최종 보고에 넣는다:

   | 원천의 뜻 (요소·관계) | 이미지에서 | 같은가 | 참고: 경로 (없을 수 있음) |
   |---|---|---|---|

   판정 칸은 "뜻이 같은가" 하나다. 경로(파일·줄·인용 위치)는 바뀌거나 없을 수 있으므로 판정 근거로 쓰지 않는다. 다르면 IR을 고쳐 `finalize`를 다시 돌린다.
3. PNG가 없으면(`receipt.outputs.png: null`, `png_attempts`에 시도 기록) 이미지 READ를 **보류(S7 UNKNOWN)**로 notes와 최종 답에 적는다: 무엇을 시도했고 왜 실패했는지. 말없이 건너뛰지 않는다.
4. `node scripts/drd.mjs verify <out>`: S6(산출물 sha), S8(html에 svg 그대로 포함), S1(원본 IR 불변), S7(png). exit 1이면 `finalize`를 다시 돌린다. S1 INCONSISTENT는 IR을 finalize 뒤에 고쳤다는 뜻이다.
5. 출력 끝줄 `SELF-CHECK ONLY — NOT DONE…`: exit 0과 `CONSISTENT`는 **자기 일관성만** 뜻한다. 완료·시각 품질은 판정 외부 몫이다. `WARN`이 남아 있어도 완료가 아니다.
6. 안내한 상호작용(hover, [+] 등)은 `diagram.html`에서 직접 시험한 것만 시험했다고 적는다.
