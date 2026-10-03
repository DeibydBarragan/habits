"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getLang } from "@/lib/i18n/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "needName" };
  const { error } = await supabase.from("profiles").update({ name }).eq("id", user.id);
  if (error) return { error: "saveFail" };
  revalidatePath("/ajustes");
  return {};
}

export async function resetStreaks() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };
  const { error } = await supabase.from("habit_logs").delete().eq("user_id", user.id);
  if (error) return { error: "saveFail" };
  revalidatePath("/hoy");
  revalidatePath("/informes");
  return {};
}

export async function setPassword(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };
  const t = dictionaries[await getLang()];
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return { error: t.errors.passTooShort };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: t.errors.saveFail };
  return {};
}

export async function deleteAccount() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "deleteFail" };
  await supabase.auth.signOut();
  redirect("/login");
}
