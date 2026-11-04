import { redirect } from "next/navigation";

// The shopping list now lives as a tab inside the SPA at `/`. Old bookmarks
// land here and get bounced to the right tab.
export default function ShoppingRedirect() {
  redirect("/?tab=shopping");
}
