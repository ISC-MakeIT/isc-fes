type Dependencies = {
  send?: (url: URL, init: RequestInit) => Promise<Response>;
  sleep?: (milliseconds: number) => Promise<void>;
};

/** 失敗通知だけを送る。Webhook URLを含む通信例外は呼出側へ返さない。 */
export async function notifyBackupFailure(
  webhookUrl: string,
  stage: string,
  workflowUrl: string,
  dependencies: Dependencies = {},
): Promise<void> {
  let url: URL;
  try {
    url = new URL(webhookUrl);
  } catch {
    throw new Error("Discord Webhook URL is missing or invalid.");
  }
  if (
    url.protocol !== "https:" ||
    url.host !== "discord.com" ||
    !/^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error("Discord Webhook URL is missing or invalid.");
  }
  url.searchParams.set("wait", "true");
  const send = dependencies.send ?? fetch;
  const sleep = dependencies.sleep ?? ((milliseconds) => Bun.sleep(milliseconds));
  const body = JSON.stringify({
    content: `本番DBバックアップに失敗しました。\n段階: ${stage}\n${workflowUrl}`,
    allowed_mentions: { parse: [] },
  });

  for (let attempt = 0; attempt < 4; attempt++) {
    let response: Response | undefined;
    let delay = 2 ** attempt * 1_000;
    try {
      response = await send(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "isc-fes-db-backup" },
        body,
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
      });
    } catch {
      // 接続失敗・timeoutは再試行する。元の例外にはSecretが含まれ得る。
    }
    if (response?.status === 200) {
      await response.body?.cancel();
      return;
    }
    if (response && response.status !== 429 && (response.status < 500 || response.status >= 600)) {
      await response.body?.cancel();
      throw new Error(`Discord notification failed (HTTP ${response.status}).`);
    }
    if (response?.status === 429) {
      try {
        const payload: unknown = await response.json();
        if (typeof payload === "object" && payload !== null && "retry_after" in payload) {
          const retryAfter = payload.retry_after;
          if (typeof retryAfter === "number") {
            delay = Math.max(delay, retryAfter * 1_000);
          }
        }
      } catch {
        // 不正なレスポンスでも上限付きのbackoffを維持する。
      }
    } else {
      await response?.body?.cancel();
    }
    if (!Number.isFinite(delay) || delay > 60_000) {
      throw new Error("Discord retry delay exceeds the notification budget.");
    }
    if (attempt === 3) {
      throw new Error("Discord notification failed after four attempts.");
    }
    await sleep(delay);
  }
}

if (import.meta.main) {
  try {
    await notifyBackupFailure(
      Bun.env.DISCORD_WEBHOOK_URL ?? "",
      Bun.env.BACKUP_FAILURE_STAGE ?? "unknown",
      Bun.env.BACKUP_WORKFLOW_URL ?? "",
    );
    console.log("Discord failure notification sent.");
  } catch {
    console.error("Discord notification failed; check the Secret and notification job.");
    process.exitCode = 1;
  }
}
