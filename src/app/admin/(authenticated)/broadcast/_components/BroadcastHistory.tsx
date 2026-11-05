import type { BroadcastMessage, BroadcastStatus } from "../actions";

const STATUS_LABELS: Record<BroadcastStatus, string> = {
  pending: "処理中",
  sent: "送信完了",
  failed: "失敗",
  unknown: "結果不明",
};

const STATUS_STYLES: Record<BroadcastStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  unknown: "bg-amber-100 text-amber-700",
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

export default function BroadcastHistory({
  history,
}: {
  history: BroadcastMessage[];
}) {
  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-400">配信履歴はまだありません</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {history.map((item) => (
        <li
          key={item.id}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-gray-800">
              {item.message}
            </p>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                STATUS_STYLES[item.status]
              }`}
            >
              {STATUS_LABELS[item.status]}
            </span>
          </div>

          {item.status === "failed" && item.error_detail && (
            <p className="mt-2 text-xs text-red-500">{item.error_detail}</p>
          )}
          {item.status === "unknown" && (
            <p className="mt-2 text-xs text-amber-600">
              ⚠️ LINE 公式アカウントマネージャーで送信状況をご確認ください
            </p>
          )}

          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <span>{formatDate(item.sent_at ?? item.created_at)}</span>
            <span>{item.created_by}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
