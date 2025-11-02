// OpenTelemetry integration for Volcano SDK
// Opt-in observability with traces and metrics

import { createRequire } from 'node:module';
import type { StepResult, LLMHandle, MCPHandle } from './volcano-sdk.js';

// Type-only imports - actual OTEL imports are dynamic
type Tracer = any;
type Span = any;
type Meter = any;
type Counter = any;
type Histogram = any;

export type VolcanoTelemetryConfig = {
  serviceName?: string;
  // Optional: OTLP endpoint (e.g., 'http://localhost:4318')
  // If provided, auto-configures OpenTelemetry exporters
  // If not provided, uses environment variables or global SDK configuration
  endpoint?: string;
  // Users can provide their own tracer/meter or we'll use global
  tracer?: Tracer;
  meter?: Meter;
  // Feature flags
  traces?: boolean;
  metrics?: boolean;
};

export type VolcanoTelemetry = {
  startAgentSpan: (stepCount: number, agentName?: string) => Span | null;
  startStepSpan: (parent: Span | null, stepIndex: number, stepType: string, stepPrompt?: string, stepName?: string, llm?: any) => Span | null;
  startLLMSpan: (parent: Span | null, llm: LLMHandle, prompt: string) => Span | null;
  startMCPSpan: (parent: Span | null, mcp: MCPHandle, operation: string) => Span | null;
  endSpan: (span: Span | null, result?: StepResult, error?: any) => void;
  recordMetric: (name: string, value: number, attributes?: Record<string, any>) => void;
  flush: () => Promise<void>;
};

let otelApi: any = null;
let hasOtelWarned = false;

function tryLoadOtel() {
  if (otelApi) return otelApi;
  
  try {
    // Dynamic import to avoid hard dependency
    // Use createRequire for ES module compatibility
    const require = createRequire(import.meta.url);
    otelApi = require('@opentelemetry/api');
    return otelApi;
  } catch {
    if (!hasOtelWarned) {
      console.warn('[Volcano] OpenTelemetry API not found. Install with: npm install @opentelemetry/api');
      hasOtelWarned = true;
    }
    return null;
  }
}

// Managed the lifecycle of OpenTelemetry SDK instances to ensure graceful shutdown.
const shutdownManager = {
  sdkInstances: [] as any[],
  isHookRegistered: false,
  isShuttingDown: false,

  // Registers a new SDK instance to be shutdown on process exit.
  add(sdk: any) {
    this.sdkInstances.push(sdk);
    this.registerHook();
  },
  
  // Register a single, global beforeExit hook to shut down all SDKs.
  registerHook() {
    if (this.isHookRegistered) return;
    this.isHookRegistered = true;
    process.on('beforeExit', async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      if (this.sdkInstances.length === 0) return;
      console.log(`[Volcano] Shutting down ${this.sdkInstances.length} OpenTelemetry SDK instance(s)...`);
      try {
        // Shut down all SDKs.
        await Promise.all(this.sdkInstances.map(sdk => sdk.shutdown()));
        console.log('[Volcano] OpenTelemetry SDKs shut down successfully.');
      } catch (err) {
        console.error('[Volcano] Error shutting down OpenTelemetry SDKs:', err);
      }
    });
  }
};

export function createVolcanoTelemetry(config: VolcanoTelemetryConfig = {}): VolcanoTelemetry {
  const otel = tryLoadOtel();
  if (!otel) {
    // Return no-op telemetry if OTEL not available
    return {
      startAgentSpan: () => null,
      startStepSpan: () => null,
      startLLMSpan: () => null,
      startMCPSpan: () => null,
      endSpan: () => {},
      recordMetric: () => {},
      flush: async () => {}
    };
  }
  
  const serviceName = config.serviceName || 'volcano-sdk';
  const enableTraces = config.traces !== false; // enabled by default
  const enableMetrics = config.metrics !== false;
  
  // Store SDK and metric reader references for flushing
  let sdk: any = null;
  let metricReader: any = null;
  
  // Auto-configure SDK if endpoint provided
  if (config.endpoint) {
    try {
      const require = createRequire(import.meta.url);
      const { NodeSDK } = require('@opentelemetry/sdk-node');
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
      const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
      const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
      
      // Create metric reader separately so we can flush it
      if (enableMetrics) {
        metricReader = new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ 
            url: `${config.endpoint}/v1/metrics`,
            timeoutMillis: 5000
          }),
          exportIntervalMillis: 5000,
          exportTimeoutMillis: 5000
        });
      }
      
      sdk = new NodeSDK({
        serviceName,
        traceExporter: enableTraces ? new OTLPTraceExporter({ 
          url: `${config.endpoint}/v1/traces`,
          timeoutMillis: 5000
        }) : undefined,
        metricReader
      });
      
      sdk.start();
      shutdownManager.add(sdk);

      console.log(`[Volcano] ✅ OpenTelemetry SDK started`);
      console.log(`[Volcano]    Traces → ${config.endpoint}/v1/traces`);
      console.log(`[Volcano]    Metrics → ${config.endpoint}/v1/metrics (every 5s)`);
    } catch (e) {
      console.warn('[Volcano] Failed to auto-configure OpenTelemetry SDK:', e);
      console.warn('[Volcano] Install dependencies: npm install @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http');
    }
  }
  
  // Get or create tracer
  const tracer = config.tracer || (enableTraces ? otel.trace.getTracer(serviceName, '0.1.0') : null);
  
  // Get or create meter
  const meter = config.meter || (enableMetrics ? otel.metrics.getMeter(serviceName, '0.1.0') : null);
  
  // Create metrics
  let agentDurationHistogram: Histogram | null = null;
  let stepDurationHistogram: Histogram | null = null;
  let llmCallsCounter: Counter | null = null;
  let mcpCallsCounter: Counter | null = null;
  let agentCallsCounter: Counter | null = null;
  let agentDelegationHistogram: Histogram | null = null;
  let errorsCounter: Counter | null = null;
  
  // Token metrics
  let llmTokensInputCounter: Counter | null = null;
  let llmTokensOutputCounter: Counter | null = null;
  let llmTokensTotalCounter: Counter | null = null;
  
  // Performance metrics
  let llmDurationHistogram: Histogram | null = null;
  let mcpToolDurationHistogram: Histogram | null = null;
  let timeToFirstTokenHistogram: Histogram | null = null;
  
  // Agent-specific metrics
  let agentTokensCounter: Counter | null = null;
  let agentExecutionCounter: Counter | null = null;
  let subAgentCallsCounter: Counter | null = null;
  
  // Workflow metrics
  let workflowStepCounter: Histogram | null = null;
  let retryCounter: Counter | null = null;
  let timeoutCounter: Counter | null = null;
  
  if (meter) {
    try {
      // Existing metrics
      agentDurationHistogram = meter.createHistogram('volcano.agent.duration', {
        description: 'Agent workflow duration',
        unit: 'ms'
      });
      stepDurationHistogram = meter.createHistogram('volcano.step.duration', {
        description: 'Individual step duration',
        unit: 'ms'
      });
      llmCallsCounter = meter.createCounter('volcano.llm.calls.total', {
        description: 'Total LLM API calls',
        unit: 'calls'
      });
      mcpCallsCounter = meter.createCounter('volcano.mcp.calls.total', {
        description: 'Total MCP tool calls',
        unit: 'calls'
      });
      agentCallsCounter = meter.createCounter('volcano.agent.calls.total', {
        description: 'Total sub-agent delegations',
        unit: 'calls'
      });
      agentDelegationHistogram = meter.createHistogram('volcano.agent.delegation.count', {
        description: 'Number of agents delegated to per step',
        unit: 'agents'
      });
      errorsCounter = meter.createCounter('volcano.errors.total', {
        description: 'Total errors by type',
        unit: 'errors'
      });
      
      // Token metrics
      llmTokensInputCounter = meter.createCounter('volcano.llm.tokens.input', {
        description: 'Input tokens sent to LLM',
        unit: 'tokens'
      });
      llmTokensOutputCounter = meter.createCounter('volcano.llm.tokens.output', {
        description: 'Output tokens generated by LLM',
        unit: 'tokens'
      });
      llmTokensTotalCounter = meter.createCounter('volcano.llm.tokens.total', {
        description: 'Total tokens (input + output)',
        unit: 'tokens'
      });
      
      // Performance metrics
      llmDurationHistogram = meter.createHistogram('volcano.llm.duration', {
        description: 'LLM API call duration',
        unit: 'ms'
      });
      mcpToolDurationHistogram = meter.createHistogram('volcano.mcp.tool.duration', {
        description: 'Individual MCP tool call duration',
        unit: 'ms'
      });
      timeToFirstTokenHistogram = meter.createHistogram('volcano.llm.time_to_first_token', {
        description: 'Time until first token from LLM',
        unit: 'ms'
      });
      
      // Agent-specific metrics
      agentTokensCounter = meter.createCounter('volcano.agent.tokens', {
        description: 'Tokens consumed by named agents',
        unit: 'tokens'
      });
      agentExecutionCounter = meter.createCounter('volcano.agent.executions', {
        description: 'Agent execution count by name',
        unit: 'executions'
      });
      subAgentCallsCounter = meter.createCounter('volcano.agent.subagent_calls', {
        description: 'Sub-agent calls with parent-child relationship',
        unit: 'calls'
      });
      
      // Workflow metrics
      workflowStepCounter = meter.createHistogram('volcano.workflow.steps', {
        description: 'Number of steps per workflow',
        unit: 'steps'
      });
      retryCounter = meter.createCounter('volcano.workflow.retries', {
        description: 'Retry attempts',
        unit: 'retries'
      });
      timeoutCounter = meter.createCounter('volcano.workflow.timeouts', {
        description: 'Timeout occurrences',
        unit: 'timeouts'
      });
    } catch (e) {
      console.warn('[Volcano] Failed to create metrics:', e);
    }
  }
  
  return {
    startAgentSpan(stepCount: number, agentName?: string): Span | null {
      if (!tracer) return null;
      
      try {
        return tracer.startSpan('agent.run', {
          attributes: {
            'agent.step_count': stepCount,
            'agent.name': agentName || 'anonymous',
            'volcano.version': '0.1.0'
          }
        });
      } catch (e) {
        console.warn('[Volcano] Failed to start agent span:', e);
        return null;
      }
    },
    
    startStepSpan(parent: Span | null, stepIndex: number, stepType: string, stepPrompt?: string, stepName?: string, llm?: any): Span | null {
      if (!tracer) return null;
      
      try {
        const ctx = parent ? otel.trace.setSpan(otel.context.active(), parent) : undefined;
        const attrs: Record<string, any> = {
          'step.index': stepIndex,
          'step.type': stepType
        };
        
        // Add optional step name for better debugging
        if (stepName) {
          attrs['step.name'] = stepName;
        }
        
        // Add step prompt preview (first 100 chars)
        if (stepPrompt) {
          attrs['step.prompt'] = stepPrompt.substring(0, 100);
        }
        
        // Add LLM information to step span
        if (llm) {
          attrs['llm.provider'] = (llm as any).id || 'unknown';
          attrs['llm.model'] = llm.model || 'unknown';
        }
        
        // Create descriptive span name: "Step 1: data-analysis" or "Step 1" or "step.execute"
        let spanName = 'step.execute';
        if (stepName) {
          spanName = `Step ${stepIndex + 1}: ${stepName}`;
        } else if (stepIndex >= 0) {
          spanName = `Step ${stepIndex + 1}`;
        }
        
        return tracer.startSpan(spanName, { attributes: attrs }, ctx);
      } catch (e) {
        console.warn('[Volcano] Failed to start step span:', e);
        return null;
      }
    },
    
    startLLMSpan(parent: Span | null, llm: LLMHandle, prompt: string): Span | null {
      if (!tracer) return null;
      
      try {
        const ctx = parent ? otel.trace.setSpan(otel.context.active(), parent) : undefined;
        return tracer.startSpan('llm.generate', {
          attributes: {
            'llm.provider': (llm as any).id || 'unknown',
            'llm.model': llm.model,
            'llm.prompt_length': prompt.length
          }
        }, ctx);
      } catch (e) {
        console.warn('[Volcano] Failed to start LLM span:', e);
        return null;
      }
    },
    
    startMCPSpan(parent: Span | null, mcp: MCPHandle, operation: string): Span | null {
      if (!tracer) return null;
      
      try {
        const ctx = parent ? otel.trace.setSpan(otel.context.active(), parent) : undefined;
        return tracer.startSpan(`mcp.${operation}`, {
          attributes: {
            'mcp.endpoint': mcp.url,
            'mcp.operation': operation,
            'mcp.has_auth': !!mcp.auth
          }
        }, ctx);
      } catch (e) {
        console.warn('[Volcano] Failed to start MCP span:', e);
        return null;
      }
    },
    
    endSpan(span: Span | null, result?: StepResult, error?: any): void {
      if (!span) return;
      
      try {
        if (error) {
          span.setStatus({ 
            code: otel.SpanStatusCode.ERROR, 
            message: error.message 
          });
          span.recordException(error);
        } else {
          span.setStatus({ code: otel.SpanStatusCode.OK });
          
          // Add result attributes
          if (result) {
            if (result.durationMs) span.setAttribute('duration_ms', result.durationMs);
            if (result.llmMs) span.setAttribute('llm.duration_ms', result.llmMs);
            if (result.toolCalls) span.setAttribute('mcp.tool_count', result.toolCalls.length);
          }
        }
        
        span.end();
      } catch (e) {
        console.warn('[Volcano] Failed to end span:', e);
      }
    },
    
    recordMetric(name: string, value: number, attributes: Record<string, any> = {}): void {
      if (process.env.VOLCANO_DEBUG_TELEMETRY) {
        console.log(`[Volcano Telemetry] Recording: ${name} = ${value}`, attributes);
      }
      try {
        // Core metrics
        if (name === 'agent.duration' && agentDurationHistogram) {
          agentDurationHistogram.record(value, attributes);
        } else if (name === 'step.duration' && stepDurationHistogram) {
          stepDurationHistogram.record(value, attributes);
        } else if (name === 'llm.call' && llmCallsCounter) {
          llmCallsCounter.add(1, attributes);
        } else if (name === 'mcp.call' && mcpCallsCounter) {
          mcpCallsCounter.add(1, attributes);
        } else if (name === 'agent.call' && agentCallsCounter) {
          agentCallsCounter.add(value, attributes);
        } else if (name === 'agent.delegation' && agentDelegationHistogram) {
          agentDelegationHistogram.record(value, attributes);
        } else if (name === 'error' && errorsCounter) {
          errorsCounter.add(1, attributes);
        }
        // Token metrics
        else if (name === 'llm.tokens.input' && llmTokensInputCounter) {
          llmTokensInputCounter.add(value, attributes);
        } else if (name === 'llm.tokens.output' && llmTokensOutputCounter) {
          llmTokensOutputCounter.add(value, attributes);
        } else if (name === 'llm.tokens.total' && llmTokensTotalCounter) {
          llmTokensTotalCounter.add(value, attributes);
        }
        // Performance metrics
        else if (name === 'llm.duration' && llmDurationHistogram) {
          llmDurationHistogram.record(value, attributes);
        } else if (name === 'mcp.tool.duration' && mcpToolDurationHistogram) {
          mcpToolDurationHistogram.record(value, attributes);
        } else if (name === 'llm.time_to_first_token' && timeToFirstTokenHistogram) {
          timeToFirstTokenHistogram.record(value, attributes);
        }
        // Agent-specific metrics
        else if (name === 'agent.tokens' && agentTokensCounter) {
          agentTokensCounter.add(value, attributes);
        } else if (name === 'agent.execution' && agentExecutionCounter) {
          agentExecutionCounter.add(1, attributes);
        } else if (name === 'agent.subagent_call' && subAgentCallsCounter) {
          subAgentCallsCounter.add(1, attributes);
        }
        // Workflow metrics
        else if (name === 'workflow.steps' && workflowStepCounter) {
          workflowStepCounter.record(value, attributes);
        } else if (name === 'workflow.retry' && retryCounter) {
          retryCounter.add(1, attributes);
        } else if (name === 'workflow.timeout' && timeoutCounter) {
          timeoutCounter.add(1, attributes);
        }
      } catch (e) {
        console.warn('[Volcano] Failed to record metric:', e);
      }
    },

    async flush() {
      // Flush both traces and metrics to backend
      try {
        // Flush metric reader directly (forceFlush on reader works, SDK doesn't have it)
        if (metricReader && typeof metricReader.forceFlush === 'function') {
          await metricReader.forceFlush();
          
          if (process.env.VOLCANO_DEBUG_TELEMETRY === 'true') {
            console.log('[Volcano] Metrics flushed via MetricReader');
          }
        } else if (process.env.VOLCANO_DEBUG_TELEMETRY === 'true') {
          console.log('[Volcano] No MetricReader to flush');
        }
        
        // Traces are auto-flushed by SpanProcessor, but we can try if SDK has it
        if (sdk) {
          const tracerProvider = sdk.getTracerProvider?.();
          if (tracerProvider && typeof tracerProvider.forceFlush === 'function') {
            await tracerProvider.forceFlush();
            
            if (process.env.VOLCANO_DEBUG_TELEMETRY === 'true') {
              console.log('[Volcano] Traces flushed via TracerProvider');
            }
          }
        }
      } catch (e) {
        console.warn('[Volcano] Failed to flush telemetry:', e);
      }
    }
  };
}

// No-op telemetry (when not configured)
export const noopTelemetry: VolcanoTelemetry = {
  startAgentSpan: () => null,
  startStepSpan: () => null,
  startLLMSpan: () => null,
  startMCPSpan: () => null,
  endSpan: () => {},
  recordMetric: () => {},
  flush: async () => {}
};
