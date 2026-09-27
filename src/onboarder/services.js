import { createConnection } from 'node:net';
import { SERVICE_CATALOG, PORT_TO_SERVICE, serviceKind, serviceFor, credsFromUrl, dockerRunLine } from '../doctor/services.js';

/**
 * Service definitions based on the proven acme-shop run.
 * These are the ONLY services we claim are proven.
 */
export const PROVEN_SERVICES = {
  postgres: {
    image: 'postgres:16-alpine',
    port: 5432,
    env: {
      POSTGRES_USER: 'acme',
      POSTGRES_PASSWORD: 'acme',
      POSTGRES_DB: 'acme'
    },
    volumes: ['pgdata:/var/lib/postgresql/data'],
    // Health check: pg_isready or TCP connect + protocol hello
    healthCheck: {
      tcp: true,
      protocol: 'postgres'
    },
    // The exact docker compose snippet from the proven run
    composeSnippet: `  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: acme
      POSTGRES_PASSWORD: acme
      POSTGRES_DB: acme
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data`,
    // Docker run line from the proven run
    dockerRunLine: `docker run -d --name postgres -p 5432:5432 -e POSTGRES_USER=acme -e POSTGRES_PASSWORD=acme -e POSTGRES_DB=acme -v pgdata:/var/lib/postgresql/data postgres:16-alpine`,
    // Native install hints (NOT proven)
    nativeHints: {
      linux: 'sudo apt-get install -y postgresql postgresql-contrib',
      darwin: 'brew install postgresql@16',
      win32: 'winget install PostgreSQL.PostgreSQL'
    },
    proven: true,
    source: 'acme-shop-3c0bc2b2'
  },
  redis: {
    image: 'redis:7-alpine',
    port: 6379,
    env: {},
    volumes: [],
    healthCheck: {
      tcp: true,
      protocol: 'redis'
    },
    composeSnippet: `  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379`,
    dockerRunLine: `docker run -d --name redis -p 6379:6379 redis:7-alpine`,
    nativeHints: {
      linux: 'sudo apt-get install -y redis-server',
      darwin: 'brew install redis',
      win32: 'winget install Redis.Redis'
    },
    proven: true,
    source: 'acme-shop-3c0bc2b2'
  }
};

/**
 * Check if a service is already running on the host.
 * Returns { running: boolean, reason: string, via: 'port' | 'protocol' | 'both' }
 */
export async function detectService(host, serviceName) {
  const service = PROVEN_SERVICES[serviceName];
  if (!service) {
    return { running: false, reason: 'unknown service', via: 'none' };
  }

  const port = service.port;
  const portOpen = host.ports?.includes(port);

  if (!portOpen) {
    return { running: false, reason: `port ${port} not open`, via: 'port' };
  }

  // Try protocol hello if available
  let protocolOk = false;
  let protocolError = null;

  if (service.healthCheck?.protocol === 'postgres') {
    const { ok, error } = await postgresHello(port);
    protocolOk = ok;
    protocolError = error;
  } else if (service.healthCheck?.protocol === 'redis') {
    const { ok, error } = await redisHello(port);
    protocolOk = ok;
    protocolError = error;
  }

  if (protocolOk) {
    return { running: true, reason: `port ${port} open and protocol OK`, via: 'both' };
  }

  // Port is open but protocol failed - could be wrong service
  return { running: false, reason: `port ${port} open but protocol failed: ${protocolError}`, via: 'port' };
}

/**
 * PostgreSQL protocol hello (pg_isready equivalent via raw socket).
 * Sends a startup packet and checks for authentication request or error.
 */
async function postgresHello(port, host = '127.0.0.1', timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host }, () => {
      // PostgreSQL startup message (protocol version 3.0, no parameters)
      // Length (4 bytes) + protocol version (4 bytes) = 8 bytes minimum
      // Protocol version 3.0 = 0x00030000
      const packet = Buffer.alloc(8);
      packet.writeUInt32BE(8, 0); // length including self
      packet.writeUInt32BE(0x00030000, 4); // protocol version 3.0
      socket.write(packet);
    });

    let buffer = Buffer.alloc(0);
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: 'timeout' });
    }, timeoutMs);

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      // Check for Authentication request (R message) or Error (E message)
      if (buffer.length >= 5) {
        const msgType = buffer[0];
        if (msgType === 0x52) { // 'R' - Authentication request
          clearTimeout(timeout);
          socket.destroy();
          resolve({ ok: true, error: null });
        } else if (msgType === 0x45) { // 'E' - Error response
          clearTimeout(timeout);
          socket.destroy();
          resolve({ ok: false, error: 'postgres error response' });
        } else if (msgType === 0x53) { // 'S' - ParameterStatus (also means success)
          clearTimeout(timeout);
          socket.destroy();
          resolve({ ok: true, error: null });
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: err.message });
    });

    socket.on('close', () => {
      clearTimeout(timeout);
      if (buffer.length === 0) {
        resolve({ ok: false, error: 'connection closed immediately' });
      }
    });
  });
}

/**
 * Redis protocol hello (PING).
 */
async function redisHello(port, host = '127.0.0.1', timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host }, () => {
      socket.write('PING\r\n');
    });

    let buffer = Buffer.alloc(0);
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: 'timeout' });
    }, timeoutMs);

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      const response = buffer.toString();
      if (response.includes('+PONG')) {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ok: true, error: null });
      } else if (response.startsWith('-')) {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ok: false, error: 'redis error response' });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: err.message });
    });

    socket.on('close', () => {
      clearTimeout(timeout);
      if (buffer.length === 0) {
        resolve({ ok: false, error: 'connection closed immediately' });
      }
    });
  });
}

/**
 * Check if Docker is available and compose v2 works.
 */
export async function checkDockerAvailable() {
  try {
    const { spawn } = await import('node:child_process');
    const dockerVersion = await runCmd('docker', ['version', '--format', '{{.Server.Version}}']);
    if (dockerVersion.code !== 0) {
      return { available: false, reason: 'docker not found or not running' };
    }
    const composeVersion = await runCmd('docker', ['compose', 'version', '--short']);
    if (composeVersion.code !== 0) {
      return { available: false, reason: 'docker compose v2 not available' };
    }
    return { available: true, version: dockerVersion.stdout.trim(), composeVersion: composeVersion.stdout.trim() };
  } catch {
    return { available: false, reason: 'docker check failed' };
  }
}

function runCmd(cmd, args, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const { spawn } = require('node:child_process');
    const child = spawn(cmd, args, { timeout: timeoutMs, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', code => resolve({ code: code ?? -1, stdout, stderr }));
    child.on('error', err => resolve({ code: -1, stdout: '', stderr: err.message }));
  });
}

/**
 * Get the proven docker compose snippet for a service.
 * This is identical to what the acme-shop proof used.
 */
export function getProvenComposeSnippet(serviceName) {
  const service = PROVEN_SERVICES[serviceName];
  if (!service) return null;
  return {
    snippet: service.composeSnippet,
    dockerRunLine: service.dockerRunLine,
    nativeHints: service.nativeHints,
    proven: true,
    source: 'acme-shop-3c0bc2b2'
  };
}

/**
 * Get all proven services needed by a repo (from plan.json evidence).
 */
export function getRequiredServices(plan) {
  // In the future, this would read from plan.json or evidence
  // For now, we know acme-shop needs postgres and redis
  const services = [];
  for (const step of plan.steps) {
    if (step.kind === 'services') {
      // Check evidence for what services were added
      if (step.evidence) {
        for (const e of step.evidence) {
          if (e.fix?.actions) {
            for (const action of e.fix.actions) {
              if (action.type === 'service' && PROVEN_SERVICES[action.name]) {
                services.push(action.name);
              }
            }
          }
        }
      }
    }
  }
  // Deduplicate
  return [...new Set(services)];
}