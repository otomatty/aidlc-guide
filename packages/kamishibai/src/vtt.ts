import { plainText } from "./plain-text.ts";

export interface TimedText {
  text: string;
  start: number;
  end: number;
}

/** `hh:mm:ss.mmm`, the WebVTT cue timestamp. */
export function vttTimestamp(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** Captions as a WebVTT document, emphasis markers stripped. */
export function toVTT(cues: readonly TimedText[]): string {
  const body = cues
    .map(
      (c, i) =>
        `${i + 1}\n${vttTimestamp(c.start)} --> ${vttTimestamp(c.end)}\n${plainText(c.text)}\n`,
    )
    .join("\n");
  return `WEBVTT\n\n${body}`;
}
