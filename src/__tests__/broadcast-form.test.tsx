// @vitest-environment jsdom

/**
 * BroadcastForm コンポーネントテスト
 *
 * 検証項目: ブラウザレベルの二重クリック防止
 *
 * 防止機構:
 *   1. disabled={!confirmed || isPending} — チェックボックス未チェック or 送信中は disabled
 *   2. setFormStep({ step: "sending" }) — クリック後即座にスピナーへ遷移（ボタン消滅）
 *   3. if (!confirmed || isPending) return — ハンドラ内ガード
 *
 * sendBroadcast をモック化し、LINE への実送信・本番 DB への接続は行わない。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BroadcastForm from "@/app/admin/(authenticated)/broadcast/_components/BroadcastForm";
import type { BroadcastActionState } from "@/app/admin/(authenticated)/broadcast/actions";

vi.mock("@/app/admin/(authenticated)/broadcast/actions", () => ({
  sendBroadcast: vi.fn(),
}));

import { sendBroadcast } from "@/app/admin/(authenticated)/broadcast/actions";

// ─── ヘルパー ────────────────────────────────────────────────────────────────

/**
 * compose → preview → confirm ステップまでナビゲートする。
 * confirm ステップで「全員に送信する」ボタンとチェックボックスが表示された状態になる。
 */
async function navigateToConfirm(
  user: ReturnType<typeof userEvent.setup>,
  message = "テスト配信メッセージ"
) {
  await user.type(screen.getByRole("textbox"), message);
  await user.click(screen.getByRole("button", { name: "プレビューを確認する" }));
  await user.click(screen.getByRole("button", { name: "この内容で送信確認へ" }));
}

// ─── テスト ─────────────────────────────────────────────────────────────────

describe("BroadcastForm — ブラウザ二重クリック防止", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── 送信前の防止 ──────────────────────────────────────────────────────────

  it("チェックボックス未チェック時: 送信ボタンが disabled になっている", async () => {
    const user = userEvent.setup();
    render(<BroadcastForm hasPending={false} />);
    await navigateToConfirm(user);

    const btn = screen.getByRole("button", { name: "全員に送信する" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("チェックボックスを ON にすると送信ボタンが有効になる", async () => {
    const user = userEvent.setup();
    render(<BroadcastForm hasPending={false} />);
    await navigateToConfirm(user);

    await user.click(screen.getByRole("checkbox"));

    const btn = screen.getByRole("button", { name: "全員に送信する" });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  // ── 送信後の即時 UI 遷移 ────────────────────────────────────────────────

  it("送信クリック後: 即座に「送信中...」が表示され、送信ボタンが消える", async () => {
    // 解決しない Promise で「送信中...」ステップに留まらせる
    let resolveAction!: (value: BroadcastActionState) => void;
    vi.mocked(sendBroadcast).mockImplementation(
      () =>
        new Promise<BroadcastActionState>((r) => {
          resolveAction = r;
        })
    );

    const user = userEvent.setup();
    render(<BroadcastForm hasPending={false} />);
    await navigateToConfirm(user);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "全員に送信する" }));

    // 「送信中...」スピナーが表示される
    await waitFor(() =>
      expect(screen.queryByText("送信中...")).not.toBeNull()
    );
    // 送信ボタンが DOM から消えている（再クリック不可）
    expect(screen.queryByRole("button", { name: "全員に送信する" })).toBeNull();

    // 保留中のトランジションを完了させてクリーンアップ
    await act(async () => {
      resolveAction({ type: "sent", id: "cleanup" });
    });
  });

  // ── sendBroadcast 呼び出し回数 ─────────────────────────────────────────

  it("sendBroadcast は1回しか呼ばれない（二重送信防止）", async () => {
    vi.mocked(sendBroadcast).mockResolvedValue({ type: "sent", id: "test-id" });

    const user = userEvent.setup();
    render(<BroadcastForm hasPending={false} />);
    await navigateToConfirm(user);

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "全員に送信する" }));

    await waitFor(() =>
      expect(screen.queryByText("配信リクエストが完了しました")).not.toBeNull()
    );

    expect(sendBroadcast).toHaveBeenCalledTimes(1);
  });

  // ── hasPending=true のとき ──────────────────────────────────────────────

  it("hasPending=true のとき: 警告が表示され、メッセージ入力欄がない", () => {
    render(<BroadcastForm hasPending={true} />);

    // 警告見出しが表示される（見出し <p> の正確なテキストでマッチ）
    expect(screen.queryByText("⚠️ 処理中の配信があります")).not.toBeNull();
    // フォームの入力欄が表示されない
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
