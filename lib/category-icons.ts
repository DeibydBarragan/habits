export const CATEGORY_ICON_KEYS = [
  "food",
  "coffee",
  "transport",
  "car",
  "travel",
  "home",
  "health",
  "sport",
  "fun",
  "music",
  "games",
  "reading",
  "shopping",
  "gift",
  "bills",
  "pets",
  "work",
  "study",
  "tech",
  "other",
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];
