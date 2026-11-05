import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Faq } from "@/lib/supabase/server";
import FaqManager from "./_components/FaqManager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FAQ管理 | LINE AI Bot 管理",
};

export default async function FaqPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("faq")
    .select("id, question, answer, is_active, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[FAQ] 一覧取得エラー:", error.message);
  }

  const faqs: Faq[] = (data as Faq[] | null) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">FAQ管理</h1>
        <p className="mt-1 text-sm text-gray-500">
          よくある質問の追加・編集・削除
        </p>
      </div>
      <FaqManager faqs={faqs} />
    </div>
  );
}
