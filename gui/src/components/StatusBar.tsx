import { HardDrive, Server, Globe, Shield, ChevronDown, Check, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { NetworkInfo, NetworkInterface } from '../types';

interface StatusBarProps {
  dockerStatus: boolean | null;
  networkInfo: NetworkInfo | null;
  serverCount: number;
  runningCount: number;
  onSetNetwork: (ip: string) => void;
  onClearNetwork: () => void;
}

function StatusBar({
  dockerStatus,
  networkInfo,
  serverCount,
  runningCount,
  onSetNetwork,
  onClearNetwork,
}: StatusBarProps) {
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowNetworkMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectNetwork = (iface: NetworkInterface) => {
    onSetNetwork(iface.address);
    setShowNetworkMenu(false);
  };

  const handleClearPreference = () => {
    onClearNetwork();
    setShowNetworkMenu(false);
  };

  const localIP = networkInfo?.current_ip || '127.0.0.1';
  const isVPN = networkInfo?.is_vpn || false;
  const hasPreference = !!(networkInfo?.preferred_ip || networkInfo?.preferred_interface);

  return (
    <footer className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <HardDrive size={14} />
          <span>Docker:</span>
          {dockerStatus ? (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Disconnected
            </span>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowNetworkMenu(!showNetworkMenu)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            {isVPN ? (
              <Shield size={14} className="text-yellow-500" />
            ) : (
              <Globe size={14} />
            )}
            <span>IP:</span>
            <span className="text-gray-800 dark:text-gray-200">{localIP}</span>
            {isVPN && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
                VPN
              </span>
            )}
            <ChevronDown size={12} className={`transition-transform ${showNetworkMenu ? 'rotate-180' : ''}`} />
          </button>

          {showNetworkMenu && networkInfo && (
            <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                Network Interfaces
              </div>
              <div className="max-h-48 overflow-y-auto">
                {networkInfo.interfaces.map((iface) => (
                  <button
                    key={iface.address}
                    onClick={() => handleSelectNetwork(iface)}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                  >
                    <span className="w-4">
                      {iface.address === networkInfo.current_ip && (
                        <Check size={14} className="text-green-500" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-800 dark:text-gray-200 truncate">
                          {iface.name}
                        </span>
                        {iface.is_vpn && (
                          <span className="text-xs px-1 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
                            VPN
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {iface.address}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {hasPreference && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                  <button
                    onClick={handleClearPreference}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-gray-600 dark:text-gray-400"
                  >
                    <X size={14} />
                    <span>Clear preference (auto-detect)</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <Server size={14} />
        <span>
          {runningCount}/{serverCount} servers running
        </span>
      </div>
    </footer>
  );
}

export default StatusBar;
