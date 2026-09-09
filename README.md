# Peg Solitaire

The classic jump-and-remove board puzzle, in the browser.

- Jump a peg over an adjacent peg into an empty hole; the jumped peg is removed
- Boards: **English** 33-hole cross, **European** 37-hole octagon, **15-hole
  triangle**
- Tap a peg → landing holes light up → tap to jump
- **Undo**, **Restart**, a **Hint**, and a **Solve it** button (DFS solver)
- Peg + move counters, "perfect" when the last peg is central
- Spoiler-free result share + a "share this board" link (`?g=e.0111…`)
- No account, no network, no tracking

## Develop

```
npm install
npm run dev
npm run build      # tsc --noEmit && vite build
node --experimental-strip-types src/peg.test.mjs
```

The engine (board geometry, moves, DFS solver) is in `src/peg.ts`. 9 Node
tests in `src/peg.test.mjs`, including that the solver clears the standard
English board in 31 moves and the triangle board in 13.

## Deploy

Static assets on Cloudflare Workers (`wrangler.jsonc`). Live at
<https://peg-solitaire.correia95.workers.dev/>.
