"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PALETTE_12 } from "@/lib/types";

const hexRefine = (v: string) =>
  (PALETTE_12 as readonly string[]).includes(v.toUpperCase()) ||
  (PALETTE_12 as readonly string[]).includes(v);

const categorySchema = z.object({
  name: z.string().trim().min(1, "needName").max(40),
  icon: z.string().trim().min(1).max(30),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).refine((v) => (PALETTE_12 as readonly string[]).includes(v.toUpperCase()) || (PALETTE_12 as readonly string[]).includes(v), "bad color"),
});

export async function createCategory(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };
  const parsed = categorySchema.safeParse({
    name: String(formData.get("name") ?? ""),
    icon: String(formData.get("icon") ?? "other"),
    color: String(formData.get("color") ?? "#64748B"),
  });
  if (!parsed.success) return { error: "needName" };
  const { error } = await supabase.from("habit_categories").insert({
    user_id: user.id, ...parsed.data,
  });
  if (error) {
    if (error.code === "23505") return { error: "catExists" };
    return { error: "saveFail" };
  }
  revalidatePath("/habitos");
  revalidatePath("/hoy");
  return {};
}

export async function updateCategory(id: string, formData: FormData) {
  const supabase = await createClient();
  const parsed = categorySchema.safeParse({
    name: String(formData.get("name") ?? ""),
    icon: String(formData.get("icon") ?? "other"),
    color: String(formData.get("color") ?? "#64748B"),
  });
  if (!parsed.success) return { error: "needName" };
  const { error } = await supabase.from("habit_categories").update(parsed.data).eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "catExists" };
    return { error: "saveFail" };
  }
  revalidatePath("/habitos");
  return {};
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();
  await supabase.from("habit_categories").delete().eq("id", id);
  revalidatePath("/habitos");
}
