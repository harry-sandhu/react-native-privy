const tintColorLight = "#4F46E5";
const tintColorDark = "#6366F1";

export const Colors = {
  light: {
    // Base
    background: "#F8FAFC",
    surface: "#FFFFFF",
    card: "#FFFFFF",

    // Text
    text: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#94A3B8",

    // Brand
    primary: "#4F46E5",       // Indigo strong
    primaryDark: "#4338CA",
    accent: "#06B6D4",        // Cyan accent

    // UI
    border: "#E2E8F0",
    inputBackground: "#F1F5F9",
    placeholder: "#94A3B8",

    // Status
    success: "#16A34A",
    warning: "#F59E0B",
    error: "#EF4444",

    // Tabs
    tint: tintColorLight,
    icon: "#64748B",
    tabIconDefault: "#94A3B8",
    tabIconSelected: tintColorLight,
  },

  dark: {
    // Base
    background: "#0B0F1A",     // Deep Web3 navy
    surface: "#111827",
    card: "#111827",

    // Text
    text: "#F8FAFC",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",

    // Brand
    primary: "#6366F1",        // Electric indigo
    primaryDark: "#4F46E5",
    accent: "#22D3EE",

    // UI
    border: "#1F2937",
    inputBackground: "#1E293B",
    placeholder: "#64748B",

    // Status
    success: "#22C55E",
    warning: "#FBBF24",
    error: "#F87171",

    // Tabs
    tint: tintColorDark,
    icon: "#94A3B8",
    tabIconDefault: "#64748B",
    tabIconSelected: tintColorDark,
  },
};