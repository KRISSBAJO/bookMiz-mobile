/** Only real public HTTP(S) websites belong in external business links. */
export function publicPhoneUrl(value?: string | null): string | null {
  if (!value || !/^\+?[\d\s().-]{5,30}$/.test(value.trim())) return null;
  const number = value.replace(/[^+0-9]/g, "");
  return /^\+?\d{5,18}$/.test(number) ? `tel:${number}` : null;
}

export function publicWebsiteUrl(value?: string | null): string | null {
  if (!value?.trim() || value.length > 2048) return null;
  const text = value.trim();
  if (/[\u0000-\u0020\\]/.test(text)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!host.includes(".") || !host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return null;
    if (/^[\d.]+$/.test(host) || host.includes(":")) return null;
    const reserved = ["example.com", "example.org", "example.net", "example", "test", "invalid", "localhost", "local", "internal", "home.arpa"];
    if (reserved.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
    url.hostname = host;
    return url.toString();
  } catch { return null; }
}

export function businessPagePath(slug: string): string {
  return `/marketplace/providers/${encodeURIComponent(slug)}`;
}

export function publicSocialUrl(value: string | null | undefined, network: "instagram" | "facebook" | "tiktok"): string | null {
  if (!value?.trim()) return null;
  const input = value.trim();
  const handle = input.replace(/^@/, "");
  const candidate = /^[a-z0-9_.-]{1,100}$/i.test(handle) && !handle.includes(".com")
    ? `https://www.${network}.com/${network === "tiktok" ? "@" : ""}${handle}`
    : input;
  const url = publicWebsiteUrl(candidate);
  if (!url) return null;
  const host = new URL(url).hostname;
  return host === `${network}.com` || host === `www.${network}.com` || (network === "facebook" && host === "m.facebook.com") ? url : null;
}


