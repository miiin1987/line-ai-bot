import { createSsrClient } from "@/lib/supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Supabase Auth PKCE フロー用コールバックエンドポイント。
 *
 * パスワード再設定メールのリンクは以下の形式でここへ遷移する:
 *   /auth/callback?code=<pkce_code>
 *
 * code を session に交換し、パスワード再設定画面へリダイレクトする。
 * code が無効・期限切れの場合はログイン画面へリダイレクトする。
 *
 * Supabase Dashboard > Authentication > URL Configuration に
 * このパスを Redirect URL として登録する必要がある。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    console.warn("[Auth Callback] code パラメータが存在しません");
    return NextResponse.redirect(
      new URL("/admin/login?error=invalid_link", origin)
    );
  }

  const supabase = await createSsrClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[Auth Callback] セッション交換エラー:", error.message);
    return NextResponse.redirect(
      new URL("/admin/login?error=expired_link", origin)
    );
  }

  // セッション確立成功 → パスワード再設定画面へ
  // ログイン済みユーザーが誤ってアクセスした場合も同じ画面に誘導する
  return NextResponse.redirect(new URL("/admin/reset-password", origin));
}
