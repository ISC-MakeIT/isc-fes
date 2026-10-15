import { PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

// LambdaはURLを検証しないため、登録時にDiscordのWebhook URLであることを確認する。
function validateWebhookUrl(value: string): string {
  const url = value.trim();
  if (!/^https:\/\/discord\.com\/api(?:\/v10)?\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+$/.test(url)) {
    throw new Error("Invalid Discord webhook URL");
  }
  return url;
}

export async function registerWebhook(expectedAccountId = "970835573274"): Promise<void> {
  const env = { ...process.env, AWS_PAGER: "", AWS_CLI_AUTO_PROMPT: "off" };
  const account = Bun.spawnSync(["aws", "sts", "get-caller-identity", "--query", "Account", "--output", "text"], { env, stdout: "pipe", stderr: "pipe" });
  if (account.exitCode !== 0) throw new Error("AWS login failed. Check credentials and IAM permissions.");
  if (account.stdout.toString().trim() !== expectedAccountId) throw new Error("AWS Account ID does not match the deployment account");
  if (!process.stdin.isTTY) throw new Error("Run in an interactive terminal for hidden webhook input");
  // bashのread -sで入力を隠す。Secretは子プロセスのstdoutからメモリ内で受け取る。
  const prompt = Bun.spawnSync(["bash", "-c", 'IFS= read -r -s -p "Discord Webhook URL（非表示）: " webhook || exit 1; printf "\\n" >&2; printf "%s" "$webhook"'], { stdin: "inherit", stdout: "pipe", stderr: "inherit" });
  if (prompt.exitCode !== 0) throw new Error("Webhook input cancelled");
  const webhookUrl = validateWebhookUrl(prompt.stdout.toString());
  // AWS CLIへstdinで渡す方式はmacOSで/dev/stdinを開けず失敗するため、SDKで直接登録する。
  try {
    await new SSMClient({ region: "ap-northeast-1" }).send(new PutParameterCommand({
      Name: "/isc-fes/prod/discord-webhook-url",
      Value: webhookUrl,
      Type: "SecureString",
      KeyId: "alias/aws/ssm",
      Tier: "Standard",
      Overwrite: true,
    }));
  } catch (error) {
    // 例外のメッセージ全体は出さず、原因を追えるようにエラー名だけを表示する。
    throw new Error(`Registration failed: ${error instanceof Error ? error.name : "unknown error"}`);
  }
  console.log("Registered /isc-fes/prod/discord-webhook-url as SecureString.");
}

if (import.meta.main) {
  try {
    await registerWebhook();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Webhook registration failed");
    process.exitCode = 1;
  }
}
