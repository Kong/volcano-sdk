// src/mcp-registry.ts
import { MCPHandle, MCPAuthConfig, mcp as createMCPHttp, mcpStdio as createMCPStdio, MCPStdioConfig } from "./volcano-sdk.js";

/**
 * Configuration for a custom MCP server.
 * Supports both HTTP and stdio transports.
 */
export type MCPServerConfig = {
  /** Unique identifier for this MCP server */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** Transport type */
  transport: 'http' | 'stdio';
  /** HTTP endpoint URL (required for HTTP transport) */
  url?: string;
  /** Stdio configuration (required for stdio transport) */
  stdio?: MCPStdioConfig;
  /** Optional authentication configuration */
  auth?: MCPAuthConfig;
  /** Optional tags for categorization */
  tags?: string[];
  /** Whether this server is enabled (default: true) */
  enabled?: boolean;
};

/**
 * Represents a registered MCP server with its handle and metadata.
 */
export type RegisteredMCP = {
  id: string;
  name: string;
  description?: string;
  handle: MCPHandle;
  config: MCPServerConfig;
};

/**
 * Registry for managing custom MCP servers in a modular way.
 * Allows registration, discovery, and lifecycle management of MCP servers.
 * 
 * @example
 * // Register a custom HTTP MCP
 * mcpRegistry.register({
 *   id: 'weather-api',
 *   name: 'Weather Service',
 *   transport: 'http',
 *   url: 'http://localhost:3000/mcp',
 *   tags: ['weather', 'forecast']
 * });
 * 
 * @example
 * // Register a custom stdio MCP
 * mcpRegistry.register({
 *   id: 'local-tool',
 *   name: 'Local Tools',
 *   transport: 'stdio',
 *   stdio: {
 *     command: 'node',
 *     args: ['./my-tool.js']
 *   }
 * });
 * 
 * @example
 * // Get all registered MCPs
 * const allMCPs = mcpRegistry.list();
 * const handles = mcpRegistry.getHandles();
 */
export class MCPRegistry {
  private servers: Map<string, RegisteredMCP> = new Map();
  
  /**
   * Register a custom MCP server.
   * 
   * @param config - MCP server configuration
   * @returns The created MCPHandle for immediate use
   * @throws Error if server with same ID already exists
   * 
   * @example
   * const weatherHandle = mcpRegistry.register({
   *   id: 'weather',
   *   name: 'Weather API',
   *   transport: 'http',
   *   url: 'http://localhost:3000/mcp'
   * });
   */
  register(config: MCPServerConfig): MCPHandle {
    if (this.servers.has(config.id)) {
      throw new Error(`MCP server with id '${config.id}' is already registered`);
    }
    
    // Default to enabled
    const enabled = config.enabled !== false;
    if (!enabled) {
      console.warn(`MCP server '${config.id}' is registered but disabled`);
    }
    
    // Validate configuration
    if (config.transport === 'http' && !config.url) {
      throw new Error(`HTTP MCP server '${config.id}' requires a 'url' parameter`);
    }
    
    if (config.transport === 'stdio' && !config.stdio) {
      throw new Error(`Stdio MCP server '${config.id}' requires a 'stdio' configuration`);
    }
    
    // Create the appropriate MCP handle
    let handle: MCPHandle;
    if (config.transport === 'http') {
      handle = createMCPHttp(config.url!, { auth: config.auth });
    } else {
      handle = createMCPStdio(config.stdio!);
    }
    
    // Store in registry
    const registered: RegisteredMCP = {
      id: config.id,
      name: config.name,
      description: config.description,
      handle,
      config
    };
    
    this.servers.set(config.id, registered);
    
    return handle;
  }
  
  /**
   * Register multiple MCP servers at once.
   * Useful for bulk registration from configuration files.
   * 
   * @param configs - Array of MCP server configurations
   * @returns Map of server IDs to their handles
   * 
   * @example
   * const handles = mcpRegistry.registerMany([
   *   { id: 'weather', name: 'Weather', transport: 'http', url: 'http://localhost:3000' },
   *   { id: 'calendar', name: 'Calendar', transport: 'http', url: 'http://localhost:4000' }
   * ]);
   */
  registerMany(configs: MCPServerConfig[]): Map<string, MCPHandle> {
    const handles = new Map<string, MCPHandle>();
    
    for (const config of configs) {
      try {
        const handle = this.register(config);
        handles.set(config.id, handle);
      } catch (error) {
        console.error(`Failed to register MCP '${config.id}':`, error);
      }
    }
    
    return handles;
  }
  
  /**
   * Get a registered MCP server by ID.
   * 
   * @param id - Server ID
   * @returns Registered MCP or undefined if not found
   * 
   * @example
   * const weather = mcpRegistry.get('weather-api');
   * if (weather) {
   *   const tools = await weather.handle.listTools();
   * }
   */
  get(id: string): RegisteredMCP | undefined {
    return this.servers.get(id);
  }
  
  /**
   * Get the MCPHandle for a registered server.
   * 
   * @param id - Server ID
   * @returns MCPHandle or undefined if not found
   * 
   * @example
   * const weatherHandle = mcpRegistry.getHandle('weather-api');
   */
  getHandle(id: string): MCPHandle | undefined {
    return this.servers.get(id)?.handle;
  }
  
  /**
   * Get all registered MCPHandles (only enabled servers).
   * 
   * @returns Array of all registered MCPHandles
   * 
   * @example
   * const agent = agent({ llm })
   *   .then({ 
   *     prompt: 'Do something', 
   *     mcps: mcpRegistry.getHandles() 
   *   })
   *   .run();
   */
  getHandles(): MCPHandle[] {
    return Array.from(this.servers.values())
      .filter(server => server.config.enabled !== false)
      .map(server => server.handle);
  }
  
  /**
   * List all registered MCP servers.
   * 
   * @param options - Filtering options
   * @returns Array of registered MCPs
   * 
   * @example
   * // Get all servers
   * const all = mcpRegistry.list();
   * 
   * @example
   * // Get only enabled servers
   * const enabled = mcpRegistry.list({ enabledOnly: true });
   * 
   * @example
   * // Get servers with specific tag
   * const weather = mcpRegistry.list({ tags: ['weather'] });
   */
  list(options?: { 
    enabledOnly?: boolean; 
    tags?: string[];
    transport?: 'http' | 'stdio';
  }): RegisteredMCP[] {
    let servers = Array.from(this.servers.values());
    
    if (options?.enabledOnly) {
      servers = servers.filter(s => s.config.enabled !== false);
    }
    
    if (options?.tags && options.tags.length > 0) {
      servers = servers.filter(s => 
        s.config.tags?.some(tag => options.tags!.includes(tag))
      );
    }
    
    if (options?.transport) {
      servers = servers.filter(s => s.config.transport === options.transport);
    }
    
    return servers;
  }
  
  /**
   * Check if a server is registered.
   * 
   * @param id - Server ID
   * @returns true if server is registered
   */
  has(id: string): boolean {
    return this.servers.has(id);
  }
  
  /**
   * Unregister an MCP server and cleanup resources.
   * 
   * @param id - Server ID to unregister
   * @returns true if server was found and unregistered
   * 
   * @example
   * await mcpRegistry.unregister('weather-api');
   */
  async unregister(id: string): Promise<boolean> {
    const server = this.servers.get(id);
    if (!server) return false;
    
    // Cleanup stdio process if applicable
    if (server.handle.cleanup) {
      try {
        await server.handle.cleanup();
      } catch (error) {
        console.error(`Failed to cleanup MCP '${id}':`, error);
      }
    }
    
    this.servers.delete(id);
    return true;
  }
  
  /**
   * Unregister all MCP servers and cleanup resources.
   * Useful for graceful shutdown.
   * 
   * @example
   * // Cleanup on process exit
   * process.on('SIGTERM', async () => {
   *   await mcpRegistry.unregisterAll();
   *   process.exit(0);
   * });
   */
  async unregisterAll(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];
    
    for (const [id, server] of this.servers.entries()) {
      if (server.handle.cleanup) {
        cleanupPromises.push(
          server.handle.cleanup().catch(err => {
            console.error(`Failed to cleanup MCP '${id}':`, err);
          })
        );
      }
    }
    
    await Promise.all(cleanupPromises);
    this.servers.clear();
  }
  
  /**
   * Update server configuration (e.g., enable/disable).
   * Note: This does not recreate the handle, only updates metadata.
   * 
   * @param id - Server ID
   * @param updates - Partial configuration to update
   * @returns true if server was found and updated
   * 
   * @example
   * // Disable a server temporarily
   * mcpRegistry.update('weather-api', { enabled: false });
   */
  update(id: string, updates: Partial<Pick<MCPServerConfig, 'enabled' | 'description' | 'tags'>>): boolean {
    const server = this.servers.get(id);
    if (!server) return false;
    
    server.config = { ...server.config, ...updates };
    if (updates.description !== undefined) {
      server.description = updates.description;
    }
    
    return true;
  }
  
  /**
   * Get registry statistics.
   * 
   * @returns Registry statistics
   * 
   * @example
   * const stats = mcpRegistry.stats();
   * console.log(`Registered: ${stats.total}, Enabled: ${stats.enabled}`);
   */
  stats(): {
    total: number;
    enabled: number;
    disabled: number;
    http: number;
    stdio: number;
  } {
    const all = Array.from(this.servers.values());
    return {
      total: all.length,
      enabled: all.filter(s => s.config.enabled !== false).length,
      disabled: all.filter(s => s.config.enabled === false).length,
      http: all.filter(s => s.config.transport === 'http').length,
      stdio: all.filter(s => s.config.transport === 'stdio').length
    };
  }
  
  /**
   * Clear all registered servers without cleanup.
   * Use unregisterAll() for proper cleanup.
   */
  clear(): void {
    this.servers.clear();
  }
}

/**
 * Global MCP registry instance.
 * Use this to register and manage custom MCP servers.
 * 
 * @example
 * import { mcpRegistry } from 'volcano-sdk';
 * 
 * mcpRegistry.register({
 *   id: 'my-custom-mcp',
 *   name: 'My Custom MCP',
 *   transport: 'http',
 *   url: 'http://localhost:3000/mcp'
 * });
 */
export const mcpRegistry = new MCPRegistry();

/**
 * Load MCP servers from a configuration object.
 * Convenient for loading from JSON/ENV files.
 * 
 * @param config - Configuration object with servers array
 * @returns Map of server IDs to handles
 * 
 * @example
 * const config = {
 *   servers: [
 *     { id: 'weather', name: 'Weather', transport: 'http', url: 'http://localhost:3000' },
 *     { id: 'calendar', name: 'Calendar', transport: 'http', url: 'http://localhost:4000' }
 *   ]
 * };
 * 
 * const handles = loadMCPConfig(config);
 */
export function loadMCPConfig(config: { servers: MCPServerConfig[] }): Map<string, MCPHandle> {
  return mcpRegistry.registerMany(config.servers);
}

/**
 * Create a new isolated MCP registry.
 * Useful for testing or when you need multiple independent registries.
 * 
 * @returns New MCPRegistry instance
 * 
 * @example
 * const testRegistry = createMCPRegistry();
 * testRegistry.register({ ... });
 */
export function createMCPRegistry(): MCPRegistry {
  return new MCPRegistry();
}

