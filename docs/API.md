# SFTP Manager API Specification

> Framework-agnostic API for Tauri/Electron IPC integration

## Overview

Core API는 `core/index.js`에 정의되어 있으며, GUI 프레임워크(Tauri/Electron)의 IPC를 통해 호출됩니다.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   GUI Frontend  │────▶│   IPC Bridge    │────▶│    Core API     │
│   (React/Vue)   │◀────│ (Tauri/Electron)│◀────│   (Node.js)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## IPC Commands

### Server Management

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `create_server` | CreateServerOptions | ServerResult | 새 SFTP 서버 생성 |
| `list_servers` | - | ServerInfo[] | 모든 서버 목록 |
| `get_server` | name: string | ServerInfo \| null | 서버 상세 정보 |
| `start_server` | name: string | Result | 서버 시작 |
| `stop_server` | name: string | Result | 서버 중지 |
| `remove_server` | name: string | Result | 서버 삭제 |
| `start_all_servers` | - | BatchResult | 모든 서버 시작 |
| `stop_all_servers` | - | BatchResult | 모든 서버 중지 |

### Connection Info

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `get_connection_info` | name: string | ConnectionInfo | 접속 정보 |
| `format_connection_info` | name, format | string | 포맷된 접속 정보 |

### System

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `get_system_status` | - | SystemStatus | 시스템 상태 |
| `get_server_logs` | name, lines? | string | 서버 로그 |

---

## Type Definitions

### CreateServerOptions

```typescript
interface CreateServerOptions {
  name: string;           // Container name (required)
  port?: number;          // SFTP port (auto-assigned if empty)
  hostPath: string;       // Host folder path (required)
  containerPath?: string; // Container mount path (default: /home/user/files)
  username: string;       // SFTP username (required)
  password?: string;      // Password (auto-generated if empty)
  uid?: number;           // User ID (default: 1001)
}
```

### ServerInfo

```typescript
interface ServerInfo {
  name: string;
  port: number;
  hostPath: string;
  containerPath: string;
  username: string;
  password: string;
  status: 'running' | 'stopped' | 'not created';
  createdAt: string; // ISO date
}
```

### ConnectionInfo

```typescript
interface ConnectionInfo {
  host: string;     // Local IP address
  port: number;     // SFTP port
  username: string;
  password: string;
  command: string;  // sftp -P port user@host
  url: string;      // sftp://user:pass@host:port
}
```

### Result

```typescript
interface Result {
  success: boolean;
  error?: string;
}

interface ServerResult extends Result {
  server?: ServerInfo;
}

interface BatchResult {
  total: number;
  success: number;
  failed: string[];
}
```

### SystemStatus

```typescript
interface SystemStatus {
  docker: boolean;  // Docker available
  ip: string;       // Local IP
  configPath: string;
}
```

---

## Tauri Integration Example

```rust
// src-tauri/src/main.rs
#[tauri::command]
async fn list_servers() -> Result<Vec<ServerInfo>, String> {
    // Call Node.js sidecar or use Docker API directly
}

#[tauri::command]
async fn create_server(options: CreateServerOptions) -> Result<ServerResult, String> {
    // ...
}
```

## Electron Integration Example

```javascript
// main.js (Main Process)
const { ipcMain } = require('electron');
const api = require('./core');

ipcMain.handle('list_servers', async () => {
  return await api.listServers();
});

ipcMain.handle('create_server', async (event, options) => {
  return await api.createServer(options);
});
```

```javascript
// renderer.js (Renderer Process)
const servers = await window.electronAPI.listServers();
```

---

## Format Options

`format_connection_info`의 format 파라미터:

| Format | Output Example |
|--------|---------------|
| `full` | `Host: 192.168.0.10\nPort: 2222\nUser: admin\nPass: abc123` |
| `command` | `sftp -P 2222 admin@192.168.0.10` |
| `url` | `sftp://admin:abc123@192.168.0.10:2222` |
| `password` | `abc123` |
