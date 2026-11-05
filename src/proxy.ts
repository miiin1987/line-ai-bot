import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  // レスポンスオブジェクトを変数に保持し、Cookie 更新後に差し替える
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 環境変数未設定時はミドルウェアを素通りさせる（ビルドエラーを防ぐ）
  if (!url || !anonKey) {
    console.error("[Middleware] Supabase 環境変数が未設定です");
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // リクエストに Cookie をセット（以降の処理で参照できるよう）
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        // レスポンスを再生成して Cookie を引き継ぐ
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // getUser() はサーバー側でトークンを検証し、必要に応じてリフレッシュする。
  // getSession() はローカルの Cookie だけを読むため認証検証には使わない。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    // ログイン済みならダッシュボードへ
    if (user) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return supabaseResponse;
  }

  // /admin/* で未認証ならログイン画面へ
  if (!user) {
    const loginUrl = new URL("/admin/login", request.url);
    // パスワード再設定ページにセッションなしで来た場合は期限切れエラーを伝える
    if (pathname === "/admin/reset-password") {
      loginUrl.searchParams.set("error", "session_expired");
    }
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
