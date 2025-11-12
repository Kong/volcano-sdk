// tests/mcp.registry.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  MCPRegistry, 
  createMCPRegistry, 
  loadMCPConfig,
  type MCPServerConfig 
} from '../src/mcp-registry.js';

describe('MCPRegistry', () => {
  let registry: MCPRegistry;

  beforeEach(() => {
    registry = createMCPRegistry();
  });

  afterEach(async () => {
    await registry.unregisterAll();
  });

  describe('register', () => {
    it('should register an HTTP MCP server', () => {
      const handle = registry.register({
        id: 'test-http',
        name: 'Test HTTP',
        transport: 'http',
        url: 'http://localhost:3000/mcp'
      });

      expect(handle).toBeDefined();
      expect(handle.id).toContain('mcp_');
      expect(handle.transport).toBe('http');
      expect(registry.has('test-http')).toBe(true);
    });

    it('should register a stdio MCP server', () => {
      const handle = registry.register({
        id: 'test-stdio',
        name: 'Test Stdio',
        transport: 'stdio',
        stdio: {
          command: 'node',
          args: ['test.js']
        }
      });

      expect(handle).toBeDefined();
      expect(handle.transport).toBe('stdio');
      expect(registry.has('test-stdio')).toBe(true);
    });

    it('should register with authentication', () => {
      const handle = registry.register({
        id: 'test-auth',
        name: 'Test Auth',
        transport: 'http',
        url: 'http://localhost:3000/mcp',
        auth: {
          type: 'bearer',
          token: 'test-token'
        }
      });

      expect(handle).toBeDefined();
      const registered = registry.get('test-auth');
      expect(registered?.config.auth?.type).toBe('bearer');
      expect(registered?.config.auth?.token).toBe('test-token');
    });

    it('should register with tags and description', () => {
      registry.register({
        id: 'test-tags',
        name: 'Test Tags',
        description: 'A test server',
        transport: 'http',
        url: 'http://localhost:3000/mcp',
        tags: ['test', 'example']
      });

      const server = registry.get('test-tags');
      expect(server?.description).toBe('A test server');
      expect(server?.config.tags).toEqual(['test', 'example']);
    });

    it('should throw error for duplicate ID', () => {
      registry.register({
        id: 'duplicate',
        name: 'First',
        transport: 'http',
        url: 'http://localhost:3000/mcp'
      });

      expect(() => {
        registry.register({
          id: 'duplicate',
          name: 'Second',
          transport: 'http',
          url: 'http://localhost:4000/mcp'
        });
      }).toThrow("already registered");
    });

    it('should throw error for HTTP server without URL', () => {
      expect(() => {
        registry.register({
          id: 'no-url',
          name: 'No URL',
          transport: 'http'
        } as MCPServerConfig);
      }).toThrow("requires a 'url' parameter");
    });

    it('should throw error for stdio server without config', () => {
      expect(() => {
        registry.register({
          id: 'no-stdio',
          name: 'No Stdio',
          transport: 'stdio'
        } as MCPServerConfig);
      }).toThrow("requires a 'stdio' configuration");
    });

    it('should register disabled server', () => {
      registry.register({
        id: 'disabled',
        name: 'Disabled Server',
        transport: 'http',
        url: 'http://localhost:3000/mcp',
        enabled: false
      });

      const server = registry.get('disabled');
      expect(server?.config.enabled).toBe(false);
      
      // Disabled servers should not appear in getHandles()
      const handles = registry.getHandles();
      expect(handles.length).toBe(0);
    });
  });

  describe('registerMany', () => {
    it('should register multiple servers', () => {
      const configs: MCPServerConfig[] = [
        {
          id: 'server1',
          name: 'Server 1',
          transport: 'http',
          url: 'http://localhost:3000/mcp'
        },
        {
          id: 'server2',
          name: 'Server 2',
          transport: 'http',
          url: 'http://localhost:4000/mcp'
        }
      ];

      const handles = registry.registerMany(configs);
      expect(handles.size).toBe(2);
      expect(registry.has('server1')).toBe(true);
      expect(registry.has('server2')).toBe(true);
    });

    it('should continue on individual errors', () => {
      const configs: MCPServerConfig[] = [
        {
          id: 'good1',
          name: 'Good 1',
          transport: 'http',
          url: 'http://localhost:3000/mcp'
        },
        {
          id: 'bad',
          name: 'Bad',
          transport: 'http'
          // Missing URL - should fail
        } as MCPServerConfig,
        {
          id: 'good2',
          name: 'Good 2',
          transport: 'http',
          url: 'http://localhost:5000/mcp'
        }
      ];

      const handles = registry.registerMany(configs);
      expect(handles.size).toBe(2);
      expect(registry.has('good1')).toBe(true);
      expect(registry.has('good2')).toBe(true);
      expect(registry.has('bad')).toBe(false);
    });
  });

  describe('get and getHandle', () => {
    beforeEach(() => {
      registry.register({
        id: 'test',
        name: 'Test Server',
        transport: 'http',
        url: 'http://localhost:3000/mcp'
      });
    });

    it('should get registered server', () => {
      const server = registry.get('test');
      expect(server).toBeDefined();
      expect(server?.id).toBe('test');
      expect(server?.name).toBe('Test Server');
    });

    it('should return undefined for non-existent server', () => {
      const server = registry.get('non-existent');
      expect(server).toBeUndefined();
    });

    it('should get handle directly', () => {
      const handle = registry.getHandle('test');
      expect(handle).toBeDefined();
      expect(handle?.transport).toBe('http');
    });

    it('should return undefined handle for non-existent server', () => {
      const handle = registry.getHandle('non-existent');
      expect(handle).toBeUndefined();
    });
  });

  describe('getHandles', () => {
    it('should return all enabled handles', () => {
      registry.register({
        id: 'enabled1',
        name: 'Enabled 1',
        transport: 'http',
        url: 'http://localhost:3000/mcp'
      });

      registry.register({
        id: 'enabled2',
        name: 'Enabled 2',
        transport: 'http',
        url: 'http://localhost:4000/mcp'
      });

      registry.register({
        id: 'disabled',
        name: 'Disabled',
        transport: 'http',
        url: 'http://localhost:5000/mcp',
        enabled: false
      });

      const handles = registry.getHandles();
      expect(handles.length).toBe(2);
    });

    it('should return empty array when no servers', () => {
      const handles = registry.getHandles();
      expect(handles).toEqual([]);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      registry.register({
        id: 'http1',
        name: 'HTTP 1',
        transport: 'http',
        url: 'http://localhost:3000/mcp',
        tags: ['weather', 'api']
      });

      registry.register({
        id: 'http2',
        name: 'HTTP 2',
        transport: 'http',
        url: 'http://localhost:4000/mcp',
        tags: ['calendar', 'api'],
        enabled: false
      });

      registry.register({
        id: 'stdio1',
        name: 'Stdio 1',
        transport: 'stdio',
        stdio: {
          command: 'node',
          args: ['test.js']
        },
        tags: ['files', 'local']
      });
    });

    it('should list all servers', () => {
      const servers = registry.list();
      expect(servers.length).toBe(3);
    });

    it('should filter by enabled only', () => {
      const servers = registry.list({ enabledOnly: true });
      expect(servers.length).toBe(2);
      expect(servers.every(s => s.config.enabled !== false)).toBe(true);
    });

    it('should filter by tags', () => {
      const apiServers = registry.list({ tags: ['api'] });
      expect(apiServers.length).toBe(2);

      const weatherServers = registry.list({ tags: ['weather'] });
      expect(weatherServers.length).toBe(1);
      expect(weatherServers[0].id).toBe('http1');
    });

    it('should filter by transport', () => {
      const httpServers = registry.list({ transport: 'http' });
      expect(httpServers.length).toBe(2);

      const stdioServers = registry.list({ transport: 'stdio' });
      expect(stdioServers.length).toBe(1);
    });

    it('should combine filters', () => {
      const servers = registry.list({
        enabledOnly: true,
        transport: 'http',
        tags: ['api']
      });
      
      expect(servers.length).toBe(1);
      expect(servers[0].id).toBe('http1');
    });
  });

  describe('has', () => {
    it('should return true for registered server', () => {
      registry.register({
        id: 'test',
        name: 'Test',
        transport: 'http',
        url: 'http://localhost:3000/mcp'
      });

      expect(registry.has('test')).toBe(true);
    });

    it('should return false for non-existent server', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      registry.register({
        id: 'test',
        name: 'Test Server',
        description: 'Original description',
        transport: 'http',
        url: 'http://localhost:3000/mcp',
        tags: ['test']
      });
    });

    it('should update enabled status', () => {
      const updated = registry.update('test', { enabled: false });
      expect(updated).toBe(true);

      const server = registry.get('test');
      expect(server?.config.enabled).toBe(false);
    });

    it('should update description', () => {
      const updated = registry.update('test', { 
        description: 'Updated description' 
      });
      expect(updated).toBe(true);

      const server = registry.get('test');
      expect(server?.description).toBe('Updated description');
      expect(server?.config.description).toBe('Updated description');
    });

    it('should update tags', () => {
      const updated = registry.update('test', { 
        tags: ['new', 'tags'] 
      });
      expect(updated).toBe(true);

      const server = registry.get('test');
      expect(server?.config.tags).toEqual(['new', 'tags']);
    });

    it('should return false for non-existent server', () => {
      const updated = registry.update('non-existent', { enabled: false });
      expect(updated).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should unregister a server', async () => {
      registry.register({
        id: 'test',
        name: 'Test',
        transport: 'http',
        url: 'http://localhost:3000/mcp'
      });

      const result = await registry.unregister('test');
      expect(result).toBe(true);
      expect(registry.has('test')).toBe(false);
    });

    it('should return false for non-existent server', async () => {
      const result = await registry.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('unregisterAll', () => {
    it('should unregister all servers', async () => {
      registry.register({
        id: 'test1',
        name: 'Test 1',
        transport: 'http',
        url: 'http://localhost:3000/mcp'
      });

      registry.register({
        id: 'test2',
        name: 'Test 2',
        transport: 'http',
        url: 'http://localhost:4000/mcp'
      });

      await registry.unregisterAll();
      
      expect(registry.list().length).toBe(0);
      expect(registry.has('test1')).toBe(false);
      expect(registry.has('test2')).toBe(false);
    });
  });

  describe('stats', () => {
    it('should return correct statistics', () => {
      registry.register({
        id: 'http1',
        name: 'HTTP 1',
        transport: 'http',
        url: 'http://localhost:3000/mcp'
      });

      registry.register({
        id: 'http2',
        name: 'HTTP 2',
        transport: 'http',
        url: 'http://localhost:4000/mcp',
        enabled: false
      });

      registry.register({
        id: 'stdio1',
        name: 'Stdio 1',
        transport: 'stdio',
        stdio: {
          command: 'node',
          args: ['test.js']
        }
      });

      const stats = registry.stats();
      expect(stats.total).toBe(3);
      expect(stats.enabled).toBe(2);
      expect(stats.disabled).toBe(1);
      expect(stats.http).toBe(2);
      expect(stats.stdio).toBe(1);
    });

    it('should return zeros for empty registry', () => {
      const stats = registry.stats();
      expect(stats.total).toBe(0);
      expect(stats.enabled).toBe(0);
      expect(stats.disabled).toBe(0);
      expect(stats.http).toBe(0);
      expect(stats.stdio).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all servers without cleanup', () => {
      registry.register({
        id: 'test',
        name: 'Test',
        transport: 'http',
        url: 'http://localhost:3000/mcp'
      });

      registry.clear();
      expect(registry.list().length).toBe(0);
    });
  });
});

describe('loadMCPConfig', () => {
  let registry: MCPRegistry;

  beforeEach(() => {
    registry = createMCPRegistry();
  });

  afterEach(async () => {
    await registry.unregisterAll();
  });

  it('should load servers from config object', () => {
    const config = {
      servers: [
        {
          id: 'server1',
          name: 'Server 1',
          transport: 'http' as const,
          url: 'http://localhost:3000/mcp'
        },
        {
          id: 'server2',
          name: 'Server 2',
          transport: 'http' as const,
          url: 'http://localhost:4000/mcp'
        }
      ]
    };

    const handles = loadMCPConfig(config);
    expect(handles.size).toBe(2);
  });

  it('should handle empty config', () => {
    const config = { servers: [] };
    const handles = loadMCPConfig(config);
    expect(handles.size).toBe(0);
  });
});

describe('createMCPRegistry', () => {
  it('should create isolated registries', () => {
    const registry1 = createMCPRegistry();
    const registry2 = createMCPRegistry();

    registry1.register({
      id: 'test1',
      name: 'Test 1',
      transport: 'http',
      url: 'http://localhost:3000/mcp'
    });

    registry2.register({
      id: 'test2',
      name: 'Test 2',
      transport: 'http',
      url: 'http://localhost:4000/mcp'
    });

    expect(registry1.has('test1')).toBe(true);
    expect(registry1.has('test2')).toBe(false);
    expect(registry2.has('test1')).toBe(false);
    expect(registry2.has('test2')).toBe(true);
  });
});

