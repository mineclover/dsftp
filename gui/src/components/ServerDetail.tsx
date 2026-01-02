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
  Shield
} from 'lucide-react';
import type { Server, ActionType } from '../types';

const ActionLabels: Record<ActionType, string> = {
  starting: 'Starting...',
  stopping: 'Stopping...',
  removing: 'Removing...',
  creating: 'Creating...',
};

interface ServerDetailProps {
  server: Server;
  localIP: string;
  isVPN?: boolean;
  onStart: () => void;
  onStop: () => void;
  onRemove: () => void;
  onBack: () => void;
  onDismissError: () => void;
}

function ServerDetail({ server, localIP, isVPN = false, onStart, onStop, onRemove, onBack, onDismissError }: ServerDetailProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const isRunning = server.status === 'running';
  const action = server.action;
  const hasAction = !!action && !action.error;
  const hasError = action?.error;

  function loadLogs() {
    setShowLogs(true);
    setLogsLoading(true);
    invoke<string>('get_container_logs', { name: server.name, lines: 30 })
      .then(result => setLogs(result))
      .catch(() => setLogs('Failed to load logs'))
      .finally(() => setLogsLoading(false));
  }

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const connectionInfo = {
    host: localIP,
    port: server.port,
    username: server.username,
    password: server.password,
    command: `sftp -P ${server.port} ${server.username}@${localIP}`,
    url: `sftp://${server.username}:${server.password}@${localIP}:${server.port}`
  };

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
              <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm flex items-center gap-2">
                {connectionInfo.host}
                {isVPN && (
                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
                    <Shield size={10} />
                    VPN
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
              <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm">
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
          </div>
        </div>
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
      <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm">
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
