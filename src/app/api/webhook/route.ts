import { validateSignature, messagingApi, webhook } from "@line/bot-sdk";
import { getActiveFaqs, type Faq } from "@/lib/supabase/server";

// Next.js のビルド時静的最適化を無効化し、常にリクエスト時に動的処理する
// これがないと cacheComponents 有効環境で POST が 405 になる
export const dynamic = "force-dynamic";

const { MessagingApiClient } = messagingApi;

// 環境変数の存在チェック（起動時ではなくリクエスト時に検証）
function getEnv(): { channelSecret: string; channelAccessToken: string } {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelSecret || !channelAccessToken) {
    throw new Error("LINE 環境変数が設定されていません");
  }

  return { channelSecret, channelAccessToken };
}

export async function POST(request: Request): Promise<Response> {
  // 署名検証のため、パース前に生の本文を取得する
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!signature) {
    console.warn("[Webhook] x-line-signature ヘッダーが存在しません");
    return new Response("Unauthorized", { status: 401 });
  }

  let env: { channelSecret: string; channelAccessToken: string };
  try {
    env = getEnv();
  } catch (error) {
    console.error("[Webhook] 環境変数エラー:", error);
    return new Response("Internal Server Error", { status: 500 });
  }

  // 署名検証（rawBody を変更せずに渡す）
  if (!validateSignature(rawBody, env.channelSecret, signature)) {
    console.warn("[Webhook] 署名検証に失敗しました");
    return new Response("Unauthorized", { status: 401 });
  }

  // LINE の仕様上、できるだけ早く 200 を返すため処理を非同期で実行
  handleEvents(rawBody, env.channelAccessToken).catch((error) => {
    console.error("[Webhook] イベント処理中にエラーが発生しました:", error);
  });

  return new Response("OK", { status: 200 });
}

const FALLBACK_MESSAGE = "確認して担当者からご連絡します。";

async function handleEvents(
  rawBody: string,
  channelAccessToken: string
): Promise<void> {
  let body: webhook.CallbackRequest;

  try {
    body = JSON.parse(rawBody) as webhook.CallbackRequest;
  } catch (error) {
    console.error("[Webhook] リクエスト本文の JSON パースに失敗しました:", error);
    return;
  }

  if (!body.events || body.events.length === 0) {
    // 疎通確認リクエスト（events が空配列）は正常として無視する
    return;
  }

  // FAQ は同一リクエスト内で1回だけ取得し、全イベントで共有する
  const faqResult = await getActiveFaqs();
  if (faqResult.error) {
    console.error("[Webhook] FAQ 取得エラー:", faqResult.error);
  }
  const faqs = faqResult.data ?? [];

  const client = new MessagingApiClient({ channelAccessToken });

  await Promise.all(
    body.events.map((event) => handleEvent(event, client, faqs))
  );
}

async function handleEvent(
  event: webhook.Event,
  client: messagingApi.MessagingApiClient,
  faqs: Faq[]
): Promise<void> {
  // テキストメッセージイベント以外は無視する
  if (event.type !== "message") return;

  const messageEvent = event as webhook.MessageEvent;
  if (messageEvent.message.type !== "text") return;

  const textMessage = messageEvent.message as webhook.TextMessageContent;
  const replyToken = messageEvent.replyToken;

  if (!replyToken) {
    // replyToken がない場合はウェブフックの検証イベント
    return;
  }

  // 受信テキストと FAQ の question を完全一致で検索する
  const matched = faqs.find((faq) => faq.question === textMessage.text);
  const replyText = matched ? matched.answer : FALLBACK_MESSAGE;

  try {
    await client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: replyText }],
    });
  } catch (error) {
    console.error(
      `[Webhook] 返信に失敗しました (replyToken の末尾4文字: ...${replyToken.slice(-4)}):`,
      error
    );
  }
}
