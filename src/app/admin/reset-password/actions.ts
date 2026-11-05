"use server";

import { createSsrClient } from "@/lib/supabase/ssr";
import { redirect } from "next/navigation";

export type ResetPasswordState = { error: string } | null;

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt の有効バイト上限

export async function updatePassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const rawPassword = formData.get("password");
  const rawConfirm = formData.get("confirmPassword");

  if (typeof rawPassword !== "string" || typeof rawConfirm !== "string") {
    return { error: "パスワードを入力してください" };
  }

  if (!rawPassword || !rawConfirm) {
    return { error: "パスワードを入力してください" };
  }

  if (rawPassword.length < PASSWORD_MIN) {
    return { error: `パスワードは${PASSWORD_MIN}文字以上で設定してください` };
  }

  if (rawPassword.length > PASSWORD_MAX) {
    return { error: "パスワードが長すぎます" };
  }

  if (rawPassword !== rawConfirm) {
    return { error: "パスワードが一致しません" };
  }

  const supabase = await createSsrClient();

  // Server Action でもセッションの有効性を検証する（プロキシ通過後の二重確認）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "セッションが無効です。メールのリンクからやり直してください。",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: rawPassword });

  if (error) {
    console.error("[ResetPassword] updateUser エラー:", error.message);
    return {
      error: "パスワードの更新に失敗しました。もう一度お試しください。",
    };
  }

  // セキュリティのため、パスワード更新後はリカバリーセッションをサインアウトし
  // 新しいパスワードでのログインを促す
  await supabase.auth.signOut();

  // redirect() は Next.js が内部的に例外として扱うため try/catch の外で呼ぶ
  redirect("/admin/login?message=password_updated");
}
