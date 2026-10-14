import type { Fetcher } from "./client";

export type InstanceIdentity = { instanceId: string; instanceType: string };

export function parseInstanceId(value: unknown): string {
  if (typeof value !== "string" || !/^i-(?:[0-9a-f]{8}|[0-9a-f]{17})$/.test(value)) throw new Error("Invalid EC2 instance ID");
  return value;
}

// Read identity from the host itself, rather than trusting a label supplied to the collector.
export async function readInstanceIdentity(fetcher: Fetcher = fetch): Promise<InstanceIdentity> {
  const endpoint = "http://169.254.169.254/latest";
  try {
    const tokenResponse = await fetcher(`${endpoint}/api/token`, {
      method: "PUT", headers: { "X-aws-ec2-metadata-token-ttl-seconds": "60" },
      redirect: "error", signal: AbortSignal.timeout(5000),
    });
    if (!tokenResponse.ok) throw new Error("IMDSv2 token request failed");
    const token = await tokenResponse.text();
    if (!token.trim()) throw new Error("Empty IMDSv2 token");
    const response = await fetcher(`${endpoint}/dynamic/instance-identity/document`, {
      headers: { "X-aws-ec2-metadata-token": token }, redirect: "error", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("IMDSv2 identity request failed");
    const identity = await response.json() as Partial<InstanceIdentity> | null;
    if (typeof identity?.instanceType !== "string" || !identity.instanceType.trim()) throw new Error("Invalid instance type");
    return { instanceId: parseInstanceId(identity.instanceId), instanceType: identity.instanceType };
  } catch {
    // Do not include metadata tokens or response bodies in collector errors.
    throw new Error("Cannot verify target EC2 identity via IMDSv2");
  }
}
