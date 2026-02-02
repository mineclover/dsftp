import { Play, Square, Trash2, Copy, MoreVertical, Loader2, X, AlertCircle, Shield, WifiOff } from 'lucide-react';
import { useState } from 'react';
import type { Server, ActionType, NetworkInterface } from '../types';

const ActionLabels: Record<ActionType, string> = {
  starting: 'Starting...',
  stopping: 'Stopping...',
  removing: 'Removing...',
  creating: 'Creating...',
};

interface ServerListProps {
  servers: Server[];
  localIP: string;
  networkInterfaces: NetworkInterface[];
  loading: boolean;
  onSelect: (server: Server) => void;
  onStart: (name: string) => void;
  onStop: (name: string) => void;
  onRemove: (name: string) => void;
  onStartAll: () => void;
  onStopAll: () => void;
  onDismissError: (name: string) => void;
}

function ServerList({
  servers,
  localIP,
  networkInterfaces,
  loading,
  onSelect,
  onStart,
  onStop,
  onRemove,
  onStartAll,
  onStopAll,
  onDismissError
}: ServerListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Servers
          </h2>
          {loading && (
            <Loader2 size={20} className="text-blue-500 animate-spin" />
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStartAll}
            className="flex items-center gap-2 px-3 py-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50"
          >
            <Play size={16} />
            Start All
          </button>
          <button
            onClick={onStopAll}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50"
          >
            <Square size={16} />
            Stop All
          </button>
        </div>
      </div>

      {loading && servers.length === 0 ? (
        <div className="text-center py-12">
          <Loader2 size={32} className="text-blue-500 animate-spin mx-auto mb-4" />
          <div className="text-gray-500 dark:text-gray-400">Loading servers...</div>
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 dark:text-gray-500 text-lg mb-2">
            No servers configured
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Click "New Server" to create your first SFTP server.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {servers.map(server => (
            <ServerCard
              key={server.name}
              server={server}
              localIP={localIP}
              networkInterfaces={networkInterfaces}
              onSelect={() => onSelect(server)}
              onStart={() => onStart(server.name)}
              onStop={() => onStop(server.name)}
              onRemove={() => onRemove(server.name)}
              onDismissError={() => onDismissError(server.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ServerCardProps {
  server: Server;
  localIP: string;
  networkInterfaces: NetworkInterface[];
  onSelect: () => void;
  onStart: () => void;
  onStop: () => void;
  onRemove: () => void;
  onDismissError: () => void;
}

function ServerCard({ server, localIP, networkInterfaces, onSelect, onStart, onStop, onRemove, onDismissError }: ServerCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const isRunning = server.status === 'running';
  const action = server.action;
  const hasAction = !!action;
  const hasError = action?.error;
  const isCreating = server.status === 'creating' || action?.type === 'creating';
  // Use server's bind_ip if available, otherwise fall back to current localIP
  const displayIP = server.bind_ip || localIP;
  const hostPath = server.host_path || server.hostPath || '';
  const containerPath = server.container_path || server.containerPath || '';
  // Check if server's bind_ip is a VPN interface
  const isVPN = networkInterfaces.find(iface => iface.address === displayIP)?.is_vpn || false;
  // Check if server's bind_ip is unreachable (not in current network interfaces)
  // 0.0.0.0 means all interfaces, so it's always reachable
  const isUnreachable = server.bind_ip && server.bind_ip !== '0.0.0.0' &&
    !networkInterfaces.some(iface => iface.address === server.bind_ip);

  const debugInfo = `Server: ${server.name}
Host: ${displayIP}
Port: ${server.port}
Username: ${server.username}
Password: ${server.password}
Host Path: ${hostPath}
Container Path: ${containerPath}
SFTP Command: sftp -P ${server.port} ${server.username}@${displayIP}
FileZilla URL: sftp://${server.username}:${server.password}@${displayIP}:${server.port}`;

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setShowMenu(false);
  }

  if (hasError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-red-500" />
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white">
                {server.name}
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400">
                {action.error}
              </p>
            </div>
          </div>
          <button
            onClick={onDismissError}
            className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400 truncate">
          {server.host_path || server.hostPath}
        </div>
      </div>
    );
  }

  if (hasAction || isCreating) {
    const actionType = action?.type || 'creating';
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="text-blue-500 animate-spin" />
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white">
                {server.name}
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {ActionLabels[actionType] || 'Processing...'}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400 truncate">
          {server.host_path || server.hostPath}
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`w-3 h-3 rounded-full ${
              isRunning ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white">
              {server.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 flex-wrap">
              {server.username}@{displayIP}:{server.port}
              {isVPN && (
                <span className="inline-flex items-center gap-0.5 text-xs px-1 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 ml-1">
                  <Shield size={10} />
                  VPN
                </span>
              )}
              {isUnreachable && (
                <span className="inline-flex items-center gap-0.5 text-xs px-1 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 ml-1" title="This IP is not available on current network">
                  <WifiOff size={10} />
                  Unreachable
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {isRunning ? (
            <button
              onClick={onStop}
              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
              title="Stop"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              onClick={onStart}
              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
              title="Start"
            >
              <Play size={18} />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <MoreVertical size={18} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                <button
                  onClick={() => copyToClipboard(`sftp -P ${server.port} ${server.username}@${displayIP}`)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Copy size={14} />
                  Copy SFTP Command
                </button>
                <button
                  onClick={() => copyToClipboard(server.password)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Copy size={14} />
                  Copy Password
                </button>
                <button
                  onClick={() => copyToClipboard(debugInfo)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Copy size={14} />
                  Copy All Info
                </button>
                <hr className="my-1 border-gray-200 dark:border-gray-700" />
                <button
                  onClick={() => { setShowMenu(false); onRemove(); }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 text-sm text-gray-500 dark:text-gray-400 truncate">
        {server.host_path || server.hostPath}
      </div>
    </div>
  );
}

export default ServerList;
