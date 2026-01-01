# SFTP Manager

Docker 기반 SFTP 서버를 쉽게 관리할 수 있는 데스크톱 앱입니다.

## Features

- **Tauri 2.0 GUI**: React + Rust 기반 네이티브 데스크톱 앱
- **Docker Integration**: atmoz/sftp 이미지를 사용한 SFTP 서버 관리
- **Native Folder Picker**: OS 네이티브 폴더 선택 다이얼로그
- **Async Operations**: 모든 Docker 작업 비동기 처리 (UI 블로킹 없음)
- **Credential Storage**: 자격 증명 로컬 저장
- **Dark Mode**: 다크/라이트 테마 지원
- **CLI & TUI**: 명령줄 및 터미널 UI 지원

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (Tauri 빌드용)

### Run GUI

```bash
cd gui
npm install
npm run tauri:dev
```

### Run CLI

```bash
npm install
node cli/index.js --help
```

### Run TUI

```bash
node cli/tui.js
```

## Project Structure

```
E:\NAS\
├── gui/                    # Tauri GUI 앱
│   ├── src/               # React 컴포넌트
│   │   ├── App.jsx        # 메인 앱 (상태 관리)
│   │   └── components/    # UI 컴포넌트
│   └── src-tauri/         # Rust 백엔드
│       └── src/lib.rs     # Tauri 커맨드
├── cli/                   # CLI 도구
│   ├── index.js          # Commander.js CLI
│   └── tui.js            # Inquirer TUI
├── core/                  # 공통 로직
│   ├── docker.js         # Docker 명령어
│   └── config.js         # 설정 관리
└── docs/                  # 문서
    ├── API.md            # API 스펙
    ├── UI-SPEC.md        # UI 스펙
    └── MENU.md           # 메뉴 구조
```

## GUI Screenshots

### Server List
- 서버 카드로 상태 표시 (Running/Stopped)
- Start All / Stop All 버튼
- 컨텍스트 메뉴 (Copy, Remove)

### Server Detail
- 접속 정보 (Host, Port, Username, Password)
- Quick Copy (SFTP Command, FileZilla URL)
- Lazy-loading 로그

### Create Server
- 네이티브 폴더 선택
- 자동 비밀번호 생성
- 포트 자동 할당

## API Commands

| Command | Description |
|---------|-------------|
| `list_servers` | 모든 서버 목록 |
| `create_server` | 새 서버 생성 |
| `start_server` | 서버 시작 |
| `stop_server` | 서버 중지 |
| `remove_server` | 서버 삭제 |
| `get_container_logs` | 로그 조회 |
| `check_docker` | Docker 상태 확인 |
| `get_local_ip` | 로컬 IP 조회 |

## Async Architecture

모든 Docker 작업은 비동기로 처리되어 UI가 블로킹되지 않습니다:

```
User Action → setAction(type) → invoke() → clearAction/setError
     ↓              ↓              ↓              ↓
  Click        Show Spinner    Docker API    Update UI
```

Action Types:
- `starting`: 서버 시작 중
- `stopping`: 서버 중지 중
- `removing`: 서버 삭제 중
- `creating`: 서버 생성 중

## License

MIT
