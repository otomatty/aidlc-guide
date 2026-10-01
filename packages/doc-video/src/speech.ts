import { plainText } from "@aidlc-guide/kamishibai/plain-text";

/** Text as it is spoken: emphasis markers and surrounding whitespace removed. */
export function plainTextForSpeech(text: string): string {
  return plainText(text).replace(/\s+/g, " ").trim();
}
