import axios from "axios";

export function datadogAppBase(site: string) {
  return /^(datadoghq\.com|datadoghq\.eu)$/.test(site)
    ? `https://app.${site}`
    : `https://${site}`;
}

export async function ddCreateDashboard(payload: any) {
  const { DD_SITE, DD_API_KEY, DD_APP_KEY } = process.env as Record<string, string>;
  if (!DD_SITE || !DD_API_KEY || !DD_APP_KEY) throw new Error("Missing DD_SITE / DD_API_KEY / DD_APP_KEY");

  const apiBase = `https://api.${DD_SITE}`;
  const appBase = datadogAppBase(DD_SITE);

  try {
    const { data } = await axios.post(`${apiBase}/api/v1/dashboard`, payload, {
      headers: {
        "DD-API-KEY": DD_API_KEY,
        "DD-APPLICATION-KEY": DD_APP_KEY,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });
    const fullUrl = new URL(data.url, appBase).toString();
    return { ...data, fullUrl };
  } catch (err: any) {
    const dd = err?.response?.data;
    console.error("Datadog error:", typeof dd === "string" ? dd : JSON.stringify(dd, null, 2));
    throw err;
  }
}

/**
 * Send logs to Datadog Logs intake v2.
 * Returns HTTP status. When debug is enabled, prints and can dump payload to a file.
 */
export async function ddSendLogs(
  entries: any[],
  opts?: { dumpFile?: string; preview?: number; verbose?: boolean }
): Promise<number> {
  const { DD_SITE, DD_API_KEY, STARKY_LOG_MASK = "1" } = process.env as Record<string, string>;
  if (!DD_SITE || !DD_API_KEY) throw new Error("Missing DD_SITE / DD_API_KEY");

  const intakeUrl = `https://http-intake.logs.${DD_SITE}/api/v2/logs`;

  // Optional preview log lines
  if (opts?.verbose) {
    const n = Math.min(opts.preview ?? 2, entries.length);
    console.log(`🛰️  Posting ${entries.length} logs → ${intakeUrl}`);
    for (let i = 0; i < n; i++) {
      const e = entries[i];
      const masked = STARKY_LOG_MASK === "1"
        ? {
            ...e,
            tx_hash: e.tx_hash ? e.tx_hash.slice(0, 10) + "…" : undefined,
            contract_address: e.contract_address ? e.contract_address.slice(0, 10) + "…" : undefined,
            ddtags: e.ddtags,
          }
        : e;
      console.log("   • sample", i + 1, JSON.stringify(masked));
    }
  }

  if (opts?.dumpFile) {
    try {
      const fs = await import("fs");
      fs.writeFileSync(opts.dumpFile, JSON.stringify(entries, null, 2));
      if (opts?.verbose) console.log(`💾 Payload dumped to ${opts.dumpFile}`);
    } catch (e) {
      console.warn("Could not write dump file:", (e as Error).message);
    }
  }

  try {
    const res = await axios.post(intakeUrl, entries, {
      headers: {
        "DD-API-KEY": DD_API_KEY,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });
    if (opts?.verbose) {
      console.log(`✅ Datadog intake status: ${res.status}`);
    }
    return res.status;
  } catch (err: any) {
    const dd = err?.response?.data;
    console.error("❌ Datadog logs intake error:", typeof dd === "string" ? dd : JSON.stringify(dd, null, 2));
    throw err;
  }
}
