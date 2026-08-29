import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeColor = "dark" | "blue" | "purple" | "green" | "red" | "amber";

interface ThemeColorContextType {
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
}

const ThemeColorContext = createContext<ThemeColorContextType | undefined>(undefined);

export function ThemeColorProvider({ children }: { children: React.ReactNode }) {
  const [themeColor, setThemeColorState] = useState<ThemeColor>("dark");
  const [mounted, setMounted] = useState(false);

  // 로컬 스토리지에서 테마 로드
  useEffect(() => {
    const saved = localStorage.getItem("themeColor") as ThemeColor | null;
    if (saved) {
      setThemeColorState(saved);
    }
    setMounted(true);
  }, []);

  const setThemeColor = (color: ThemeColor) => {
    setThemeColorState(color);
    localStorage.setItem("themeColor", color);
    document.documentElement.setAttribute("data-theme-color", color);
  };

  // 초기 테마 적용
  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-theme-color", themeColor);
    }
  }, [themeColor, mounted]);

  return (
    <ThemeColorContext.Provider value={{ themeColor, setThemeColor }}>
      {children}
    </ThemeColorContext.Provider>
  );
}

export function useThemeColor() {
  const context = useContext(ThemeColorContext);
  if (!context) {
    throw new Error("useThemeColor must be used within ThemeColorProvider");
  }
  return context;
}
