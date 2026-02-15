# Faz Faz Detayli Implementasyon Plani

Bu dokuman, yol haritasindaki her fazin teknik uygulama adimlarini, dosya bazli degisikliklerini, test stratejisini, risklerini ve cikis kriterlerini detaylandirir.

Ana baglam:
- `docs/roadmap_master.md`
- `docs/engineering_guardrails.md`
- `AGENTS.md`

Execution snapshot (2026-02-15):
- Completed: Faz 0, Faz 1, Faz 2, Faz 3, Faz 4 (v1), Faz 5 (v1), Faz 6
- MCP path: deterministic LLM-free mode active
- MCP remote transport: stateless compatibility hardening complete
- Pending: Faz 7, Faz 8

---

## Faz 0 - Baseline, Telemetry ve Golden Corpus

Amac:
- Degisikliklerden once objektif olcum zemini olusturmak.

Kapsam:
- Performans, fallback, warning, false-positive bazli metrik toplama
- Golden test corpus tasarimi

Degisecek dosyalar:
- `src/server/api/routers/artifacts.ts`
- `tests/integration/artifacts-router.test.ts`
- `tests/integration/judge-pipeline.test.ts`

Yapilacaklar:
1. Router response'unda analiz metadata alanlarini normalize et:
   - `provider`
   - `analysisMode`
   - `durationMs`
   - `warnings[]`
2. Metrik log formatini sabitle (kolay parse edilebilir):
   - tek satir key=value formati
3. Golden corpus icin fixture stratejisi yaz:
   - guvenli metin
   - celiskili kural
   - injection benzeri metin
   - unicode/obfuscation benzeri metin

Test:
- Integration testlerde metadata alanlarinin dondugunu dogrula
- Warning birlesim mantigini dogrula

Exit kriter:
- Metrik alani her analyze sonucunda deterministik donuyor
- Baseline raporu cikarilabilir durumda

---

## Faz 1 - Judge Cekirdegi V2 (Prompt + Semantic)

Amac:
- Prompt kalitesini `core_doc_2` ile hizalamak
- Regex kaynakli kirilganligi azaltmak

Kapsam:
- `prompt-templates.ts` genisletmesi
- Analyzer'da static-signal + semantic karar ayrimi

Degisecek dosyalar:
- `src/server/services/prompt-templates.ts`
- `src/server/services/artifact-analyzer.ts`
- `src/server/services/judge-pipeline.ts`
- `tests/unit/artifact-analyzer.test.ts`

Detay adimlar:
1. Prompt seviyeleme:
   - Her artefakt tipi icin ayri zorunlu kontrol listesi
   - Cikti formatinda score + issues + minimal patch mantigi
2. Static-signal katmani:
   - Regex sadece "candidate risk" uretecek
   - Nihai fail/pass karari semantic evaluator tarafindan verilecek
3. Semantic evaluator tasarimi:
   - Negation-aware kontrol (ornek: "Do not force push" cezalandirilmaz)
   - Code fence/quote baglaminda yanlis alarm azaltimi
4. Analyzer sonucu ayri alanlar:
   - `signals`
   - `validatedFindings`
   - `confidence`

Test senaryolari:
- "force push" geciyor ama yasaklayici cumle ise fail olmamali
- "rm -rf" komutunu eyleme cagrida kullanan metin fail olmali
- Prompt pack secimi artefakt tipine gore dogru olmali

Exit kriter:
- False-positive testlerinde anlamli dusus
- V2 analyzer sonucu eski checkliste geriye uyumlu kalir

---

## Faz 2 - Project Context Mode

Amac:
- Tekli input yerine baglamsal analiz (coklu dosya)

Kapsam:
- API schema genisletme
- Context bundle olusturma
- UI'da context ekleme

Degisecek dosyalar:
- `src/lib/artifacts.ts`
- `src/server/api/routers/artifacts.ts`
- `src/components/editor-workbench.tsx`
- `src/components/input-panel.tsx`
- `tests/integration/artifacts-router.test.ts`

Onerilen veri modeli:
- `primaryContent`: string
- `contextDocuments`: Array<{ type, path?, content, priority? }>

Adimlar:
1. Schema upgrade (geriye uyumlu):
   - `content` korunur
   - yeni alan `contextDocuments` opsiyonel eklenir
2. Context merge algoritmasi:
   - duplicate azaltma
   - boyut butcesi
   - oncelik sirasi (or: AGENTS > Rules > Workflows)
3. Judge pipeline input'u context aware hale getir:
   - system prompt'a "cross-document conflict check" ekle
4. UI context ekleme paneli:
   - kullanici ek dosya girisi
   - basit satir bazli listeleme

Test:
- Coklu dosyada celiski bulgusu uretiliyor mu?
- Context yoksa eski davranis korunuyor mu?

Exit kriter:
- Project Context Mode acikken capraz celiski uyarisi uretebiliyor

---

## Faz 3 - Provider Dayaniklilik ve Seffaflik

Amac:
- Fallback davranisinin kullaniciya acik gosterilmesi
- Konfiglerin env uzerinden yonetilmesi

Degisecek dosyalar:
- `src/server/ai/judge-provider.ts`
- `src/server/services/judge-pipeline.ts`
- `.env.example`
- `src/components/score-display.tsx`
- `tests/integration/judge-pipeline.test.ts`

Adimlar:
1. Hardcoded retry/dealy sabitlerini env'e tasi:
   - `GEMINI_MAX_RETRIES`
   - `GEMINI_INITIAL_DELAY_MS`
   - `GEMINI_MODEL_CACHE_TTL_MS`
2. Typed fallback reason ekle:
   - `quota`
   - `timeout`
   - `provider_unavailable`
   - `invalid_output`
3. UI state genislet:
   - provider badge
   - fallback reason
   - confidence seviyesi

Test:
- Provider fail oldugunda reason code donuyor mu?
- UI warning metni tutarli mi?

Exit kriter:
- "Mock fallback oldu" bilgisi her durumda acikca gorunur

---

## Faz 4 - Streaming + Instant Lint UX

Amac:
- Kullaniciya bekleme degil ilerleme hissi vermek

Kapsam:
- Streaming response akisi
- Client-side pre-lint

Degisecek dosyalar:
- `src/trpc/react.tsx`
- `src/app/api/trpc/[trpc]/route.ts`
- `src/components/editor-workbench.tsx`
- `src/components/input-panel.tsx`
- `tests/e2e/analyze-flow.spec.ts`

Teknik secenekler:
1. Baslangic (onerilen):
   - Next.js route handler ile SSE stream
2. Sonraki asama:
   - tRPC streaming (`httpBatchStreamLink` + async iterable)

Adimlar:
1. Stream stage modeli tanimla:
   - sanitize
   - static analysis
   - semantic validation
   - provider call
   - finalize
2. UI progress component:
   - aktif stage
   - tamamlanan stage listesi
3. Instant lint:
   - editor degisince milisaniye seviyesinde warning

Test:
- Streaming eventleri sirali geliyor mu?
- Analyze butonuna bastiktan sonra ilk geri bildirim hizli mi?

Exit kriter:
- Kullanici 500ms civarinda ilk sinyali aliyor

---

## Faz 5 - Explainable Diff + Selective Apply

Amac:
- Degisikligi gerekcesiyle gostermek ve parcali kabul mekanizmasi sunmak

Degisecek dosyalar:
- `src/components/diff-viewer.tsx`
- `src/components/analysis-dashboard.tsx`
- `src/components/editor-workbench.tsx`
- `tests/e2e/diff-viewer.spec.ts`

Adimlar:
1. Hunk modeline rationale bagla:
   - her degisiklik parcasi ilgili checklist/missing item ile eslestirilir
2. Diff annotation UI:
   - tooltip/badge: "Neden"
3. Selective apply:
   - hunk sec
   - secili degisiklikleri apply et

Test:
- Hunk secimi dogru icerigi uygular mi?
- Tam apply davranisi bozulmadan korunuyor mu?

Exit kriter:
- Kullanici degisiklikleri tek tek kabul/red edebiliyor

---

## Faz 6 - MCP Server ve CLI

Amac:
- Araci IDE/agent akisina dogrudan baglamak

Uygulanan dosyalar:
- `src/mcp/core/create-server.ts`
- `src/mcp/server.ts`
- `src/mcp/stdio.ts`
- `src/mcp/http/server.ts`
- `src/mcp/http/session-store.ts`
- `src/mcp/http/auth.ts`
- `src/mcp/http/oauth-metadata.ts`
- `src/mcp/prompts/register-prompts.ts`
- `src/mcp/resources/register-resources.ts`
- `src/mcp/types.ts`
- `src/mcp/tools/analyze-artifact.ts`
- `src/mcp/tools/analyze-context-bundle.ts`
- `src/mcp/tools/quality-gate-artifact.ts`
- `src/mcp/tools/analyze-workspace-artifacts.ts`
- `src/mcp/tools/suggest-patch.ts`
- `src/mcp/tools/validate-export.ts`
- `src/mcp/tools/index.ts`
- `src/server/services/context-bundle.ts`
- `src/server/services/analyze-artifact-core.ts`
- `src/server/services/analyze-artifact-mcp-core.ts`
- `src/cli/index.ts`
- `tests/integration/mcp-stdio.test.ts`
- `tests/integration/mcp-http.test.ts`
- `tests/integration/mcp-auth.test.ts`
- `tests/integration/cli-smoke.test.ts`

Context7 referanslari:
- MCP SDK: `/modelcontextprotocol/typescript-sdk`

MCP tool set:
- `analyze_artifact`
- `analyze_context_bundle`
- `quality_gate_artifact`
- `suggest_patch`
- `validate_export`
- `analyze_workspace_artifacts` (local stdio)

Adimlar:
1. MCP server bootstrap (stdio) tamamlandi.
2. Tool wrapper'lari MCP deterministic servis katmanina baglandi.
3. Streamable HTTP endpoint + session store + health/readiness tamamlandi.
4. Bearer auth + scope enforcement + rate limit + timeout/concurrency/body guard tamamlandi.
5. CLI komutlari (`analyze`, `fix`, `score`) ortak tool katmanina baglandi.
6. Prompt/resource capability eklendi (`registerPrompt`, `registerResource`).
7. Auto-invoke convention icin policy-first server instructions ve tool aciklamalari guclendirildi.

Guvenlik:
- Varsayilan auth-required remote mod (`MCP_REQUIRE_AUTH=true`)
- Tool bazli scope enforcement (`analyze`, `validate`, `patch`)
- Session TTL cleanup + DNS rebinding protection (`createMcpExpressApp`)
- OAuth metadata endpointleri ile production auth migration yolu
- Remote modda workspace tarama varsayilan kapali; local stdio modunda acik

Test:
- MCP tool call contract testleri
- CLI smoke testleri
- Prompt ve resource list/read akislari

Exit kriter:
- IDE/agent tarafi local stdio ve remote streamable-http ile tool call edebiliyor
- CLI komutlari ortak business logic ile stabil calisiyor

---

## Faz 7 - Dynamic Template, URL Import, House Rules

Amac:
- Esnek kullanim ve kurum bazli policy destegi

Degisecek dosyalar:
- `src/components/editor-workbench.tsx`
- `src/server/api/routers/artifacts.ts`
- `src/server/db/schema.ts`

Planlanan yeni dosyalar:
- `src/server/services/template-registry.ts`
- `src/server/services/url-import.ts`
- `src/server/services/house-rules.ts`

Adimlar:
1. Hardcoded `starterTemplates` verisini registry'ye tasi
2. URL import (raw/gist) + sanitize + limit kontrol
3. House rules precedence model:
   - global
   - organization
   - workspace
   - artifact-local

Test:
- URL import ile gelen icerik guvenlikten geciyor mu?
- House rule celiskilerinde deterministic karar uretiliyor mu?

Exit kriter:
- Kullanici farkli stack/policy icin template ve kurallari dinamik yonetebiliyor

---

## Faz 8 - Refactor, CI Otomasyonu, Dokuman Senkronu

Amac:
- Kod bakimini kolaylastirmak ve kalite kapilarini otomatiklestirmek

Degisecek dosyalar:
- `src/server/services/artifact-analyzer.ts` (modullere bolunecek)
- `docs/check_control_list.md`
- CI konfigurasyonu (repo tercihine gore yeni dosya)

Adimlar:
1. Analyzer modulerlestirme:
   - `analyzers/common.ts`
   - `analyzers/skills.ts`
   - `analyzers/agents.ts`
   - `analyzers/rules.ts`
   - `analyzers/workflows.ts`
   - `analyzers/plans.ts`
2. Checklist otomasyon scripti
3. Dokuman refresh:
   - `docs/great_plan.md`
   - `docs/PRD.md`

Test:
- Unit ve integration testler refactor sonrasi geciyor
- Checklist script CI'da fail/passing durumlarini dogru yansitiyor

Exit kriter:
- Kod tabani moduler ve okunur
- Dokumanlar gercek urun durumunu yansitiyor

---

## Fazlar Arasi Bagimlilik Matrisi

- Faz 1, Faz 0 ciktisina bagimli
- Faz 2, Faz 1 ciktisina bagimli
- Faz 3, Faz 1 ile paralel baslayabilir ama Faz 2 bitmeden release edilmemeli
- Faz 4, Faz 1 ve Faz 3 sonrasinda en verimli
- Faz 5, Faz 4 sonrasinda
- Faz 6, Faz 2 + Faz 3 tamamlandiktan sonra
- Faz 7, Faz 2 temel modeli oturduktan sonra
- Faz 8, tum fazlar sonrasi veya paralel teknik borc sprinti

---

## Faz Sonu Standart Dogrulama Komutlari

Her faz sonunda minimum:

```bash
npm run lint
npm run test
npm run test:e2e
```

Not:
- E2E testleri pahali oldugunda, kritik akislari secerek parcali calistirilabilir.
- Ancak faz kapanisinda tam suite calismasi tavsiye edilir.
