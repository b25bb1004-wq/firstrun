/** Backing services a README may forget, keyed by the port the app tries to reach. */
export const SERVICE_CATALOG = {
  postgres: { image: 'postgres:16-alpine', port: 5432, env: { POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'postgres', POSTGRES_DB: 'postgres' } },
  redis: { image: 'redis:7-alpine', port: 6379, env: {} },
  mongo: { image: 'mongo:7', port: 27017, env: {} },
  mysql: { image: 'mysql:8', port: 3306, env: { MYSQL_ROOT_PASSWORD: 'root', MYSQL_DATABASE: 'app' } },
  rabbitmq: { image: 'rabbitmq:3-alpine', port: 5672, env: {} },
  memcached: { image: 'memcached:1-alpine', port: 11211, env: {} },
  elasticsearch: { image: 'docker.elastic.co/elasticsearch/elasticsearch:8.14.0', port: 9200, env: { 'discovery.type': 'single-node', 'xpack.security.enabled': 'false', ES_JAVA_OPTS: '-Xms512m -Xmx512m' } },
  minio: { image: 'minio/minio', port: 9000, env: {} },
  // Catches outgoing mail locally (web UI on :8025), so apps that send email start without a real SMTP account.
  mailpit: { image: 'axllent/mailpit', port: 1025, env: { MP_SMTP_AUTH_ACCEPT_ANY: '1', MP_SMTP_AUTH_ALLOW_INSECURE: '1' } },
};

export const PORT_TO_SERVICE = { 5432: 'postgres', 6379: 'redis', 27017: 'mongo', 3306: 'mysql', 5672: 'rabbitmq', 11211: 'memcached', 9200: 'elasticsearch', 9000: 'minio', 1025: 'mailpit' };

export function serviceKind(image = '', name = '') {
  const s = `${image} ${name}`.toLowerCase();
  if (/postgres|postgis|timescale/.test(s)) return 'postgres';
  if (/redis|valkey|keydb/.test(s)) return 'redis';
  if (/mongo/.test(s)) return 'mongo';
  if (/mysql|mariadb/.test(s)) return 'mysql';
  if (/rabbit/.test(s)) return 'rabbitmq';
  if (/memcache/.test(s)) return 'memcached';
  if (/elastic|opensearch/.test(s)) return 'elasticsearch';
  if (/minio/.test(s)) return 'minio';
  if (/mailpit|mailhog|mailcatcher|maildev/.test(s)) return 'mailpit';
  return null;
}

/** postgres://user:pass@host:5432/db → credentials for the Postgres container. */
export function credsFromUrl(url) {
  try {
    const u = new URL(url);
    return {
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      db: u.pathname.replace(/^\//, '') || '',
      host: u.hostname,
      port: Number(u.port) || null,
    };
  } catch { return null; }
}

/**
 * Build a service definition that matches what the app expects, preferring
 * (1) the repo's compose file, (2) connection URLs from .env / .env.example,
 * (3) catalog defaults.
 */
export function serviceFor(kind, { facts, envValues = {} }) {
  const base = SERVICE_CATALOG[kind];
  if (!base) return null;
  const composeSvc = facts.compose?.services.find((s) => serviceKind(s.image, s.name) === kind && s.image);
  const def = { name: composeSvc?.name || kind, image: composeSvc?.image || base.image, port: base.port, env: { ...base.env, ...(composeSvc?.environment || {}) }, fromCompose: !!composeSvc };
  if (kind === 'postgres') {
    const url = Object.entries(envValues).find(([k, v]) => /DATABASE_URL|POSTGRES_URL|PG_URL|DB_URL/i.test(k) && /^postgres/.test(v))?.[1];
    const c = url && credsFromUrl(url);
    if (c) {
      if (c.user) def.env.POSTGRES_USER = c.user;
      if (c.password) def.env.POSTGRES_PASSWORD = c.password;
      if (c.db) def.env.POSTGRES_DB = c.db;
    }
    for (const [k, v] of Object.entries(envValues)) {
      if (/^(POSTGRES_|PG)(USER|USERNAME)$/.test(k)) def.env.POSTGRES_USER = v;
      if (/^(POSTGRES_|PG)PASSWORD$/.test(k)) def.env.POSTGRES_PASSWORD = v;
      if (/^(POSTGRES_DB|PGDATABASE)$/.test(k)) def.env.POSTGRES_DB = v;
    }
    if (!def.env.POSTGRES_PASSWORD) def.env.POSTGRES_HOST_AUTH_METHOD = 'trust';
  }
  if (kind === 'mysql') {
    const url = Object.values(envValues).find((v) => /^mysql/.test(v));
    const c = url && credsFromUrl(url);
    if (c) {
      if (c.user && c.user !== 'root') { def.env.MYSQL_USER = c.user; def.env.MYSQL_PASSWORD = c.password; }
      else if (c.password) def.env.MYSQL_ROOT_PASSWORD = c.password;
      if (c.db) def.env.MYSQL_DATABASE = c.db;
    }
  }
  return def;
}

/** The single README line that starts this service without Docker Compose. */
export function dockerRunLine(def) {
  const envs = Object.entries(def.env || {}).map(([k, v]) => `-e ${k}=${v}`).join(' ');
  return `docker run -d --name ${def.name} -p ${def.port}:${def.port}${envs ? ' ' + envs : ''} ${def.image}`;
}
