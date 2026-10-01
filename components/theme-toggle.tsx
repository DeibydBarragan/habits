"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@heroui/react";

type Theme = "light" | "dark";

export function getStoredTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle({ labelLight, labelDark }: { labelLight: string; labelDark: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getStoredTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = (mounted ? theme : getStoredTheme()) === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("habits-theme", next);
    } catch {
      // solo memoria
    }
    setTheme(next);
    setMounted(true);
  }

  const shown: Theme = mounted ? theme : "light";

  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      aria-label={shown === "dark" ? labelLight : labelDark}
      onPress={toggle}
    >
      {shown === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
}
