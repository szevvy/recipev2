import { redirect } from "next/navigation";

export default function IngredientsRedirect() {
  redirect("/?tab=ingredients");
}
