import { Play, Square, Trash2, Copy, MoreVertical, Loader2, X, AlertCircle } from 'lucide-react';
import { useState } from 'react';

// Action type labels for display
const ActionLabels = {
  starting: 'Starting...',
  stopping: 'Stopping...',
  removing: 'Removing...',
  creating: 'Creating...',
};

function ServerList({
  servers,
  localIP,
  loading,
  onSelect,
  onStart,
  onStop,
  onRemove,
  onStartAll,
  onStopAll,
  onDismissError
}) {
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

function ServerCard({ server, localIP, onSelect, onStart, onStop, onRemove, onDismissError }) {
  const [showMenu, setShowMenu] = useState(false);
  const isRunning = server.status === 'running';
  const action = server.action;
  const hasAction = !!action;
  const hasError = action?.error;
  const isCreating = server.status === 'creating' || action?.type === 'creating';

  async function copyToClipboard(text) {
    await navigator.clipboard.writeText(text);
    setShowMenu(false);
  }

  // Error state card
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

  // Action in progress card
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

  // Normal card
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {server.username}@{localIP}:{server.port}
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
                  onClick={() => copyToClipboard(`sftp -P ${server.port} ${server.username}@${localIP}`)}
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
