// @ts-check
// Node.js 24のLambda RuntimeにはAWS SDK v3が含まれるため、ビルド・Bundleせずにそのまま配置する。
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({ maxAttempts: 2 });
const region = "ap-northeast-1";

/** @typedef {(url: string, init: RequestInit) => Promise<Response>} Send */

/**
 * CloudWatch Alarmの通知を、Discordの文字数制限内のWebhook Payloadへ変換する。
 * @param {string} message SNSで受け取ったCloudWatch Alarmの通知本文
 * @param {readonly string[]} mentionUserIds Terraformで検証・重複除去済みのDiscord User ID
 */
export function alarmPayload(message, mentionUserIds = []) {
  const alarm = JSON.parse(message);
  if (alarm?.NewStateValue !== "ALARM" && alarm?.NewStateValue !== "OK") {
    throw new Error("Expected an ALARM or OK CloudWatch notification");
  }
  if (typeof alarm.AlarmName !== "string" || !alarm.AlarmName) {
    throw new Error("CloudWatch notification has no alarm name");
  }
  return {
    ...(mentionUserIds.length > 0 ? { content: mentionUserIds.map(id => `<@${id}>`).join(" ") } : {}),
    // 指定したUser以外（@everyone・Role・本文中のメンション）は通知しない。
    allowed_mentions: { parse: [], users: [...mentionUserIds] },
    embeds: [{
      title: `${alarm.NewStateValue}: ${alarm.AlarmName}`.slice(0, 256),
      url: `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#alarmsV2:alarm/${encodeURIComponent(alarm.AlarmName)}`,
      color: alarm.NewStateValue === "ALARM" ? 0xe74c3c : 0x2ecc71,
      description: displayText(alarm.NewStateReason, "No reason supplied", 1800),
      fields: [
        { name: "Previous state", value: displayText(alarm.OldStateValue, "Unknown", 128), inline: true },
        { name: "Changed at", value: displayText(alarm.StateChangeTime, "Unknown", 128), inline: true },
      ],
    }],
  };
}

/**
 * @param {unknown} value
 * @param {string} fallback
 * @param {number} limit
 */
function displayText(value, fallback, limit) {
  return (typeof value === "string" && value.length > 0 ? value : fallback).slice(0, limit);
}

/**
 * @param {string} webhookUrl
 * @param {ReturnType<typeof alarmPayload>} payload
 * @param {Send} send
 */
export async function postToDiscord(webhookUrl, payload, send = fetch) {
  let response;
  try {
    response = await send(`${webhookUrl}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    await response.body?.cancel();
  } catch {
    // 通信例外にはWebhook URLが含まれ得るため、元の例外をログへ渡さない。
    throw new Error("Discord delivery failed (network error)");
  }
  // wait=trueでは保存成功時に200が返る。429・5xxも失敗としてLambdaの再試行へ渡す。
  if (response.status !== 200) {
    throw new Error(`Discord delivery failed (HTTP ${response.status})`);
  }
}

/** @param {string | undefined} parameterName */
async function readWebhookUrl(parameterName) {
  const response = await ssm.send(
    new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
    { abortSignal: AbortSignal.timeout(8_000) },
  );
  const url = response.Parameter?.Value;
  if (!url) throw new Error("Discord webhook SecureString is empty");
  return url;
}

/** @param {import("aws-lambda").SNSEvent} event */
export async function handler(event) {
  const mentionUserIds = JSON.parse(process.env.DISCORD_MENTION_USER_IDS ?? "[]");
  const payloads = event.Records.map(record => alarmPayload(record.Sns.Message, mentionUserIds));
  const webhookUrl = await readWebhookUrl(process.env.WEBHOOK_PARAMETER_NAME);
  for (const payload of payloads) await postToDiscord(webhookUrl, payload);
}
