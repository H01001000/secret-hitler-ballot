import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE = "voter_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Ensures an anonymous voter id cookie (`voter_id`) exists and returns it.
 * The WebSocket endpoint requires this cookie on the upgrade request.
 */
export async function GET() {
  const cookieStore = await cookies();
  let id = cookieStore.get(COOKIE)?.value;
  if (!id) {
    id = randomUUID();
  }
  const res = NextResponse.json({ voterId: id });
  if (!cookieStore.get(COOKIE)?.value) {
    res.cookies.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR,
    });
  }
  return res;
}
