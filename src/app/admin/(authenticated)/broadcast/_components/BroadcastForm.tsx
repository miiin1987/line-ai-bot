"use client";

import { useState, useTransition } from "react";
import { sendBroadcast, type BroadcastActionState } from "../actions";

const MESSAGE_MAX = 500;

type FormStep =
  | { step: "compose" }
  | { step: "preview"; message: string }
  | { step: "confirm"; message: string }
  | { step: "sending"; message: string }
  | { step: "result"; outcome: Exclude<BroadcastActionState, null> };

export default function BroadcastForm({
  hasPending,
}: {
  hasPending: boolean;
}) {
  const [formStep, setFormStep] = useState<FormStep>({ step: "compose" });
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ─── pending 中の警告 ────────────────────────────────────────────
  if (hasPending && formStep.step === "compose") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800">
          ⚠️ 処理中の配信があります
        </p>
        <p className="mt-1 text-xs text-amber-700">
          現在処理中の配信があります。5分経過しても完了しない場合は、
          Supabase ダッシュボードで状態を確認してください。
        </p>
      </div>
    );
  }

  // ─── compose ─────────────────────────────────────────────────────
  if (formStep.step === "compose") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3">
          <label
            htmlFor="broadcast-msg"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            配信メッセージ <span className="text-red-500">*</span>
          </label>
          <textarea
            id="broadcast-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MESSAGE_MAX}
            rows={5}
            placeholder="友だち全員に送るメッセージを入力してください"
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <div className="mt-1 flex justify-end">
            <span
              className={`text-xs ${
                message.length > MESSAGE_MAX * 0.9
                  ? "text-orange-500"
                  : "text-gray-400"
              }`}
            >
              {message.length} / {MESSAGE_MAX}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const trimmed = message.trim();
            if (trimmed) {
              setFormStep({ step: "preview", message: trimmed });
            }
          }}
          disabled={!message.trim() || message.length > MESSAGE_MAX}
          className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          プレビューを確認する
        </button>
      </div>
    );
  }

  // ─── preview ─────────────────────────────────────────────────────
  if (formStep.step === "preview") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-xs font-medium text-gray-500">
            送信内容のプレビュー（LINE メッセージのイメージ）
          </p>
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
                {formStep.message}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            {formStep.message.length} 文字 ·
            LINE 公式アカウントから全友だちに送信されます
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFormStep({ step: "compose" })}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            編集に戻る
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmed(false);
              setFormStep({ step: "confirm", message: formStep.message });
            }}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            この内容で送信確認へ
          </button>
        </div>
      </div>
    );
  }

  // ─── confirm ─────────────────────────────────────────────────────
  if (formStep.step === "confirm") {
    const handleSend = () => {
      if (!confirmed || isPending) return;
      const msg = formStep.message;

      setFormStep({ step: "sending", message: msg });

      const fd = new FormData();
      fd.set("message", msg);

      startTransition(async () => {
        const result = await sendBroadcast(null, fd);
        setFormStep({
          step: "result",
          outcome: result ?? {
            type: "error",
            message: "不明なエラーが発生しました",
          },
        });
      });
    };

    return (
      <div className="space-y-4">
        {/* 最終警告 */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            ⚠️ 送信前の最終確認
          </p>
          <ul className="mt-2 space-y-1 text-xs text-red-700">
            <li>• この操作は取り消せません</li>
            <li>• LINE 公式アカウントの友だち全員に届きます</li>
            <li>• 友だち人数分の通数を消費します</li>
          </ul>
        </div>

        {/* 送信内容 */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs text-gray-500">送信内容</p>
          <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {formStep.message}
          </p>
        </div>

        {/* 確認チェックボックス */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">
            送信内容と対象を確認しました
          </span>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              setFormStep({ step: "preview", message: formStep.message })
            }
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!confirmed || isPending}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            全員に送信する
          </button>
        </div>
      </div>
    );
  }

  // ─── sending ─────────────────────────────────────────────────────
  if (formStep.step === "sending") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
        <p className="text-sm font-medium text-gray-700">送信中...</p>
        <p className="mt-1 text-xs text-gray-400">ページを閉じないでください</p>
      </div>
    );
  }

  // ─── result ──────────────────────────────────────────────────────
  if (formStep.step === "result") {
    const { outcome } = formStep;

    if (outcome.type === "sent") {
      return (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-green-800">
            配信リクエストが完了しました
          </p>
          <p className="mt-1 text-xs text-green-700">
            LINE サーバーへの送信が受け付けられました。
            配信は LINE によって順次行われます。
          </p>
          <button
            type="button"
            onClick={() => {
              setMessage("");
              setFormStep({ step: "compose" });
            }}
            className="mt-4 rounded-lg border border-green-300 px-4 py-2 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
          >
            新しいメッセージを作成する
          </button>
        </div>
      );
    }

    if (outcome.type === "failed") {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-5 w-5 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-red-800">
            配信に失敗しました
          </p>
          <p className="mt-1 text-xs text-red-600">{outcome.detail}</p>
          <button
            type="button"
            onClick={() => setFormStep({ step: "compose" })}
            className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            再試行する
          </button>
        </div>
      );
    }

    if (outcome.type === "unknown") {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <svg
              className="h-5 w-5 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-amber-800">
            送信結果が不明です
          </p>
          <p className="mt-1 text-xs text-amber-700">
            タイムアウトまたはネットワークエラーにより成否を確認できませんでした。
            <br />
            配信履歴と LINE 公式アカウントマネージャーをご確認ください。
          </p>
          <p className="mt-2 text-xs font-semibold text-amber-800">
            ⚠️ 二重配信防止のため自動再送は行いません
          </p>
        </div>
      );
    }

    // type === "error"
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
        <p className="text-sm font-semibold text-red-800">
          エラーが発生しました
        </p>
        <p className="mt-1 text-xs text-red-600">
          {outcome.type === "error" ? outcome.message : "不明なエラー"}
        </p>
        <button
          type="button"
          onClick={() => setFormStep({ step: "compose" })}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
        >
          戻る
        </button>
      </div>
    );
  }

  return null;
}
