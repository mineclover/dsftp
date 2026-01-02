export interface ServerConfig {
  name: string;
  port: number;
  hostPath: string;
  containerPath: string;
  username: string;
  password: string;
  uid: number;
  createdAt: string;
}

export interface NetworkConfig {
  preferredInterface?: string;
  preferredIP?: string;
}

export interface Config {
  servers: ServerConfig[];
  network?: NetworkConfig;
}

export interface CreateServerOptions {
  name: string;
  port?: number;
  hostPath: string;
  containerPath?: string;
  username: string;
  password?: string;
  uid?: number;
}

export interface ServerInfo extends ServerConfig {
  status: ContainerStatus;
}

export interface ConnectionInfo {
  host: string;
  port: number;
  username: string;
  password: string;
  command: string;
  url: string;
}

export type ContainerStatus = 'running' | 'stopped' | 'exited' | 'not created';

export interface Result<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface CreateContainerResult extends Result {
  containerId?: string;
}

export interface BulkOperationResult {
  total: number;
  succeeded: number;
  failed: string[];
}

export interface SystemStatus {
  docker: boolean;
  ip: string;
  configPath: string;
}

export interface ContainerInfo {
  name: string;
  status: string;
  port: string;
}

export type ConnectionFormat = 'full' | 'command' | 'url' | 'password';

export interface NetworkInterface {
  name: string;
  address: string;
  netmask: string;
  mac: string;
  cidr: string;
  isVPN: boolean;
}
