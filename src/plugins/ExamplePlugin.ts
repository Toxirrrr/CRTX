import { EventBus } from '../events/EventBus';
import { CRTXPlugin, PluginContext } from '../sdk/types';
import { CRTXEvent, EventType } from '../events/types';

export class ExamplePlugin implements CRTXPlugin {
  name = 'Example Logger Plugin';
  version = '1.0.0';

  init(eventBus: EventBus, context: PluginContext): void {
    console.log(`[${this.name}] Initializing (CRTX v${context.version})`);

    // Subscribe to task status changes
    eventBus.subscribe(EventType.TASK_STATUS_CHANGED, (event: CRTXEvent) => {
      console.log(`\n[${this.name}] 🔔 Notification: Task ${event.payload.taskId} changed status from '${event.payload.oldStatus}' to '${event.payload.newStatus}'`);
    });
  }
}
