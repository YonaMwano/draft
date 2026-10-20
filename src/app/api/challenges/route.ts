import { createRoom } from '@/lib/onlineRooms';
export async function POST(req: Request) {
  try { const body = await req.json(); return Response.json(await createRoom(body.timeControl), { status: 201 }); }
  catch { return Response.json({ error: 'Unable to create an online room. Please try again.' }, { status: 503 }); }
}
