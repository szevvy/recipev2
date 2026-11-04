"use client";

import { useRef } from "react";

export function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Reserve the width of the bold variant so toggling `font-semibold` on the
  // active tab doesn't nudge its siblings. Also drop the browser focus ring
  // and blur after click so nothing looks "half-selected" while React state
  // catches up.
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => {
        buttonRef.current?.blur();
        onClick();
      }}
      className="grid focus:outline-none"
    >
      <span
        aria-hidden
        className="row-start-1 col-start-1 font-semibold invisible"
      >
        {label}
      </span>
      <span
        className={
          "row-start-1 col-start-1 text-center transition-colors " +
          (active
            ? "font-semibold text-[var(--accent)]"
            : "text-[var(--muted)] hover:text-[var(--foreground)]")
        }
      >
        {label}
      </span>
    </button>
  );
}
