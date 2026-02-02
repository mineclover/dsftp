export interface ServerConfig {
  name: string;
  port: number;
  host_path: string;
  container_path: string;
  username: string;
  password: string;
}

export type ServerStatus = 'running' | 'stopped' | 'exited' | 'creating' | 'not created';

export type ActionType = 'starting' | 'stopping' | 'removing' | 'creating';

export interface ServerAction {
  type: ActionType;
  error?: string;
}

export interface Server {
  name: string;
  port: number;
  host_path?: string;
  hostPath?: string;
  container_path?: string;
  containerPath?: string;
  username: string;
  password: string;
  status: ServerStatus;
  action?: ServerAction | null;
  bind_ip?: string | null;
}

export interface CreateResult {
  success: boolean;
  error?: string;
}

export interface NetworkInterface {
  name: string;
  address: string;
  is_vpn: boolean;
}

export interface NetworkInfo {
  current_ip: string;
  current_interface: string | null;
  is_vpn: boolean;
  preferred_ip: string | null;
  preferred_interface: string | null;
  interfaces: NetworkInterface[];
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}
