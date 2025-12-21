import { NextRequest, NextResponse } from 'next/server';
import { executeADKAgentStream, getADKSession, createADKSession, updateADKSession, ADKRunEvent } from '@/lib/adk/client';
import { z } from 'zod';
import path from 'path';
import { auth } from '@/auth';

/**
 * Generate a human-readable summary for tool results
 * Instead of dumping raw JSON, we extract key info based on tool type
 */
function summarizeToolResult(toolName: string, result: unknown): string {
  if (!result || typeof result !== 'object') {
    return typeof result === 'string' ? result : 'Completed';
  }

  const r = result as Record<string, unknown>;

  // Handle common tool patterns
  switch (toolName) {
    case 'read_config_files':
    case 'builder_agent.tools.read_config_files.read_config_files': {
      const totalFiles = r.total_files ?? r.totalFiles ?? 0;
      const successfulReads = r.successful_reads ?? r.successfulReads ?? 0;
      if (r.success === false) {
        const errors = r.errors as string[] | undefined;
        return errors?.[0] ?? 'Failed to read files';
      }
      return `Read ${successfulReads}/${totalFiles} file${Number(totalFiles) !== 1 ? 's' : ''}`;
    }

    case 'write_config_files':
    case 'builder_agent.tools.write_config_files.write_config_files': {
      const totalFiles = r.total_files ?? r.totalFiles ?? 0;
      const successfulWrites = r.successful_writes ?? r.successfulWrites ?? 0;
      if (r.success === false) {
        // Extract validation errors if present
        const files = r.files as Record<string, { error?: string; validation_errors?: Array<{ message: string }> }> | undefined;
        if (files) {
          for (const [, fileResult] of Object.entries(files)) {
            if (fileResult.validation_errors?.[0]?.message) {
              return fileResult.validation_errors[0].message;
            }
            if (fileResult.error) {
              return fileResult.error;
            }
          }
        }
        return 'Failed to write files';
      }
      return `Wrote ${successfulWrites}/${totalFiles} file${Number(totalFiles) !== 1 ? 's' : ''}`;
    }

    case 'write_files':
    case 'builder_agent.tools.write_files.write_files': {
      const totalFiles = r.total_files ?? r.totalFiles ?? 0;
      const successfulWrites = r.successful_writes ?? r.successfulWrites ?? 0;
      if (r.success === false) {
        const errors = r.errors as string[] | undefined;
        return errors?.[0] ?? 'Failed to write files';
      }
      
      // If specific files are mentioned in the result, include them
      const files = r.files as string[] | undefined;
      if (files && files.length > 0) {
        return `Wrote ${files.join(', ')}`;
      }
      
      return `Wrote ${successfulWrites}/${totalFiles} file${Number(totalFiles) !== 1 ? 's' : ''}`;
    }

    case 'read_files':
    case 'builder_agent.tools.read_files.read_files': {
      const totalFiles = r.total_files ?? r.totalFiles ?? 0;
      const successfulReads = r.successful_reads ?? r.successfulReads ?? 0;
      return `Read ${successfulReads}/${totalFiles} file${Number(totalFiles) !== 1 ? 's' : ''}`;
    }

    case 'delete_files':
    case 'builder_agent.tools.delete_files.delete_files': {
      const totalFiles = r.total_files ?? r.totalFiles ?? 0;
      const successfulDeletes = r.successful_deletes ?? r.successfulDeletes ?? 0;
      return `Deleted ${successfulDeletes}/${totalFiles} file${Number(totalFiles) !== 1 ? 's' : ''}`;
    }

    case 'explore_project':
    case 'builder_agent.tools.explore_project.explore_project': {
      const projectInfo = r.project_info as { name?: string; total_files?: number } | undefined;
      if (projectInfo) {
        return `Found ${projectInfo.total_files ?? 0} files in ${projectInfo.name ?? 'project'}`;
      }
      return 'Explored project structure';
    }

    case 'search_adk_knowledge':
    case 'builder_agent.tools.search_adk_knowledge.search_adk_knowledge': {
      if (r.status === 'success') {
        const response = r.response as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
        if (response && response.length > 0) {
          return `Found ${response.length} result${response.length !== 1 ? 's' : ''} in ADK knowledge base`;
        }
      }
      return 'Searched ADK knowledge base';
    }

    case 'search_adk_source':
    case 'builder_agent.tools.search_adk_source.search_adk_source': {
      const matchCount = r.match_count ?? r.matchCount ?? 0;
      return `Found ${matchCount} match${Number(matchCount) !== 1 ? 'es' : ''} in ADK source`;
    }

    case 'cleanup_unused_files':
    case 'builder_agent.tools.cleanup_unused_files.cleanup_unused_files': {
      const unusedCount = (r.unused_files as unknown[] | undefined)?.length ?? 0;
      return unusedCount > 0 ? `Found ${unusedCount} unused file${unusedCount !== 1 ? 's' : ''}` : 'No unused files found';
    }

    default:
      // Generic success/failure message
      if (r.success === true) {
        return r.message as string ?? 'Completed successfully';
      } else if (r.success === false) {
        return r.error as string ?? r.message as string ?? 'Operation failed';
      }
      return 'Completed';
  }
}

// Get the base path for ADK agents
const ADK_AGENTS_BASE_PATH = process.env.ADK_AGENTS_BASE_PATH ||
  path.join(process.cwd(), 'adk-service', 'agents');

export const runtime = 'nodejs';

// Request schema matches what the frontend sends
const AssistantRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  sessionId: z.string().optional(),  // Optional session ID for conversation continuity
  context: z.object({
    agents: z.array(z.object({
      filename: z.string(),
      name: z.string(),
      agentClass: z.string(),
    })),
    selectedAgent: z.object({
      filename: z.string(),
      name: z.string(),
    }).nullable(),
  }),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: projectName } = await params;

  try {
    // Check auth
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // This route ALWAYS executes builder_agent (the AI Architect)
    // Use nickarinard@gmail.com for all builder_agent sessions (dogfooding)
    // This includes all sub-agents (forge_agent, google_search_agent, etc.) and tools
    const userId = 'nickarinard@gmail.com';

    const body = await request.json();
    const validation = AssistantRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const { message, context, sessionId: requestSessionId } = validation.data;

    // Build context string to inform the agent about the current visual state
    let systemContext = `Project: ${projectName}\n`;

    if (context.agents.length > 0) {
      systemContext += `Existing Agents (from Visual Builder):\n${context.agents.map(a => `- ${a.name} (${a.filename}) [${a.agentClass}]`).join('\n')}\n`;
    } else {
      systemContext += `Existing Agents: None\n`;
    }

    if (context.selectedAgent) {
      systemContext += `User Focus: ${context.selectedAgent.name} (${context.selectedAgent.filename})\n`;
    }

    // Combine into a single prompt for the builder agent
    // We prepend the context so the agent knows what to modify
    const fullMessage = `[System Context]\n${systemContext}\n\n[User Request]\n${message}`;

    // Execute the "builder_agent" running on the ADK Engine
    // Use the session ID from the frontend (managed per conversation)
    // Falls back to a project-based ID if not provided (for backwards compatibility)
    const sessionId = requestSessionId || `builder-${projectName}`;

    console.log(`[Assistant] Calling builder_agent for project ${projectName}...`);

    // Ensure session exists and has root_directory set for the project
    // This tells Google's tools where to read/write files
    const projectPath = path.join(ADK_AGENTS_BASE_PATH, projectName);

    // Check if session exists, create if not
    let adkSession = await getADKSession('builder_agent', userId, sessionId);
    if (!adkSession) {
      console.log(`[Assistant] Creating new session ${sessionId}...`);
      adkSession = await createADKSession('builder_agent', userId, sessionId);
    }

    // Update session state with root_directory pointing to the project folder
    // Google's tools (write_config_files, explore_project, etc.) use this to resolve paths
    console.log(`[Assistant] Setting root_directory to ${projectPath}...`);
    
    // Set for builder_agent
    await updateADKSession('builder_agent', userId, sessionId, {
      root_directory: projectPath
    });

    // ALSO set for forge_agent explicitly to ensure sub-agent tools work correctly
    // Check if session exists for forge_agent, create if not
    let forgeSession = await getADKSession('forge_agent', userId, sessionId);
    if (!forgeSession) {
      console.log(`[Assistant] Creating new forge_agent session ${sessionId}...`);
      await createADKSession('forge_agent', userId, sessionId);
    }
    
    await updateADKSession('forge_agent', userId, sessionId, {
      root_directory: projectPath
    });

    const stream = executeADKAgentStream(
      'builder_agent', // Must match name in builder_agent.yaml
      fullMessage,
      {
        sessionId,
        userId,
      }
    );

    // Create a TransformStream to process the ADK events and pipe them to the client
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        let streamResult;

        try {
          while (true) {
            const { done, value } = await stream.next();
            if (done) {
              streamResult = value;
              break;
            }

            if (value.type === 'text') {
              fullResponse += value.content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: value.content })}\n\n`));
            } else if (value.type === 'tool_call') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', tool: value.tool, args: value.args })}\n\n`));
            } else if (value.type === 'tool_response') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_response', tool: value.tool, response: value.response })}\n\n`));
            }
          }

          // After text stream is done, streamResult contains the final tool calls and events
          const executedActions = (streamResult.toolCalls || []).map(tc => ({
            tool: tc.name,
            args: tc.args,
            result: {
              success: tc.status === 'success',
              message: summarizeToolResult(tc.name, tc.result),
              data: typeof tc.result === 'object' ? tc.result as Record<string, unknown> : undefined
            }
          }));

          // Send the final summary and actions
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'done', 
            response: fullResponse,
            executedActions,
            isComplete: executedActions.some(a => a.tool === 'task_complete' && a.result.success),
            sessionId: streamResult.sessionId
          })}\n\n`));

        } catch (error) {
          console.error('[Assistant Stream Error]:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(error) })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[Assistant] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}