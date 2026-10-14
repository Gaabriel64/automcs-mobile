# auto-mcs Remote

A mobile application built with React Native and Expo to remotely manage Minecraft servers powered by **auto-mcs** through the **Telepath API**.

> ⚠️ This project requires an auto-mcs server with the Telepath API enabled (a modified or official version supporting `delete_addon` by name/ID).

---

## ✨ Features

- 🔐 **Secure authentication** via code-based pairing (RSA + JWT)
- 🖥️ **Multi-server management** with favorites
- 📜 **Real-time remote console** (commands and logs)
- 👥 **Connected player list** with kick functionality
- 📊 **Server statistics** (CPU, RAM, uptime, player count)
- 🧩 **Mod management**:
  - Search for mods on Modrinth and Hangar
  - Automatic filtering by server type (Fabric, Forge, Quilt, NeoForge, etc.)
  - Import mods from local files
  - Enable and disable mods
  - Delete mods
  - Check compatibility with the server version
- ⚙️ **Server settings**:
  - Full `server.properties` configuration
  - auto-mcs configuration (`auto-mcs.ini`): RAM allocation, automatic updates, Java flags, and maximum backups
- 💾 **Backups**: create, list, and restore backups
- 🌐 **Automatic reconnection** with multiple connection profiles (local IP, Tailscale, or remote connection)
- 🎨 **Native dark theme**

---

## 📋 Requirements

### Mobile development
- Node.js ≥ 18
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- A phone running **Expo Go** for development, or an EAS build

### Server
- **auto-mcs** installed and running
- **Telepath API enabled** (Settings → Telepath → *Share this instance*)
- Port **7001** accessible from your phone:
  - **Local network:** Allow TCP port 7001 through your firewall
  - **Remote access:** Use Tailscale, a VPN, or port forwarding
- A server version with the `delete_addon`/`addon_state` fix supporting add-ons by name/ID  
  (see the *Server Compatibility* section below)

---

## 🚀 Installation

```bash
git clone <repository-url>
cd automcs-mobile
npm install
```