import { createClient } from "@supabase/supabase-js";

/**
 * Service Role キーを使う管理者専用 Supabase クライアント。
 * RLS をバイパスするため、サーバーサイド（Server Actions / Route Handlers）のみで使用すること。
 */
export function createAdminClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceRoleKey) {
    throw new Error("Supabase 環境変数が設定されていません");
  }

  const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
