# Main node 9개 초과 시 정보량 조정

**읽는 때**: `finalize`/`check`가 `VB-MAIN-COUNT`를 내며 exit 4(NEEDS_ADJUSTMENT)로 멈췄을 때.

- **기준**: Main으로 보이는 node는 기본 9개 이하다. `VB-MAIN-COUNT` 경고가 나오면 아래를 **순서대로** 시도한다. 배경 처리된 node는 세지 않는다.
- exit 4는 아래 둘 중 하나로만 풀린다: (a) `decisions.json`에 Human `info_amount` 결정(`topic:"info_amount"`, `subject:"Human"`, `status:"decided"`), (b) 효과가 `effective`/`not_needed`인 `--focus`. WARN을 "의도된 구성"으로 해석해 넘기지 않는다. 넘기고 싶으면 Human에게 묻는다(선택지에 보류 포함).

**1) 묶음과 접기.** 요청에 명시된 전체–부분을 접거나, 표현을 위한 묶음을 Agent가 먼저 정해 추상화한다(DEC-132·133·143).
- Agent가 정한 묶음은 요청 사실이나 Human 결정으로 바꾸어 기록하지 않는다. 묶음 기준·소속의 의미 정합을 점검하고, L0을 그려 Agent 결정·Human 검토 대기임을 REVIEW 글로 알린다([human-decisions.md](human-decisions.md)). 데이터 분석의 군집 개수를 먼저 묻는 절차와 구분한다.
- 접은 뒤 다시 `check`로 Main 수를 센다.
- **IR을 한 번이라도 고치면** `finalize`와 이미지 READ를 마지막 IR로 다시 한다. 마지막 IR로 만든 산출물만 낸다.

**2) 강조.** 접을 수 없으면 모든 node를 두고, 한 흐름과 그 흐름에 속한 Process의 **공동 입력**(다른 입력)을 Main으로 남긴 채 나머지를 배경으로 약화한다.
- 강조 효과는 반드시 `--focus`로 측정한다. **강조를 쓸지 말지는 `FOCUS` 판정 줄로만 정한다.** 측정하지 않고 강조를 쓰거나 버리지 않는다.
- 흐름이 여러 갈래면 흐름마다 하나씩, **여러 흐름의 공통 시작점이 아닌 흐름 안의 node**로 측정한다.

```
node scripts/drd.mjs check diagram.json --focus <강조할 node id>
```

- `FOCUS <id>: ineffective`(흐려지는 node가 없음) 또는 `still_over`(강조 후에도 Main 9개 초과)가 나오면 강조로는 해결되지 않는다 → 3)으로 간다.
- 요청이 **HTML이면 정적 출력이 아니다.** 강조가 유효하면 hover로 낸다. `finalize`가 만드는 `diagram.html`이 `scripts/dds.js`의 `DDS.attachHover`로 hover를 연결한다. HTML을 손으로 쓰거나 고치지 않는다.
- 정적 출력(이미지·인쇄·PDF처럼 hover·애니메이션·화면 전환을 쓸 수 없는 출력)은 강조할 흐름 후보 2~3개를 Human에게 제시해 하나를 고르게 하고, 그 흐름을 강조한 한 장으로 낸다(`finalize … --focus <node id>`). Human이 더 요청하면 흐름별 여러 장으로 낸다.

**3) 분할.** 앞 단계로 정보량을 조정할 수 없으면 여러 장으로 나누는 기준 후보 2~3개를 Human에게 제시해 고르게 한다(예: 내부/외부, 실시간/배치). 표현 묶음의 사후 검토와 여러 장 분할의 선택을 구분한다.
- 선택지에 "보류"를 넣는다. 위임 선택지는 [human-decisions.md](human-decisions.md)의 조건을 만족할 때만 추가한다.
- **Human이 고르기 전에는 최종 도식을 확정하지 않는다.** 기계적으로 나누지 않는다.
- Human이 답하면 `decisions.json`에 `topic:"info_amount"` 결정으로 기록한다([cli.md](cli.md)).
