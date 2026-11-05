import { redirect } from "next/navigation";
import { createSsrClient } from "@/lib/supabase/ssr";
import { logout } from "./actions";
import NavLinks from "./_components/NavLinks";

// Cookie を参照するためビルド時の静的生成を無効化する
export const dynamic = "force-dynamic";

// ミドルウェアが通した後にも管理者ロールをサーバー側で再検証する（多層防御）
async function requireAdmin() {
  const supabase = await createSsrClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  // app_metadata はサーバーからしか書き込めないためクライアントによる改ざん不可
  if (user.app_metadata?.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  return user;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー + ナビゲーション */}
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              LINE AI Bot 管理
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-gray-400 sm:block">
              {user.email}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 transition-colors"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
        <NavLinks />
      </header>

      {/* メインコンテンツ */}
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
