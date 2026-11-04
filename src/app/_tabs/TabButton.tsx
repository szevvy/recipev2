"use client";

export function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  // Reserve the width of the bold variant so toggling `font-semibold` on the
  // active tab doesn't nudge its siblings over by a few pixels.
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid"
    >
      <span
        aria-hidden
        className="row-start-1 col-start-1 font-semibold invisible"
      >
        {label}
      </span>
      <span
        className={
          "row-start-1 col-start-1 text-center " +
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
