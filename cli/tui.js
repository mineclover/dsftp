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

const logo = `
${chalk.cyan('╔═══════════════════════════════════════╗')}
${chalk.cyan('║')}    ${chalk.bold.white('SFTP Manager')} ${chalk.gray('v1.0')}               ${chalk.cyan('║')}
${chalk.cyan('║')}    ${chalk.gray('atmoz/sftp Docker Manager')}        ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════╝')}
`;

export async function startTUI() {
  console.clear();
  console.log(logo);

  const status = await api.getSystemStatus();
  if (!status.docker) {
    console.log(chalk.red('✗ Docker is not installed or not running.'));
    process.exit(1);
  }
  console.log(chalk.green('✓ Docker connected') + chalk.gray(` (${status.ip})\n`));

  await mainMenu();
}

async function mainMenu() {
  const servers = await api.listServers();
  const runningCount = servers.filter(s => s.status === 'running').length;

  const { action } = await inquirer.prompt([
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
        new inquirer.Separator(),
        { name: '🚀 Start all servers', value: 'startAll' },
        { name: '⏹️  Stop all servers', value: 'stopAll' },
        new inquirer.Separator(),
        { name: '❌ Exit', value: 'exit' }
      ]
    }
  ]);

  switch (action) {
    case 'create': await createServerUI(); break;
    case 'list': await listServersUI(); break;
    case 'start': await manageServerUI('start'); break;
    case 'stop': await manageServerUI('stop'); break;
    case 'remove': await manageServerUI('remove'); break;
    case 'copy': await copyConnectionUI(); break;
    case 'logs': await showLogsUI(); break;
    case 'startAll': await startAllUI(); break;
    case 'stopAll': await stopAllUI(); break;
    case 'exit':
      console.log(chalk.gray('Goodbye!'));
      process.exit(0);
  }

  await mainMenu();
}

async function createServerUI() {
  console.log(chalk.cyan('\n--- Create New SFTP Server ---\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Container name:',
      default: `sftp-${Date.now().toString(36)}`,
      validate: (input) => input.length > 0 || 'Name is required'
    },
    {
      type: 'input',
      name: 'hostPath',
      message: 'Host folder path to share:',
      default: process.cwd() + '/files',
      validate: (input) => input.length > 0 || 'Path is required'
    },
    {
      type: 'input',
      name: 'containerPath',
      message: 'Container mount path:',
      default: '/home/user/files'
    },
    {
      type: 'number',
      name: 'port',
      message: 'SFTP port:',
      default: api.config.findAvailablePort(),
      validate: (input) => (input >= 1 && input <= 65535) || 'Invalid port'
    },
    {
      type: 'input',
      name: 'username',
      message: 'Username:',
      default: 'admin'
    },
    {
      type: 'input',
      name: 'password',
      message: 'Password (empty for auto-generate):',
      default: ''
    }
  ]);

  console.log(chalk.gray('\nCreating container...'));

  const result = await api.createServer({
    name: answers.name,
    port: answers.port,
    hostPath: path.resolve(answers.hostPath),
    containerPath: answers.containerPath,
    username: answers.username,
    password: answers.password || undefined
  });

  if (result.success) {
    console.log(chalk.green(`\n✓ Container created!`));
    printConnectionInfo(result.server);

    const { shouldCopy } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldCopy',
        message: 'Copy connection info to clipboard?',
        default: true
      }
    ]);

    if (shouldCopy) {
      const info = await api.formatConnectionInfo(result.server.name, 'full');
      await clipboard.write(info);
      console.log(chalk.green('✓ Copied to clipboard!'));
    }
  } else {
    console.log(chalk.red(`\n✗ Failed: ${result.error}`));
  }

  console.log('');
}

async function listServersUI() {
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
      chalk.white('Status')
    ],
    style: { head: [], border: [] }
  });

  for (const server of servers) {
    const statusColor = server.status === 'running' ? chalk.green : chalk.red;
    table.push([
      server.name,
      server.port,
      server.username,
      truncatePath(server.hostPath, 30),
      statusColor(server.status)
    ]);
  }

  console.log(table.toString());
  console.log('');
}

async function manageServerUI(action) {
  const servers = await api.listServers();

  if (servers.length === 0) {
    console.log(chalk.yellow('\nNo servers configured.\n'));
    return;
  }

  const choices = servers.map(s => {
    const statusIcon = s.status === 'running' ? chalk.green('●') : chalk.red('○');
    return {
      name: `${statusIcon} ${s.name} (:${s.port})`,
      value: s.name
    };
  });

  const { serverName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'serverName',
      message: `Select server to ${action}:`,
      choices
    }
  ]);

  let result;
  switch (action) {
    case 'start':
      result = await api.startServer(serverName);
      break;
    case 'stop':
      result = await api.stopServer(serverName);
      break;
    case 'remove':
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to remove ${serverName}?`,
          default: false
        }
      ]);
      if (!confirm) {
        console.log(chalk.gray('Cancelled.\n'));
        return;
      }
      result = await api.removeServer(serverName);
      break;
  }

  if (result.success) {
    console.log(chalk.green(`\n✓ ${action} successful: ${serverName}\n`));
  } else {
    console.log(chalk.red(`\n✗ ${action} failed: ${result.error}\n`));
  }
}

async function copyConnectionUI() {
  const servers = await api.listServers();

  if (servers.length === 0) {
    console.log(chalk.yellow('\nNo servers configured.\n'));
    return;
  }

  const { serverName, format } = await inquirer.prompt([
    {
      type: 'list',
      name: 'serverName',
      message: 'Select server:',
      choices: servers.map(s => ({
        name: `${s.name} (:${s.port})`,
        value: s.name
      }))
    },
    {
      type: 'list',
      name: 'format',
      message: 'Copy format:',
      choices: [
        { name: 'Full info (Host, Port, User, Pass)', value: 'full' },
        { name: 'SFTP command', value: 'command' },
        { name: 'FileZilla URL', value: 'url' },
        { name: 'Password only', value: 'password' }
      ]
    }
  ]);

  const info = await api.formatConnectionInfo(serverName, format);
  await clipboard.write(info);
  console.log(chalk.green('\n✓ Copied to clipboard!'));
  console.log(chalk.gray(info));
  console.log('');
}

async function showLogsUI() {
  const servers = await api.listServers();

  if (servers.length === 0) {
    console.log(chalk.yellow('\nNo servers configured.\n'));
    return;
  }

  const { serverName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'serverName',
      message: 'Select server:',
      choices: servers.map(s => ({
        name: `${s.name} (:${s.port})`,
        value: s.name
      }))
    }
  ]);

  const logs = await api.getServerLogs(serverName, 30);
  console.log(chalk.cyan(`\n--- Logs: ${serverName} ---\n`));
  console.log(logs);
}

async function startAllUI() {
  console.log(chalk.cyan('\nStarting all servers...\n'));
  const result = await api.startAllServers();
  console.log(chalk.green(`✓ Started ${result.started}/${result.total} servers`));
  if (result.failed.length > 0) {
    result.failed.forEach(name => console.log(chalk.red(`  ✗ ${name}`)));
  }
  console.log('');
}

async function stopAllUI() {
  console.log(chalk.cyan('\nStopping all servers...\n'));
  const result = await api.stopAllServers();
  console.log(chalk.green(`✓ Stopped ${result.stopped}/${result.total} servers`));
  if (result.failed.length > 0) {
    result.failed.forEach(name => console.log(chalk.red(`  ✗ ${name}`)));
  }
  console.log('');
}

function printConnectionInfo(server) {
  const ip = api.docker.getLocalIP();
  console.log(chalk.cyan('\n--- Connection Info ---'));
  console.log(`  Host: ${chalk.white(ip)}`);
  console.log(`  Port: ${chalk.white(server.port)}`);
  console.log(`  User: ${chalk.white(server.username)}`);
  console.log(`  Pass: ${chalk.white(server.password)}`);
  console.log(`  Path: ${chalk.gray(server.hostPath)}`);
  console.log(chalk.gray(`\n  sftp -P ${server.port} ${server.username}@${ip}\n`));
}

function truncatePath(p, maxLen) {
  if (p.length <= maxLen) return p;
  return '...' + p.slice(-(maxLen - 3));
}
