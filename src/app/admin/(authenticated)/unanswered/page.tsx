import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UnansweredQuestion } from "./actions";
import UnansweredList from "./_components/UnansweredList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "未回答質問 | LINE AI Bot 管理",
};

export default async function UnansweredPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("unanswered_questions")
    .select("id, line_user_id, question, received_at, status")
    .order("received_at", { ascending: false });

  if (error) {
    console.error("[未回答] 一覧取得エラー:", error.message);
  }

  const questions: UnansweredQuestion[] =
    (data as UnansweredQuestion[] | null) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">未回答質問</h1>
        <p className="mt-1 text-sm text-gray-500">
          LINE Bot が回答できなかった質問の一覧
        </p>
      </div>
      <UnansweredList questions={questions} />
    </div>
  );
}
