"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function statusFor(habit: { type: string; tracking_mode: string; target_count: number | null }, count: number | null, explicit: "done" | "missed" | null): "done" | "missed" {
  if (explicit) return explicit;
  if (habit.tracking_mode === "count" && count != null && habit.target_count) {
    return habit.type === "avoid"
      ? count <= habit.target_count ? "done" : "missed"
      : count >= habit.target_count ? "done" : "missed";
  }
  return "done";
}

export async function saveLog(habitId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };
  const date = String(formData.get("date") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const countRaw = String(formData.get("count") ?? "").trim();
  if (!dateRe.test(date)) return { error: "saveFail" };
  if (statusRaw !== "done" && statusRaw !== "missed") return { error: "saveFail" };

  const { data: habit } = await supabase.from("habits").select("type,tracking_mode,target_count").eq("id", habitId).maybeSingle();
  if (!habit) return { error: "saveFail" };

  const count = countRaw === "" ? null : Number(countRaw);
  if (countRaw !== "" && (!Number.isFinite(count!) || count! < 0)) return { error: "saveFail" };

  const status = statusFor(habit as any, count, statusRaw as any);

  const { error } = await supabase.from("habit_logs").upsert(
    { user_id: user.id, habit_id: habitId, date, status, count, updated_at: new Date().toISOString() },
    { onConflict: "habit_id,date" }
  );
  if (error) return { error: "saveFail" };
  revalidatePath("/hoy");
  revalidatePath("/informes");
  return { status };
}

export async function bumpCount(habitId: string, date: string, delta: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };
  if (!dateRe.test(date)) return { error: "saveFail" };

  const { data: habit } = await supabase.from("habits").select("type,tracking_mode,target_count").eq("id", habitId).maybeSingle();
  if (!habit) return { error: "saveFail" };
  const { data: prev } = await supabase.from("habit_logs").select("count").eq("habit_id", habitId).eq("date", date).maybeSingle();
  const next = Math.max(0, (prev?.count ?? 0) + delta);
  const status = statusFor(habit as any, next, null);

  const { error } = await supabase.from("habit_logs").upsert(
    { user_id: user.id, habit_id: habitId, date, status, count: next, updated_at: new Date().toISOString() },
    { onConflict: "habit_id,date" }
  );
  if (error) return { error: "saveFail" };
  revalidatePath("/hoy");
  revalidatePath("/informes");
  return { count: next, status };
}

export async function clearLog(habitId: string, date: string) {
  const supabase = await createClient();
  await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("date", date);
  revalidatePath("/hoy");
  revalidatePath("/informes");
}
