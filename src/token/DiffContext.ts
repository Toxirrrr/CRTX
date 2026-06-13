/**
 * DiffContext — extracts only the relevant lines from a file.
 *
 * Fallback rule: if the extracted slice is > 30% of the full file,
 * return the whole file instead — otherwise the model loses context.
 *
 * Evidence format: "path/to/file.ts:23-44"
 */

import * as fs from 'fs';
import fsp from 'node:fs/promises';
import * as path from 'path';

export interface FileSlice {
  filePath: string;
  fromLine: number;
  toLine: number;
  content: string;
  totalLines: number;
  tokenEstimate: number; // rough: chars / 4
  usedFullFile: boolean; // true if fallback triggered
}

/** Threshold: if slice >= this fraction of file, return whole file. */
const FULL_FILE_THRESHOLD = 0.30;

export class DiffContext {
  /**
   * Extract a slice of a file by line range.
   * Adds context padding (±padLines) around the specified range.
   *
   * If the slice would cover > 30% of the file, returns the full file.
   */
  static async extractSlice(
    absolutePath: string,
    fromLine: number,
    toLine: number,
    padLines = 3,
  ): Promise<FileSlice | null> {
    try {
      const raw   = await fsp.readFile(absolutePath, 'utf8');
      const lines = raw.split('\n');
      const total = lines.length;

      const start = Math.max(0, fromLine - 1 - padLines);
      const end   = Math.min(total, toLine + padLines);
      const sliceSize = end - start;

      // Fallback: slice is too large, use full file for model context
      const usedFullFile = sliceSize / total >= FULL_FILE_THRESHOLD;

      let content: string;
      let actualFrom: number;
      let actualTo: number;

      if (usedFullFile) {
        content    = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
        actualFrom = 1;
        actualTo   = total;
      } else {
        content    = lines.slice(start, end).map((line, i) => `${start + i + 1}: ${line}`).join('\n');
        actualFrom = start + 1;
        actualTo   = end;
      }

      return {
        filePath: absolutePath,
        fromLine: actualFrom,
        toLine:   actualTo,
        content,
        totalLines: total,
        tokenEstimate: Math.ceil(content.length / 4),
        usedFullFile,
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract slices from evidence entries.
   * Evidence format: "path/to/file.ts:23-44" or "path/to/file.ts:23"
   */
  static async fromEvidence(evidence: string[], projectRoot: string): Promise<FileSlice[]> {
    const slices: FileSlice[] = [];

    for (const e of evidence) {
      const match = e.match(/^(.+):(\d+)(?:-(\d+))?$/);
      if (!match) continue;

      const [, relPath, fromStr, toStr] = match;
      const fromLine = parseInt(fromStr, 10);
      const toLine   = toStr ? parseInt(toStr, 10) : fromLine + 10;
      const absPath  = path.resolve(projectRoot, relPath);

      const slice = await DiffContext.extractSlice(absPath, fromLine, toLine);
      if (slice) slices.push(slice);
    }

    return slices;
  }

  /**
   * Summarize slices into a compact string for agent context.
   * Annotates when full file was returned due to fallback.
   */
  static summarize(slices: FileSlice[]): string {
    if (slices.length === 0) return '(no file context)';

    return slices
      .map(s => {
        const rel  = s.filePath.split(/[\\/]/).slice(-3).join('/');
        const mode = s.usedFullFile
          ? `full file — slice exceeded ${Math.round(FULL_FILE_THRESHOLD * 100)}% threshold`
          : `lines ${s.fromLine}-${s.toLine} of ${s.totalLines}`;
        return `--- ${rel} (${mode}) ---\n${s.content}`;
      })
      .join('\n\n');
  }

  /** Total token estimate across all slices. */
  static totalTokens(slices: FileSlice[]): number {
    return slices.reduce((sum, s) => sum + s.tokenEstimate, 0);
  }
}
