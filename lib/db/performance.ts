import { query, queryOne } from './client';

export enum DeviceType {
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
}

export interface PerformanceMetric {
  id: string;
  sessionId?: string;
  pageViewId?: string;
  url: string;
  timestamp: Date;

  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint (ms)
  fid?: number; // First Input Delay (ms)
  cls?: number; // Cumulative Layout Shift (score)
  fcp?: number; // First Contentful Paint (ms)
  ttfb?: number; // Time to First Byte (ms)

  // Navigation Timing API
  dnsLookupTime?: number;
  tcpConnectionTime?: number;
  requestTime?: number;
  responseTime?: number;
  domLoadTime?: number;
  windowLoadTime?: number;

  // Device & Connection Info
  deviceType?: DeviceType;
  connectionType?: string;
  userAgent?: string;
}

export interface PerformanceOverview {
  avgLcp: number;
  avgFcp: number;
  avgTtfb: number;
  avgCls: number;
  avgFid: number;
  totalSamples: number;
}

export interface PerformanceByPage {
  url: string;
  avgLcp: number;
  avgFcp: number;
  avgTtfb: number;
  avgCls: number;
  sampleCount: number;
}

export interface PerformancePercentiles {
  metric: string;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
}

export interface PerformanceTrend {
  date: string;
  avgLcp: number;
  avgFcp: number;
  avgTtfb: number;
}

export interface PerformanceInsights {
  slowestPages: { url: string; avgLcp: number; avgTtfb: number }[];
  failingPages: { url: string; lcp: number; cls: number }[];
  trends: { url: string; improvement: number }[];
}

export interface PerformanceDeviceBreakdown {
  deviceType: DeviceType;
  avgLcp: number;
  sampleCount: number;
}

export interface PerformanceComparison {
  beforePeriod: {
    avgLcp: number;
    avgFcp: number;
    avgTtfb: number;
    avgCls: number;
    avgFid: number;
    sampleCount: number;
  };
  afterPeriod: {
    avgLcp: number;
    avgFcp: number;
    avgTtfb: number;
    avgCls: number;
    avgFid: number;
    sampleCount: number;
  };
  deltas: {
    lcp: { value: number; improved: boolean };
    fcp: { value: number; improved: boolean };
    ttfb: { value: number; improved: boolean };
    cls: { value: number; improved: boolean };
    fid: { value: number; improved: boolean };
  };
}

export interface GetPerformanceOptions {
  urlFilter?: string;
  dateFrom?: Date;
  dateTo?: Date;
  deviceType?: DeviceType;
  limit?: number;
}

export async function getPerformanceOverview(
  options: GetPerformanceOptions = {}
): Promise<PerformanceOverview> {
  const { dateFrom, dateTo, urlFilter } = options;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (dateFrom) {
    whereClause += ` AND timestamp >= $${paramIndex}`;
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    whereClause += ` AND timestamp <= $${paramIndex}`;
    params.push(dateTo);
    paramIndex++;
  }

  if (urlFilter) {
    whereClause += ` AND url ILIKE $${paramIndex}`;
    params.push(`%${urlFilter}%`);
    paramIndex++;
  }

  const result = await queryOne<{
    avgLcp: string;
    avgFcp: string;
    avgTtfb: string;
    avgCls: string;
    avgFid: string;
    totalSamples: string;
  }>(
    `SELECT
      AVG(lcp) as "avgLcp",
      AVG(fcp) as "avgFcp",
      AVG(ttfb) as "avgTtfb",
      AVG(cls) as "avgCls",
      AVG(fid) as "avgFid",
      COUNT(*) as "totalSamples"
     FROM "PerformanceMetric"
     ${whereClause}`,
    params
  );

  return {
    avgLcp: parseFloat(result?.avgLcp || '0'),
    avgFcp: parseFloat(result?.avgFcp || '0'),
    avgTtfb: parseFloat(result?.avgTtfb || '0'),
    avgCls: parseFloat(result?.avgCls || '0'),
    avgFid: parseFloat(result?.avgFid || '0'),
    totalSamples: parseInt(result?.totalSamples || '0', 10),
  };
}

export async function getPerformanceByPage(
  options: GetPerformanceOptions = {}
): Promise<PerformanceByPage[]> {
  const { dateFrom, dateTo, urlFilter, limit = 50 } = options;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (dateFrom) {
    whereClause += ` AND timestamp >= $${paramIndex}`;
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    whereClause += ` AND timestamp <= $${paramIndex}`;
    params.push(dateTo);
    paramIndex++;
  }

  if (urlFilter) {
    whereClause += ` AND url ILIKE $${paramIndex}`;
    params.push(`%${urlFilter}%`);
    paramIndex++;
  }

  params.push(limit);
  const limitParam = paramIndex;

  const results = await query<{
    url: string;
    avgLcp: string;
    avgFcp: string;
    avgTtfb: string;
    avgCls: string;
    sampleCount: string;
  }>(
    `SELECT
      url,
      AVG(lcp) as "avgLcp",
      AVG(fcp) as "avgFcp",
      AVG(ttfb) as "avgTtfb",
      AVG(cls) as "avgCls",
      COUNT(*) as "sampleCount"
     FROM "PerformanceMetric"
     ${whereClause}
     GROUP BY url
     ORDER BY "avgLcp" DESC
     LIMIT $${limitParam}`,
    params
  );

  return results.map((r) => ({
    url: r.url,
    avgLcp: parseFloat(r.avgLcp || '0'),
    avgFcp: parseFloat(r.avgFcp || '0'),
    avgTtfb: parseFloat(r.avgTtfb || '0'),
    avgCls: parseFloat(r.avgCls || '0'),
    sampleCount: parseInt(r.sampleCount || '0', 10),
  }));
}

export async function getPerformancePercentiles(
  metric: 'lcp' | 'fcp' | 'ttfb' | 'cls' | 'fid',
  options: GetPerformanceOptions = {}
): Promise<PerformancePercentiles> {
  const { dateFrom, dateTo, urlFilter } = options;

  let whereClause = `WHERE ${metric} IS NOT NULL`;
  const params: any[] = [];
  let paramIndex = 1;

  if (dateFrom) {
    whereClause += ` AND timestamp >= $${paramIndex}`;
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    whereClause += ` AND timestamp <= $${paramIndex}`;
    params.push(dateTo);
    paramIndex++;
  }

  if (urlFilter) {
    whereClause += ` AND url ILIKE $${paramIndex}`;
    params.push(`%${urlFilter}%`);
    paramIndex++;
  }

  const result = await queryOne<{
    p50: string;
    p75: string;
    p95: string;
    p99: string;
  }>(
    `SELECT
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${metric}) as p50,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${metric}) as p75,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${metric}) as p95,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${metric}) as p99
     FROM "PerformanceMetric"
     ${whereClause}`,
    params
  );

  return {
    metric,
    p50: parseFloat(result?.p50 || '0'),
    p75: parseFloat(result?.p75 || '0'),
    p95: parseFloat(result?.p95 || '0'),
    p99: parseFloat(result?.p99 || '0'),
  };
}

export async function getPerformanceTrends(
  period: 'daily' | 'weekly' | 'monthly',
  options: GetPerformanceOptions = {}
): Promise<PerformanceTrend[]> {
  const { dateFrom, dateTo, urlFilter, limit = 30 } = options;

  let dateFormat: string;
  switch (period) {
    case 'daily':
      dateFormat = 'YYYY-MM-DD';
      break;
    case 'weekly':
      dateFormat = 'IYYY-IW';
      break;
    case 'monthly':
      dateFormat = 'YYYY-MM';
      break;
  }

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (dateFrom) {
    whereClause += ` AND timestamp >= $${paramIndex}`;
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    whereClause += ` AND timestamp <= $${paramIndex}`;
    params.push(dateTo);
    paramIndex++;
  }

  if (urlFilter) {
    whereClause += ` AND url ILIKE $${paramIndex}`;
    params.push(`%${urlFilter}%`);
    paramIndex++;
  }

  params.push(limit);
  const limitParam = paramIndex;

  const results = await query<{
    date: string;
    avgLcp: string;
    avgFcp: string;
    avgTtfb: string;
  }>(
    `SELECT
      TO_CHAR(timestamp, '${dateFormat}') as date,
      AVG(lcp) as "avgLcp",
      AVG(fcp) as "avgFcp",
      AVG(ttfb) as "avgTtfb"
     FROM "PerformanceMetric"
     ${whereClause}
     GROUP BY date
     ORDER BY date DESC
     LIMIT $${limitParam}`,
    params
  );

  return results.map((r) => ({
    date: r.date,
    avgLcp: parseFloat(r.avgLcp || '0'),
    avgFcp: parseFloat(r.avgFcp || '0'),
    avgTtfb: parseFloat(r.avgTtfb || '0'),
  }));
}

export async function getPerformanceInsights(
  options: GetPerformanceOptions = {}
): Promise<PerformanceInsights> {
  const { dateFrom, dateTo } = options;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (dateFrom) {
    whereClause += ` AND timestamp >= $${paramIndex}`;
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    whereClause += ` AND timestamp <= $${paramIndex}`;
    params.push(dateTo);
    paramIndex++;
  }

  // Get slowest pages
  const slowestPages = await query<{ url: string; avgLcp: string; avgTtfb: string }>(
    `SELECT
      url,
      AVG(lcp) as "avgLcp",
      AVG(ttfb) as "avgTtfb"
     FROM "PerformanceMetric"
     ${whereClause}
     GROUP BY url
     HAVING AVG(lcp) > 2500
     ORDER BY "avgLcp" DESC
     LIMIT 5`,
    params
  );

  // Get pages failing Core Web Vitals thresholds
  const failingPages = await query<{ url: string; lcp: string; cls: string }>(
    `SELECT
      url,
      AVG(lcp) as lcp,
      AVG(cls) as cls
     FROM "PerformanceMetric"
     ${whereClause}
     GROUP BY url
     HAVING AVG(lcp) > 4000 OR AVG(cls) > 0.25
     LIMIT 10`,
    params
  );

  // Calculate trends (improvement/regression)
  // For now, return empty array - this would require more complex time-windowed queries
  const trends: { url: string; improvement: number }[] = [];

  return {
    slowestPages: slowestPages.map((p) => ({
      url: p.url,
      avgLcp: parseFloat(p.avgLcp || '0'),
      avgTtfb: parseFloat(p.avgTtfb || '0'),
    })),
    failingPages: failingPages.map((p) => ({
      url: p.url,
      lcp: parseFloat(p.lcp || '0'),
      cls: parseFloat(p.cls || '0'),
    })),
    trends,
  };
}

export async function getPerformanceDeviceBreakdown(
  options: GetPerformanceOptions = {}
): Promise<PerformanceDeviceBreakdown[]> {
  const { dateFrom, dateTo, urlFilter } = options;

  let whereClause = 'WHERE "deviceType" IS NOT NULL';
  const params: any[] = [];
  let paramIndex = 1;

  if (dateFrom) {
    whereClause += ` AND timestamp >= $${paramIndex}`;
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    whereClause += ` AND timestamp <= $${paramIndex}`;
    params.push(dateTo);
    paramIndex++;
  }

  if (urlFilter) {
    whereClause += ` AND url ILIKE $${paramIndex}`;
    params.push(`%${urlFilter}%`);
    paramIndex++;
  }

  const results = await query<{ deviceType: string; avgLcp: string; sampleCount: string }>(
    `SELECT
      "deviceType",
      AVG(lcp) as "avgLcp",
      COUNT(*) as "sampleCount"
     FROM "PerformanceMetric"
     ${whereClause}
     GROUP BY "deviceType"
     ORDER BY "sampleCount" DESC`,
    params
  );

  return results.map((r) => ({
    deviceType: r.deviceType as DeviceType,
    avgLcp: parseFloat(r.avgLcp || '0'),
    sampleCount: parseInt(r.sampleCount || '0', 10),
  }));
}

export async function getPerformanceComparison(
  beforeDateFrom: Date,
  beforeDateTo: Date,
  afterDateFrom: Date,
  afterDateTo: Date,
  options: { urlFilter?: string } = {}
): Promise<PerformanceComparison> {
  const { urlFilter } = options;

  // Build WHERE clause for URL filter (applies to both periods)
  let urlWhereClause = '';
  const urlParams: any[] = [];
  if (urlFilter) {
    urlWhereClause = 'AND url ILIKE $1';
    urlParams.push(`%${urlFilter}%`);
  }

  // Query for "before" period
  const beforeResult = await queryOne<{
    avgLcp: string;
    avgFcp: string;
    avgTtfb: string;
    avgCls: string;
    avgFid: string;
    sampleCount: string;
  }>(
    `SELECT
      AVG(lcp) as "avgLcp",
      AVG(fcp) as "avgFcp",
      AVG(ttfb) as "avgTtfb",
      AVG(cls) as "avgCls",
      AVG(fid) as "avgFid",
      COUNT(*) as "sampleCount"
     FROM "PerformanceMetric"
     WHERE timestamp >= $${urlParams.length + 1}
       AND timestamp <= $${urlParams.length + 2}
       ${urlWhereClause}`,
    [...urlParams, beforeDateFrom, beforeDateTo]
  );

  // Query for "after" period
  const afterResult = await queryOne<{
    avgLcp: string;
    avgFcp: string;
    avgTtfb: string;
    avgCls: string;
    avgFid: string;
    sampleCount: string;
  }>(
    `SELECT
      AVG(lcp) as "avgLcp",
      AVG(fcp) as "avgFcp",
      AVG(ttfb) as "avgTtfb",
      AVG(cls) as "avgCls",
      AVG(fid) as "avgFid",
      COUNT(*) as "sampleCount"
     FROM "PerformanceMetric"
     WHERE timestamp >= $${urlParams.length + 1}
       AND timestamp <= $${urlParams.length + 2}
       ${urlWhereClause}`,
    [...urlParams, afterDateFrom, afterDateTo]
  );

  // Parse before period metrics
  const beforePeriod = {
    avgLcp: parseFloat(beforeResult?.avgLcp || '0'),
    avgFcp: parseFloat(beforeResult?.avgFcp || '0'),
    avgTtfb: parseFloat(beforeResult?.avgTtfb || '0'),
    avgCls: parseFloat(beforeResult?.avgCls || '0'),
    avgFid: parseFloat(beforeResult?.avgFid || '0'),
    sampleCount: parseInt(beforeResult?.sampleCount || '0', 10),
  };

  // Parse after period metrics
  const afterPeriod = {
    avgLcp: parseFloat(afterResult?.avgLcp || '0'),
    avgFcp: parseFloat(afterResult?.avgFcp || '0'),
    avgTtfb: parseFloat(afterResult?.avgTtfb || '0'),
    avgCls: parseFloat(afterResult?.avgCls || '0'),
    avgFid: parseFloat(afterResult?.avgFid || '0'),
    sampleCount: parseInt(afterResult?.sampleCount || '0', 10),
  };

  // Calculate deltas (negative = improvement for LCP, FCP, TTFB, FID; lower is better)
  // For CLS, lower is also better
  const deltas = {
    lcp: {
      value: afterPeriod.avgLcp - beforePeriod.avgLcp,
      improved: afterPeriod.avgLcp < beforePeriod.avgLcp,
    },
    fcp: {
      value: afterPeriod.avgFcp - beforePeriod.avgFcp,
      improved: afterPeriod.avgFcp < beforePeriod.avgFcp,
    },
    ttfb: {
      value: afterPeriod.avgTtfb - beforePeriod.avgTtfb,
      improved: afterPeriod.avgTtfb < beforePeriod.avgTtfb,
    },
    cls: {
      value: afterPeriod.avgCls - beforePeriod.avgCls,
      improved: afterPeriod.avgCls < beforePeriod.avgCls,
    },
    fid: {
      value: afterPeriod.avgFid - beforePeriod.avgFid,
      improved: afterPeriod.avgFid < beforePeriod.avgFid,
    },
  };

  return {
    beforePeriod,
    afterPeriod,
    deltas,
  };
}
