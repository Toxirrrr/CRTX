import fsp from 'node:fs/promises';
import path from 'node:path';
import { EventBus } from '../EventBus';
import { CRTXEvent } from '../types';

const CRTX_DIR = path.resolve(__dirname, '..', '..', '..');
const EVENTS_DIR = path.resolve(CRTX_DIR, 'events');

export class TimelineSubscriber {
  constructor(private eventBus: EventBus) {
    this.init();
  }

  private async init() {
    try {
      await fsp.mkdir(EVENTS_DIR, { recursive: true });
    } catch (e) {
      // Ignore if exists
    }

    // Subscribe to all events and log them to the filesystem
    this.eventBus.subscribe('*', async (event: CRTXEvent) => {
      await this.logToFile(event);
    });
  }

  private async logToFile(event: CRTXEvent) {
    // Generate an ID for the JSON file using the event type and timestamp
    const timestamp = new Date(event.timestamp).getTime();
    const typeStr = event.type.replace(/[^a-z0-9_]/gi, '_');
    const filename = `EV${timestamp}-${typeStr}.json`;
    const filepath = path.join(EVENTS_DIR, filename);

    try {
      await fsp.writeFile(filepath, JSON.stringify(event, null, 2) + '\n', 'utf8');
      console.log(`[TimelineSubscriber] Logged event: ${filename}`);
    } catch (e: any) {
      console.error(`[TimelineSubscriber] Failed to write event ${filename}:`, e.message);
    }
  }
}
