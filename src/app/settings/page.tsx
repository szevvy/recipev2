import { AppHeader } from "@/components/AppHeader";
import { getSettings } from "@/lib/settings";
import { WeekStartPicker } from "./WeekStartPicker";

export const instant = false;

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
      <AppHeader current="/settings" />
      <div>
        <h1 className="font-serif text-3xl text-[var(--foreground)]">Settings</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Household-wide preferences. Changes save instantly.
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-3">
        <div>
          <h2 className="font-serif text-xl text-[var(--foreground)]">Week starts on</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Determines how the meal planner week lays out.
          </p>
        </div>
        <WeekStartPicker initial={settings.week_starts_on} />
      </section>
    </main>
  );
}
