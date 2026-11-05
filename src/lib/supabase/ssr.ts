import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Components・Server Actions・Route Handlers から使うセッション対応クライアント。
 * anon key + ユーザーセッション Cookie を使う。
 * DB 操作権限は RLS に従う（service_role ではない）。
 */
export async function createSsrClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component のレンダリング後（レスポンス確定済み）では
          // Cookie の書き込みは不可。Route Handler / Server Action 以外の
          // 呼び出しでここに到達するが、セッション読み取りには影響しない。
        }
      },
    },
  });
}
