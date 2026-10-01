"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PALETTE_12 } from "@/lib/types";

const habitSchema = z.object({
  name: z.string().trim().min(1, "needName").max(80),
  type: z.enum(["build", "avoid"]),
  category_id: z.string().uuid().nullable().or(z.literal("")),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  days_active: z.array(z.number().int().min(1).max(7)).min(1),
  next_habit_id: z.string().uuid().nullable().or(z.literal("")),
  tracking_mode: z.enum(["check", "count"]),
  target_count: z.number().int().positive().nullable(),
  unit: z.string().trim().max(20).nullable(),
});

function normUuid(v: string | null | ""): string | null {
  return !v ? null : v;
}

async function wouldCycle(supabase: any, selfId: string | null, nextId: string | null): Promise<boolean> {
  if (!nextId) return false;
  if (selfId && nextId === selfId) return true;
  let cur: string | null = nextId;
  const seen = new Set<string>();
  for (let i = 0; i < 50 && cur; i++) {
    if (cur === selfId) return true;
    if (seen.has(cur)) return true;
    seen.add(cur);
    const { data }: { data: { next_habit_id: string | null } | null } = await supabase.from("habits").select("next_habit_id").eq("id", cur).maybeSingle();
    cur = data?.next_habit_id ?? null;
  }
  return false;
}

export async function createHabit(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  const daysRaw = String(formData.get("days_active") ?? "1,2,3,4,5,6,7");
  const days = daysRaw.split(",").map(Number).filter((n) => n >= 1 && n <= 7);
  const tracking = String(formData.get("tracking_mode") ?? "check");
  const targetRaw = String(formData.get("target_count") ?? "").trim();

  const parsed = habitSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? "build"),
    category_id: String(formData.get("category_id") ?? ""),
    color: String(formData.get("color") ?? "#64748B"),
    days_active: days.length ? days : [1, 2, 3, 4, 5, 6, 7],
    next_habit_id: String(formData.get("next_habit_id") ?? ""),
    tracking_mode: tracking,
    target_count: tracking === "count" && targetRaw ? Number(targetRaw) : null,
    unit: tracking === "count" ? (String(formData.get("unit") ?? "").trim() || null) : null,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return { error: issue === "needName" ? "needName" : "saveFail" };
  }
  if (parsed.data.tracking_mode === "count" && !parsed.data.target_count) {
    return { error: "needTarget" };
  }
  if (!(PALETTE_12 as readonly string[]).includes(parsed.data.color.toUpperCase()) && !(PALETTE_12 as readonly string[]).includes(parsed.data.color)) {
    return { error: "saveFail" };
  }
  const nextId = normUuid(parsed.data.next_habit_id);
  if (await wouldCycle(supabase, null, nextId)) return { error: "cycle" };

  const { error } = await supabase.from("habits").insert({
    user_id: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    category_id: normUuid(parsed.data.category_id),
    color: parsed.data.color.toUpperCase(),
    days_active: parsed.data.days_active,
    next_habit_id: nextId,
    tracking_mode: parsed.data.tracking_mode,
    target_count: parsed.data.target_count,
    unit: parsed.data.unit,
  });
  if (error) return { error: "saveFail" };
  revalidatePath("/habitos");
  revalidatePath("/hoy");
  revalidatePath("/informes");
  return {};
}

export async function updateHabit(id: string, formData: FormData) {
  const supabase = await createClient();
  const daysRaw = String(formData.get("days_active") ?? "1,2,3,4,5,6,7");
  const days = daysRaw.split(",").map(Number).filter((n) => n >= 1 && n <= 7);
  const tracking = String(formData.get("tracking_mode") ?? "check");
  const targetRaw = String(formData.get("target_count") ?? "").trim();

  const parsed = habitSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? "build"),
    category_id: String(formData.get("category_id") ?? ""),
    color: String(formData.get("color") ?? "#64748B"),
    days_active: days.length ? days : [1, 2, 3, 4, 5, 6, 7],
    next_habit_id: String(formData.get("next_habit_id") ?? ""),
    tracking_mode: tracking,
    target_count: tracking === "count" && targetRaw ? Number(targetRaw) : null,
    unit: tracking === "count" ? (String(formData.get("unit") ?? "").trim() || null) : null,
  });
  if (!parsed.success) return { error: "saveFail" };
  if (parsed.data.tracking_mode === "count" && !parsed.data.target_count) {
    return { error: "needTarget" };
  }
  const nextId = normUuid(parsed.data.next_habit_id);
  if (await wouldCycle(supabase, id, nextId)) return { error: "cycle" };

  const { error } = await supabase.from("habits").update({
    name: parsed.data.name,
    type: parsed.data.type,
    category_id: normUuid(parsed.data.category_id),
    color: parsed.data.color.toUpperCase(),
    days_active: parsed.data.days_active,
    next_habit_id: nextId,
    tracking_mode: parsed.data.tracking_mode,
    target_count: parsed.data.target_count,
    unit: parsed.data.unit,
  }).eq("id", id);
  if (error) {
    if (error.message.includes("cycle")) return { error: "cycle" };
    return { error: "saveFail" };
  }
  revalidatePath("/habitos");
  revalidatePath("/hoy");
  revalidatePath("/informes");
  return {};
}

export async function deleteHabit(id: string) {
  const supabase = await createClient();
  // Limpia referencias next_habit_id que apunten a este hábito
  await supabase.from("habits").update({ next_habit_id: null }).eq("next_habit_id", id);
  await supabase.from("habits").delete().eq("id", id);
  revalidatePath("/habitos");
  revalidatePath("/hoy");
  revalidatePath("/informes");
}

export async function archiveHabit(id: string, archived: boolean) {
  const supabase = await createClient();
  if (archived) {
    await supabase.from("habits").update({ next_habit_id: null }).eq("next_habit_id", id);
  }
  await supabase.from("habits").update({ archived }).eq("id", id);
  revalidatePath("/habitos");
  revalidatePath("/hoy");
}
