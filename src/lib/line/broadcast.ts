const BROADCAST_URL = "https://api.line.me/v2/bot/message/broadcast";
const TIMEOUT_MS = 30_000;

export type BroadcastOutcome =
  | { outcome: "sent" }
  | { outcome: "failed"; errorCode: number; errorMessage: string }
  | { outcome: "unknown"; reason: string };

/**
 * LINE Broadcast API でテキストメッセージを全友だちに送信する。
 *
 * - SDK の broadcastMessage はバージョンによって存在しないため fetch で直接呼び出す
 * - AbortSignal.timeout() で 30 秒タイムアウトを実装する
 * - タイムアウト・ネットワーク断は "unknown" として返す（呼び出し側は自動再送しない）
 * - トークンや送信内容はログに出力しない
 */
export async function broadcastTextMessage(
  text: string
): Promise<BroadcastOutcome> {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    return {
      outcome: "failed",
      errorCode: 0,
      errorMessage: "LINE_CHANNEL_ACCESS_TOKEN が設定されていません",
    };
  }

  let response: Response;
  try {
    response = await fetch(BROADCAST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        messages: [{ type: "text", text }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    // AbortSignal.timeout() によるタイムアウト
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return {
        outcome: "unknown",
        reason: `タイムアウト（${TIMEOUT_MS / 1000}秒）`,
      };
    }
    const reason =
      error instanceof Error ? error.message : "ネットワークエラー";
    return { outcome: "unknown", reason };
  }

  if (response.ok) {
    return { outcome: "sent" };
  }

  // HTTP エラー（4xx / 5xx）
  let errorMessage: string;
  try {
    const body = (await response.json()) as { message?: string };
    errorMessage = body.message ?? `HTTP ${response.status}`;
  } catch {
    errorMessage = `HTTP ${response.status}`;
  }

  return { outcome: "failed", errorCode: response.status, errorMessage };
}
