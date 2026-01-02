#!/usr/bin/env node

/**
 * SFTP Manager CLI
 * Command-line interface for managing SFTP containers
 */

import { program } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import clipboard from 'clipboardy';
import path from 'path';

import * as api from '../core/index.js';
import type { ConnectionFormat, ServerInfo } from '../core/types.js';

program.name('sftp-manager').description('Manage atmoz/sftp Docker containers').version('1.0.0');

program.option('--tui', 'Launch interactive TUI mode').hook('preAction', async thisCommand => {
  if (thisCommand.opts().tui) {
    const { startTUI } = await import('./tui.js');
    await startTUI();
    process.exit(0);
  }
});

program
  .command('create')
  .description('Create a new SFTP server')
  .requiredOption('-n, --name <name>', 'Container name')
  .requiredOption('-p, --path <path>', 'Host folder path to share')
  .option('-P, --port <port>', 'SFTP port', parseInt)
  .option('-u, --user <username>', 'Username', 'admin')
  .option('-w, --password <password>', 'Password (auto-generated if empty)')
  .option('-m, --mount <path>', 'Container mount path', '/home/user/files')
  .option('--copy', 'Copy connection info to clipboard')
  .action(async options => {
    const result = await api.createServer({
      name: options.name,
      port: options.port,
      hostPath: path.resolve(options.path),
      containerPath: options.mount,
      username: options.user,
      password: options.password,
    });

    if (result.success && result.server) {
      console.log(chalk.green(`✓ Server created: ${result.server.name}`));
      console.log('');
      printConnectionInfo(result.server);

      if (options.copy) {
        const info = await api.formatConnectionInfo(result.server.name, 'full');
        if (info) {
          await clipboard.write(info);
          console.log(chalk.gray('\n✓ Copied to clipboard'));
        }
      }
    } else {
      console.error(chalk.red(`✗ Failed: ${result.error}`));
      process.exit(1);
    }
  });

program
  .command('list')
  .alias('ls')
  .description('List all SFTP servers')
  .option('-j, --json', 'Output as JSON')
  .action(async options => {
    const servers = await api.listServers();

    if (options.json) {
      console.log(JSON.stringify(servers, null, 2));
      return;
    }

    if (servers.length === 0) {
      console.log(chalk.gray('No servers configured.'));
      return;
    }

    const table = new Table({
      head: ['Name', 'Port', 'User', 'Path', 'Status'],
      style: { head: ['cyan'] },
    });

    for (const server of servers) {
      const statusColor = server.status === 'running' ? chalk.green : chalk.red;
      table.push([
        server.name,
        server.port,
        server.username,
        truncatePath(server.hostPath, 35),
        statusColor(server.status),
      ]);
    }

    console.log(table.toString());
  });

program
  .command('start <name>')
  .description('Start a server')
  .action(async (name: string) => {
    const result = await api.startServer(name);
    if (result.success) {
      console.log(chalk.green(`✓ Started: ${name}`));
    } else {
      console.error(chalk.red(`✗ Failed: ${result.error}`));
      process.exit(1);
    }
  });

program
  .command('stop <name>')
  .description('Stop a server')
  .action(async (name: string) => {
    const result = await api.stopServer(name);
    if (result.success) {
      console.log(chalk.green(`✓ Stopped: ${name}`));
    } else {
      console.error(chalk.red(`✗ Failed: ${result.error}`));
      process.exit(1);
    }
  });

program
  .command('remove <name>')
  .alias('rm')
  .description('Remove a server')
  .option('-f, --force', 'Skip confirmation')
  .action(async (name: string, options) => {
    if (!options.force) {
      console.log(chalk.yellow(`Warning: This will remove server "${name}" permanently.`));
      console.log(chalk.gray('Use --force to skip this warning.'));
      process.exit(0);
    }

    const result = await api.removeServer(name);
    if (result.success) {
      console.log(chalk.green(`✓ Removed: ${name}`));
    } else {
      console.error(chalk.red(`✗ Failed: ${result.error}`));
      process.exit(1);
    }
  });

program
  .command('copy <name>')
  .alias('cp')
  .description('Copy connection info to clipboard')
  .option('-f, --format <format>', 'Format: full, command, url, password', 'full')
  .action(async (name: string, options) => {
    const info = await api.formatConnectionInfo(name, options.format as ConnectionFormat);
    if (info) {
      await clipboard.write(info);
      console.log(chalk.green('✓ Copied to clipboard:'));
      console.log(chalk.gray(info));
    } else {
      console.error(chalk.red(`✗ Server not found: ${name}`));
      process.exit(1);
    }
  });

program
  .command('info <name>')
  .description('Show server connection info')
  .action(async (name: string) => {
    const server = await api.getServer(name);
    if (server) {
      printConnectionInfo(server);
    } else {
      console.error(chalk.red(`✗ Server not found: ${name}`));
      process.exit(1);
    }
  });

program
  .command('start-all')
  .description('Start all servers')
  .action(async () => {
    const result = await api.startAllServers();
    console.log(chalk.green(`✓ Started ${result.started}/${result.total} servers`));
    if (result.failed.length > 0) {
      console.log(chalk.red(`  Failed: ${result.failed.join(', ')}`));
    }
  });

program
  .command('stop-all')
  .description('Stop all servers')
  .action(async () => {
    const result = await api.stopAllServers();
    console.log(chalk.green(`✓ Stopped ${result.stopped}/${result.total} servers`));
    if (result.failed.length > 0) {
      console.log(chalk.red(`  Failed: ${result.failed.join(', ')}`));
    }
  });

program
  .command('logs <name>')
  .description('Show server logs')
  .option('-n, --lines <number>', 'Number of lines', v => parseInt(v), 50)
  .action(async (name: string, options) => {
    const logs = await api.getServerLogs(name, options.lines);
    console.log(logs);
  });

program
  .command('status')
  .description('Show system status')
  .action(async () => {
    const status = await api.getSystemStatus();
    const networkConfig = api.getCurrentNetworkConfig();

    console.log(chalk.cyan('System Status:'));
    console.log(`  Docker: ${status.docker ? chalk.green('OK') : chalk.red('Not available')}`);
    console.log(`  Config: ${chalk.green(status.configPath)}`);
    console.log('');
    console.log(chalk.cyan('Network:'));
    console.log(
      `  Interface: ${chalk.white(networkConfig.currentInterface || 'auto')}${networkConfig.isVPN ? chalk.yellow(' (VPN)') : ''}`
    );
    console.log(`  IP: ${chalk.white(networkConfig.currentIP)}`);
    if (networkConfig.preferredIP) {
      console.log(`  Preferred IP: ${chalk.gray(networkConfig.preferredIP)}`);
    }
    if (networkConfig.preferredInterface) {
      console.log(`  Preferred Interface: ${chalk.gray(networkConfig.preferredInterface)}`);
    }
  });

// ============================================================
// Network Commands
// ============================================================
program
  .command('network')
  .alias('net')
  .description('Show available network interfaces')
  .option('-j, --json', 'Output as JSON')
  .action(options => {
    const interfaces = api.listNetworks();
    const current = api.getCurrentNetworkConfig();

    if (options.json) {
      console.log(JSON.stringify({ interfaces, current }, null, 2));
      return;
    }

    console.log(chalk.cyan('Available Network Interfaces:\n'));

    const table = new Table({
      head: ['', 'Interface', 'IP Address', 'Type'],
      style: { head: ['cyan'] },
    });

    for (const iface of interfaces) {
      const isCurrent = iface.address === current.currentIP;
      const marker = isCurrent ? chalk.green('●') : ' ';
      const typeLabel = iface.isVPN ? chalk.yellow('VPN') : chalk.gray('Local');

      table.push([marker, iface.name, iface.address, typeLabel]);
    }

    console.log(table.toString());
    console.log('');
    console.log(chalk.gray(`Current: ${current.currentIP} (${current.currentInterface || 'auto'})`));
  });

program
  .command('network:set <interface-or-ip>')
  .description('Set preferred network interface or IP')
  .action((value: string) => {
    const result = api.setNetwork(value);
    if (result.success) {
      const current = api.getCurrentNetworkConfig();
      console.log(chalk.green(`✓ Network set to: ${current.currentIP}`));
      if (current.isVPN) {
        console.log(chalk.yellow('  Using VPN interface'));
      }
    } else {
      console.error(chalk.red(`✗ ${result.error}`));
      process.exit(1);
    }
  });

program
  .command('network:vpn')
  .description('Use VPN network (if available)')
  .action(() => {
    const vpnInterfaces = api.getVPNNetworks();
    if (vpnInterfaces.length === 0) {
      console.error(chalk.red('✗ No VPN interface found'));
      console.log(chalk.gray('  Detected patterns: ZeroTier, Tailscale, WireGuard, Hamachi, etc.'));
      process.exit(1);
    }

    const vpn = vpnInterfaces[0];
    const result = api.setNetwork(vpn.address);
    if (result.success) {
      console.log(chalk.green(`✓ Using VPN: ${vpn.name}`));
      console.log(`  IP: ${chalk.white(vpn.address)}`);
    } else {
      console.error(chalk.red(`✗ ${result.error}`));
      process.exit(1);
    }
  });

program
  .command('network:clear')
  .description('Clear network preference (use auto-detection)')
  .action(() => {
    const result = api.clearNetwork();
    if (result.success) {
      const current = api.getCurrentNetworkConfig();
      console.log(chalk.green('✓ Network preference cleared'));
      console.log(`  Current IP: ${chalk.white(current.currentIP)}`);
    } else {
      console.error(chalk.red(`✗ ${result.error}`));
      process.exit(1);
    }
  });

function printConnectionInfo(server: ServerInfo): void {
  const networkConfig = api.getCurrentNetworkConfig();
  const host = networkConfig.currentIP;

  console.log(chalk.cyan('Connection Info:'));
  console.log(
    `  Host: ${chalk.white(host)}${networkConfig.isVPN ? chalk.yellow(' (VPN)') : ''}`
  );
  console.log(`  Port: ${chalk.white(server.port)}`);
  console.log(`  User: ${chalk.white(server.username)}`);
  console.log(`  Pass: ${chalk.white(server.password)}`);
  console.log(`  Path: ${chalk.gray(server.hostPath)}`);
  console.log('');
  console.log(chalk.gray(`  sftp -P ${server.port} ${server.username}@${host}`));
}

function truncatePath(p: string, maxLen: number): string {
  if (p.length <= maxLen) return p;
  return '...' + p.slice(-(maxLen - 3));
}

program.parse();

if (!process.argv.slice(2).length) {
  const { startTUI } = await import('./tui.js');
  await startTUI();
}
