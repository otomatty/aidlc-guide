/**
 * Text-to-speech providers. One call per caption: a caption's audio length
 * becomes its on-screen time, so no word-level timing is ever needed.
 *
 * The API key is read from the environment by the caller and passed in; it
 * is never logged, written to disk, or included in an error message.
 */

export interface TtsRequest {
  text: string;
  voice: string;
  /** BCP-47, e.g. `ja`. */
  language: string;
}

export interface TtsProvider {
  /** Part of the cache key: changing provider re-synthesizes everything. */
  readonly id: string;
  /** Encoded audio (any container ffmpeg reads; MP3 by default for Grok). */
  synthesize(request: TtsRequest): Promise<Uint8Array>;
}

/** Grok TTS voices (xAI, 2026). */
export const GROK_VOICES = ["eve", "ara", "rex", "sal", "leo"] as const;

/** xAI list price: USD per million characters. */
const GROK_USD_PER_MILLION_CHARS = 15;

export function estimateGrokCostUsd(characters: number): number {
  return (characters / 1_000_000) * GROK_USD_PER_MILLION_CHARS;
}

const GROK_ENDPOINT = "https://api.x.ai/v1/tts";
/** 1, 2, 4, 8, 16 s between attempts (design: rate limits and transient failures). */
const BACKOFF_SECONDS = [1, 2, 4, 8, 16];

export class TtsError extends Error {}

export interface GrokOptions {
  apiKey: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Seconds from a Retry-After header (delta-seconds form), when present and sane. */
function retryAfter(response: Response): number | null {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 && value <= 120 ? value : null;
}

export function createGrokTts(options: GrokOptions): TtsProvider {
  if (options.apiKey.trim() === "") throw new TtsError("XAI_API_KEY is empty");
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  return {
    id: "grok",
    async synthesize({ text, voice, language }) {
      for (let attempt = 0; ; attempt++) {
        let response: Response;
        try {
          response = await doFetch(GROK_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${options.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text, voice_id: voice, language }),
          });
        } catch (cause) {
          if (attempt >= BACKOFF_SECONDS.length) {
            throw new TtsError(
              `Grok TTS unreachable: ${cause instanceof Error ? cause.message : String(cause)}`,
            );
          }
          await sleep((BACKOFF_SECONDS[attempt] ?? 16) * 1000);
          continue;
        }
        if (response.ok) {
          const audio = new Uint8Array(await response.arrayBuffer());
          if (audio.byteLength === 0) throw new TtsError("Grok TTS returned no audio");
          return audio;
        }
        const transient = response.status === 429 || response.status >= 500;
        if (!transient || attempt >= BACKOFF_SECONDS.length) {
          const detail = (await response.text().catch(() => "")).slice(0, 300);
          throw new TtsError(
            `Grok TTS failed: HTTP ${response.status}${detail ? ` — ${detail}` : ""}`,
          );
        }
        await sleep((retryAfter(response) ?? BACKOFF_SECONDS[attempt] ?? 16) * 1000);
      }
    },
  };
}

/**
 * Stand-in narration: a soft tone as long as the caption would take to read.
 * Exercises the whole pipeline (trim, measure, mix, encode) without an API key.
 */
export function createToneTts(
  render: (seconds: number) => Uint8Array,
  estimate: (text: string) => number,
): TtsProvider {
  return {
    id: "tone",
    async synthesize({ text }) {
      return render(Math.max(0.5, estimate(text)));
    },
  };
}
