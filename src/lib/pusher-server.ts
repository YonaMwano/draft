import 'server-only';
import Pusher from 'pusher';

let client: Pusher | undefined;

// Resolve credentials only when realtime delivery is requested.
export function getPusherServer(): Pusher {
  if (!client) {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!appId || !key || !secret || !cluster) {
      throw new Error('Pusher server configuration is missing');
    }
    client = new Pusher({ appId, key, secret, cluster, useTLS: true });
  }
  return client;
}
