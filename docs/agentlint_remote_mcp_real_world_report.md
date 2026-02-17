# Agentlint-Remote MCP: Gercek Dunyada AI Coding Asistanlari ile Kullanim Raporu

Bu rapor, yazilim gelistiricilerin agentik coding akislarinda `agentlint-remote` MCP'yi nasil kullanabilecegini, hangi tool/prompt/resource kombinasyonunun hangi durumda tetiklenecegini ve bunun urun kalitesine nasil yansidigini gosterir.

## TL;DR

- `agentlint-remote`, AI coding asistanlarini "hizli ama kontrolsuz" moddan alip "hizli + kanitli + guvenli" moda tasir.
- En kritik deger: artifact kalitesini (AGENTS, skills, rules, workflows, plans) olculebilir hale getirir.
- En iyi kullanim deseni: `prepare_artifact_fix_context -> resources -> submit_client_assessment -> quality_gate_artifact -> validate_export`.
- Gercek test kaniti var: MCP HTTP + auth + stdio entegrasyon senaryolari gecti.

## Neden Simdi Onemli?

AI coding asistanlari kodu hizlandiriyor, ama su problemleri buyutuyor:

- Tutarsiz ekip kurallari (her agent farkli standartta yazar)
- Prompt/plan dosyalarinda quality drift
- "Calisti ama guvenli mi?" sorusu
- Export edilen markdown/yaml iceriginde riskli icerik

`agentlint-remote` MCP bu acigi kapatir: kaliteyi metrik + evidence + guardrail ile surekli denetler.

## Test Edildi mi? Evet.

Asagidaki komut canli calistirildi:

```bash
npm run test -- tests/integration/mcp-http.test.ts tests/integration/mcp-auth.test.ts tests/integration/mcp-stdio.test.ts
```

Sonuc:

- `3` test dosyasi gecti
- `13` test senaryosu gecti
- Kapsam: authenticated HTTP flow, stateless/stateful davranis, scope enforcement, malformed payload, unknown session, oauth metadata, stdio tool zinciri

## Agentik Akis: Kime Ne Saglar?

### 1) Solo developer (Cursor/Windsurf/VS Code)

- Hedef: Kendi repo kurallarini bozmadan hizli artifact uretmek
- Kazanc: Prompt kalitesi ve guvenlik kontrolleri tek akista

### 2) Platform/Enablement team

- Hedef: Organizasyon genelinde standard AGENTS/rules/workflow kalite kapisi
- Kazanc: "Policy as code" benzeri artifact governance

### 3) Consulting/agency ekipleri

- Hedef: Her musteri reposunda ayni kalite seviyesini tekrar etmek
- Kazanc: Reusable quality gate pipeline

## Hangi Tool, Hangi Prompt, Hangi Resource?

## Tool zinciri (oneri)

1. `prepare_artifact_fix_context`
2. `submit_client_assessment`
3. `quality_gate_artifact`
4. `validate_export`

Destekleyici/advisory:

- `analyze_artifact`
- `analyze_context_bundle`
- `suggest_patch`
- `analyze_workspace_artifacts` (ozellikle local/stdio tarafinda)

## Prompt tetikleyiciler

- `artifact_create_prompt`: sifirdan artifact olusturma
- `artifact_review_prompt`: mevcut artifact denetimi
- `artifact_fix_prompt`: dusuk skorlu artifact iyilestirme

## Resource tetikleyiciler

- `agentlint://quality-metrics/<type>`
- `agentlint://prompt-pack/<type>`
- `agentlint://prompt-template/<type>`
- `agentlint://artifact-path-hints/<type>`
- `agentlint://artifact-spec/<type>`
- `agentlint://scoring-policy/<type>`
- `agentlint://assessment-schema/<type>`
- `agentlint://improvement-playbook/<type>`

## Pratik Trigger Haritasi

| Kullanici niyeti | Prompt | Tool zinciri | Resource seti |
|---|---|---|---|
| "AGENTS dosyamizi sifirdan yaz" | `artifact_create_prompt` | `prepare_artifact_fix_context -> submit_client_assessment -> quality_gate_artifact -> validate_export` | quality-metrics, artifact-spec, scoring-policy, assessment-schema |
| "Bu rules dosyasini review et" | `artifact_review_prompt` | `prepare_artifact_fix_context -> submit_client_assessment -> quality_gate_artifact` | scoring-policy, assessment-schema, artifact-path-hints |
| "Bu workflow'u duzelt, score 90 ustu olsun" | `artifact_fix_prompt` | `prepare_artifact_fix_context -> submit_client_assessment -> quality_gate_artifact (+suggest_patch) -> validate_export` | improvement-playbook, scoring-policy, assessment-schema |
| "Repo genelinde hangi artifactler sorunlu?" | yok (dogrudan tool) | `analyze_workspace_artifacts -> analyze_artifact/analyze_context_bundle` | artifact-path-hints, quality-metrics |

## Gercekci Kullanici Prompt Ornekleri

## Senaryo A: Team AGENTS standardizasyonu

Kullanici promptu:

```text
Monorepo icin AGENTS.md olustur. Guvenlikte force push ve destructive komutlar icin net gate olsun.
Skor hedefi 92+ olsun. Eksik bolum birakma.
```

Asistanin MCP davranisi:

- `artifact_create_prompt(type=agents)`
- `prepare_artifact_fix_context(type=agents)`
- `readResource(scoring-policy/agents, assessment-schema/agents, artifact-spec/agents)`
- client evidence topla + `submit_client_assessment`
- `quality_gate_artifact(candidateContent + clientAssessment)`
- `validate_export`

Kullanici faydasi:

- Ilk cikti yerine "olculmus ve gate'ten gecmis" cikti alir.

## Senaryo B: Incident sonrasi rules hardening

Kullanici promptu:

```text
Son incidentten sonra deploy ve rollback kurallarini sertlestir.
Rules dokumanini revise et, gereksiz verbosity olmasin.
```

Asistanin MCP davranisi:

- `artifact_fix_prompt(type=rules, originalContent, warnings?)`
- `prepare_artifact_fix_context(type=rules)`
- `readResource(improvement-playbook/rules, scoring-policy/rules)`
- `submit_client_assessment`
- `quality_gate_artifact` (gerekirse `suggest_patch` ile secmeli merge)
- `validate_export`

Kullanici faydasi:

- "Yama" degil, izlenebilir ve puanli iyilestirme alir.

## Senaryo C: CI onboarding playbook

Kullanici promptu:

```text
Yeni ekip uyeleri icin workflow dokumani olustur.
PR acmadan once test/lint/build adimlarini zorunlu hale getir.
```

Asistanin MCP davranisi:

- `artifact_create_prompt(type=workflows)`
- `prepare_artifact_fix_context(type=workflows)`
- `readResource(artifact-spec/workflows, prompt-pack/workflows)`
- `submit_client_assessment`
- `quality_gate_artifact`
- `validate_export`

Kullanici faydasi:

- Team onboarding daha hizli, kalite daha tutarli.

## Teknik Operasyon Rehberi (Remote)

- HTTP endpoint: `https://<domain>/mcp`
- Auth: `Authorization: Bearer <token>`
- Scope onerisi:
  - `analyze`
  - `validate`
  - `patch`
- Session problemi yasayan istemciler icin stateless uyumluluk:
  - `MCP_HTTP_STATELESS=true`

Onemli:

- `quality_gate_artifact` default olarak `clientAssessment` ister.
- `analyze_workspace_artifacts` remote tarafta default kapali olabilir; local/stdio veya istemci tarafi dosya iletimi kullanin.

## Neden Gelistirici Icin Cekici?

- "Sadece output" degil, "neden bu skor" seffafligi verir.
- Agent ciktisini policy + evidence ile aciklar.
- Team standardini kisilere degil sisteme baglar.
- Mevcut coding asistanlarina eklenebilir; yeni editor zorunlulugu yok.

## Pazarlama Mesaji (Kisa Versiyon)

`agentlint-remote` MCP, AI coding asistaninizi sadece hizli degil, guvenilir ve olculebilir hale getirir.
Artifact kalitesi artik sans degil; metrik, kanit ve quality gate ile yonetilen bir surece donusur.

## Sonuc

Gercek dunya agentik gelistirme senaryolarinda `agentlint-remote`:

- kalite standardini sabitler,
- guvenlik ve export risklerini azaltir,
- ekipler arasi tutarliligi artirir,
- AI yardimli yazilim gelistirmeyi production'a daha yakin hale getirir.

Bu nedenle konumlandirma net: `agentlint-remote` bir "prompt aksesuari" degil, bir "AI kalite katmani"dir.
