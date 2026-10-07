# Diagram Design System

현재 PC의 v3.8 CLI Skill과 평가 도구를 다른 PC에서 비교·계속 작업하기 위한 **2026-10-07 부분 스냅샷**입니다. 최종 버전은 다른 PC의 버전과 비교한 뒤 Human이 결정합니다.

## 현재 상태

- Skill 문서 8개 최신화 완료. 배포 패키지와 소스가 일치합니다.
- J8의 `review_notice` 슬롯 지시문 수리 완료. F7·F8·F19를 Codex 독립 슬롯 채움으로 3회 확인하여 9/9 기대 판정 일치, 48쌍 불일치 0입니다.
- `eval/judge_fixtures/**/judge.json`은 기존 저장 결과이며 이번 수리 후 재실행 결과가 아닙니다. 이번 부분 검증 결과는 `docs/verification/j8-focused-repeat-results.json`을 기준으로 읽습니다.
- 이 확인은 정적 SVG 기반 J8 부분 검증입니다. 전체 판정기 자기 시험이나 기존 Haiku 결과의 재현을 뜻하지 않습니다.
- Human 지시에 따라 `JUDGE_SEQ=1` 전체 자기 시험과 36건 본 실험 판정을 진행하지 않습니다.
- 평가 실행기·판정기의 기본 LLM 연결은 여전히 Claude CLI입니다. Codex 부분 검증이 전체 실행기의 Codex 전환을 뜻하지 않습니다.

## 포함 내용

| 경로 | 용도 |
|---|---|
| `v3_8_cli/designing-relation-diagrams/` | 최신 Skill, CLI, 기존 단위 테스트 |
| `designing-relation-diagrams-v3.8-cli.skill` | 동일 소스의 배포 패키지 |
| `v3_8_cli/_baseline_v37/` | 단위 테스트·비교 실험에 필요한 기준본 |
| `v3_8_cli/SPEC_cli.md` | CLI 계약 |
| `v3_8_cli/eval/` | J8 수리 코드, 고정 시험자료, 평가 명세와 사전등록 자료 |
| `digram_design.md`, `formal/`, `diagrams/`, 데모 HTML | 기존 설계 자료 |
| `docs/verification/` | 이번 J8·Skill 변경의 검증 기록과 패치 |
| `docs/source-manifest.json` | 복사한 원본 파일의 SHA-256 |

Decision 원장·JSON·생성 도구, 실험 실행 기록, 과거 패키지·백업·전달 묶음은 **추가 업로드 범위 결정 대기**입니다. 이 스냅샷은 전체 작업 폴더 백업이 아니며, 해당 자료로 향하는 역사적 참조는 아직 저장소에서 열리지 않을 수 있습니다. 기존 자료는 원래 PC에 보존되어 있습니다. [범위 기록](docs/upload-scope.md)을 참고하세요.

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
```

PNG 생성에는 Chrome/Edge 또는 지원되는 SVG 변환기가 필요합니다. 평가 도구는 Python 3, Claude CLI 및 현재 코드의 macOS Chrome 경로에 의존하므로 다른 OS에서 그대로 실행 가능하다고 보장하지 않습니다. 지금은 `run_main.sh` 또는 `judge.py selftest`를 실행하지 마세요.

Decision file·Decision Flow·Decision System의 개정 작업은 Web ChatGPT에서 진행합니다. 저장소 보관 범위 결정과 결정 내용의 개정은 별도 작업입니다.
