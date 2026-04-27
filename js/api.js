/* ============================================
   Nieta Studio - 纯前端 API 客户端
   直连上游 API，无需后端代理
   ============================================ */

const API = (() => {
  // ===== 直连上游 API =====
  const BASE_URL = 'https://api.talesofai.cn';
  const OSS_BASE = 'https://oss.talesofai.cn';

  // 伪装请求头（模拟 app.nieta.art 的 Web 端请求）
  const FAKE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Sec-Ch-Ua': '"Chromium";v="147", "EDGE";v="147", "Not?A_Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'x-platform': 'nieta-app/web',
    'x-nieta-app-version': '6.11.2',
    'x-app-bundle-version': '6.11.2',
    'x-teen-mode': '0',
    'x-abtest': '0',
  };

  // Token 管理
  let _token = localStorage.getItem('nieta_x_token') || '';
  let _anonymousToken = localStorage.getItem('nieta_anonymous_token') || '';
  let _anonymousPromise = null;

  // 获取匿名身份（用于 feed 等公开接口）
  async function ensureAnonymousToken() {
    if (_anonymousToken) return _anonymousToken;
    if (_anonymousPromise) return _anonymousPromise;
    _anonymousPromise = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/v2/users/anonymous-ad`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data.uuid) {
          _anonymousToken = data.uuid;
          localStorage.setItem('nieta_anonymous_token', data.uuid);
        }
      } catch (e) {
        console.warn('[API] 获取匿名身份失败:', e);
      }
      _anonymousPromise = null;
      return _anonymousToken;
    })();
    return _anonymousPromise;
  }

  function setToken(token) {
    _token = token;
    localStorage.setItem('nieta_x_token', token);
  }

  function getToken() {
    return _token;
  }

  function clearToken() {
    _token = '';
    localStorage.removeItem('nieta_x_token');
  }

  function isAuthenticated() {
    return !!_token;
  }

  // 通用请求
  async function request(method, path, data = null, options = {}) {
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    const headers = {
      ...FAKE_HEADERS,
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (_token) headers['x-token'] = _token;

    const config = {
      method,
      headers,
      mode: 'cors',
    };
    if (data && method !== 'GET' && method !== 'DELETE') {
      config.body = JSON.stringify(data);
    }
    if (options.timeout) {
      config.signal = AbortSignal.timeout(options.timeout);
    }

    try {
      const res = await fetch(url, config);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const err = new Error(errData.detail || errData.message || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = errData;
        throw err;
      }
      if (res.status === 204) return null;
      return await res.json();
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new Error('请求超时，请稍后重试');
      }
      throw err;
    }
  }

  const get = (path, query, opts) => {
    let url = path;
    if (query) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.append(k, v);
      });
      const qs = params.toString();
      if (qs) url += (path.includes('?') ? '&' : '?') + qs;
    }
    return request('GET', url, null, opts);
  };
  const post = (path, data, opts) => request('POST', path, data, opts);
  const put = (path, data, opts) => {
    let url = path;
    if (opts && opts.query) {
      const params = new URLSearchParams();
      Object.entries(opts.query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.append(k, v);
      });
      const qs = params.toString();
      if (qs) url += (path.includes('?') ? '&' : '?') + qs;
    }
    return request('PUT', url, data, opts);
  };
  const del = (path, opts) => {
    let url = path;
    if (opts && opts.query) {
      const params = new URLSearchParams();
      Object.entries(opts.query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.append(k, v);
      });
      const qs = params.toString();
      if (qs) url += (path.includes('?') ? '&' : '?') + qs;
    }
    return request('DELETE', url, null, opts);
  };
  const patch = (path, data, opts) => request('PATCH', path, data, opts);

  // OSS 图片 URL 构造
  function ossUrl(path) {
    return path.startsWith('http') ? path : `${OSS_BASE}/${path}`;
  }

  // ============ 用户 ============
  const User = {
    getInfo: (uuid) => get('/v1/user/', uuid ? { uuid } : undefined),
    getAPInfo: () => get('/v2/user/ap_info'),
    refreshToken: () => put('/v1/user/refresh-token'),
    updateProfile: (data) => put('/v1/user/user', data),
    logout: () => post('/v1/user/logout'),
    loginPhone: (data) => post('/v1/user/verify-with-phone-num', data),
    loginWechat: (data) => post('/v1/user/verify-with-wechat-app-connect', data),
    loginApple: (data) => post('/v1/user/verify-with-apple', data),
    loginGoogle: (data) => post('/v1/user/verify-with-google', data),
  };

  // ============ AI 生成 (Artifact) ============
  const Artifact = {
    makeImage: (data) => post('/v3/make_image', data, { timeout: 200000 }),
    makeFaceDetailer: (data) => post('/v3/make_face_detailer', data),
    makeVideo: (data) => post('/v3/make_video', data, { timeout: 200000 }),
    getVideoModelList: () => get('/v3/video_model_list'),
    getTaskPool: () => get('/v3/task-pool'),
    getTask: (uuid) => get('/v3/task', { taskId: uuid }),
    getVideoTask: (uuid) => get(`/v1/artifact/video_task/${uuid}`),
    list: (query) => get('/v1/artifact/list', query),
    getPictureDetail: (uuids) => get('/v1/artifact/picture-detail', { uuid: uuids }),
    getVideoDetail: (uuids) => get('/v1/artifact/video-detail', { uuid: uuids }),
    getArtifactDetail: (uuids, brief) => get('/v1/artifact/artifact-detail', { uuid: uuids, brief }),
    update: (uuid, data) => put(`/v1/artifact/${uuid}`, data),
    delete: (uuids) => del('/v1/artifact', { query: { uuid: uuids } }),
    createPicture: (data) => post('/v1/artifact/picture', data),
    createVideo: (data) => post('/v1/artifact/video', data),
    star: (uuid, cancel) => put(`/v1/artifact/${uuid}`, { is_star: !cancel }),
    getVideoStreamUrl: (url, artifactUuid) => get('/v1/artifact/video-stream-url', { url, artifact_uuid: artifactUuid }),
    uploadVerse: (data) => post('/v1/artifact/verse', data),
    getVerseCheckpoint: (uuid) => get('/v1/artifact/verse/checkpoint', { uuid }),
  };

  // ============ 作品集 (Story/Collection) ============
  const Story = {
    getDetail: (uuids) => get('/v3/story/story-detail', { uuids }),
    deleteCollections: (uuids) => del('/v3/story/collection', { query: { uuid: uuids } }),
    createEmpty: () => get('/v1/story/new-story'),
    save: (data) => put('/v3/story/story', data),
    publish: (storyId) => put('/v1/story/story-publish', null, { query: { storyId } }),
    like: (uuid) => put('/v1/story/story-like', { uuid, like: true }),
    unlike: (uuid) => put('/v1/story/story-like', { uuid, like: false }),
    getSameStyle: (uuid, page = 1, size = 20) => get('/v3/story/same-style-stories', { uuid, page_index: page, page_size: size }),
    feeds: async () => {
      // Feed 通过静态 JSON 加载（data/feed.json），由 GitHub Actions 定时更新
      const resp = await fetch('data/feed.json');
      if (!resp.ok) throw new Error(`加载 feed 失败: HTTP ${resp.status}`);
      return await resp.json();
    },
    generateTitle: (data) => post('/v3/story/generate-story-title', data),
    generateDetail: (data) => post('/v3/gpt/dify/text-complete', data),
    userStories: (uuid, page = 1, pageSize = 20) => get('/v2/story/user-stories', { uuid, page, page_size: pageSize }),
    likedStories: (page = 1, pageSize = 20) => get('/v2/story/liked-list', { page, page_size: pageSize }),
    favor: (uuid, cancel) => put('/v1/story/story-favor', { uuid, cancel }),
    getTags: (id) => get(`/v1/home/collection/${id}/tags`),
    getCharacters: (uuid) => get(`/v3/story/${uuid}/characters`),
    pin: (data) => post('/v3/story/pin', data),
    getPinStatus: (id) => get(`/v3/story/collection-pin-status/${id}`),
  };

  // ============ 角色 (Character/TCP) ============
  const Character = {
    getDetail: (id) => get(`/v1/travel/characters/${id}`),
    getStories: (uuid, page = 1, size = 20) => get(`/v2/travel/parent/${uuid}/stories`, { page_index: page, page_size: size }),
    typeahead: (query) => get('/v2/travel/parent-search', { keywords: query, page_index: 0, page_size: 10, parent_type: 'oc', sort_scheme: 'best' }),
  };

  // ============ Elementum (元素/风格/姿势/场景) ============
  const Elementum = {
    typeahead: (query, type) => get('/v2/travel/parent-search', { keywords: query, page_index: 0, page_size: 10, parent_type: 'elementum', sort_scheme: 'best' }),
    getCatalog: () => get('/v1/elementum/catalog'),
    create: (data) => post('/v3/oc/elementum', data),
    update: (tcpUuid, data) => patch(`/v3/oc/elementum/${tcpUuid}`, data),
  };

  // ============ Prompt ============
  const Prompt = {
    getFullPromptTags: (domain) => get('/v1/prompt/full-prompt-tags', { domain_name: domain }),
    getRAGRecommend: (query, action = 'search', pageSize = 10) => post('/v1/rag/rag-recommend-stories', { query, action, page_size: pageSize }, { timeout: 2000 }),
    getCachedInspiration: () => get('/v1/rag/cached-inspiration'),
  };

  // ============ 配置 ============
  const Config = {
    get: (key) => get('/v1/configs/config', { key }),
    getList: (keys) => get('/v1/configs/config-list', { key: keys }),
    getAppLoads: () => get('/v1/app/loads'),
  };

  // ============ 任务系统 ============
  const Assignment = {
    getList: () => get('/v1/assignment/assignment-list'),
    claim: (data) => post('/v1/assignment/user-assignment', data),
    complete: (data) => put('/v1/assignment/complete-assignment-action', data),
  };

  // ============ 商业 ============
  const Commerce = {
    getUserItems: () => get('/v1/commerce/user-items'),
    getSPUDetail: (id) => get(`/v1/commerce/spu-detail/${id}`),
    getSPUList: () => get('/v1/commerce/spu-list'),
    getOrders: (query) => get('/v1/commerce/orders', query),
    getOrderDetail: (id) => get(`/v1/commerce/orders/${id}`),
    pay: (id, method) => post(`/v1/commerce/orders/${id}/payment/${method}`),
    purchaseByAP: (sku) => post(`/v1/commerce/purchase_spu_by_ap/${sku}`),
  };

  // ============ OSS 上传 ============
  const OSS = {
    getUploadToken: () => get('/v1/oss/sts-upload-token'),
    getAnonymousUploadToken: () => get('/v1/oss/anonymous-upload-token'),
  };

  // ============ 标签/社区 ============
  const Hashtag = {
    search: (query) => get(`/v1/hashtag/typeahead/${query}`),
    getInfo: (name) => get(`/v1/hashtag/hashtag_info/${name}`),
    getStories: (name, page = 1, size = 20) => get(`/v1/hashtag/${name}/stories`, { page_index: page, page_size: size }),
    subscribe: (name) => post('/v1/hashtag/subscribe', { name }),
    getFeedHashtags: () => get('/v1/hashtag/feed_hashtags'),
    getHotCollections: () => get('/v1/hashtag/hot-collections'),
  };

  // ============ 互动 ============
  const Interactive = {
    getDetail: (uuid) => get(`/v1/collection-interactive/collection_uuid=${uuid}`),
    getFeed: (query) => get('/v1/home/feed/interactive', query),
    reply: (data) => put('/v1/collection-interactive/text_reply', data),
    randomCharacter: (num = 1) => get(`/v1/collection-interactive/char_roll`, { num }),
    search: (query) => get('/v1/collection-interactive/search', query),
  };

  // ============ Verse ============
  const Verse = {
    getPreset: (uuid) => get(`/v1/verse/preset/${uuid}`),
    getCatalog: () => get('/v1/verse/catalog'),
    getCatalogEntries: (uuid) => get(`/v1/verse/catalog/${uuid}/entries`),
    screenshot: (data) => post('/v1/verse/screenshot', data),
    modifyHTML: (data) => post('/v1/verse/modifyhtml', data),
    getTool: () => get('/v1/verse/tool'),
    claimArtifact: (id) => post(`/v1/verse/artifact/${id}/claim`),
    writeLock: (id) => post(`/v1/verse/artifact/${id}/write_lock`),
    releaseWriteLock: (id) => del(`/v1/verse/artifact/${id}/write_lock`),
  };

  // ============ Agent ============
  const Agent = {
    create: (uuid, data) => post(`/v1/agent/${uuid}`, data),
    get: (uuid) => get(`/v1/agent/${uuid}`, { with_history: 1 }),
    checkLimit: () => get('/v1/agent/limit-exceeded'),
    cancel: (uuid) => del(`/v1/agent/${uuid}`),
  };

  // ============ BGM / 音乐生成 ============
  const Audio = {
    getBGMList: (category, page = 1, size = 20) => get('/v1/audio/bgm/list', { category, page_index: page, page_size: size }),
    getBGMDetail: (query) => get('/v1/audio/bgm', query),
    makeSong: (prompt, lyrics, meta) => post('/v3/make_song', { prompt, lyrics, meta: meta || {} }),
    makeTTS: (text, opts = {}) => post('/v3/make_tts', { text, ...opts }),
  };

  // ============ MQTT ============
  const MQTT = {
    getClient: (clientId) => post('/v1/mqtt/client', { client_id: clientId }),
  };

  // ============ 签到 ============
  const Checkin = {
    getStatus: () => get('/v1/checkin/status'),
    manual: () => post('/v1/checkin/manual'),
  };

  // ============ 活动 ============
  const Activity = {
    getList: () => get('/v1/activities'),
    getDetail: (id) => get(`/v1/activities/${id}`),
  };

  // ============ 旅行 ============
  const Travel = {
    getMissionRecords: (id) => get(`/v2/travel/mission-records/${id}`),
    updateProgress: (id, data) => patch(`/v2/travel/mission-records/${id}/progress`, data),
    getCampaignCatalogs: () => get('/v2/travel/campaign/catalogs'),
    getCampaignEntries: (id) => get(`/v2/travel/campaign/catalog/${id}/entries`),
    searchCampaign: (query) => get('/v2/travel/campaign-search', { query }),
  };

  return {
    BASE_URL, OSS_BASE, ossUrl,
    setToken, getToken, clearToken, isAuthenticated,
    get, post, put, del, patch, request,
    User, Artifact, Story, Character, Elementum, Prompt,
    Config, Assignment, Commerce, OSS, Hashtag, Interactive,
    Verse, Agent, Audio, MQTT, Checkin, Activity, Travel,
  };
})();
