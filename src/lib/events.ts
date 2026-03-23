import { EventEmitter } from "events";

const globalForEvents = globalThis as unknown as {
  notificationEmitter: EventEmitter | undefined;
  chatEmitter: EventEmitter | undefined;
  githubEmitter: EventEmitter | undefined;
};

// Global emitter instance (avoids duplicate instances during dev hot-reloads)
export const notificationEmitter =
  globalForEvents.notificationEmitter ?? new EventEmitter();

// Chat emitter — real-time chat events
// Events: new_message, typing, read_receipt, reaction, conv_joined, presence
export const chatEmitter =
  globalForEvents.chatEmitter ?? new EventEmitter();

// GitHub emitter — real-time commit and CI status events
// Events: new_commits ({ projectId, count }), status_update ({ projectId, sha, status, url })
export const githubEmitter =
  globalForEvents.githubEmitter ?? new EventEmitter();

// Prevent memory leak warnings with many SSE connections
notificationEmitter.setMaxListeners(50);
chatEmitter.setMaxListeners(50);
githubEmitter.setMaxListeners(50);

if (process.env.NODE_ENV !== "production") {
  globalForEvents.notificationEmitter = notificationEmitter;
  globalForEvents.chatEmitter = chatEmitter;
  globalForEvents.githubEmitter = githubEmitter;
}
