import fsp from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';

const CRTX_DIR = path.resolve(__dirname, '..', '..');
const EVENTS_DIR = path.resolve(CRTX_DIR, 'events');

export class EventLogger {
  static async init() {
    try {
      await fsp.mkdir(EVENTS_DIR, { recursive: true });
    } catch (e) {
      // Ignore if exists
    }
  }

  static async logEvent(type: string, payload: any) {
    await this.init();
    
    // EV<timestamp>-<type>.json
    const timestamp = Date.now();
    const filename = `EV${timestamp}-${type.replace(/[^a-z0-9_]/gi, '_')}.json`;
    const filepath = path.join(EVENTS_DIR, filename);

    const eventObj = {
      type,
      timestamp: new Date().toISOString(),
      payload,
    };

    try {
      await fsp.writeFile(filepath, JSON.stringify(eventObj, null, 2) + '\n', 'utf8');
      console.log(`[EventLogger] Logged event: ${filename}`);
    } catch (e: any) {
      console.error(`[EventLogger] Failed to write event ${filename}:`, e.message);
    }
  }
}
