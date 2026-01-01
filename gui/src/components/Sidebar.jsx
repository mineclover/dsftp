import { Server, Settings, HardDrive } from 'lucide-react';

function Sidebar({ servers, selectedServer, onSelectServer }) {
  const runningCount = servers.filter(s => s.status === 'running').length;

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <nav className="flex-1 p-4">
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Servers ({runningCount}/{servers.length})
          </h2>
          <ul className="space-y-1">
            {servers.length === 0 ? (
              <li className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2">
                No servers yet
              </li>
            ) : (
              servers.map(server => (
                <li key={server.name}>
                  <button
                    onClick={() => onSelectServer(server)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedServer?.name === server.name
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        server.status === 'running'
                          ? 'bg-green-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {server.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        :{server.port}
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <HardDrive size={16} />
          <span>Docker</span>
          <span className="ml-auto flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Online
          </span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
