/**
 * The one home of the read-boundary primitives. reader-core and docs-bridge
 * used to carry deliberate duplicates of these (nfr-design/security-design.md
 * S-DB-2 named duplication as the default because reader-core's chokidar
 * dependency could not be pulled into docs-bridge's install closure); this
 * dependency-free package retires that trade-off — one implementation, one
 * test suite, no drift vectors needed.
 */
export { guardPath } from "./guard-path.ts";
export { mapBounded } from "./map-bounded.ts";
export type { BoundedRead, BoundedReason } from "./read-bounded.ts";
export { MAX_READ_BYTES, readBounded, readTail, VERDICT_TAIL_BYTES } from "./read-bounded.ts";
export { withResult } from "./with-result.ts";
