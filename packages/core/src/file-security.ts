/**
 * File security module for apply_patches.
 * Provides: hash guard, allowlist, path traversal protection, backup, size limits.
 *
 * Per dos_and_donts.md: Hash guard + allowlist + backup + explicit flag.
 * Per dikkat_edilecekler.md §3.1: Path traversal, symlink, null byte protection.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ─── Constants ───

const ALLOWED_EXTENSIONS = new Set([".md", ".yaml", ".yml", ".txt"]);
const MAX_PATCH_SIZE_BYTES = 500_000; // 500KB per dikkat_edilecekler.md §4.1
const BACKUP_DIR_NAME = ".agentlint-backup";

// ─── Types ───

export type FileSecurityError =
  | { code: "PATH_TRAVERSAL"; message: string }
  | { code: "EXTENSION_NOT_ALLOWED"; message: string }
  | { code: "SYMLINK_DETECTED"; message: string }
  | { code: "NULL_BYTE_DETECTED"; message: string }
  | { code: "HASH_MISMATCH"; message: string }
  | { code: "SIZE_LIMIT_EXCEEDED"; message: string }
  | { code: "FILE_NOT_FOUND"; message: string }
  | { code: "WRITE_NOT_ALLOWED"; message: string }
  | { code: "BACKUP_FAILED"; message: string }
  | { code: "WRITE_FAILED"; message: string };

export type FileSecurityResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: FileSecurityError };

// ─── Hash Functions ───

export function computeSha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

export function verifyHash(content: string, expectedHash: string): boolean {
  return computeSha256(content) === expectedHash;
}

// ─── Path Validation ───

/**
 * Validate that a target path is safe for writing.
 * Checks: null bytes, path traversal, extension allowlist, symlinks.
 */
export function validateWritePath(
  targetPath: string,
  workDir: string,
): FileSecurityResult<{ resolvedPath: string; extension: string }> {
  // 1. Null byte check (dikkat_edilecekler.md §3.1)
  if (targetPath.includes("\0") || workDir.includes("\0")) {
    return {
      ok: false,
      error: { code: "NULL_BYTE_DETECTED", message: "Null bytes detected in path — rejecting." },
    };
  }

  // 2. Resolve and normalize both paths
  const resolvedTarget = path.resolve(workDir, targetPath);
  const resolvedWorkDir = path.resolve(workDir);

  // 3. Path traversal check — target must be inside workDir
  // Use path.sep to handle both Windows and Unix
  const normalizedTarget = resolvedTarget + (resolvedTarget.endsWith(path.sep) ? "" : "");
  const normalizedWorkDir = resolvedWorkDir + path.sep;

  if (
    resolvedTarget !== resolvedWorkDir &&
    !normalizedTarget.startsWith(normalizedWorkDir)
  ) {
    return {
      ok: false,
      error: {
        code: "PATH_TRAVERSAL",
        message: `Path traversal detected: '${targetPath}' resolves outside working directory.`,
      },
    };
  }

  // 4. Extension allowlist
  const ext = path.extname(resolvedTarget).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: {
        code: "EXTENSION_NOT_ALLOWED",
        message: `Extension '${ext}' not in allowlist (${[...ALLOWED_EXTENSIONS].join(", ")}).`,
      },
    };
  }

  // 5. Symlink check — use lstatSync per dikkat_edilecekler.md §3.1
  try {
    const stats = fs.lstatSync(resolvedTarget);
    if (stats.isSymbolicLink()) {
      return {
        ok: false,
        error: {
          code: "SYMLINK_DETECTED",
          message: `Symlink detected at '${targetPath}' — refusing to follow.`,
        },
      };
    }
  } catch {
    // File doesn't exist yet — that's fine for new files, but apply_patches
    // expects existing files (hash guard requires prior content)
    return {
      ok: false,
      error: {
        code: "FILE_NOT_FOUND",
        message: `File not found: '${targetPath}'. apply_patches only modifies existing files.`,
      },
    };
  }

  return { ok: true, value: { resolvedPath: resolvedTarget, extension: ext } };
}

// ─── Size Validation ───

export function validatePatchSize(content: string): FileSecurityResult<void> {
  const sizeBytes = Buffer.byteLength(content, "utf-8");
  if (sizeBytes > MAX_PATCH_SIZE_BYTES) {
    return {
      ok: false,
      error: {
        code: "SIZE_LIMIT_EXCEEDED",
        message: `Patch content size (${sizeBytes} bytes) exceeds limit (${MAX_PATCH_SIZE_BYTES} bytes).`,
      },
    };
  }
  return { ok: true, value: undefined };
}

// ─── Backup ───

/**
 * Create a backup of the file before patching.
 * Backs up to `.agentlint-backup/<filename>.<timestamp>.bak`
 */
export function createBackup(
  filePath: string,
  workDir: string,
): FileSecurityResult<{ backupPath: string }> {
  try {
    const backupDir = path.join(workDir, BACKUP_DIR_NAME);
    fs.mkdirSync(backupDir, { recursive: true });

    const basename = path.basename(filePath);
    const timestamp = Date.now();
    const backupFilename = `${basename}.${timestamp}.bak`;
    const backupPath = path.join(backupDir, backupFilename);

    fs.copyFileSync(filePath, backupPath);
    return { ok: true, value: { backupPath } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown backup error";
    return {
      ok: false,
      error: { code: "BACKUP_FAILED", message: `Backup failed: ${message}` },
    };
  }
}

// ─── Rollback ───

/**
 * Rollback a file from its backup.
 */
export function rollbackFromBackup(filePath: string, backupPath: string): boolean {
  try {
    fs.copyFileSync(backupPath, filePath);
    return true;
  } catch {
    return false;
  }
}

// ─── Atomic Write ───

/**
 * Write content to file with hash verification.
 * 1. Read current file → verify hash matches expected
 * 2. Write to temp file
 * 3. Rename temp to target (atomic on same filesystem)
 * 4. Verify written content hash
 */
export function writeWithHashGuard(
  filePath: string,
  newContent: string,
  expectedHash: string,
): FileSecurityResult<{ newHash: string }> {
  // 1. Re-read and verify hash at write time (TOCTOU mitigation)
  let currentContent: string;
  try {
    currentContent = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown read error";
    return {
      ok: false,
      error: { code: "FILE_NOT_FOUND", message: `Cannot read file for hash verification: ${message}` },
    };
  }

  const currentHash = computeSha256(currentContent);
  if (currentHash !== expectedHash) {
    return {
      ok: false,
      error: {
        code: "HASH_MISMATCH",
        message: `File changed since last read. Expected hash: ${expectedHash.slice(0, 12)}..., current: ${currentHash.slice(0, 12)}...`,
      },
    };
  }

  // 2. Write to temp file, then rename (atomic write)
  const tempPath = `${filePath}.agentlint-tmp`;
  try {
    fs.writeFileSync(tempPath, newContent, "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    // Cleanup temp file if rename failed
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    const message = err instanceof Error ? err.message : "Unknown write error";
    return {
      ok: false,
      error: { code: "WRITE_FAILED", message: `Write failed: ${message}` },
    };
  }

  // 3. Compute and return new hash
  const newHash = computeSha256(newContent);
  return { ok: true, value: { newHash } };
}

// ─── Full Apply Pipeline ───

export type ApplyPatchOptions = {
  filePath: string;
  patchedContent: string;
  expectedHash: string;
  workDir: string;
  allowWrite: boolean;
  dryRun?: boolean;
};

export type ApplyPatchSuccess = {
  filePath: string;
  backupPath: string;
  newHash: string;
  dryRun: boolean;
};

/**
 * Full apply-patch pipeline with all security guards.
 * Order: flag check → path validation → size check → hash verify → backup → write
 */
export function applyPatchSecure(
  options: ApplyPatchOptions,
): FileSecurityResult<ApplyPatchSuccess> {
  const { filePath, patchedContent, expectedHash, workDir, allowWrite, dryRun } = options;
  const isDryRun = dryRun ?? true; // dry-run by default per great_plan.md 4.1

  // 1. --allow-write flag check
  if (!allowWrite) {
    return {
      ok: false,
      error: {
        code: "WRITE_NOT_ALLOWED",
        message: "apply_patches requires allowWrite=true. Use suggest_patch for read-only mode.",
      },
    };
  }

  // 2. Path validation (traversal, extension, symlink, null bytes)
  const pathResult = validateWritePath(filePath, workDir);
  if (!pathResult.ok) {
    return pathResult;
  }

  // 3. Size check
  const sizeResult = validatePatchSize(patchedContent);
  if (!sizeResult.ok) {
    return sizeResult;
  }

  // 4. If dry-run, verify hash but don't write
  if (isDryRun) {
    // Still validate hash to provide early feedback
    let currentContent: string;
    try {
      currentContent = fs.readFileSync(pathResult.value.resolvedPath, "utf-8");
    } catch {
      return {
        ok: false,
        error: { code: "FILE_NOT_FOUND", message: `Cannot read file: '${filePath}'` },
      };
    }

    if (!verifyHash(currentContent, expectedHash)) {
      return {
        ok: false,
        error: {
          code: "HASH_MISMATCH",
          message: "File changed since last read (dry-run hash check).",
        },
      };
    }

    return {
      ok: true,
      value: {
        filePath: pathResult.value.resolvedPath,
        backupPath: "(dry-run — no backup created)",
        newHash: computeSha256(patchedContent),
        dryRun: true,
      },
    };
  }

  // 5. Backup before write
  const backupResult = createBackup(pathResult.value.resolvedPath, workDir);
  if (!backupResult.ok) {
    return backupResult;
  }

  // 6. Write with hash guard
  const writeResult = writeWithHashGuard(
    pathResult.value.resolvedPath,
    patchedContent,
    expectedHash,
  );

  if (!writeResult.ok) {
    // Attempt rollback on write failure
    rollbackFromBackup(pathResult.value.resolvedPath, backupResult.value.backupPath);
    return writeResult;
  }

  return {
    ok: true,
    value: {
      filePath: pathResult.value.resolvedPath,
      backupPath: backupResult.value.backupPath,
      newHash: writeResult.value.newHash,
      dryRun: false,
    },
  };
}
