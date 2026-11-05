"use server";

import { createSsrClient } from "@/lib/supabase/ssr";
import { redirect } from "next/navigation";

export type LoginState = { error: string } | null;

const EMAIL_MAX = 254;
const PASSWORD_MAX = 72; // bcrypt の有効バイト上限

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");

  if (typeof rawEmail !== "string" || typeof rawPassword !== "string") {
    return { error: "メールアドレスとパスワードを入力してください" };
  }

  const email = rawEmail.trim();
  const password = rawPassword;

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください" };
  }

  if (email.length > EMAIL_MAX || password.length > PASSWORD_MAX) {
    // 存在確認を避けるため詳細は返さない
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "メールアドレスの形式が正しくありません" };
  }

  const supabase = await createSsrClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  // サーバー側で管理者ロールを検証する。
  // app_metadata はサーバーからしか書き込めないため、ユーザー自身による改ざん不可。
  if (data.user.app_metadata?.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "アクセス権限がありません" };
  }

  // redirect() は Next.js が内部的に例外として扱うため try/catch の外で呼ぶ
  redirect("/admin");
}
