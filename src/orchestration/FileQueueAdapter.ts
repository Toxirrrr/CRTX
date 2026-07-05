import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { IQueueAdapter, MessagePayload } from './types';

/**
 * P3: File Queue Adapter
 * A zero-dependency filesystem-based queue with atomic locking to prevent race conditions.
 */
export class FileQueueAdapter implements IQueueAdapter {
  private queueDir: string;
  private isWatching = false;
  private handlers = new Map<string, Array<(msg: MessagePayload) => Promise<void>>>();

  constructor(baseDir: string) {
    this.queueDir = path.join(baseDir, '.queue');
  }

  async init(): Promise<void> {
    await fsp.mkdir(this.queueDir, { recursive: true });
    this.startPolling();
  }

  async publish(topic: string, payload: MessagePayload): Promise<string> {
    const messageId = randomUUID();
    const envelope = {
      messageId,
      topic,
      payload,
      timestamp: Date.now()
    };
    
    // File starts as .json
    const filePath = path.join(this.queueDir, `${topic}_${messageId}.json`);
    await fsp.writeFile(filePath, JSON.stringify(envelope, null, 2), 'utf8');
    
    return messageId;
  }

  subscribe(topic: string, handler: (msg: MessagePayload) => Promise<void>): void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)!.push(handler);
  }

  async acknowledge(messageId: string): Promise<void> {
    try {
      const files = await fsp.readdir(this.queueDir);
      // We look for the locked .processing file to delete
      const target = files.find(f => f.includes(messageId) && f.endsWith('.processing'));
      if (target) {
        await fsp.unlink(path.join(this.queueDir, target));
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') console.error(`[FileQueue] Ack error:`, err);
    }
  }

  async nack(messageId: string): Promise<void> {
    try {
      const files = await fsp.readdir(this.queueDir);
      const target = files.find(f => f.includes(messageId) && f.endsWith('.processing'));
      if (target) {
        // Rename back to .json to unlock it
        const processingPath = path.join(this.queueDir, target);
        const unlockedPath = processingPath.replace('.processing', '.json');
        await fsp.rename(processingPath, unlockedPath);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') console.error(`[FileQueue] Nack error:`, err);
    }
  }

  private startPolling(): void {
    if (this.isWatching) return;
    this.isWatching = true;

    const poll = async () => {
      try {
        const files = await fsp.readdir(this.queueDir);
        for (const file of files) {
          if (!file.endsWith('.json')) continue; // Ignore .processing files
          
          const filePath = path.join(this.queueDir, file);
          const lockPath = filePath + '.lock';
          
          // ATOMIC LOCK: Try to create a lock file exclusively.
          try {
            const fh = await fsp.open(lockPath, 'wx');
            await fh.close();
          } catch (lockErr: any) {
            // Another process grabbed it first
            continue; 
          }

          // We secured the lock
          try {
            const raw = await fsp.readFile(filePath, 'utf8');
            const envelope = JSON.parse(raw);
            
            const topicHandlers = this.handlers.get(envelope.topic) || [];
            
            let success = true;
            for (const handler of topicHandlers) {
              try {
                await handler(envelope.payload);
              } catch (err) {
                success = false;
                console.error('[FileQueue] Handler error:', err);
              }
            }
            
            if (success) {
              try {
                await fsp.unlink(filePath); // Auto-ack
              } catch (unlinkErr) {
                console.error(`[FileQueue] Unlink failed for ${filePath}, ignoring.`, unlinkErr);
              }
            }
            
            // Always unlock by removing the lock file
            try { await fsp.unlink(lockPath); } catch (e2) {}

          } catch (e: any) {
             console.error('[FileQueue] Processing error:', e);
             try { await fsp.unlink(lockPath); } catch (e2) {}
          }
        }
      } catch (err) {
        // Ignore general readdir errors
      }

      if (this.isWatching) {
        setTimeout(poll, 1000);
      }
    };

    poll();
  }

  stopPolling(): void {
    this.isWatching = false;
  }
}
