import { redirect } from "next/navigation";

export default function PlanRedirect() {
  redirect("/?tab=plan");
}
