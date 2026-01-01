/**
 * Docker Container Management Module
 * Framework-agnostic core logic for managing atmoz/sftp containers
 *
 * IMPORTANT: This module ONLY manages atmoz/sftp containers.
 * All operations verify the container image before executing.
 */

import { execSync } from 'child_process';
import os from 'os';

const SFTP_IMAGE = 'atmoz/sftp';

/**
 * Check if Docker is available and running
 * @returns {boolean}
 */
export function checkDocker() {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a container is using atmoz/sftp image
 * @param {string} name - Container name
 * @returns {boolean}
 */
export function isSftpContainer(name) {
  try {
    const result = execSync(
      `docker inspect --format="{{.Config.Image}}" ${name}`,
      { stdio: 'pipe', shell: true }
    ).toString().trim();
    return result === SFTP_IMAGE || result.startsWith(`${SFTP_IMAGE}:`);
  } catch {
    return false;
  }
}

/**
 * Get local IP address for SFTP connection
 * @returns {string}
 */
export function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Create a new SFTP container
 * @param {Object} config
 * @param {string} config.name - Container name
 * @param {number} config.port - Host port
 * @param {string} config.hostPath - Host folder path
 * @param {string} config.containerPath - Container mount path
 * @param {string} config.username - SFTP username
 * @param {string} config.password - SFTP password
 * @param {number} [config.uid=1001] - User ID
 * @returns {{success: boolean, containerId?: string, error?: string}}
 */
export function createContainer(config) {
  const { name, port, hostPath, containerPath, username, password, uid = 1001 } = config;

  // Normalize path for Docker (convert backslashes to forward slashes)
  const normalizedPath = hostPath.replace(/\\/g, '/');

  const cmd = [
    'docker', 'run', '-d',
    '--name', name,
    '-p', `${port}:22`,
    '-v', `"${normalizedPath}:${containerPath}"`,
    '--restart', 'unless-stopped',
    'atmoz/sftp',
    `${username}:${password}:${uid}`
  ].join(' ');

  try {
    const containerId = execSync(cmd, { stdio: 'pipe', shell: true }).toString().trim();
    return { success: true, containerId: containerId.substring(0, 12) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Start a stopped container (only atmoz/sftp)
 * @param {string} name - Container name
 * @returns {{success: boolean, error?: string}}
 */
export function startContainer(name) {
  if (!isSftpContainer(name)) {
    return { success: false, error: 'Not an SFTP container (atmoz/sftp)' };
  }
  try {
    execSync(`docker start ${name}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Stop a running container (only atmoz/sftp)
 * @param {string} name - Container name
 * @returns {{success: boolean, error?: string}}
 */
export function stopContainer(name) {
  if (!isSftpContainer(name)) {
    return { success: false, error: 'Not an SFTP container (atmoz/sftp)' };
  }
  try {
    execSync(`docker stop ${name}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove a container (only atmoz/sftp, force)
 * @param {string} name - Container name
 * @returns {{success: boolean, error?: string}}
 */
export function removeContainer(name) {
  if (!isSftpContainer(name)) {
    return { success: false, error: 'Not an SFTP container (atmoz/sftp)' };
  }
  try {
    execSync(`docker rm -f ${name}`, { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get container status
 * @param {string} name - Container name
 * @returns {'running' | 'stopped' | 'not created'}
 */
export function getContainerStatus(name) {
  try {
    const result = execSync(
      `docker inspect --format="{{.State.Status}}" ${name}`,
      { stdio: 'pipe', shell: true }
    ).toString().trim();
    return result;
  } catch {
    return 'not created';
  }
}

/**
 * List all atmoz/sftp containers
 * @returns {Array<{name: string, status: string, port: string}>}
 */
export function listSftpContainers() {
  try {
    const result = execSync(
      'docker ps -a --filter "ancestor=atmoz/sftp" --format "{{.Names}}|{{.Status}}|{{.Ports}}"',
      { stdio: 'pipe', shell: true }
    ).toString().trim();

    if (!result) return [];

    return result.split('\n').map(line => {
      const [name, status, ports] = line.split('|');
      const portMatch = ports?.match(/0\.0\.0\.0:(\d+)->22/);
      return {
        name,
        status: status.includes('Up') ? 'running' : 'stopped',
        port: portMatch ? portMatch[1] : '-'
      };
    });
  } catch {
    return [];
  }
}

/**
 * Get container logs
 * @param {string} name - Container name
 * @param {number} [lines=50] - Number of lines
 * @returns {string}
 */
export function getContainerLogs(name, lines = 50) {
  try {
    return execSync(`docker logs --tail ${lines} ${name}`, { stdio: 'pipe' }).toString();
  } catch (error) {
    return error.message;
  }
}
