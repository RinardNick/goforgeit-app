'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Node, Edge } from '@xyflow/react';
import dynamic from 'next/dynamic';
import YAML from 'yaml';
import Navigation from '@/app/components/Navigation';
import type { AgentNodeData, ADKAgentClass } from '@/app/components/AgentComposer';
import { ToolRegistryPanel, ToolEditorModal, CreateToolModal } from '@/app/components/AgentComposer';
import { AIAssistantPanel, ComposeHeader, YAMLEditorPanel } from '@/components/compose';
import {
  agentFilesToNodes,
  nodesToYaml,
  getNodeType,
  saveNodePositions,
  loadNodePositions,
  type AgentFile,
  type ParsedAgent,
} from '@/lib/adk/nodes';

// Dynamically import AgentComposer to avoid SSR issues with React Flow
const AgentComposer = dynamic(
  () => import('@/app/components/AgentComposer').then((mod) => mod.AgentComposer),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center">Loading composer...</div> }
);

export default function ADKAgentComposePage() {
  const params = useParams();
  const router = useRouter();
  const agentName = params?.name as string;

  // State-based navigation for AgentTool editing (no URL change)
  const [toolAgentContext, setToolAgentContext] = useState<{ filename: string; parentName: string } | null>(null);

  const [files, setFiles] = useState<AgentFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('root_agent.yaml');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'yaml' | 'split'>('visual');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [originalFiles, setOriginalFiles] = useState<AgentFile[]>([]);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [circularDependencyWarning, setCircularDependencyWarning] = useState<string | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(true);
  const [showToolRegistry, setShowToolRegistry] = useState(false);
  const [showCreateTool, setShowCreateTool] = useState(false);
  const [editingTool, setEditingTool] = useState<{ filename: string; content: string } | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, { valid: boolean; errors: Array<{ type: string; message: string; field?: string; value?: string }> }>>({});

  // Format agent name for display
  const displayName = agentName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Handle Forge Tool
  const handleForgeTool = async (description: string) => {
    try {
      const response = await fetch(`/api/agents/${agentName}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Please use the forge_agent to create a new python tool based on this description: ${description}. 
          The tool should be written to the tools/ directory. 
          Make sure the code follows ADK tool patterns with proper docstrings and type hints.`,
          context: {
            agents: nodes.map(n => ({
              filename: (n.data as AgentNodeData).filename || '',
              name: (n.data as AgentNodeData).name || '',
              agentClass: (n.data as AgentNodeData).agentClass || '',
            })),
            selectedAgent: selectedNode ? {
              filename: (selectedNode.data as AgentNodeData).filename || '',
              name: (selectedNode.data as AgentNodeData).name || '',
            } : null,
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to forge tool');
      }

      const result = await response.json();
      
      // Refresh files to see the new tool
      await loadFiles(false);
      
      // Optionally show success or open the new tool in editor
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to forge tool');
    }
  };

  // Get the currently selected file's YAML
  const selectedFileData = files.find(f => f.filename === selectedFile);
  const currentYaml = selectedFileData?.yaml || '';

  // Check if there are unsaved changes
  const hasChanges = JSON.stringify(files) !== JSON.stringify(originalFiles);

  // Load all agent files - extracted as callback so it can be triggered by AI Assistant
  // resetOriginal: if true, resets change tracking (use for initial load, after save)
  //                if false, preserves unsaved changes (use for AI Assistant refresh)
  const loadFiles = useCallback(async (resetOriginal = true) => {
    // Only show loading spinner on initial load, not during refreshes
    if (resetOriginal) {
      setLoading(true);
    }
    try {
      const response = await fetch(`/api/agents/${agentName}/files?t=${Date.now()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load agent files');
      }

      const loadedFiles = data.files || [];
      setFiles(loadedFiles);
      if (resetOriginal) {
        setOriginalFiles(loadedFiles);
      }

      // Find the root file
      const rootFile = loadedFiles.find((f: AgentFile) => f.filename === 'root_agent.yaml') || loadedFiles[0];
      if (rootFile) {
        setSelectedFile(rootFile.filename);
      }

      // Load saved positions from localStorage
      const savedPositions = loadNodePositions(agentName);

      // Convert to nodes with saved positions, using custom root if in tool agent mode
      const { nodes: parsedNodes, edges: parsedEdges } = agentFilesToNodes(
        loadedFiles,
        savedPositions,
        toolAgentContext?.filename || null
      );
      setNodes(parsedNodes);
      setEdges(parsedEdges);

      // Fetch validation results
      const validationResponse = await fetch(`/api/agents/${agentName}/validate`);
      if (validationResponse.ok) {
        const validationData = await validationResponse.json();
        setValidationResults(validationData.results || {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      if (resetOriginal) {
        setLoading(false);
      }
    }
  }, [agentName, toolAgentContext]);

  // Load all agent files on mount
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Validate YAML and check for circular dependencies
  const validateYaml = useCallback((yamlContent: string, allFiles: AgentFile[]) => {
    // Reset errors
    setYamlError(null);
    setValidationError(null);
    setCircularDependencyWarning(null);

    // Try to parse YAML
    let parsed: ParsedAgent;
    try {
      parsed = YAML.parse(yamlContent) as ParsedAgent;
    } catch (e) {
      setYamlError('Invalid YAML syntax');
      return false;
    }

    // Check required fields
    if (!parsed.agent_class) {
      setValidationError('agent_class is required');
      return false;
    }

    // Check for circular dependencies
    if (parsed.sub_agents && parsed.sub_agents.length > 0) {
      const visited = new Set<string>();
      const checkCircular = (filename: string, path: Set<string>): boolean => {
        if (path.has(filename)) {
          setCircularDependencyWarning(`Circular dependency detected: ${Array.from(path).join(' → ')} → ${filename}`);
          return true;
        }
        if (visited.has(filename)) return false;
        visited.add(filename);
        path.add(filename);

        const file = allFiles.find(f => f.filename === filename);
        if (file) {
          try {
            const fileParsed = YAML.parse(file.yaml) as ParsedAgent;
            if (fileParsed.sub_agents) {
              for (const sub of fileParsed.sub_agents) {
                if (sub.config_path && checkCircular(sub.config_path, new Set(path))) {
                  return true;
                }
              }
            }
          } catch {
            // Ignore parse errors in other files
          }
        }
        return false;
      };

      // Check from current file's sub_agents
      for (const sub of parsed.sub_agents) {
        if (sub.config_path) {
          if (checkCircular(sub.config_path, new Set([selectedFile]))) {
            return false;
          }
        }
      }
    }

    return true;
  }, [selectedFile]);

  // Handle YAML changes in the editor - bidirectional sync
  const handleYamlChange = useCallback((newYaml: string) => {
    // Update the files state
    const updatedFiles = files.map(f =>
      f.filename === selectedFile ? { ...f, yaml: newYaml } : f
    );
    setFiles(updatedFiles);

    // Validate the YAML
    validateYaml(newYaml, updatedFiles);

    // Always rebuild nodes from updated YAML for bidirectional sync
    // Load saved positions to preserve layout
    try {
      const savedPositions = loadNodePositions(agentName);
      const { nodes: parsedNodes, edges: parsedEdges} = agentFilesToNodes(
        updatedFiles,
        savedPositions,
        toolAgentContext?.filename || null
      );
      setNodes(parsedNodes);
      setEdges(parsedEdges);
    } catch {
      // If parsing fails, don't update nodes
    }
  }, [selectedFile, files, agentName, validateYaml, toolAgentContext]);

  // Handle visual canvas changes
  const handleCanvasChange = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    setNodes(newNodes);
    setEdges(newEdges);

    // Save node positions to localStorage whenever they change
    saveNodePositions(agentName, newNodes);

    // Update the appropriate YAML file (tool agent if set, otherwise root_agent.yaml)
    const newYaml = nodesToYaml(newNodes, newEdges);
    if (newYaml) {
      // Use functional update to get fresh files state
      setFiles(prev => {
        const targetFilename = toolAgentContext?.filename || prev.find(f => f.filename === 'root_agent.yaml')?.filename || prev[0]?.filename;
        if (!targetFilename) return prev;
        const newFiles = prev.map(f =>
          f.filename === targetFilename ? { ...f, yaml: newYaml } : f
        );
        return newFiles;
      });
    }
  }, [agentName, toolAgentContext]);

  // Handle node click to select file for editing
  const handleNodeSelect = useCallback((node: Node | null) => {
    setSelectedNode(node);
    if (node) {
      const data = node.data as AgentNodeData;
      if (data.filename) {
        setSelectedFile(data.filename);
      }
    }
  }, []);

  // Handle node creation - create a new YAML file
  const handleNodeCreate = useCallback(async (data: AgentNodeData): Promise<{ filename: string } | null> => {
    console.log('[handleNodeCreate] Creating agent file:', data);
    try {
      const response = await fetch(`/api/agents/${agentName}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          agentClass: data.agentClass,
          model: data.model,
          description: data.description,
          instruction: data.instruction,
        }),
      });

      const result = await response.json();
      console.log('[handleNodeCreate] API response:', response.ok, result);

      if (!response.ok) {
        setError(result.error || 'Failed to create agent file');
        return null;
      }

      // Add the new file to the files list
      const newFile = { filename: result.filename, yaml: result.yaml };
      setFiles(prev => [...prev, newFile]);
      setOriginalFiles(prev => [...prev, newFile]);
      setSelectedFile(result.filename);

      console.log('[handleNodeCreate] File created successfully:', result.filename);
      return { filename: result.filename };
    } catch (err) {
      console.error('[handleNodeCreate] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create agent file');
      return null;
    }
  }, [agentName]);

  // Handle node deletion - delete the YAML file
  const handleNodeDelete = useCallback(async (nodeId: string, filename: string | undefined): Promise<boolean> => {
    if (!filename) {
      // Node without a file - just allow deletion from canvas
      return true;
    }

    // Don't allow deleting root_agent.yaml
    if (filename === 'root_agent.yaml') {
      setError('Cannot delete the root agent file');
      return false;
    }

    try {
      const response = await fetch(`/api/agents/${agentName}/files?filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to delete agent file');
        return false;
      }

      // Remove the file from the files list
      setFiles(prev => prev.filter(f => f.filename !== filename));
      setOriginalFiles(prev => prev.filter(f => f.filename !== filename));

      // If we were viewing the deleted file, switch to root
      if (selectedFile === filename) {
        setSelectedFile('root_agent.yaml');
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent file');
      return false;
    }
  }, [agentName, selectedFile]);

  // Handle node data changes - update the YAML file
  const handleNodeDataChange = useCallback(async (nodeId: string, data: AgentNodeData) => {
    console.log('[handleNodeDataChange] Called with:', { nodeId, name: data.name, filename: data.filename });
    if (!data.filename) {
      console.log('[handleNodeDataChange] No filename, returning');
      return;
    }

    // Don't process empty names (happens during input clear)
    if (!data.name || data.name.trim() === '') {
      console.log('[handleNodeDataChange] Empty name, returning');
      return;
    }

    // Convert name to snake_case for filename
    const snakeCaseName = data.name.toLowerCase().replace(/\s+/g, '_');
    const newFilename = `${snakeCaseName}.yaml`;
    const oldFilename = data.filename;

    // Build YAML from node data
    const agentObj: Record<string, unknown> = {
      name: snakeCaseName,
      agent_class: data.agentClass,
    };

    if (data.model) {
      agentObj.model = data.model;
    }

    if (data.description) {
      agentObj.description = data.description;
    }

    if (data.instruction) {
      agentObj.instruction = data.instruction;
    }

    // Build the tools array (includes both simple string tools and MCPToolset objects)
    const toolsArray: unknown[] = [];

    // Add simple string tools (like google_search, built_in_code_execution)
    // If a tool has confirmation config or tool-specific args, add as structured object
    if (data.tools && data.tools.length > 0) {
      for (const tool of data.tools) {
        // Check if this tool has any config (confirmation or tool-specific args)
        const toolConfig = data.toolConfigs?.get(tool);
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
            if (toolConfig?.confirmationPrompt) {
              toolObj.confirmation_prompt = toolConfig.confirmationPrompt;
            }
          }

          if (hasToolSpecificArgs) {
            const args: Record<string, unknown> = {};

            // VertexAiSearchTool
            if (toolConfig?.dataStoreId) {
              args.data_store_id = toolConfig.dataStoreId;
            }

            // VertexAiRagRetrieval
            if (toolConfig?.ragCorpora) {
              args.rag_corpora = toolConfig.ragCorpora;
            }
            if (toolConfig?.similarityTopK !== undefined) {
              args.similarity_top_k = toolConfig.similarityTopK;
            }
            if (toolConfig?.vectorDistanceThreshold !== undefined) {
              args.vector_distance_threshold = toolConfig.vectorDistanceThreshold;
            }

            // FilesRetrieval
            if (toolConfig?.inputDir) {
              args.input_dir = toolConfig.inputDir;
            }

            // LongRunningFunctionTool
            if (toolConfig?.funcPath) {
              args.func = toolConfig.funcPath;
            }

            toolObj.args = args;
          }

          toolsArray.push(toolObj);
        } else {
          // Built-in tools need object format: { name: tool_name }
          toolsArray.push({ name: tool });
        }
      }
    }

    // Add MCP servers as MCPToolset entries
    if (data.mcpServers && data.mcpServers.length > 0) {
      for (const server of data.mcpServers) {
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
          (mcpToolset.args as Record<string, unknown>).sse_connection_params = {
            url: server.url,
            ...(server.headers && Object.keys(server.headers).length > 0 ? { headers: server.headers } : {}),
          };
        }

        toolsArray.push(mcpToolset);
      }
    }

    // Add Agent Tools as AgentTool entries (ADK format with AgentRefConfig)
    if (data.agentTools && data.agentTools.length > 0) {
      for (const agentTool of data.agentTools) {
        const agentToolEntry: Record<string, unknown> = {
          name: 'AgentTool',
          args: {
            agent: {
              config_path: agentTool.agentPath,
            },
          },
        };
        toolsArray.push(agentToolEntry);
      }
    }

    // Add OpenAPI Tools as OpenAPIToolset entries
    if (data.openApiTools && data.openApiTools.length > 0) {
      for (const openApiTool of data.openApiTools) {
        const openApiEntry: Record<string, unknown> = {
          name: 'OpenAPIToolset',
          args: {
            name: openApiTool.name,
            spec_url: openApiTool.specUrl,
          },
        };
        toolsArray.push(openApiEntry);
      }
    }

    if (toolsArray.length > 0) {
      agentObj.tools = toolsArray;
    }

    // Add generation_config if any values are set
    if (data.generation_config) {
      const config: Record<string, unknown> = {};
      if (data.generation_config.temperature !== undefined) {
        config.temperature = data.generation_config.temperature;
      }
      if (data.generation_config.max_output_tokens !== undefined) {
        config.max_output_tokens = data.generation_config.max_output_tokens;
      }
      if (data.generation_config.top_p !== undefined) {
        config.top_p = data.generation_config.top_p;
      }
      if (data.generation_config.top_k !== undefined) {
        config.top_k = data.generation_config.top_k;
      }
      // Only add generation_config if it has any values
      if (Object.keys(config).length > 0) {
        agentObj.generation_config = config;
      }
    }

    // Add callbacks if any are defined
    if (data.callbacks && data.callbacks.length > 0) {
      // Group callbacks by type
      const callbacksByType: Record<string, Array<{ name: string }>> = {};

      for (const callback of data.callbacks) {
        const yamlKey = `${callback.type}_callbacks`;
        if (!callbacksByType[yamlKey]) {
          callbacksByType[yamlKey] = [];
        }
        callbacksByType[yamlKey].push({ name: callback.functionPath });
      }

      // Add each callback type to agentObj
      for (const [key, callbacks] of Object.entries(callbacksByType)) {
        agentObj[key] = callbacks;
      }
    }

    const newYaml = YAML.stringify(agentObj);

    console.log('[handleNodeDataChange] oldFilename:', oldFilename, 'newFilename:', newFilename);

    // Check if filename needs to change (name was changed)
    if (oldFilename !== newFilename && oldFilename !== 'root_agent.yaml') {
      console.log('[handleNodeDataChange] Renaming file from', oldFilename, 'to', newFilename);
      try {
        // Call the rename API
        const response = await fetch(`/api/agents/${agentName}/files`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldFilename,
            newFilename,
            yaml: newYaml,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || 'Failed to rename agent file');
          return;
        }

        // Update files list with new filename
        setFiles(prev => prev.map(f =>
          f.filename === oldFilename ? { filename: newFilename, yaml: newYaml } : f
        ));
        setOriginalFiles(prev => prev.map(f =>
          f.filename === oldFilename ? { filename: newFilename, yaml: newYaml } : f
        ));

        // Update selected file if it was the renamed file
        if (selectedFile === oldFilename) {
          setSelectedFile(newFilename);
        }

        // Update the node's filename in the nodes state
        setNodes(prev => prev.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, filename: newFilename } } : n
        ));

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rename agent file');
        return;
      }
    } else {
      // No rename needed, just update the YAML content and save to disk
      try {
        const response = await fetch(`/api/agents/${agentName}/files`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: data.filename,
            yaml: newYaml,
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          setError(result.error || 'Failed to save agent file');
          return;
        }

        // Update local state after successful save
        setFiles(prev => prev.map(f =>
          f.filename === data.filename ? { ...f, yaml: newYaml } : f
        ));
        setOriginalFiles(prev => prev.map(f =>
          f.filename === data.filename ? { ...f, yaml: newYaml } : f
        ));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save agent file');
      }
    }
  }, [agentName, selectedFile]);

  // Handle agent dropped into container - add as sub_agent
  const handleAgentDroppedInContainer = useCallback(async (containerId: string, containerFilename: string, droppedAgentFilename: string) => {
    console.log('[handleAgentDroppedInContainer] Called:', { containerId, containerFilename, droppedAgentFilename });
    try {
      // Use the connections API to add the dropped agent as a sub_agent of the container
      const response = await fetch(`/api/agents/${agentName}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentFilename: containerFilename,
          childFilename: droppedAgentFilename,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to add agent to container');
        return;
      }

      // Refresh the files to update the UI using standard load function
      await loadFiles(false);
    } catch (err) {
      console.error('[handleAgentDroppedInContainer] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to add agent to container');
    }
  }, [agentName, loadFiles]); // Added loadFiles dependency

  // Handle adding a child agent via the plus button on an agent node
  const handleAddChildAgent = useCallback(async (
    parentNodeId: string,
    childAgentClass: ADKAgentClass,
    parentFilename: string
  ): Promise<{ filename: string; childNodeData: AgentNodeData } | null> => {
    console.log('[handleAddChildAgent] Called:', { parentNodeId, childAgentClass, parentFilename });

    // Generate expected filename for optimistic update
    const childName = `New ${childAgentClass.replace('Agent', '')}`;
    const snakeCaseName = childName.toLowerCase().replace(/\s+/g, '_');
    const expectedFilename = `${snakeCaseName}.yaml`;

    // OPTIMISTIC UPDATE: Add node to UI immediately
    const parentNode = nodes.find(n => n.id === parentNodeId);
    const parentPosition = parentNode?.position || { x: 250, y: 150 };

    const tempNodeId = `agent-${Date.now()}`;
    const newNodeData: AgentNodeData = {
      name: childName,
      agentClass: childAgentClass,
      model: childAgentClass === 'LlmAgent' ? 'gemini-2.0-flash-exp' : undefined,
      description: '',
      filename: expectedFilename,
      isRoot: false,
    };

    const newNode: Node = {
      id: tempNodeId,
      type: childAgentClass === 'LlmAgent' ? 'agent' : 'container',
      position: { x: parentPosition.x + 50, y: parentPosition.y + 200 },
      data: newNodeData,
    };

    // Add node and edge immediately
    const newEdge: Edge = {
      id: `edge-${parentNodeId}-${tempNodeId}`,
      source: parentNodeId,
      target: tempNodeId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#6b7280', strokeWidth: 2 },
    };

    setNodes(prev => [...prev, newNode]);
    setEdges(prev => [...prev, newEdge]);

    // Now make API calls in background
    try {
      // Create the child agent file
      const response = await fetch(`/api/agents/${agentName}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: childName,
          agentClass: childAgentClass,
          model: childAgentClass === 'LlmAgent' ? 'gemini-2.0-flash-exp' : undefined,
          description: '',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        // Rollback optimistic update
        setNodes(prev => prev.filter(n => n.id !== tempNodeId));
        setEdges(prev => prev.filter(e => e.id !== newEdge.id));
        setError(result.error || 'Failed to create child agent');
        return null;
      }

      // Update node with actual filename if different
      if (result.filename !== expectedFilename) {
        setNodes(prev => prev.map(n =>
          n.id === tempNodeId
            ? { ...n, data: { ...n.data, filename: result.filename } }
            : n
        ));
      }

      // Add the new file to local state
      const newFile = { filename: result.filename, yaml: result.yaml };
      setFiles(prev => [...prev, newFile]);
      setOriginalFiles(prev => [...prev, newFile]);

      // Add the child as a sub_agent of the parent (don't await, fire and forget)
      fetch(`/api/agents/${agentName}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentFilename: parentFilename,
          childFilename: result.filename,
        }),
      }).catch(err => {
        console.error('[handleAddChildAgent] Connection error:', err);
        // Don't rollback for connection errors - file was created successfully
      });

      // Return the info needed
      return {
        filename: result.filename,
        childNodeData: newNodeData,
      };
    } catch (err) {
      // Rollback optimistic update on error
      setNodes(prev => prev.filter(n => n.id !== tempNodeId));
      setEdges(prev => prev.filter(e => e.id !== newEdge.id));
      console.error('[handleAddChildAgent] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to add child agent');
      return null;
    }
  }, [agentName, nodes]); // Removed loadFiles dependency

  // Handle adding a sub-agent inside a container node via the plus button
  const handleAddSubAgent = useCallback(async (
    containerId: string,
    containerFilename: string,
    childAgentClass: string
  ): Promise<void> => {
    console.log('[handleAddSubAgent] Called:', { containerId, containerFilename, childAgentClass });
    try {
      // Create the sub-agent file
      const childName = `New ${childAgentClass.replace('Agent', '')}`;
      const response = await fetch(`/api/agents/${agentName}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: childName,
          agentClass: childAgentClass,
          model: childAgentClass === 'LlmAgent' ? 'gemini-2.0-flash-exp' : undefined,
          description: '',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to create sub-agent');
        return;
      }

      // Add as sub_agent to the container
      const connectResponse = await fetch(`/api/agents/${agentName}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentFilename: containerFilename,
          childFilename: result.filename,
        }),
      });

      const connectResult = await connectResponse.json();
      if (!connectResponse.ok) {
        setError(connectResult.error || 'Failed to add sub-agent to container');
        return;
      }

      // Refresh files using standard load function to preserve context
      await loadFiles(false);
    } catch (err) {
      console.error('[handleAddSubAgent] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to add sub-agent');
    }
  }, [agentName, loadFiles]); // Added loadFiles dependency

  // Handle removing an agent from a container
  const handleRemoveFromContainer = useCallback(async (
    containerFilename: string,
    childFilename: string
  ): Promise<void> => {
    console.log('[handleRemoveFromContainer] Called:', { containerFilename, childFilename });
    try {
      // Use the connections API to remove the child from the container's sub_agents
      const response = await fetch(`/api/agents/${agentName}/connections?parentFilename=${encodeURIComponent(containerFilename)}&childFilename=${encodeURIComponent(childFilename)}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to remove agent from container');
        return;
      }

      // Refresh files using standard load function
      await loadFiles(false);
    } catch (err) {
      console.error('[handleRemoveFromContainer] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove agent from container');
    }
  }, [agentName, loadFiles]); // Added loadFiles dependency

  // Handle saving a specific file (e.g. Python tool)
  const handleSaveFile = useCallback(async (filename: string, content: string) => {
    try {
      const response = await fetch(`/api/agents/${agentName}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, yaml: content }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to save ${filename}`);
      }

      setFiles(prev => prev.map(f =>
        f.filename === filename ? { ...f, yaml: content } : f
      ));
      setOriginalFiles(prev => prev.map(f =>
        f.filename === filename ? { ...f, yaml: content } : f
      ));
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    }
  }, [agentName]);

  // Handle save
  const handleSave = useCallback(async () => {
    setSaving(true);

    try {
      // Save all modified files
      for (const file of files) {
        const original = originalFiles.find(f => f.filename === file.filename);
        if (!original || original.yaml !== file.yaml) {
          const response = await fetch(`/api/agents/${agentName}/files`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.filename, yaml: file.yaml }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || `Failed to save ${file.filename}`);
          }
        }
      }

      setOriginalFiles([...files]);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [agentName, files, originalFiles]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    setFiles([...originalFiles]);
    const { nodes: parsedNodes, edges: parsedEdges } = agentFilesToNodes(originalFiles);
    setNodes(parsedNodes);
    setEdges(parsedEdges);
  }, [originalFiles]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <ComposeHeader
        displayName={displayName}
        filesCount={files.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showAIAssistant={showAIAssistant}
        onAIAssistantToggle={() => setShowAIAssistant(!showAIAssistant)}
        agentName={agentName}
        hasChanges={hasChanges}
        onDiscard={handleDiscard}
        onSave={handleSave}
        saving={saving}
        saveSuccess={saveSuccess}
        error={error}
        onErrorDismiss={() => setError(null)}
        onBack={() => router.push('/')}
        showToolRegistry={showToolRegistry}
        onToolRegistryToggle={() => setShowToolRegistry(!showToolRegistry)}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Visual Canvas */}
            {(viewMode === 'visual' || viewMode === 'split') && (
              <div className={`${viewMode === 'split' ? 'w-1/2 border-r border-gray-200' : 'flex-1'} flex flex-col`} style={{ height: 'calc(100vh - 140px)', minHeight: '500px' }}>
                {/* Tool Agent Context Banner */}
                {toolAgentContext && (
                  <div
                    data-testid="agent-tool-context"
                    className="bg-purple-50 border-b border-purple-200 px-4 py-3 flex items-center gap-3"
                  >
                    <button
                      data-testid="back-to-parent-button"
                      onClick={() => setToolAgentContext(null)}
                      className="px-3 py-1.5 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                      </svg>
                      Back to Main Agent
                    </button>
                    <div
                      data-testid="tool-agent-indicator"
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="font-medium text-purple-900">Tool Agent of: {toolAgentContext.parentName}</span>
                    </div>
                  </div>
                )}

                {/* Agent Composer */}
                <div className="flex-1">
                  <AgentComposer
                    projectName={agentName}
                    files={files}
                    onSaveFile={handleSaveFile}
                    initialNodes={nodes}
                    initialEdges={edges}
                    availableAgents={files.map(f => f.filename)}
                    onChange={handleCanvasChange}
                    onNodeSelect={handleNodeSelect}
                    onNodeCreate={handleNodeCreate}
                    onNodeDelete={handleNodeDelete}
                    onNodeDataChange={handleNodeDataChange}
                    onAgentDroppedInContainer={handleAgentDroppedInContainer}
                    onAddChildAgent={handleAddChildAgent}
                    onAddSubAgent={handleAddSubAgent}
                    onRemoveFromContainer={handleRemoveFromContainer}
                    onNavigateToAgent={(agentFilename, parentName) => {
                      // State-based navigation (no URL change)
                      setToolAgentContext({ filename: agentFilename, parentName });
                    }}
                    validationResults={validationResults}
                  />
                </div>
              </div>
            )}

            <YAMLEditorPanel
              viewMode={viewMode}
              files={files}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              yamlError={yamlError}
              validationError={validationError}
              circularDependencyWarning={circularDependencyWarning}
              currentYaml={currentYaml}
              onYamlChange={handleYamlChange}
            />

            <ToolRegistryPanel
              isOpen={showToolRegistry}
              onClose={() => setShowToolRegistry(false)}
              files={files}
              projectName={agentName}
              onEditTool={(filename, content) => {
                setEditingTool({ filename, content });
                setShowToolRegistry(false);
              }}
              onDeleteTool={async (filename) => {
                if (confirm(`Are you sure you want to delete ${filename}?`)) {
                  try {
                    const response = await fetch(`/api/agents/${agentName}/files?filename=${encodeURIComponent(filename)}`, {
                      method: 'DELETE',
                    });
                    if (response.ok) {
                      await loadFiles(false);
                    }
                  } catch (err) {
                    setError('Failed to delete tool');
                  }
                }
              }}
              onNavigateToAgent={(filename) => {
                setShowToolRegistry(false);
                setToolAgentContext({ filename, parentName: 'Registry' });
              }}
              onNewCustomTool={() => {
                setShowToolRegistry(false);
                setShowCreateTool(true);
              }}
            />

            <ToolEditorModal
              isOpen={!!editingTool}
              filename={editingTool?.filename || null}
              initialContent={editingTool?.content || ''}
              onClose={() => setEditingTool(null)}
              onSave={handleSaveFile}
            />

            <CreateToolModal
              isOpen={showCreateTool}
              onClose={() => setShowCreateTool(false)}
              onSubmit={handleForgeTool}
            />

            {/* AI Assistant Panel */}
            <AIAssistantPanel
              isOpen={showAIAssistant}
              projectName={agentName}
              currentAgents={nodes.map(n => {
                const data = n.data as AgentNodeData;
                return {
                  filename: data.filename || '',
                  name: data.name || '',
                  agentClass: data.agentClass || '',
                };
              })}
              selectedAgent={selectedNode ? {
                filename: (selectedNode.data as AgentNodeData).filename || '',
                name: (selectedNode.data as AgentNodeData).name || '',
              } : null}
              onRefreshNeeded={() => loadFiles(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}
