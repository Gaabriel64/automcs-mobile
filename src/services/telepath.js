import AsyncStorage from '@react-native-async-storage/async-storage';
import forge from 'node-forge';

const STORAGE_KEYS = {
  HOST: 'telepath_host',
  PORT: 'telepath_port',
  TOKEN: 'telepath_token',
  SESSION_ID: 'telepath_session_id',
  CLIENT_HOST: 'telepath_client_host',
  CLIENT_USER: 'telepath_client_user',
  PROFILES: 'telepath_profiles',  // stockera un tableau de profils
};

// Versions de l'API Telepath que l'app sait parler (la première est la préférée).
// auto-mcs exige une égalité stricte avec sa propre version et ne négocie rien :
// 1.3.4 = branche ui-fixes/dev (prochaine version), 1.3.3 = dev avant le 5 oct. 2026,
// 1.2.2 = version actuelle de main. Une version n'est ajoutée ici qu'après avoir lu
// ce qui a changé dans l'API (1.3.3 → 1.3.4 : addon_state/script_state gagnent
// un paramètre optionnel `all`, rétrocompatible).
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

  // Version Telepath à annoncer à ce serveur (celle qu'il nous a demandée, sinon la préférée)
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

  // Récupère tous les profils sauvegardés
  async getProfiles() {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.PROFILES);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  // Ajoute ou met à jour un profil (clé = host:port)
  async saveProfile(profile) {
    const key = `${profile.host}:${profile.port}`;
    const profiles = await this.getProfiles();
    const idx = profiles.findIndex(p => `${p.host}:${p.port}` === key);
    if (idx !== -1) profiles[idx] = profile;
    else profiles.unshift(profile); // insère en premier (le plus récent)
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }

  // Test rapide avec timeout court
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

  // Supprime un profil (si besoin)
  async removeProfile(host, port) {
    const key = `${host}:${port}`;
    let profiles = await this.getProfiles();
    profiles = profiles.filter(p => `${p.host}:${p.port}` !== key);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }

  // Tente de se connecter sur chaque profil connu ; retourne true si un profil fonctionne
  async tryReconnect() {
    this.lastReconnectError = null;
    const profiles = await this.getProfiles();
    if (profiles.length === 0) return false;
    
    // Lancer tous les tests en parallèle
    const results = await Promise.all(
      profiles.map(async (profile) => {
        const reachable = await this._quickCheck(profile.host, profile.port);
        return { profile, reachable };
      })
    );
    
    // Chercher le premier profil joignable
    const found = results.find(r => r.reachable);
    if (!found) return false;
    
    // Utiliser ce profil
    const { profile } = found;
    this.host = profile.host;
    this.port = profile.port;
    this.token = profile.token;
    this.sessionId = profile.sessionId;
    this.clientHost = profile.clientHost || 'mobile-app';
    this.clientUser = profile.clientUser || 'mobile-user';
    
    // Tenter le login (garde le timeout normal ici, car on sait que le serveur répond)
    try {
      const data = await this.login();
      if (data?.['access-token']) {
        await this.saveSession();
        return true;
      }
    } catch (e) {
      // Mémorisé pour que l'UI puisse expliquer l'échec (ex. version Telepath incompatible)
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
      if (e.name === 'AbortError') throw new Error(`Timeout — impossible de joindre ${this.host}:${this.port}`);
      throw new Error(`Réseau inaccessible : ${e.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try { const j = await response.json(); detail = j.detail || detail; } catch {}

      // auto-mcs refuse login et pairing si les versions Telepath diffèrent (égalité stricte)
      // et indique la sienne : « API versions do not match. Server - v1.2.2 » (login) ou
      // « API versions do not match - server is v1.3.3 » (pairing).
      const mismatch = /versions do not match.*?v?(\d+(?:\.\d+)+)/i.exec(String(detail));
      if (mismatch) {
        const serverVersion = mismatch[1];

        // Version qu'on sait parler : on la retient pour ce serveur et on rejoue la requête une fois
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
          `Version Telepath incompatible : le serveur est en v${serverVersion}, ` +
          `cette app gère v${SUPPORTED_TELEPATH_VERSIONS.join(' et v')}. Mets à jour l'app (ou auto-mcs).`
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

  // ── Addons : compatibilité avec auto-mcs officiel (sans patch serveur) ─────
  // Côté serveur, delete_addon / addon_state attendent un objet avec `.path`.
  // Le serveur sait reconstruire un objet depuis un dict marqué `__reconstruct__`
  // (c'est ce que fait le client desktop). On retrouve donc l'addon installé
  // dans la liste FRAÎCHE (le `path` change quand on active/désactive un mod) et
  // on le renvoie avec les marqueurs attendus.
  async _resolveInstalledAddon(ref) {
    const id = String(ref?.id ?? (typeof ref === 'string' ? ref : '')).trim().toLowerCase();
    const name = String(ref?.name ?? '').trim().toLowerCase();

    const list = await this._get('AddonManager/return_single_list');
    const found = (Array.isArray(list) ? list : []).find(a =>
      (id && a.id?.toLowerCase() === id) || (name && a.name?.toLowerCase() === name)
    );
    if (!found) throw new Error('Mod introuvable parmi les mods installés du serveur');

    // Sans `path` (liste inattendue) : repli sur l'id seul, ce qui fonctionne
    // avec les serveurs qui acceptent un nom/id (ex. le fork de Gaabriel64).
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
}

export const telepathService = new TelepathService();