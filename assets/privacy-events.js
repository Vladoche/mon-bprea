// Same-origin coordination only. No account, token, answer or scope in messages.
const listeners = new Set();
let channel;
function receive(phase) { if (['suspend', 'settled'].includes(phase)) for (const fn of listeners) fn(phase); }
export function subscribePrivacy(fn) {
  if (!channel && globalThis.window && globalThis.BroadcastChannel) {
    channel = new BroadcastChannel('mon-bprea-privacy-v1');
    channel.onmessage = event => receive(event.data?.phase);
  }
  listeners.add(fn);
  return () => { listeners.delete(fn); if (!listeners.size) { channel?.close(); channel = null; } };
}
export function publishPrivacy(phase) { receive(phase); channel?.postMessage({ phase }); }
