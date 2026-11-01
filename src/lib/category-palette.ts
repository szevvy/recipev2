// 20 category colors that sit well against the cream background.
// Each entry has a token (stored in DB), a human label, and the two CSS values
// we use at render time: a soft chip background and a stronger accent for
// borders/text. All picked by eye to match the terracotta/sage/cream theme.

export type CategoryColor = {
  token: string;
  label: string;
  chipBg: string;
  chipText: string;
};

export const CATEGORY_PALETTE: CategoryColor[] = [
  { token: "tomato", label: "Tomato", chipBg: "#fde7e0", chipText: "#9b3418" },
  { token: "paprika", label: "Paprika", chipBg: "#fbdcc8", chipText: "#8a3b11" },
  { token: "pumpkin", label: "Pumpkin", chipBg: "#ffe3c2", chipText: "#8b4a0c" },
  { token: "honey", label: "Honey", chipBg: "#fdeec1", chipText: "#7d5a0b" },
  { token: "mustard", label: "Mustard", chipBg: "#f2e4a3", chipText: "#5f4a04" },
  { token: "olive", label: "Olive", chipBg: "#dde0b2", chipText: "#4a4e14" },
  { token: "sage", label: "Sage", chipBg: "#d5e3cf", chipText: "#2f5331" },
  { token: "fern", label: "Fern", chipBg: "#c8e0c6", chipText: "#1f5a2a" },
  { token: "mint", label: "Mint", chipBg: "#d2eadf", chipText: "#1f5748" },
  { token: "teal", label: "Teal", chipBg: "#c3dedc", chipText: "#17524f" },
  { token: "sky", label: "Sky", chipBg: "#cce0ea", chipText: "#1b4e68" },
  { token: "denim", label: "Denim", chipBg: "#c4d1e5", chipText: "#283e68" },
  { token: "lavender", label: "Lavender", chipBg: "#dcd3e8", chipText: "#432f6b" },
  { token: "plum", label: "Plum", chipBg: "#e5cfd9", chipText: "#5a234c" },
  { token: "rose", label: "Rose", chipBg: "#f1d8dc", chipText: "#8a2a3c" },
  { token: "blush", label: "Blush", chipBg: "#f6e1d6", chipText: "#8a4432" },
  { token: "sand", label: "Sand", chipBg: "#ece0cc", chipText: "#6a4e23" },
  { token: "cocoa", label: "Cocoa", chipBg: "#dec8b4", chipText: "#5e3a18" },
  { token: "stone", label: "Stone", chipBg: "#dcd4c8", chipText: "#4b4337" },
  { token: "slate", label: "Slate", chipBg: "#d1cfd4", chipText: "#363443" },
];

const BY_TOKEN = new Map(CATEGORY_PALETTE.map((c) => [c.token, c]));

export function paletteColor(token: string | null | undefined): CategoryColor | null {
  if (!token) return null;
  return BY_TOKEN.get(token) ?? null;
}
