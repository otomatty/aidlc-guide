/**
 * Normalised failure representation — the single failure type crossing the CLI
 * boundary (domain-entities.md `BtwError`, reliability-design R-BTW-1/R-BTW-5).
 */
export interface BtwError {
  /** Non-zero process exit code. */
  code: number;
  /** One line on stderr. Never contains session content (S-BTW-5). */
  message: string;
  /** Optional degraded-path guidance, e.g. the `/branch` alternative. */
  hint?: string;
}

/** Thrown form of {@link BtwError}; `cli.ts` has the only catch that consumes it. */
export class BtwFailure extends Error implements BtwError {
  readonly code: number;
  readonly hint: string | undefined;

  constructor(error: BtwError) {
    super(error.message);
    this.name = "BtwFailure";
    this.code = error.code;
    this.hint = error.hint;
  }
}

/**
 * The single error-construction helper (S-BTW-5). The argument shape admits a
 * short reason, a filesystem path and a fixed hint only — there is no parameter
 * through which session *content* could reach an error message.
 */
export function fail(input: {
  reason: string;
  path?: string;
  hint?: string;
  code?: number;
}): BtwFailure {
  const message =
    input.path === undefined ? input.reason : `${input.reason} (looked in: ${input.path})`;
  return new BtwFailure({ code: input.code ?? 1, message, hint: input.hint });
}
