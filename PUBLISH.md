# Agent Lint — npm Publish Rehberi

Bu doküman, `@agent-lint/mcp` ve `@agent-lint/cli` paketlerini npm'e ilk kez yayınlamak için gereken adımları sıralar.

## Ön Koşullar

- **Node.js** >= 18
- **pnpm** >= 9
- npm hesabı (https://www.npmjs.com/signup)

---

## Adım 1: npm Hesabı & Organizasyon

### 1.1 npm'e giriş yap

```bash
npm login
```

Tarayıcı açılır, npm hesabınla giriş yap. Doğrulama:

```bash
npm whoami
```

### 1.2 `@agent-lint` organizasyonunu oluştur

npm'de scoped public paketler yayınlamak için önce organizasyonu oluşturman gerekiyor:

1. https://www.npmjs.com/org/create adresine git
2. Organization name: `agent-lint`
3. Plan: **Free** (public paketler için yeterli)
4. Create

> **Not**: Eğer `agent-lint` scope'u alınmışsa, farklı bir isim seçebilirsin.
> Bu durumda tüm `package.json` dosyalarındaki `@agent-lint/` prefix'ini güncelle.

---

## Adım 2: Build & Test Doğrulaması

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run test
pnpm run lint
```

Tümü başarılı olmalı (exit code 0).

---

## Adım 3: Pack Kontrolü (dry-run)

Publish etmeden önce paketin içeriğini kontrol et:

```bash
cd packages/mcp && npm pack --dry-run && cd ../..
cd packages/cli && npm pack --dry-run && cd ../..
```

Kontrol listesi:
- [ ] `dist/` dizini dahil mi?
- [ ] `README.md` dahil mi?
- [ ] `LICENSE` dahil mi?
- [ ] `package.json` dahil mi?
- [ ] Gereksiz dosya yok mu? (`tests/`, `src/`, `.ts` dosyaları, vb.)
- [ ] Boyut makul mü? (MCP ~400 KB, CLI ~340 KB packed)

---

## Adım 4: İlk Publish

### 4.1 MCP paketi

```bash
cd packages/mcp
npm publish --access public
cd ../..
```

### 4.2 CLI paketi

```bash
cd packages/cli
npm publish --access public
cd ../..
```

> **Önemli**: Scoped paketler varsayılan olarak private yayınlanır.
> `--access public` flag'i ilk publish'te **zorunludur**.
> Sonraki versiyonlarda gerek yoktur (npm ayarı hatırlar).

---

## Adım 5: Yayın Doğrulaması

### npm sayfalarını kontrol et

- https://www.npmjs.com/package/@agent-lint/mcp
- https://www.npmjs.com/package/@agent-lint/cli

### Kurulum testi (temiz bir dizinde)

```bash
mkdir /tmp/test-agentlint && cd /tmp/test-agentlint

# CLI test
npx @agent-lint/cli --help
echo "# My AGENTS.md" > AGENTS.md
npx @agent-lint/cli analyze AGENTS.md --type agents
npx @agent-lint/cli score AGENTS.md --type agents

# MCP test
npx -y @agent-lint/mcp --help
```

---

## Adım 6: Git Tag & Push

```bash
git add -A
git commit -m "chore(publish): prepare v0.1.0 release"
git tag v0.1.0
git push origin main --tags
```

Tag push, GitLab CI pipeline'ını tetikler (`.gitlab-ci.yml`).
Sonraki sürümlerde tag-based CI publish otomatik çalışacaktır.

---

## Sonraki Sürümler

### Versiyon güncelleme

```bash
# Tüm publish edilecek paketlerin versiyonunu güncelle
cd packages/mcp && npm version patch && cd ../..
cd packages/cli && npm version patch && cd ../..

# veya minor/major:
# npm version minor
# npm version major
```

### Changeset ile (opsiyonel)

Proje zaten changeset altyapısına sahip:

```bash
npx changeset           # Değişiklik kaydı oluştur
npx changeset version   # Versiyonları güncelle
npx changeset publish   # Publish et
```

### Tag-based CI publish

GitLab CI'da `NPM_TOKEN` secret'ı ayarlandıysa:

1. **GitLab** → Settings → CI/CD → Variables
2. Key: `NPM_TOKEN`, Value: npm access token
3. Protected: Yes, Masked: Yes

Sonra:

```bash
git tag v0.1.1
git push origin --tags
```

CI otomatik build + test + publish yapar.

---

## npm Access Token Oluşturma

1. https://www.npmjs.com/settings/~/tokens adresine git
2. **Generate New Token** → **Granular Access Token**
3. Token name: `agentlint-ci`
4. Expiration: 365 gün
5. Packages: `@agent-lint/*` — Read and write
6. Generate

Bu token'ı GitLab CI/CD variables'a `NPM_TOKEN` olarak ekle.

---

## Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| `E403 Forbidden` | npm login yap, org üyeliğini kontrol et |
| `E404 Not Found` | `@agent-lint` org'u oluşturuldu mu? |
| `ENEEDAUTH` | `npm login` çalıştır |
| `E402 Payment Required` | `--access public` flag'i ekle (scoped paketler default private) |
| Pack'te gereksiz dosya var | `package.json` → `"files"` alanını kontrol et |
