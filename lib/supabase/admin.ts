import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "./env";

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  return createClient(NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
