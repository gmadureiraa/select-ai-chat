// SSRF guard for handlers that fetch arbitrary URLs.
//
// Bloqueia:
//  - protocolos != http/https (file://, gopher://, ftp://, data:, javascript:)
//  - IPs privados RFC 1918 (10/8, 172.16/12, 192.168/16, 169.254/16 link-local,
//    127/8 loopback, 0.0.0.0, IPv6 ::1, fc00::/7 unique local)
//  - hostnames "localhost", "metadata.google.internal", "169.254.169.254" (cloud metadata)
//  - portas suspeitas (22, 25, 6379, 5432, 3306, 27017, 11211, 9200, etc — DB/cache)
//
// USO:
//   import { assertSafeUrl } from '../_lib/url-guard.js';
//   await assertSafeUrl(url); // throws Error com statusCode=400 se bloqueado
//
// Por padrão, FAZ resolução DNS pra prevenir DNS rebinding via hostnames
// que apontam pra IPs privados. Se opts.skipDnsCheck=true, só valida hostname.

import { promises as dns } from 'node:dns';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'metadata.google.internal',
  'metadata',
  'instance-data',
  'instance-data.ec2.internal',
]);

const BLOCKED_PORTS = new Set([
  22,    // SSH
  23,    // Telnet
  25,    // SMTP
  445,   // SMB
  587,   // SMTP submission
  993,   // IMAPS
  995,   // POP3S
  1433,  // MSSQL
  1521,  // Oracle
  2375,  // Docker
  3306,  // MySQL
  5432,  // Postgres
  5984,  // CouchDB
  6379,  // Redis
  7000,  // Cassandra
  7001,  // Cassandra
  8500,  // Consul
  9042,  // Cassandra
  9200,  // Elasticsearch
  11211, // Memcached
  27017, // MongoDB
]);

function isPrivateIpv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1, 5).map(Number);
  if (o.some((n) => n < 0 || n > 255)) return false;

  // 0.0.0.0/8
  if (o[0] === 0) return true;
  // 10.0.0.0/8
  if (o[0] === 10) return true;
  // 100.64.0.0/10 (carrier-grade NAT)
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true;
  // 127.0.0.0/8 (loopback)
  if (o[0] === 127) return true;
  // 169.254.0.0/16 (link-local — inclui AWS/GCP metadata 169.254.169.254)
  if (o[0] === 169 && o[1] === 254) return true;
  // 172.16.0.0/12
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
  // 192.0.0.0/24, 192.0.2.0/24 (TEST-NET-1)
  if (o[0] === 192 && o[1] === 0) return true;
  // 192.168.0.0/16
  if (o[0] === 192 && o[1] === 168) return true;
  // 198.18.0.0/15 (benchmarking)
  if (o[0] === 198 && (o[1] === 18 || o[1] === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2), 203.0.113.0/24 (TEST-NET-3)
  if (o[0] === 198 && o[1] === 51 && o[2] === 100) return true;
  if (o[0] === 203 && o[1] === 0 && o[2] === 113) return true;
  // 224.0.0.0/4 (multicast)
  if (o[0] >= 224 && o[0] <= 239) return true;
  // 240.0.0.0/4 (reserved)
  if (o[0] >= 240) return true;

  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') ||
      lower.startsWith('fea') || lower.startsWith('feb')) return true; // fe80::/10 link-local
  if (lower.startsWith('ff')) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d)
  const v4 = lower.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
  if (v4 && isPrivateIpv4(v4[1])) return true;
  return false;
}

function isPrivateHost(host: string): boolean {
  if (BLOCKED_HOSTNAMES.has(host.toLowerCase())) return true;
  if (isPrivateIpv4(host)) return true;
  if (host.includes(':') && isPrivateIpv6(host)) return true;
  return false;
}

export interface UrlGuardOptions {
  /** Pula resolução DNS (usar quando o host já é IP literal). Default false. */
  skipDnsCheck?: boolean;
  /** Allowlist de hostnames permitidos (override total — só passa esses). */
  allowedHostnames?: string[];
}

/**
 * Valida URL contra SSRF. Throws `Error` com `statusCode=400` se bloqueado.
 *
 * IMPORTANTE: resolve DNS por padrão. Se o hostname resolver pra IP privado
 * (ataque DNS rebinding clássico), bloqueia.
 */
export async function assertSafeUrl(
  rawUrl: string,
  opts: UrlGuardOptions = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw withStatus(new Error('Invalid URL'), 400);
  }

  // Protocolo
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw withStatus(
      new Error(`Protocol not allowed: ${url.protocol}`),
      400,
    );
  }

  // Porta
  const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
  if (BLOCKED_PORTS.has(port)) {
    throw withStatus(new Error(`Port ${port} not allowed`), 400);
  }

  const hostname = url.hostname.toLowerCase();

  // Allowlist override
  if (opts.allowedHostnames && opts.allowedHostnames.length > 0) {
    const ok = opts.allowedHostnames.some((h) => {
      const hl = h.toLowerCase();
      return hostname === hl || hostname.endsWith(`.${hl}`);
    });
    if (!ok) {
      throw withStatus(new Error(`Hostname ${hostname} not in allowlist`), 400);
    }
  }

  // Blocklist direta
  if (isPrivateHost(hostname)) {
    throw withStatus(new Error(`Host ${hostname} is private/blocked`), 400);
  }

  // DNS rebinding prevention
  if (!opts.skipDnsCheck) {
    // Se já é IP literal, skip
    const isLiteralIp =
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      hostname.includes(':');
    if (!isLiteralIp) {
      try {
        const addrs = await dns.lookup(hostname, { all: true });
        for (const a of addrs) {
          if (isPrivateHost(a.address)) {
            throw withStatus(
              new Error(`Host ${hostname} resolves to private IP ${a.address}`),
              400,
            );
          }
        }
      } catch (err: any) {
        if (err?.statusCode === 400) throw err;
        // DNS lookup falhou — bloqueia por segurança
        throw withStatus(
          new Error(`Cannot resolve host ${hostname}`),
          400,
        );
      }
    }
  }

  return url;
}

function withStatus(err: Error, status: number): Error {
  (err as any).status = status;
  (err as any).statusCode = status;
  return err;
}
