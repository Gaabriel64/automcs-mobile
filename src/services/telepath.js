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

const TELEPATH_VERSION = '1.2.2';

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

  _hostPayload() {
    return { host: this.clientHost, user: this.clientUser, session_id: this.sessionId || '', 'telepath-version': TELEPATH_VERSION, };
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

  // Supprime un profil (si besoin)
  async removeProfile(host, port) {
    const key = `${host}:${port}`;
    let profiles = await this.getProfiles();
    profiles = profiles.filter(p => `${p.host}:${p.port}` !== key);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }

  // Tente de se connecter sur chaque profil connu ; retourne true si un profil fonctionne
  async tryReconnect() {
    const profiles = await this.getProfiles();
    if (profiles.length === 0) return false;
    
    for (const profile of profiles) {
      // Injecte les paramètres du profil dans le service
      this.host = profile.host;
      this.port = profile.port;
      this.token = profile.token;
      this.sessionId = profile.sessionId;
      this.clientHost = profile.clientHost || 'mobile-app';
      this.clientUser = profile.clientUser || 'mobile-user';
      
      try {
        const status = await this.checkStatus(); // GET /telepath/check_status
        if (status) {
          // Si le token est encore valide, on appelle login pour en obtenir un nouveau si besoin
          const data = await this.login();
          if (data?.['access-token']) {
            await this.saveSession();
            return true; // reconnexion réussie
          }
        }
      } catch {
        // échec silencieux, on passe au profil suivant
        continue;
      }
    }
    return false; // aucun profil n'a fonctionné
  }

  async _fetch(endpoint, options = {}, timeoutMs = 8000) {
    const url = `${this.baseUrl}/${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(url, { ...options, headers: { ...headers, ...options.headers }, signal: controller.signal });
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(`Timeout — impossible de joindre ${this.host}:${this.port}`);
      throw new Error(`Réseau inaccessible : ${e.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try { const j = await response.json(); detail = j.detail || detail; } catch {}
      throw new Error(detail);
    }

    const text = await response.text();
    try { return JSON.parse(text); } catch { return text; }
  }

  // GET shorthand
  _get(endpoint) { return this._fetch(endpoint); }
  // POST shorthand
  _post(endpoint, body) { return this._fetch(endpoint, { method: 'POST', body: JSON.stringify(body) }); }

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