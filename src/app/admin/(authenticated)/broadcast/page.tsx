import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BroadcastMessage } from "./actions";
import BroadcastForm from "./_components/BroadcastForm";
import BroadcastHistory from "./_components/BroadcastHistory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "一斉配信 | LINE AI Bot 管理",
};

export default async function BroadcastPage() {
  const admin = createAdminClient();

  // pending 中の配信があるか確認（二重送信防止 UI のため）
  const { data: pendingRows } = await admin
    .from("broadcast_messages")
    .select("id")
    .eq("status", "pending")
    .limit(1);

  const hasPending = (pendingRows?.length ?? 0) > 0;

  // 配信履歴を取得（最新20件）
  const { data, error } = await admin
    .from("broadcast_messages")
    .select("id, message, status, error_detail, sent_at, created_at, created_by")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[Broadcast] 履歴取得エラー:", error.message);
  }

  const history: BroadcastMessage[] = (data as BroadcastMessage[] | null) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">一斉配信</h1>
        <p className="mt-1 text-sm text-gray-500">
          LINE 友だち全員にメッセージを送信します
        </p>
      </div>

      {/* 料金プランの注意喚起 */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800">
          ⚠️ 料金プランについて
        </p>
        <p className="mt-1 text-xs text-amber-700">
          一斉配信は友だち人数分の通数を消費します。フリープランは月200通まで無料です。
          送信前に LINE 公式アカウントマネージャーで残通数をご確認ください。
        </p>
      </div>

      {/* 配信フォーム */}
      <BroadcastForm hasPending={hasPending} />

      {/* 配信履歴 */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          配信履歴（直近20件）
        </h2>
        <BroadcastHistory history={history} />
      </div>
    </div>
  );
}
