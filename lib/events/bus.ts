/**
 * In-process event bus for broadcasting CoordinationEvents to SSE subscribers.
 * Agents POST events to /api/events → this bus → SSE connections in the browser.
 */
import type { CoordinationEvent } from "@/lib/types";

type Subscriber = (event: CoordinationEvent) => void;

class EventBus {
  private subscribers = new Map<string, Set<Subscriber>>();

  subscribe(taskId: string, fn: Subscriber): () => void {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }
    this.subscribers.get(taskId)!.add(fn);
    return () => {
      this.subscribers.get(taskId)?.delete(fn);
      if (this.subscribers.get(taskId)?.size === 0) {
        this.subscribers.delete(taskId);
      }
    };
  }

  publish(event: CoordinationEvent): void {
    this.subscribers.get(event.taskId)?.forEach((fn) => fn(event));
    this.subscribers.get("*")?.forEach((fn) => fn(event));
  }
}

/* Singleton — shared across all Next.js route handlers in the same process */
const bus = new EventBus();
export default bus;
