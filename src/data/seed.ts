// ============================================================
// Ackboard simulated fleet data
// Generates realistic DevOps data that looks indistinguishable
// from real production telemetry
// ============================================================

import type {
  Service, LogEntry, LogSeverity, Deployment, Incident,
  Runbook, MetricDataPoint, ServiceStatus,
} from '../types';

// --- Constants ---

const SERVICES_META = [
  { name: 'api-gateway', displayName: 'API Gateway', language: 'Go', team: 'platform' },
  { name: 'auth-service', displayName: 'Auth Service', language: 'TypeScript', team: 'identity' },
  { name: 'payment-gateway', displayName: 'Payment Gateway', language: 'Java', team: 'payments' },
  { name: 'order-service', displayName: 'Order Service', language: 'Python', team: 'commerce' },
  { name: 'notification-worker', displayName: 'Notification Worker', language: 'TypeScript', team: 'engagement' },
  { name: 'user-service', displayName: 'User Service', language: 'Go', team: 'identity' },
  { name: 'inventory-service', displayName: 'Inventory Service', language: 'Python', team: 'commerce' },
  { name: 'analytics-service', displayName: 'Analytics Service', language: 'Python', team: 'data' },
] as const;

// Realistic error messages per service — NOT "Error occurred"
const ERROR_MESSAGES: Record<string, string[]> = {
  'api-gateway': [
    'upstream connect error or disconnect/reset before headers. retried and the latest reset reason: remote connection failure, transport failure reason: delayed connect error: 111',
    'gRPC deadline exceeded on /orders.v1.OrderService/GetOrder after 5000ms — retried 3/3',
    'rate limit exceeded: 847/500 req/s from client_id=svc_checkout_prod — circuit breaker OPEN',
    'TLS handshake timeout to inventory-service.internal:443 — connection pool exhausted (max: 256)',
    'request entity too large: payload 5.2MB exceeds limit of 1MB on POST /api/v2/bulk-import',
  ],
  'auth-service': [
    'JWT token expired for user_id=usr_8f2k3j9x — refresh token also expired (max_age: 7d exceeded)',
    'OAuth2 callback failed: state parameter mismatch — potential CSRF attack from IP 198.51.100.47',
    'LDAP connection timeout after 5000ms — AD server ldap.corp.internal unreachable (attempt 3/3)',
    'rate limit exceeded: 150/100 req/min from IP 203.0.113.42 — temporary ban applied (30s)',
    'SAML assertion expired: NotOnOrAfter="2026-08-28T10:23:00Z" — clock skew >300s detected',
  ],
  'payment-gateway': [
    'Stripe webhook signature verification failed: timestamp delta 842s exceeds tolerance (300s) — clock skew detected on host ip-10-0-47-128',
    'idempotency key collision on charge ch_3PqR4s5T6uV7w8X9 — duplicate charge prevented, returning cached response',
    'PCI DSS compliance check failed: TLS 1.2 required but client negotiated TLS 1.1 from 198.51.100.23',
    'settlement batch #2847 failed: 3 of 847 transactions had invalid routing numbers — batch held for manual review',
    'Stripe API rate limit: 429 Too Many Requests — retry-after: 2s (current: 98/100 req/s)',
  ],
  'order-service': [
    'inventory reservation timeout for sku_9Xk2mN — inventory-service did not respond within 3000ms',
    'order ord_7Yp3qR failed validation: shipping_address.postal_code "ABCDE" does not match pattern ^[0-9]{5}(-[0-9]{4})?$',
    'DynamoDB ConditionCheckFailedException: order ord_2Mn4pQ version conflict (expected: 3, actual: 4) — concurrent modification',
    'dead letter queue threshold exceeded: 47 failed order events in last 5m (threshold: 10) — alerting on-call',
    'circuit breaker OPEN for payment-gateway: 12/20 requests failed in last 60s — fallback to queued processing',
  ],
  'notification-worker': [
    'SQS message processing timeout: msg_id=a7b3c9d1 exceeded visibility timeout (30s) — message will be redelivered',
    'SendGrid API 503: Service Unavailable — email to usr_4Kp2mN queued for retry (attempt 2/5, backoff: 4s)',
    'Firebase Cloud Messaging: InvalidRegistration for device token dGtv...x7Yz — token expired, marked for cleanup',
    'template rendering failed: variable {{order.shipping_date}} is null for order ord_8Xm3nP — notification suppressed',
    'rate limit exceeded: 50/50 emails/sec — throttling email queue, estimated drain time: 4m 23s',
  ],
  'user-service': [
    'PostgreSQL connection pool exhausted: 50/50 connections in use — 12 requests queued (max_wait: 5s)',
    'bcrypt hash comparison timeout: CPU-bound operation exceeded 2000ms for user_id=usr_3Mn7pQ — possible DoS',
    'profile image upload failed: S3 PutObject timeout after 10s — bucket us-east-1/user-avatars-prod unreachable',
    'GDPR deletion request for user_id=usr_9Xk2mN: 3/7 downstream services acknowledged — retrying analytics-service, notification-worker',
    'duplicate email registration attempt: existing user_id=usr_1Yp4qR holds email john.doe@example.com — returning 409',
  ],
  'inventory-service': [
    'Redis MOVED error: key inv:sku_7Xm3nP redirected to node 10.0.23.45:6379 — cluster resharding in progress',
    'stock count inconsistency: sku_2Mn4pQ DB=847 vs cache=852 — triggering reconciliation job',
    'warehouse API timeout: fulfillment-center-west did not respond within 3000ms — 23 SKUs in pending state',
    'Elasticsearch bulk index failed: 12/500 documents rejected — mapping conflict on field "dimensions.weight" (expected: float, got: string)',
    'low stock alert: sku_4Kp2mN quantity=3, reorder_point=10 — auto-purchase order PO-2847 created',
  ],
  'analytics-service': [
    'ClickHouse query timeout: SELECT with GROUP BY exceeded 30s on table events_raw (2.4B rows scanned)',
    'Kafka consumer lag: topic=user-events partition=7 lag=184,723 messages — consumer group analytics-prod behind by ~12m',
    'Apache Spark job spark-847-analytics-daily OOMKilled: executor requested 8GB, limit 4GB — increasing memory allocation',
    'data pipeline stage "transform_events" failed: null pointer on event.properties.utm_source for event_id=evt_3Mn7pQ',
    'BigQuery streaming insert quota exceeded: 100,000 rows/s limit reached — buffering 47,000 rows locally',
  ],
};

const INFO_MESSAGES: Record<string, string[]> = {
  'api-gateway': [
    'health check passed: all 8 upstream services responding (p99: 23ms)',
    'request routing: /api/v2/orders → order-service (weight: 100%, canary: 0%)',
    'connection pool stats: active=127/256, idle=89, wait_queue=0',
    'rate limit config reloaded: client_id=svc_checkout_prod updated to 1000 req/s',
  ],
  'auth-service': [
    'JWT key rotation completed: kid=key_2026_08 active, kid=key_2026_07 retained for validation',
    'session cleanup: expired 2,847 sessions older than 7d, 14,293 active sessions remain',
    'OAuth2 client registered: client_id=mobile_app_v3 with scopes [profile, orders:read]',
  ],
  'payment-gateway': [
    'daily settlement batch #2846 completed: 12,847 transactions, total $847,293.42, 0 failures',
    'PCI compliance scan passed: all 12 controls verified, next scan: 2026-09-01',
    'Stripe webhook endpoint verified: webhook_id=we_1PqR3sT, events: [charge.succeeded, charge.failed]',
  ],
  'order-service': [
    'order processing queue depth: 47 pending, avg processing time: 234ms, DLQ: 0',
    'price calculation cache refreshed: 8,472 SKUs updated, cache hit rate: 94.7%',
  ],
  'notification-worker': [
    'email delivery stats (last 1h): sent=2,847, bounced=12 (0.4%), complaints=0',
    'push notification batch completed: 4,293 devices, 4,281 delivered (99.7%)',
  ],
  'user-service': [
    'daily active users: 14,293 (7d avg: 12,847), new registrations: 127',
    'profile cache hit rate: 97.2% (Redis), miss-fill avg latency: 12ms (PostgreSQL)',
  ],
  'inventory-service': [
    'nightly inventory reconciliation completed: 8,472 SKUs verified, 3 discrepancies auto-resolved',
    'warehouse sync: 4 fulfillment centers synced, total SKUs: 47,293, last sync: 2m ago',
  ],
  'analytics-service': [
    'daily ETL pipeline completed: 47.2M events processed in 23m 47s, 0 failures',
    'real-time dashboard cache refreshed: 12 dashboards, avg query time: 340ms',
  ],
};

const WARN_MESSAGES: Record<string, string[]> = {
  'api-gateway': [
    'response time degradation: p99 increased from 45ms to 127ms for /api/v2/search in last 5m',
    'connection pool utilization high: 231/256 (90%) — consider increasing pool size',
  ],
  'auth-service': [
    'brute force detection: 47 failed login attempts from IP 198.51.100.23 in last 5m — monitoring',
    'certificate expiry warning: TLS cert for auth.internal expires in 14 days',
  ],
  'payment-gateway': [
    'Stripe API latency elevated: p99=847ms (baseline: 200ms) — monitoring for degradation',
    'refund processing delayed: 12 pending refunds older than 24h — manual review required',
  ],
  'order-service': [
    'order backlog growing: 127 pending orders (threshold: 50) — processing rate: 12/min',
    'discount calculation fallback: promo-service unreachable, using cached rules (age: 2h)',
  ],
  'notification-worker': [
    'email bounce rate elevated: 2.1% (threshold: 1%) — reviewing sender reputation',
    'push notification queue depth: 4,293 pending (threshold: 1,000) — FCM API throttling',
  ],
  'user-service': [
    'PostgreSQL replication lag: 4.2s (threshold: 2s) — read replica falling behind',
    'memory usage high: 3.7GB/4GB (92%) — GC frequency increased to 4/min',
  ],
  'inventory-service': [
    'Redis cluster node 10.0.23.45 memory usage: 87% — approaching eviction threshold',
    'stock reservation timeout rate: 4.2% (threshold: 1%) — inventory-service may be overloaded',
  ],
  'analytics-service': [
    'Kafka consumer rebalance triggered: 3 consumers joined group analytics-prod — temporary processing pause',
    'ClickHouse merge operations queued: 47 parts pending merge on table events_raw',
  ],
};

const DEPLOYER_NAMES = [
  'sarah.chen', 'alex.kumar', 'priya.sharma', 'marcus.johnson',
  'emily.zhang', 'david.okafor', 'lisa.fernandez', 'james.wilson',
];

const CHANGELOG_ENTRIES = [
  'fix: resolve race condition in connection pool recycling',
  'feat: add request deduplication via idempotency keys',
  'fix: correct timezone handling in settlement batch processor',
  'perf: optimize SQL query for user profile lookups (index added)',
  'chore: bump stripe-sdk from 12.3.0 to 12.4.1 (security patch)',
  'feat: implement circuit breaker for downstream service calls',
  'fix: handle null pointer in event transform pipeline',
  'refactor: migrate NTP sync to chrony, update configuration',
  'feat: add dead letter queue monitoring with auto-alerting',
  'fix: resolve S3 upload timeout with increased connection pool',
  'perf: add Redis cache for hot-path inventory lookups',
  'feat: implement GDPR cascade deletion across services',
  'fix: correct webhook signature validation with clock skew tolerance',
  'chore: rotate TLS certificates for internal service mesh',
  'feat: add canary deployment support with traffic splitting',
];

// --- Generator Functions ---

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 1): number {
  const val = Math.random() * (max - min) + min;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function generateId(prefix: string): string {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${id}`;
}

function generateTraceId(): string {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function generateSpanId(): string {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function generateCommitHash(): string {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 7; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// --- Service Generator ---

export function generateServices(): Service[] {
  return SERVICES_META.map(meta => {
    // payment-gateway is deliberately degraded for the demo scenario
    const isDegraded = meta.name === 'payment-gateway';
    const isDown = meta.name === 'notification-worker';

    const status: ServiceStatus = isDown ? 'down' : isDegraded ? 'degraded' : 'healthy';
    const errorRate = isDown ? 12.4 : isDegraded ? 4.2 : randomFloat(0.01, 0.3);
    const uptime = isDown ? 97.2 : isDegraded ? 99.1 : randomFloat(99.8, 99.99, 2);

    return {
      name: meta.name,
      displayName: meta.displayName,
      language: meta.language,
      team: meta.team,
      status,
      uptime,
      errorRate,
      requestRate: randomFloat(50, 500),
      p99Latency: isDegraded ? randomFloat(800, 1200) : isDown ? 0 : randomFloat(15, 120),
      lastChecked: new Date(Date.now() - randomInt(5_000, 30_000)).toISOString(),
    };
  });
}

// --- Log Generator ---

export function generateLogs(count: number): LogEntry[] {
  const now = Date.now();
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;
  const logs: LogEntry[] = [];

  // Generate a shared trace context for correlated errors
  const incidentTraceId = generateTraceId();

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(twoHoursAgo + Math.random() * (now - twoHoursAgo)).toISOString();
    const service = randomItem(SERVICES_META).name;

    // Weight severity: more info/debug, fewer errors
    let severity: LogSeverity;
    const roll = Math.random();
    if (roll < 0.30) severity = 'debug';
    else if (roll < 0.65) severity = 'info';
    else if (roll < 0.80) severity = 'warn';
    else if (roll < 0.95) severity = 'error';
    else severity = 'fatal';

    // For payment-gateway and notification-worker, bias towards more errors in recent 90 min
    const isRecentIncidentService = (service === 'payment-gateway' || service === 'notification-worker');
    const isRecent = new Date(timestamp).getTime() > now - 90 * 60 * 1000;

    if (isRecentIncidentService && isRecent && Math.random() < 0.4) {
      severity = 'error';
    }

    let message: string;
    const serviceMessages = {
      debug: INFO_MESSAGES[service] ?? [],
      info: INFO_MESSAGES[service] ?? [],
      warn: WARN_MESSAGES[service] ?? [],
      error: ERROR_MESSAGES[service] ?? [],
      fatal: ERROR_MESSAGES[service] ?? [],
    };
    const pool = serviceMessages[severity];
    message = pool.length > 0 ? randomItem(pool) : `${severity} level event in ${service}`;

    // Use correlated trace IDs for the incident scenario
    const traceId = (isRecentIncidentService && severity === 'error' && Math.random() < 0.3)
      ? incidentTraceId
      : generateTraceId();

    logs.push({
      id: generateId('log'),
      timestamp,
      service,
      severity,
      message,
      traceId,
      spanId: generateSpanId(),
    });
  }

  // Sort by timestamp descending (newest first)
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// --- Metrics Generator ---

export function generateMetricSeries(
  service: string,
  metric: string,
  durationMinutes = 120,
): MetricDataPoint[] {
  const now = Date.now();
  const points: MetricDataPoint[] = [];

  // Baseline values per metric
  const baselines: Record<string, { base: number; variance: number; unit: string }> = {
    cpu: { base: 35, variance: 10, unit: '%' },
    memory: { base: 62, variance: 5, unit: '%' },
    request_rate: { base: 200, variance: 50, unit: 'req/s' },
    error_rate: { base: 0.1, variance: 0.05, unit: '%' },
    p99_latency: { base: 45, variance: 15, unit: 'ms' },
  };

  const config = baselines[metric] ?? { base: 50, variance: 10, unit: '' };
  const isDegradedService = service === 'payment-gateway';

  for (let i = durationMinutes; i >= 0; i--) {
    const timestamp = new Date(now - i * 60 * 1000).toISOString();
    let value = config.base + (Math.random() - 0.5) * config.variance * 2;

    // Inject anomaly for payment-gateway in the last 90 minutes
    if (isDegradedService && i < 90) {
      if (metric === 'error_rate') value = 3.5 + Math.random() * 2; // Spike from 0.1% to 3.5-5.5%
      if (metric === 'p99_latency') value = 600 + Math.random() * 400; // Spike from 45ms to 600-1000ms
      if (metric === 'cpu') value = 65 + Math.random() * 15; // Elevated CPU
    }

    // Clamp values
    value = Math.max(0, value);
    if (metric === 'cpu' || metric === 'memory' || metric === 'error_rate') {
      value = Math.min(100, value);
    }

    points.push({ timestamp, value: Math.round(value * 100) / 100 });
  }

  return points;
}

// --- Deployment Generator ---

export function generateDeployments(): Deployment[] {
  const now = Date.now();
  const deployments: Deployment[] = [];

  // Generate 20 deployments over the last 48 hours
  for (let i = 0; i < 20; i++) {
    const hoursAgo = randomInt(1, 48);
    const timestamp = new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();
    const service = randomItem(SERVICES_META).name;
    const major = randomInt(1, 5);
    const minor = randomInt(0, 15);
    const patch = randomInt(0, 20);
    const version = `v${major}.${minor}.${patch}`;
    const prevPatch = Math.max(0, patch - randomInt(1, 3));
    const previousVersion = `v${major}.${minor}.${prevPatch}`;

    deployments.push({
      id: generateId('deploy'),
      service,
      version,
      previousVersion,
      deployer: randomItem(DEPLOYER_NAMES),
      timestamp,
      status: Math.random() < 0.85 ? 'success' : Math.random() < 0.5 ? 'failed' : 'rolled-back',
      commitHash: generateCommitHash(),
      changelog: randomItem(CHANGELOG_ENTRIES),
      filesChanged: randomInt(2, 45),
      linesAdded: randomInt(10, 500),
      linesRemoved: randomInt(5, 200),
    });
  }

  // Add THE critical deployment: payment-gateway 5 days ago by sarah.chen (the "long fuse")
  deployments.push({
    id: 'deploy_incident_root',
    service: 'payment-gateway',
    version: 'v1.8.3',
    previousVersion: 'v1.8.2',
    deployer: 'sarah.chen',
    timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    status: 'success',
    commitHash: 'a7b3c9d',
    changelog: 'refactor: migrate NTP sync from ntpd to chrony, update configuration for improved accuracy',
    filesChanged: 4,
    linesAdded: 47,
    linesRemoved: 23,
  });

  // The TRIGGER deployment: routine infra config refresh 92 min ago (detonated the long fuse)
  deployments.push({
    id: 'deploy_config_refresh',
    service: 'api-gateway',
    version: 'v2.14.1',
    previousVersion: 'v2.14.0',
    deployer: 'k8s-operator',
    timestamp: new Date(now - 92 * 60 * 1000).toISOString(), // 92 min ago
    status: 'success',
    commitHash: 'f3e8b21',
    changelog: 'chore: routine infrastructure config refresh — NTP sources, TLS cert rotation, pod scheduling hints',
    filesChanged: 2,
    linesAdded: 12,
    linesRemoved: 8,
  });

  return deployments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// --- Incident Generator ---

export function generateIncidents(): Incident[] {
  const now = Date.now();

  return [
    // Active incident — this is what the agent will investigate
    {
      id: 'INC-001',
      title: 'Elevated error rate on payment-gateway — webhook signature failures',
      severity: 'P2-High',
      status: 'investigating',
      affectedServices: ['payment-gateway', 'order-service'],
      description: 'Stripe webhook signature verification failures spiking since ~90 minutes ago. Error rate increased from 0.1% to 4.2%. Root cause: a config change deployed 5 days ago (NTP sync migration from ntpd to chrony in v1.8.3) altered clock sync behavior. A routine config refresh 90 minutes ago triggered chrony to resync, introducing clock skew >300s with Stripe servers. Pattern matches Cloudflare 1.1.1.1 incident (Jul 2025) — long-fuse configuration error.',
      createdAt: new Date(now - 85 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 5 * 60 * 1000).toISOString(),
      timeline: [
        {
          timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
          author: 'sarah.chen',
          content: 'Deployed v1.8.3 to payment-gateway: "refactor: migrate NTP sync to chrony, update configuration" — 4 files changed, 47 additions, 23 deletions. All CI checks passed. No immediate impact observed.',
        },
        {
          timestamp: new Date(now - 92 * 60 * 1000).toISOString(),
          author: 'k8s-operator',
          content: 'Routine infrastructure config refresh triggered across all pods. chrony resynced NTP sources on payment-gateway nodes.',
        },
        {
          timestamp: new Date(now - 88 * 60 * 1000).toISOString(),
          author: 'prometheus',
          content: 'Anomaly detected: payment-gateway error_rate exceeded 2.0% threshold (current: 2.7%). Alert firing for 5 consecutive minutes.',
        },
        {
          timestamp: new Date(now - 85 * 60 * 1000).toISOString(),
          author: 'PagerDuty',
          content: 'Alert triggered: payment-gateway error rate > 2% for 5 consecutive minutes. On-call engineer marcus.johnson paged.',
        },
        {
          timestamp: new Date(now - 80 * 60 * 1000).toISOString(),
          author: 'marcus.johnson',
          content: 'Acknowledged. Investigating. Stripe webhook signature verification failures dominating error logs. Timestamp delta 842s exceeds tolerance (300s).',
        },
        {
          timestamp: new Date(now - 65 * 60 * 1000).toISOString(),
          author: 'marcus.johnson',
          content: 'Root cause hypothesis: clock skew on payment-gateway hosts. `timedatectl` shows NTP synchronized=yes but offset is -423.7s. Checking recent deployments for NTP-related changes.',
        },
        {
          timestamp: new Date(now - 50 * 60 * 1000).toISOString(),
          author: 'marcus.johnson',
          content: 'Found it. v1.8.3 deployed 5 days ago changed NTP from ntpd to chrony. Config worked initially but chrony\'s "long fuse" behavior caused progressive drift. Today\'s config refresh triggered a full resync that overcorrected. Classic long-fuse deployment issue.',
        },
        {
          timestamp: new Date(now - 30 * 60 * 1000).toISOString(),
          author: 'marcus.johnson',
          content: 'Cascade confirmed: order-service circuit breaker OPEN for payment-gateway (12/20 requests failed). notification-worker SQS queue backing up — dead letter queue threshold exceeded (47 failed events).',
        },
        {
          timestamp: new Date(now - 5 * 60 * 1000).toISOString(),
          author: 'marcus.johnson',
          content: 'Remediation plan: rollback payment-gateway to v1.8.2 (restores ntpd config), then verify clock sync stabilizes. Runbook rb-payment-rollback prepared. Awaiting approval to proceed.',
        },
      ],
    },
    // Resolved incident — shows the cascade effect
    {
      id: 'INC-002',
      title: 'notification-worker SQS processing delays — cascade from INC-001',
      severity: 'P3-Medium',
      status: 'monitoring',
      affectedServices: ['notification-worker', 'order-service'],
      description: 'SQS message processing timeouts causing delayed email/push delivery. Triggered by order-service circuit breaker opening against payment-gateway (INC-001), resulting in order events backing up in the dead letter queue.',
      createdAt: new Date(now - 45 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      timeline: [
        {
          timestamp: new Date(now - 45 * 60 * 1000).toISOString(),
          author: 'CloudWatch',
          content: 'Alert: SQS ApproximateAgeOfOldestMessage > 300s on queue notification-prod. Dead letter queue depth: 47 messages (threshold: 10).',
        },
        {
          timestamp: new Date(now - 40 * 60 * 1000).toISOString(),
          author: 'priya.sharma',
          content: 'Investigating. SQS messages failing because order events reference payment confirmations that never arrived. Root cause is upstream — linked to INC-001.',
        },
        {
          timestamp: new Date(now - 20 * 60 * 1000).toISOString(),
          author: 'priya.sharma',
          content: 'Increased visibility timeout from 30s to 120s to prevent duplicate processing. Will resolve when INC-001 is fixed and payment-gateway recovers.',
        },
        {
          timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
          author: 'priya.sharma',
          content: 'Queue depth stabilizing but not draining. Monitoring. Resolution depends on INC-001 rollback.',
        },
      ],
    },
  ];
}

// --- Runbook Generator ---

export function generateRunbooks(): Runbook[] {
  return [
    {
      id: 'rb-payment-rollback',
      name: 'Payment Gateway Rollback',
      description: 'Standard rollback procedure for payment-gateway when error rate exceeds threshold.',
      forService: 'payment-gateway',
      steps: [
        {
          description: 'Verify current deployment version and error rate',
          action: 'check_status',
          target: 'payment-gateway',
          status: 'completed',
          result: 'Current: v1.8.3, error rate: 4.2%',
        },
        {
          description: 'Check for in-flight transactions',
          action: 'drain_connections',
          target: 'payment-gateway',
          status: 'pending',
        },
        {
          description: 'Rollback to previous version (v1.8.2)',
          action: 'rollback_deployment',
          target: 'payment-gateway',
          status: 'pending',
        },
        {
          description: 'Verify error rate returns to baseline',
          action: 'verify_metrics',
          target: 'payment-gateway',
          status: 'pending',
        },
        {
          description: 'Update incident status and notify stakeholders',
          action: 'close_incident',
          target: 'INC-001',
          status: 'pending',
        },
      ],
    },
    {
      id: 'rb-general-restart',
      name: 'Service Restart Procedure',
      description: 'Standard procedure for restarting a misbehaving service with graceful drain.',
      forService: 'any',
      steps: [
        {
          description: 'Set service to drain mode (stop accepting new requests)',
          action: 'drain_mode',
          target: 'target_service',
          status: 'pending',
        },
        {
          description: 'Wait for in-flight requests to complete (max 30s)',
          action: 'wait_drain',
          target: 'target_service',
          status: 'pending',
        },
        {
          description: 'Restart service pods',
          action: 'restart_pods',
          target: 'target_service',
          status: 'pending',
        },
        {
          description: 'Verify health checks passing',
          action: 'verify_health',
          target: 'target_service',
          status: 'pending',
        },
      ],
    },
  ];
}

// --- Master Seed Function ---

export interface SeedData {
  services: Service[];
  logs: LogEntry[];
  deployments: Deployment[];
  incidents: Incident[];
  runbooks: Runbook[];
}

export function seedAll(): SeedData {
  console.time('[Ackboard] Data generation');
  const data: SeedData = {
    services: generateServices(),
    logs: generateLogs(2500),
    deployments: generateDeployments(),
    incidents: generateIncidents(),
    runbooks: generateRunbooks(),
  };
  console.timeEnd('[Ackboard] Data generation');
  console.info(`[Ackboard] Seeded: ${data.services.length} services, ${data.logs.length} logs, ${data.deployments.length} deployments, ${data.incidents.length} incidents, ${data.runbooks.length} runbooks`);
  return data;
}
