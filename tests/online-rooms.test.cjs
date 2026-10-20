const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name in mocks ? mocks[name] : require(name), Response, Date, console });
  return module.exports;
}
const { LocalGame } = load('src/lib/localEngine.ts');
const table = { id: 'id', version: 'version', code: 'code', guestHash: 'guestHash' };
function setup() {
  let room;
  const db = {
    select: () => ({ from: () => ({ where: async () => room ? [room] : [] }) }),
    insert: () => ({ values: value => ({ returning: async () => { room = { guestHash: null, ...value, version: 0 }; return [room]; } }) }),
    update: () => ({ set: patch => ({ where: condition => {
      const matches = condition.every(([key, value]) => room[key] === value);
      const result = matches ? [{ ...room, ...patch }] : [];
      if (matches) room = result[0];
      return Object.assign(Promise.resolve(), { returning: async () => result });
    } }) }),
  };
  const orm = { isNull: key => [[key, null]], eq: (key, value) => [[key, value]], and: (...parts) => parts.flat() };
  const service = load('src/lib/onlineRooms.ts', { 'drizzle-orm': orm, '../../db': { db }, '../../db/schema': { onlineRooms: table }, './localEngine': { LocalGame } });
  const route = load('src/app/api/games/sync/route.ts', { 'drizzle-orm': orm, '../../../../../db': { db }, '../../../../../db/schema': { onlineRooms: table }, '@/lib/onlineRooms': service, '@/lib/localEngine': { LocalGame } });
  const join = load('src/app/api/challenges/join/route.ts', { 'drizzle-orm': orm, '../../../../../db': { db }, '../../../../../db/schema': { onlineRooms: table }, '@/lib/onlineRooms': service });
  return { service, route, join, getRoom: () => room };
}
const request = body => new Request('https://example.test/api/games/sync', { method: 'POST', body: JSON.stringify(body) });
test('creator receives white; seat tokens are hashed and unknown tokens are rejected', async () => {
  const { service, getRoom } = setup();
  const created = await service.createRoom('rapid');
  assert.equal(created.role, 'white');
  assert.equal(created.state.status, 'waiting');
  assert.equal(created.initialMs, 600000);
  assert.notEqual(getRoom().hostHash, created.token);
  assert.equal(service.roleFor(getRoom(), created.token), 'white');
  assert.throws(() => service.roleFor(getRoom(), 'invalid'));
  getRoom().guestHash = service.hashToken('guest');
  assert.equal(service.roleFor(getRoom(), 'guest'), 'black');
});
test('waiting clocks stay stopped; active clocks expire; stale presence becomes offline', async () => {
  const { service, getRoom } = setup();
  const created = await service.createRoom('bullet');
  const room = getRoom();
  room.state.lastMoveAt = Date.now() - 70000;
  assert.equal(service.clockState(room).whiteMs, 60000);
  room.state.status = 'active';
  assert.equal(service.clockState(room).winner, 'black');
  assert.equal(service.clockState(room).resultReason, 'timeout');
  room.guestSeen = Date.now();
  assert.equal(service.snapshot(room, created.role).opponentOnline, true);
  room.guestSeen -= 16000;
  assert.equal(service.snapshot(room, created.role).opponentOnline, false);
});
test('server rejects illegal, out-of-turn, and stale moves; accepted moves persist for reconnect', async () => {
  const { service, route, getRoom } = setup();
  const created = await service.createRoom('blitz3');
  getRoom().guestHash = service.hashToken('guest');
  getRoom().state.status = 'active';
  const base = { code: created.code, token: created.token, version: 0, action: 'move' };
  assert.equal((await route.POST(request({ ...base, token: 'guest', move: { from: 30, path: [25] } }))).status, 403);
  assert.equal((await route.POST(request({ ...base, move: { from: 0, path: [49] } }))).status, 400);
  const move = new LocalGame().legalMoves()[0];
  const response = await route.POST(request({ ...base, move }));
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(state.state.ply, 1);
  assert.equal(state.state.turn, 'black');
  assert.equal((await route.POST(request({ ...base, move }))).status, 409);
  const restored = await (await route.POST(request({ code: created.code, token: 'guest' }))).json();
  assert.deepEqual(restored.state.pieces, state.state.pieces);
  const resigned = await (await route.POST(request({ code: created.code, token: created.token, version: state.version, action: 'resign' }))).json();
  assert.equal(resigned.state.winner, 'black');
  assert.equal(resigned.state.status, 'finished');
});

test('only one opponent can claim pink; creator and opponent retain their seats on rejoin', async () => {
  const { service, join, getRoom } = setup();
  const created = await service.createRoom('blitz5');
  const host = await (await join.POST(request({ code: created.code, token: created.token }))).json();
  assert.equal(host.role, 'white');
  assert.equal(getRoom().state.status, 'waiting');
  const responses = await Promise.all([join.POST(request({ code: created.code })), join.POST(request({ code: created.code }))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const guest = await responses.find(r => r.status === 200).json();
  assert.equal(guest.role, 'black');
  assert.equal(guest.state.status, 'active');
  const rejoined = await (await join.POST(request({ code: created.code, token: guest.token }))).json();
  assert.equal(rejoined.role, 'black');
  assert.equal(rejoined.token, guest.token);
});
