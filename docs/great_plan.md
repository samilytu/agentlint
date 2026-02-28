# AgentLint Pivot Plan: SaaS → OSS Local-First MCP DevTool

> **Vizyon**: `npx -y @agent-lint/mcp` ile sıfır-sürtünme kurulum. LLM yok, veritabanı yok, auth yok. Tamamen deterministik, read-only statik analiz motoru.

---

## Mevcut Durum Özeti

AgentLint hali hazırda **kapsamlı bir deterministik analiz motoru** ve **çalışan MCP altyapısına** sahip. Pivotun büyük kısmı "sıfırdan inşa" değil **"çıkar ve yeniden paketle"** operasyonudur.

### Var Olan ve Yeniden Kullanılabilir Bileşenler

| Bileşen | Dosya | LLM Bağımlılığı |
|---------|-------|------------------|
| Deterministik Kural Motoru (12 metrik, 1016 satır) | `src/server/services/artifact-analyzer.ts` | Yok |
| MCP Server Factory (stdio + http) | `src/mcp/core/create-server.ts` | Yok |
| 8 MCP Tool (analyze, workspace scan, quality gate, suggest patch, vb.) | `src/mcp/tools/` | Yok |
| Client-Led Scoring Policy (12 metrik, tip bazlı ağırlıklar) | `src/mcp/conventions/client-led-scoring.ts` | Yok |
| Artifact Specs (zorunlu bölümler, anti-patternler) | `src/mcp/conventions/artifact-specs.ts` | Yok |
| Artifact Path Hints (Windsurf, Claude, Cursor, generic) | `src/mcp/conventions/artifact-path-hints.ts` | Yok |
| Workspace Scanner | `src/mcp/tools/analyze-workspace-artifacts.ts` | Yok |
| Frontmatter Parser | `src/lib/parser.ts` | Yok |
| Instant Lint (hızlı sinyal) | `src/lib/instant-lint.ts` | Yok |
| Selective Diff/Patch Motoru | `src/lib/selective-diff.ts` | Yok |
| Export Validation (markdown/YAML güvenlik) | `src/server/security/export-validation.ts` | Yok |
| Input Sanitization | `src/server/security/sanitize.ts` | Yok |
| CLI (analyze/fix/score komutları) | `src/cli/index.ts` | Yok |
| MCP Resources & Prompts | `src/mcp/resources/`, `src/mcp/prompts/` | Yok |
| Stdio Transport | `src/mcp/stdio.ts` | Yok |

### Sökülerek Atılacak SaaS Bileşenleri

- `@anthropic-ai/sdk`, `openai`, `@google/genai` — LLM sağlayıcılar
- `drizzle-orm`, `@libsql/client`, `drizzle-kit` — Veritabanı
- `express` — HTTP sunucu (remote MCP için)
- Next.js app (`src/app/`), React (`src/components/`), tRPC, Tailwind, shadcn
- `src/server/ai/judge-provider.ts` — LLM judge
- `src/server/services/judge-pipeline.ts` — LLM pipeline
- `src/server/services/prompt-templates.ts` — LLM prompt şablonları
- `src/server/db/` — Veritabanı katmanı
- `src/server/api/` — tRPC router'lar
- `src/trpc/` — tRPC client
- `src/mcp/http/` — HTTP transport (Faz 5'e ertelenir)

---

## Faz 0: Monorepo Yapısı & Temiz Çıkarım (Hafta 1, Gün 1-3)

**Hedef**: Yeniden kullanılabilir çekirdek kodu izole monorepo paketlerine çıkar, SaaS artıklarını temizle.

### 0.1 — Monorepo İskeleti

- [x] `pnpm` workspace veya `turborepo` ile monorepo oluştur
- [x] Paket yapısı:
  ```
  packages/
    core/          → Deterministik analiz motoru + kurallar
    mcp/           → MCP server (stdio transport)
    cli/           → CLI arayüzü
    shared/        → Ortak tipler, parser, utils
  ```
- [x] Root `package.json` → workspace config
- [x] Root `tsconfig.json` → project references (`composite: true`)
- [x] Her paketin kendi `package.json`, `tsconfig.json`, `vitest.config.ts` dosyası

### 0.2 — Çekirdek Motor Çıkarımı (`packages/core`)

- [x] `artifact-analyzer.ts` → `packages/core/src/analyzer.ts` olarak taşı
- [x] 12 metrik tanımlarını (`ClientMetricId`) kendi modülüne çıkar
- [x] Tip-bazlı kontrol fonksiyonlarını (`checkAgents`, `checkSkills`, vb.) ayrı dosyalara böl
- [x] Ortak kontrolleri (`checkCommon`) ayrı modüle taşı
- [x] `instant-lint.ts` → `packages/core/src/instant-lint.ts`
- [x] `selective-diff.ts` → `packages/core/src/diff.ts`
- [x] `export-validation.ts` → `packages/core/src/validation.ts`
- [x] `sanitize.ts` → `packages/core/src/sanitize.ts`
- [x] Tüm `drizzle-orm`, LLM SDK, ve `express` import'larının **sıfır** olduğunu doğrula
- [x] `vitest` ile mevcut testleri taşı ve çalıştır

### 0.3 — Paylaşılan Tipler (`packages/shared`)

- [x] `src/lib/artifacts.ts` → `packages/shared/src/artifacts.ts`
- [x] `src/lib/parser.ts` → `packages/shared/src/parser.ts`
- [x] `src/lib/judge.ts` → `packages/shared/src/types.ts` (LLM-bağımlı tipleri temizle)
- [x] `src/mcp/types.ts` → `packages/shared/src/schemas.ts`
- [x] Convention dosyaları:
  - `client-led-scoring.ts` → `packages/shared/src/conventions/scoring.ts`
  - `artifact-specs.ts` → `packages/shared/src/conventions/specs.ts`
  - `artifact-path-hints.ts` → `packages/shared/src/conventions/path-hints.ts`

### 0.4 — SaaS Temizliği

- [x] `src/app/` dizinini tamamen kaldır
- [x] `src/components/` dizinini tamamen kaldır
- [x] `src/server/db/` dizinini tamamen kaldır
- [x] `src/server/ai/` dizinini tamamen kaldır
- [x] `src/server/api/` (tRPC) dizinini tamamen kaldır
- [x] `src/trpc/` dizinini tamamen kaldır
- [x] `src/server/services/judge-pipeline.ts` kaldır
- [x] `src/server/services/prompt-templates.ts` kaldır
- [x] `src/server/services/mock-judge.ts` kaldır
- [x] `src/server/security/rate-limit.ts` kaldır (lokal araç için gereksiz)
- [x] `package.json`'dan SaaS bağımlılıklarını temizle:
  - `next`, `react`, `react-dom`
  - `@anthropic-ai/sdk`, `openai`, `@google/genai`
  - `drizzle-orm`, `@libsql/client`, `drizzle-kit`
  - `express`, `cors`
  - `@trpc/*`, `@tanstack/react-query`
  - `tailwindcss`, `@shadcn/*`
- [x] `grep -r "drizzle\|openai\|anthropic\|genai\|express\|@trpc" packages/` → **sıfır sonuç**
- [x] Build başarılı: `tsc --noEmit` tüm paketlerde hatasız

### 0.5 — Faz 0 Doğrulama Kontrol Listesi

- [x] `packages/core` bağımsız olarak build oluyor
- [x] `packages/shared` bağımsız olarak build oluyor
- [x] Hiçbir pakette SaaS import'u kalmadı
- [x] Mevcut birim testleri geçiyor
- [x] `artifact-analyzer.ts`'deki 12 metrik çalışıyor (basit test ile doğrula)

---

## Faz 1: MCP Server — Stdio Transport (Hafta 1, Gün 3-5)

**Hedef**: `packages/mcp` paketini oluştur, mevcut MCP altyapısını temizle, stdio-only transport ile çalışır hale getir.

### 1.1 — MCP Paket Yapısı

- [x] `src/mcp/core/create-server.ts` → `packages/mcp/src/server.ts` olarak taşı
- [x] `src/mcp/stdio.ts` → `packages/mcp/src/stdio.ts`
- [x] `src/mcp/tools/` → `packages/mcp/src/tools/`
- [x] `src/mcp/resources/` → `packages/mcp/src/resources/`
- [x] `src/mcp/prompts/` → `packages/mcp/src/prompts/`
- [x] HTTP transport kodlarını (`src/mcp/http/`) bu fazda **dahil etme**, Faz 5'e bırak

### 1.2 — Tool Audit & Temizlik

Mevcut 8 tool'u incele ve sadeleştir:

| Tool | Durum | Aksiyon |
|------|-------|---------|
| `analyze_artifact` | KORU | Import'ları `@agent-lint/core`'a yönlendir |
| `analyze_workspace_artifacts` | KORU | `fs.readFileSync` ile read-only kalmasını doğrula |
| `analyze_context_bundle` | KORU | Import'ları güncelle |
| `prepare_artifact_fix_context` | KORU | Import'ları güncelle |
| `submit_client_assessment` | KORU | DB bağımlılığı varsa kaldır |
| `quality_gate_artifact` | KORU | Scoring'i `@agent-lint/shared`'dan al |
| `suggest_patch` | KORU | `selective-diff` import'unu güncelle |
| `validate_export` | KORU | `export-validation` import'unu güncelle |

- [x] Her tool'da SaaS-bağımlı import kontrolü (DB, LLM, express)
- [x] `propose_patches` ve `apply_patches` olarak tool ikiye bölünmeli:
  - `suggest_patch` → `propose_patches` (mevcut, sadece rename)
  - YENİ: `apply_patches` — sadece local modda çalışır, hash-guard + allowlist + backup ile

### 1.3 — Yeni Tool: `apply_patches`

- [x] Tool tanımı: artifact path + patch listesi alır
- [x] **Güvenlik katmanları**:
  - `--allow-write` flag'i olmadan çalışmayı REDDET
  - Hash doğrulama: dosya hash'i değişmişse işlemi DURDUR
  - Allowlist: sadece `.md`, `.yaml`, `.yml` dosyalara yazma izni
  - Backup: yazmadan önce `.bak` oluştur
  - Rollback: hata durumunda `.bak`'tan geri yükle
- [x] Sadece stdio modda aktif, HTTP modda devre dışı

### 1.4 — Yeni Tool: `scan_workspace`

- [x] Mevcut `analyze_workspace_artifacts`'ı genişlet veya wrap et
- [x] Framework detection ekle:
  - `.cursor/rules/`, `.cursorrules` → Cursor
  - `.claude/`, `CLAUDE.md` → Claude Code
  - `.windsurf/rules/` → Windsurf
  - `.github/copilot-instructions.md` → Copilot
  - `AGENTS.md`, `.agentlintrc` → AgentLint native
- [x] Glob pattern ile otomatik keşif: `**/AGENTS.md`, `**/*.rules.md`, vb.
- [x] Sonuç: `{ framework, artifacts: [{ path, type, size, quickScore }] }`

### 1.5 — Entry Point & bin

- [x] `packages/mcp/src/index.ts` → `createServer()` export et
- [x] `packages/mcp/src/bin.ts`:
  ```typescript
  #!/usr/bin/env node
  import { createStdioServer } from './stdio.js';
  createStdioServer();
  ```
- [x] `package.json`:
  ```json
  {
    "name": "@agent-lint/mcp",
    "bin": { "agent-lint-mcp": "./dist/bin.js" },
    "type": "module"
  }
  ```
- [x] **Altın Kurallar doğrulaması**:
  - `grep -r "writeFileSync\|writeFile\|fs.write" packages/mcp/` → sıfır (apply_patches hariç, o da guarded)
  - `grep -r "console.log" packages/mcp/` → sıfır (sadece `console.error` / logger to stderr)
  - Hiçbir global state, cache, veya singleton yok

### 1.6 — Faz 1 Doğrulama Kontrol Listesi

- [x] `npx tsx packages/mcp/src/bin.ts` ile server başlıyor
- [x] MCP Inspector ile tüm tool'lar listelenebiliyor
- [x] `analyze_artifact` tool'u doğru sonuç dönüyor (örnek artifact ile test)
- [x] `scan_workspace` framework detection çalışıyor
- [x] `propose_patches` patch öneriyor
- [x] `apply_patches` → `--allow-write` flag olmadan reddediyor
- [x] `apply_patches` → flag ile: backup → write → doğrula
- [x] Hiçbir stdout kirliliği yok (tüm loglar stderr'de)
- [x] Server stateless: iki ardışık çağrı arasında state paylaşımı yok

---

## Faz 2: CLI Arayüzü (Hafta 2, Gün 1-2)

**Hedef**: `packages/cli` ile kullanıcı-dostu CLI oluştur. CI/CD pipeline entegrasyonu ve `.agentlintrc` config desteği.

### 2.1 — CLI Yeniden Yapılandırma

- [x] `src/cli/index.ts` → `packages/cli/src/index.ts`
- [x] CLI framework: `commander` veya `yargs` (mevcut kullanıma göre koru)
- [x] Komutlar:
  ```
  agent-lint analyze <path>        # Tekil artifact analizi
  agent-lint scan [dir]            # Workspace tarama
  agent-lint fix <path>            # İnteraktif fix loop
  agent-lint score <path>          # Sadece skor
  agent-lint init                  # .agentlintrc oluştur
  ```

### 2.2 — `.agentlintrc` Config Desteği

- [ ] Config dosyası formatı (JSON veya YAML):
  ```yaml
  # .agentlintrc.yml
  targetScore: 80
  artifactPaths:
    agents: ["AGENTS.md", ".claude/CLAUDE.md"]
    rules: ["docs/rules.md", ".cursor/rules/*.md"]
    skills: ["skills/*.md"]
    workflows: ["docs/workflows/*.md"]
    plans: ["docs/plans/*.md"]
  ignore:
    - "node_modules/**"
    - ".git/**"
  metrics:
    weights:
      clarity: 15
      specificity: 12
      safety: 15
  ci:
    failBelow: 70
    format: "json"  # json | text | markdown
  ```
- [ ] Config resolution sırası: CLI flags > `.agentlintrc` > defaults
- [ ] `cosmiconfig` veya basit resolve logic

### 2.3 — CI/CD Modu

- [x] `agent-lint ci` komutu:
  - `--fail-below <score>` → exit code 1 ile çık
  - `--format json` → makineden okunabilir output
  - `--format markdown` → PR comment'e yapıştırılabilir
  - `--format text` → terminal-dostu (default)
- [x] Non-zero exit code'lar:
  - `0` → tüm artifact'lar geçti
  - `1` → en az bir artifact eşiğin altında
  - `2` → konfigürasyon hatası
- [ ] GitHub Actions örneği (`examples/github-action.yml`)

### 2.4 — Output Formatları

- [x] JSON output: `{ artifacts: [{ path, type, score, findings, patches }] }`
- [ ] Markdown output: tablo + findings + öneriler
- [x] Terminal output: renkli, emoji'li özet (varsayılan)
- [x] `--quiet` flag: sadece skor ve pass/fail
- [x] `--verbose` flag: tüm metrik detayları

### 2.5 — CLI bin & Package

- [x] `packages/cli/package.json`:
  ```json
  {
    "name": "@agent-lint/cli",
    "bin": { "agent-lint": "./dist/index.js" }
  }
  ```
- [x] `@agent-lint/core` ve `@agent-lint/shared` bağımlılığı

### 2.6 — Faz 2 Doğrulama Kontrol Listesi

- [x] `npx @agent-lint/cli analyze AGENTS.md` çalışıyor
- [x] `npx @agent-lint/cli scan .` workspace tarıyor, artifact'ları buluyor
- [x] `npx @agent-lint/cli ci --fail-below 70` → geçen artifact'ta exit 0, düşükte exit 1
- [ ] `.agentlintrc` config okunuyor ve uygulanıyor
- [x] JSON, markdown, text output formatları çalışıyor
- [x] `--quiet` ve `--verbose` flag'leri doğru çalışıyor

---

## Faz 3: Test Altyapısı & Kalite (Hafta 2, Gün 2-4)

**Hedef**: Kapsamlı test suite, regression koruma, ve kalite metrikleri.

### 3.1 — Birim Testler

- [x] `packages/core/tests/`:
  - 12 metrik için ayrı test dosyaları
  - Her artifact tipi için analiz testleri (agents, skills, rules, workflows, plans)
  - Ortak kontroller (injection-guard, secret-hygiene, safety) testleri
  - Edge case: boş girdi, dev girdi (>100KB), malformed frontmatter
  - Scoring hesaplaması doğruluğu
  - Snapshot testler: bilinen iyi artifact'lar için regresyon

- [x] `packages/shared/tests/`:
  - Parser testleri (valid/invalid frontmatter)
  - Type guard testleri
  - Convention dosyaları doğruluğu

### 3.2 — Entegrasyon Testler

- [x] `packages/mcp/tests/`:
  - MCP tool çağrıları (stdio üzerinden gerçek JSON-RPC)
  - Tool zincirleme: `analyze → prepare_fix → quality_gate`
  - Workspace scan ile gerçek dosya sistemi
  - `apply_patches` güvenlik testleri:
    - Hash mismatch → reddet
    - Allowlist dışı dosya → reddet
    - Flag eksik → reddet
    - Başarılı yazma → backup var, içerik doğru

- [x] `packages/cli/tests/`:
  - Komut çıktı formatları
  - Exit code'lar
  - Config resolution

### 3.3 — Fixture'lar

- [x] `fixtures/` dizini:
  - `good-agents.md` — yüksek skor beklenen
  - `bad-agents.md` — düşük skor beklenen (injection, secret leak, vb.)
  - `good-rules.md`, `bad-rules.md`
  - `good-skills.md`, `bad-skills.md`
  - `good-workflows.md`, `bad-workflows.md`
  - `good-plans.md`, `bad-plans.md`
  - `workspace/` — mock workspace (çeşitli framework dosyaları ile)

### 3.4 — Code Coverage & Quality Gates

- [x] Coverage hedefi: `packages/core` ≥ 90%, `packages/mcp` ≥ 80%, `packages/cli` ≥ 70%
- [x] `vitest` coverage raporu
- [x] Pre-commit hook: `lint-staged` + `vitest --run`
- [x] CI pipeline'da test zorunluluğu

### 3.5 — Faz 3 Doğrulama Kontrol Listesi

- [x] Tüm birim testler geçiyor
- [x] Tüm entegrasyon testleri geçiyor
- [x] Coverage hedefleri karşılanıyor
- [x] Fixture-bazlı regresyon testleri mevcut
- [x] `apply_patches` güvenlik testleri kapsamlı

---

## Faz 4: Güvenlik Sertleştirme (Hafta 2, Gün 4-5)

**Hedef**: Lokal araçta bile sağlam güvenlik garantileri. `apply_patches` saldırı yüzeyini minimize et.

### 4.1 — apply_patches Güvenlik Modeli

- [x] **Hash Guard**: Dosya okunduğunda SHA-256 hash al, yazma anında doğrula
- [x] **Allowlist**: Sadece izin verilen uzantılar (`.md`, `.yaml`, `.yml`, `.txt`)
- [x] **Path Traversal Koruması**: `../` ve sembolik link'leri reddet
- [x] **Boyut Limiti**: Tek patch 500KB'ı geçemez
- [x] **Backup/Rollback**: Her yazma işleminde `.agentlint-backup/` dizinine yedek
- [x] **Dry Run Varsayılan**: `--dry-run` varsayılan, `--apply` ile gerçek yazma
- [x] **Onay Mekanizması**: CLI'da interaktif onay (CI modda skip)

### 4.2 — Input Güvenliği

- [x] Artifact içeriği sanitizasyonu (mevcut `sanitize.ts` kullan)
- [x] Path injection kontrolü (null bytes, vb.)
- [x] Dosya boyutu limiti (CLI ve MCP tool'larda)
- [x] Recursive symlink koruması

### 4.3 — MCP Transport Güvenliği

- [x] Stdio: stdin/stdout clean (log'lar stderr'de)
- [x] JSON-RPC mesaj boyutu limiti
- [x] Tool timeout'ları (varsayılan 30s, `scan_workspace` 60s)
- [x] StreamableHTTP (Faz 5 ön hazırlık):
  - Origin header doğrulama (DNS rebinding koruması)
  - CORS strict policy
  - Rate limiting (lokal tek kullanıcı bile olsa)

### 4.4 — Supply Chain

- [x] Minimum bağımlılık: `@modelcontextprotocol/sdk`, `gray-matter`, `commander`, `zod`
- [x] `npm audit` temiz
- [x] Lockfile commit edilmiş
- [x] `package.json` → `"files"` alanı ile sadece gerekli dosyalar publish

### 4.5 — Faz 4 Doğrulama Kontrol Listesi

- [x] `apply_patches` tüm güvenlik senaryolarını reddediyor (test suite ile kanıtla)
- [x] Path traversal denemeleri reddediliyor
- [x] Symlink takibi yapılmıyor
- [x] `npm audit` sıfır vulnerability
- [x] Publish edilecek dosya listesi minimal ve doğru

---

## Faz 5: NPM Publish & Dağıtım (Hafta 3, Gün 1-3)

**Hedef**: `npx -y @agent-lint/mcp` ile tek komutla çalışan, Context7 tarzı sıfır-sürtünme deneyim.

### 5.1 — Paket Hazırlığı

- [x] `@agent-lint/core` — private (doğrudan publish edilmez, dependency olarak)
- [x] `@agent-lint/shared` — private
- [x] `@agent-lint/mcp` — **PUBLIC** (ana dağıtım noktası)
- [x] `@agent-lint/cli` — **PUBLIC**
- [x] Her pakette:
  - `"type": "module"`
  - `"engines": { "node": ">=18" }`
  - `"files"` alanı: sadece `dist/`, `README.md`, `LICENSE`
  - TypeScript declarations (`"types"`)

### 5.2 — Build Pipeline

- [x] `tsup` veya `esbuild` ile bundle:
  - ESM output
  - Sourcemaps
  - Declaration files
  - Tree-shaking
- [x] `prepublishOnly` script: `npm run build && npm run test`
- [x] `turbo` ile build ordering: `shared → core → mcp/cli`

### 5.3 — npx Deneyimi

- [x] `npx -y @agent-lint/mcp` ile başlayınca:
  1. Node.js ≥18 kontrolü
  2. `StdioServerTransport` başlat
  3. Tool'ları kaydet
  4. `stderr`'e bilgi mesajı: `Agent Lint MCP ready (stdio)`
  5. Gelen JSON-RPC mesajlarını işle
- [x] Soğuk başlama süresi: **< 2 saniye** hedef (832ms measured)
- [x] Paket boyutu: **< 5MB** unpacked hedef (MCP: 3.7MB, CLI: 2.0MB)

### 5.4 — MCP Client Konfigürasyonları

- [x] Cursor (`.cursor/mcp.json`):
  ```json
  {
    "mcpServers": {
      "agent-lint": {
        "command": "npx",
        "args": ["-y", "@agent-lint/mcp"]
      }
    }
  }
  ```
- [x] Claude Desktop (`claude_desktop_config.json`):
  ```json
  {
    "mcpServers": {
      "agent-lint": {
        "command": "npx",
        "args": ["-y", "@agent-lint/mcp"]
      }
    }
  }
  ```
- [x] VS Code MCP eklentisi için config
- [x] Windsurf için config
- [ ] `agent-lint init --mcp` → otomatik config dosyası oluşturma (deferred to FAZ 6)

### 5.5 — server.json & Registry

- [x] `server.json` güncelle (mevcut şablondan):
  ```json
  {
    "name": "agent-lint",
    "description": "Static analysis & quality scoring for AI agent context artifacts",
    "command": "npx",
    "args": ["-y", "@agent-lint/mcp"],
    "tools": ["analyze_artifact", "scan_workspace", "propose_patches", "apply_patches", "quality_gate_artifact", "validate_export"]
  }
  ```
- [ ] Smithery registry'e submit (after npm publish)
- [ ] MCP resmi registry'e submit (after npm publish)

### 5.6 — README & Dökümanlar

- [x] `README.md` tamamen yeniden yaz:
  - "One command" kurulum
  - Desteklenen MCP client'lar
  - Tool referansı
  - CI/CD entegrasyonu
  - `.agentlintrc` referansı
- [x] `AGENTS.md` güncelle (projenin kendi meta artifact'ı)
- [x] `CHANGELOG.md` başlat
- [x] `LICENSE` → MIT

### 5.7 — Faz 5 Doğrulama Kontrol Listesi

- [x] `npm pack` → paket boyutu < 5MB (MCP: 576KB packed, CLI: 325KB packed)
- [x] `npx -y @agent-lint/mcp` temiz makinede çalışıyor (Node 18+)
- [x] `npx -y @agent-lint/cli analyze AGENTS.md` çalışıyor
- [x] Soğuk başlama < 2s (832ms)
- [x] Cursor, Claude Desktop, VS Code'dan bağlanılabiliyor (config examples created)
- [x] `server.json` geçerli ve registry-ready
- [x] README açık ve eksiksiz

---

## Faz 6: HTTP Transport & Genişletme (Hafta 3-4, Opsiyonel)

**Hedef**: Remote MCP desteği, Smithery uyumluluğu, gelişmiş özellikler.

### 6.1 — StreamableHTTP Transport

- [x] Mevcut `src/mcp/http/` kodunu değerlendir ve gerekirse yeniden yaz
- [x] `packages/mcp/src/http.ts` + `packages/mcp/src/http-security.ts` olarak ekle
- [x] Origin doğrulama (DNS rebinding koruması)
- [x] Session yönetimi (per-server scoped Map<sessionId, transport>)
- [x] CORS konfigürasyonu
- [x] Bearer token auth (opsiyonel)
- [x] Health check endpoint'leri (`/healthz`, `/readyz`)

### 6.2 — Opsiyonel Uzantılar

- [x] **Custom Rule API**: Kullanıcı kendi lint kurallarını `.agentlint/rules/` altına ekleyebilir
- [x] **Plugin Sistemi**: Rule paketi olarak npm'den yüklenebilir kurallar
- [x] **Watch Modu**: Dosya değişikliklerinde otomatik re-analyze
- [ ] **VSCode Extension**: Native MCP yerine doğrudan extension (ileride)

### 6.3 — Topluluk & Ekosistem

- [x] Contributing guide (`CONTRIBUTING.md`)
- [x] Issue template'leri
- [x] GitHub Actions CI pipeline (test + publish)
- [x] npm provenance (sigstore)
- [x] Semantic versioning + changesets

### 6.4 — Faz 6 Doğrulama Kontrol Listesi

- [x] HTTP transport çalışıyor (isteğe bağlı)
- [x] Custom rule yüklenebiliyor
- [x] CI pipeline yeşil
- [x] npm publish otomatik (tag-triggered)

---

## Zaman Çizelgesi Özeti

| Faz | Süre | Çıktı |
|-----|------|-------|
| Faz 0: Monorepo & Çıkarım | 3 gün | Temiz paket yapısı, SaaS kodu sökülmüş |
| Faz 1: MCP Server (stdio) | 2-3 gün | `@agent-lint/mcp` çalışıyor, tüm tool'lar aktif |
| Faz 2: CLI | 2 gün | `@agent-lint/cli` çalışıyor, CI modu, config |
| Faz 3: Test & Kalite | 2-3 gün | Kapsamlı test suite, coverage hedefleri |
| Faz 4: Güvenlik | 1-2 gün | apply_patches güvenlik modeli, audit temiz |
| Faz 5: NPM Publish | 2-3 gün | `npx -y @agent-lint/mcp` canlı |
| Faz 6: HTTP & Genişletme | 3-5 gün | Opsiyonel, remote MCP, custom rules |
| **TOPLAM** | **~3-4 hafta** | **Tam OSS ürün** |

---

## Altın Kurallar (Her Fazda Doğrulanacak)

1. **ASLA State Tutma**: MCP server her çağrıda sıfırdan çalışır. Veritabanı, cache, singleton yok.
2. **ASLA Dosya Yazma (korumasız)**: `apply_patches` hariç hiçbir kod `fs.writeFile` kullanmaz. O da: hash-guard + allowlist + backup + explicit flag ile.
3. **Logları Temiz Tut**: `console.log()` YASAK (MCP protokolünü bozar). Tüm loglar `console.error()` veya `stderr` logger ile.
4. **MCP Server Veri Üretir, Talimat Vermez**: Server analiz ve skor döner, ne yapılacağına client (Cursor/Claude) karar verir.
5. **Minimum Bağımlılık**: Her yeni `npm install` için gerekçe gerekir. Paket boyutu < 5MB hedefi.

---

## Tool Kataloğu (Nihai)

| Tool | Açıklama | Giriş | Çıkış |
|------|----------|-------|-------|
| `analyze_artifact` | Tekil artifact analizi | `{ type, content }` | `{ score, metrics, findings, hints }` |
| `scan_workspace` | Workspace tarama + framework detection | `{ dir?, patterns? }` | `{ framework, artifacts[] }` |
| `analyze_context_bundle` | Çoklu artifact tutarlılık analizi | `{ artifacts[] }` | `{ bundleScore, crossFindings }` |
| `prepare_artifact_fix_context` | Fix loop başlatma konteksti | `{ type, content, score }` | `{ fixContext, suggestions }` |
| `submit_client_assessment` | Client LLM değerlendirmesi gönderme | `{ assessment, evidence }` | `{ hybridScore, guardrailResults }` |
| `quality_gate_artifact` | Kalite geçidi (target score kontrolü) | `{ content, targetScore, clientAssessment }` | `{ pass, score, breakdown }` |
| `propose_patches` | Patch önerisi oluşturma | `{ content, findings }` | `{ patches[], preview }` |
| `apply_patches` | Patch uygulama (guarded) | `{ filePath, patches[], hash }` | `{ success, backup, newHash }` |
| `validate_export` | Son çıktı doğrulama | `{ content, format }` | `{ valid, errors[] }` |
