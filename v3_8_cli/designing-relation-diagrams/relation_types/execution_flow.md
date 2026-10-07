# execution_flow — 실행 흐름

가장 많이 쓰는 유형이다. 순서가 있는 처리 단계와, 그 앞뒤의 입력·출력을 그린다. 사용자 interaction도 포함될 수 있다.

## 모양과 의미

| 요소 | 모양 | 비고 |
|------|------|------|
| Process (Task, Action 등 하는 일) | rect | 이름은 주로 Task |
| Entity (Process의 입력·출력인 데이터·상태·대상) | stadium | Process 앞뒤에 둔다 |
| 흐름 | 화살촉 있는 edge | |

- Process와 Entity는 모양(rect/stadium)으로만 가른다. 색·채움으로 가르지 않는다.
- Entity 없이 Process만 이어도 execution_flow다.
- Task가 **하는 일의 종류**(예: 생성·검증·결정)를 나눠야 하면 모양은 그대로 두고 색으로 가르며, 그 뜻을 Legend에 적는다. 색은 필요할 때만 쓴다.

## 확실성

- 적용한다. 확정 = 실선, 원천이 미정으로 표현한 관계 = 점선(`"certainty": "dashed"`), 정도 = 간격 숫자(넓을수록 불확실). Human 미검토나 Agent 자신의 불확실을 뜻하지 않는다(DEC-141).
- 실행 여부가 조건부인 edge(예: "불일치 시")는 불확실이 아니므로 실선에 `label`을 단다.

## 위상

- DAG이며 cycle을 허용한다. 되먹임 edge에는 `"loop": true`를 준다.

## 자주 쓰는 배치

- 여러 입력이 한 Process로 모이면(fan-in) `"route": "hvh"`와 `busX`를 쓴다.
- 흐름 안에 묶음이 있으면 [whole_part.md](whole_part.md)를 함께 읽는다.
