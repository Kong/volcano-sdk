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
  // Users can provide their own tracer/meter or we'll use global
  tracer?: Tracer;
  meter?: Meter;
  // Feature flags
  traces?: boolean;
  metrics?: boolean;
  // Note: For exporters, users should configure the global OTEL SDK
  // See: https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
  // Example:
  //   import { NodeSDK } from '@opentelemetry/sdk-node';
  //   import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
  //   const sdk = new NodeSDK({
  //     serviceName: 'my-service',
  //     traceExporter: new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' })
  //   });
  //   sdk.start();
};

export type VolcanoTelemetry = {
  startAgentSpan: (stepCount: number) => Span | null;
  startStepSpan: (parent: Span | null, stepIndex: number, stepType: string) => Span | null;
  startLLMSpan: (parent: Span | null, llm: LLMHandle, prompt: string) => Span | null;
  startMCPSpan: (parent: Span | null, mcp: MCPHandle, operation: string) => Span | null;
  endSpan: (span: Span | null, result?: StepResult, error?: any) => void;
  recordMetric: (name: string, value: number, attributes?: Record<string, any>) => void;
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
      recordMetric: () => {}
    };
  }
  
  const serviceName = config.serviceName || 'volcano-sdk';
  const enableTraces = config.traces !== false; // enabled by default
  const enableMetrics = config.metrics !== false;
  
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
  
  if (meter) {
    try {
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
    } catch (e) {
      console.warn('[Volcano] Failed to create metrics:', e);
    }
  }
  
  return {
    startAgentSpan(stepCount: number): Span | null {
      if (!tracer) return null;
      
      try {
        return tracer.startSpan('agent.run', {
          attributes: {
            'agent.step_count': stepCount,
            'volcano.version': '0.1.0'
          }
        });
      } catch (e) {
        console.warn('[Volcano] Failed to start agent span:', e);
        return null;
      }
    },
    
    startStepSpan(parent: Span | null, stepIndex: number, stepType: string): Span | null {
      if (!tracer) return null;
      
      try {
        const ctx = parent ? otel.trace.setSpan(otel.context.active(), parent) : undefined;
        return tracer.startSpan('step.execute', {
          attributes: {
            'step.index': stepIndex,
            'step.type': stepType
          }
        }, ctx);
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
      try {
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
      } catch (e) {
        console.warn('[Volcano] Failed to record metric:', e);
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
  recordMetric: () => {}
};
