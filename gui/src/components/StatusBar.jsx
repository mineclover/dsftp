import { HardDrive, Server, Globe } from 'lucide-react';

function StatusBar({ dockerStatus, localIP, serverCount, runningCount }) {
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

        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Globe size={14} />
          <span>IP:</span>
          <span className="text-gray-800 dark:text-gray-200">{localIP}</span>
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
