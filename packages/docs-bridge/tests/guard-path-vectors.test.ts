import { guardPath } from "../src/util/guard-path.ts";
import { runGuardPathVectors } from "./vectors/guard-path-vectors.ts";

runGuardPathVectors("docs-bridge", guardPath);
