# Agent Lint Kullanım Senaryoları (MCP + CLI)

Bu doküman, `docs/great_plan.md` planı uygulanmış Agent Lint projesinin **gerçek (mevcut) kullanımını** anlatır.
Amaç: hem MCP server hem de CLI tarafında bir kullanıcının nasıl başlayacağını, hangi senaryolarda hangi komutu/tool'u kullanacağını örneklerle göstermektir.

## 1) Hızlı Özet

- **CLI tarafında mevcut komutlar:** `analyze`, `scan`, `score`
- **MCP tarafında mevcut tool'lar:**
  - `prepare_artifact_fix_context`
  - `analyze_artifact`
  - `analyze_context_bundle`
  - `submit_client_assessment`
  - `quality_gate_artifact`
  - `suggest_patch`
  - `validate_export`
  - `analyze_workspace_artifacts` (transport/ayar durumuna göre)
  - `apply_patches` (stdio/local mod ve ayarlara göre)

> Not: Bu listeler koddan doğrulanmıştır (`packages/cli/src/index.ts`, `packages/mcp/src/tools/index.ts`).

---

## 2) Ne Zaman CLI, Ne Zaman MCP?

## CLI seç (hızlı terminal akışı)

Aşağıdaki durumlarda idealdir:
1. Tek dosyanın skorunu hızlı görmek
2. Repo genelinde toplu tarama yapmak
3. CI pipeline'da eşik altını fail ettirmek

## MCP seç (agent/assistant ile iteratif kalite akışı)

Aşağıdaki durumlarda idealdir:
1. Agent ile birlikte iteratif iyileştirme yapmak
2. Client-led score + evidence modeliyle çalışmak
3. `prepare -> assessment -> quality gate -> validate` akışını tool zinciriyle işletmek
4. Güvenli patch uygulama (`apply_patches`) gerekiyorsa

---

## 3) Kurulum / Çalıştırma

## 3.1 CLI

```bash
npx @agent-lint/cli --help
npx @agent-lint/cli analyze AGENTS.md
```

Yerel geliştirme:

```bash
pnpm install
pnpm run cli -- --help
```

## 3.2 MCP Server

En basit kullanım:

```bash
npx -y @agent-lint/mcp
```

Yerel geliştirme:

```bash
pnpm install
pnpm run mcp:stdio
```

IDE MCP config örnekleri için:
- `examples/cursor-mcp.json`
- `examples/claude-desktop-config.json`

---

## 4) CLI Kullanım Senaryoları

## Senaryo A — Tek artifact’i detaylı analiz et

```bash
npx @agent-lint/cli analyze AGENTS.md --type agents --verbose
```

Ne sağlar?
- 12 metrik üzerinden analiz çıktısı
- uyarılar/findings
- tip belirleme (`--type` ile explicit)

## Senaryo B — Sadece skor al (script-friendly)

```bash
npx @agent-lint/cli score AGENTS.md
```

JSON istersen:

```bash
npx @agent-lint/cli score AGENTS.md --json
```

## Senaryo C — Tüm repoyu tarayıp skorları gör

```bash
npx @agent-lint/cli scan . --max-files 50
```

JSON çıktısı:

```bash
npx @agent-lint/cli scan . --json
```

## Senaryo D — CI quality gate (threshold)

```bash
npx @agent-lint/cli scan . --json --fail-below 70
```

Beklenen davranış:
- En az bir artifact 70 altındaysa process exit code `1`
- Aksi durumda `0`

Örnek GitHub Actions kullanımı için: `examples/github-action.yml`

## Senaryo E — Watch mode ile canlı takip

Tek dosya:

```bash
npx @agent-lint/cli analyze AGENTS.md --watch
```

Dizin tarama:

```bash
npx @agent-lint/cli scan . --watch
```

---

## 5) MCP Kullanım Senaryoları

Aşağıdaki örnekler, MCP client'ın tool call yaptığı mantığı gösterir.
(İstemciye göre JSON-RPC formatı değişebilir; burada sadeleştirilmiş payload örnekleri verilmiştir.)

## Senaryo 1 — Danışman analiz (tek artifact)

Tool: `analyze_artifact`

Örnek input:

```json
{
  "type": "agents",
  "content": "# AGENTS.md\n..."
}
```

Ne alırsın?
- policy snapshot
- score, warnings, advisory
- resource URI’leri (`agentlint://...`)

## Senaryo 2 — Çoklu bağlam analizi

Tool: `analyze_context_bundle`

Örnek input:

```json
{
  "type": "agents",
  "content": "# AGENTS.md ...",
  "contextDocuments": [
    { "label": "rules", "content": "# Rules ..." },
    { "label": "plan", "content": "# Plan ..." }
  ],
  "includeMergedContentPreview": true
}
```

Ne alırsın?
- bağlamın birlikte etkisini gösteren skor/uyarılar
- context summary
- opsiyonel merged preview

## Senaryo 3 — Client-led fix loop (önerilen ana akış)

1. `prepare_artifact_fix_context`
2. `submit_client_assessment`
3. `quality_gate_artifact`
4. `validate_export`

### 3.1 Prepare

```json
{
  "type": "agents",
  "targetScore": 90
}
```

### 3.2 Submit assessment

```json
{
  "type": "agents",
  "content": "# AGENTS.md ...",
  "targetScore": 90,
  "assessment": {
    "repositoryScanSummary": "Scanned AGENTS.md and docs/",
    "scannedPaths": ["AGENTS.md", "docs/great_plan.md"],
    "metricScores": [
      { "metric": "clarity", "score": 80 }
    ],
    "metricEvidence": [
      {
        "metric": "clarity",
        "citations": [
          { "filePath": "AGENTS.md", "lineStart": 1, "snippet": "..." }
        ]
      }
    ],
    "weightedScore": 80,
    "confidence": 0.8,
    "gaps": ["Add stricter verification checklist"],
    "rewritePlan": "Refine constraints and validation steps"
  }
}
```

### 3.3 Quality gate

```json
{
  "type": "agents",
  "content": "# AGENTS.md original",
  "candidateContent": "# AGENTS.md revised",
  "targetScore": 90,
  "clientAssessment": {
    "repositoryScanSummary": "...",
    "scannedPaths": ["AGENTS.md"],
    "metricScores": [{ "metric": "clarity", "score": 88 }],
    "metricEvidence": [{ "metric": "clarity", "citations": [] }],
    "weightedScore": 88,
    "confidence": 0.8,
    "gaps": [],
    "rewritePlan": "..."
  }
}
```

### 3.4 Validate export

```json
{
  "content": "# AGENTS.md revised"
}
```

## Senaryo 4 — Workspace keşfi + toplu analiz

Tool: `analyze_workspace_artifacts`

```json
{
  "rootPath": ".",
  "maxFiles": 25
}
```

Kullanım amacı:
- repoda AGENTS/rules/skills/workflows/plans dosyalarını bulup hızlı puanlama
- iyileştirme backlog’u çıkarmak

## Senaryo 5 — Güvenli patch uygulama (local stdio)

Tool: `apply_patches`

Önce dry-run (varsayılan):

```json
{
  "filePath": "AGENTS.md",
  "patchedContent": "# AGENTS.md updated ...",
  "expectedHash": "<sha256>",
  "allowWrite": true
}
```

Gerçek yazma:

```json
{
  "filePath": "AGENTS.md",
  "patchedContent": "# AGENTS.md updated ...",
  "expectedHash": "<sha256>",
  "allowWrite": true,
  "dryRun": false
}
```

Önemli guardrail’ler:
- hash doğrulaması
- uzantı allowlist (`.md/.yaml/.yml/.txt`)
- backup/rollback
- path traversal koruması

---

## 6) Pratik Kullanım Rehberi (Rol Bazlı)

## A) Repo Maintainer (CI odaklı)

1. PR’da `scan . --json --fail-below 70` çalıştır
2. Fail eden artifact’ları listeden al
3. Gerekirse agent ile MCP fix loop uygula
4. Geçince merge et

## B) Prompt/Context Yazarı (iteratif kalite)

1. `analyze_artifact` ile mevcut durumu gör
2. `prepare_artifact_fix_context` ile hedef ve metrik şablonunu çek
3. `submit_client_assessment` ile evidence-backed score üret
4. `quality_gate_artifact` ile geçene kadar iyileştir
5. `validate_export` ile final güvenlik kontrolü yap

## C) Tooling/Platform Ekibi

1. MCP’yi IDE’ye bağla (Cursor/Claude/VS Code)
2. Workspace scan ile mevcut envanteri çıkar
3. Kritik düşük skorlu dosyaları backlog’a al
4. Standartlaştırma için düzenli scan raporu üret

---

## 7) Sık Karşılaşılan Durumlar

- **Tip infer edilemedi**: CLI’de `--type agents|skills|rules|workflows|plans` ver.
- **Exit code 1**: skor threshold altında veya komut akışında kalite barajı geçilemedi.
- **Exit code 2**: kullanım/config benzeri hatalar.
- **`apply_patches` yazmıyor**: `allowWrite=true` ve `dryRun=false` gerekli; ayrıca stdio/local mod gerekir.

---

## 8) Doğrulama Checklist’i

- CLI komutları çalışıyor mu?
  - `analyze`
  - `scan`
  - `score`
- MCP tool zinciri çalışıyor mu?
  - `prepare_artifact_fix_context`
  - `submit_client_assessment`
  - `quality_gate_artifact`
  - `validate_export`
- CI threshold davranışı doğru mu? (`--fail-below`)
- Patch güvenlik guardrail’leri beklendiği gibi mi?

---

## 9) Referanslar

- Plan: `docs/great_plan.md`
- Üst seviye ürün/dokümantasyon: `README.md`
- CLI entry: `packages/cli/src/index.ts`
- CLI komutları:
  - `packages/cli/src/commands/analyze.ts`
  - `packages/cli/src/commands/scan.ts`
  - `packages/cli/src/commands/score.ts`
- MCP server:
  - `packages/mcp/src/server.ts`
  - `packages/mcp/src/tools/index.ts`
- MCP tool implementasyonları:
  - `packages/mcp/src/tools/prepare-artifact-fix-context.ts`
  - `packages/mcp/src/tools/submit-client-assessment.ts`
  - `packages/mcp/src/tools/quality-gate-artifact.ts`
  - `packages/mcp/src/tools/analyze-artifact.ts`
  - `packages/mcp/src/tools/analyze-context-bundle.ts`
  - `packages/mcp/src/tools/analyze-workspace-artifacts.ts`
  - `packages/mcp/src/tools/suggest-patch.ts`
  - `packages/mcp/src/tools/validate-export.ts`
  - `packages/mcp/src/tools/apply-patches.ts`
