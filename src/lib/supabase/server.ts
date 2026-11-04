import { createClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------

export type Faq = {
  id: string;
  question: string;
  answer: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// -----------------------------------------------------------------------
// サーバー専用 Supabase クライアント
//
// service_role キーは RLS をバイパスできる管理者権限を持つ。
// このファイルはサーバーサイド（Route Handler / Server Actions）のみで使用し、
// クライアントコンポーネントから import しないこと。
// -----------------------------------------------------------------------

function createServerClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceRoleKey) {
    throw new Error("Supabase 環境変数が設定されていません");
  }

  // 末尾スラッシュ・/rest/v1 を除去する（.env.local の誤記対策）
  // Supabase クライアントが自動付加するため、ベース URL のみ渡す必要がある
  const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

  if (!/^https?:\/\/.+\.supabase\.co$/.test(supabaseUrl)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL の形式が不正です: "${supabaseUrl}"\n` +
        "正しい形式: https://<project-ref>.supabase.co"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // サーバーサイドではセッション管理が不要なため無効化する
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// -----------------------------------------------------------------------
// FAQ 取得関数
// -----------------------------------------------------------------------

export type FaqResult =
  | { data: Faq[]; error: null }
  | { data: null; error: string };

/**
 * is_active = true の FAQ を全件取得する。
 * created_at 昇順で返す。
 */
export async function getActiveFaqs(): Promise<FaqResult> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("faq")
      .select("id, question, answer, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Supabase] faq 取得エラー:", error.message);
      return { data: null, error: error.message };
    }

    return { data: data as Faq[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラーが発生しました";
    console.error("[Supabase] 予期しないエラー:", message);
    return { data: null, error: message };
  }
}
