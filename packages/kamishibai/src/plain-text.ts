/** Strip the `**` emphasis markers, leaving the plain text that is read and captioned. */
export function plainText(text: string): string {
  return text.replaceAll("**", "");
}
