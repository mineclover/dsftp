/**
 * Configuration Management Module
 * Handles server configuration persistence
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'sftp-config.json');

/**
 * @typedef {Object} ServerConfig
 * @property {string} name - Container name
 * @property {number} port - SFTP port
 * @property {string} hostPath - Host folder path
 * @property {string} containerPath - Container mount path
 * @property {string} username - SFTP username
 * @property {string} password - SFTP password
 * @property {number} uid - User ID
 * @property {string} createdAt - ISO date string
 */

/**
 * @typedef {Object} Config
 * @property {ServerConfig[]} servers
 */

/**
 * Load configuration from file
 * @returns {Config}
 */
export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Config load error:', error.message);
  }
  return { servers: [] };
}

/**
 * Save configuration to file
 * @param {Config} config
 * @returns {{success: boolean, error?: string}}
 */
export function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Add a new server to configuration
 * @param {Omit<ServerConfig, 'createdAt'>} server
 * @returns {{success: boolean, error?: string}}
 */
export function addServer(server) {
  const config = loadConfig();

  // Check for duplicate name
  if (config.servers.find(s => s.name === server.name)) {
    return { success: false, error: 'Server name already exists' };
  }

  // Check for duplicate port
  if (config.servers.find(s => s.port === server.port)) {
    return { success: false, error: 'Port already in use' };
  }

  config.servers.push({
    ...server,
    createdAt: new Date().toISOString()
  });

  return saveConfig(config);
}

/**
 * Remove a server from configuration
 * @param {string} name - Server name
 * @returns {{success: boolean, error?: string}}
 */
export function removeServer(name) {
  const config = loadConfig();
  const initialLength = config.servers.length;
  config.servers = config.servers.filter(s => s.name !== name);

  if (config.servers.length === initialLength) {
    return { success: false, error: 'Server not found' };
  }

  return saveConfig(config);
}

/**
 * Get a server by name
 * @param {string} name - Server name
 * @returns {ServerConfig | undefined}
 */
export function getServer(name) {
  const config = loadConfig();
  return config.servers.find(s => s.name === name);
}

/**
 * Get all servers
 * @returns {ServerConfig[]}
 */
export function getAllServers() {
  const config = loadConfig();
  return config.servers;
}

/**
 * Update a server configuration
 * @param {string} name - Server name
 * @param {Partial<ServerConfig>} updates
 * @returns {{success: boolean, error?: string}}
 */
export function updateServer(name, updates) {
  const config = loadConfig();
  const index = config.servers.findIndex(s => s.name === name);

  if (index === -1) {
    return { success: false, error: 'Server not found' };
  }

  config.servers[index] = { ...config.servers[index], ...updates };
  return saveConfig(config);
}

/**
 * Generate a random password
 * @param {number} [length=16] - Password length
 * @returns {string}
 */
export function generatePassword(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

/**
 * Find next available port
 * @param {number} [startPort=2222] - Starting port
 * @returns {number}
 */
export function findAvailablePort(startPort = 2222) {
  const config = loadConfig();
  const usedPorts = new Set(config.servers.map(s => s.port));

  let port = startPort;
  while (usedPorts.has(port)) {
    port++;
  }
  return port;
}
