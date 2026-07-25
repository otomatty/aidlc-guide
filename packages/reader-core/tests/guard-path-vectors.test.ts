// Test-only relative import (not a package dependency): the vector table is the
// shared equivalence guarantee for reader-core's guardPath and docs-bridge's
// deliberate duplicate of it. See the note in the vectors module.
import { runGuardPathVectors } from "../../docs-bridge/tests/vectors/guard-path-vectors.ts";
import { guardPath } from "../src/util/guard-path.ts";

runGuardPathVectors("reader-core", guardPath);
