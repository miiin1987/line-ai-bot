"use client";

import { useState, useTransition } from "react";
import type {
  UnansweredQuestion,
  QuestionStatus,
} from "../actions";
import { updateQuestionStatus } from "../actions";

const STATUS_STYLES: Record<QuestionStatus, string> = {
  "未対応": "bg-orange-100 text-orange-700",
  "対応済み": "bg-green-100 text-green-700",
  "対応不要": "bg-gray-100 text-gray-500",
};

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

function StatusSelect({ question }: { question: UnansweredQuestion }) {
  const [localStatus, setLocalStatus] = useState<QuestionStatus>(
    question.status
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as QuestionStatus;
    const prevStatus = localStatus;

    setLocalStatus(newStatus);
    setErrorMsg(null);

    const fd = new FormData();
    fd.set("id", question.id);
    fd.set("status", newStatus);

    startTransition(async () => {
      const result = await updateQuestionStatus(null, fd);
      if (result?.type === "error") {
        setLocalStatus(prevStatus);
        setErrorMsg(result.message);
      }
    });
  };

  return (
    <div className="shrink-0">
      <select
        value={localStatus}
        onChange={handleChange}
        disabled={isPending}
        className={`rounded-full border-0 px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:opacity-50 cursor-pointer ${
          STATUS_STYLES[localStatus]
        }`}
      >
        <option value="未対応">未対応</option>
        <option value="対応済み">対応済み</option>
        <option value="対応不要">対応不要</option>
      </select>
      {errorMsg && (
        <p className="mt-1 text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  );
}

type FilterType = "all" | QuestionStatus;

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "未対応", label: "未対応" },
  { key: "対応済み", label: "対応済み" },
  { key: "対応不要", label: "対応不要" },
];

export default function UnansweredList({
  questions,
}: {
  questions: UnansweredQuestion[];
}) {
  const [filter, setFilter] = useState<FilterType>("all");

  const counts: Record<FilterType, number> = {
    all: questions.length,
    "未対応": questions.filter((q) => q.status === "未対応").length,
    "対応済み": questions.filter((q) => q.status === "対応済み").length,
    "対応不要": questions.filter((q) => q.status === "対応不要").length,
  };

  const filtered =
    filter === "all"
      ? questions
      : questions.filter((q) => q.status === filter);

  return (
    <div>
      {/* フィルタータブ */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? "bg-green-600 text-white"
                : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                filter === key
                  ? "bg-green-700 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* 質問一覧 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-400">
            {filter === "all"
              ? "未回答質問はまだありません"
              : `「${filter}」の質問はありません`}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((question) => (
            <li
              key={question.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="flex-1 text-sm leading-relaxed text-gray-800">
                  {question.question}
                </p>
                <StatusSelect
                  key={question.id + question.status}
                  question={question}
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {formatDate(question.received_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
