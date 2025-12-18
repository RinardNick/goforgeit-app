'use client';

import { createContext, useContext, ReactNode } from 'react';

/**
 * Configuration for API and navigation paths
 * Used to parameterize page components for different route variants
 */
export interface ApiPathConfig {
  /** Base path for API routes (e.g., '/api/agents' or '/api/adk-agents') */
  apiBasePath: string;
  /** Base path for navigation (e.g., '' or '/adk-agents') */
  navBasePath: string;
}

const ApiPathContext = createContext<ApiPathConfig | null>(null);

interface ApiPathProviderProps {
  children: ReactNode;
  config: ApiPathConfig;
}

/**
 * Provider component for API path configuration
 * Wrap page components with this to inject the correct paths
 */
export function ApiPathProvider({ children, config }: ApiPathProviderProps) {
  return (
    <ApiPathContext.Provider value={config}>
      {children}
    </ApiPathContext.Provider>
  );
}

/**
 * Hook to access API path configuration
 * Must be used within an ApiPathProvider
 */
export function useApiPath(): ApiPathConfig {
  const context = useContext(ApiPathContext);
  if (!context) {
    throw new Error('useApiPath must be used within an ApiPathProvider');
  }
  return context;
}

/**
 * Predefined configurations for the two route variants
 */
export const API_CONFIGS = {
  /** Standard agents route (/api/agents, /) */
  agents: {
    apiBasePath: '/api/agents',
    navBasePath: '',
  } as ApiPathConfig,

  /** ADK agents route (/api/adk-agents, /adk-agents) */
  adkAgents: {
    apiBasePath: '/api/adk-agents',
    navBasePath: '/adk-agents',
  } as ApiPathConfig,
};
