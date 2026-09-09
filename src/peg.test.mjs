import assert from 'node:assert/strict';
import {
  buildShape,
  startBoard,
  legalMoves,
  applyMove,
  pegCount,
  isWon,
  isPerfectWin,
  solve,
  centre,
  encodeState,
  decodeState,
} from './peg.ts';

let pass = 0;
const t = (name, fn) => {
  try {
    fn();
    pass++;
    console.log('ok  -', name);
  } catch (e) {
    console.error('FAIL-', name, '\n   ', e.message);
    process.exitCode = 1;
  }
};

const applyAll = (b, moves) => moves.reduce((acc, m) => applyMove(acc, m), b);

t('shape cell counts', () => {
  assert.equal(buildShape('english').cells.length, 33);
  assert.equal(buildShape('european').cells.length, 37);
  assert.equal(buildShape('triangular').cells.length, 15);
});

t('english has geometric jump moves and they are reversible in pairs', () => {
  const sh = buildShape('english');
  assert.ok(sh.moves.length >= 70 && sh.moves.length <= 80); // 76 for the cross
  // every move A-over-B-to-C has a mirror C-over-B-to-A
  for (const m of sh.moves) {
    assert.ok(sh.moves.some((x) => x.from === m.to && x.over === m.over && x.to === m.from));
  }
});

t('standard english start: 32 pegs, centre empty, 4 opening moves', () => {
  const sh = buildShape('english');
  const b = startBoard(sh);
  assert.equal(pegCount(b), 32);
  const ci = sh.index.get(`${centre(sh).r},${centre(sh).c}`);
  assert.equal(b[ci], 0);
  assert.equal(legalMoves(b, sh).length, 4);
});

t('applyMove removes exactly one peg', () => {
  const sh = buildShape('english');
  const b = startBoard(sh);
  const after = applyMove(b, legalMoves(b, sh)[0]);
  assert.equal(pegCount(after), 31);
});

t('solve: standard english board -> 31 moves to one peg', () => {
  const sh = buildShape('english');
  const b = startBoard(sh);
  const moves = solve(b, sh, 3_000_000);
  assert.ok(moves, 'no solution found within node cap');
  assert.equal(moves.length, 31);
  const end = applyAll(b, moves);
  assert.ok(isWon(end, sh));
});

t('solve: standard triangular board -> one peg', () => {
  const sh = buildShape('triangular');
  // remove a corner peg (top)
  const b = startBoard(sh, { r: 0, c: 0 });
  assert.equal(pegCount(b), 14);
  const moves = solve(b, sh, 500_000);
  assert.ok(moves);
  assert.equal(moves.length, 13);
  assert.ok(isWon(applyAll(b, moves), sh));
});

t('solve: an obviously dead position returns null', () => {
  const sh = buildShape('english');
  // two lone pegs far apart, no jumps possible
  const b = new Array(33).fill(0);
  b[0] = 1;
  b[32] = 1;
  assert.equal(solve(b, sh, 10000), null);
});

t('isWon / isPerfectWin', () => {
  const sh = buildShape('english');
  const b = new Array(33).fill(0);
  assert.equal(isWon(b, sh), false); // zero pegs
  const ci = sh.index.get('3,3');
  b[ci] = 1;
  assert.equal(isWon(b, sh), true);
  assert.equal(isPerfectWin(b, sh), true);
  b[ci] = 0;
  b[0] = 1;
  assert.equal(isPerfectWin(b, sh), false);
});

t('encode / decode state', () => {
  const sh = buildShape('english');
  const b = startBoard(sh);
  const enc = encodeState('english', b);
  assert.ok(enc.startsWith('e.'));
  assert.deepEqual(decodeState(enc), { board: 'english', cells: b });
  const eu = buildShape('european');
  assert.deepEqual(decodeState(encodeState('european', startBoard(eu))).board, 'european');
  assert.equal(decodeState(''), null);
  assert.equal(decodeState('e.01'), null); // wrong length
});

console.log(`\n${pass} passed`);
