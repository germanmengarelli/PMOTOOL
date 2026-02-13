export const PROJECT_PHASES = ["F0", "F1", "F2", "F3", "F4", "F5", "F6"] as const;
export type ProjectPhase = (typeof PROJECT_PHASES)[number];

export const VERTICALS = [
  "CYBERSECURITY",
  "CYBERSECURITY_OT",
  "NETWORKING",
  "ENGINEERING",
] as const;

export type Vertical = (typeof VERTICALS)[number];