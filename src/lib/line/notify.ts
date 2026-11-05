import { messagingApi } from "@line/bot-sdk";
import { getOwnerUserId } from "@/lib/supabase/server";

const { MessagingApiClient } = messagingApi;

const MAX_QUESTION_DISPLAY_LENGTH = 200;

/**
 * オーナーの LINE アカウントへ未回答質問の Push 通知を送信する。
 *
 * オーナー ID の解決順序:
 *   1. owner_settings テーブル（LINE 経由のオーナー登録フローで設定）
 *   2. OWNER_LINE_USER_ID 環境変数（後方互換フォールバック）
 *
 * - オーナー ID が未設定の場合はスキップする
 * - 送信失敗は例外を投げずログのみに留め、呼び出し元の処理を継続させる
 * - ownerUserId はログに出力しない
 */
export async function notifyOwner(
  question: string,
  receivedAt: Date
): Promise<void> {
  // DB → env var の順で解決（どちらも未設定の場合はスキップ）
  const ownerUserId =
    (await getOwnerUserId()) ?? process.env.OWNER_LINE_USER_ID ?? null;

  if (!ownerUserId) {
    console.warn("[Notify] オーナー ID 未設定 → 通知スキップ");
    return;
  }

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    console.warn("[Notify] LINE_CHANNEL_ACCESS_TOKEN 未設定 → 通知スキップ");
    return;
  }

  const client = new MessagingApiClient({ channelAccessToken });

  // 質問文が長い場合は切り詰める（LINE メッセージ本文に含めるため）
  const displayQuestion =
    question.length > MAX_QUESTION_DISPLAY_LENGTH
      ? question.slice(0, MAX_QUESTION_DISPLAY_LENGTH) + "…"
      : question;

  const receivedStr = receivedAt.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const text =
    `【未回答の質問が届きました】\n\n` +
    `質問: ${displayQuestion}\n` +
    `受信: ${receivedStr} (JST)`;

  try {
    await client.pushMessage({
      to: ownerUserId,
      messages: [{ type: "text", text }],
    });
    console.log("[Notify] オーナーへの通知完了");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "不明なエラー";
    console.error(`[Notify] プッシュ通知失敗: ${msg}`);
    // エラーは呼び出し元に伝播させない
  }
}
