// Minimal shared-password gate. The browser sends the password in the
// x-app-password header; we compare it to APP_PASSWORD (server env only).

import { NextRequest } from "next/server";

export function checkPassword(req: NextRequest): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false; // fail closed if not configured
  const got = req.headers.get("x-app-password") || "";
  // constant-ish time compare
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
