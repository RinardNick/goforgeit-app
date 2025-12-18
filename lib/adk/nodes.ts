/**
 * ADK Agent Node Utilities
 *
 * Functions for converting between YAML agent files and React Flow nodes/edges.
 * Uses dagre for automatic hierarchical layout.
 */

import { Node, Edge } from '@xyflow/react';
import YAML from 'yaml';
import dagre from 'dagre';
import type { AgentNodeData, ADKAgentClass } from '@/app/components/AgentComposer';

// Re-export all types from node-types for backwards compatibility
export type {
  AgentFile,
  GenerationConfig,
  MCPStdioParams,
  MCPSseParams,
  MCPToolsetEntry,
  AgentRefConfig,
  AgentToolEntry,
  OpenAPIToolsetEntry,
  BuiltInToolEntry,
  ToolEntry,
  CallbackType,
  CallbackEntry,
  CallbackConfig,
  ParsedAgent,
  ExtractedToolConfig,
  ExtractedMCPServer,
  ExtractedAgentTool,
  ExtractedOpenAPITool,
} from './node-types';

import type {
  AgentFile,
  MCPToolsetEntry,
  AgentToolEntry,
  OpenAPIToolsetEntry,
  BuiltInToolEntry,
  ToolEntry,
  CallbackType,
  CallbackEntry,
  CallbackConfig,
  ParsedAgent,
  ExtractedToolConfig,
} from './node-types';

// Type guard for BuiltInToolEntry
function isBuiltInToolEntry(tool: ToolEntry): tool is BuiltInToolEntry {
  return (
    typeof tool === 'object' &&
    tool !== null &&
    'name' in tool &&
    tool.name !== 'MCPToolset' &&
    tool.name !== 'AgentTool' &&
    tool.name !== 'OpenAPIToolset'
  );
}

// Type guard for MCPToolset entries
function isMCPToolsetEntry(tool: ToolEntry): tool is MCPToolsetEntry {
  return typeof tool === 'object' && tool !== null && tool.name === 'MCPToolset';
}

// Type guard for AgentTool entries
function isAgentToolEntry(tool: ToolEntry): tool is AgentToolEntry {
  return typeof tool === 'object' && tool !== null && tool.name === 'AgentTool';
}

// Type guard for OpenAPIToolset entries
function isOpenAPIToolsetEntry(tool: ToolEntry): tool is OpenAPIToolsetEntry {
  return typeof tool === 'object' && tool !== null && tool.name === 'OpenAPIToolset';
}

// Helper to extract simple string tools from tools array (handles both strings and BuiltInToolEntry)
function extractSimpleTools(tools?: ToolEntry[]): string[] {
  if (!tools) return [];
  return tools
    .filter((t): t is string | BuiltInToolEntry => typeof t === 'string' || isBuiltInToolEntry(t))
    .map(t => typeof t === 'string' ? t : t.name);
}

// Helper to extract tool confirmation configs and tool-specific args from tools array
function extractToolConfigs(tools?: ToolEntry[]): Map<string, ExtractedToolConfig> {
  const toolConfigs = new Map<string, ExtractedToolConfig>();
  if (!tools) return toolConfigs;

  for (const tool of tools) {
    if (isBuiltInToolEntry(tool)) {
      const hasConfig = tool.require_confirmation ||
        tool.args?.data_store_id ||
        tool.args?.rag_corpora ||
        tool.args?.similarity_top_k !== undefined ||
        tool.args?.vector_distance_threshold !== undefined ||
        tool.args?.input_dir ||
        tool.args?.func;

      // Only add config if there's something to configure
      if (hasConfig) {
        toolConfigs.set(tool.name, {
          id: tool.name,
          requireConfirmation: tool.require_confirmation,
          confirmationPrompt: tool.confirmation_prompt,
          dataStoreId: tool.args?.data_store_id,
          ragCorpora: tool.args?.rag_corpora,
          similarityTopK: tool.args?.similarity_top_k,
          vectorDistanceThreshold: tool.args?.vector_distance_threshold,
          inputDir: tool.args?.input_dir,
          funcPath: tool.args?.func,
        });
      }
    }
  }

  return toolConfigs;
}

// Helper to extract AgentTools from tools array
function extractAgentTools(tools?: ToolEntry[]): Array<{
  id: string;
  agentPath: string;
  agentName: string;
}> {
  if (!tools) return [];

  const agentTools: Array<{
    id: string;
    agentPath: string;
    agentName: string;
  }> = [];

  let agentToolIndex = 0;
  for (const tool of tools) {
    if (isAgentToolEntry(tool)) {
      // Extract config_path from the AgentRefConfig object
      const agentRef = tool.args.agent;
      const agentPath = agentRef.config_path || '';
      if (!agentPath) continue; // Skip if no config_path
      const agentName = agentPath.replace('.yaml', '').replace(/^\.\//, '');
      agentTools.push({
        id: `agent-tool-loaded-${agentToolIndex++}`,
        agentPath,
        agentName,
      });
    }
  }

  return agentTools;
}

// Helper to extract OpenAPI tools from tools array
function extractOpenAPITools(tools?: ToolEntry[]): Array<{
  id: string;
  name: string;
  specUrl: string;
}> {
  if (!tools) return [];

  const openApiTools: Array<{
    id: string;
    name: string;
    specUrl: string;
  }> = [];

  let openApiIndex = 0;
  for (const tool of tools) {
    if (isOpenAPIToolsetEntry(tool)) {
      openApiTools.push({
        id: `openapi-tool-loaded-${openApiIndex++}`,
        name: tool.args.name,
        specUrl: tool.args.spec_url,
      });
    }
  }

  return openApiTools;
}

// Helper to extract MCP servers from tools array
function extractMCPServers(tools?: ToolEntry[]): Array<{
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}> {
  if (!tools) return [];

  const mcpServers: Array<{
    id: string;
    name: string;
    type: 'stdio' | 'sse';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
  }> = [];

  let mcpIndex = 0;
  for (const tool of tools) {
    if (isMCPToolsetEntry(tool)) {
      const args = tool.args;
      if (args.stdio_server_params) {
        mcpServers.push({
          id: `mcp-loaded-${mcpIndex++}`,
          name: `MCP Server ${mcpIndex}`,
          type: 'stdio',
          command: args.stdio_server_params.command,
          args: args.stdio_server_params.args,
          env: args.stdio_server_params.env,
        });
      } else if (args.sse_server_params) {
        mcpServers.push({
          id: `mcp-loaded-${mcpIndex++}`,
          name: `MCP Server ${mcpIndex}`,
          type: 'sse',
          url: args.sse_server_params.url,
          headers: args.sse_server_params.headers,
        });
      }
    }
  }

  return mcpServers;
}

// Helper to extract callbacks from parsed agent
function extractCallbacks(agent: ParsedAgent): CallbackConfig[] {
  const callbacks: CallbackConfig[] = [];
  let callbackIndex = 0;

  const callbackTypes: { key: keyof ParsedAgent; type: CallbackType }[] = [
    { key: 'before_agent_callbacks', type: 'before_agent' },
    { key: 'after_agent_callbacks', type: 'after_agent' },
    { key: 'before_model_callbacks', type: 'before_model' },
    { key: 'after_model_callbacks', type: 'after_model' },
    { key: 'before_tool_callbacks', type: 'before_tool' },
    { key: 'after_tool_callbacks', type: 'after_tool' },
  ];

  for (const { key, type } of callbackTypes) {
    const callbackEntries = agent[key] as CallbackEntry[] | undefined;
    if (callbackEntries && Array.isArray(callbackEntries)) {
      for (const entry of callbackEntries) {
        if (entry.name) {
          callbacks.push({
            id: `callback-loaded-${callbackIndex++}`,
            type,
            functionPath: entry.name,
          });
        }
      }
    }
  }

  return callbacks;
}

// Position storage key prefix for localStorage
const POSITION_STORAGE_KEY = 'adk-node-positions-';

/**
 * Save node positions to localStorage
 */
export function saveNodePositions(projectName: string, nodes: Node[]): void {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    const filename = (node.data as AgentNodeData).filename;
    if (filename) {
      positions[filename] = { x: node.position.x, y: node.position.y };
    }
  }
  try {
    localStorage.setItem(POSITION_STORAGE_KEY + projectName, JSON.stringify(positions));
  } catch (e) {
    console.error('Failed to save node positions:', e);
  }
}

/**
 * Load node positions from localStorage
 */
export function loadNodePositions(projectName: string): Record<string, { x: number; y: number }> | null {
  try {
    const stored = localStorage.getItem(POSITION_STORAGE_KEY + projectName);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load node positions:', e);
  }
  return null;
}

/**
 * Determine the React Flow node type based on agent class
 */
export function getNodeType(agentClass: ADKAgentClass | string): string {
  if (agentClass === 'SequentialAgent' || agentClass === 'ParallelAgent' || agentClass === 'LoopAgent') {
    return 'container';
  }
  return 'agent';
}

/**
 * Apply dagre layout to nodes and edges
 * Preserves saved positions for nodes that have them, uses dagre only for new nodes
 */
function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  savedPositions?: Record<string, { x: number; y: number }> | null
): void {
  // Apply saved positions to nodes that have them
  const nodesNeedingLayout: Node[] = [];

  for (const node of nodes) {
    const filename = (node.data as AgentNodeData).filename;
    if (filename && savedPositions?.[filename]) {
      // Use saved position
      node.position = { ...savedPositions[filename] };
    } else {
      // This node needs dagre layout
      nodesNeedingLayout.push(node);
    }
  }

  // If all nodes have saved positions, we're done
  if (nodesNeedingLayout.length === 0 && nodes.length > 0) {
    return;
  }

  // If no saved positions at all, run dagre on everything
  const nodesToLayout = savedPositions && nodesNeedingLayout.length < nodes.length
    ? nodesNeedingLayout
    : nodes;

  // Create dagre graph
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure dagre for top-to-bottom hierarchical layout
  dagreGraph.setGraph({
    rankdir: 'TB', // Top to bottom
    nodesep: 80,   // Horizontal spacing between nodes
    ranksep: 120,  // Vertical spacing between ranks
    marginx: 50,
    marginy: 50,
  });

  // Add ALL nodes to dagre graph (needed for proper relative positioning)
  const nodeWidth = 280;
  const nodeHeight = 150;

  for (const node of nodes) {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }

  // Add edges to dagre graph
  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  // Run the layout algorithm
  dagre.layout(dagreGraph);

  // Apply positions ONLY to nodes that need layout (don't overwrite saved positions)
  for (const node of nodesToLayout) {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (nodeWithPosition) {
      // dagre returns center positions, convert to top-left
      node.position = {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      };
    }
  }
}

/**
 * Convert agent YAML files to React Flow nodes and edges
 * @param files - Array of agent YAML files
 * @param savedPositions - Optional saved node positions
 * @param customRootFile - Optional custom root file (e.g., for editing tool agents)
 */
export function agentFilesToNodes(
  files: AgentFile[],
  savedPositions?: Record<string, { x: number; y: number }> | null,
  customRootFile?: string | null
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const agentMap = new Map<string, { parsed: ParsedAgent; filename: string }>();
  const filenameToNodeId = new Map<string, string>();
  const processedFilenames = new Set<string>();

  // First pass: parse all YAML files
  for (const file of files) {
    try {
      const parsed = YAML.parse(file.yaml) as ParsedAgent;
      if (parsed && parsed.name) {
        agentMap.set(file.filename, { parsed, filename: file.filename });
      }
    } catch (e) {
      console.error(`Error parsing ${file.filename}:`, e);
    }
  }

  // Find the root agent
  let rootFilename: string;
  if (customRootFile && agentMap.has(customRootFile)) {
    // Use custom root file if specified (for tool agent editing)
    rootFilename = customRootFile;
  } else {
    // Default: root_agent.yaml or the one with sub_agents
    rootFilename = 'root_agent.yaml';
    if (!agentMap.has(rootFilename)) {
      for (const [filename, entry] of agentMap) {
        if (entry.parsed.sub_agents && entry.parsed.sub_agents.length > 0) {
          rootFilename = filename;
          break;
        }
      }
    }
  }
  if (!agentMap.has(rootFilename) && files.length > 0) {
    rootFilename = files[0].filename;
  }

  let nodeIndex = 0;

  // Find agents referenced via AgentTool and sub_agents to determine which to hide
  const agentToolReferences = new Set<string>();
  const subAgentReferences = new Set<string>();

  for (const [, entry] of agentMap) {
    const agent = entry.parsed;

    // Track sub_agent references
    if (agent.sub_agents) {
      for (const sub of agent.sub_agents) {
        if (sub.config_path) {
          subAgentReferences.add(sub.config_path.replace(/^\.\//, ''));
        }
      }
    }

    // Track AgentTool references
    if (agent.tools) {
      for (const tool of agent.tools) {
        // Check for shorthand format: { agent_tool: { config_path: ... } }
        if (typeof tool === 'object' && tool !== null && 'agent_tool' in tool) {
          const agentTool = tool.agent_tool as { config_path?: string };
          if (agentTool.config_path) {
            agentToolReferences.add(agentTool.config_path.replace(/^\.\//, ''));
          }
        }
        // Check for standard format: { name: 'AgentTool', args: { agent: { config_path: ... } } }
        else if (isAgentToolEntry(tool)) {
          const agentRef = tool.args.agent;
          if (agentRef.config_path) {
            agentToolReferences.add(agentRef.config_path.replace(/^\.\//, ''));
          }
        }
      }
    }
  }

  // Helper function to get childAgents data for container nodes
  const getChildAgentsData = (parsed: ParsedAgent) => {
    if (!parsed.sub_agents || parsed.sub_agents.length === 0) return undefined;

    return parsed.sub_agents
      .filter(sub => sub.config_path)
      .map(sub => {
        const childEntry = agentMap.get(sub.config_path!);
        if (childEntry) {
          return {
            name: childEntry.parsed.name || sub.config_path!.replace('.yaml', ''),
            agentClass: (childEntry.parsed.agent_class as ADKAgentClass) || 'LlmAgent',
            description: childEntry.parsed.description,
            filename: sub.config_path,
          };
        }
        return {
          name: sub.config_path!.replace('.yaml', ''),
          agentClass: 'LlmAgent' as ADKAgentClass,
          description: undefined,
          filename: sub.config_path,
        };
      });
  };

  // Process root agent first
  const rootEntry = agentMap.get(rootFilename);
  if (rootEntry) {
    const rootAgent = rootEntry.parsed;
    const rootAgentClass = (rootAgent.agent_class as ADKAgentClass) || 'LlmAgent';
    const rootNodeId = 'root';

    filenameToNodeId.set(rootFilename, rootNodeId);
    processedFilenames.add(rootFilename);

    nodes.push({
      id: rootNodeId,
      type: getNodeType(rootAgentClass),
      position: { x: 0, y: 0 }, // Will be set by dagre
      data: {
        name: rootAgent.name || 'Root Agent',
        agentClass: rootAgentClass,
        model: rootAgent.model,
        description: rootAgent.description,
        instruction: rootAgent.instruction,
        tools: extractSimpleTools(rootAgent.tools),
        toolConfigs: extractToolConfigs(rootAgent.tools),
        mcpServers: extractMCPServers(rootAgent.tools),
        agentTools: extractAgentTools(rootAgent.tools),
        openApiTools: extractOpenAPITools(rootAgent.tools),
        callbacks: extractCallbacks(rootAgent),
        isRoot: true,
        filename: rootFilename,
        childAgents: getChildAgentsData(rootAgent),
        generation_config: rootAgent.generation_config,
      } as AgentNodeData,
    });

    nodeIndex++;
  }

  // Helper function to find all reachable nodes from a root
  const getReachableNodes = (startFilename: string): Set<string> => {
    const reachable = new Set<string>();
    const queue = [startFilename];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      
      const entry = agentMap.get(current);
      if (entry && entry.parsed.sub_agents) {
        for (const sub of entry.parsed.sub_agents) {
          if (sub.config_path) {
            const subPath = sub.config_path.replace(/^\.\//, '');
            if (agentMap.has(subPath)) {
              queue.push(subPath);
            }
          }
        }
      }
    }
    return reachable;
  };

  // If in tool editing mode (customRootFile set), calculate reachable nodes from that root
  let reachableFromRoot: Set<string> | null = null;
  if (customRootFile) {
    reachableFromRoot = getReachableNodes(customRootFile);
  }

  // --- Enhanced "Hide Tool Sub-agents" Logic ---

  // 1. Build Sub-Agent Graph (Parent -> Children)
  const subAgentGraph = new Map<string, Set<string>>();
  for (const [filename, entry] of agentMap) {
    if (entry.parsed.sub_agents) {
      const children = new Set<string>();
      for (const sub of entry.parsed.sub_agents) {
        if (sub.config_path) {
          children.add(sub.config_path.replace(/^\.\//, ''));
        }
      }
      if (children.size > 0) {
        subAgentGraph.set(filename, children);
      }
    }
  }

  // Helper: BFS to find all descendants
  const getDescendants = (roots: Set<string>): Set<string> => {
    const descendants = new Set<string>();
    const queue = Array.from(roots);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = subAgentGraph.get(current);
      if (children) {
        for (const child of children) {
          if (!descendants.has(child)) {
            descendants.add(child);
            queue.push(child);
          }
        }
      }
    }
    return descendants;
  };

  // 2. Identify "Guilty Roots" (Tool-only agents)
  // These are agents referenced as tools but NOT as sub-agents by anyone
  const guiltyRoots = new Set<string>();
  for (const filename of agentMap.keys()) {
    if (agentToolReferences.has(filename) && !subAgentReferences.has(filename)) {
      guiltyRoots.add(filename);
    }
  }

  // 3. Identify "Guilty by Association" (Descendants of Guilty Roots)
  const guiltyByAssociation = getDescendants(guiltyRoots);

  // 4. Identify "Innocent Nodes" (Visible Roots)
  // These are nodes that are NEITHER Guilty Roots NOR Guilty by Association
  // This includes the main root, orphans, and independent chains
  const innocentNodes = new Set<string>();
  for (const filename of agentMap.keys()) {
    if (!guiltyRoots.has(filename) && !guiltyByAssociation.has(filename)) {
      innocentNodes.add(filename);
    }
  }

  // 5. Identify "Redeemed Nodes" (Reachable from Innocent Nodes)
  // These are nodes that might be guilty by association but are ALSO reachable from an innocent node
  // e.g., a shared sub-agent between a tool and the main graph
  const redeemedNodes = getDescendants(innocentNodes);

  // 6. Calculate Final Hidden Nodes
  // Hidden = Guilty Roots + (Guilty by Association - Redeemed Nodes)
  const finalHiddenNodes = new Set<string>();
  
  // Add Guilty Roots
  for (const node of guiltyRoots) {
    finalHiddenNodes.add(node);
  }

  // Add un-redeemed descendants
  for (const node of guiltyByAssociation) {
    if (!redeemedNodes.has(node)) {
      finalHiddenNodes.add(node);
    }
  }

  console.log('[agentFilesToNodes] Visibility Analysis:', {
    guiltyRoots: Array.from(guiltyRoots),
    guiltyByAssociation: Array.from(guiltyByAssociation),
    innocentNodes: Array.from(innocentNodes),
    redeemedNodes: Array.from(redeemedNodes),
    finalHiddenNodes: Array.from(finalHiddenNodes)
  });

  // Process all other agents
  for (const [filename, entry] of agentMap) {
    if (processedFilenames.has(filename)) continue;

    // In main view (no customRootFile), use the enhanced hiding logic
    if (!customRootFile) {
      if (finalHiddenNodes.has(filename)) {
        console.log(`[agentFilesToNodes] Hiding node: ${filename}`);
        continue;
      }
    } else {
      // In tool editing view (customRootFile set), only show nodes reachable from the tool root
      if (reachableFromRoot && !reachableFromRoot.has(filename)) {
        // Skip nodes not reachable from the tool agent being edited
        continue;
      }
    }

    const agent = entry.parsed;
    const agentClass = (agent.agent_class as ADKAgentClass) || 'LlmAgent';
    const nodeId = `agent-${nodeIndex}`;

    filenameToNodeId.set(filename, nodeId);
    processedFilenames.add(filename);

    nodes.push({
      id: nodeId,
      type: getNodeType(agentClass),
      position: { x: 0, y: 0 }, // Will be set by dagre
      data: {
        name: agent.name || filename.replace('.yaml', ''),
        agentClass: agentClass,
        model: agent.model,
        description: agent.description,
        instruction: agent.instruction,
        tools: extractSimpleTools(agent.tools),
        toolConfigs: extractToolConfigs(agent.tools),
        mcpServers: extractMCPServers(agent.tools),
        agentTools: extractAgentTools(agent.tools),
        openApiTools: extractOpenAPITools(agent.tools),
        callbacks: extractCallbacks(agent),
        isRoot: false,
        filename: filename,
        childAgents: getChildAgentsData(agent),
        generation_config: agent.generation_config,
      } as AgentNodeData,
    });

    nodeIndex++;
  }

  // Create edges based on sub_agents relationships
  // For Sequential agents: chain sub-agents together (A -> B -> C)
  // For Parallel/Loop agents: connect parent to all children (Parent -> A, Parent -> B)
  for (const [filename, entry] of agentMap) {
    const parentNodeId = filenameToNodeId.get(filename);
    if (!parentNodeId) continue;

    const subAgents = entry.parsed.sub_agents;
    if (!subAgents || subAgents.length === 0) continue;

    const agentClass = entry.parsed.agent_class;
    const validSubAgents = subAgents.filter(sub => {
      if (!sub.config_path) return false;
      const normalizedPath = sub.config_path.replace(/^\.\//, '');
      return filenameToNodeId.has(normalizedPath);
    });

    if (agentClass === 'SequentialAgent' && validSubAgents.length > 1) {
      // Sequential: connect parent to first child, then chain children
      const firstNormalizedPath = validSubAgents[0].config_path!.replace(/^\.\//, '');
      const firstChildNodeId = filenameToNodeId.get(firstNormalizedPath);
      if (firstChildNodeId) {
        edges.push({
          id: `edge-${parentNodeId}-${firstChildNodeId}`,
          source: parentNodeId,
          target: firstChildNodeId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#9333ea', strokeWidth: 2 }, // Purple for sequential
          label: '1',
          labelStyle: { fill: '#9333ea', fontWeight: 600, fontSize: 10 },
          labelBgStyle: { fill: '#faf5ff', fillOpacity: 0.9 },
        });
      }

      // Chain the children together
      for (let i = 0; i < validSubAgents.length - 1; i++) {
        const currentPath = validSubAgents[i].config_path!.replace(/^\.\//, '');
        const nextPath = validSubAgents[i + 1].config_path!.replace(/^\.\//, '');
        const currentNodeId = filenameToNodeId.get(currentPath);
        const nextNodeId = filenameToNodeId.get(nextPath);
        if (currentNodeId && nextNodeId) {
          edges.push({
            id: `edge-${currentNodeId}-${nextNodeId}`,
            source: currentNodeId,
            target: nextNodeId,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#9333ea', strokeWidth: 2 }, // Purple for sequential
            label: String(i + 2),
            labelStyle: { fill: '#9333ea', fontWeight: 600, fontSize: 10 },
            labelBgStyle: { fill: '#faf5ff', fillOpacity: 0.9 },
          });
        }
      }
    } else {
      // Parallel/Loop/Default: connect parent to all children (hub pattern)
      for (const subAgentRef of validSubAgents) {
        const normalizedPath = subAgentRef.config_path!.replace(/^\.\//, '');
        const childNodeId = filenameToNodeId.get(normalizedPath);
        if (childNodeId) {
          const edgeColor = agentClass === 'ParallelAgent' ? '#16a34a' : // Green for parallel
                           agentClass === 'LoopAgent' ? '#ea580c' :    // Orange for loop
                           '#6b7280';                                   // Gray for others
          edges.push({
            id: `edge-${parentNodeId}-${childNodeId}`,
            source: parentNodeId,
            target: childNodeId,
            type: 'smoothstep',
            animated: true,
            style: { stroke: edgeColor, strokeWidth: 2 },
          });
        }
      }
    }
  }

  // Apply dagre layout
  applyDagreLayout(nodes, edges, savedPositions);

  return { nodes, edges };
}

/**
 * Convert React Flow nodes back to YAML (for root agent only)
 * IMPORTANT: This preserves all fields from the node data to prevent data loss
 */
export function nodesToYaml(nodes: Node[], edges: Edge[]): string {
  const rootNode = nodes.find((n) => (n.data as AgentNodeData).isRoot);
  if (!rootNode) return '';

  const rootData = rootNode.data as AgentNodeData;
  const subAgentNodes = nodes.filter((n) => !(n.data as AgentNodeData).isRoot);

  // Build sub_agents array from connected nodes
  const connectedSubAgents = subAgentNodes
    .filter((n) => edges.some((e) => e.source === 'root' && e.target === n.id))
    .map((n) => {
      const data = n.data as AgentNodeData;
      const filename = data.filename || `${data.name.toLowerCase().replace(/\s+/g, '_')}_agent.yaml`;
      // Add ./ prefix for ADK compatibility (matches Google ADK builder format)
      const configPath = filename.startsWith('./') ? filename : `./${filename}`;
      return { config_path: configPath };
    });

  // Build agent object with exact field ordering to match Google ADK builder format
  // Order: name, model, agent_class, [description], instruction, sub_agents, tools
  const agentObj: Record<string, unknown> = {
    name: rootData.name.toLowerCase().replace(/\s+/g, '_'),
  };

  // Model comes before agent_class in Google's format
  if (rootData.model) {
    agentObj.model = rootData.model;
  }

  agentObj.agent_class = rootData.agentClass;

  // Description is optional but comes after agent_class
  if (rootData.description) {
    agentObj.description = rootData.description;
  }

  // Instruction field (required for LlmAgent)
  if (rootData.instruction) {
    agentObj.instruction = rootData.instruction;
  }

  // Build the tools array (includes simple tools, MCP servers, agent tools, OpenAPI tools)
  const toolsArray: unknown[] = [];

  // Add simple string tools (or structured if they have confirmation config or tool-specific args)
  if (rootData.tools && rootData.tools.length > 0) {
    for (const tool of rootData.tools) {
      // Check if this tool has any config (confirmation or tool-specific args)
      const toolConfig = rootData.toolConfigs?.get(tool);
      const hasConfirmation = toolConfig?.requireConfirmation;
      const hasToolSpecificArgs = toolConfig?.dataStoreId ||
        toolConfig?.ragCorpora ||
        toolConfig?.similarityTopK !== undefined ||
        toolConfig?.vectorDistanceThreshold !== undefined ||
        toolConfig?.inputDir ||
        toolConfig?.funcPath;

      if (hasConfirmation || hasToolSpecificArgs) {
        // Add as structured object with settings
        const toolObj: Record<string, unknown> = { name: tool };

        if (hasConfirmation) {
          toolObj.require_confirmation = true;
          if (toolConfig.confirmationPrompt) {
            toolObj.confirmation_prompt = toolConfig.confirmationPrompt;
          }
        }

        if (hasToolSpecificArgs) {
          const args: Record<string, unknown> = {};

          // VertexAiSearchTool
          if (toolConfig.dataStoreId) {
            args.data_store_id = toolConfig.dataStoreId;
          }

          // VertexAiRagRetrieval
          if (toolConfig.ragCorpora) {
            args.rag_corpora = toolConfig.ragCorpora;
          }
          if (toolConfig.similarityTopK !== undefined) {
            args.similarity_top_k = toolConfig.similarityTopK;
          }
          if (toolConfig.vectorDistanceThreshold !== undefined) {
            args.vector_distance_threshold = toolConfig.vectorDistanceThreshold;
          }

          // FilesRetrieval
          if (toolConfig.inputDir) {
            args.input_dir = toolConfig.inputDir;
          }

          // LongRunningFunctionTool
          if (toolConfig.funcPath) {
            args.func = toolConfig.funcPath;
          }

          toolObj.args = args;
        }

        toolsArray.push(toolObj);
      } else {
        // All tools must use object format with 'name' field (ADK requirement)
        toolsArray.push({ name: tool });
      }
    }
  }

  // Add MCP servers as MCPToolset entries
  if (rootData.mcpServers && rootData.mcpServers.length > 0) {
    for (const server of rootData.mcpServers) {
      const mcpToolset: Record<string, unknown> = {
        name: 'MCPToolset',
        args: {},
      };

      if (server.type === 'stdio') {
        (mcpToolset.args as Record<string, unknown>).stdio_server_params = {
          command: server.command,
          ...(server.args && server.args.length > 0 ? { args: server.args } : {}),
          ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
        };
      } else if (server.type === 'sse') {
        (mcpToolset.args as Record<string, unknown>).sse_server_params = {
          url: server.url,
          ...(server.headers && Object.keys(server.headers).length > 0 ? { headers: server.headers } : {}),
        };
      }

      toolsArray.push(mcpToolset);
    }
  }

  // Add Agent Tools as AgentTool entries (ADK format with AgentRefConfig)
  if (rootData.agentTools && rootData.agentTools.length > 0) {
    for (const agentTool of rootData.agentTools) {
      const agentToolConfig: Record<string, unknown> = {
        name: 'AgentTool',
        args: {
          agent: {
            config_path: agentTool.agentPath,
          },
          // Match Google ADK builder format: include skip_summarization (defaults to false)
          skip_summarization: false,
        },
      };
      toolsArray.push(agentToolConfig);
    }
  }

  // Add OpenAPI Tools as OpenAPIToolset entries
  if (rootData.openApiTools && rootData.openApiTools.length > 0) {
    for (const openApiTool of rootData.openApiTools) {
      toolsArray.push({
        name: 'OpenAPIToolset',
        args: {
          name: openApiTool.name,
          spec_url: openApiTool.specUrl,
        },
      });
    }
  }

  // Always add tools array (matches Google ADK builder format, even when empty)
  agentObj.tools = toolsArray;

  // Include generation_config if present
  if (rootData.generation_config) {
    const config: Record<string, unknown> = {};
    if (rootData.generation_config.temperature !== undefined) {
      config.temperature = rootData.generation_config.temperature;
    }
    if (rootData.generation_config.max_output_tokens !== undefined) {
      config.max_output_tokens = rootData.generation_config.max_output_tokens;
    }
    if (rootData.generation_config.top_p !== undefined) {
      config.top_p = rootData.generation_config.top_p;
    }
    if (rootData.generation_config.top_k !== undefined) {
      config.top_k = rootData.generation_config.top_k;
    }
    if (Object.keys(config).length > 0) {
      agentObj.generation_config = config;
    }
  }

  // Add callbacks if any are defined
  if (rootData.callbacks && rootData.callbacks.length > 0) {
    const callbacksByType: Record<string, Array<{ name: string }>> = {};

    for (const callback of rootData.callbacks) {
      const yamlKey = `${callback.type}_callbacks`;
      if (!callbacksByType[yamlKey]) {
        callbacksByType[yamlKey] = [];
      }
      callbacksByType[yamlKey].push({ name: callback.functionPath });
    }

    for (const [key, callbacks] of Object.entries(callbacksByType)) {
      agentObj[key] = callbacks;
    }
  }

  // Always add sub_agents (even when empty, matches Google ADK builder format)
  agentObj.sub_agents = connectedSubAgents;

  return YAML.stringify(agentObj);
}

/**
 * Generate a filename from an agent name (snake_case)
 */
export function nameToFilename(name: string): string {
  return `${name.toLowerCase().replace(/\s+/g, '_')}.yaml`;
}

/**
 * Generate an agent name from a filename
 */
export function filenameToName(filename: string): string {
  return filename.replace('.yaml', '').replace(/_/g, ' ');
}
