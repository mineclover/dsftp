/**
 * SFTP Manager TUI
 * Interactive terminal UI for managing SFTP containers
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import clipboard from 'clipboardy';
import path from 'path';

import * as api from '../core/index.js';
import type { ServerInfo, ConnectionFormat } from '../core/types.js';

const logo = `
${chalk.cyan('╔═══════════════════════════════════════╗')}
${chalk.cyan('║')}    ${chalk.bold.white('SFTP Manager')} ${chalk.gray('v1.0')}               ${chalk.cyan('║')}
${chalk.cyan('║')}    ${chalk.gray('atmoz/sftp Docker Manager')}        ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════╝')}
`;

export async function startTUI(): Promise<void> {
  console.clear();
  console.log(logo);

  const status = await api.getSystemStatus();
  if (!status.docker) {
    console.log(chalk.red('✗ Docker is not installed or not running.'));
    process.exit(1);
  }

  const networkConfig = api.getCurrentNetworkConfig();
  const vpnLabel = networkConfig.isVPN ? chalk.yellow(' (VPN)') : '';
  console.log(chalk.green('✓ Docker connected') + chalk.gray(` (${networkConfig.currentIP})`) + vpnLabel + '\n');

  await mainMenu();
}

type MenuAction =
  | 'create'
  | 'list'
  | 'start'
  | 'stop'
  | 'remove'
  | 'copy'
  | 'logs'
  | 'network'
  | 'startAll'
  | 'stopAll'
  | 'exit';

async function mainMenu(): Promise<void> {
  const servers = await api.listServers();
  const runningCount = servers.filter(s => s.status === 'running').length;

  const { action } = await inquirer.prompt<{ action: MenuAction }>([
    {
      type: 'list',
      name: 'action',
      message: `Servers: ${servers.length} total, ${chalk.green(runningCount + ' running')}`,
      choices: [
        { name: '📦 Create new SFTP server', value: 'create' },
        { name: '📋 List all servers', value: 'list' },
        { name: '▶️  Start server', value: 'start' },
        { name: '⏹️  Stop server', value: 'stop' },
        { name: '🗑️  Remove server', value: 'remove' },
        { name: '📄 Copy connection info', value: 'copy' },
        { name: '📝 Show server logs', value: 'logs' },
        { name: '🌐 Network settings', value: 'network' },
        new inquirer.Separator(),
        { name: '🚀 Start all servers', value: 'startAll' },
        { name: '⏹️  Stop all servers', value: 'stopAll' },
        new inquirer.Separator(),
        { name: '❌ Exit', value: 'exit' },
      ],
    },
  ]);

  switch (action) {
    case 'create':
      await createServerUI();
      break;
    case 'list':
      await listServersUI();
      break;
    case 'start':
      await manageServerUI('start');
      break;
    case 'stop':
      await manageServerUI('stop');
      break;
    case 'remove':
      await manageServerUI('remove');
      break;
    case 'copy':
      await copyConnectionUI();
      break;
    case 'logs':
      await showLogsUI();
      break;
    case 'network':
      await networkSettingsUI();
      break;
    case 'startAll':
      await startAllUI();
      break;
    case 'stopAll':
      await stopAllUI();
      break;
    case 'exit':
      console.log(chalk.gray('Goodbye!'));
      process.exit(0);
  }

  await mainMenu();
}

interface CreateAnswers {
  name: string;
  hostPath: string;
  containerPath: string;
  port: number;
  username: string;
  password: string;
}

async function createServerUI(): Promise<void> {
  console.log(chalk.cyan('\n--- Create New SFTP Server ---\n'));

  const answers = await inquirer.prompt<CreateAnswers>([
    {
      type: 'input',
      name: 'name',
      message: 'Container name:',
      default: `sftp-${Date.now().toString(36)}`,
      validate: (input: string) => input.length > 0 || 'Name is required',
    },
    {
      type: 'input',
      name: 'hostPath',
      message: 'Host folder path to share:',
      default: process.cwd() + '/files',
      validate: (input: string) => input.length > 0 || 'Path is required',
    },
    {
      type: 'input',
      name: 'containerPath',
      message: 'Container mount path:',
      default: '/home/user/files',
    },
    {
      type: 'number',
      name: 'port',
      message: 'SFTP port:',
      default: api.config.findAvailablePort(),
      validate: (input: number) => (input >= 1 && input <= 65535) || 'Invalid port',
    },
    {
      type: 'input',
      name: 'username',
      message: 'Username:',
      default: 'admin',
    },
    {
      type: 'input',
      name: 'password',
      message: 'Password (empty for auto-generate):',
      default: '',
    },
  ]);

  console.log(chalk.gray('\nCreating container...'));

  const result = await api.createServer({
    name: answers.name,
    port: answers.port,
    hostPath: path.resolve(answers.hostPath),
    containerPath: answers.containerPath,
    username: answers.username,
    password: answers.password || undefined,
  });

  if (result.success && result.server) {
    console.log(chalk.green(`\n✓ Container created!`));
    printConnectionInfo(result.server);

    const { shouldCopy } = await inquirer.prompt<{ shouldCopy: boolean }>([
      {
        type: 'confirm',
        name: 'shouldCopy',
        message: 'Copy connection info to clipboard?',
        default: true,
      },
    ]);

    if (shouldCopy) {
      const info = await api.formatConnectionInfo(result.server.name, 'full');
      if (info) {
        await clipboard.write(info);
        console.log(chalk.green('✓ Copied to clipboard!'));
      }
    }
  } else {
    console.log(chalk.red(`\n✗ Failed: ${result.error}`));
  }

  console.log('');
}

async function listServersUI(): Promise<void> {
  console.log(chalk.cyan('\n--- SFTP Servers ---\n'));

  const servers = await api.listServers();

  if (servers.length === 0) {
    console.log(chalk.gray('No servers found.\n'));
    return;
  }

  const table = new Table({
    head: [
      chalk.white('Name'),
      chalk.white('Port'),
      chalk.white('User'),
      chalk.white('Path'),
      chalk.white('Status'),
    ],
    style: { head: [], border: [] },
  });

  for (const server of servers) {
    const statusColor = server.status === 'running' ? chalk.green : chalk.red;
    table.push([
      server.name,
      server.port,
      server.username,
      truncatePath(server.hostPath, 30),
      statusColor(server.status),
    ]);
  }

  console.log(table.toString());
  console.log('');
}

type ManageAction = 'start' | 'stop' | 'remove';

async function manageServerUI(action: ManageAction): Promise<void> {
  const servers = await api.listServers();

  if (servers.length === 0) {
    console.log(chalk.yellow('\nNo servers configured.\n'));
    return;
  }

  const choices = servers.map(s => {
    const statusIcon = s.status === 'running' ? chalk.green('●') : chalk.red('○');
    return {
      name: `${statusIcon} ${s.name} (:${s.port})`,
      value: s.name,
    };
  });

  const { serverName } = await inquirer.prompt<{ serverName: string }>([
    {
      type: 'list',
      name: 'serverName',
      message: `Select server to ${action}:`,
      choices,
    },
  ]);

  let result: api.Result;
  switch (action) {
    case 'start':
      result = await api.startServer(serverName);
      break;
    case 'stop':
      result = await api.stopServer(serverName);
      break;
    case 'remove': {
      const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to remove ${serverName}?`,
          default: false,
        },
      ]);
      if (!confirm) {
        console.log(chalk.gray('Cancelled.\n'));
        return;
      }
      result = await api.removeServer(serverName);
      break;
    }
  }

  if (result.success) {
    console.log(chalk.green(`\n✓ ${action} successful: ${serverName}\n`));
  } else {
    console.log(chalk.red(`\n✗ ${action} failed: ${result.error}\n`));
  }
}

async function copyConnectionUI(): Promise<void> {
  const servers = await api.listServers();

  if (servers.length === 0) {
    console.log(chalk.yellow('\nNo servers configured.\n'));
    return;
  }

  const { serverName, format } = await inquirer.prompt<{
    serverName: string;
    format: ConnectionFormat;
  }>([
    {
      type: 'list',
      name: 'serverName',
      message: 'Select server:',
      choices: servers.map(s => ({
        name: `${s.name} (:${s.port})`,
        value: s.name,
      })),
    },
    {
      type: 'list',
      name: 'format',
      message: 'Copy format:',
      choices: [
        { name: 'Full info (Host, Port, User, Pass)', value: 'full' },
        { name: 'SFTP command', value: 'command' },
        { name: 'FileZilla URL', value: 'url' },
        { name: 'Password only', value: 'password' },
      ],
    },
  ]);

  const info = await api.formatConnectionInfo(serverName, format);
  if (info) {
    await clipboard.write(info);
    console.log(chalk.green('\n✓ Copied to clipboard!'));
    console.log(chalk.gray(info));
  }
  console.log('');
}

async function showLogsUI(): Promise<void> {
  const servers = await api.listServers();

  if (servers.length === 0) {
    console.log(chalk.yellow('\nNo servers configured.\n'));
    return;
  }

  const { serverName } = await inquirer.prompt<{ serverName: string }>([
    {
      type: 'list',
      name: 'serverName',
      message: 'Select server:',
      choices: servers.map(s => ({
        name: `${s.name} (:${s.port})`,
        value: s.name,
      })),
    },
  ]);

  const logs = await api.getServerLogs(serverName, 30);
  console.log(chalk.cyan(`\n--- Logs: ${serverName} ---\n`));
  console.log(logs);
}

async function startAllUI(): Promise<void> {
  console.log(chalk.cyan('\nStarting all servers...\n'));
  const result = await api.startAllServers();
  console.log(chalk.green(`✓ Started ${result.started}/${result.total} servers`));
  if (result.failed.length > 0) {
    result.failed.forEach(name => console.log(chalk.red(`  ✗ ${name}`)));
  }
  console.log('');
}

async function stopAllUI(): Promise<void> {
  console.log(chalk.cyan('\nStopping all servers...\n'));
  const result = await api.stopAllServers();
  console.log(chalk.green(`✓ Stopped ${result.stopped}/${result.total} servers`));
  if (result.failed.length > 0) {
    result.failed.forEach(name => console.log(chalk.red(`  ✗ ${name}`)));
  }
  console.log('');
}

type NetworkAction = 'set' | 'vpn' | 'clear' | 'back';

async function networkSettingsUI(): Promise<void> {
  const interfaces = api.listNetworks();
  const current = api.getCurrentNetworkConfig();
  const vpnInterfaces = api.getVPNNetworks();

  console.log(chalk.cyan('\n--- Network Settings ---\n'));
  console.log(`  Current IP: ${chalk.white(current.currentIP)}`);
  console.log(
    `  Interface: ${chalk.white(current.currentInterface || 'auto')}${current.isVPN ? chalk.yellow(' (VPN)') : ''}`
  );
  if (current.preferredIP) {
    console.log(`  Preferred IP: ${chalk.gray(current.preferredIP)}`);
  }
  if (current.preferredInterface) {
    console.log(`  Preferred Interface: ${chalk.gray(current.preferredInterface)}`);
  }
  console.log('');

  const choices: { name: string; value: NetworkAction }[] = [
    { name: '📍 Select network interface', value: 'set' },
  ];

  if (vpnInterfaces.length > 0) {
    choices.push({
      name: `🔒 Use VPN (${vpnInterfaces.map(v => v.name).join(', ')})`,
      value: 'vpn',
    });
  }

  if (current.preferredIP || current.preferredInterface) {
    choices.push({ name: '🔄 Clear preference (auto-detect)', value: 'clear' });
  }

  choices.push({ name: '← Back to main menu', value: 'back' });

  const { action } = await inquirer.prompt<{ action: NetworkAction }>([
    {
      type: 'list',
      name: 'action',
      message: 'Network options:',
      choices,
    },
  ]);

  switch (action) {
    case 'set': {
      const interfaceChoices = interfaces.map(iface => {
        const isCurrent = iface.address === current.currentIP;
        const marker = isCurrent ? chalk.green('● ') : '  ';
        const vpnLabel = iface.isVPN ? chalk.yellow(' (VPN)') : '';
        return {
          name: `${marker}${iface.name} - ${iface.address}${vpnLabel}`,
          value: iface.address,
        };
      });

      const { selectedIP } = await inquirer.prompt<{ selectedIP: string }>([
        {
          type: 'list',
          name: 'selectedIP',
          message: 'Select network interface:',
          choices: interfaceChoices,
        },
      ]);

      const result = api.setNetwork(selectedIP);
      if (result.success) {
        const updated = api.getCurrentNetworkConfig();
        console.log(chalk.green(`\n✓ Network set to: ${updated.currentIP}`));
        if (updated.isVPN) {
          console.log(chalk.yellow('  Using VPN interface'));
        }
      } else {
        console.log(chalk.red(`\n✗ ${result.error}`));
      }
      break;
    }
    case 'vpn': {
      if (vpnInterfaces.length === 0) {
        console.log(chalk.red('\n✗ No VPN interface found'));
        break;
      }
      const vpn = vpnInterfaces[0];
      const result = api.setNetwork(vpn.address);
      if (result.success) {
        console.log(chalk.green(`\n✓ Using VPN: ${vpn.name}`));
        console.log(`  IP: ${chalk.white(vpn.address)}`);
      } else {
        console.log(chalk.red(`\n✗ ${result.error}`));
      }
      break;
    }
    case 'clear': {
      const result = api.clearNetwork();
      if (result.success) {
        const updated = api.getCurrentNetworkConfig();
        console.log(chalk.green('\n✓ Network preference cleared'));
        console.log(`  Current IP: ${chalk.white(updated.currentIP)}`);
      } else {
        console.log(chalk.red(`\n✗ ${result.error}`));
      }
      break;
    }
    case 'back':
      return;
  }

  console.log('');
}

function printConnectionInfo(server: ServerInfo): void {
  const networkConfig = api.getCurrentNetworkConfig();
  const ip = networkConfig.currentIP;
  console.log(chalk.cyan('\n--- Connection Info ---'));
  console.log(
    `  Host: ${chalk.white(ip)}${networkConfig.isVPN ? chalk.yellow(' (VPN)') : ''}`
  );
  console.log(`  Port: ${chalk.white(server.port)}`);
  console.log(`  User: ${chalk.white(server.username)}`);
  console.log(`  Pass: ${chalk.white(server.password)}`);
  console.log(`  Path: ${chalk.gray(server.hostPath)}`);
  console.log(chalk.gray(`\n  sftp -P ${server.port} ${server.username}@${ip}\n`));
}

function truncatePath(p: string, maxLen: number): string {
  if (p.length <= maxLen) return p;
  return '...' + p.slice(-(maxLen - 3));
}
