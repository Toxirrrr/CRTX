import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface SnapshotManifest {
  snapshotId: string;
  taskId: string;
  timestamp: string;
  files: string[];
}

/**
 * P0: Context Allocator
 * Manages filesystem snapshots for safe agent execution and rollback.
 * Uses Snapshot Manifests to handle concurrent agents and nested operations.
 */
export class ContextAllocator {
  private readonly snapshotsDir: string;
  private readonly targetDir: string;

  constructor(targetDir: string, snapshotsDir?: string) {
    this.targetDir = targetDir;
    this.snapshotsDir = snapshotsDir ?? path.join(targetDir, '.snapshots');
  }

  async init(): Promise<void> {
    await fsp.mkdir(this.snapshotsDir, { recursive: true });
  }

  /**
   * Creates a backup of the specified files before execution.
   */
  async createSnapshot(taskId: string, files: string[]): Promise<string> {
    const snapshotId = randomUUID();
    const snapshotPath = path.join(this.snapshotsDir, snapshotId);
    await fsp.mkdir(snapshotPath, { recursive: true });

    const manifest: SnapshotManifest = {
      snapshotId,
      taskId,
      timestamp: new Date().toISOString(),
      files,
    };

    for (const file of files) {
      try {
        const sourcePath = path.resolve(this.targetDir, file);
        const destPath = path.join(snapshotPath, 'files', file);
        
        await fsp.mkdir(path.dirname(destPath), { recursive: true });
        await fsp.copyFile(sourcePath, destPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
      }
    }

    await fsp.writeFile(
      path.join(snapshotPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
    
    return snapshotId;
  }

  /**
   * Restores files from a snapshot, enabling Rollback.
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshotPath = path.join(this.snapshotsDir, snapshotId);
    const manifestPath = path.join(snapshotPath, 'manifest.json');
    
    try {
      const manifestRaw = await fsp.readFile(manifestPath, 'utf8');
      const manifest: SnapshotManifest = JSON.parse(manifestRaw);

      for (const file of manifest.files) {
        const sourcePath = path.join(snapshotPath, 'files', file);
        const destPath = path.resolve(this.targetDir, file);
        
        try {
          await fsp.copyFile(sourcePath, destPath);
        } catch (err) {
          // If the file didn't exist in the snapshot, ensure it's deleted from targetDir
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            await fsp.rm(destPath, { force: true });
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  /**
   * Removes a snapshot once execution is successfully validated.
   */
  async clearSnapshot(snapshotId: string): Promise<void> {
    const snapshotPath = path.join(this.snapshotsDir, snapshotId);
    await fsp.rm(snapshotPath, { recursive: true, force: true });
  }
}
