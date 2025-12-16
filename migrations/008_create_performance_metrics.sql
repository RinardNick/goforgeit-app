-- Migration: Create PerformanceMetric table
-- Purpose: Store page load performance metrics (Core Web Vitals + Navigation Timing)
-- Date: January 8, 2025

-- Create enum for device type
CREATE TYPE device_type AS ENUM ('mobile', 'tablet', 'desktop');

-- Create PerformanceMetric table
CREATE TABLE IF NOT EXISTS "PerformanceMetric" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" TEXT,
  "pageViewId" TEXT,
  url TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Core Web Vitals
  lcp NUMERIC, -- Largest Contentful Paint (ms)
  fid NUMERIC, -- First Input Delay (ms)
  cls NUMERIC, -- Cumulative Layout Shift (score)
  fcp NUMERIC, -- First Contentful Paint (ms)
  ttfb NUMERIC, -- Time to First Byte (ms)

  -- Navigation Timing API
  "dnsLookupTime" NUMERIC, -- DNS resolution time (ms)
  "tcpConnectionTime" NUMERIC, -- TCP connection time (ms)
  "requestTime" NUMERIC, -- Request time (ms)
  "responseTime" NUMERIC, -- Response time (ms)
  "domLoadTime" NUMERIC, -- DOM content loaded time (ms)
  "windowLoadTime" NUMERIC, -- Full window load time (ms)

  -- Device & Connection Info
  "deviceType" device_type,
  "connectionType" TEXT, -- '4g', 'wifi', etc.
  "userAgent" TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_performance_metric_url ON "PerformanceMetric"(url);
CREATE INDEX IF NOT EXISTS idx_performance_metric_timestamp ON "PerformanceMetric"(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metric_session ON "PerformanceMetric"("sessionId");
CREATE INDEX IF NOT EXISTS idx_performance_metric_device ON "PerformanceMetric"("deviceType");
CREATE INDEX IF NOT EXISTS idx_performance_metric_url_timestamp ON "PerformanceMetric"(url, timestamp DESC);

-- Create index for Core Web Vitals filtering
CREATE INDEX IF NOT EXISTS idx_performance_metric_lcp ON "PerformanceMetric"(lcp) WHERE lcp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_performance_metric_fcp ON "PerformanceMetric"(fcp) WHERE fcp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_performance_metric_ttfb ON "PerformanceMetric"(ttfb) WHERE ttfb IS NOT NULL;
