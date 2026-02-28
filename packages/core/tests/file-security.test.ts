import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  computeSha256,
  verifyHash,
  validateWritePath,
  validatePatchSize,
  createBackup,
  rollbackFromBackup,
  writeWithHashGuard,
  applyPatchSecure,
} from "@agent-lint/core";

// ─── Helpers ───

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agentlint-test-"));
}

function writeTestFile(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors on Windows
  }
}

// ─── Tests ───

describe("computeSha256", () => {
  it("returns a 64-char hex string", () => {
    const hash = computeSha256("hello world");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces deterministic output", () => {
    const a = computeSha256("test content");
    const b = computeSha256("test content");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", () => {
    const a = computeSha256("content A");
    const b = computeSha256("content B");
    expect(a).not.toBe(b);
  });

  it("handles empty string", () => {
    const hash = computeSha256("");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("handles unicode content", () => {
    const hash = computeSha256("Türkçe içerik 🚀");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("verifyHash", () => {
  it("returns true for matching content and hash", () => {
    const content = "test content";
    const hash = computeSha256(content);
    expect(verifyHash(content, hash)).toBe(true);
  });

  it("returns false for mismatched content", () => {
    const hash = computeSha256("original");
    expect(verifyHash("tampered", hash)).toBe(false);
  });

  it("returns false for invalid hash format", () => {
    expect(verifyHash("content", "not-a-hash")).toBe(false);
  });
});

describe("validateWritePath", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("accepts valid .md file inside workDir", () => {
    writeTestFile(tmpDir, "test.md", "content");
    const result = validateWritePath("test.md", tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.extension).toBe(".md");
    }
  });

  it("accepts valid .yaml file inside workDir", () => {
    writeTestFile(tmpDir, "config.yaml", "key: value");
    const result = validateWritePath("config.yaml", tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.extension).toBe(".yaml");
    }
  });

  it("accepts valid .yml file inside workDir", () => {
    writeTestFile(tmpDir, "config.yml", "key: value");
    const result = validateWritePath("config.yml", tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.extension).toBe(".yml");
    }
  });

  it("accepts valid .txt file inside workDir", () => {
    writeTestFile(tmpDir, "notes.txt", "some notes");
    const result = validateWritePath("notes.txt", tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.extension).toBe(".txt");
    }
  });

  // ─── Null byte rejection ───

  it("rejects null bytes in target path", () => {
    const result = validateWritePath("file\0.md", tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NULL_BYTE_DETECTED");
    }
  });

  it("rejects null bytes in workDir", () => {
    const result = validateWritePath("file.md", "/tmp\0/evil");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NULL_BYTE_DETECTED");
    }
  });

  // ─── Path traversal rejection ───

  it("rejects path traversal with ../", () => {
    writeTestFile(tmpDir, "legit.md", "content");
    const result = validateWritePath("../../../etc/passwd.md", tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PATH_TRAVERSAL");
    }
  });

  it("rejects path traversal with ..\\", () => {
    const result = validateWritePath("..\\..\\Windows\\System32\\evil.md", tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Either PATH_TRAVERSAL or FILE_NOT_FOUND (on non-Windows OS)
      expect(["PATH_TRAVERSAL", "FILE_NOT_FOUND"]).toContain(result.error.code);
    }
  });

  // ─── Extension allowlist ───

  it("rejects .js extension", () => {
    writeTestFile(tmpDir, "evil.js", "code");
    const result = validateWritePath("evil.js", tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXTENSION_NOT_ALLOWED");
    }
  });

  it("rejects .ts extension", () => {
    writeTestFile(tmpDir, "evil.ts", "code");
    const result = validateWritePath("evil.ts", tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXTENSION_NOT_ALLOWED");
    }
  });

  it("rejects .exe extension", () => {
    writeTestFile(tmpDir, "payload.exe", "binary");
    const result = validateWritePath("payload.exe", tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXTENSION_NOT_ALLOWED");
    }
  });

  it("rejects .sh extension", () => {
    writeTestFile(tmpDir, "script.sh", "#!/bin/bash");
    const result = validateWritePath("script.sh", tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXTENSION_NOT_ALLOWED");
    }
  });

  it("rejects no extension", () => {
    writeTestFile(tmpDir, "Makefile", "all:");
    const result = validateWritePath("Makefile", tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXTENSION_NOT_ALLOWED");
    }
  });

  // ─── Symlink detection ───

  it("rejects symlinks", () => {
    const realFile = writeTestFile(tmpDir, "real.md", "content");
    const linkPath = path.join(tmpDir, "link.md");
    try {
      fs.symlinkSync(realFile, linkPath);
    } catch {
      // Symlink creation may fail on Windows without admin privs — skip
      return;
    }
    const result = validateWritePath("link.md", tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SYMLINK_DETECTED");
    }
  });

  // ─── File not found ───

  it("rejects non-existent file", () => {
    const result = validateWritePath("nonexistent.md", tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FILE_NOT_FOUND");
    }
  });
});

describe("validatePatchSize", () => {
  it("accepts content within size limit", () => {
    const content = "a".repeat(1000);
    const result = validatePatchSize(content);
    expect(result.ok).toBe(true);
  });

  it("accepts content at exactly 500KB", () => {
    // 500,000 ASCII bytes = exactly at limit
    const content = "x".repeat(500_000);
    const result = validatePatchSize(content);
    expect(result.ok).toBe(true);
  });

  it("rejects content exceeding 500KB", () => {
    const content = "x".repeat(500_001);
    const result = validatePatchSize(content);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SIZE_LIMIT_EXCEEDED");
    }
  });

  it("counts multi-byte characters correctly", () => {
    // Each emoji is 4 bytes in UTF-8; 125,001 emojis = 500,004 bytes > 500KB
    const content = "🔥".repeat(125_001);
    const result = validatePatchSize(content);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SIZE_LIMIT_EXCEEDED");
    }
  });
});

describe("createBackup", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("creates a backup of existing file", () => {
    const filePath = writeTestFile(tmpDir, "test.md", "original content");
    const result = createBackup(filePath, tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(fs.existsSync(result.value.backupPath)).toBe(true);
      const backupContent = fs.readFileSync(result.value.backupPath, "utf-8");
      expect(backupContent).toBe("original content");
    }
  });

  it("creates backup directory if it doesn't exist", () => {
    const filePath = writeTestFile(tmpDir, "test.md", "content");
    const backupDir = path.join(tmpDir, ".agentlint-backup");
    expect(fs.existsSync(backupDir)).toBe(false);

    const result = createBackup(filePath, tmpDir);
    expect(result.ok).toBe(true);
    expect(fs.existsSync(backupDir)).toBe(true);
  });

  it("backup filename includes timestamp", () => {
    const filePath = writeTestFile(tmpDir, "notes.md", "content");
    const result = createBackup(filePath, tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const basename = path.basename(result.value.backupPath);
      expect(basename).toMatch(/^notes\.md\.\d+\.bak$/);
    }
  });

  it("fails for non-existent source file", () => {
    const fakePath = path.join(tmpDir, "nonexistent.md");
    const result = createBackup(fakePath, tmpDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BACKUP_FAILED");
    }
  });
});

describe("rollbackFromBackup", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("restores file from backup", () => {
    const filePath = writeTestFile(tmpDir, "test.md", "original");
    const backupPath = writeTestFile(tmpDir, "test.md.backup.bak", "original");
    fs.writeFileSync(filePath, "corrupted", "utf-8");

    const success = rollbackFromBackup(filePath, backupPath);
    expect(success).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("original");
  });

  it("returns false if backup file doesn't exist", () => {
    const filePath = writeTestFile(tmpDir, "test.md", "content");
    const success = rollbackFromBackup(filePath, "/nonexistent/backup.bak");
    expect(success).toBe(false);
  });
});

describe("writeWithHashGuard", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("writes when hash matches", () => {
    const original = "original content";
    const filePath = writeTestFile(tmpDir, "test.md", original);
    const expectedHash = computeSha256(original);
    const newContent = "updated content";

    const result = writeWithHashGuard(filePath, newContent, expectedHash);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newHash).toBe(computeSha256(newContent));
    }
    expect(fs.readFileSync(filePath, "utf-8")).toBe(newContent);
  });

  it("rejects write when hash mismatches", () => {
    const filePath = writeTestFile(tmpDir, "test.md", "current content");
    const wrongHash = computeSha256("different content");
    const newContent = "attack content";

    const result = writeWithHashGuard(filePath, newContent, wrongHash);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("HASH_MISMATCH");
    }
    // File should not have been modified
    expect(fs.readFileSync(filePath, "utf-8")).toBe("current content");
  });

  it("fails for non-existent file", () => {
    const result = writeWithHashGuard(
      path.join(tmpDir, "missing.md"),
      "content",
      "somehash",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FILE_NOT_FOUND");
    }
  });
});

describe("applyPatchSecure", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("rejects when allowWrite is false", () => {
    const filePath = writeTestFile(tmpDir, "test.md", "content");
    const result = applyPatchSecure({
      filePath: "test.md",
      patchedContent: "new content",
      expectedHash: computeSha256("content"),
      workDir: tmpDir,
      allowWrite: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("WRITE_NOT_ALLOWED");
    }
  });

  it("defaults to dry-run mode", () => {
    const original = "original content";
    const filePath = writeTestFile(tmpDir, "test.md", original);
    const hash = computeSha256(original);

    const result = applyPatchSecure({
      filePath: "test.md",
      patchedContent: "patched content",
      expectedHash: hash,
      workDir: tmpDir,
      allowWrite: true,
      // dryRun not specified — should default to true
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dryRun).toBe(true);
      expect(result.value.backupPath).toContain("dry-run");
    }
    // File should NOT have been modified
    expect(fs.readFileSync(filePath, "utf-8")).toBe(original);
  });

  it("dry-run still validates hash", () => {
    writeTestFile(tmpDir, "test.md", "original content");
    const wrongHash = computeSha256("different content");

    const result = applyPatchSecure({
      filePath: "test.md",
      patchedContent: "patched content",
      expectedHash: wrongHash,
      workDir: tmpDir,
      allowWrite: true,
      dryRun: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("HASH_MISMATCH");
    }
  });

  it("dry-run returns newHash of patched content", () => {
    const original = "original content";
    writeTestFile(tmpDir, "test.md", original);
    const hash = computeSha256(original);
    const patched = "patched content";

    const result = applyPatchSecure({
      filePath: "test.md",
      patchedContent: patched,
      expectedHash: hash,
      workDir: tmpDir,
      allowWrite: true,
      dryRun: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newHash).toBe(computeSha256(patched));
    }
  });

  it("real write creates backup and writes file", () => {
    const original = "# Original\nSome content.";
    const filePath = writeTestFile(tmpDir, "test.md", original);
    const hash = computeSha256(original);
    const patched = "# Updated\nNew content.";

    const result = applyPatchSecure({
      filePath: "test.md",
      patchedContent: patched,
      expectedHash: hash,
      workDir: tmpDir,
      allowWrite: true,
      dryRun: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dryRun).toBe(false);
      expect(result.value.newHash).toBe(computeSha256(patched));
      // Backup should exist
      expect(fs.existsSync(result.value.backupPath)).toBe(true);
      const backup = fs.readFileSync(result.value.backupPath, "utf-8");
      expect(backup).toBe(original);
    }
    // File should be updated
    expect(fs.readFileSync(filePath, "utf-8")).toBe(patched);
  });

  it("rejects path traversal in real write", () => {
    writeTestFile(tmpDir, "legit.md", "content");
    const result = applyPatchSecure({
      filePath: "../../../etc/passwd.md",
      patchedContent: "evil content",
      expectedHash: "somehash",
      workDir: tmpDir,
      allowWrite: true,
      dryRun: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PATH_TRAVERSAL");
    }
  });

  it("rejects disallowed extensions in real write", () => {
    writeTestFile(tmpDir, "evil.js", "code");
    const result = applyPatchSecure({
      filePath: "evil.js",
      patchedContent: "evil code",
      expectedHash: "somehash",
      workDir: tmpDir,
      allowWrite: true,
      dryRun: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXTENSION_NOT_ALLOWED");
    }
  });

  it("rejects oversized patches", () => {
    const original = "small file";
    writeTestFile(tmpDir, "test.md", original);
    const hash = computeSha256(original);

    const result = applyPatchSecure({
      filePath: "test.md",
      patchedContent: "x".repeat(500_001),
      expectedHash: hash,
      workDir: tmpDir,
      allowWrite: true,
      dryRun: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SIZE_LIMIT_EXCEEDED");
    }
  });

  it("rejects hash mismatch in real write (TOCTOU protection)", () => {
    const original = "original content";
    writeTestFile(tmpDir, "test.md", original);
    const wrongHash = computeSha256("stale content");

    const result = applyPatchSecure({
      filePath: "test.md",
      patchedContent: "patched",
      expectedHash: wrongHash,
      workDir: tmpDir,
      allowWrite: true,
      dryRun: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("HASH_MISMATCH");
    }
    // File should NOT have been modified
    expect(fs.readFileSync(path.join(tmpDir, "test.md"), "utf-8")).toBe(original);
  });

  it("handles subdirectory paths correctly", () => {
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(subDir);
    const original = "nested content";
    writeTestFile(subDir, "nested.md", original);
    const hash = computeSha256(original);

    const result = applyPatchSecure({
      filePath: "sub/nested.md",
      patchedContent: "updated nested",
      expectedHash: hash,
      workDir: tmpDir,
      allowWrite: true,
      dryRun: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dryRun).toBe(false);
    }
    expect(fs.readFileSync(path.join(subDir, "nested.md"), "utf-8")).toBe("updated nested");
  });
});
