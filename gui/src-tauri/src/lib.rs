use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

const SFTP_IMAGE: &str = "atmoz/sftp";
const CONFIG_FILE: &str = "sftp-servers.json";
const NETWORK_CONFIG_FILE: &str = "network-config.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredCredentials {
    pub username: String,
    pub password: String,
    pub host_path: String,
    pub container_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct NetworkConfig {
    pub preferred_interface: Option<String>,
    pub preferred_ip: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkInterface {
    pub name: String,
    pub address: String,
    pub is_vpn: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub current_ip: String,
    pub current_interface: Option<String>,
    pub is_vpn: bool,
    pub preferred_ip: Option<String>,
    pub preferred_interface: Option<String>,
    pub interfaces: Vec<NetworkInterface>,
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

fn get_network_config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("sftp-manager");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join(NETWORK_CONFIG_FILE)
}

fn load_network_config() -> NetworkConfig {
    let path = get_network_config_path();
    if let Ok(content) = fs::read_to_string(&path) {
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        NetworkConfig::default()
    }
}

fn save_network_config(config: &NetworkConfig) {
    let path = get_network_config_path();
    if let Ok(content) = serde_json::to_string_pretty(config) {
        fs::write(path, content).ok();
    }
}

fn is_vpn_interface(name: &str) -> bool {
    let vpn_patterns = [
        "zerotier", "tailscale", "wireguard", "wg0", "wg1",
        "tun", "tap", "vpn", "hamachi", "radmin"
    ];
    let name_lower = name.to_lowercase();
    vpn_patterns.iter().any(|p| name_lower.contains(p))
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
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

    // Get network config to bind to specific IP
    let network_config = load_network_config();
    let interfaces = list_network_interfaces_internal();
    let (bind_ip, _, _) = get_current_ip_internal(&interfaces, &network_config);

    let port_mapping = format!("{}:{}:22", bind_ip, config.port);
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

#[tauri::command]
fn list_files(name: String, path: String) -> Result<Vec<FileEntry>, String> {
    // Only allow atmoz/sftp containers
    if !is_sftp_container(&name) {
        return Err("Not an SFTP container".to_string());
    }

    // Use docker exec to list files inside the container
    let output = run_command("docker", &["exec", &name, "ls", "-la", &path])?;

    let mut entries: Vec<FileEntry> = Vec::new();

    for line in output.lines().skip(1) {
        // Skip "total X" line
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 9 {
            continue;
        }

        let permissions = parts[0];
        let size: u64 = parts[4].parse().unwrap_or(0);
        let name_part = parts[8..].join(" ");

        // Skip . and ..
        if name_part == "." || name_part == ".." {
            continue;
        }

        let is_dir = permissions.starts_with('d');
        let full_path = if path == "/" {
            format!("/{}", name_part)
        } else {
            format!("{}/{}", path.trim_end_matches('/'), name_part)
        };

        entries.push(FileEntry {
            name: name_part,
            path: full_path,
            is_dir,
            size,
        });
    }

    // Sort: directories first, then by name
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

fn list_network_interfaces_internal() -> Vec<NetworkInterface> {
    let mut interfaces: Vec<NetworkInterface> = Vec::new();

    // Add 0.0.0.0 option for all interfaces
    interfaces.push(NetworkInterface {
        name: "All Interfaces".to_string(),
        address: "0.0.0.0".to_string(),
        is_vpn: false,
    });

    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = run_command("powershell", &[
            "-Command",
            "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.PrefixOrigin -ne 'WellKnown'} | Select-Object InterfaceAlias,IPAddress | ForEach-Object { $_.InterfaceAlias + '|' + $_.IPAddress }"
        ]) {
            for line in output.lines() {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 2 {
                    let name = parts[0].trim().to_string();
                    let address = parts[1].trim().to_string();
                    if !address.starts_with("127.") && !address.is_empty() {
                        let is_vpn = is_vpn_interface(&name);
                        interfaces.push(NetworkInterface { name, address, is_vpn });
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = run_command("sh", &["-c", "ifconfig | grep -E '^[a-z]|inet ' | paste - - 2>/dev/null"]) {
            for line in output.lines() {
                if let (Some(name_part), Some(inet_part)) = (line.split_whitespace().next(), line.split("inet ").nth(1)) {
                    let name = name_part.trim_end_matches(':').to_string();
                    if let Some(addr) = inet_part.split_whitespace().next() {
                        if !addr.starts_with("127.") {
                            let is_vpn = is_vpn_interface(&name);
                            interfaces.push(NetworkInterface { name, address: addr.to_string(), is_vpn });
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = run_command("sh", &["-c", "ip -4 addr show | grep -E '^[0-9]+:|inet '"]) {
            let mut current_iface = String::new();
            for line in output.lines() {
                if line.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                    if let Some(name) = line.split(':').nth(1) {
                        current_iface = name.trim().to_string();
                    }
                } else if line.contains("inet ") {
                    if let Some(addr_part) = line.split("inet ").nth(1) {
                        if let Some(addr) = addr_part.split('/').next() {
                            if !addr.starts_with("127.") && !current_iface.is_empty() {
                                let is_vpn = is_vpn_interface(&current_iface);
                                interfaces.push(NetworkInterface {
                                    name: current_iface.clone(),
                                    address: addr.to_string(),
                                    is_vpn,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    interfaces
}

fn get_current_ip_internal(interfaces: &[NetworkInterface], config: &NetworkConfig) -> (String, Option<String>, bool) {
    // 1. Check preferred IP
    if let Some(ref preferred_ip) = config.preferred_ip {
        if let Some(iface) = interfaces.iter().find(|i| &i.address == preferred_ip) {
            return (iface.address.clone(), Some(iface.name.clone()), iface.is_vpn);
        }
    }

    // 2. Check preferred interface
    if let Some(ref preferred_iface) = config.preferred_interface {
        if let Some(iface) = interfaces.iter().find(|i| &i.name == preferred_iface) {
            return (iface.address.clone(), Some(iface.name.clone()), iface.is_vpn);
        }
    }

    // 3. First non-VPN interface
    if let Some(iface) = interfaces.iter().find(|i| !i.is_vpn) {
        return (iface.address.clone(), Some(iface.name.clone()), false);
    }

    // 4. Any interface
    if let Some(iface) = interfaces.first() {
        return (iface.address.clone(), Some(iface.name.clone()), iface.is_vpn);
    }

    ("127.0.0.1".to_string(), None, false)
}

#[tauri::command]
fn list_network_interfaces() -> Vec<NetworkInterface> {
    list_network_interfaces_internal()
}

#[tauri::command]
fn get_network_info() -> NetworkInfo {
    let config = load_network_config();
    let interfaces = list_network_interfaces_internal();
    let (current_ip, current_interface, is_vpn) = get_current_ip_internal(&interfaces, &config);

    NetworkInfo {
        current_ip,
        current_interface,
        is_vpn,
        preferred_ip: config.preferred_ip,
        preferred_interface: config.preferred_interface,
        interfaces,
    }
}

#[tauri::command]
fn set_network_preference(ip: Option<String>, interface: Option<String>) -> CommandResult {
    let mut config = load_network_config();

    if let Some(ip_val) = ip {
        config.preferred_ip = Some(ip_val);
        config.preferred_interface = None;
    } else if let Some(iface_val) = interface {
        config.preferred_interface = Some(iface_val);
        config.preferred_ip = None;
    }

    save_network_config(&config);
    CommandResult { success: true, error: None }
}

#[tauri::command]
fn clear_network_preference() -> CommandResult {
    save_network_config(&NetworkConfig::default());
    CommandResult { success: true, error: None }
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
            list_files,
            list_network_interfaces,
            get_network_info,
            set_network_preference,
            clear_network_preference,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
