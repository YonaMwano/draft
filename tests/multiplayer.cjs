const ts = require('typescript');
const fs = require('node:fs');
const assert = require('node:assert/strict');
// Load the pure TypeScript rules without requiring a Next.js build.
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
};
const { LocalGame } = require('../src/lib/localEngine.ts');
const { validateTransition } = require('../src/lib/multiplayerRules.ts');
const start = new LocalGame();
const next = new LocalGame();
next.applyMove(next.legalMoves()[0]);
assert.ok(validateTransition(start.getPieces(), 'white', next.getPieces()));
assert.equal(validateTransition(start.getPieces(), 'black', next.getPieces()), null);
assert.equal(validateTransition(start.getPieces(), 'white', start.getPieces()), null);
assert.equal(validateTransition(start.getPieces(), 'white', [{ square: 49 }]), null);
assert.equal(validateTransition(start.getPieces(), 'white', null), null);
const black = new LocalGame(); black.pieces = next.getPieces(); black.turn = 'black';
black.applyMove(black.legalMoves()[0]);
assert.ok(validateTransition(next.getPieces(), 'black', black.getPieces()));
assert.equal(start.getPieces().length, 40);
assert.equal(start.turn, 'white');
console.log('Passed 8 multiplayer rule checks');
