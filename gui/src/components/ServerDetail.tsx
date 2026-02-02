import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowLeft,
  Play,
  Square,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  Shield,
  Folder,
  File,
  ChevronRight,
  ChevronUp,
  WifiOff
} from 'lucide-react';
import type { Server, ActionType, FileEntry, NetworkInterface } from '../types';

const ActionLabels: Record<ActionType, string> = {
  starting: 'Starting...',
  stopping: 'Stopping...',
  removing: 'Removing...',
  creating: 'Creating...',
};

interface ServerDetailProps {
  server: Server;
  localIP: string;
  networkInterfaces: NetworkInterface[];
  onStart: () => void;
  onStop: () => void;
  onRemove: () => void;
  onBack: () => void;
  onDismissError: () => void;
}

function ServerDetail({ server, localIP, networkInterfaces, onStart, onStop, onRemove, onBack, onDismissError }: ServerDetailProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [showFiles, setShowFiles] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  // Container path is the SFTP root (e.g., /home/admin/files)
  const containerPath = server.container_path || server.containerPath || `/home/${server.username}/files`;
  const [currentPath, setCurrentPath] = useState(containerPath);

  // Calculate SFTP-visible path (relative to user's home)
  const userHome = `/home/${server.username}`;
  const sftpPath = currentPath.startsWith(userHome)
    ? currentPath.slice(userHome.length) || '/'
    : currentPath;

  const isRunning = server.status === 'running';
  const action = server.action;
  const hasAction = !!action && !action.error;
  const hasError = action?.error;
  // Use server's bind_ip if available, otherwise fall back to current localIP
  const displayIP = server.bind_ip || localIP;
  // Check if server's bind_ip is a VPN interface
  const isVPN = networkInterfaces.find(iface => iface.address === displayIP)?.is_vpn || false;
  // Check if server's bind_ip is unreachable (not in current network interfaces)
  // 0.0.0.0 means all interfaces, so it's always reachable
  const isUnreachable = server.bind_ip && server.bind_ip !== '0.0.0.0' &&
    !networkInterfaces.some(iface => iface.address === server.bind_ip);

  function loadLogs() {
    setShowLogs(true);
    setLogsLoading(true);
    invoke<string>('get_container_logs', { name: server.name, lines: 30 })
      .then(result => setLogs(result))
      .catch(() => setLogs('Failed to load logs'))
      .finally(() => setLogsLoading(false));
  }

  function loadFiles(path: string = currentPath) {
    setShowFiles(true);
    setFilesLoading(true);
    setFilesError(null);
    invoke<FileEntry[]>('list_files', { name: server.name, path })
      .then(result => {
        setFiles(result);
        setCurrentPath(path);
      })
      .catch(err => {
        setFilesError(String(err));
        setFiles([]);
      })
      .finally(() => setFilesLoading(false));
  }

  function navigateToFolder(path: string) {
    loadFiles(path);
  }

  function navigateUp() {
    // Don't go above the container path (SFTP root)
    if (currentPath === containerPath) return;

    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      const parentPath = '/' + parts.join('/');
      // Don't go above container path
      if (parentPath.length >= containerPath.length || containerPath.startsWith(parentPath)) {
        loadFiles(parentPath || '/');
      }
    }
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const hostPath = server.host_path || server.hostPath || '';
  const containerPathValue = server.container_path || server.containerPath || '';

  const connectionInfo = {
    host: displayIP,
    port: server.port,
    username: server.username,
    password: server.password,
    hostPath: hostPath,
    containerPath: containerPathValue,
    command: `sftp -P ${server.port} ${server.username}@${displayIP}`,
    url: `sftp://${server.username}:${server.password}@${displayIP}:${server.port}`
  };

  const debugInfo = `Server: ${server.name}
Host: ${displayIP}
Port: ${server.port}
Username: ${server.username}
Password: ${server.password}
Host Path: ${hostPath}
Container Path: ${containerPathValue}
SFTP Command: ${connectionInfo.command}
FileZilla URL: ${connectionInfo.url}`;

  return (
    <div>
      {hasError && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-red-500" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">
                {action?.type ? ActionLabels[action.type] : 'Operation'} failed
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">{action?.error}</p>
            </div>
          </div>
          <button
            onClick={onDismissError}
            className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {hasAction ? (
              <Loader2 size={16} className="text-blue-500 animate-spin" />
            ) : (
              <span
                className={`w-3 h-3 rounded-full ${
                  isRunning ? 'bg-green-500' : 'bg-gray-400'
                }`}
              />
            )}
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              {server.name}
            </h2>
            {hasAction && action?.type && (
              <span className="text-sm text-blue-600 dark:text-blue-400">
                {ActionLabels[action.type] || 'Processing...'}
              </span>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {server.host_path || server.hostPath}
          </p>
        </div>
        <div className="flex gap-2">
          {isRunning ? (
            <button
              onClick={onStop}
              disabled={hasAction}
              className="flex items-center gap-2 px-4 py-2 text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action?.type === 'stopping' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Square size={16} />
              )}
              {action?.type === 'stopping' ? 'Stopping...' : 'Stop'}
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={hasAction}
              className="flex items-center gap-2 px-4 py-2 text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action?.type === 'starting' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              {action?.type === 'starting' ? 'Starting...' : 'Start'}
            </button>
          )}
          <button
            onClick={onRemove}
            disabled={hasAction}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {action?.type === 'removing' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Trash2 size={18} />
            )}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Connection Info
        </h3>

        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="w-24 text-sm text-gray-500 dark:text-gray-400">
              Host
            </span>
            <div className="flex-1 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded font-mono text-sm flex items-center gap-2 flex-wrap">
                {connectionInfo.host}
                {isVPN && (
                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
                    <Shield size={10} />
                    VPN
                  </span>
                )}
                {isUnreachable && (
                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300" title="This IP is not available on current network">
                    <WifiOff size={10} />
                    Unreachable
                  </span>
                )}
              </code>
              <button
                onClick={() => copyToClipboard(connectionInfo.host, 'host')}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Copy size={16} />
              </button>
              {copied === 'host' && <span className="text-xs text-green-600">Copied!</span>}
            </div>
          </div>
          <InfoRow
            label="Port"
            value={connectionInfo.port?.toString() || ''}
            onCopy={() => copyToClipboard(connectionInfo.port?.toString() || '', 'port')}
            copied={copied === 'port'}
          />
          <InfoRow
            label="Username"
            value={connectionInfo.username || ''}
            onCopy={() => copyToClipboard(connectionInfo.username || '', 'user')}
            copied={copied === 'user'}
          />
          <div className="flex items-center gap-4">
            <span className="w-24 text-sm text-gray-500 dark:text-gray-400">
              Password
            </span>
            <div className="flex-1 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded font-mono text-sm">
                {showPassword ? (connectionInfo.password || '') : '••••••••'}
              </code>
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                onClick={() => copyToClipboard(connectionInfo.password || '', 'pass')}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <Copy size={16} />
              </button>
              {copied === 'pass' && (
                <span className="text-xs text-green-600">Copied!</span>
              )}
            </div>
          </div>

          <hr className="my-3 border-gray-200 dark:border-gray-700" />

          <InfoRow
            label="Host Path"
            value={connectionInfo.hostPath}
            onCopy={() => copyToClipboard(connectionInfo.hostPath, 'hostPath')}
            copied={copied === 'hostPath'}
          />
          <InfoRow
            label="Container"
            value={connectionInfo.containerPath}
            onCopy={() => copyToClipboard(connectionInfo.containerPath, 'containerPath')}
            copied={copied === 'containerPath'}
          />
        </div>

        <hr className="my-4 border-gray-200 dark:border-gray-700" />

        <div className="space-y-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Quick Copy
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(connectionInfo.command, 'cmd')}
              className={`flex-1 px-4 py-2 text-sm rounded-lg border ${
                copied === 'cmd'
                  ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {copied === 'cmd' ? 'Copied!' : 'SFTP Command'}
            </button>
            <button
              onClick={() => copyToClipboard(connectionInfo.url, 'url')}
              className={`flex-1 px-4 py-2 text-sm rounded-lg border ${
                copied === 'url'
                  ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {copied === 'url' ? 'Copied!' : 'FileZilla URL'}
            </button>
            <button
              onClick={() => copyToClipboard(debugInfo, 'debug')}
              className={`flex-1 px-4 py-2 text-sm rounded-lg border ${
                copied === 'debug'
                  ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {copied === 'debug' ? 'Copied!' : 'Copy All'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Files
          </h3>
          {showFiles && (
            <button
              onClick={() => loadFiles(currentPath)}
              disabled={filesLoading || !isRunning}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
              title="Refresh"
            >
              {filesLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
            </button>
          )}
        </div>
        {!isRunning ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg">
            Start the server to browse files
          </div>
        ) : showFiles ? (
          <div className="space-y-2">
            {/* Current path - show both SFTP path and system path */}
            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 w-12">SFTP:</span>
                <Folder size={14} className="text-blue-500" />
                <span className="font-mono text-gray-700 dark:text-gray-300 flex-1">{sftpPath}</span>
                {currentPath !== containerPath && (
                  <button
                    onClick={navigateUp}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    title="Go up"
                  >
                    <ChevronUp size={16} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span className="w-12">System:</span>
                <span className="font-mono">{currentPath}</span>
              </div>
            </div>

            {/* File list */}
            {filesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : filesError ? (
              <div className="text-center py-8 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg">
                {filesError}
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Empty directory
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {files.map((file, index) => (
                  <div
                    key={file.path}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      index !== files.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''
                    } ${file.is_dir ? 'cursor-pointer' : ''}`}
                    onClick={() => file.is_dir && navigateToFolder(file.path)}
                  >
                    {file.is_dir ? (
                      <Folder size={18} className="text-blue-500 flex-shrink-0" />
                    ) : (
                      <File size={18} className="text-gray-400 flex-shrink-0" />
                    )}
                    <span className={`flex-1 text-sm truncate ${file.is_dir ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                      {file.name}
                    </span>
                    {!file.is_dir && (
                      <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
                    )}
                    {file.is_dir && (
                      <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => loadFiles(containerPath)}
            className="w-full py-8 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Click to browse files
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Logs
          </h3>
          {showLogs && (
            <button
              onClick={loadLogs}
              disabled={logsLoading}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
            >
              {logsLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
            </button>
          )}
        </div>
        {showLogs ? (
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm font-mono overflow-x-auto max-h-64 overflow-y-auto">
            {logsLoading ? 'Loading logs...' : (logs || 'No logs available')}
          </pre>
        ) : (
          <button
            onClick={loadLogs}
            className="w-full py-8 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Click to load logs
          </button>
        )}
      </div>
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}

function InfoRow({ label, value, onCopy, copied }: InfoRowProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-24 text-sm text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded font-mono text-sm">
        {value}
      </code>
      <button
        onClick={onCopy}
        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
      >
        <Copy size={16} />
      </button>
      {copied && <span className="text-xs text-green-600">Copied!</span>}
    </div>
  );
}

export default ServerDetail;
