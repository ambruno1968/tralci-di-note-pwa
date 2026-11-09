// driveClient.js - Modulo client-side Google Drive per Tralci di Note Android
// Credenziali OAuth pre-integrate nel pacchetto: l'utente deve solo scegliere l'account Google.
'use strict';

(function () {
  const DRIVE_CONFIG_KEY = 'tralci_note_drive_config';
  const DRIVE_TOKEN_KEY = 'tralci_note_drive_token_data';

  const BUNDLED_CLIENT_ID = '1078975750372-goiokfhggk06t2b6s8fr73vfthls1i87.apps.googleusercontent.com';
  const BUNDLED_CLIENT_SECRET = '';
  const FOLDER_NAME_DEFAULT = 'Gestionale Scuola di Musica';

  const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
  const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
  const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
  const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

  const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' ');

  const DEFAULT_CONFIG = {
    clientId: BUNDLED_CLIENT_ID,
    clientSecret: BUNDLED_CLIENT_SECRET,
    folderName: FOLDER_NAME_DEFAULT,
    fileName: 'db.json',
    autoSync: true
  };

  class DriveClient {
    constructor() {
      this.config = this.loadConfig();
      this.status = 'idle';
      this.syncInProgress = false;
      this.cachedFolderId = null;
      this.cachedFolderName = null;
      this.cachedFileId = null;
      this.cachedFileFolderId = null;
    }

    loadConfig() {
      let cfg = { ...DEFAULT_CONFIG };
      try {
        const saved = localStorage.getItem(DRIVE_CONFIG_KEY);
        if (saved) {
          cfg = { ...cfg, ...JSON.parse(saved) };
        }
      } catch (_) {}
      // Forza sempre le credenziali pre-integrate nel pacchetto se non presenti
      cfg.clientId = BUNDLED_CLIENT_ID;
      cfg.clientSecret = BUNDLED_CLIENT_SECRET;
      cfg.folderName = cfg.folderName || FOLDER_NAME_DEFAULT;
      if (cfg.autoSync === undefined) cfg.autoSync = true;
      return cfg;
    }

    saveConfig(cfg = {}) {
      this.config = {
        ...this.config,
        ...cfg,
        clientId: BUNDLED_CLIENT_ID,
        clientSecret: BUNDLED_CLIENT_SECRET,
        folderName: (cfg.folderName ?? this.config.folderName ?? FOLDER_NAME_DEFAULT).trim() || FOLDER_NAME_DEFAULT,
        autoSync: cfg.autoSync !== undefined ? !!cfg.autoSync : (this.config.autoSync ?? true)
      };
      try {
        localStorage.setItem(DRIVE_CONFIG_KEY, JSON.stringify(this.config));
      } catch (_) {}
      return this.getStatus();
    }

    getTokenData() {
      try {
        const saved = localStorage.getItem(DRIVE_TOKEN_KEY);
        if (saved) return JSON.parse(saved);
      } catch (_) {}
      return null;
    }

    saveTokenData(data) {
      try {
        localStorage.setItem(DRIVE_TOKEN_KEY, JSON.stringify(data));
      } catch (_) {}
    }

    disconnect() {
      try {
        localStorage.removeItem(DRIVE_TOKEN_KEY);
      } catch (_) {}
      this.cachedFolderId = null;
      this.cachedFileId = null;
      return this.getStatus();
    }

    setSyncState(state) {
      this.status = state;
      this.syncInProgress = (state !== 'idle');
    }

    updateSyncRecord(success, action, errorMsg = null) {
      const t = this.getTokenData();
      if (!t) return;
      t.lastSync = new Date().toISOString();
      t.lastSyncStatus = success ? 'success' : 'error';
      t.lastSyncAction = action;
      t.lastSyncError = errorMsg;
      this.saveTokenData(t);
    }

    getStatus() {
      const cfg = this.loadConfig();
      const token = this.getTokenData();
      const connected = !!(token && (token.refresh_token || token.access_token));
      return {
        hasCredentials: true, // Sempre vero: ID e Secret sono inclusi nel pacchetto
        clientId: BUNDLED_CLIENT_ID.slice(0, 12) + '••••••••' + BUNDLED_CLIENT_ID.slice(-8),
        rawClientId: BUNDLED_CLIENT_ID,
        hasClientSecret: true,
        folderName: cfg.folderName || FOLDER_NAME_DEFAULT,
        autoSync: cfg.autoSync !== false,
        connected,
        accountEmail: token?.email || '',
        accountName: token?.name || '',
        lastSync: token?.lastSync || null,
        lastSyncStatus: token?.lastSyncStatus || null,
        lastSyncError: token?.lastSyncError || null,
        lastSyncAction: token?.lastSyncAction || null,
        syncInProgress: !!this.syncInProgress,
        syncState: this.status || 'idle'
      };
    }

    startAuth() {
      if (window.Android && typeof window.Android.startGoogleOAuth === 'function') {
        window.Android.startGoogleOAuth(BUNDLED_CLIENT_ID, SCOPES);
        return { started: true };
      }
      throw new Error('Funzione di login nativo Android non disponibile.');
    }

    async handleAuthCallback(code, redirectUri) {
      const body = new URLSearchParams({
        code,
        client_id: BUNDLED_CLIENT_ID,
        client_secret: BUNDLED_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });

      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error_description || data.error || 'Autenticazione con Google fallita.');
      }

      const expiresAt = Date.now() + ((data.expires_in || 3600) - 120) * 1000;
      const tokenData = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || this.getTokenData()?.refresh_token,
        expires_at: expiresAt,
        token_type: data.token_type,
        scope: data.scope
      };

      try {
        const uRes = await fetch(GOOGLE_USERINFO_URL, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        if (uRes.ok) {
          const u = await uRes.json();
          tokenData.email = u.email;
          tokenData.name = u.name;
          tokenData.picture = u.picture;
        }
      } catch (_) {}

      this.saveTokenData(tokenData);
      return tokenData;
    }

    async getValidAccessToken() {
      const tokenData = this.getTokenData();
      if (!tokenData) throw new Error('Nessun account Google collegato.');

      if (tokenData.access_token && tokenData.expires_at && Date.now() < tokenData.expires_at) {
        return tokenData.access_token;
      }

      if (!tokenData.refresh_token) {
        if (window.PwaGoogle) return await window.PwaGoogle.silentRefresh();
        throw new Error('Sessione Google scaduta. Ricollega il tuo account Google.');
      }

      const body = new URLSearchParams({
        client_id: BUNDLED_CLIENT_ID,
        client_secret: BUNDLED_CLIENT_SECRET,
        refresh_token: tokenData.refresh_token,
        grant_type: 'refresh_token'
      });

      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error('Rinnovo sessione Google fallito: ' + (data.error_description || data.error));
      }

      tokenData.access_token = data.access_token;
      tokenData.expires_at = Date.now() + ((data.expires_in || 3600) - 120) * 1000;
      this.saveTokenData(tokenData);
      return tokenData.access_token;
    }

    async findOrCreateFolder(folderName) {
      if (this.cachedFolderId && this.cachedFolderName === folderName) {
        return this.cachedFolderId;
      }
      const accessToken = await this.getValidAccessToken();
      const q = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const searchUrl = `${DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`;

      const res = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Errore ricerca cartella Google Drive: ' + (data.error?.message || res.statusText));

      if (data.files && data.files.length > 0) {
        this.cachedFolderId = data.files[0].id;
        this.cachedFolderName = folderName;
        return this.cachedFolderId;
      }

      const createRes = await fetch(DRIVE_FILES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error('Errore creazione cartella Drive: ' + (created.error?.message || createRes.statusText));
      this.cachedFolderId = created.id;
      this.cachedFolderName = folderName;
      return this.cachedFolderId;
    }

    async getRemoteFile(folderId) {
      const accessToken = await this.getValidAccessToken();
      const q = `name = 'db.json' and '${folderId}' in parents and trashed = false`;
      const searchUrl = `${DRIVE_FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&_t=${Date.now()}`;

      const res = await fetch(searchUrl, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Errore ricerca db.json su Drive: ' + (data.error?.message || res.statusText));

      if (data.files && data.files.length > 0) {
        this.cachedFileId = data.files[0].id;
        this.cachedFileFolderId = folderId;
        return data.files[0];
      }
      return null;
    }

    async downloadDb() {
      this.setSyncState('downloading');
      try {
        const cfg = this.loadConfig();
        const folderId = await this.findOrCreateFolder(cfg.folderName || FOLDER_NAME_DEFAULT);
        const remoteFile = await this.getRemoteFile(folderId);
        if (!remoteFile) return null;

        const accessToken = await this.getValidAccessToken();
        const downloadUrl = `${DRIVE_FILES_URL}/${remoteFile.id}?alt=media&_t=${Date.now()}`;
        const res = await fetch(downloadUrl, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!res.ok) throw new Error(`Download db.json fallito (${res.status})`);
        const parsed = await res.json();
        return {
          fileId: remoteFile.id,
          modifiedTime: remoteFile.modifiedTime,
          data: parsed
        };
      } finally {
        this.setSyncState('idle');
      }
    }

    async uploadDb(dbObject) {
      this.setSyncState('uploading');
      try {
        const cfg = this.loadConfig();
        const folderId = await this.findOrCreateFolder(cfg.folderName || FOLDER_NAME_DEFAULT);
        const remoteFile = await this.getRemoteFile(folderId);
        const accessToken = await this.getValidAccessToken();
        const jsonContent = JSON.stringify(dbObject, null, 2);

        if (remoteFile) {
          const patchUrl = `${DRIVE_UPLOAD_URL}/${remoteFile.id}?uploadType=media&fields=id,name,modifiedTime`;
          const res = await fetch(patchUrl, {
            method: 'POST',
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'X-HTTP-Method-Override': 'PATCH',
              'Content-Type': 'application/json; charset=utf-8'
            },
            body: jsonContent
          });
          const data = await res.json();
          if (!res.ok) throw new Error('Aggiornamento db.json su Drive fallito: ' + (data.error?.message || res.statusText));
          this.updateSyncRecord(true, 'upload');
          return { fileId: remoteFile.id, modifiedTime: data.modifiedTime || new Date().toISOString() };
        } else {
          const boundary = '-------314159265358979323846';
          const metadata = JSON.stringify({
            name: 'db.json',
            parents: [folderId],
            mimeType: 'application/json'
          });
          const multipartBody =
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${jsonContent}\r\n` +
            `--${boundary}--`;
          const uploadUrl = `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,modifiedTime`;
          const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
          });
          const data = await res.json();
          if (!res.ok) throw new Error('Creazione db.json su Drive fallita: ' + (data.error?.message || res.statusText));
          this.updateSyncRecord(true, 'upload');
          return { fileId: data.id, modifiedTime: data.modifiedTime || new Date().toISOString() };
        }
      } catch (err) {
        this.updateSyncRecord(false, 'upload', err.message);
        throw err;
      } finally {
        this.setSyncState('idle');
      }
    }
  }

  window.DriveClient = DriveClient;
  window.gDriveClient = new DriveClient();
})();
