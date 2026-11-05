import { after } from "next/server";
import { timingSafeEqual } from "crypto";
import { validateSignature, messagingApi, webhook } from "@line/bot-sdk";
import {
  getActiveFaqs,
  saveUnansweredQuestion,
  registerOwner,
  type Faq,
} from "@/lib/supabase/server";
import { getAiAnswer } from "@/lib/claude/client";
import { notifyOwner } from "@/lib/line/notify";

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

  // after() でレスポンス送信後も非同期処理を継続させる。
  // Vercel Serverless Functions はレスポンスを返した直後に実行コンテキストを終了する。
  // 以前の fire-and-forget（.catch() だけつけて未 await）では、200 を返した時点で
  // Supabase への接続も LINE Reply API 呼び出しも全てキャンセルされていた。
  // after() は Vercel の waitUntil として機能し、登録した Promise が
  // 解決するまで関数を生かし続ける。
  after(async () => {
    try {
      await handleEvents(rawBody, env.channelAccessToken);
    } catch (error) {
      console.error("[Webhook] イベント処理中にエラーが発生しました:", error);
    }
  });

  return new Response("OK", { status: 200 });
}

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

  console.log(`[Webhook] イベント処理開始 (${body.events.length} 件)`);

  // FAQ は同一リクエスト内で1回だけ取得し、全イベントで共有する
  const faqResult = await getActiveFaqs();
  if (faqResult.error) {
    console.error("[Webhook] FAQ 取得エラー:", faqResult.error);
  }
  const faqs = faqResult.data ?? [];
  console.log(`[Webhook] FAQ 取得完了 (${faqs.length} 件)`);

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

  // オーナー登録コマンド（"オーナー登録 <secret>"）を最初に処理する。
  // 認証が通った場合は登録して返信し、以降の FAQ/AI 応答をスキップする。
  if (textMessage.text.startsWith("オーナー登録 ")) {
    await handleOwnerRegistration(textMessage.text, messageEvent, client);
    return;
  }

  // FAQ と完全一致する場合は登録済み回答を返す。
  // 一致しない場合のみ Claude API を呼び出してFAQを根拠に回答させる。
  const matched = faqs.find((faq) => faq.question === textMessage.text);

  let replyText: string;
  let saveToDb = false;

  if (matched) {
    console.log("[Webhook] メッセージ受信 → FAQ完全一致");
    replyText = matched.answer;
  } else {
    console.log("[Webhook] メッセージ受信 → Claude AI 呼び出し");
    const aiResult = await getAiAnswer(textMessage.text, faqs);
    replyText = aiResult.text;
    // AI が回答できなかった場合のみ DB に保存する
    saveToDb = !aiResult.answered;
    if (saveToDb) {
      console.log("[Webhook] AI 回答不可 → 未回答質問を記録");
    }
  }

  // LINE への返信（保存処理に先行させる）
  try {
    await client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: replyText }],
    });
    console.log("[Webhook] LINE 返信成功");
  } catch (error) {
    console.error(
      `[Webhook] 返信に失敗しました (replyToken の末尾4文字: ...${replyToken.slice(-4)}):`,
      error
    );
  }

  // 回答不可の場合のみ Supabase に保存し、新規保存時にオーナーへ通知する。
  // 返信の成否に関わらず試み、保存・通知の失敗はログで記録するがユーザー体験には影響させない。
  if (saveToDb) {
    // source・userId は共に optional（グループ送信・source 欠落の場合は null）
    const lineUserId = messageEvent.source?.userId ?? null;
    const receivedAt = new Date(event.timestamp);

    const result = await saveUnansweredQuestion({
      lineEventId: event.webhookEventId,
      lineUserId,
      question: textMessage.text,
      receivedAt,
    });

    if (result.saved) {
      if (result.isNew) {
        // 新規保存成功 → オーナーへ通知
        console.log("[Webhook] 未回答質問の保存完了 → オーナーへ通知");
        await notifyOwner(textMessage.text, receivedAt);
      } else {
        // webhook 再送による重複 → 通知はスキップ（二重通知防止）
        console.log("[Webhook] 再送イベント → 通知スキップ");
      }
    }
    // 保存失敗のログは saveUnansweredQuestion 内で記録済み
  }
}

// ---------------------------------------------------------------------------
// オーナー登録
// ---------------------------------------------------------------------------

/**
 * タイミング攻撃を緩和するシークレット比較。
 * 長さが異なる場合はダミー比較でタイミングを均一化してから false を返す。
 */
function isValidSecret(input: string, expected: string): boolean {
  const inputBuf = Buffer.from(input);
  const expectedBuf = Buffer.from(expected);
  if (inputBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf); // ダミー比較
    return false;
  }
  return timingSafeEqual(inputBuf, expectedBuf);
}

/**
 * "オーナー登録 <secret>" コマンドを処理する。
 * - OWNER_REGISTRATION_SECRET と一致した場合のみ登録する
 * - 認証失敗時はサイレントスキップ（コマンドの存在・形式を外部に漏らさない）
 * - lineUserId はログに出力しない
 */
async function handleOwnerRegistration(
  text: string,
  messageEvent: webhook.MessageEvent,
  client: messagingApi.MessagingApiClient
): Promise<void> {
  const replyToken = messageEvent.replyToken;
  if (!replyToken) return;

  const registrationSecret = process.env.OWNER_REGISTRATION_SECRET;
  if (!registrationSecret) {
    console.warn("[Owner] OWNER_REGISTRATION_SECRET 未設定 → 登録スキップ");
    return;
  }

  // "オーナー登録 " の後ろをシークレットとして抽出
  const inputSecret = text.slice("オーナー登録 ".length);

  if (!isValidSecret(inputSecret, registrationSecret)) {
    // サイレントスキップ（ログにシークレットは出力しない）
    console.warn("[Owner] 登録試行: 認証失敗");
    return;
  }

  const lineUserId = messageEvent.source?.userId;
  if (!lineUserId) {
    console.error("[Owner] userId が取得できません");
    return;
  }

  const result = await registerOwner(lineUserId);
  if (!result.success) {
    console.error("[Owner] DB 保存失敗:", result.error);
    return;
  }

  console.log("[Owner] オーナー登録完了");

  try {
    await client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: "オーナー登録が完了しました。" }],
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "不明なエラー";
    console.error("[Owner] 返信失敗:", msg);
  }
}
