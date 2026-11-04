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

// -----------------------------------------------------------------------
// 未回答質問の保存
// -----------------------------------------------------------------------

export type SaveUnansweredQuestionParams = {
  lineEventId: string;
  lineUserId: string | null;
  question: string;
  receivedAt: Date;
};

export type SaveUnansweredQuestionResult =
  | { saved: true }
  | { saved: false; error: string };

/**
 * FAQ完全一致・AI回答のいずれにも該当しなかった質問を保存する。
 * line_event_id を一意キーとして upsert するため、
 * LINE からの再送（redelivery）があっても二重登録しない。
 */
export async function saveUnansweredQuestion(
  params: SaveUnansweredQuestionParams
): Promise<SaveUnansweredQuestionResult> {
  try {
    const supabase = createServerClient();

    const { error } = await supabase
      .from("unanswered_questions")
      .upsert(
        {
          line_event_id: params.lineEventId,
          line_user_id: params.lineUserId,
          question: params.question,
          received_at: params.receivedAt.toISOString(),
        },
        // line_event_id が既に存在する（再送）場合は何もしない
        { onConflict: "line_event_id", ignoreDuplicates: true }
      );

    if (error) {
      console.error("[Supabase] unanswered_questions 保存エラー:", error.message);
      return { saved: false, error: error.message };
    }

    return { saved: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "不明なエラーが発生しました";
    console.error("[Supabase] 予期しないエラー:", message);
    return { saved: false, error: message };
  }
}
