"use server";

import { revalidatePath } from "next/cache";
import { createSsrClient } from "@/lib/supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

export type QuestionStatus = "未対応" | "対応済み" | "対応不要";

export type UnansweredQuestion = {
  id: string;
  line_user_id: string | null;
  question: string;
  received_at: string;
  status: QuestionStatus;
};

export type QuestionActionState =
  | { type: "error"; message: string }
  | { type: "success" }
  | null;

const VALID_STATUSES: readonly QuestionStatus[] = [
  "未対応",
  "対応済み",
  "対応不要",
];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdmin(): Promise<void> {
  const supabase = await createSsrClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") {
    throw new Error("権限がありません");
  }
}

export async function updateQuestionStatus(
  _prevState: QuestionActionState,
  formData: FormData
): Promise<QuestionActionState> {
  try {
    await requireAdmin();

    const id = ((formData.get("id") as string) ?? "").trim();
    const status = ((formData.get("status") as string) ?? "").trim();

    if (!UUID_RE.test(id)) {
      return { type: "error", message: "不正なIDです" };
    }
    if (!VALID_STATUSES.includes(status as QuestionStatus)) {
      return { type: "error", message: "不正な対応状況です" };
    }

    const { error } = await createAdminClient()
      .from("unanswered_questions")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("[未回答] 状況更新エラー:", error.message);
      return { type: "error", message: "対応状況の更新に失敗しました" };
    }

    revalidatePath("/admin/unanswered");
    return { type: "success" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "予期しないエラーが発生しました";
    if (message !== "権限がありません")
      console.error("[未回答] 予期しないエラー:", message);
    return { type: "error", message };
  }
}
