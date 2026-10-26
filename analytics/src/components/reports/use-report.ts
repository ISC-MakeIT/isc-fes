"use client";
import { useEffect, useState } from "react";
import type { Metadata } from "@/lib/types";
import { reportParams } from "@/lib/report-filters";

async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "集計を取得できませんでした。");
  return body;
}
export function useReport<
  F extends { start: string; end: string; interval: string },
  D extends { filters: F },
>(endpoint: string, defaults: (meta: Metadata) => F, parse: (params: URLSearchParams) => F) {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [filters, setFilters] = useState<F | null>(null);
  const [applied, setApplied] = useState<F | null>(null);
  const [data, setData] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [connection, setConnection] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    json<Metadata>("/api/metadata", controller.signal)
      .then((meta) => {
        if (controller.signal.aborted) return;
        setMetadata(meta);
        const base = defaults(meta);
        const params = reportParams(base);
        for (const [key, value] of new URLSearchParams(window.location.search))
          params.set(key, value);
        try {
          setFilters(parse(params));
        } catch {
          setFilters(base);
        }
        setError(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [defaults, parse, connection]);
  useEffect(() => {
    if (!filters) return;
    let valid: F;
    try {
      valid = parse(reportParams(filters));
      setIssue(null);
    } catch (e) {
      setIssue((e as Error).message);
      return;
    }
    if (applied && reportParams(valid).toString() === reportParams(applied).toString()) return;
    const timer = window.setTimeout(() => setApplied(valid), applied ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [filters, applied, parse]);
  useEffect(() => {
    if (!applied) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    window.history.replaceState(null, "", `?${reportParams(applied)}`);
    json<D>(`${endpoint}?${reportParams(applied)}`, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [endpoint, applied, refresh]);
  let pending = !!filters;
  if (filters && data) {
    try {
      pending =
        reportParams(parse(reportParams(filters))).toString() !==
        reportParams(data.filters).toString();
    } catch {
      /* Invalid drafts keep exports disabled until corrected. */
    }
  }
  function update<K extends keyof F>(key: K, value: F[K]) {
    setFilters((f) => (f ? { ...f, [key]: value } : f));
  }
  return {
    metadata,
    filters,
    setFilters,
    data,
    error,
    issue,
    loading,
    pending,
    update,
    refresh: () => (metadata ? setRefresh((n) => n + 1) : setConnection((n) => n + 1)),
  };
}
