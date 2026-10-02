"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function statusFor(
  habit: { type: string; tracking_mode: string; target_count: number | null; counters?: Array<{ id: string; target_count: number }> | null },
  count: number | null,
  counts: Record<string, number> | null,
  explicit: "done" | "missed" | null
): "done" | "missed" {
  if (explicit) return explicit;
  if (habit.tracking_mode === "count") {
    if (habit.counters && habit.counters.length > 0) {
      const cMap = counts || {};
      const allDone = habit.counters.every((c) => {
        const cur = cMap[c.id] ?? 0;
        return habit.type === "avoid" ? cur <= c.target_count : cur >= c.target_count;
      });
      return allDone ? "done" : "missed";
    }
    if (count != null && habit.target_count) {
      return habit.type === "avoid"
        ? count <= habit.target_count ? "done" : "missed"
        : count >= habit.target_count ? "done" : "missed";
    }
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
  const countsRaw = String(formData.get("counts") ?? "").trim();
  if (!dateRe.test(date)) return { error: "saveFail" };
  if (statusRaw !== "done" && statusRaw !== "missed") return { error: "saveFail" };

  const { data: habit } = await supabase.from("habits").select("type,tracking_mode,target_count,counters").eq("id", habitId).maybeSingle();
  if (!habit) return { error: "saveFail" };

  let parsedCounts: Record<string, number> | null = null;
  if (countsRaw) {
    try {
      parsedCounts = JSON.parse(countsRaw);
    } catch {
      // ignore
    }
  }

  if (!parsedCounts && habit.counters && habit.counters.length > 0) {
    if (statusRaw === "done") {
      parsedCounts = {};
      for (const c of habit.counters) {
        parsedCounts[c.id] = c.target_count;
      }
    } else if (statusRaw === "missed") {
      parsedCounts = {};
      for (const c of habit.counters) {
        parsedCounts[c.id] = 0;
      }
    }
  }

  let count = countRaw === "" ? null : Number(countRaw);
  if (countRaw !== "" && (!Number.isFinite(count!) || count! < 0)) return { error: "saveFail" };
  if (parsedCounts && count == null) {
    count = Object.values(parsedCounts).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  const status = statusFor(habit as any, count, parsedCounts, statusRaw as any);

  const { error } = await supabase.from("habit_logs").upsert(
    {
      user_id: user.id,
      habit_id: habitId,
      date,
      status,
      count,
      counts: parsedCounts ?? {},
      updated_at: new Date().toISOString()
    },
    { onConflict: "habit_id,date" }
  );
  if (error) return { error: "saveFail" };
  revalidatePath("/hoy");
  revalidatePath("/informes");
  return { status, count, counts: parsedCounts };
}

export async function bumpCount(habitId: string, date: string, delta: number, counterId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };
  if (!dateRe.test(date)) return { error: "saveFail" };

  const { data: habit } = await supabase.from("habits").select("type,tracking_mode,target_count,counters").eq("id", habitId).maybeSingle();
  if (!habit) return { error: "saveFail" };
  const { data: prev } = await supabase.from("habit_logs").select("count,counts").eq("habit_id", habitId).eq("date", date).maybeSingle();

  let nextCount: number;
  let nextCounts: Record<string, number> | null = prev?.counts ?? null;

  if (counterId) {
    const updatedCounts: Record<string, number> = { ...(prev?.counts ?? {}) };
    const curVal = updatedCounts[counterId] ?? 0;
    const nextVal = Math.max(0, curVal + delta);
    updatedCounts[counterId] = nextVal;
    nextCount = Object.values(updatedCounts).reduce((a, b) => a + (Number(b) || 0), 0);
    nextCounts = updatedCounts;
  } else {
    nextCount = Math.max(0, (prev?.count ?? 0) + delta);
    if (habit.counters && habit.counters.length > 0) {
      const updatedCounts: Record<string, number> = { ...(prev?.counts ?? {}) };
      const firstId = habit.counters[0].id;
      const curVal = updatedCounts[firstId] ?? 0;
      updatedCounts[firstId] = Math.max(0, curVal + delta);
      nextCount = Object.values(updatedCounts).reduce((a, b) => a + (Number(b) || 0), 0);
      nextCounts = updatedCounts;
    }
  }

  const status = statusFor(habit as any, nextCount, nextCounts, null);

  const { error } = await supabase.from("habit_logs").upsert(
    {
      user_id: user.id,
      habit_id: habitId,
      date,
      status,
      count: nextCount,
      counts: nextCounts ?? {},
      updated_at: new Date().toISOString()
    },
    { onConflict: "habit_id,date" }
  );
  if (error) return { error: "saveFail" };
  revalidatePath("/hoy");
  revalidatePath("/informes");
  return { count: nextCount, counts: nextCounts, status };
}

export async function clearLog(habitId: string, date: string) {
  const supabase = await createClient();
  await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("date", date);
  revalidatePath("/hoy");
  revalidatePath("/informes");
}
