import { NextRequest, NextResponse } from 'next/server';
import { executeADKAgent } from '@/lib/adk/client';
import { z } from 'zod';

export const runtime = 'nodejs';

// Request schema matches what the frontend sends
const AssistantRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
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
    const body = await request.json();
    const validation = AssistantRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const { message, context } = validation.data;

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
    // We use a persistent session ID per project to maintain conversation history
    const sessionId = `builder-${projectName}`;

    console.log(`[Assistant] Calling builder_agent for project ${projectName}...`);

    const result = await executeADKAgent(
      'builder_agent', // Must match name in builder_agent.yaml
      fullMessage,
      {
        sessionId,
        // Optional: Pass userId if we want multi-user separation within the project
      }
    );

    console.log(`[Assistant] builder_agent response received.`);

    // Map ADK Tool Calls to the frontend's "ExecutedAction" format
    // The frontend uses this to display "✓ Created agent" chips
    const executedActions = (result.toolCalls || []).map(tc => ({
      tool: tc.name,
      args: tc.args,
      result: {
        success: tc.status === 'success',
        // If result is object, stringify it for display, else use direct
        message: typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result),
        data: typeof tc.result === 'object' ? tc.result as Record<string, unknown> : undefined
      }
    }));

    // Determine completion status
    // If the agent called "task_complete", mark as complete
    const isComplete = executedActions.some(a => a.tool === 'task_complete' && a.result.success);

    return NextResponse.json({
      response: result.response, // The text response from the LLM
      executedActions,
      isComplete
    });

  } catch (error) {
    console.error('[Assistant] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}