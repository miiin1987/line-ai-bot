"use client";

import { useState, useActionState } from "react";
import type { Faq } from "@/lib/supabase/server";
import {
  deleteFaq,
  toggleFaqActive,
  type FaqActionState,
} from "../actions";
import FaqForm from "./FaqForm";

type ModalState = "closed" | "new" | { mode: "edit"; faq: Faq };

function ToggleButton({ faq }: { faq: Faq }) {
  const [, formAction, isPending] = useActionState<FaqActionState, FormData>(
    toggleFaqActive,
    null
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={faq.id} />
      <input type="hidden" name="new_active" value={String(!faq.is_active)} />
      <button
        type="submit"
        disabled={isPending}
        aria-label={faq.is_active ? "無効にする" : "有効にする"}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:opacity-50 ${
          faq.is_active ? "bg-green-500" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            faq.is_active ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </form>
  );
}

function DeleteButton({ faq }: { faq: Faq }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<FaqActionState, FormData>(
    deleteFaq,
    null
  );

  if (state?.type === "error") {
    return <span className="text-xs text-red-500">{state.message}</span>;
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <form action={formAction}>
          <input type="hidden" name="id" value={faq.id} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {isPending ? "削除中" : "削除する"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-red-600"
    >
      削除
    </button>
  );
}

export default function FaqManager({ faqs }: { faqs: Faq[] }) {
  const [modal, setModal] = useState<ModalState>("closed");

  return (
    <div>
      {/* 追加ボタン */}
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setModal("new")}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 transition-colors"
        >
          + FAQ を追加
        </button>
      </div>

      {/* FAQ一覧 */}
      {faqs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-400">
            FAQがまだ登録されていません
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {faqs.map((faq) => (
            <li
              key={faq.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                {/* 有効/無効トグル */}
                <div className="mt-0.5">
                  <ToggleButton faq={faq} />
                </div>

                {/* テキスト */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      faq.is_active ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {faq.question}
                  </p>
                  <p
                    className={`mt-1 line-clamp-2 text-xs ${
                      faq.is_active ? "text-gray-500" : "text-gray-300"
                    }`}
                  >
                    {faq.answer}
                  </p>
                </div>

                {/* 操作ボタン */}
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "edit", faq })}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  >
                    編集
                  </button>
                  <DeleteButton faq={faq} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* モーダル */}
      {modal !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setModal("closed")}
          />
          {/* panel */}
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {modal === "new" ? "FAQ を追加" : "FAQ を編集"}
              </h2>
              <button
                type="button"
                onClick={() => setModal("closed")}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>
            <FaqForm
              faq={modal === "new" ? null : modal.faq}
              onSuccess={() => setModal("closed")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
