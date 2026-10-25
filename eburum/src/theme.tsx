import { useEffect, useState } from "react";
export type ThemePreference = "light" | "dark" | "system";
const key = "eburum.theme";
function saved(): ThemePreference {
  try {
    const value = localStorage.getItem(key);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}
function apply(value: ThemePreference) {
  const dark =
    value === "dark" ||
    (value === "system" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  const background = getComputedStyle(document.documentElement)
    .getPropertyValue("--bg")
    .trim();
  if (background)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", background);
}
export function initializeTheme() {
  apply(saved());
}
export function ThemePicker() {
  const [value, setValue] = useState<ThemePreference>(saved);
  useEffect(() => {
    apply(value);
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const changed = () => apply(value);
    media?.addEventListener("change", changed);
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) setValue(saved());
    };
    window.addEventListener("storage", sync);
    return () => {
      media?.removeEventListener("change", changed);
      window.removeEventListener("storage", sync);
    };
  }, [value]);
  return (
    <label className="theme-picker">
      Aspetto
      <select
        aria-label="Tema dell’app"
        value={value}
        onChange={(event) => {
          const next = event.target.value as ThemePreference;
          setValue(next);
          try {
            localStorage.setItem(key, next);
          } catch {
            /* The theme still works when storage is unavailable. */
          }
        }}
      >
        <option value="light">Chiaro</option>
        <option value="dark">Scuro</option>
        <option value="system">Sistema</option>
      </select>
    </label>
  );
}
