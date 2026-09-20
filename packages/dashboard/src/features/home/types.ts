export interface HomePageProps {
  onSelectStage: (slug: string) => void;
  onSelectCell: (unit: string, stage: string) => void;
  onRetry: () => void;
  purposes: Readonly<Record<string, string>>;
}
