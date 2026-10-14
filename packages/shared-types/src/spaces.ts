export interface SpaceSelection {
  space: string;
  intent: string | null;
}

export interface SpaceCatalog {
  active: string;
  spaces: string[];
  harnesses: Array<{ id: string; label: string }>;
  canSwitch: boolean;
}

export interface SwitchSpaceRequest {
  space: string;
  expectedSpace: string;
  harness: string;
}
