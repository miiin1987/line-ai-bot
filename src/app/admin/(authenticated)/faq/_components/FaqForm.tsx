"use client";

import { useActionState, useEffect } from "react";
import type { Faq } from "@/lib/supabase/server";
import { createFaq, updateFaq, type FaqActionState } from "../actions";

type Props = {
  faq: Faq | null;
  onSuccess: () => void;
};

export default function FaqForm({ faq, onSuccess }: Props) {
  const [state, formAction, isPending] = useActionState<FaqActionState, FormData>(
    faq ? updateFaq : createFaq,
    null
  );

  useEffect(() => {
    if (state?.type === "success") {
      onSuccess();
    }
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {faq && <input type="hidden" name="id" value={faq.id} />}

      {state?.type === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.message}
        </p>
      )}

      {/* 質問 */}
      <div>
        <label
          htmlFor="faq-question"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          質問 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="faq-question"
          name="question"
          required
          maxLength={500}
          rows={2}
          defaultValue={faq?.question}
          disabled={isPending}
          placeholder="例：営業時間は何時ですか？"
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-50"
        />
      </div>

      {/* 回答 */}
      <div>
        <label
          htmlFor="faq-answer"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          回答 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="faq-answer"
          name="answer"
          required
          maxLength={2000}
          rows={5}
          defaultValue={faq?.answer}
          disabled={isPending}
          placeholder="例：平日 10:00〜18:00 です。土日祝は休業となっております。"
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-50"
        />
      </div>

      {/* 有効/無効 */}
      <div className="flex items-center gap-3">
        <input
          id="faq-is-active"
          type="checkbox"
          name="is_active"
          defaultChecked={faq?.is_active ?? true}
          disabled={isPending}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <label htmlFor="faq-is-active" className="text-sm text-gray-700">
          有効にする（LINE からの質問に自動回答で使用）
        </label>
      </div>

      {/* 保存ボタン */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:opacity-50 transition-colors"
        >
          {isPending ? "保存中..." : faq ? "更新する" : "追加する"}
        </button>
      </div>
    </form>
  );
}
