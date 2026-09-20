/** H2 boundaries avoid confusing 1.1 with 1.10 or swallowing the next stage. */
export function japaneseStageSection(markdown: string, number: string): string | null {
  const sections = markdown.split(/(?=^## )/m);
  return (
    sections
      .find((section) =>
        new RegExp(`^## (?:ステージ|Stage) ${number.replaceAll(".", "\\.")}(?:[:： \\t]|$)`).test(
          section,
        ),
      )
      ?.trim() ?? null
  );
}
