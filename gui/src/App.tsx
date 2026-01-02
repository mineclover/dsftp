import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Sidebar from './components/Sidebar';
import ServerList from './components/ServerList';
import CreateServerModal from './components/CreateServerModal';
import ServerDetail from './components/ServerDetail';
import StatusBar from './components/StatusBar';
import {
  Plus,
  Moon,
  Sun,
  Loader2
} from 'lucide-react';
import type { Server, ServerConfig, ActionType, ServerAction, CreateResult, NetworkInfo } from './types';

const ActionTypes: Record<string, ActionType> = {
  STARTING: 'starting',
  STOPPING: 'stopping',
  REMOVING: 'removing',
  CREATING: 'creating',
};

interface InvokeResult {
  success: boolean;
  error?: string;
}

function App() {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dockerStatus, setDockerStatus] = useState<boolean | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [loadingServers, setLoadingServers] = useState(false);
  const [actions, setActions] = useState<Record<string, ServerAction>>({});

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (selectedServer) {
      const updated = servers.find(s => s.name === selectedServer.name);
      if (updated) {
        setSelectedServer(updated);
      }
    }
  }, [servers, selectedServer]);

  function initializeApp() {
    invoke<boolean>('check_docker')
      .then(docker => {
        setDockerStatus(docker);
        if (docker) {
          refreshNetworkInfo();
          refreshServers();
        }
      })
      .catch(error => {
        console.error('Failed to check docker:', error);
        setDockerStatus(false);
      });
  }

  function refreshNetworkInfo() {
    invoke<NetworkInfo>('get_network_info')
      .then(info => setNetworkInfo(info))
      .catch(error => console.error('Failed to get network info:', error));
  }

  const handleSetNetwork = useCallback((ip: string) => {
    invoke<InvokeResult>('set_network_preference', { ip, interface: null })
      .then(() => refreshNetworkInfo())
      .catch(error => console.error('Failed to set network:', error));
  }, []);

  const handleClearNetwork = useCallback(() => {
    invoke<InvokeResult>('clear_network_preference')
      .then(() => refreshNetworkInfo())
      .catch(error => console.error('Failed to clear network:', error));
  }, []);

  function refreshServers() {
    setLoadingServers(true);
    invoke<Server[]>('list_servers')
      .then(serverList => setServers(serverList))
      .catch(error => console.error('Failed to list servers:', error))
      .finally(() => setLoadingServers(false));
  }

  const setAction = useCallback((name: string, type: ActionType) => {
    setActions(prev => ({ ...prev, [name]: { type } }));
  }, []);

  const clearAction = useCallback((name: string) => {
    setActions(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const setActionError = useCallback((name: string, type: ActionType, error: string) => {
    setActions(prev => ({ ...prev, [name]: { type, error } }));
  }, []);

  const dismissActionError = useCallback((name: string) => {
    clearAction(name);
  }, [clearAction]);

  const executeAction = useCallback((name: string, actionType: ActionType, invokeCmd: string, invokeArgs: Record<string, unknown> = {}) => {
    setAction(name, actionType);

    invoke<InvokeResult>(invokeCmd, invokeArgs)
      .then(result => {
        clearAction(name);
        if (result.success) {
          refreshServers();
          if (actionType === ActionTypes.REMOVING && selectedServer?.name === name) {
            setSelectedServer(null);
          }
        } else {
          setActionError(name, actionType, result.error || 'Operation failed');
        }
      })
      .catch(error => {
        setActionError(name, actionType, error.toString());
      });
  }, [setAction, clearAction, setActionError, selectedServer]);

  const handleStartServer = useCallback((name: string) => {
    executeAction(name, ActionTypes.STARTING, 'start_server', { name });
  }, [executeAction]);

  const handleStopServer = useCallback((name: string) => {
    executeAction(name, ActionTypes.STOPPING, 'stop_server', { name });
  }, [executeAction]);

  const handleRemoveServer = useCallback((name: string) => {
    executeAction(name, ActionTypes.REMOVING, 'remove_server', { name });
  }, [executeAction]);

  const handleCreateServer = useCallback((config: ServerConfig): CreateResult => {
    setShowCreateModal(false);
    setAction(config.name, ActionTypes.CREATING);

    const placeholderServer: Server = {
      name: config.name,
      port: config.port,
      host_path: config.host_path,
      container_path: config.container_path,
      username: config.username,
      password: config.password,
      status: 'creating',
    };
    setServers(prev => [placeholderServer, ...prev]);

    invoke<InvokeResult>('create_server', { config })
      .then(result => {
        clearAction(config.name);
        if (result.success) {
          refreshServers();
        } else {
          setActionError(config.name, ActionTypes.CREATING, result.error || 'Failed to create');
        }
      })
      .catch(error => {
        setActionError(config.name, ActionTypes.CREATING, error.toString());
      });

    return { success: true };
  }, [setAction, clearAction, setActionError]);

  const handleStartAll = useCallback(() => {
    servers.forEach(server => {
      if (server.status !== 'running' && !actions[server.name]) {
        handleStartServer(server.name);
      }
    });
  }, [servers, actions, handleStartServer]);

  const handleStopAll = useCallback(() => {
    servers.forEach(server => {
      if (server.status === 'running' && !actions[server.name]) {
        handleStopServer(server.name);
      }
    });
  }, [servers, actions, handleStopServer]);

  const serversWithActions = servers.map(server => ({
    ...server,
    action: actions[server.name] || null,
  }));

  const isCheckingDocker = dockerStatus === null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">
          SFTP Manager
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!dockerStatus}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            New Server
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          servers={serversWithActions}
          selectedServer={selectedServer}
          onSelectServer={setSelectedServer}
          loading={isCheckingDocker || loadingServers}
        />

        <main className="flex-1 overflow-auto p-6">
          {isCheckingDocker ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 size={32} className="text-blue-500 animate-spin mb-4" />
              <div className="text-gray-600 dark:text-gray-400">Connecting to Docker...</div>
            </div>
          ) : !dockerStatus ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-red-500 text-xl mb-2">Docker is not running</div>
              <p className="text-gray-600 dark:text-gray-400">
                Please start Docker Desktop and refresh.
              </p>
            </div>
          ) : selectedServer ? (
            <ServerDetail
              server={serversWithActions.find(s => s.name === selectedServer.name) || selectedServer}
              localIP={networkInfo?.current_ip || '127.0.0.1'}
              isVPN={networkInfo?.is_vpn || false}
              onStart={() => handleStartServer(selectedServer.name)}
              onStop={() => handleStopServer(selectedServer.name)}
              onRemove={() => handleRemoveServer(selectedServer.name)}
              onBack={() => setSelectedServer(null)}
              onDismissError={() => dismissActionError(selectedServer.name)}
            />
          ) : (
            <ServerList
              servers={serversWithActions}
              localIP={networkInfo?.current_ip || '127.0.0.1'}
              isVPN={networkInfo?.is_vpn || false}
              loading={loadingServers}
              onSelect={setSelectedServer}
              onStart={handleStartServer}
              onStop={handleStopServer}
              onRemove={handleRemoveServer}
              onStartAll={handleStartAll}
              onStopAll={handleStopAll}
              onDismissError={dismissActionError}
            />
          )}
        </main>
      </div>

      <StatusBar
        dockerStatus={dockerStatus}
        networkInfo={networkInfo}
        serverCount={servers.length}
        runningCount={servers.filter(s => s.status === 'running').length}
        onSetNetwork={handleSetNetwork}
        onClearNetwork={handleClearNetwork}
      />

      {showCreateModal && (
        <CreateServerModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateServer}
          defaultPort={2222 + servers.length}
        />
      )}
    </div>
  );
}

export default App;
