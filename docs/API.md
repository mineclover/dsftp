# SFTP Manager API Specification

> Tauri 2.0 Rust Backend API

## Overview

Tauri 백엔드는 `gui/src-tauri/src/lib.rs`에 Rust로 구현되어 있으며, React 프론트엔드에서 `@tauri-apps/api/core`의 `invoke`를 통해 호출합니다.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Frontend │────▶│   Tauri IPC     │────▶│   Rust Backend  │
│   (TypeScript)   │◀────│   (invoke)      │◀────│   (Docker API)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Tauri Commands

### Server Management

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `create_server` | config: ServerConfig | CommandResult | 새 SFTP 서버 생성 |
| `list_servers` | - | Vec<ServerInfo> | 모든 서버 목록 |
| `start_server` | name: String | CommandResult | 서버 시작 |
| `stop_server` | name: String | CommandResult | 서버 중지 |
| `remove_server` | name: String | CommandResult | 서버 삭제 |

### System

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `check_docker` | - | bool | Docker 사용 가능 여부 |
| `get_local_ip` | - | String | 로컬 IP 주소 |
| `get_container_logs` | name, lines | String | 컨테이너 로그 |

---

## Type Definitions

### ServerConfig (Frontend → Backend)

```typescript
interface ServerConfig {
  name: string;           // Container name (required)
  port: number;           // SFTP port (required)
  host_path: string;      // Host folder path (required)
  container_path: string; // Container mount path
  username: string;       // SFTP username (required)
  password: string;       // Password (required)
}
```

### ServerInfo (Backend → Frontend)

```typescript
interface ServerInfo {
  name: string;
  port: number;
  host_path: string;      // snake_case (Rust convention)
  container_path: string;
  username: string;
  password: string;       // Loaded from credential store
  status: 'running' | 'stopped' | 'creating';
}
```

### CommandResult

```typescript
interface CommandResult {
  success: boolean;
  error?: string;
}
```

---

## Frontend Usage

```typescript
import { invoke } from '@tauri-apps/api/core';

// List servers
const servers = await invoke<ServerInfo[]>('list_servers');

// Create server
const result = await invoke<CommandResult>('create_server', { config });

// Start/Stop/Remove
await invoke<CommandResult>('start_server', { name: 'my-server' });
await invoke<CommandResult>('stop_server', { name: 'my-server' });
await invoke<CommandResult>('remove_server', { name: 'my-server' });

// Get logs (lazy-loaded on user request)
const logs = await invoke<string>('get_container_logs', { name: 'my-server', lines: 30 });
```

---

## Credential Storage

자격 증명은 Rust 백엔드에서 로컬 파일에 저장됩니다:

- **Windows**: `%APPDATA%\sftp-manager\sftp-servers.json`
- **macOS**: `~/Library/Application Support/sftp-manager/sftp-servers.json`
- **Linux**: `~/.config/sftp-manager/sftp-servers.json`

Docker 컨테이너에는 비밀번호가 저장되지 않으므로, 앱에서 별도로 관리합니다.

---

## Async Operation Flow

모든 Docker 작업은 비동기로 처리되며, 프론트엔드에서는 Action State를 통해 UI를 관리합니다:

```typescript
// Action State Structure
interface ActionState {
  [serverName: string]: {
    type: 'starting' | 'stopping' | 'removing' | 'creating';
    error?: string;  // Set on failure
  }
}

// Flow
1. setAction(name, type)      // UI shows loading state
2. invoke(command, args)      // Async IPC call
3a. clearAction(name)         // Success: refresh servers
3b. setActionError(name, type, error)  // Failure: show error
```
