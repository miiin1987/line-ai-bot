/**
 * 【項目1】Supabase への配信履歴保存 — データ形状の検証
 *
 * 本番 Supabase への接続は行わない。
 * DB クライアントをモック化し、正しい引数が渡されることを検証する。
 *
 * ─ 検証できること ──────────────────────────────────────────────
 * - INSERT に渡されるオブジェクトの全フィールド（message / status / created_by）
 * - UPDATE に渡されるステータス値と補助フィールド（sent_at / error_detail）
 * - sent_at が ISO 8601 形式の文字列であること
 * - created_by に認証ユーザーのメールアドレスが入ること
 *
 * ─ 検証できないこと ────────────────────────────────────────────
 * - 実際の Supabase テーブルへのデータ永続化
 * - RLS ポリシーによる書き込み制御
 * - partial unique index の実際の動作
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendBroadcast } from "@/app/admin/(authenticated)/broadcast/actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/ssr", () => ({ createSsrClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/line/broadcast", () => ({ broadcastTextMessage: vi.fn() }));

import { createSsrClient } from "@/lib/supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastTextMessage } from "@/lib/line/broadcast";

const ADMIN_EMAIL = "admin@example.com";

function mockAdminAuth() {
  vi.mocked(createSsrClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            email: ADMIN_EMAIL,
            app_metadata: { role: "admin" },
          },
        },
      }),
    },
  } as never);
}

function mockAdminClient(opts: {
  pendingCount?: number;
  insertId?: string;
} = {}) {
  const { pendingCount = 0, insertId = "mock-id" } = opts;

  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: insertId },
    error: null,
  });
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  const insert = vi.fn().mockReturnValue({ select: insertSelect });

  const selectEq = vi.fn().mockResolvedValue({ count: pendingCount, error: null });
  const select = vi.fn().mockReturnValue({ eq: selectEq });

  const from = vi.fn().mockReturnValue({ select, insert, update });
  vi.mocked(createAdminClient).mockReturnValue({ from } as never);

  return { from, insert, update, updateEq };
}

describe("sendBroadcast — DB 書き込みデータ形状の検証", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminAuth();
  });

  // ── INSERT データ形状 ──────────────────────────────────────────────────────

  it("INSERT に message / status:'pending' / created_by:adminEmail が渡される", async () => {
    const { insert } = mockAdminClient();
    vi.mocked(broadcastTextMessage).mockResolvedValue({ outcome: "sent" });

    const fd = new FormData();
    fd.set("message", "テスト配信メッセージ");
    await sendBroadcast(null, fd);

    expect(insert).toHaveBeenCalledWith({
      message: "テスト配信メッセージ",
      status: "pending",
      created_by: ADMIN_EMAIL,
    });
  });

  it("INSERT には status 以外のフィールドを含まない（sent_at / error_detail は含まれない）", async () => {
    const { insert } = mockAdminClient();
    vi.mocked(broadcastTextMessage).mockResolvedValue({ outcome: "sent" });

    const fd = new FormData();
    fd.set("message", "テスト");
    await sendBroadcast(null, fd);

    const insertArg = vi.mocked(insert).mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg).not.toHaveProperty("sent_at");
    expect(insertArg).not.toHaveProperty("error_detail");
  });

  // ── UPDATE データ形状（sent）────────────────────────────────────────────────

  it("LINE 成功時: UPDATE に { status:'sent', sent_at: ISO8601文字列 } が渡される", async () => {
    const { update } = mockAdminClient({ insertId: "id-sent" });
    vi.mocked(broadcastTextMessage).mockResolvedValue({ outcome: "sent" });

    const fd = new FormData();
    fd.set("message", "テスト");
    await sendBroadcast(null, fd);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        // ISO 8601 形式（例: 2026-11-05T06:00:00.000Z）
        sent_at: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        ),
      })
    );
  });

  it("LINE 成功時: UPDATE に error_detail は含まれない", async () => {
    const { update } = mockAdminClient();
    vi.mocked(broadcastTextMessage).mockResolvedValue({ outcome: "sent" });

    const fd = new FormData();
    fd.set("message", "テスト");
    await sendBroadcast(null, fd);

    const updateArg = vi.mocked(update).mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty("error_detail");
  });

  // ── UPDATE データ形状（failed）────────────────────────────────────────────────

  it("LINE 失敗時: UPDATE に { status:'failed', error_detail:'[401] ...' } が渡される", async () => {
    const { update } = mockAdminClient();
    vi.mocked(broadcastTextMessage).mockResolvedValue({
      outcome: "failed",
      errorCode: 401,
      errorMessage: "Unauthorized",
    });

    const fd = new FormData();
    fd.set("message", "テスト");
    await sendBroadcast(null, fd);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error_detail: expect.stringContaining("[401]"),
      })
    );
    // 失敗時に sent_at は不要
    const updateArg = vi.mocked(update).mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty("sent_at");
  });

  // ── UPDATE データ形状（unknown）───────────────────────────────────────────────

  it("タイムアウト時: UPDATE に { status:'unknown', error_detail: reason } が渡される", async () => {
    const { update } = mockAdminClient();
    vi.mocked(broadcastTextMessage).mockResolvedValue({
      outcome: "unknown",
      reason: "タイムアウト（30秒）",
    });

    const fd = new FormData();
    fd.set("message", "テスト");
    await sendBroadcast(null, fd);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "unknown",
        error_detail: "タイムアウト（30秒）",
      })
    );
  });
});
