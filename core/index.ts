/**
 * SFTP Manager Core API
 * Framework-agnostic API for managing SFTP containers
 */

import * as docker from './docker.js';
import * as config from './config.js';
import type {
  CreateServerOptions,
  ServerInfo,
  ConnectionInfo,
  ConnectionFormat,
  NetworkInterface,
  Result,
  BulkOperationResult,
  SystemStatus,
} from './types.js';

export { docker, config };
export * from './types.js';

export async function createServer(
  options: CreateServerOptions
): Promise<Result & { server?: ServerInfo }> {
  if (!docker.checkDocker()) {
    return { success: false, error: 'Docker is not available' };
  }

  const password = options.password || config.generatePassword(12);
  const bindIP = getConfiguredIP();

  const serverConfig = {
    name: options.name,
    port: options.port || config.findAvailablePort(),
    hostPath: options.hostPath,
    containerPath: options.containerPath || `/home/${options.username}/files`,
    username: options.username,
    password,
    uid: options.uid || 1001,
    bindIP,
  };

  const result = docker.createContainer(serverConfig);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const saveResult = config.addServer(serverConfig);
  if (!saveResult.success) {
    docker.removeContainer(serverConfig.name);
    return { success: false, error: saveResult.error };
  }

  return {
    success: true,
    server: {
      ...serverConfig,
      status: 'running',
      createdAt: new Date().toISOString(),
    },
  };
}

export async function listServers(): Promise<ServerInfo[]> {
  const servers = config.getAllServers();

  return servers.map(server => ({
    ...server,
    status: docker.getContainerStatus(server.name),
  }));
}

export async function getServer(name: string): Promise<ServerInfo | null> {
  const server = config.getServer(name);
  if (!server) return null;

  return {
    ...server,
    status: docker.getContainerStatus(name),
  };
}

export async function startServer(name: string): Promise<Result> {
  return docker.startContainer(name);
}

export async function stopServer(name: string): Promise<Result> {
  return docker.stopContainer(name);
}

export async function removeServer(name: string): Promise<Result> {
  const dockerResult = docker.removeContainer(name);
  const configResult = config.removeServer(name);

  if (!dockerResult.success && !configResult.success) {
    return { success: false, error: 'Failed to remove server' };
  }

  return { success: true };
}

export async function startAllServers(): Promise<BulkOperationResult & { started: number }> {
  const servers = config.getAllServers();
  const failed: string[] = [];

  for (const server of servers) {
    const result = docker.startContainer(server.name);
    if (!result.success) {
      failed.push(server.name);
    }
  }

  return {
    total: servers.length,
    succeeded: servers.length - failed.length,
    started: servers.length - failed.length,
    failed,
  };
}

export async function stopAllServers(): Promise<BulkOperationResult & { stopped: number }> {
  const servers = config.getAllServers();
  const failed: string[] = [];

  for (const server of servers) {
    const result = docker.stopContainer(server.name);
    if (!result.success) {
      failed.push(server.name);
    }
  }

  return {
    total: servers.length,
    succeeded: servers.length - failed.length,
    stopped: servers.length - failed.length,
    failed,
  };
}

// 현재 설정된 네트워크로 IP 가져오기
export function getConfiguredIP(): string {
  const networkConfig = config.getNetworkConfig();
  return docker.getLocalIP(networkConfig.preferredInterface, networkConfig.preferredIP);
}

export async function getConnectionInfo(name: string): Promise<ConnectionInfo | null> {
  const server = config.getServer(name);
  if (!server) return null;

  const host = getConfiguredIP();

  return {
    host,
    port: server.port,
    username: server.username,
    password: server.password,
    command: `sftp -P ${server.port} ${server.username}@${host}`,
    url: `sftp://${server.username}:${server.password}@${host}:${server.port}`,
  };
}

export async function formatConnectionInfo(
  name: string,
  format: ConnectionFormat = 'full'
): Promise<string | null> {
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

export async function getSystemStatus(): Promise<SystemStatus> {
  return {
    docker: docker.checkDocker(),
    ip: getConfiguredIP(),
    configPath: config.loadConfig() ? 'OK' : 'Error',
  };
}

// Network management
export function listNetworks(): NetworkInterface[] {
  return docker.listNetworkInterfaces();
}

export function getVPNNetworks(): NetworkInterface[] {
  return docker.getVPNInterfaces();
}

export function setNetwork(interfaceNameOrIP: string): Result {
  const interfaces = docker.listNetworkInterfaces();

  // IP로 먼저 검색
  const byIP = interfaces.find(i => i.address === interfaceNameOrIP);
  if (byIP) {
    return config.setPreferredIP(byIP.address);
  }

  // 인터페이스 이름으로 검색
  const byName = interfaces.find(i => i.name === interfaceNameOrIP);
  if (byName) {
    return config.setPreferredInterface(byName.name);
  }

  return { success: false, error: `Network interface or IP not found: ${interfaceNameOrIP}` };
}

export function clearNetwork(): Result {
  return config.clearNetworkPreference();
}

export function getCurrentNetworkConfig() {
  const networkConfig = config.getNetworkConfig();
  const currentIP = getConfiguredIP();
  const interfaces = docker.listNetworkInterfaces();
  const currentInterface = interfaces.find(i => i.address === currentIP);

  return {
    ...networkConfig,
    currentIP,
    currentInterface: currentInterface?.name,
    isVPN: currentInterface?.isVPN || false,
  };
}

export async function getServerLogs(name: string, lines: number = 50): Promise<string> {
  return docker.getContainerLogs(name, lines);
}
