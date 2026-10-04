import { cookies, headers } from "next/headers";
import { toLocalISODate } from "@/lib/types";

export async function getServerTimeZone(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const cookieTz = cookieStore.get("user-tz")?.value;
    if (cookieTz) return decodeURIComponent(cookieTz);

    const headerList = await headers();
    const vercelTz = headerList.get("x-vercel-ip-timezone");
    if (vercelTz) return vercelTz;
  } catch {
    // Fallback if accessed outside request context
  }
  return undefined;
}

export async function getServerToday(): Promise<string> {
  const tz = await getServerTimeZone();
  return toLocalISODate(new Date(), tz);
}
