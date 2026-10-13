# Diagram Design System

현재 PC의 DDS 자료를 다른 PC의 원격 저장소와 비교·계속 작업하기 위한 **2026-10-07 부분 스냅샷**입니다. 이 작업 트리는 `v3.8-cli` 기반을 보존하면서 Summary의 Process 2–3개 계약과 상태 토큰을 적용한 `v3.92-cli`입니다. 원격 저장소의 최신 버전이나 배포 확정본을 뜻하지 않으며, 최종 버전은 다른 PC 자료와 비교한 뒤 Human이 결정합니다.

## 현재 상태

- **v3.92-cli:** Semantic Flow Token에 `animation_states`를 추가하고 구간당 이동을 1.8초로 늦췄습니다. 새 사용자는 `designing-relation-diagrams-v3.92-cli.skill`을 사용하세요. [최종 검증](docs/verification/v3.92-token-20261013.md), [전체 Workflow E2E](docs/verification/v3.91-e2e-20261013.md).

- **로컬 후보 (v3.91-cli):** Function은 Process 1개, Summary는 명시한 Linear/Router 타입에서 Process 2–3개로 구분합니다. 기존 v3.9 패키지는 보존합니다. [수정·검증 기록](docs/verification/v3.91-summary-20261013.md).

- **로컬 MVP 보완 (2026-10-13):** L0의 `node_id`를 참조하는 L1 자동 접기·펼치기를 구현하고 실제 도식으로 검증했습니다. L0 자체는 정적이며, 원본 내용은 유지합니다. [수정·검증 기록](docs/verification/auto-fold-20261013.md)을 참고하세요.

- **로컬 후보 (v3.9-cli):** `Function_Definition → Process_Summary_Linear/Router → Process_Core → Process_Full`의 타입·상위 참조·취합 검증을 구현했습니다. 101개 테스트와 격리된 Codex subagent 순차 사용 실험을 완료했습니다. [구현·실험 근거](docs/verification/v3.9-workflow-20261013.md)를 참고하세요. `v3_8_cli/` 경로는 호환을 위해 유지하며 새 패키지는 `designing-relation-diagrams-v3.9-cli.skill`입니다. 단계별 계약은 [workflow-units.md](v3_8_cli/designing-relation-diagrams/references/workflow-units.md)를 따릅니다.

- **이전 로컬 구현 (2026-10-12):** 기존 `v3.8-cli` 기반의 `l0_summary/l1_partial/l1_full`, 승인된 부분 취합 검사, Hover 및 Semantic Flow Token 구현입니다. 이는 새 네 Workflow Unit의 강제·연동 검증을 대신하지 않습니다. [기존 구현·검증 기록](docs/verification/workflow-types-20261012.md)을 참고하세요.

- **자동 접기 MVP (2026-10-13):** 기존 세 타입의 L1이 L0 `node_id`에 연결되는 자동 접기·펼치기 구현입니다. 새 Workflow Unit 후보에서도 Core/Full의 접기 동작에 재사용할 수 있지만, 단계 계약의 증거와는 구분합니다. [수정·검증 기록](docs/verification/auto-fold-20261013.md)을 참고하세요.

- 2026-10-07에 기록한 Skill 문서·표현 Decision 대조 결과는 해당 스냅샷 상태에 관한 과거 기록입니다. v3.9-cli 후보의 소스·패키지 해시는 [새 manifest](docs/verification/workflow-package-manifest-v3.9-20261013.json)에 기록합니다.
- J8의 `review_notice` 슬롯 지시문 수리 완료. F7·F8·F19를 Codex 독립 슬롯 채움으로 3회 확인하여 9/9 기대 판정 일치, 48쌍 불일치 0입니다.
- `eval/judge_fixtures/**/judge.json`은 기존 저장 결과이며 이번 수리 후 재실행 결과가 아닙니다. 이번 부분 검증 결과는 `docs/verification/j8-focused-repeat-results.json`을 기준으로 읽습니다.
- 이 확인은 정적 SVG 기반 J8 부분 검증입니다. 전체 판정기 자기 시험이나 기존 Haiku 결과의 재현을 뜻하지 않습니다.
- Human 지시에 따라 `JUDGE_SEQ=1` 전체 자기 시험과 36건 본 실험 판정을 진행하지 않습니다.
- 평가 실행기·판정기의 기본 LLM 연결은 여전히 Claude CLI입니다. Codex 부분 검증이 전체 실행기의 Codex 전환을 뜻하지 않습니다.

## 포함 내용

| 경로 | 용도 |
|---|---|
| `v3_8_cli/designing-relation-diagrams/` | v3.8-compatible path에 있는 현재 Skill, CLI, 기존 단위 테스트 및 로컬 후보 변경 |
| `designing-relation-diagrams-v3.8-cli.skill` | 이전 버전 패키지 |
| `designing-relation-diagrams-v3.92-cli.skill` | 현재 상태 토큰·속도 개선 패키지 |
| `designing-relation-diagrams-v3.91-cli.skill` | Summary 2–3 Process 계약의 로컬 후보 패키지 |
| `designing-relation-diagrams-v3.9-cli.skill` | 새 Workflow Unit 검토용 로컬 후보 패키지 |
| `v3_8_cli/_baseline_v37/` | 단위 테스트·비교 실험에 필요한 기준본 |
| `v3_8_cli/SPEC_cli.md` | CLI 계약 |
| `v3_8_cli/eval/` | J8 수리 코드, 고정 시험자료, 평가 명세와 사전등록 자료 |
| `digram_design.md`, `formal/`, `diagrams/`, 데모 HTML | 기존 설계 자료 |
| `docs/verification/` | 이번 J8·Skill 변경의 검증 기록과 패치 |
| `docs/source-manifest.json` | 복사한 원본 파일의 SHA-256 |

Decision 원장·JSON·생성 도구는 Human 지시에 따라 **Web 관리 대상으로 GitHub 업로드에서 제외**합니다. 확정된 표현 규칙은 Skill 안에 반영하며 Decision ID로 출처를 추적합니다. 도식별 실행 입력인 `decisions.json` 및 테스트 fixture는 원장과 별개로 유지합니다. 실험 실행 기록, 과거 패키지·백업·전달 묶음은 **추가 업로드 범위 결정 대기**입니다. 이 스냅샷은 전체 작업 폴더 백업이 아니며, 해당 자료로 향하는 역사적 참조는 아직 저장소에서 열리지 않을 수 있습니다. 기존 자료는 원래 PC에 보존되어 있습니다. [범위 기록](docs/upload-scope.md)을 참고하세요.

## 다른 PC에서 시작하기

```sh
git clone https://github.com/goodand/diagram-design-system.git
cd diagram-design-system
git switch -c compare/other-pc
```

다른 PC의 기존 폴더는 보존한 채 별도 경로에 clone하세요. 기존 버전과 파일 차이를 검토하고, Human이 최종 버전을 선택하기 전에는 이 스냅샷을 최종본으로 간주하지 않습니다.

Node.js가 설치된 환경에서 기존 CLI 단위 테스트를 실행할 수 있습니다.

```sh
cd v3_8_cli/designing-relation-diagrams
node --test test/cli.test.mjs
node --test test/workflow.test.mjs
```

PNG 생성에는 Chrome/Edge 또는 지원되는 SVG 변환기가 필요합니다. 평가 도구는 Python 3, Claude CLI 및 현재 코드의 macOS Chrome 경로에 의존하므로 다른 OS에서 그대로 실행 가능하다고 보장하지 않습니다. 지금은 `run_main.sh` 또는 `judge.py selftest`를 실행하지 마세요.

기존 세 타입의 Workflow 및 승인 계약은 [workflow.md](v3_8_cli/designing-relation-diagrams/references/workflow.md)에 보존합니다. 새 네 단계와 실제 `diagram_type` 계약은 [workflow-units.md](v3_8_cli/designing-relation-diagrams/references/workflow-units.md)와 [workflow-units.schema.json](v3_8_cli/designing-relation-diagrams/references/workflow-units.schema.json)에 있습니다. 기존 `docs/source-manifest.json`은 2026-10-07 원본 스냅샷의 역사적 기록입니다. 현재 수정본과 동일하다는 뜻은 아닙니다.

Decision file·Decision Flow·Decision System의 개정 작업은 Web ChatGPT에서 진행합니다. 저장소 보관 범위 결정과 결정 내용의 개정은 별도 작업입니다.
