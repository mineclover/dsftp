/**
 * Configuration Management Module
 * Handles server configuration persistence
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import type { Config, ServerConfig, NetworkConfig, Result } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'sftp-config.json');

export function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data) as Config;
    }
  } catch (error) {
    console.error('Config load error:', (error as Error).message);
  }
  return { servers: [] };
}

export function saveConfig(config: Config): Result {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export function addServer(server: Omit<ServerConfig, 'createdAt'>): Result {
  const config = loadConfig();

  if (config.servers.find(s => s.name === server.name)) {
    return { success: false, error: 'Server name already exists' };
  }

  if (config.servers.find(s => s.port === server.port)) {
    return { success: false, error: 'Port already in use' };
  }

  config.servers.push({
    ...server,
    createdAt: new Date().toISOString(),
  });

  return saveConfig(config);
}

export function removeServer(name: string): Result {
  const config = loadConfig();
  const initialLength = config.servers.length;
  config.servers = config.servers.filter(s => s.name !== name);

  if (config.servers.length === initialLength) {
    return { success: false, error: 'Server not found' };
  }

  return saveConfig(config);
}

export function getServer(name: string): ServerConfig | undefined {
  const config = loadConfig();
  return config.servers.find(s => s.name === name);
}

export function getAllServers(): ServerConfig[] {
  const config = loadConfig();
  return config.servers;
}

export function updateServer(name: string, updates: Partial<ServerConfig>): Result {
  const config = loadConfig();
  const index = config.servers.findIndex(s => s.name === name);

  if (index === -1) {
    return { success: false, error: 'Server not found' };
  }

  config.servers[index] = { ...config.servers[index], ...updates };
  return saveConfig(config);
}

export function generatePassword(length: number = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

export function findAvailablePort(startPort: number = 2222): number {
  const config = loadConfig();
  const usedPorts = new Set(config.servers.map(s => s.port));

  let port = startPort;
  while (usedPorts.has(port)) {
    port++;
  }
  return port;
}

// Network configuration
export function getNetworkConfig(): NetworkConfig {
  const config = loadConfig();
  return config.network || {};
}

export function setNetworkConfig(network: NetworkConfig): Result {
  const config = loadConfig();
  config.network = network;
  return saveConfig(config);
}

export function setPreferredInterface(interfaceName: string): Result {
  const network = getNetworkConfig();
  network.preferredInterface = interfaceName;
  network.preferredIP = undefined; // 인터페이스 설정 시 IP 초기화
  return setNetworkConfig(network);
}

export function setPreferredIP(ip: string): Result {
  const network = getNetworkConfig();
  network.preferredIP = ip;
  network.preferredInterface = undefined; // IP 설정 시 인터페이스 초기화
  return setNetworkConfig(network);
}

export function clearNetworkPreference(): Result {
  return setNetworkConfig({});
}
