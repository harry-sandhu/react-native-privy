import React, { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";
import { Colors } from "./Colors";

type ThemeMode = "light" | "dark";

interface ThemeContextType {
  theme: typeof Colors.light;
  scheme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [manualScheme, setManualScheme] = useState<ThemeMode | null>(null);

  const scheme: ThemeMode =
    manualScheme ?? (systemScheme as ThemeMode) ?? "light";

  const toggleTheme = () => {
    setManualScheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: Colors[scheme],
        scheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be inside ThemeProvider");
  return context;
};