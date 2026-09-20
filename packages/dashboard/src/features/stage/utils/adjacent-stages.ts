export function adjacentStages(
  stages: readonly { slug: string }[],
  slug: string,
): { prev: string | null; next: string | null } {
  const index = stages.findIndex((stage) => stage.slug === slug);
  if (index < 0) return { prev: null, next: null };
  return {
    prev: index > 0 ? (stages[index - 1]?.slug ?? null) : null,
    next: index < stages.length - 1 ? (stages[index + 1]?.slug ?? null) : null,
  };
}
