import { describe, test, expect } from "bun:test";
import { parseInstanceId, readInstanceIdentity } from "../identity";
import type { Fetcher } from "../client";

describe("EC2 identity without network access", () => {
  const identity = { instanceId: "i-0123456789abcdef0", instanceType: "t4g.small" };
  test("requires an EC2 instance ID rather than an arbitrary label", () => {
    expect(parseInstanceId(identity.instanceId)).toBe(identity.instanceId);
    expect(parseInstanceId("i-01234567")).toBe("i-01234567");
    for (const value of [undefined, "", "i-test", "i-012345678", "i-0123456789abcdef00"])
      expect(() => parseInstanceId(value)).toThrow("instance ID");
  });
  test("uses an IMDSv2 token to read the host instance identity", async () => {
    const calls: string[] = [];
    const fetcher: Fetcher = async (input, options) => {
      const url = String(input); calls.push(url);
      expect(options?.redirect).toBe("error");
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      if (url.endsWith("/api/token")) {
        expect(options?.method).toBe("PUT");
        expect(new Headers(options?.headers).get("X-aws-ec2-metadata-token-ttl-seconds")).toBe("60");
        return new Response("test-token");
      }
      expect(new Headers(options?.headers).get("X-aws-ec2-metadata-token")).toBe("test-token");
      return Response.json(identity);
    };
    expect(await readInstanceIdentity(fetcher)).toEqual(identity);
    expect(calls).toEqual(["http://169.254.169.254/latest/api/token", "http://169.254.169.254/latest/dynamic/instance-identity/document"]);
  });
  test("rejects unavailable or invalid metadata and sanitizes errors", async () => {
    let calls = 0;
    await expect(readInstanceIdentity(async () => { calls++; return new Response("secret-token", { status: 403 }); })).rejects.toThrow("Cannot verify target EC2 identity via IMDSv2");
    expect(calls).toBe(1);
    for (const document of [null, { ...identity, instanceId: "i-test" }, { ...identity, instanceType: null }]) {
      await expect(readInstanceIdentity(async input => String(input).endsWith("/api/token") ? new Response("test-token") : Response.json(document))).rejects.toThrow("Cannot verify target EC2 identity via IMDSv2");
    }
    await expect(readInstanceIdentity(async () => { throw new Error("secret-token"); })).rejects.toThrow("Cannot verify target EC2 identity via IMDSv2");
  });
});
