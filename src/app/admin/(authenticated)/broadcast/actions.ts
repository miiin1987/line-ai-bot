"use server";

import { revalidatePath } from "next/cache";
import { createSsrClient } from "@/lib/supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastTextMessage } from "@/lib/line/broadcast";

export type BroadcastStatus = "pending" | "sent" | "failed" | "unknown";

export type BroadcastMessage = {
  id: string;
  message: string;
  status: BroadcastStatus;
  error_detail: string | null;
  sent_at: string | null;
  created_at: string;
  created_by: string;
};

export type BroadcastActionState =
  | { type: "error"; message: string }
  | { type: "sent"; id: string }
  | { type: "failed"; id: string; detail: string }
  | { type: "unknown"; id: string }
  | null;

const MESSAGE_MAX = 500;

async function requireAdmin() {
  const supabase = await createSsrClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") {
    throw new Error("権限がありません");
  }
  return user;
}

export async function sendBroadcast(
  _prevState: BroadcastActionState,
  formData: FormData
): Promise<BroadcastActionState> {
  let broadcastId: string | null = null;

  try {
    const adminUser = await requireAdmin();

    const message = ((formData.get("message") as string) ?? "").trim();

    if (!message) {
      return { type: "error", message: "メッセージを入力してください" };
    }
    if (message.length > MESSAGE_MAX) {
      return {
        type: "error",
        message: `メッセージは${MESSAGE_MAX}文字以内で入力してください`,
      };
    }

    const admin = createAdminClient();

    // 二重送信防止: pending レコードの存在確認
    const { count } = await admin
      .from("broadcast_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if ((count ?? 0) > 0) {
      return {
        type: "error",
        message:
          "現在処理中の配信があります。しばらく待ってから再試行してください",
      };
    }

    // DB ファースト: LINE API 呼び出し前に pending レコードを挿入する。
    // partial unique index により concurrent な INSERT は DB 側で拒否される。
    const { data: inserted, error: insertError } = await admin
      .from("broadcast_messages")
      .insert({
        message,
        status: "pending",
        created_by: adminUser.email ?? "unknown",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("[Broadcast] INSERT エラー:", insertError?.message);
      // 23505 = unique_violation → concurrent な送信試行
      if (insertError?.code === "23505") {
        return { type: "error", message: "現在処理中の配信があります" };
      }
      return { type: "error", message: "配信の準備に失敗しました" };
    }

    broadcastId = (inserted as { id: string }).id;

    // LINE Broadcast API 呼び出し
    const result = await broadcastTextMessage(message);

    if (result.outcome === "sent") {
      await admin
        .from("broadcast_messages")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", broadcastId);

      revalidatePath("/admin/broadcast");
      return { type: "sent", id: broadcastId };
    }

    if (result.outcome === "failed") {
      const detail = `[${result.errorCode}] ${result.errorMessage}`;
      await admin
        .from("broadcast_messages")
        .update({ status: "failed", error_detail: detail })
        .eq("id", broadcastId);

      revalidatePath("/admin/broadcast");
      return { type: "failed", id: broadcastId, detail };
    }

    // unknown: タイムアウト・ネットワーク断
    await admin
      .from("broadcast_messages")
      .update({ status: "unknown", error_detail: result.reason })
      .eq("id", broadcastId);

    revalidatePath("/admin/broadcast");
    return { type: "unknown", id: broadcastId };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "予期しないエラーが発生しました";
    if (message !== "権限がありません") {
      console.error("[Broadcast] 予期しないエラー:", message);
    }

    // pending レコードが残っている場合は unknown に更新する
    if (broadcastId) {
      try {
        const admin = createAdminClient();
        await admin
          .from("broadcast_messages")
          .update({
            status: "unknown",
            error_detail: "予期しないエラーにより成否不明",
          })
          .eq("id", broadcastId);
        revalidatePath("/admin/broadcast");
        return { type: "unknown", id: broadcastId };
      } catch {
        // 更新も失敗した場合は error を返す
      }
    }

    return { type: "error", message };
  }
}
