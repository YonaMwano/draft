import { redirect } from 'next/navigation';

type GamePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Keep existing game links working with the shared room page.
export default async function GamePage({ params, searchParams }: GamePageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const roomQuery = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) roomQuery.append(key, item);
    } else if (value !== undefined) {
      roomQuery.set(key, value);
    }
  }

  roomQuery.set('id', id);
  redirect(`/game/room?${roomQuery.toString()}`);
}
