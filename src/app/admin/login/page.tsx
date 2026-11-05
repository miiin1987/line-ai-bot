import type { Metadata } from "next";
import { LoginForm } from "./_components/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "管理者ログイン | LINE AI Bot",
};

type SearchParams = {
  error?: string;
  message?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  expired_link: "リンクの有効期限が切れています。もう一度お試しください。",
  invalid_link: "無効なリンクです。",
  session_expired: "セッションが切れました。もう一度メールのリンクからやり直してください。",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  password_updated:
    "パスワードを更新しました。新しいパスワードでログインしてください。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const errorMessage = params.error ? (ERROR_MESSAGES[params.error] ?? null) : null;
  const successMessage = params.message
    ? (SUCCESS_MESSAGES[params.message] ?? null)
    : null;

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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">管理者ログイン</h1>
          <p className="mt-1 text-sm text-gray-500">LINE AI Bot 管理画面</p>
        </div>

        {/* URL から渡されたエラー・成功メッセージ */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200"
          >
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div
            role="status"
            className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 border border-green-200"
          >
            {successMessage}
          </div>
        )}

        {/* フォームカード */}
        <div className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-gray-200">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          管理者アカウントは管理者が発行します
        </p>
      </div>
    </div>
  );
}
