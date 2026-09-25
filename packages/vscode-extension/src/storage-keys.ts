/**
 * VS Code storage keys that onboarding reads to recognise a returning user.
 *
 * They live in this dependency-free module so the onboarding check and the
 * writers name the same keys without importing the panels and sessions that
 * write them.
 */

/** workspaceState: whether the current-stage details are expanded. */
export const NOW_DISCLOSURE_KEY = "aidlc-guide.nowExpanded";

/** workspaceState: the intent the dashboard shows. */
export const SELECTED_INTENT_KEY = "aidlcGuide.selectedIntent";

/** workspaceState: setup completion for one folder. */
export const setupStateKey = (root: string): string => `aidlc-guide.setup.v2:${root}`;
