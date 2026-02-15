# Agent Execution Backlog (Sirali Uygulama Listesi)

Bu dosya, coding assistant agent'in dogrudan uygulayabilecegi gorev listelerini verir.

Kullanim amaci:
- Faz bazli uygulanabilir gorev akisi
- Her gorev icin dosya referanslari
- Tamamlanma kriterleri ve dogrulama komutlari

Uygulama kurali:
- Faz sirasina uy
- Her faz bitmeden sonraki faza gecme
- Faz sonu testlerini calistir

Ana referanslar:
- `docs/roadmap_master.md`
- `docs/phased_implementation_plan.md`
- `docs/engineering_guardrails.md`

## Execution Status Snapshot (2026-02-15)

Tamamlananlar:
- [x] Task 0.1 - Analyze response metadata standardizasyonu
- [x] Task 0.2 - Baseline test raporu altyapisi
- [x] Task 1.1 - Prompt templates V2
- [x] Task 1.2 - Static signal katmani
- [x] Task 1.3 - Semantic validation katmani
- [x] Task 1.4 - Testleri genislet
- [x] Task 2.1 - API schema genisletme
- [x] Task 2.2 - Router context merge
- [x] Task 2.3 - UI context ekleme
- [x] Task 2.4 - Integration test
- [x] Task 3.1 - Env tabanli retry config
- [x] Task 3.2 - Fallback reason modeli
- [x] Task 3.3 - UI provider durumu
- [x] Task 4.3 - Instant lint (erken teslim)
- [x] Task 5.1 - Diff rationale mapping
- [x] Task 5.2 - Selective apply mekanizmasi
- [x] Task 5.3 - E2E selective apply
- [x] Task 4.1 - Streaming endpoint secimi
- [x] Task 4.2 - Client stream handling
- [x] Task 4.4 - E2E streaming test

Devam edenler:
- [x] Faz 6 - MCP ve CLI backlog tasklari
- [x] Faz 6.7 - MCP deterministic LLM-free migration
- [ ] Faz 7 - Dynamic template, URL import, house rules backlog tasklari
- [ ] Faz 8 - Refactor ve CI backlog tasklari

Planlananlar:
- [ ] Advanced streaming telemetry alignment (server stages tied to real provider runtime)

---

## Faz 0 Backlog - Baseline

### Task 0.1 - Analyze response metadata standardizasyonu
Dosyalar:
- `src/server/api/routers/artifacts.ts`

Yapilacak:
- Analyze response'a telemetry alanlarini ekle/standartlastir:
  - `durationMs`
  - `provider`
  - `analysisMode`
  - `warnings`

DoD:
- Response yapisi deterministic
- Integration testlerde alanlar dogrulaniyor

### Task 0.2 - Baseline test raporu altyapisi
Dosyalar:
- `tests/integration/artifacts-router.test.ts`
- `tests/integration/judge-pipeline.test.ts`

Yapilacak:
- Baseline metric assertion'lari ekle

DoD:
- Testler metric alanlarini kontrol ediyor

---

## Faz 1 Backlog - Judge Core V2

### Task 1.1 - Prompt templates V2
Dosyalar:
- `src/server/services/prompt-templates.ts`
- Referans: `docs/core_doc_2.md`

Yapilacak:
- Artefakt-tipine ozel detayli promptlari yaz
- Zorunlu cikti formatini netlestir

DoD:
- Unit/integration testlerde type-specific prompt secimi dogru

### Task 1.2 - Static signal katmani
Dosyalar:
- `src/server/services/artifact-analyzer.ts`

Yapilacak:
- Regex detection sonuclari "signal" olarak ayrilsin
- Nihai fail/pass dogrudan regex'ten cikmasin

DoD:
- Analyzer ciktilarinda signal listesi gorunur

### Task 1.3 - Semantic validation katmani
Dosyalar:
- `src/server/services/artifact-analyzer.ts`

Yapilacak:
- Negation-aware kontrol
- Quoted/fenced metinlerde false positive azaltimi

DoD:
- "Do not force push" senaryosu fail olmuyor
- Tehlikeli eylem cagirilari fail oluyor

### Task 1.4 - Testleri genislet
Dosyalar:
- `tests/unit/artifact-analyzer.test.ts`

Yapilacak:
- False-positive regression testleri ekle

DoD:
- Yeni testler geciyor

---

## Faz 2 Backlog - Project Context Mode

### Task 2.1 - API schema genisletme
Dosyalar:
- `src/lib/artifacts.ts`

Yapilacak:
- `contextDocuments` alanini opsiyonel ekle
- Geriye uyumlu kal

DoD:
- Eski requestler calismaya devam eder

### Task 2.2 - Router context merge
Dosyalar:
- `src/server/api/routers/artifacts.ts`

Yapilacak:
- Context dokumanlari merge + dedup + size budget
- Judge pipeline'a context paketini aktar

DoD:
- Context verisi analyze akisinda kullaniliyor

### Task 2.3 - UI context ekleme
Dosyalar:
- `src/components/editor-workbench.tsx`
- `src/components/input-panel.tsx`

Yapilacak:
- Kullaniciya ek baglam dokumani girisi sagla

DoD:
- UI'dan coklu baglam gonderilebiliyor

### Task 2.4 - Integration test
Dosyalar:
- `tests/integration/artifacts-router.test.ts`

Yapilacak:
- Coklu dokumanli analyze testi ekle

DoD:
- Capraz celiski/uyari akisi testte dogrulaniyor

---

## Faz 3 Backlog - Provider Resilience ve Seffaflik

### Task 3.1 - Env tabanli retry config
Dosyalar:
- `src/server/ai/judge-provider.ts`
- `.env.example`

Yapilacak:
- Hardcoded retry sabitlerini env'e tasi

DoD:
- Env ile parametre degisimi mumkun

### Task 3.2 - Fallback reason modeli
Dosyalar:
- `src/server/services/judge-pipeline.ts`

Yapilacak:
- Typed reason code don

DoD:
- Her fallback icin reason code mevcut

### Task 3.3 - UI provider durumu
Dosyalar:
- `src/components/score-display.tsx`

Yapilacak:
- Provider + fallback reason + confidence goster

DoD:
- Kullanici fallback nedenini acikca goruyor

---

## Faz 4 Backlog - Streaming ve Instant Lint

### Task 4.1 - Streaming endpoint secimi
Dosyalar:
- `src/app/api/trpc/[trpc]/route.ts` veya yeni route handler

Yapilacak:
- Baslangic icin SSE veya tRPC stream modeli sec

DoD:
- Stage eventleri istemciye akiyor

### Task 4.2 - Client stream handling
Dosyalar:
- `src/trpc/react.tsx`
- `src/components/editor-workbench.tsx`

Yapilacak:
- Stream eventlerini UI stage progress'e bagla

DoD:
- "Judge is thinking" yerine asamali ilerleme gorunur

### Task 4.3 - Instant lint
Dosyalar:
- `src/components/input-panel.tsx`

Yapilacak:
- Input degisince hizli warning sinyalleri goster

DoD:
- Analyze beklemeden on sinyal gorunur

### Task 4.4 - E2E streaming test
Dosyalar:
- `tests/e2e/analyze-flow.spec.ts`

Yapilacak:
- Eventlerin sirali geldigi akisi test et

DoD:
- E2E stabil calisiyor

---

## Faz 5 Backlog - Explainable Diff ve Selective Apply

### Task 5.1 - Diff rationale mapping
Dosyalar:
- `src/components/diff-viewer.tsx`
- `src/components/analysis-dashboard.tsx`

Yapilacak:
- Hunk bazli "neden" annotation

DoD:
- Her kritik degisiklikte rationale gorunur

### Task 5.2 - Selective apply mekanizmasi
Dosyalar:
- `src/components/editor-workbench.tsx`
- `src/components/diff-viewer.tsx`

Yapilacak:
- Hunk secimi + parcali apply

DoD:
- Kismi apply dogru input uretiyor

### Task 5.3 - E2E selective apply
Dosyalar:
- `tests/e2e/diff-viewer.spec.ts`

DoD:
- Secili hunk uygulanip digerleri korunuyor

---

## Faz 6 Backlog - MCP ve CLI

### Task 6.1 - MCP server bootstrap
Durum: [x] Completed

Uygulanan dosyalar:
- `src/mcp/core/create-server.ts`
- `src/mcp/server.ts`
- `src/mcp/stdio.ts`

Sonuc:
- MCP server init + tool registration tamamlandi.
- Local `stdio` transport ile listTools/callTool akisi aktif.

### Task 6.2 - MCP tools implementation
Durum: [x] Completed

Uygulanan dosyalar:
- `src/mcp/tools/analyze-artifact.ts`
- `src/mcp/tools/analyze-context-bundle.ts`
- `src/mcp/tools/suggest-patch.ts`
- `src/mcp/tools/validate-export.ts`
- `src/mcp/tools/index.ts`
- `src/mcp/types.ts`

Sonuc:
- Tum tool call'lari typed input contract ile calisiyor.
- `structuredContent` tabanli JSON cikti donuluyor.

### Task 6.3 - Remote streamable HTTP + auth/session
Durum: [x] Completed

Uygulanan dosyalar:
- `src/mcp/http/server.ts`
- `src/mcp/http/session-store.ts`
- `src/mcp/http/auth.ts`
- `src/mcp/http/oauth-metadata.ts`

Sonuc:
- Public-ready streamable HTTP endpoint (`/mcp`) eklendi.
- Session store + TTL cleanup + health/readiness endpointleri aktif.
- Bearer auth + scope kontrolu + rate limit + concurrency/body/timeout guardlari eklendi.

### Task 6.4 - CLI wrapper
Durum: [x] Completed

Uygulanan dosyalar:
- `src/cli/index.ts`

Sonuc:
- `agentlint analyze`
- `agentlint fix`
- `agentlint score`
- CLI smoke testleri geciyor.

### Task 6.5 - Dokuman ve ops
Durum: [x] Completed

Uygulanan dosyalar:
- `README.md`
- `docs/mcp_phase6_contract.md`
- `docs/mcp_remote_runbook.md`
- `.env.example`
- `Dockerfile.mcp`
- `server.json`

Sonuc:
- Local + remote MCP kurulum adimlari dokumante edildi.
- Go-live checklist ve registry metadata taslagi eklendi.

### Task 6.6 - Auto-invoke convention, prompts/resources, quality gate
Durum: [x] Completed

Uygulanan dosyalar:
- `src/mcp/core/create-server.ts`
- `src/mcp/tools/quality-gate-artifact.ts`
- `src/mcp/tools/analyze-workspace-artifacts.ts`
- `src/mcp/prompts/register-prompts.ts`
- `src/mcp/resources/register-resources.ts`
- `docs/mcp_client_conventions.md`

Sonuc:
- Tool descriptions ve server instructions policy-first hale getirildi.
- `quality_gate_artifact` ile tek-cagrida analyze->patch->validate akisi eklendi.
- Prompt/resource capability eklendi; client tarafi guidance metinleri expose edildi.
- Local stdio modunda workspace scan tool'u eklendi (`analyze_workspace_artifacts`).

### Task 6.7 - MCP deterministic LLM-free migration
Durum: [x] Completed

Uygulanan dosyalar:
- `src/server/services/analyze-artifact-mcp-core.ts`
- `src/mcp/tools/analyze-artifact.ts`
- `src/mcp/tools/analyze-context-bundle.ts`
- `src/mcp/tools/analyze-workspace-artifacts.ts`
- `src/mcp/tools/quality-gate-artifact.ts`
- `src/mcp/types.ts`
- `src/mcp/conventions/artifact-path-hints.ts`
- `src/mcp/conventions/artifact-specs.ts`
- `src/mcp/resources/register-resources.ts`
- `tests/integration/mcp-stdio.test.ts`
- `tests/integration/mcp-http.test.ts`

Sonuc:
- MCP path provider cagrilarindan ayrildi ve deterministic analiz moduna gecti.
- `quality_gate_artifact` patch merge adimini sadece `candidateContent` verildiginde calistiriyor.
- Yeni kaynaklar eklendi: `artifact-path-hints` ve `artifact-spec`.

### Task 6.8 - Remote compatibility and runtime hardening
Durum: [x] Completed

Uygulanan dosyalar:
- `src/mcp/http/server.ts`
- `src/mcp/stdio.ts`
- `tests/integration/mcp-http.test.ts`
- `README.md`
- `docs/mcp_remote_runbook.md`
- `docs/mcp_client_conventions.md`

Sonuc:
- HTTP stateless compatibility request-bazli runtime ile sabitlendi.
- `GET /readyz` capability/advertised metadata ile remote debug akisina acik hale getirildi.
- MCP entrypoint'lerinde `.env` auto-load (`dotenv/config`) aktif edilerek env kaynakli startup hatalari giderildi.

---

## Faz 7 Backlog - Dynamic Templates, URL Import, House Rules

### Task 7.1 - Template registry
Dosyalar:
- `src/components/editor-workbench.tsx`
- yeni: `src/server/services/template-registry.ts`

DoD:
- Hardcoded template yerine registry kullaniliyor

### Task 7.2 - URL import
Dosyalar:
- `src/server/api/routers/artifacts.ts`
- yeni: `src/server/services/url-import.ts`

DoD:
- URL'den cekilen icerik sanitize edilip analyze edilebiliyor

### Task 7.3 - House rules precedence
Dosyalar:
- yeni: `src/server/services/house-rules.ts`
- `src/server/db/schema.ts`

DoD:
- Global->Org->Workspace->Local precedence deterministic

---

## Faz 8 Backlog - Refactor ve CI

### Task 8.1 - Analyzer modulerlestirme
Dosyalar:
- `src/server/services/artifact-analyzer.ts` (bolunecek)

DoD:
- Tip bazli analyzer dosyalari olustu
- Davranis regress etmedi

### Task 8.2 - Checklist otomasyon scripti
Dosyalar:
- `docs/check_control_list.md`
- yeni script dosyasi (repo standardina gore)

DoD:
- CI pipeline checklist fail/pass uretebiliyor

### Task 8.3 - Dokuman senkronu
Dosyalar:
- `docs/great_plan.md`
- `docs/PRD.md`

DoD:
- Plan ve gercek urun durumu hizali

---

## Her Faz Sonu Zorunlu Komutlar

```bash
npm run lint
npm run test
npm run test:e2e
```

Not:
- Faz icinde parcali test calismasi serbesttir.
- Faz kapanisinda tam suite onerilir.

---

## Coding Assistant Icin Uygulama Prensibi

1. Faz dosyasini oku, gorevleri sirasiyla uygula.
2. Her task sonunda ilgili testleri calistir.
3. Her task'ta dokunulan dosyalari ve nedenini raporla.
4. Faz bitiminde DoD checklist'i tek tek dogrula.
5. Gerekirse bir sonraki faza gecmeden once dokuman guncelle.
