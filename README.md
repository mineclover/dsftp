# SFTP Manager (dsftp)

Docker 기반 SFTP 서버를 쉽게 관리할 수 있는 도구입니다.

## Features

- **Tauri 2.0 GUI**: React + TypeScript + Rust 기반 네이티브 데스크톱 앱
- **CLI & TUI**: 명령줄 및 터미널 UI 지원
- **Docker Integration**: atmoz/sftp 이미지를 사용한 SFTP 서버 관리
- **VPN Network Support**: ZeroTier, Tailscale 등 VPN 인터페이스 지원
- **Network Binding**: 특정 네트워크 인터페이스에만 서버 바인딩 가능
- **Dark Mode**: 다크/라이트 테마 지원

## Installation

> **Note**: 현재 릴리즈 바이너리는 제공하지 않습니다. 로컬에서 직접 빌드하여 사용하세요.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (GUI 빌드용)

### Build & Install GUI App

```bash
# 1. 저장소 클론
git clone https://github.com/junwoobang/dsftp.git
cd dsftp

# 2. 의존성 설치
npm install
cd gui && npm install

# 3. 빌드
npm run tauri build

# 4. 설치 (macOS)
open src-tauri/target/release/bundle/dmg/*.dmg

# Windows: src-tauri/target/release/bundle/msi/*.msi
# Linux: src-tauri/target/release/bundle/appimage/*.AppImage
```

### CLI Only (Build)

```bash
npm install
npm run build
```

### Run CLI

```bash
# 도움말
node dist/cli/index.js --help

# 서버 목록
node dist/cli/index.js list

# 서버 생성
node dist/cli/index.js create -n myserver -p ./files -u admin

# 네트워크 설정
node dist/cli/index.js network
node dist/cli/index.js network:set 10.99.13.37
node dist/cli/index.js network:vpn
node dist/cli/index.js network:clear
```

### Run TUI

```bash
node dist/cli/index.js
# 또는
node dist/cli/index.js --tui
```

### Run GUI (Development)

```bash
cd gui
npm run tauri dev
```

## Network / VPN Support

VPN 네트워크 인터페이스를 자동 감지하고 선택할 수 있습니다:

- **ZeroTier**: `ZeroTier One [...]`
- **Tailscale**: `Tailscale`
- **WireGuard**: `wg0`, `wg1`
- **기타**: `tun`, `tap`, `vpn`, `hamachi`, `radmin`

### 네트워크 바인딩

서버 생성 시 선택된 네트워크 IP로 포트가 바인딩됩니다:

```bash
# VPN 전용 (다른 네트워크에서 접근 불가)
100.108.49.90:2222->22/tcp

# 모든 인터페이스 (0.0.0.0)
0.0.0.0:2222->22/tcp
```

## Project Structure

```
dsftp/
├── core/                  # 공통 TypeScript 로직
│   ├── docker.ts         # Docker 명령어, 네트워크 감지
│   ├── config.ts         # 설정 관리
│   ├── index.ts          # API 엔트리포인트
│   └── types.ts          # 타입 정의
├── cli/                   # CLI/TUI
│   ├── index.ts          # Commander.js CLI
│   └── tui.ts            # Inquirer TUI
├── gui/                   # Tauri GUI 앱
│   ├── src/              # React + TypeScript
│   └── src-tauri/        # Rust 백엔드
├── docs/                  # 문서
│   └── MAC_NETWORK_DEBUG.md # Mac 네트워크 감지 디버그 기록
└── dist/                  # 빌드 출력
```

## Development Notes

- **Mac Network Detection**: [Mac 네트워크 인터페이스 감지 문제 해결 시도](docs/MAC_NETWORK_DEBUG.md)
- **Docker Integration**: Tauri 샌드박스 환경에서 Docker 명령어 실행을 위한 PATH 설정 필요

## CLI Commands

| Command                | Description              |
| ---------------------- | ------------------------ |
| `list` / `ls`          | 모든 서버 목록           |
| `create`               | 새 서버 생성             |
| `start <name>`         | 서버 시작                |
| `stop <name>`          | 서버 중지                |
| `remove <name>` / `rm` | 서버 삭제                |
| `info <name>`          | 서버 정보                |
| `copy <name>` / `cp`   | 접속 정보 클립보드 복사  |
| `logs <name>`          | 로그 조회                |
| `start-all`            | 모든 서버 시작           |
| `stop-all`             | 모든 서버 중지           |
| `status`               | 시스템 상태              |
| `network` / `net`      | 네트워크 인터페이스 목록 |
| `network:set <ip>`     | 네트워크 설정            |
| `network:vpn`          | VPN 사용                 |
| `network:clear`        | 네트워크 설정 초기화     |

## GUI Features

### StatusBar Network Selector

- 클릭하여 네트워크 인터페이스 선택
- VPN 인터페이스 노란색 배지 표시
- 실시간 네트워크 목록 조회

### Server Creation

- Username에 따라 Container Path 자동 설정 (`/home/{username}/files`)
- 선택된 네트워크 IP로 포트 바인딩
- 자동 비밀번호 생성

## License

MIT
