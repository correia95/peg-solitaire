import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyMove,
  type Board,
  buildShape,
  decodeState,
  encodeState,
  isPerfectWin,
  isWon,
  legalMoves,
  type Move,
  pegCount,
  shareText,
  solve,
  startBoard,
} from './peg.ts';

const LS_KEY = 'peg-solitaire:v1';
const BOARDS: { key: Board; name: string }[] = [
  { key: 'english', name: 'English' },
  { key: 'european', name: 'European' },
  { key: 'triangular', name: 'Triangle' },
];

export default function App() {
  const deep = useMemo(() => decodeState(new URLSearchParams(location.search).get('g') ?? ''), []);
  const [board, setBoard] = useState<Board>(deep?.board ?? loadBoard());
  const shape = useMemo(() => buildShape(board), [board]);

  const [cells, setCells] = useState<number[]>(deep?.cells ?? startBoard(shape));
  const [history, setHistory] = useState<number[][]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [copied, setCopied] = useState(false);
  const startRef = useRef<number[]>(deep?.cells ?? startBoard(shape));

  const moves = legalMoves(cells, shape);
  const won = isWon(cells);
  const stuck = !won && moves.length === 0;
  const perfect = isPerfectWin(cells, shape);
  const moveCount = history.length;

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ board }));
    } catch {
      /* ignore */
    }
  }, [board]);

  const reset = useCallback(
    (b: Board, fresh = true) => {
      const sh = buildShape(b);
      const start = startBoard(sh);
      setBoard(b);
      if (fresh) {
        setCells(start);
        startRef.current = start;
      } else {
        setCells(startRef.current);
      }
      setHistory([]);
      setSel(null);
      setHint(null);
      setCopied(false);
    },
    [],
  );

  const destsFor = (from: number): number[] =>
    moves.filter((m) => m.from === from).map((m) => m.to);

  const clickCell = (i: number) => {
    if (won || stuck) return;
    setHint(null);
    if (cells[i] === 1) {
      setSel(sel === i ? null : destsFor(i).length ? i : null);
      return;
    }
    // empty cell: is it a destination for the selection?
    if (sel != null) {
      const mv = moves.find((m) => m.from === sel && m.to === i);
      if (mv) {
        setHistory((h) => [...h, cells]);
        setCells((c) => applyMove(c, mv));
        setSel(null);
      }
    }
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      setCells(h[h.length - 1]);
      return h.slice(0, -1);
    });
    setSel(null);
    setHint(null);
  };

  const centreIdx = shape.index.get(
    `${board === 'triangular' ? '2,1' : '3,3'}`,
  );

  const solveBest = () => solve(cells, shape, 800000, centreIdx) ?? solve(cells, shape, 800000);

  const showHint = () => {
    const sol = solveBest();
    setHint(sol && sol.length ? sol[0] : null);
    setSel(null);
  };

  const autoSolve = () => {
    const sol = solveBest();
    if (!sol) return;
    let c = cells;
    const hist: number[][] = [...history];
    for (const mv of sol) {
      hist.push(c);
      c = applyMove(c, mv);
    }
    setHistory(hist);
    setCells(c);
    setSel(null);
    setHint(null);
  };

  const share = () => {
    const text = shareText(board, moveCount, won, perfect);
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  };

  const shareBoard = () => {
    navigator.clipboard?.writeText(`${location.origin}${location.pathname}?g=${encodeState(board, startRef.current)}`).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  };

  const dests = sel != null ? new Set(destsFor(sel)) : new Set<number>();
  const maxR = Math.max(...shape.cells.map((c) => c.r));

  return (
    <div className="app">
      <header>
        <h1>Peg Solitaire</h1>
        <p className="tag">
          Jump one peg over another into an empty hole and remove the peg you jumped. Clear the
          board down to a single peg — ideally the one in the middle.
        </p>
      </header>

      <div className="seg">
        {BOARDS.map((b) => (
          <button key={b.key} className={board === b.key ? 'on' : ''} onClick={() => reset(b.key)}>
            {b.name}
          </button>
        ))}
      </div>

      <div className="stats">
        <span><b>{pegCount(cells)}</b> {pegCount(cells) === 1 ? 'peg' : 'pegs'}</span>
        <span><b>{moveCount}</b> {moveCount === 1 ? 'move' : 'moves'}</span>
        {won && <span className="win-tag">{perfect ? 'perfect!' : 'solved'}</span>}
        {stuck && <span className="stuck-tag">stuck</span>}
      </div>

      <div className={`board board-${board}`}>
        {board === 'triangular'
          ? Array.from({ length: maxR + 1 }).map((_, r) => (
              <div className="trow" key={r}>
                {shape.cells
                  .map((c, i) => ({ c, i }))
                  .filter((x) => x.c.r === r)
                  .map(({ i }) => (
                    <Hole
                      key={i}
                      state={cells[i]}
                      selected={sel === i}
                      dest={dests.has(i)}
                      hint={hint?.from === i || hint?.to === i}
                      onClick={() => clickCell(i)}
                    />
                  ))}
              </div>
            ))
          : shape.cells.map((c, i) => (
              <div key={i} style={{ gridColumn: c.c + 1, gridRow: c.r + 1 }}>
                <Hole
                  state={cells[i]}
                  selected={sel === i}
                  dest={dests.has(i)}
                  hint={hint?.from === i || hint?.to === i}
                  onClick={() => clickCell(i)}
                />
              </div>
            ))}
      </div>

      {(won || stuck) && (
        <div className={`banner ${won ? 'good' : 'bad'}`}>
          <strong>
            {won
              ? perfect
                ? `Solved in ${moveCount} moves — last peg dead centre!`
                : `Solved in ${moveCount} moves.`
              : `Stuck with ${pegCount(cells)} pegs left.`}
          </strong>
          <div className="b-actions">
            <button onClick={share}>{copied ? 'Copied' : 'Share result'}</button>
            <button onClick={() => reset(board)}>New board</button>
          </div>
        </div>
      )}

      <div className="controls">
        <button onClick={undo} disabled={!history.length}>Undo</button>
        <button onClick={() => reset(board, false)}>Restart</button>
        {!won && !stuck && <button onClick={showHint}>Hint</button>}
        {!won && !stuck && <button onClick={autoSolve}>Solve it</button>}
        <button onClick={shareBoard}>Share board</button>
      </div>

      <section className="explainer">
        <h2>How to play</h2>
        <p>
          Tap a peg to pick it up — its possible landing holes light up — then tap one to jump. The
          peg you hopped over is removed. On the English and European boards jumps are horizontal or
          vertical; on the triangle they follow the three edges.
        </p>
        <h3>Strategy</h3>
        <p>
          Don't clear one area completely and leave stragglers elsewhere. Work in "packages" of
          three, keep the middle busy, and aim to finish with your last few jumps flowing toward
          the centre hole. Every legal position on the standard English board with the centre empty
          can be solved to a single central peg in 31 moves.
        </p>
        <h3>Board shapes</h3>
        <p>
          <b>English</b> is the 33-hole cross. <b>European</b> adds four corner holes for a 37-hole
          octagon — subtly harder, and it cannot finish in the centre from a centre start.
          <b> Triangle</b> is the 15-hole peg game found on diner tables; start with any one hole
          empty.
        </p>
        <p className="note">Hint and "Solve it" use a search that may give up on unusual positions.</p>
        <footer>Peg Solitaire · works offline · no account</footer>
      </section>
    </div>
  );
}

function Hole({
  state,
  selected,
  dest,
  hint,
  onClick,
}: {
  state: number;
  selected: boolean;
  dest: boolean;
  hint: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`hole ${state ? 'peg' : 'empty'} ${selected ? 'sel' : ''} ${dest ? 'dest' : ''} ${hint ? 'hint' : ''}`}
      onClick={onClick}
      aria-label={state ? 'peg' : 'empty hole'}
    />
  );
}

function loadBoard(): Board {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const b = JSON.parse(raw).board;
      if (b === 'english' || b === 'european' || b === 'triangular') return b;
    }
  } catch {
    /* ignore */
  }
  return 'english';
}
