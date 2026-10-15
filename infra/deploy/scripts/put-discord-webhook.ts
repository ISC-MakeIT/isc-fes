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
  const request = {
    Name: "/isc-fes/prod/discord-webhook-url",
    Value: validateWebhookUrl(prompt.stdout.toString()),
    Type: "SecureString",
    KeyId: "alias/aws/ssm",
    Tier: "Standard",
    Overwrite: true,
  };
  const command = Bun.spawn(["aws", "ssm", "put-parameter", "--region", "ap-northeast-1", "--cli-input-json", "file:///dev/stdin", "--query", "Version", "--output", "text"], {
    env, stdin: new TextEncoder().encode(JSON.stringify(request)), stdout: "ignore", stderr: "ignore",
  });
  if (await command.exited !== 0) throw new Error("Registration failed. Check AWS login and IAM permissions.");
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
