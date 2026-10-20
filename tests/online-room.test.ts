import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalGame } from '../src/lib/localEngine';
const mocks = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn(), seat: vi.fn() }));
vi.mock('@/lib/onlineRoom', () => ({
  db: { select: () => ({ from: () => ({ where: mocks.select }) }), update: () => ({ set: (changes: unknown) => { mocks.update(changes); return { where: () => ({ returning: async () => mocks.update.mock.results.at(-1)?.value }) }; } }) },
  onlineRooms: { id: 'id', revision: 'revision', code: 'code', blackSeat: 'blackSeat', status: 'status' },
  seatIdentity: mocks.seat,
  roomResponse: (room: unknown, seat: string) => Response.json({ room, seat }),
  withSeat: (response: Response) => response,
}));
import { GET, POST } from '../src/app/api/games/state/route';
import { POST as join } from '../src/app/api/challenges/join/route';
const id = '00000000-0000-4000-8000-000000000001';
function makeRoom() {
  return { id, code: 'ABCDEF', whiteSeat: 'host', blackSeat: 'guest', status: 'active', pieces: new LocalGame().getPieces(), history: [], turn: 'white', winner: null, reason: null, revision: 1, whiteMs: 180000, blackMs: 180000, incrementMs: 2000, updatedAt: new Date(), expiresAt: new Date(Date.now() + 3600000) };
}
let room: ReturnType<typeof makeRoom>;
function post(body: object) { return POST(new Request('http://localhost/api/games/state', { method: 'POST', body: JSON.stringify({ id, revision: 1, ...body }) })); }
beforeEach(() => {
  vi.clearAllMocks(); room = makeRoom(); mocks.seat.mockResolvedValue('host'); mocks.select.mockImplementation(async () => [room]); mocks.update.mockImplementation(changes => [{ ...room, ...changes }]);
});
describe('authoritative online game', () => {
  it('applies a legal white move and persists its turn and revision', async () => {
    const move = new LocalGame().legalMoves()[0];
    const res = await post({ action: 'move', move });
    expect(res.status).toBe(200);
    const { room: updated } = await res.json();
    expect(updated.turn).toBe('black'); expect(updated.revision).toBe(2); expect(updated.history).toHaveLength(1);
    expect(updated.pieces.find((p: { square: number }) => p.square === move.path.at(-1))).toBeDefined();
  });
  it('shares successive moves between both players and restores them on refresh', async () => {
    mocks.update.mockImplementation(changes => {
      room = { ...room, ...changes };
      return [room];
    });
    await post({ action: 'move', move: new LocalGame().legalMoves()[0] });
    mocks.seat.mockResolvedValue('guest');
    const restored = await (await GET(new Request(`http://localhost/api/games/state?id=${id}`))).json();
    expect(restored.room.history).toHaveLength(1);
    const engine = new LocalGame();
    engine.pieces = restored.room.pieces;
    engine.turn = 'black';
    expect((await post({ action: 'move', revision: 2, move: engine.legalMoves()[0] })).status).toBe(200);
    mocks.seat.mockResolvedValue('host');
    const final = await (await GET(new Request(`http://localhost/api/games/state?id=${id}`))).json();
    expect(final.room.history).toHaveLength(2);
    expect(final.room.turn).toBe('white');
  });
  it('does not allow moves while waiting for the opponent', async () => {
    room.status = 'waiting';
    expect((await post({ action: 'move', move: new LocalGame().legalMoves()[0] })).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rejects an opponent moving out of turn', async () => {
    mocks.seat.mockResolvedValue('guest');
    expect((await post({ action: 'move', move: new LocalGame().legalMoves()[0] })).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rejects illegal moves and stale revisions', async () => {
    expect((await post({ action: 'move', move: { from: 0, path: [49] } })).status).toBe(400);
    expect((await post({ action: 'move', revision: 0, move: new LocalGame().legalMoves()[0] })).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rejects outsiders reading or changing a game', async () => {
    mocks.seat.mockResolvedValue('outsider');
    expect((await GET(new Request(`http://localhost/api/games/state?id=${id}`))).status).toBe(403);
    expect((await post({ action: 'resign' })).status).toBe(403);
  });
  it('resigns the player’s own side even on the opponent’s turn', async () => {
    mocks.seat.mockResolvedValue('guest');
    const res = await post({ action: 'resign' });
    expect((await res.json()).room).toMatchObject({ status: 'finished', winner: 'white', reason: 'resignation' });
  });
  it('persists timeout results from server elapsed time', async () => {
    room.updatedAt = new Date(Date.now() - 181000);
    const res = await GET(new Request(`http://localhost/api/games/state?id=${id}`));
    expect((await res.json()).room).toMatchObject({ status: 'finished', winner: 'black', whiteMs: 0 });
  });
  it('rejects simultaneous updates that lose the revision comparison', async () => {
    mocks.update.mockReturnValue([]);
    expect((await post({ action: 'move', move: new LocalGame().legalMoves()[0] })).status).toBe(409);
  });
});
describe('fixed player seats', () => {
  const request = () => new Request('http://localhost/api/challenges/join', { method: 'POST', body: JSON.stringify({ code: 'abcdef' }) });
  it('keeps the creator in the white seat when rejoining', async () => {
    room.status = 'waiting'; room.blackSeat = null as unknown as string;
    expect((await (await join(request())).json()).seat).toBe('host');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('assigns only the pink seat to the joining player', async () => {
    room.status = 'waiting'; room.blackSeat = null as unknown as string; mocks.seat.mockResolvedValue('guest');
    const { room: updated } = await (await join(request())).json();
    expect(updated).toMatchObject({ whiteSeat: 'host', blackSeat: 'guest', status: 'active' });
  });
  it('rejects a third player and competing joins', async () => {
    mocks.seat.mockResolvedValue('outsider');
    expect((await join(request())).status).toBe(409);
    room.status = 'waiting'; room.blackSeat = null as unknown as string; mocks.update.mockReturnValue([]);
    expect((await join(request())).status).toBe(409);
  });
  it('returns a connection error instead of creating a fake local game', async () => {
    mocks.select.mockRejectedValue(new Error('unavailable'));
    expect((await join(request())).status).toBe(503);
  });
});
