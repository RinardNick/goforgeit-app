'use client';

import { useState, useEffect, Fragment } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PRICING_TABLE } from '@/lib/pricing';

interface UsageRow {
  project_name: string;
  agent_name: string;
  model: string;
  request_count: number;
  total_cost: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
}

interface DailyUsageRaw {
  date: string;
  project_name: string;
  cost: number;
}

interface DailyUsageBucket {
  date: string;
  totalCost: number;
  projects: { [key: string]: number };
}

// Grouped Data Structure
interface GroupedData {
  [projectName: string]: {
    totalCost: number;
    requestCount: number;
    totalTokens: number;
    agents: {
      [agentName: string]: {
        totalCost: number;
        requestCount: number;
        totalTokens: number;
        models: UsageRow[];
      };
    };
  };
}

const PALETTE = [
  'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-orange-500',
  'bg-teal-500', 'bg-cyan-500'
];

export default function BillingSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupedData, setGroupedData] = useState<GroupedData>({});
  const [dailyBuckets, setDailyBuckets] = useState<DailyUsageBucket[]>([]);
  const [projectColors, setProjectColors] = useState<Record<string, string>>({});
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/billing/usage');
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Failed to fetch data');

        // Process flat rows into hierarchy
        const groups: GroupedData = {};
        (data.usageByAgent as UsageRow[]).forEach(row => {
          const pName = row.project_name;
          const aName = row.agent_name;

          if (!groups[pName]) {
            groups[pName] = { totalCost: 0, requestCount: 0, totalTokens: 0, agents: {} };
          }
          if (!groups[pName].agents[aName]) {
            groups[pName].agents[aName] = { totalCost: 0, requestCount: 0, totalTokens: 0, models: [] };
          }

          // Accumulate totals
          groups[pName].totalCost += Number(row.total_cost);
          groups[pName].requestCount += Number(row.request_count);
          groups[pName].totalTokens += Number(row.total_tokens);

          groups[pName].agents[aName].totalCost += Number(row.total_cost);
          groups[pName].agents[aName].requestCount += Number(row.request_count);
          groups[pName].agents[aName].totalTokens += Number(row.total_tokens);

          groups[pName].agents[aName].models.push(row);
        });

        setGroupedData(groups);

        // Process daily usage
        const buckets: Record<string, DailyUsageBucket> = {};
        const projectsFound = new Set<string>();

        (data.dailyUsage as DailyUsageRaw[]).forEach(row => {
          if (!buckets[row.date]) {
            buckets[row.date] = { date: row.date, totalCost: 0, projects: {} };
          }
          buckets[row.date].totalCost += Number(row.cost);
          buckets[row.date].projects[row.project_name] = Number(row.cost);
          projectsFound.add(row.project_name);
        });

        const sortedBuckets = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
        setDailyBuckets(sortedBuckets);

        // Assign colors
        const colors: Record<string, string> = {};
        Array.from(projectsFound).sort().forEach((p, i) => {
          colors[p] = PALETTE[i % PALETTE.length];
        });
        setProjectColors(colors);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load billing data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const toggleProject = (name: string) => {
    const next = new Set(expandedProjects);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedProjects(next);
  };

  const toggleAgent = (name: string) => {
    const next = new Set(expandedAgents);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedAgents(next);
  };

  const totalCost = Object.values(groupedData).reduce((sum, p) => sum + p.totalCost, 0);
  const maxDailyCost = Math.max(...dailyBuckets.map(d => d.totalCost), 0.0001); // Prevent div/0

  return (
    <div>
      <h2 className="text-2xl font-heading font-semibold text-foreground mb-2">Billing & Usage</h2>
      <p className="text-muted-foreground mb-8">Track your AI agent consumption and costs.</p>

      {error && <ErrorMessage message={error} className="mb-6" />}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stats & Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-heading font-semibold text-foreground mb-4">Total Cost (30 Days)</h3>
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-foreground">${totalCost.toFixed(4)}</span>
                <span className="ml-2 text-muted-foreground">USD</span>
              </div>

              {/* Project Legend */}
              <div className="mt-6 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projects</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(projectColors).map(([proj, color]) => (
                    <div key={proj} className="flex items-center gap-1.5 text-xs bg-muted/30 px-2 py-1 rounded-sm border border-border">
                      <div className={`w-2 h-2 rounded-full ${color}`} />
                      <span className="text-foreground font-medium">{proj}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-heading font-semibold text-foreground mb-6">Daily Trend (Stacked)</h3>
              <div className="h-64 flex items-end gap-1 relative">
                {dailyBuckets.length === 0 ? (
                  <div className="w-full text-center text-muted-foreground self-center">No data available</div>
                ) : (
                  dailyBuckets.map((bucket) => {
                    const totalHeight = (bucket.totalCost / maxDailyCost) * 100;
                    return (
                      <div key={bucket.date} className="flex-1 flex flex-col justify-end h-full group relative min-w-[4px]">
                        {/* Hover Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-popover text-popover-foreground text-xs p-2 rounded shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                          <div className="font-bold border-b border-border/50 pb-1 mb-1">{bucket.date}</div>
                          <div className="space-y-0.5">
                            {Object.entries(bucket.projects).map(([proj, cost]) => (
                              <div key={proj} className="flex justify-between gap-3">
                                <span className="flex items-center gap-1">
                                  <div className={`w-1.5 h-1.5 rounded-full ${projectColors[proj]}`} />
                                  {proj}
                                </span>
                                <span className="font-mono">${cost.toFixed(4)}</span>
                              </div>
                            ))}
                            <div className="pt-1 mt-1 border-t border-border/50 flex justify-between font-bold">
                              <span>Total</span>
                              <span>${bucket.totalCost.toFixed(4)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Stacked Bar */}
                        <div
                          className="w-full rounded-t overflow-hidden flex flex-col-reverse relative transition-all hover:brightness-110"
                          style={{ height: `${Math.max(totalHeight, 1)}%` }} // Ensure visible min-height
                        >
                          {Object.entries(bucket.projects).map(([proj, cost]) => {
                            const segmentHeight = (cost / bucket.totalCost) * 100;
                            return (
                              <div
                                key={proj}
                                style={{ height: `${segmentHeight}%` }}
                                className={`w-full ${projectColors[proj]}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {/* X-Axis Labels */}
              <div className="flex justify-between mt-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                <span>{dailyBuckets[0]?.date}</span>
                <span>{dailyBuckets[dailyBuckets.length - 1]?.date}</span>
              </div>
            </div>
          </div>

          {/* Hierarchy Table */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-heading font-semibold text-foreground">Cost Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/3">Name</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Requests</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Tokens (In / Out)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {Object.entries(groupedData).map(([pName, pData]) => {
                    const isPExpanded = expandedProjects.has(pName);
                    return (
                      <Fragment key={pName}>
                        {/* Project Row */}
                        <tr
                          onClick={() => toggleProject(pName)}
                          className="hover:bg-muted/30 cursor-pointer bg-muted/10 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground flex items-center gap-2">
                            <span className="text-muted-foreground w-4 shrink-0">{isPExpanded ? '▼' : '▶'}</span>
                            <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                            </svg>
                            {pName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">{pData.requestCount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">{pData.totalTokens.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground text-right">${pData.totalCost.toFixed(4)}</td>
                        </tr>

                        {/* Agents Rows */}
                        {isPExpanded && Object.entries(pData.agents).map(([aName, aData]) => {
                          const isAExpanded = expandedAgents.has(aName);
                          return (
                            <Fragment key={aName}>
                              <tr
                                onClick={() => toggleAgent(aName)}
                                className="hover:bg-muted/30 cursor-pointer transition-colors"
                              >
                                <td className="px-6 py-3 whitespace-nowrap text-sm text-foreground pl-12 flex items-center gap-2">
                                  <span className="text-muted-foreground w-4 shrink-0">{isAExpanded ? '▼' : '▶'}</span>
                                  <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                    <svg className="w-3 h-3 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                  </div>
                                  {aName}
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-sm text-muted-foreground text-right">{aData.requestCount}</td>
                                <td className="px-6 py-3 whitespace-nowrap text-sm text-muted-foreground text-right">{aData.totalTokens.toLocaleString()}</td>
                                <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-foreground text-right">${aData.totalCost.toFixed(4)}</td>
                              </tr>

                              {/* Models Rows */}
                              {isAExpanded && aData.models.map((modelRow, idx) => (
                                <tr key={`${aName}-${idx}`} className="bg-muted/5">
                                  <td className="px-6 py-2 whitespace-nowrap text-xs text-muted-foreground pl-24 flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded shrink-0">
                                      {modelRow.model}
                                    </span>
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-xs text-muted-foreground/70 text-right">{modelRow.request_count} req</td>
                                  <td className="px-6 py-2 whitespace-nowrap text-xs text-muted-foreground text-right">
                                    <span className="text-green-600" title="Input Tokens">{Number(modelRow.prompt_tokens || 0).toLocaleString()}</span>
                                    <span className="text-muted-foreground/40 mx-1">/</span>
                                    <span className="text-blue-500" title="Output Tokens">{Number(modelRow.completion_tokens || 0).toLocaleString()}</span>
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap text-xs text-muted-foreground text-right">${Number(modelRow.total_cost).toFixed(4)}</td>
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Information */}
          <div className="mt-8 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <button
              onClick={() => setShowPricing(!showPricing)}
              className="w-full px-6 py-4 flex items-center justify-between bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <h3 className="text-lg font-heading font-semibold text-foreground">Model Pricing Reference</h3>
              <svg className={`w-5 h-5 text-muted-foreground transform transition-transform ${showPricing ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showPricing && (
              <div className="p-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Provider</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Model</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Input (per 1M)</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Output (per 1M)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {PRICING_TABLE.map((model) => (
                      <tr key={model.id} className="hover:bg-muted/10">
                        <td className="px-4 py-2 text-sm text-muted-foreground capitalize">{model.provider}</td>
                        <td className="px-4 py-2 text-sm font-medium text-foreground">
                          {model.name}
                          <div className="text-xs text-muted-foreground font-normal">{model.id}</div>
                        </td>
                        <td className="px-4 py-2 text-sm text-foreground text-right">${model.inputPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-foreground text-right">${model.outputPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
