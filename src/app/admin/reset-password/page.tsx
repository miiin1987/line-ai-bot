import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSsrClient } from "@/lib/supabase/ssr";
import { ResetPasswordForm } from "./_components/ResetPasswordForm";

// Cookie を参照するためビルド時の静的生成を無効化する
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "パスワード再設定 | LINE AI Bot",
};

export default async function ResetPasswordPage() {
  // プロキシがセッションを確認するが、ページ側でも二重確認する（多層防御）
  const supabase = await createSsrClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // セッションが無効・期限切れ → ログイン画面へ
    redirect("/admin/login?error=expired_link");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">パスワード再設定</h1>
          <p className="mt-1 text-sm text-gray-500 break-all">
            {user.email}
          </p>
        </div>

        {/* フォームカード */}
        <div className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-gray-200">
          <ResetPasswordForm />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          8文字以上のパスワードを設定してください
        </p>
      </div>
    </div>
  );
}
