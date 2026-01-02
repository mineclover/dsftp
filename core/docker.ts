/**
 * Docker Container Management Module
 * Framework-agnostic core logic for managing atmoz/sftp containers
 */

import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import os from 'os';
import type {
  ContainerStatus,
  CreateContainerResult,
  Result,
  ContainerInfo,
  NetworkInterface,
} from './types.js';

const SFTP_IMAGE = 'atmoz/sftp';
const EXEC_OPTIONS: ExecSyncOptionsWithStringEncoding = {
  encoding: 'utf8',
  shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
};

export function checkDocker(): boolean {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function isSftpContainer(name: string): boolean {
  try {
    const result = execSync(
      `docker inspect --format="{{.Config.Image}}" ${name}`,
      EXEC_OPTIONS
    ).trim();
    return result === SFTP_IMAGE || result.startsWith(`${SFTP_IMAGE}:`);
  } catch {
    return false;
  }
}

// VPN 인터페이스 이름 패턴
const VPN_PATTERNS = [
  /zerotier/i,
  /tailscale/i,
  /wireguard/i,
  /wg\d+/i,
  /tun\d+/i,
  /tap\d+/i,
  /vpn/i,
  /hamachi/i,
  /radmin/i,
];

function isVPNInterface(name: string): boolean {
  return VPN_PATTERNS.some(pattern => pattern.test(name));
}

export function listNetworkInterfaces(): NetworkInterface[] {
  const interfaces = os.networkInterfaces();
  const result: NetworkInterface[] = [];

  // Add 0.0.0.0 option for all interfaces
  result.push({
    name: 'All Interfaces',
    address: '0.0.0.0',
    netmask: '0.0.0.0',
    mac: '',
    cidr: '0.0.0.0/0',
    isVPN: false,
  });

  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name];
    if (!ifaces) continue;

    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        result.push({
          name,
          address: iface.address,
          netmask: iface.netmask,
          mac: iface.mac,
          cidr: iface.cidr || `${iface.address}/${netmaskToCIDR(iface.netmask)}`,
          isVPN: isVPNInterface(name),
        });
      }
    }
  }

  return result;
}

function netmaskToCIDR(netmask: string): number {
  return netmask
    .split('.')
    .map(Number)
    .reduce((acc, octet) => acc + octet.toString(2).split('1').length - 1, 0);
}

export function getLocalIP(preferredInterface?: string, preferredIP?: string): string {
  const interfaces = listNetworkInterfaces();

  // 1. 지정된 IP가 있으면 해당 IP 반환
  if (preferredIP) {
    const found = interfaces.find(i => i.address === preferredIP);
    if (found) return found.address;
  }

  // 2. 지정된 인터페이스가 있으면 해당 인터페이스의 IP 반환
  if (preferredInterface) {
    const found = interfaces.find(i => i.name === preferredInterface);
    if (found) return found.address;
  }

  // 3. VPN이 아닌 첫 번째 인터페이스 반환 (기존 동작)
  const nonVPN = interfaces.find(i => !i.isVPN);
  if (nonVPN) return nonVPN.address;

  // 4. VPN 인터페이스라도 반환
  if (interfaces.length > 0) return interfaces[0].address;

  return '127.0.0.1';
}

export function getVPNInterfaces(): NetworkInterface[] {
  return listNetworkInterfaces().filter(i => i.isVPN);
}

export function getNonVPNInterfaces(): NetworkInterface[] {
  return listNetworkInterfaces().filter(i => !i.isVPN);
}

interface CreateContainerConfig {
  name: string;
  port: number;
  hostPath: string;
  containerPath: string;
  username: string;
  password: string;
  uid?: number;
  bindIP?: string;
}

export function createContainer(config: CreateContainerConfig): CreateContainerResult {
  const { name, port, hostPath, containerPath, username, password, uid = 1001, bindIP = '0.0.0.0' } = config;

  const normalizedPath = hostPath.replace(/\\/g, '/');
  const portMapping = bindIP === '0.0.0.0' ? `${port}:22` : `${bindIP}:${port}:22`;

  const cmd = [
    'docker',
    'run',
    '-d',
    '--name',
    name,
    '-p',
    portMapping,
    '-v',
    `"${normalizedPath}:${containerPath}"`,
    '--restart',
    'unless-stopped',
    'atmoz/sftp',
    `${username}:${password}:${uid}`,
  ].join(' ');

  try {
    const containerId = execSync(cmd, EXEC_OPTIONS).trim();
    return { success: true, containerId: containerId.substring(0, 12) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export function startContainer(name: string): Result {
  if (!isSftpContainer(name)) {
    return { success: false, error: 'Not an SFTP container (atmoz/sftp)' };
  }
  try {
    execSync(`docker start ${name}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export function stopContainer(name: string): Result {
  if (!isSftpContainer(name)) {
    return { success: false, error: 'Not an SFTP container (atmoz/sftp)' };
  }
  try {
    execSync(`docker stop ${name}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export function removeContainer(name: string): Result {
  if (!isSftpContainer(name)) {
    return { success: false, error: 'Not an SFTP container (atmoz/sftp)' };
  }
  try {
    execSync(`docker rm -f ${name}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export function getContainerStatus(name: string): ContainerStatus {
  try {
    const result = execSync(
      `docker inspect --format="{{.State.Status}}" ${name}`,
      EXEC_OPTIONS
    ).trim();
    return result as ContainerStatus;
  } catch {
    return 'not created';
  }
}

export function listSftpContainers(): ContainerInfo[] {
  try {
    const result = execSync(
      'docker ps -a --filter "ancestor=atmoz/sftp" --format "{{.Names}}|{{.Status}}|{{.Ports}}"',
      EXEC_OPTIONS
    ).trim();

    if (!result) return [];

    return result.split('\n').map(line => {
      const [name, status, ports] = line.split('|');
      const portMatch = ports?.match(/0\.0\.0\.0:(\d+)->22/);
      return {
        name,
        status: status.includes('Up') ? 'running' : 'stopped',
        port: portMatch ? portMatch[1] : '-',
      };
    });
  } catch {
    return [];
  }
}

export function getContainerLogs(name: string, lines: number = 50): string {
  try {
    return execSync(`docker logs --tail ${lines} ${name}`, { stdio: 'pipe' }).toString();
  } catch (error) {
    return (error as Error).message;
  }
}
