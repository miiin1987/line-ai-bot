/**
 * broadcastTextMessage のユニットテスト
 *
 * - fetch をモック → LINE への実送信なし
 * - 環境変数はダミー値を使用 → 実トークン非公開
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { broadcastTextMessage } from "@/lib/line/broadcast";

const FAKE_TOKEN = "test-channel-access-token";
const TEST_MESSAGE = "テスト配信メッセージ";

describe("broadcastTextMessage", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // ダミートークンを設定（実トークン不使用）
    process.env = { ...originalEnv, LINE_CHANNEL_ACCESS_TOKEN: FAKE_TOKEN };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ─── 正常系 ──────────────────────────────────────────────────────────────

  it("LINE API が 200 を返した場合は outcome: sent を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );

    const result = await broadcastTextMessage(TEST_MESSAGE);

    expect(result.outcome).toBe("sent");
  });

  // ─── HTTP エラー系 ────────────────────────────────────────────────────────

  it("LINE API が 401 を返した場合は outcome: failed、errorCode: 401 を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ message: "Unauthorized" }),
      })
    );

    const result = await broadcastTextMessage(TEST_MESSAGE);

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.errorCode).toBe(401);
      expect(result.errorMessage).toContain("Unauthorized");
    }
  });

  it("LINE API が 429 を返した場合は outcome: failed、errorCode: 429 を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({ message: "Too Many Requests" }),
      })
    );

    const result = await broadcastTextMessage(TEST_MESSAGE);

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.errorCode).toBe(429);
    }
  });

  // ─── タイムアウト・ネットワークエラー系 ──────────────────────────────────

  it("AbortSignal.timeout によるタイムアウト時は outcome: unknown を返す", async () => {
    // AbortSignal.timeout() が発火した際に fetch が投げるエラーを再現
    const timeoutError = new DOMException(
      "The operation timed out.",
      "TimeoutError"
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError));

    const result = await broadcastTextMessage(TEST_MESSAGE);

    expect(result.outcome).toBe("unknown");
    if (result.outcome === "unknown") {
      expect(result.reason).toMatch(/タイムアウト/);
    }
  });

  it("ネットワーク断（fetch 拒否）時は outcome: unknown を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Failed to fetch"))
    );

    const result = await broadcastTextMessage(TEST_MESSAGE);

    expect(result.outcome).toBe("unknown");
  });

  // ─── 設定エラー系 ─────────────────────────────────────────────────────────

  it("LINE_CHANNEL_ACCESS_TOKEN 未設定時は outcome: failed、errorCode: 0 を返す", async () => {
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    // fetch は呼ばれないはずなので何もスタブしない

    const result = await broadcastTextMessage(TEST_MESSAGE);

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.errorCode).toBe(0);
    }
  });
});
