import AsyncStorage from '@react-native-async-storage/async-storage';
import forge from 'node-forge';

const STORAGE_KEYS = {
  HOST: 'telepath_host',
  PORT: 'telepath_port',
  TOKEN: 'telepath_token',
  SESSION_ID: 'telepath_session_id',
  CLIENT_HOST: 'telepath_client_host',
  CLIENT_USER: 'telepath_client_user',
  PROFILES: 'telepath_profiles',  // will store an array of profiles
};

// Telepath API versions this app can speak (the first one is preferred).
// auto-mcs requires an exact match with its own version and does not negotiate:
// 1.3.4 = ui-fixes/dev branch (next version), 1.3.3 = dev before Oct 5, 2026,
// 1.2.2 = current main. A version is only added here after reading what changed in
// the API (1.3.3 -> 1.3.4: addon_state/script_state gained an optional `all`
// parameter, backward compatible).
const SUPPORTED_TELEPATH_VERSIONS = ['1.3.4', '1.3.3', '1.2.2'];
const TELEPATH_VERSION = SUPPORTED_TELEPATH_VERSIONS[0];

async function getUniqueId() {
  let id = await AsyncStorage.getItem('telepath_unique_id');
  if (!id || id.length !== 64) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
    id = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    await AsyncStorage.setItem('telepath_unique_id', id);
  }
  return id;
}

function rsaEncrypt(pemPublicKey, plaintext) {
  const publicKey = forge.pki.publicKeyFromPem(pemPublicKey);
  const encrypted = publicKey.encrypt(plaintext, 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  });
  return forge.util.encode64(encrypted);
}

class TelepathService {
  constructor() {
    this.host = null;
    this.port = 7001;
    this.token = null;
    this.sessionId = null;
    this.clientHost = 'mobile-app';
    this.clientUser = 'mobile-user';
  }

  get baseUrl() {
    return `http://${this.host}:${this.port}`;
  }

  // Telepath version to announce to this server (the one it asked for, else the preferred one)
  _apiVersion() {
    return this._apiVersions?.[`${this.host}:${this.port}`] || TELEPATH_VERSION;
  }

  _hostPayload() {
    return { host: this.clientHost, user: this.clientUser, session_id: this.sessionId || '', 'telepath-version': this._apiVersion(), };
  }

  async loadSaved() {
    try {
      this.host = await AsyncStorage.getItem(STORAGE_KEYS.HOST);
      this.port = parseInt(await AsyncStorage.getItem(STORAGE_KEYS.PORT)) || 7001;
      this.token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      this.sessionId = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_ID);
      this.clientHost = (await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_HOST)) || 'mobile-app';
      this.clientUser = (await AsyncStorage.getItem(STORAGE_KEYS.CLIENT_USER)) || 'mobile-user';
      return !!(this.host && this.token);
    } catch { return false; }
  }

  async saveSession() {
    await AsyncStorage.setItem(STORAGE_KEYS.HOST, this.host || '');
    await AsyncStorage.setItem(STORAGE_KEYS.PORT, String(this.port));
    if (this.token) await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, this.token);
    if (this.sessionId) await AsyncStorage.setItem(STORAGE_KEYS.SESSION_ID, this.sessionId);
    await AsyncStorage.setItem(STORAGE_KEYS.CLIENT_HOST, this.clientHost);
    await AsyncStorage.setItem(STORAGE_KEYS.CLIENT_USER, this.clientUser);
    await this.saveProfile({
      host: this.host,
      port: this.port,
      token: this.token,
      sessionId: this.sessionId,
      clientHost: this.clientHost,
      clientUser: this.clientUser,
      updatedAt: Date.now(),
    });
  }

  async clearSession() {
    this.token = null;
    this.sessionId = null;
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  }

  // Get all saved profiles
  async getProfiles() {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.PROFILES);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  // Add or update a profile (key = host:port)
  async saveProfile(profile) {
    const key = `${profile.host}:${profile.port}`;
    const profiles = await this.getProfiles();
    const idx = profiles.findIndex(p => `${p.host}:${p.port}` === key);
    if (idx !== -1) profiles[idx] = profile;
    else profiles.unshift(profile); // insert first (most recent)
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }

  // Quick test with a short timeout
  async _quickCheck(host, port) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000); // 2 secondes max
    try {
      const response = await fetch(`http://${host}:${port}/telepath/check_status`, {
        signal: controller.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  // Remove a profile (if needed)
  async removeProfile(host, port) {
    const key = `${host}:${port}`;
    let profiles = await this.getProfiles();
    profiles = profiles.filter(p => `${p.host}:${p.port}` !== key);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }

  // Try to connect to every known profile; returns true if one works
  async tryReconnect() {
    this.lastReconnectError = null;
    const profiles = await this.getProfiles();
    if (profiles.length === 0) return false;
    
    // Run all tests in parallel
    const results = await Promise.all(
      profiles.map(async (profile) => {
        const reachable = await this._quickCheck(profile.host, profile.port);
        return { profile, reachable };
      })
    );
    
    // Find the first reachable profile
    const found = results.find(r => r.reachable);
    if (!found) return false;
    
    // Use that profile
    const { profile } = found;
    this.host = profile.host;
    this.port = profile.port;
    this.token = profile.token;
    this.sessionId = profile.sessionId;
    this.clientHost = profile.clientHost || 'mobile-app';
    this.clientUser = profile.clientUser || 'mobile-user';
    
    // Try to log in (normal timeout here, since we know the server answers)
    try {
      const data = await this.login();
      if (data?.['access-token']) {
        await this.saveSession();
        return true;
      }
    } catch (e) {
      // Remembered so the UI can explain the failure (e.g. incompatible Telepath version)
      this.lastReconnectError = e;
    }
    
    return false;
  }

  async _fetch(endpoint, options = {}, timeoutMs = 5000) {
    const { _versionRetried, ...fetchOptions } = options;
    const url = `${this.baseUrl}/${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(url, { ...fetchOptions, headers: { ...headers, ...fetchOptions.headers }, signal: controller.signal });
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(`Timeout: could not reach ${this.host}:${this.port}`);
      throw new Error(`Network unreachable: ${e.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try { const j = await response.json(); detail = j.detail || detail; } catch {}

      // auto-mcs refuses login and pairing when Telepath versions differ (exact match)
      // and reports its own: "API versions do not match. Server - v1.2.2" (login) or
      // « API versions do not match - server is v1.3.3 » (pairing).
      const mismatch = /versions do not match.*?v?(\d+(?:\.\d+)+)/i.exec(String(detail));
      if (mismatch) {
        const serverVersion = mismatch[1];

        // A version we can speak: remember it for this server and replay the request once
        if (SUPPORTED_TELEPATH_VERSIONS.includes(serverVersion) && !_versionRetried && fetchOptions.body) {
          let body = null;
          try { body = JSON.parse(fetchOptions.body); } catch {}
          if (body?.host?.['telepath-version']) {
            this._apiVersions = { ...(this._apiVersions || {}), [`${this.host}:${this.port}`]: serverVersion };
            body.host['telepath-version'] = serverVersion;
            return this._fetch(endpoint, { ...fetchOptions, body: JSON.stringify(body), _versionRetried: true }, timeoutMs);
          }
        }

        const err = new Error(
          `Incompatible Telepath version: the server is v${serverVersion}, ` +
          `this app supports v${SUPPORTED_TELEPATH_VERSIONS.join(' and v')}. Update the app (or auto-mcs).`
        );
        err.code = 'TELEPATH_VERSION_MISMATCH';
        err.serverVersion = serverVersion;
        err.supportedVersions = SUPPORTED_TELEPATH_VERSIONS;
        throw err;
      }
      throw new Error(detail);
    }

    const text = await response.text();
    try { return JSON.parse(text); } catch { return text; }
  }

  // GET shorthand
  _get(endpoint) { return this._fetch(endpoint); }
  // POST shorthand
  _post(endpoint, body) { return this._fetch(endpoint, { method: 'POST', body: JSON.stringify(body) }); }

  // ── Addons: compatibility with official auto-mcs (no server patch) ─────
  // On the server, delete_addon / addon_state expect an object with `.path`.
  // The server can rebuild an object from a dict marked `__reconstruct__`
  // (this is what the desktop client does). So we find the installed addon in the
  // FRESH list (`path` changes when a mod is enabled/disabled) and send it back
  // with the expected markers.
  async _resolveInstalledAddon(ref) {
    const id = String(ref?.id ?? (typeof ref === 'string' ? ref : '')).trim().toLowerCase();
    const name = String(ref?.name ?? '').trim().toLowerCase();

    const list = await this._get('AddonManager/return_single_list');
    const found = (Array.isArray(list) ? list : []).find(a =>
      (id && a.id?.toLowerCase() === id) || (name && a.name?.toLowerCase() === name)
    );
    if (!found) throw new Error('Mod not found among the server\'s installed mods');

    // Without `path` (unexpected list): fall back to the bare id, which works
    // with servers that accept a name/id (e.g. Gaabriel64's fork).
    if (!found.path) return found.id;

    return { ...found, __reconstruct__: 'RemoteAddonFileObject', _telepath_data: found };
  }

  async deleteAddon(ref) {
    const addon = await this._resolveInstalledAddon(ref);
    return this._post('AddonManager/delete_addon', { addon });
  }

  async setAddonState(ref, enabled) {
    const addon = await this._resolveInstalledAddon(ref);
    return this._post('AddonManager/addon_state', { addon, enabled });
  }

  async _buildEncryptedToken() {
    const pem = await this._get('telepath/get_public_key');
    const uniqueId = await getUniqueId();
    return rsaEncrypt(pem, uniqueId);
  }

  // --- Auth ---
  async checkStatus() { return this._get('telepath/check_status'); }

  async requestPair() {
    const token = await this._buildEncryptedToken();
    return this._post('telepath/request_pair', { host: this._hostPayload(), id_hash: { token } });
  }

  async submitPair(code) {
    const token = await this._buildEncryptedToken();
    this.sessionId = 'sess-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const data = await this._fetch(`telepath/submit_pair?code=${encodeURIComponent(code)}`, {
      method: 'POST',
      body: JSON.stringify({ host: this._hostPayload(), id_hash: { token } }),
    });
    if (data?.['access-token']) { this.token = data['access-token']; await this.saveSession(); }
    return data;
  }

  async login() {
    const token = await this._buildEncryptedToken();
    const data = await this._post('telepath/login', { host: this._hostPayload(), id_hash: { token } });
    if (data?.['access-token']) { this.token = data['access-token']; await this.saveSession(); }
    return data;
  }

  async logout() {
    try { await this._post('telepath/logout', { host: this._hostPayload() }); } finally { await this.clearSession(); }
  }

  // --- Server list ---
  async getServerList() { return this._get('main/create_view_list'); }

  // MUST be called before any ServerObject action — associates our IP with the server on the backend
  async openServer(name) {
    return this._post(`main/open_remote_server?name=${encodeURIComponent(name)}`, {});
  }

  // --- ServerObject actions ---
  // launch: fire-and-forget with short timeout (server takes time to start, causes HTTP 500 if we wait)
  async launchServer() {
    try {
      await this._fetch('ServerObject/launch', {
        method: 'POST',
        body: JSON.stringify({ return_telepath: false })
      }, 6000);
    } catch (e) {
      // Accept 500 because the server often starts with an error (?)
      if (!e.message.includes('Timeout') && !e.message.includes('HTTP 500')) {
        throw e;
      }
    }
  }
  async stopServer() { return this._get('ServerObject/stop'); }
  async restartServer() { return this._get('ServerObject/restart'); }
  async sendCommand(cmd) { return this._post('ServerObject/send_command', { cmd }); }
  async getPlayers() { return this._get('ServerObject/get_players'); }
  async getPerformanceStats() { return this._post('ServerObject/performance_stats', { interval: 0.5 }); }
  // _sync_attr exposes run_data (logs + performance + player-list) via POST
  async getRunData() { return this._post('ServerObject/_sync_attr', { name: 'run_data' }); }

  // --- Management of the opened server (call openServer(name) first) ---
  // Long operations (install, delete) get an extended timeout: the server only
  // answers once they are done.
  async getServerAttr(name) { return this._post('ServerObject/_sync_attr', { name }); }
  async reloadConfig() { return this._post('ServerObject/reload_config', {}); }
  async renameServer(newName) { return this._post('ServerObject/rename', { new_name: newName }); }
  async deleteServer() { return this._fetch('ServerObject/delete', {}, 180000); }
  async setAutostart(enabled) { return this._post('ServerObject/enable_autostart', { enabled }); }

  // playit.gg: proxy_installed = agent installed AND account linked
  async proxyInstalled() { return this._get('ServerObject/proxy_installed'); }
  async getPlayitUrl() { return this._get('ServerObject/get_playit_url'); }
  async setProxy(enabled) { return this._post('ServerObject/enable_proxy', { enabled }); }
  async unlinkPlayit() { return this._get('ServerObject/unlink_playit_account'); }
  async linkPlayit(setupCode) {
    return this._fetch('ServerObject/link_playit_account', {
      method: 'POST', body: JSON.stringify({ setup_code: setupCode }),
    }, 120000);
  }

  // --- Backups ---
  // ui-fixes (1.3.x) gave return_backup_list an optional `fetch_metadata` parameter, which makes
  // the endpoint a POST; older servers expose a GET without parameters (405 on POST).
  // metadata is skipped: it opens every backup archive and is not needed for the list.
  async getBackupList() {
    try {
      return await this._post('BackupManager/return_backup_list', { fetch_metadata: false });
    } catch (e) {
      if (/405|not allowed/i.test(String(e?.message))) return this._get('BackupManager/return_backup_list');
      throw e;
    }
  }

  // restore() reads `backup_obj.path` on the server, so it needs an object, not a name:
  // the server rebuilds it from a dict marked `__reconstruct__` (like the desktop client).
  // Returns null when the server is running (restore is refused).
  async restoreBackup(backup) {
    const backup_obj = { ...backup, __reconstruct__: 'RemoteBackupObject', _telepath_data: backup };
    return this._fetch('BackupManager/restore', { method: 'POST', body: JSON.stringify({ backup_obj }) }, 600000);
  }

  // --- Server creation (see services/createServer.js) ---
  async checkFreeSpace() { return this._get('main/check_free_space'); }
  async createCall(endpoint, body, timeoutMs) {
    return this._fetch(endpoint, { method: 'POST', body: JSON.stringify(body ?? {}) }, timeoutMs);
  }

  // Geyser/Floodgate/ViaVersion: downloads or removes the addons on the server
  async installGeyser(install) {
    return this._fetch('AddonManager/_install_geyser', {
      method: 'POST', body: JSON.stringify({ install }),
    }, 300000);
  }
}

export const telepathService = new TelepathService();