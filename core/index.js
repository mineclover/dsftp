/**
 * SFTP Manager Core API
 * Framework-agnostic API for managing SFTP containers
 *
 * This module provides a unified API that can be used by:
 * - CLI (commander.js)
 * - TUI (inquirer)
 * - GUI (Tauri/Electron via IPC)
 */

import * as docker from './docker.js';
import * as config from './config.js';

export { docker, config };

/**
 * @typedef {Object} CreateServerOptions
 * @property {string} name - Container name
 * @property {number} port - SFTP port
 * @property {string} hostPath - Host folder path
 * @property {string} [containerPath='/home/user/files'] - Container mount path
 * @property {string} username - SFTP username
 * @property {string} [password] - SFTP password (auto-generated if empty)
 * @property {number} [uid=1001] - User ID
 */

/**
 * @typedef {Object} ServerInfo
 * @property {string} name
 * @property {number} port
 * @property {string} hostPath
 * @property {string} containerPath
 * @property {string} username
 * @property {string} password
 * @property {'running' | 'stopped' | 'not created'} status
 * @property {string} createdAt
 */

/**
 * @typedef {Object} ConnectionInfo
 * @property {string} host
 * @property {number} port
 * @property {string} username
 * @property {string} password
 * @property {string} command - SFTP command
 * @property {string} url - SFTP URL (FileZilla format)
 */

// ============================================================
// Server Management API
// ============================================================

/**
 * Create a new SFTP server
 * @param {CreateServerOptions} options
 * @returns {Promise<{success: boolean, server?: ServerInfo, error?: string}>}
 */
export async function createServer(options) {
  // Validate Docker
  if (!docker.checkDocker()) {
    return { success: false, error: 'Docker is not available' };
  }

  // Generate password if not provided
  const password = options.password || config.generatePassword(12);

  // Set defaults
  const serverConfig = {
    name: options.name,
    port: options.port || config.findAvailablePort(),
    hostPath: options.hostPath,
    containerPath: options.containerPath || '/home/user/files',
    username: options.username,
    password,
    uid: options.uid || 1001
  };

  // Create container
  const result = docker.createContainer(serverConfig);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Save to config
  const saveResult = config.addServer(serverConfig);
  if (!saveResult.success) {
    // Rollback: remove container
    docker.removeContainer(serverConfig.name);
    return { success: false, error: saveResult.error };
  }

  return {
    success: true,
    server: {
      ...serverConfig,
      status: 'running',
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * List all servers with status
 * @returns {Promise<ServerInfo[]>}
 */
export async function listServers() {
  const servers = config.getAllServers();

  return servers.map(server => ({
    ...server,
    status: docker.getContainerStatus(server.name)
  }));
}

/**
 * Get server details
 * @param {string} name - Server name
 * @returns {Promise<ServerInfo | null>}
 */
export async function getServer(name) {
  const server = config.getServer(name);
  if (!server) return null;

  return {
    ...server,
    status: docker.getContainerStatus(name)
  };
}

/**
 * Start a server
 * @param {string} name - Server name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function startServer(name) {
  return docker.startContainer(name);
}

/**
 * Stop a server
 * @param {string} name - Server name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function stopServer(name) {
  return docker.stopContainer(name);
}

/**
 * Remove a server (container + config)
 * @param {string} name - Server name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function removeServer(name) {
  // Remove container first
  const dockerResult = docker.removeContainer(name);

  // Remove from config (even if container removal failed)
  const configResult = config.removeServer(name);

  if (!dockerResult.success && !configResult.success) {
    return { success: false, error: 'Failed to remove server' };
  }

  return { success: true };
}

/**
 * Start all servers
 * @returns {Promise<{total: number, started: number, failed: string[]}>}
 */
export async function startAllServers() {
  const servers = config.getAllServers();
  const failed = [];

  for (const server of servers) {
    const result = docker.startContainer(server.name);
    if (!result.success) {
      failed.push(server.name);
    }
  }

  return {
    total: servers.length,
    started: servers.length - failed.length,
    failed
  };
}

/**
 * Stop all servers
 * @returns {Promise<{total: number, stopped: number, failed: string[]}>}
 */
export async function stopAllServers() {
  const servers = config.getAllServers();
  const failed = [];

  for (const server of servers) {
    const result = docker.stopContainer(server.name);
    if (!result.success) {
      failed.push(server.name);
    }
  }

  return {
    total: servers.length,
    stopped: servers.length - failed.length,
    failed
  };
}

// ============================================================
// Connection Info API
// ============================================================

/**
 * Get connection info for a server
 * @param {string} name - Server name
 * @returns {Promise<ConnectionInfo | null>}
 */
export async function getConnectionInfo(name) {
  const server = config.getServer(name);
  if (!server) return null;

  const host = docker.getLocalIP();

  return {
    host,
    port: server.port,
    username: server.username,
    password: server.password,
    command: `sftp -P ${server.port} ${server.username}@${host}`,
    url: `sftp://${server.username}:${server.password}@${host}:${server.port}`
  };
}

/**
 * Format connection info for clipboard
 * @param {string} name - Server name
 * @param {'full' | 'command' | 'url' | 'password'} format
 * @returns {Promise<string | null>}
 */
export async function formatConnectionInfo(name, format = 'full') {
  const info = await getConnectionInfo(name);
  if (!info) return null;

  switch (format) {
    case 'full':
      return `Host: ${info.host}\nPort: ${info.port}\nUser: ${info.username}\nPass: ${info.password}`;
    case 'command':
      return info.command;
    case 'url':
      return info.url;
    case 'password':
      return info.password;
    default:
      return null;
  }
}

// ============================================================
// System API
// ============================================================

/**
 * Check system status
 * @returns {Promise<{docker: boolean, ip: string, configPath: string}>}
 */
export async function getSystemStatus() {
  return {
    docker: docker.checkDocker(),
    ip: docker.getLocalIP(),
    configPath: config.loadConfig() ? 'OK' : 'Error'
  };
}

/**
 * Get server logs
 * @param {string} name - Server name
 * @param {number} [lines=50] - Number of lines
 * @returns {Promise<string>}
 */
export async function getServerLogs(name, lines = 50) {
  return docker.getContainerLogs(name, lines);
}
