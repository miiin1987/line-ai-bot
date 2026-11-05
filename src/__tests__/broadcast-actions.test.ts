/**
 * sendBroadcast Server Action のユニットテスト
 *
 * モック対象:
 *   - next/cache          → revalidatePath を no-op に
 *   - @/lib/supabase/ssr  → 管理者認証を制御
 *   - @/lib/supabase/admin → DB 操作を制御（本番 Supabase 未使用）
 *   - @/lib/line/broadcast → LINE 実送信なし
 *
 * LINE への実送信・本番 Supabase への書き込みは一切行わない。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendBroadcast } from "@/app/admin/(authenticated)/broadcast/actions";

// ─── モック宣言（vitest により自動ホイスト） ────────────────────────────────

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/ssr", () => ({ createSsrClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/line/broadcast", () => ({ broadcastTextMessage: vi.fn() }));

import { createSsrClient } from "@/lib/supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastTextMessage } from "@/lib/line/broadcast";

// ─── ヘルパー ────────────────────────────────────────────────────────────────

/** 管理者ユーザーの SSR クライアントモック */
function mockAdminAuth(isAdmin = true) {
  vi.mocked(createSsrClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: isAdmin
            ? { email: "admin@example.com", app_metadata: { role: "admin" } }
            : { email: "user@example.com", app_metadata: {} },
        },
      }),
    },
  } as never);
}

/**
 * Supabase Admin クライアントのフルエントチェーンをモックする。
 * 本番 DB への接続は一切発生しない。
 */
function mockAdminClient(opts: {
  pendingCount?: number;
  insertError?: { code: string; message: string } | null;
  insertId?: string;
  updateError?: { message: string } | null;
} = {}) {
  const {
    pendingCount = 0,
    insertError = null,
    insertId = "mock-broadcast-id",
    updateError = null,
  } = opts;

  // 各メソッドを個別に保存して後から呼び出し検証が可能にする
  const updateEq = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const insertSingle = vi.fn().mockResolvedValue({
    data: insertError ? null : { id: insertId },
    error: insertError,
  });
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  const insert = vi.fn().mockReturnValue({ select: insertSelect });

  const selectEq = vi
    .fn()
    .mockResolvedValue({ count: pendingCount, error: null });
  const select = vi.fn().mockReturnValue({ eq: selectEq });

  const from = vi.fn().mockReturnValue({ select, insert, update });

  vi.mocked(createAdminClient).mockReturnValue({ from } as never);

  return { from, select, selectEq, insert, insertSelect, insertSingle, update, updateEq };
}

/** テスト用の FormData を作成する */
function makeFormData(message: string) {
  const fd = new FormData();
  fd.set("message", message);
  return fd;
}

// ─── テスト ─────────────────────────────────────────────────────────────────

describe("sendBroadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 入力値検証 ────────────────────────────────────────────────────────────

  describe("入力値検証", () => {
    it("空のメッセージはエラーを返す", async () => {
      mockAdminAuth();
      mockAdminClient();

      const result = await sendBroadcast(null, makeFormData(""));

      expect(result).toEqual({
        type: "error",
        message: "メッセージを入力してください",
      });
    });

    it("半角スペースのみのメッセージはエラーを返す", async () => {
      mockAdminAuth();
      mockAdminClient();

      const result = await sendBroadcast(null, makeFormData("   "));

      expect(result).toEqual({
        type: "error",
        message: "メッセージを入力してください",
      });
    });

    it("501文字を超えるメッセージはエラーを返す", async () => {
      mockAdminAuth();
      mockAdminClient();
      const longMessage = "あ".repeat(501);

      const result = await sendBroadcast(null, makeFormData(longMessage));

      expect(result?.type).toBe("error");
      if (result?.type === "error") {
        expect(result.message).toContain("500文字以内");
      }
    });

    it("500文字ちょうどのメッセージは許可される", async () => {
      mockAdminAuth();
      mockAdminClient();
      vi.mocked(broadcastTextMessage).mockResolvedValue({ outcome: "sent" });
      const maxMessage = "あ".repeat(500);

      const result = await sendBroadcast(null, makeFormData(maxMessage));

      // エラーでないこと（sent または他の outcome になる）
      expect(result?.type).not.toBe("error");
    });
  });

  // ── 認証・認可 ────────────────────────────────────────────────────────────

  describe("認証・認可", () => {
    it("管理者以外のユーザーはエラーを返す", async () => {
      mockAdminAuth(false); // 非管理者
      mockAdminClient();

      const result = await sendBroadcast(null, makeFormData("テストメッセージ"));

      expect(result?.type).toBe("error");
      if (result?.type === "error") {
        expect(result.message).toContain("権限がありません");
      }
      // LINE API は呼ばれていないこと
      expect(broadcastTextMessage).not.toHaveBeenCalled();
    });
  });

  // ── 二重送信防止 ──────────────────────────────────────────────────────────

  describe("二重送信防止", () => {
    it("pending レコードが存在する場合はエラーを返し LINE API を呼ばない", async () => {
      mockAdminAuth();
      mockAdminClient({ pendingCount: 1 }); // 処理中の配信あり

      const result = await sendBroadcast(null, makeFormData("テストメッセージ"));

      expect(result?.type).toBe("error");
      if (result?.type === "error") {
        expect(result.message).toContain("処理中");
      }
      expect(broadcastTextMessage).not.toHaveBeenCalled();
    });

    it("concurrent INSERT で 23505 エラーが返った場合はエラーを返す", async () => {
      mockAdminAuth();
      mockAdminClient({
        pendingCount: 0,
        insertError: { code: "23505", message: "duplicate key value" },
      });

      const result = await sendBroadcast(null, makeFormData("テストメッセージ"));

      expect(result?.type).toBe("error");
      if (result?.type === "error") {
        expect(result.message).toContain("処理中");
      }
      // 23505 後は LINE API を呼ばない
      expect(broadcastTextMessage).not.toHaveBeenCalled();
    });
  });

  // ── LINE API 結果別の status 更新 ────────────────────────────────────────

  describe("LINE API 結果による status 更新", () => {
    it("LINE API 成功時: type=sent を返し DB を status=sent に更新する", async () => {
      mockAdminAuth();
      const { update } = mockAdminClient({ insertId: "test-id-sent" });
      vi.mocked(broadcastTextMessage).mockResolvedValue({ outcome: "sent" });

      const result = await sendBroadcast(null, makeFormData("テストメッセージ"));

      expect(result).toEqual({ type: "sent", id: "test-id-sent" });
      // DB が sent に更新されたか確認
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "sent", sent_at: expect.any(String) })
      );
    });

    it("LINE API 失敗時: type=failed を返し DB を status=failed に更新する", async () => {
      mockAdminAuth();
      const { update } = mockAdminClient({ insertId: "test-id-failed" });
      vi.mocked(broadcastTextMessage).mockResolvedValue({
        outcome: "failed",
        errorCode: 401,
        errorMessage: "Unauthorized",
      });

      const result = await sendBroadcast(null, makeFormData("テストメッセージ"));

      expect(result?.type).toBe("failed");
      if (result?.type === "failed") {
        expect(result.id).toBe("test-id-failed");
        expect(result.detail).toContain("401");
      }
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" })
      );
    });

    it("タイムアウト時: type=unknown を返し DB を status=unknown に更新する", async () => {
      mockAdminAuth();
      const { update } = mockAdminClient({ insertId: "test-id-unknown" });
      vi.mocked(broadcastTextMessage).mockResolvedValue({
        outcome: "unknown",
        reason: "タイムアウト（30秒）",
      });

      const result = await sendBroadcast(null, makeFormData("テストメッセージ"));

      expect(result?.type).toBe("unknown");
      if (result?.type === "unknown") {
        expect(result.id).toBe("test-id-unknown");
      }
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "unknown" })
      );
    });
  });

  // ── 自動再送なし ──────────────────────────────────────────────────────────

  describe("自動再送なし", () => {
    it("unknown 結果でも broadcastTextMessage は1回しか呼ばれない", async () => {
      mockAdminAuth();
      mockAdminClient();
      vi.mocked(broadcastTextMessage).mockResolvedValue({
        outcome: "unknown",
        reason: "タイムアウト（30秒）",
      });

      await sendBroadcast(null, makeFormData("テストメッセージ"));

      // 自動再送がないことを確認
      expect(broadcastTextMessage).toHaveBeenCalledTimes(1);
    });

    it("failed 結果でも broadcastTextMessage は1回しか呼ばれない", async () => {
      mockAdminAuth();
      mockAdminClient();
      vi.mocked(broadcastTextMessage).mockResolvedValue({
        outcome: "failed",
        errorCode: 500,
        errorMessage: "Internal Server Error",
      });

      await sendBroadcast(null, makeFormData("テストメッセージ"));

      expect(broadcastTextMessage).toHaveBeenCalledTimes(1);
    });
  });
});
