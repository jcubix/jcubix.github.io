// One persistent highlight per navigation bar; content updates immediately.
export function installNavigationMotion() {
  const selector =
    ".app-mobile-nav, .sc-segmented, .workflow-switch, .report-tabs, .activity-tabs, .training-phase-tabs, .training-scope, .attendance-filters";
  const selected =
    'a[aria-current="page"],button[aria-current="page"],button[aria-selected="true"],button[aria-pressed="true"],button.active,button.sc-active';
  const bars = new Map<
    HTMLElement,
    {
      marker: HTMLElement;
      observer: MutationObserver;
      animation?: Animation;
      key?: HTMLElement;
      left?: number;
      top?: number;
      width?: number;
      height?: number;
    }
  >();
  let frame = 0;
  let disposed = false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const schedule = () => {
    if (!frame && !disposed) frame = requestAnimationFrame(update);
  };
  const resize =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(schedule);
  function update() {
    frame = 0;
    for (const [bar, state] of bars)
      if (!bar.isConnected) {
        state.animation?.cancel();
        state.observer.disconnect();
        resize?.unobserve(bar);
        bars.delete(bar);
      }
    document.querySelectorAll<HTMLElement>(selector).forEach((bar) => {
      let state = bars.get(bar);
      const target = bar.querySelector<HTMLElement>(selected);
      if (!target || !bar.getBoundingClientRect().width || target.hidden) {
        if (state) state.marker.hidden = true;
        return;
      }
      if (!state) {
        const marker = document.createElement("span");
        marker.className = "club-nav-highlight";
        marker.setAttribute("aria-hidden", "true");
        bar.prepend(marker);
        bar.classList.add("club-motion-nav");
        const observer = new MutationObserver(schedule);
        state = { marker, observer };
        bars.set(bar, state);
        resize?.observe(bar);
        observer.observe(bar, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: [
            "aria-current",
            "aria-selected",
            "aria-pressed",
            "class",
            "hidden",
          ],
        });
      }
      const { marker } = state;
      const from = marker.getBoundingClientRect();
      const bounds = bar.getBoundingClientRect(),
        to = target.getBoundingClientRect();
      const left = to.left - bounds.left + bar.scrollLeft - bar.clientLeft;
      const top = to.top - bounds.top + bar.scrollTop - bar.clientTop;
      if (
        state.key === target &&
        state.left === left &&
        state.top === top &&
        state.width === to.width &&
        state.height === to.height &&
        !marker.hidden
      )
        return;
      const animate =
        !!state.key &&
        !marker.hidden &&
        state.key !== target &&
        !reduced.matches &&
        document.documentElement.dataset.uiInput !== "keyboard" &&
        !!marker.animate;
      state.animation?.cancel();
      marker.hidden = false;
      Object.assign(marker.style, {
        left: left + "px",
        top: top + "px",
        width: to.width + "px",
        height: to.height + "px",
      });
      if (animate && from.width && to.width && from.height && to.height) {
        state.animation = marker.animate(
          [
            {
              transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${from.width / to.width},${from.height / to.height})`,
            },
            { transform: "translate(0,0) scale(1,1)" },
          ],
          { duration: 280, easing: "cubic-bezier(0.16,1,0.3,1)" },
        );
      }
      Object.assign(state, {
        key: target,
        left,
        top,
        width: to.width,
        height: to.height,
      });
    });
  }
  const observer = new MutationObserver((records) => {
    if (
      records.some((record) =>
        [...record.addedNodes, ...record.removedNodes].some(
          (node) =>
            node instanceof Element &&
            (node.matches(selector) || node.querySelector(selector)),
        ),
      )
    )
      schedule();
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
  });
  const settled = (event: TransitionEvent) => {
    if (
      event.propertyName === "transform" &&
      event.target instanceof Element &&
      event.target.closest(selector)
    )
      schedule();
  };
  const stopMotion = () => {
    if (reduced.matches)
      for (const state of bars.values()) state.animation?.cancel();
  };
  reduced.addEventListener?.("change", stopMotion);
  window.addEventListener("resize", schedule);
  document.addEventListener("transitionend", settled);
  schedule();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    resize?.disconnect();
    window.removeEventListener("resize", schedule);
    document.removeEventListener("transitionend", settled);
    reduced.removeEventListener?.("change", stopMotion);
    for (const [bar, state] of bars) {
      state.animation?.cancel();
      state.observer.disconnect();
      state.marker.remove();
      bar.classList.remove("club-motion-nav");
    }
    bars.clear();
  };
}
