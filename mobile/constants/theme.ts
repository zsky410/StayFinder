import { DefaultTheme, type Theme } from "@react-navigation/native";

export const theme = {
  colors: {
    page: "#F6F7FC",
    surface: "#FFFFFF",
    surfaceMuted: "#EEF2FF",
    surfacePressed: "#E7EDFF",
    ink: "#141B34",
    muted: "#727A93",
    accent: "#2454EA",
    accentPressed: "#1C46C9",
    sun: "#FF6B00",
    coral: "#E44747",
    plum: "#7A5C8E",
    border: "rgba(20, 27, 52, 0.10)",
    tabBackground: "#FFFFFF",
    chipBackground: "#F1F4FC",
    chipBorder: "#D7DFF5",
  },
} as const;

export const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.page,
    card: theme.colors.surface,
    text: theme.colors.ink,
    border: theme.colors.border,
    primary: theme.colors.accent,
    notification: theme.colors.coral,
  },
};
