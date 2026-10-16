import PusherClient from 'pusher-js';

export function createPusherClient() {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) throw new Error('Pusher public configuration is missing');
  return new PusherClient(key, { cluster, forceTLS: true });
}
