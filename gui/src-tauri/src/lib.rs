use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

const SFTP_IMAGE: &str = "atmoz/sftp";
const CONFIG_FILE: &str = "sftp-servers.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredCredentials {
    pub username: String,
    pub password: String,
    pub host_path: String,
    pub container_path: String,
}

fn get_config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("sftp-manager");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join(CONFIG_FILE)
}

fn load_credentials() -> HashMap<String, StoredCredentials> {
    let path = get_config_path();
    if let Ok(content) = fs::read_to_string(&path) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        HashMap::new()
    }
}

fn save_credentials(creds: &HashMap<String, StoredCredentials>) {
    let path = get_config_path();
    if let Ok(content) = serde_json::to_string_pretty(creds) {
        fs::write(path, content).ok();
    }
}

fn store_server_credentials(name: &str, creds: StoredCredentials) {
    let mut all_creds = load_credentials();
    all_creds.insert(name.to_string(), creds);
    save_credentials(&all_creds);
}

fn remove_server_credentials(name: &str) {
    let mut all_creds = load_credentials();
    all_creds.remove(name);
    save_credentials(&all_creds);
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerConfig {
    pub name: String,
    pub port: u16,
    pub host_path: String,
    pub container_path: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerInfo {
    pub name: String,
    pub port: u16,
    pub host_path: String,
    pub container_path: String,
    pub username: String,
    pub password: String,
    pub status: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateResult {
    pub success: bool,
    pub server: Option<ServerInfo>,
    pub error: Option<String>,
}

// Docker helper functions
fn run_command(cmd: &str, args: &[&str]) -> Result<String, String> {
    Command::new(cmd)
        .args(args)
        .output()
        .map_err(|e| e.to_string())
        .and_then(|output| {
            if output.status.success() {
                Ok(String::from_utf8_lossy(&output.stdout).to_string())
            } else {
                Err(String::from_utf8_lossy(&output.stderr).to_string())
            }
        })
}

/// Check if a container is using atmoz/sftp image
fn is_sftp_container(name: &str) -> bool {
    if let Ok(output) = run_command("docker", &["inspect", "--format", "{{.Config.Image}}", name]) {
        let image = output.trim();
        return image == SFTP_IMAGE || image.starts_with(&format!("{}:", SFTP_IMAGE));
    }
    false
}

#[tauri::command]
fn check_docker() -> bool {
    run_command("docker", &["--version"]).is_ok()
}

#[tauri::command]
fn get_local_ip() -> String {
    // Cross-platform: Try different methods to get local IP

    // Method 1: Use hostname command (works on macOS/Linux/Windows)
    if let Ok(output) = run_command("hostname", &["-I"]) {
        // Linux: returns space-separated IPs
        if let Some(ip) = output.trim().split_whitespace().next() {
            if !ip.is_empty() && ip != "127.0.0.1" {
                return ip.to_string();
            }
        }
    }

    // Method 2: macOS - use ipconfig getifaddr
    #[cfg(target_os = "macos")]
    {
        // Try common interface names on macOS
        for iface in &["en0", "en1", "en2"] {
            if let Ok(output) = run_command("ipconfig", &["getifaddr", iface]) {
                let ip = output.trim();
                if !ip.is_empty() {
                    return ip.to_string();
                }
            }
        }
    }

    // Method 3: Windows - use PowerShell
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = run_command("powershell", &[
            "-Command",
            "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike '*Loopback*' -and $_.PrefixOrigin -eq 'Dhcp'}).IPAddress | Select-Object -First 1"
        ]) {
            let ip = output.trim().to_string();
            if !ip.is_empty() {
                return ip;
            }
        }
    }

    // Fallback
    "127.0.0.1".to_string()
}

#[tauri::command]
fn list_servers() -> Vec<ServerInfo> {
    // Load stored credentials
    let stored_creds = load_credentials();

    // List only atmoz/sftp containers
    let result = run_command("docker", &[
        "ps", "-a",
        "--filter", &format!("ancestor={}", SFTP_IMAGE),
        "--format", "{{.Names}}|{{.Status}}|{{.Ports}}"
    ]);

    match result {
        Ok(output) => {
            if output.trim().is_empty() {
                return vec![];
            }

            output.trim().lines().filter_map(|line| {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 3 {
                    let name = parts[0].to_string();
                    let status = if parts[1].contains("Up") { "running" } else { "stopped" };
                    let port = extract_port(parts[2]);

                    // Get stored credentials for this server
                    let (username, password, host_path, container_path) =
                        if let Some(creds) = stored_creds.get(&name) {
                            (creds.username.clone(), creds.password.clone(),
                             creds.host_path.clone(), creds.container_path.clone())
                        } else {
                            (String::new(), String::new(), String::new(), String::new())
                        };

                    Some(ServerInfo {
                        name,
                        port,
                        host_path,
                        container_path,
                        username,
                        password,
                        status: status.to_string(),
                        created_at: None,
                    })
                } else {
                    None
                }
            }).collect()
        },
        Err(_) => vec![]
    }
}

fn extract_port(ports_str: &str) -> u16 {
    // Parse "0.0.0.0:2222->22/tcp" format
    if let Some(start) = ports_str.find(':') {
        if let Some(end) = ports_str.find("->") {
            if let Ok(port) = ports_str[start+1..end].parse() {
                return port;
            }
        }
    }
    0
}

#[tauri::command]
fn create_server(config: ServerConfig) -> CreateResult {
    let host_path = config.host_path.replace('\\', "/");

    let port_mapping = format!("{}:22", config.port);
    let volume_mapping = format!("{}:{}", host_path, config.container_path);
    let user_config = format!("{}:{}:1001", config.username, config.password);

    let result = run_command("docker", &[
        "run", "-d",
        "--name", &config.name,
        "-p", &port_mapping,
        "-v", &volume_mapping,
        "--restart", "unless-stopped",
        SFTP_IMAGE,
        &user_config
    ]);

    match result {
        Ok(_) => {
            // Store credentials for later retrieval
            store_server_credentials(&config.name, StoredCredentials {
                username: config.username.clone(),
                password: config.password.clone(),
                host_path: config.host_path.clone(),
                container_path: config.container_path.clone(),
            });

            CreateResult {
                success: true,
                server: Some(ServerInfo {
                    name: config.name,
                    port: config.port,
                    host_path: config.host_path,
                    container_path: config.container_path,
                    username: config.username,
                    password: config.password,
                    status: "running".to_string(),
                    created_at: None,
                }),
                error: None,
            }
        },
        Err(e) => CreateResult {
            success: false,
            server: None,
            error: Some(e),
        }
    }
}

#[tauri::command]
fn start_server(name: String) -> CommandResult {
    // Only allow atmoz/sftp containers
    if !is_sftp_container(&name) {
        return CommandResult {
            success: false,
            error: Some("Not an SFTP container (atmoz/sftp)".to_string()),
        };
    }

    match run_command("docker", &["start", &name]) {
        Ok(_) => CommandResult { success: true, error: None },
        Err(e) => CommandResult { success: false, error: Some(e) },
    }
}

#[tauri::command]
fn stop_server(name: String) -> CommandResult {
    // Only allow atmoz/sftp containers
    if !is_sftp_container(&name) {
        return CommandResult {
            success: false,
            error: Some("Not an SFTP container (atmoz/sftp)".to_string()),
        };
    }

    match run_command("docker", &["stop", &name]) {
        Ok(_) => CommandResult { success: true, error: None },
        Err(e) => CommandResult { success: false, error: Some(e) },
    }
}

#[tauri::command]
fn remove_server(name: String) -> CommandResult {
    // Only allow atmoz/sftp containers
    if !is_sftp_container(&name) {
        return CommandResult {
            success: false,
            error: Some("Not an SFTP container (atmoz/sftp)".to_string()),
        };
    }

    match run_command("docker", &["rm", "-f", &name]) {
        Ok(_) => {
            // Remove stored credentials
            remove_server_credentials(&name);
            CommandResult { success: true, error: None }
        },
        Err(e) => CommandResult { success: false, error: Some(e) },
    }
}

#[tauri::command]
fn get_container_status(name: String) -> String {
    // Only check atmoz/sftp containers
    if !is_sftp_container(&name) {
        return "not sftp".to_string();
    }

    match run_command("docker", &["inspect", "--format", "{{.State.Status}}", &name]) {
        Ok(status) => status.trim().to_string(),
        Err(_) => "not created".to_string(),
    }
}

#[tauri::command]
fn get_container_logs(name: String, lines: u32) -> String {
    // Only allow atmoz/sftp containers
    if !is_sftp_container(&name) {
        return "Not an SFTP container".to_string();
    }

    match run_command("docker", &["logs", "--tail", &lines.to_string(), &name]) {
        Ok(logs) => logs,
        Err(e) => e,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            check_docker,
            get_local_ip,
            list_servers,
            create_server,
            start_server,
            stop_server,
            remove_server,
            get_container_status,
            get_container_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
