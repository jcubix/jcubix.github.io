import type { Page } from "./types";

export interface Surface {
  id: number;
  kind: string;
  data: unknown;
  page?: Page;
  detail?: string;
  workspace?: boolean;
}
let next = 0;
let snapshot: { surfaces: Surface[]; toast: string } = {
  surfaces: [],
  toast: "",
};
const listeners = new Set<() => void>();
const guards = new Map<number, () => boolean | Promise<boolean>>();
let detailPresenter: ((surface: Surface | null) => void) | null = null;
const emit = () => {
  for (const listener of listeners) listener();
};
let toastTimer: ReturnType<typeof setTimeout>;
export const ui = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,
  setDetailPresenter(presenter: typeof detailPresenter) {
    detailPresenter = presenter;
  },
  open(
    kind: string,
    data: unknown = {},
    options: Partial<Pick<Surface, "page" | "detail" | "workspace">> = {},
  ) {
    const surface = { id: ++next, kind, data, ...options };
    snapshot = { ...snapshot, surfaces: [...snapshot.surfaces, surface] };
    emit();
    if (surface.detail) detailPresenter?.(surface);
    return surface.id;
  },
  replace(id: number, kind: string, data: unknown) {
    guards.delete(id);
    snapshot = {
      ...snapshot,
      surfaces: snapshot.surfaces.map((surface) =>
        surface.id === id ? { ...surface, id: ++next, kind, data } : surface,
      ),
    };
    emit();
  },
  guard(id: number, guard: () => boolean | Promise<boolean>) {
    guards.set(id, guard);
    return () => {
      if (guards.get(id) === guard) guards.delete(id);
    };
  },
  async close(
    id: number,
    force = false,
    options: { restoreRoute?: boolean } = {},
  ) {
    if (!force && !(await (guards.get(id)?.() ?? true))) return false;
    const surface = snapshot.surfaces.find((item) => item.id === id);
    if (!surface) return true;
    guards.delete(id);
    snapshot = {
      ...snapshot,
      surfaces: snapshot.surfaces.filter((item) => item.id !== id),
    };
    emit();
    if (
      options.restoreRoute !== false &&
      surface.detail &&
      !snapshot.surfaces.some((item) => item.detail)
    )
      detailPresenter?.(null);
    return true;
  },
  async closeAll(options: { restoreRoute?: boolean } = {}) {
    for (const surface of [...snapshot.surfaces].reverse())
      if (!(await ui.close(surface.id, false, options))) return false;
    return true;
  },
  reset() {
    guards.clear();
    snapshot = { surfaces: [], toast: "" };
    clearTimeout(toastTimer);
    emit();
  },
  notify(toast: string) {
    clearTimeout(toastTimer);
    snapshot = { ...snapshot, toast };
    emit();
    toastTimer = setTimeout(() => {
      snapshot = { ...snapshot, toast: "" };
      emit();
    }, 3000);
  },
};
