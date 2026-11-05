"use server";

import { revalidatePath } from "next/cache";
import { createSsrClient } from "@/lib/supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

export type FaqActionState =
  | { type: "error"; message: string }
  | { type: "success" }
  | null;

const QUESTION_MAX = 500;
const ANSWER_MAX = 2000;
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

export async function createFaq(
  _prevState: FaqActionState,
  formData: FormData
): Promise<FaqActionState> {
  try {
    await requireAdmin();

    const question = ((formData.get("question") as string) ?? "").trim();
    const answer = ((formData.get("answer") as string) ?? "").trim();
    const isActive = formData.has("is_active");

    if (!question || !answer) {
      return { type: "error", message: "質問と回答を入力してください" };
    }
    if (question.length > QUESTION_MAX) {
      return {
        type: "error",
        message: `質問は${QUESTION_MAX}文字以内で入力してください`,
      };
    }
    if (answer.length > ANSWER_MAX) {
      return {
        type: "error",
        message: `回答は${ANSWER_MAX}文字以内で入力してください`,
      };
    }

    const { error } = await createAdminClient()
      .from("faq")
      .insert({ question, answer, is_active: isActive });

    if (error) {
      console.error("[FAQ] 作成エラー:", error.message);
      return { type: "error", message: "FAQの作成に失敗しました" };
    }

    revalidatePath("/admin/faq");
    return { type: "success" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "予期しないエラーが発生しました";
    if (message !== "権限がありません") console.error("[FAQ] 予期しないエラー:", message);
    return { type: "error", message };
  }
}

export async function updateFaq(
  _prevState: FaqActionState,
  formData: FormData
): Promise<FaqActionState> {
  try {
    await requireAdmin();

    const id = ((formData.get("id") as string) ?? "").trim();
    const question = ((formData.get("question") as string) ?? "").trim();
    const answer = ((formData.get("answer") as string) ?? "").trim();
    const isActive = formData.has("is_active");

    if (!UUID_RE.test(id)) {
      return { type: "error", message: "不正なFAQ IDです" };
    }
    if (!question || !answer) {
      return { type: "error", message: "質問と回答を入力してください" };
    }
    if (question.length > QUESTION_MAX) {
      return {
        type: "error",
        message: `質問は${QUESTION_MAX}文字以内で入力してください`,
      };
    }
    if (answer.length > ANSWER_MAX) {
      return {
        type: "error",
        message: `回答は${ANSWER_MAX}文字以内で入力してください`,
      };
    }

    const { error } = await createAdminClient()
      .from("faq")
      .update({
        question,
        answer,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[FAQ] 更新エラー:", error.message);
      return { type: "error", message: "FAQの更新に失敗しました" };
    }

    revalidatePath("/admin/faq");
    return { type: "success" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "予期しないエラーが発生しました";
    if (message !== "権限がありません") console.error("[FAQ] 予期しないエラー:", message);
    return { type: "error", message };
  }
}

export async function deleteFaq(
  _prevState: FaqActionState,
  formData: FormData
): Promise<FaqActionState> {
  try {
    await requireAdmin();

    const id = ((formData.get("id") as string) ?? "").trim();

    if (!UUID_RE.test(id)) {
      return { type: "error", message: "不正なFAQ IDです" };
    }

    const { error } = await createAdminClient()
      .from("faq")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[FAQ] 削除エラー:", error.message);
      return { type: "error", message: "FAQの削除に失敗しました" };
    }

    revalidatePath("/admin/faq");
    return { type: "success" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "予期しないエラーが発生しました";
    if (message !== "権限がありません") console.error("[FAQ] 予期しないエラー:", message);
    return { type: "error", message };
  }
}

export async function toggleFaqActive(
  _prevState: FaqActionState,
  formData: FormData
): Promise<FaqActionState> {
  try {
    await requireAdmin();

    const id = ((formData.get("id") as string) ?? "").trim();
    const newActive = formData.get("new_active") === "true";

    if (!UUID_RE.test(id)) {
      return { type: "error", message: "不正なFAQ IDです" };
    }

    const { error } = await createAdminClient()
      .from("faq")
      .update({ is_active: newActive, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("[FAQ] 有効/無効切り替えエラー:", error.message);
      return { type: "error", message: "FAQの状態変更に失敗しました" };
    }

    revalidatePath("/admin/faq");
    return { type: "success" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "予期しないエラーが発生しました";
    if (message !== "権限がありません") console.error("[FAQ] 予期しないエラー:", message);
    return { type: "error", message };
  }
}
