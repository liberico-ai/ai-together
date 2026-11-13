import type { SourceType } from './types';

/**
 * Hosts allowed for a document's canonical source link, per source type.
 * OQ-25 (a), decided by Chairman on 13/11/2026: «(a) Allowlist cố định» (docs/OPEN-QUESTIONS.md, OQ-25).
 * Exact host match only (no subdomains), default https port only. Vault does not accept https links yet.
 * Changing this list requires a PR and review. No runtime dependency, so the UI may import it for its hint.
 */
export const SOURCE_HOSTS: Readonly<Record<SourceType, readonly string[]>> = Object.freeze({
  drive: Object.freeze(['docs.google.com', 'drive.google.com']),
  git: Object.freeze(['github.com']),
  vault: Object.freeze([] as string[]),
});

const LABEL: Readonly<Record<SourceType, string>> = Object.freeze({ drive: 'Drive', git: 'Git', vault: 'Vault' });
const VAULT_NO_HTTPS = 'Nguồn Vault chưa nhận liên kết https. Giữ con trỏ đường dẫn Vault ở hồ sơ dự án.';
const UNKNOWN_TYPE = 'Loại nguồn không hợp lệ.';

/** One line for the registration form, built from the list above. */
export const SOURCE_HOST_HINT = 'Drive nhận ' + SOURCE_HOSTS.drive.join(', ') + ' · Git nhận ' + SOURCE_HOSTS.git.join(', ') + ' · Vault chưa nhận liên kết https.';

/** null when `href` is an https link whose host is allowed for `type`; otherwise a Vietnamese reason. Never throws. */
export function sourceHostProblem(type: SourceType, href: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(SOURCE_HOSTS, type)) return UNKNOWN_TYPE;
  const hosts = SOURCE_HOSTS[type];
  if (hosts.length === 0) return type === 'vault' ? VAULT_NO_HTTPS : UNKNOWN_TYPE;
  const refused = 'Nguồn ' + LABEL[type] + ' chỉ nhận liên kết https tại ' + hosts.join(', ') + ', không dùng cổng riêng.';
  let u: URL;
  try { u = new URL(href); } catch { return refused; }
  return u.protocol === 'https:' && u.port === '' && hosts.includes(u.hostname) ? null : refused;
}
