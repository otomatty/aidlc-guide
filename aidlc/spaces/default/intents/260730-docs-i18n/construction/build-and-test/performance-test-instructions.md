# Performance Test Instructions — Docs i18n

**Strategy:** Standard — no dedicated performance gate in Bolt 1.

## Stance

NFR latency / load targets (if any) are validated qualitatively for the walking skeleton:

- Manifest + TOC + single page resolve must feel instant offline (local FS)
- No load-test harness required before B2 locale matrix

## Deferred

- Optional micro-benchmark on `resolvePage` / `listToc` when content trees grow
- Coverage floor timing for NFR-3 (Bolt 2)

## Command (placeholder)

```bash
# No performance suite yet — intentionally empty for Bolt 1
echo "performance tests: N/A (Bolt 1)"
```
