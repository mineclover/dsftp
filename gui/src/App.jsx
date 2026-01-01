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

// Action types for server operations
const ActionTypes = {
  STARTING: 'starting',
  STOPPING: 'stopping',
  REMOVING: 'removing',
  CREATING: 'creating',
};

function App() {
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dockerStatus, setDockerStatus] = useState(null);
  const [localIP, setLocalIP] = useState('127.0.0.1');
  const [darkMode, setDarkMode] = useState(false);
  const [loadingServers, setLoadingServers] = useState(false);

  // Unified action state: { [serverName]: { type, error? } }
  const [actions, setActions] = useState({});

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Update selected server when servers list changes
  useEffect(() => {
    if (selectedServer) {
      const updated = servers.find(s => s.name === selectedServer.name);
      if (updated) {
        setSelectedServer(updated);
      }
    }
  }, [servers]);

  function initializeApp() {
    invoke('check_docker')
      .then(docker => {
        setDockerStatus(docker);
        if (docker) {
          invoke('get_local_ip').then(ip => setLocalIP(ip));
          refreshServers();
        }
      })
      .catch(error => {
        console.error('Failed to check docker:', error);
        setDockerStatus(false);
      });
  }

  function refreshServers() {
    setLoadingServers(true);
    invoke('list_servers')
      .then(serverList => setServers(serverList))
      .catch(error => console.error('Failed to list servers:', error))
      .finally(() => setLoadingServers(false));
  }

  // Set action state for a server
  const setAction = useCallback((name, type) => {
    setActions(prev => ({ ...prev, [name]: { type } }));
  }, []);

  // Clear action state for a server
  const clearAction = useCallback((name) => {
    setActions(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  // Set error state for a server action
  const setActionError = useCallback((name, type, error) => {
    setActions(prev => ({ ...prev, [name]: { type, error } }));
  }, []);

  // Dismiss action error
  const dismissActionError = useCallback((name) => {
    clearAction(name);
  }, [clearAction]);

  // Generic async action executor
  const executeAction = useCallback((name, actionType, invokeCmd, invokeArgs = {}) => {
    setAction(name, actionType);

    invoke(invokeCmd, invokeArgs)
      .then(result => {
        clearAction(name);
        if (result.success) {
          refreshServers();
          // If removing the selected server, deselect it
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

  // Action handlers
  const handleStartServer = useCallback((name) => {
    executeAction(name, ActionTypes.STARTING, 'start_server', { name });
  }, [executeAction]);

  const handleStopServer = useCallback((name) => {
    executeAction(name, ActionTypes.STOPPING, 'stop_server', { name });
  }, [executeAction]);

  const handleRemoveServer = useCallback((name) => {
    executeAction(name, ActionTypes.REMOVING, 'remove_server', { name });
  }, [executeAction]);

  const handleCreateServer = useCallback((config) => {
    setShowCreateModal(false);
    setAction(config.name, ActionTypes.CREATING);

    // Add placeholder server for immediate UI feedback
    const placeholderServer = {
      name: config.name,
      port: config.port,
      host_path: config.host_path,
      container_path: config.container_path,
      username: config.username,
      password: config.password,
      status: 'creating',
    };
    setServers(prev => [placeholderServer, ...prev]);

    invoke('create_server', { config })
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

  // Start/Stop all - execute in parallel
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

  // Merge servers with their action states
  const serversWithActions = servers.map(server => ({
    ...server,
    action: actions[server.name] || null,
  }));

  const isCheckingDocker = dockerStatus === null;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
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

      {/* Main Content */}
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
              localIP={localIP}
              onStart={() => handleStartServer(selectedServer.name)}
              onStop={() => handleStopServer(selectedServer.name)}
              onRemove={() => handleRemoveServer(selectedServer.name)}
              onBack={() => setSelectedServer(null)}
              onDismissError={() => dismissActionError(selectedServer.name)}
            />
          ) : (
            <ServerList
              servers={serversWithActions}
              localIP={localIP}
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

      {/* Status Bar */}
      <StatusBar
        dockerStatus={dockerStatus}
        localIP={localIP}
        serverCount={servers.length}
        runningCount={servers.filter(s => s.status === 'running').length}
      />

      {/* Create Modal */}
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
