import { getActiveFaqs } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  // 本番環境では404を返し、このエンドポイントの存在を隠す
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  const result = await getActiveFaqs();

  if (result.data === null) {
    return Response.json(
      { ok: false, error: result.error },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    count: result.data.length,
    faqs: result.data.map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    })),
  });
}
