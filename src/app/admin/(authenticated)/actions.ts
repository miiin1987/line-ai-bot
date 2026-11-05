"use server";

import { createSsrClient } from "@/lib/supabase/ssr";
import { redirect } from "next/navigation";

export async function logout() {
  const supabase = await createSsrClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
