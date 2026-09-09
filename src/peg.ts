// Peg solitaire engine. Pure, dependency-free.
//
// Board shapes are laid out on a 7x7 grid; each shape lists its playable cells.
// A cell holds a peg (1) or is empty (0). A move jumps a peg over an adjacent
// peg into an empty cell, removing the jumped peg.

export type Board = 'english' | 'european' | 'triangular';

export interface Cell {
  r: number;
  c: number;
}

function englishCells(): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 7; c++) {
      const corner = (r < 2 || r > 4) && (c < 2 || c > 4);
      if (!corner) out.push({ r, c });
    }
  return out;
}

function europeanCells(): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 7; c++) {
      // octagon: cut the very corners (2 cells per corner)
      const cut =
        (r === 0 && (c < 2 || c > 4)) ||
        (r === 6 && (c < 2 || c > 4)) ||
        (c === 0 && (r < 2 || r > 4)) ||
        (c === 6 && (r < 2 || r > 4)) ||
        ((r === 1 || r === 5) && (c === 0 || c === 6)) ||
        ((c === 1 || c === 5) && (r === 0 || r === 6));
      if (!cut) out.push({ r, c });
    }
  return out;
}

function triangularCells(): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c <= r; c++) out.push({ r, c });
  return out;
}

export const SHAPES: Record<Board, { cells: Cell[]; neighbours: (a: Cell, b: Cell) => boolean }> = {
  english: { cells: englishCells(), neighbours: orthogonal },
  european: { cells: europeanCells(), neighbours: orthogonal },
  triangular: { cells: triangularCells(), neighbours: triangleAdj },
};

function orthogonal(a: Cell, b: Cell): boolean {
  return (a.r === b.r && Math.abs(a.c - b.c) === 1) || (a.c === b.c && Math.abs(a.r - b.r) === 1);
}
// Triangular peg solitaire: moves along the 3 axes of the triangle.
function triangleAdj(a: Cell, b: Cell): boolean {
  const dr = b.r - a.r;
  const dc = b.c - a.c;
  return (
    (dr === 0 && Math.abs(dc) === 1) || // same row
    (Math.abs(dr) === 1 && dc === 0) || // up-left diagonal (col stays)
    (Math.abs(dr) === 1 && dc === dr) // up-right diagonal
  );
}

export interface Move {
  from: number; // index into cells
  over: number;
  to: number;
}

export interface GameShape {
  board: Board;
  cells: Cell[];
  index: Map<string, number>; // "r,c" -> cell index
  moves: Move[]; // every geometrically possible jump on this board
}

const key = (c: Cell) => `${c.r},${c.c}`;

export function buildShape(board: Board): GameShape {
  const { cells, neighbours } = SHAPES[board];
  const index = new Map<string, number>();
  cells.forEach((c, i) => index.set(key(c), i));

  const moves: Move[] = [];
  for (let i = 0; i < cells.length; i++) {
    const a = cells[i];
    for (let j = 0; j < cells.length; j++) {
      const b = cells[j];
      if (i === j || !neighbours(a, b)) continue;
      // landing cell is the reflection of a through b
      const landing = { r: 2 * b.r - a.r, c: 2 * b.c - a.c };
      const k = index.get(key(landing));
      if (k != null && neighbours(b, landing)) moves.push({ from: i, over: j, to: k });
    }
  }
  return { board, cells, index, moves };
}

// A full board with one hole. `holeRC` defaults to the centre.
export function startBoard(shape: GameShape, hole?: Cell): number[] {
  const b = new Array(shape.cells.length).fill(1);
  const h = hole ?? centre(shape);
  const hi = shape.index.get(key(h));
  if (hi != null) b[hi] = 0;
  return b;
}

export function centre(shape: GameShape): Cell {
  if (shape.board === 'triangular') return { r: 2, c: 1 };
  return { r: 3, c: 3 };
}

export function legalMoves(board: number[], shape: GameShape): Move[] {
  return shape.moves.filter((m) => board[m.from] === 1 && board[m.over] === 1 && board[m.to] === 0);
}

export function applyMove(board: number[], m: Move): number[] {
  const next = board.slice();
  next[m.from] = 0;
  next[m.over] = 0;
  next[m.to] = 1;
  return next;
}

export function pegCount(board: number[]): number {
  return board.reduce((s, v) => s + v, 0);
}

export function isWon(board: number[]): boolean {
  return pegCount(board) === 1;
}

export function isPerfectWin(board: number[], shape: GameShape): boolean {
  if (pegCount(board) !== 1) return false;
  const ci = shape.index.get(key(centre(shape)))!;
  return board[ci] === 1;
}

// --- solver: DFS to a single peg, with a visited-mask cache and a node cap ---
function mask(board: number[]): bigint {
  let m = 0n;
  for (let i = 0; i < board.length; i++) if (board[i]) m |= 1n << BigInt(i);
  return m;
}

export function solve(
  board: number[],
  shape: GameShape,
  nodeCap = 400000,
  targetIndex?: number,
): Move[] | null {
  const dead = new Set<bigint>();
  let nodes = 0;

  const dfs = (b: number[]): Move[] | null => {
    if (pegCount(b) === 1) {
      return targetIndex == null || b[targetIndex] === 1 ? [] : null;
    }
    if (++nodes > nodeCap) return null;
    const mk = mask(b);
    if (dead.has(mk)) return null;
    const options = legalMoves(b, shape);
    for (const mv of options) {
      const res = dfs(applyMove(b, mv));
      if (res) return [mv, ...res];
    }
    dead.add(mk);
    return null;
  };

  return dfs(board.slice());
}

// --- share text -----------------------------------------
export function shareText(board: Board, moves: number, won: boolean, perfect: boolean): string {
  const name = { english: 'English', european: 'European', triangular: 'Triangular' }[board];
  if (!won) return `Peg Solitaire (${name}) — ${moves} moves, ${'stuck'}`;
  return `Peg Solitaire (${name}) — solved in ${moves} moves${perfect ? ', last peg dead centre 🎯' : ''}`;
}

// --- URL state -----------------------------------------
const BOARD_CHAR: Record<Board, string> = { english: 'e', european: 'u', triangular: 't' };
const CHAR_BOARD: Record<string, Board> = { e: 'english', u: 'european', t: 'triangular' };
const SHAPE_LEN: Record<Board, number> = { english: 33, european: 37, triangular: 15 };

export function encodeState(board: Board, cells: number[]): string {
  return `${BOARD_CHAR[board]}.${cells.join('')}`;
}

export function decodeState(s: string): { board: Board; cells: number[] } | null {
  const m = /^([eut])\.([01]+)$/.exec(s.trim());
  if (!m) return null;
  const board = CHAR_BOARD[m[1]];
  const cells = m[2].split('').map(Number);
  if (!board || cells.length !== SHAPE_LEN[board]) return null;
  return { board, cells };
}
