import axios from "axios";

export function requireDDEnvs() {
  const { DD_SITE, DD_API_KEY } = process.env;
  if (!DD_SITE || !DD_API_KEY) {
    throw new Error("Missing DD_SITE or DD_API_KEY");
  }
}

export async function ddCreateDashboard(payload: any) {
  const { DD_SITE, DD_API_KEY, DD_APP_KEY } = process.env as Record<string, string>;
  if (!DD_APP_KEY) throw new Error("Missing DD_APP_KEY");
  const url = `https://api.${DD_SITE}/api/v1/dashboard`;
  const res = await axios.post(url, payload, {
    headers: {
      "DD-API-KEY": DD_API_KEY,
      "DD-APPLICATION-KEY": DD_APP_KEY,
      "Content-Type": "application/json"
    }
  });
  return res.data; // { id, url, ... }
}

export async function ddSendLogs(logs: any[]) {
  const { DD_SITE, DD_API_KEY } = process.env as Record<string, string>;
  const url = `https://http-intake.logs.${DD_SITE}/api/v2/logs`;
  await axios.post(url, logs, {
    headers: {
      "DD-API-KEY": DD_API_KEY,
      "Content-Type": "application/json"
    }
  });
}
