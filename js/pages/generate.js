/* ============================================
   Nieta Studio - AI 图片/视频生成页面
   GeneratePage 类 - 纯移动端布局
   @ 触发角色搜索，/ 触发元素搜索
   ============================================ */

class GeneratePage {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) throw new Error('GeneratePage: 容器不存在');

    // 状态
    this.mode = 'image';
    this.isGenerating = false;
    this.pollTimers = new Map();
    this.results = [];
    this.apInfo = null;

    // Prompt 相关
    this.mentionedItems = []; // { type: 'character'|'style'|'pose'|'scene', name, uuid, id, triggerChar, startIndex, endIndex }
    this._searchActive = false;
    this._searchType = null; // 'character' | 'style' | 'pose' | 'scene'
    this._searchTriggerChar = null;
    this._searchTriggerIndex = -1;
    this._debounceTimer = null;
    this._searchResults = []; // 存储当前搜索结果数据
    this._selectedItemsMap = {}; // 持久化: { "角色名": { uuid, name, type, ... }, ... }

    // Quick Pick 相关
    this._quickPickActive = false;
    this._quickPickTab = 'my-characters';
    this._quickPickSearchQuery = '';
    this._quickPickItems = [];

    // 参数
    this.params = {
      ratio: '1:1',
      count: 1,
      imageModel: '5_lumina',
      videoModel: 'seedance_2_0',
      videoDuration: '5s',
      videoResolution: '720p',
    };

    // 图片模型列表
    this.imageModels = [
      { id: '', name: '自动' },
      { id: '2_netaxl', name: '模型 2.0' },
      { id: '3_noobxl', name: '模型 3.0' },
      { id: '5_lumina', name: 'Lumina' },
      { id: '8_image_edit', name: '图片编辑' },
    ];

    this.els = {};
    this._init();
  }

  // ============ 初始化 ============
  async _init() {
    this.container.innerHTML = this._renderTemplate();
    this._cacheElements();
    this._bindEvents();
    await this._loadAPInfo();
  }

  // ============ HTML 模板（纯移动端布局） ============
  _renderTemplate() {
    const modelOptions = this.imageModels.map(m =>
      `<option value="${m.id}" ${m.id === this.params.imageModel ? 'selected' : ''}>${m.name} (${m.id})</option>`
    ).join('');

    return `
      <div class="gen-page">

        <!-- 结果区域（水平 Swiper） -->
        <div class="gen-mobile-results" id="gen-mobile-results">
          <div class="gen-welcome">
            <div class="gen-welcome-avatar">N</div>
            <h3>开始创作</h3>
            <p>输入描述文字，选择角色和风格，一键生成精美图片或视频</p>
          </div>
        </div>

        <!-- 可折叠参数面板（独立滚动区域） -->
        <div class="gen-mobile-params-panel" id="gen-mobile-params-panel">
          <div class="gen-options">
            <!-- 宽高比 -->
            <div class="gen-option-row">
              <span class="gen-option-label">宽高比</span>
              <div class="gen-option-value ratio-group" id="mobile-ratio-group">
                <button class="ratio-btn active" data-ratio="1:1">1:1</button>
                <button class="ratio-btn" data-ratio="3:4">3:4</button>
                <button class="ratio-btn" data-ratio="4:3">4:3</button>
                <button class="ratio-btn" data-ratio="9:16">9:16</button>
                <button class="ratio-btn" data-ratio="16:9">16:9</button>
                <button class="ratio-btn" data-ratio="21:9">21:9</button>
              </div>
            </div>

            <!-- Seed -->
            <div class="gen-option-row" id="mobile-row-seed">
              <span class="gen-option-label">Seed</span>
              <div class="gen-option-value" style="display:flex;gap:6px;align-items:center;flex:1">
                <input type="number" class="form-input" id="mobile-gen-seed" placeholder="留空随机" style="flex:1;min-width:0" />
                <button class="btn btn-sm btn-secondary" id="mobile-gen-seed-random" title="随机 Seed" style="padding:8px 10px;min-height:36px;flex-shrink:0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
                </button>
              </div>
            </div>

            <!-- 缩放比例 -->
            <div class="gen-option-row" id="mobile-row-scale">
              <span class="gen-option-label">缩放</span>
              <div class="gen-option-value" style="display:flex;align-items:center;gap:8px;flex:1">
                <input type="range" id="mobile-gen-scale" min="0.1" max="2" step="0.1" value="1" style="flex:1;accent-color:var(--brand-pink)" />
                <span id="mobile-gen-scale-value" style="font-size:13px;color:var(--text-secondary);min-width:32px;text-align:center">1.0</span>
              </div>
            </div>

            <!-- 图片模型 -->
            <div class="gen-option-row" id="mobile-row-image-model">
              <span class="gen-option-label">模型</span>
              <div class="gen-option-value">
                <select class="form-select" id="mobile-gen-image-model">
                  ${modelOptions}
                </select>
              </div>
            </div>

            <!-- 视频模型 -->
            <div class="gen-option-row hidden" id="mobile-row-video-model">
              <span class="gen-option-label">视频模型</span>
              <div class="gen-option-value">
                <select class="form-select" id="mobile-gen-video-model" disabled>
                  <option value="seedance_2_0">Seedance 2.0</option>
                </select>
              </div>
            </div>

            <!-- 视频时长 -->
            <div class="gen-option-row hidden" id="mobile-row-video-duration">
              <span class="gen-option-label">时长</span>
              <div class="gen-option-value ratio-group" id="mobile-duration-group">
                <button class="ratio-btn active" data-duration="5s">5s</button>
                <button class="ratio-btn" data-duration="10s">10s</button>
                <button class="ratio-btn" data-duration="15s">15s</button>
              </div>
            </div>

            <!-- 视频分辨率 -->
            <div class="gen-option-row hidden" id="mobile-row-video-resolution">
              <span class="gen-option-label">分辨率</span>
              <div class="gen-option-value ratio-group" id="mobile-resolution-group">
                <button class="ratio-btn" data-resolution="480p">480p</button>
                <button class="ratio-btn active" data-resolution="720p">720p</button>
              </div>
            </div>

            <!-- 音乐歌词 -->
            <div class="gen-option-row hidden" id="mobile-row-music-lyrics">
              <span class="gen-option-label">歌词</span>
              <div class="gen-option-value" style="width:100%">
                <textarea class="form-input" id="mobile-gen-music-lyrics" placeholder="输入歌词（可选，留空则自动生成）" rows="4" style="min-height:80px;resize:vertical;font-size:14px"></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部固定输入栏 -->
        <div class="gen-mobile-input-bar" id="gen-mobile-input-bar">
          <!-- 模式切换（药丸按钮） -->
          <div class="gen-mode-switch">
            <button class="gen-mode-btn active" data-mode="image">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              <span>图片</span>
            </button>
            <button class="gen-mode-btn" data-mode="video">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              <span>视频</span>
            </button>
            <button class="gen-mode-btn" data-mode="music">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              <span>音乐</span>
            </button>
          </div>

          <!-- 输入行：Prompt + 发送按钮 -->
          <div class="gen-mobile-input-row">
            <div class="prompt-editor-wrap" id="mobile-prompt-editor-wrap">
              <div class="prompt-highlight-layer" id="mobile-prompt-highlight"></div>
              <textarea
                class="prompt-textarea prompt-main"
                id="mobile-gen-prompt"
                placeholder="描述你想生成的画面..."
                rows="1"
                spellcheck="false"
              ></textarea>
              <!-- 搜索下拉 -->
              <div class="prompt-search-dropdown" id="mobile-prompt-search-dropdown"></div>
            </div>
            <button class="gen-mobile-send-btn" id="gen-mobile-send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>

          <!-- 选取按钮行 -->
          <div class="gen-mobile-quick-pick-row">
            <button class="gen-mobile-quick-pick-btn" id="gen-mobile-quick-pick">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              <span>选取</span>
            </button>
          </div>

          <!-- 参数展开/收起按钮 -->
          <button class="gen-mobile-params-toggle" id="gen-mobile-params-toggle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            <span>参数设置</span>
          </button>
        </div>
      </div>
    `;
  }

  // ============ 缓存 DOM（仅移动端元素） ============
  _cacheElements() {
    this.els.modeBtns = this.container.querySelectorAll('.gen-mode-btn');
    this.els.sendBtn = this.container.querySelector('#gen-mobile-send');
    this.els.prompt = this.container.querySelector('#mobile-gen-prompt');
    this.els.promptHighlight = this.container.querySelector('#mobile-prompt-highlight');
    this.els.searchDropdown = this.container.querySelector('#mobile-prompt-search-dropdown');
    this.els.promptWrap = this.container.querySelector('#mobile-prompt-editor-wrap');
    this.els.resultsArea = this.container.querySelector('#gen-mobile-results');
    this.els.paramsToggle = this.container.querySelector('#gen-mobile-params-toggle');
    this.els.paramsPanel = this.container.querySelector('#gen-mobile-params-panel');
    this.els.ratioGroup = this.container.querySelector('#mobile-ratio-group');
    this.els.scaleInput = this.container.querySelector('#mobile-gen-scale');
    this.els.scaleValue = this.container.querySelector('#mobile-gen-scale-value');
    this.els.rowScale = this.container.querySelector('#mobile-row-scale');
    this.els.imageModelSelect = this.container.querySelector('#mobile-gen-image-model');
    this.els.videoModelSelect = this.container.querySelector('#mobile-gen-video-model');
    this.els.durationGroup = this.container.querySelector('#mobile-duration-group');
    this.els.resolutionGroup = this.container.querySelector('#mobile-resolution-group');
    this.els.rowImageModel = this.container.querySelector('#mobile-row-image-model');
    this.els.rowVideoModel = this.container.querySelector('#mobile-row-video-model');
    this.els.rowVideoDuration = this.container.querySelector('#mobile-row-video-duration');
    this.els.rowVideoResolution = this.container.querySelector('#mobile-row-video-resolution');
    this.els.rowMusicLyrics = this.container.querySelector('#mobile-row-music-lyrics');
    this.els.musicLyrics = this.container.querySelector('#mobile-gen-music-lyrics');
    this.els.seedInput = this.container.querySelector('#mobile-gen-seed');
    this.els.seedRandomBtn = this.container.querySelector('#mobile-gen-seed-random');
    this.els.rowCount = this.container.querySelector('#mobile-row-count');
    this.els.quickPickBtn = this.container.querySelector('#gen-mobile-quick-pick');

    // 移动端 AP 显示（在 index.html 的 mobile-header 中）
    this.els.apValueMobile = document.querySelector('#ap-value-mobile');
  }

  // ============ 事件绑定 ============
  _bindEvents() {
    // 模式切换
    this.els.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === this.mode) return;
        this._switchMode(mode);
      });
    });

    // 发送按钮
    this.els.sendBtn.addEventListener('click', () => this._handleSubmit());

    // 选取按钮
    if (this.els.quickPickBtn) {
      this.els.quickPickBtn.addEventListener('click', () => this._openQuickPick());
    }

    // 随机 Seed 按钮
    if (this.els.seedRandomBtn) {
      this.els.seedRandomBtn.addEventListener('click', () => {
        if (this.els.seedInput) {
          this.els.seedInput.value = Math.floor(Math.random() * 2147483647);
        }
      });
    }

    // 缩放滑块
    if (this.els.scaleInput && this.els.scaleValue) {
      this.els.scaleInput.addEventListener('input', () => {
        this.els.scaleValue.textContent = parseFloat(this.els.scaleInput.value).toFixed(1);
      });
    }

    // 参数面板展开/收起
    this.els.paramsToggle.addEventListener('click', () => {
      const isOpen = this.els.paramsPanel.classList.contains('open');
      this.els.paramsPanel.classList.toggle('open', !isOpen);
      this.els.paramsToggle.classList.toggle('open', !isOpen);
    });

    // 宽高比
    this.els.ratioGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.ratio-btn');
      if (!btn) return;
      this.params.ratio = btn.dataset.ratio;
      this.els.ratioGroup.querySelectorAll('.ratio-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.ratio === this.params.ratio);
      });
    });

    // 视频时长
    this.els.durationGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.ratio-btn');
      if (!btn) return;
      this.params.videoDuration = btn.dataset.duration;
      this.els.durationGroup.querySelectorAll('.ratio-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.duration === this.params.videoDuration);
      });
    });

    // 视频分辨率
    this.els.resolutionGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.ratio-btn');
      if (!btn) return;
      this.params.videoResolution = btn.dataset.resolution;
      this.els.resolutionGroup.querySelectorAll('.ratio-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.resolution === this.params.videoResolution);
      });
    });

    // 图片模型
    this.els.imageModelSelect.addEventListener('change', (e) => {
      this.params.imageModel = e.target.value;
    });

    // ===== Prompt 输入框核心逻辑 =====
    this.els.prompt.addEventListener('input', () => this._handlePromptInput());
    this.els.prompt.addEventListener('keydown', (e) => this._handlePromptKeydown(e));
    this.els.prompt.addEventListener('click', () => this._handlePromptClick());
    this.els.prompt.addEventListener('scroll', () => this._syncHighlightScroll());

    // 点击外部关闭搜索下拉
    document.addEventListener('click', (e) => {
      if (this.els.promptWrap && !this.els.promptWrap.contains(e.target)) {
        this._hideSearchDropdown();
      }
      // 点击外部关闭快速选取面板
      if (this._quickPickActive) {
        const panel = document.querySelector('.quick-pick-panel');
        if (panel && !panel.contains(e.target) && e.target !== this.els.quickPickBtn && !this.els.quickPickBtn.contains(e.target)) {
          this._closeQuickPick();
        }
      }
    });
  }

  // ============ Prompt 输入处理 ============
  _handlePromptInput() {
    const textarea = this.els.prompt;
    if (!textarea) return;

    const val = textarea.value;
    const pos = textarea.selectionStart;

    // 检测光标前是否有 @ 或 / 触发符
    const textBeforeCursor = val.substring(0, pos);
    const triggerMatch = textBeforeCursor.match(/([@\/])([^\s@\/]*)$/);

    if (triggerMatch) {
      const triggerChar = triggerMatch[1];
      const query = triggerMatch[2];
      this._searchTriggerChar = triggerChar;
      this._searchTriggerIndex = pos - query.length - 1; // @ 或 / 的位置

      if (triggerChar === '@') {
        this._searchType = 'character';
      } else {
        // / 后面跟的内容决定搜索类型
        // 简化处理：统一搜元素，后端会根据 query 匹配
        this._searchType = 'element';
      }

      // 防抖搜索
      clearTimeout(this._debounceTimer);
      if (query.length >= 0) {
        this._debounceTimer = setTimeout(() => {
          this._doSearch(query);
        }, query.length === 0 ? 0 : 300);
      }
    } else {
      this._hideSearchDropdown();
      this._searchType = null;
      this._searchTriggerChar = null;
    }

    // 更新高亮和标签
    this._updateHighlight();
    this._updateMentionedItems();
  }

  // ============ Prompt 键盘处理 ============
  _handlePromptKeydown(e) {
    const dropdown = this.els.searchDropdown;
    if (!dropdown || !dropdown.classList.contains('visible')) return;

    const items = dropdown.querySelectorAll('.prompt-search-item');
    if (items.length === 0) return;

    let activeIndex = -1;
    items.forEach((item, i) => {
      if (item.classList.contains('active')) activeIndex = i;
    });

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      items.forEach((item, i) => item.classList.toggle('active', i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
      items.forEach((item, i) => item.classList.toggle('active', i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (activeIndex >= 0) {
        e.preventDefault();
        this._selectSearchItem(items[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._hideSearchDropdown();
    }
  }

  // ============ Prompt 点击处理 ============
  _handlePromptClick() {
    // 点击时重新检测触发符
    this._handlePromptInput();
  }

  // ============ 执行搜索 ============
  async _doSearch(query) {
    if (!this._searchType) return;

    try {
      let results = [];
      if (this._searchType === 'character') {
        const data = await API.Character.typeahead(query);
        const list = data?.list || data?.data || data || [];
        results = (Array.isArray(list) ? list : []).map(item => ({
          ...item,
          name: item.name || item.short_name || '',
          avatar: item.config?.avatar_img || item.avatar || item.thumbnail || '',
          _searchType: 'character',
        }));
      } else {
        // 元素搜索：parent_type=elementum 会返回所有元素类型
        const data = await API.Elementum.typeahead(query, 'elementum');
        const list = data?.list || data?.data || data || [];
        results = (Array.isArray(list) ? list : []).map(item => ({
          ...item,
          name: item.name || item.short_name || '',
          avatar: item.config?.avatar_img || item.config?.cover_img || item.avatar || item.thumbnail || '',
          _searchType: item.type === 'oc' ? 'character' : (item.sub_type || item.type || 'element'),
        }));
      }

      this._renderSearchResults(results, query);
    } catch (err) {
      console.warn('搜索失败:', err);
      if (this.els.searchDropdown) {
        this.els.searchDropdown.innerHTML = '<div class="prompt-search-empty">搜索失败</div>';
        this._showSearchDropdown();
      }
    }
  }

  // ============ 渲染搜索结果 ============
  _renderSearchResults(results, query) {
    const dropdown = this.els.searchDropdown;
    if (!dropdown) return;
    this._searchResults = results; // 保存搜索结果数据

    if (!results || results.length === 0) {
      dropdown.innerHTML = `<div class="prompt-search-empty">未找到匹配结果</div>`;
      this._showSearchDropdown();
      return;
    }

    const typeLabels = {
      character: '角色',
      style: '风格',
      pose: '姿势',
      scene: '场景',
      composition: '构图',
    };

    const typeTagClasses = {
      character: 'prompt-tag-character',
      style: 'prompt-tag-style',
      pose: 'prompt-tag-style',
      scene: 'prompt-tag-style',
      composition: 'prompt-tag-style',
    };

    dropdown.innerHTML = results.map((item, i) => {
      const name = item.name || item.title || '未知';
      const desc = item.description || item.style || '';
      const avatar = item.avatar || item.thumbnail || '';
      const searchType = item._searchType || this._searchType;
      const typeLabel = typeLabels[searchType] || '元素';
      const tagClass = typeTagClasses[searchType] || 'prompt-tag-style';
      // 高亮匹配文字
      const highlightedName = query ? name.replace(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>') : name;

      return `
        <div class="prompt-search-item ${i === 0 ? 'active' : ''}" data-index="${i}" data-type="${searchType}">
          ${avatar ? `<img class="prompt-search-avatar" src="${avatar}" alt="" onerror="this.style.display='none'" />` : ''}
          <div class="prompt-search-item-info">
            <div class="prompt-search-item-name">${highlightedName}</div>
            ${desc ? `<div class="prompt-search-item-desc">${desc}</div>` : ''}
          </div>
          <span class="prompt-search-item-type ${tagClass}">${typeLabel}</span>
        </div>
      `;
    }).join('');

    // 绑定点击事件
    dropdown.querySelectorAll('.prompt-search-item').forEach((el, i) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault(); // 防止 textarea 失焦
        this._selectSearchItem(el);
      });
    });

    this._showSearchDropdown();
  }

  // ============ 选中搜索结果 ============
  _selectSearchItem(el) {
    const index = parseInt(el.dataset.index);
    const item = this._searchResults[index];
    if (!item) return;

    const selectedName = item.name || item.title || '';
    if (!selectedName) return;

    const textarea = this.els.prompt;
    if (!textarea) return;

    const val = textarea.value;
    const triggerIndex = this._searchTriggerIndex;

    // BUG FIX: 在清除 _searchType 之前保存它
    const itemType = this._searchType || (this._searchTriggerChar === '@' ? 'character' : 'element');

    if (triggerIndex >= 0 && triggerIndex < val.length) {
      // 替换从触发符到当前光标位置的内容
      const before = val.substring(0, triggerIndex);
      const after = val.substring(textarea.selectionStart);
      const triggerChar = this._searchTriggerChar || '@';

      // 插入: @角色名 或 /元素名，后面加一个空格
      const insertText = `${triggerChar}${selectedName} `;
      textarea.value = before + insertText + after;

      // 设置光标到插入文本后面
      const newPos = before.length + insertText.length;
      textarea.setSelectionRange(newPos, newPos);
    }

    this._hideSearchDropdown();
    this._searchType = null;
    this._searchTriggerChar = null;
    this._searchResults = [];

    // 持久化保存选中项的完整信息（uuid 等），供生成时使用
    this._selectedItemsMap[selectedName] = {
      uuid: item.uuid || item.id || '',
      name: selectedName,
      short_name: item.short_name || item.title || '',
      type: itemType,
      cover_url: item.cover_url || item.image_url || '',
      img_url: (item.avatar || item.config?.avatar_img || item.config?.cover_img || item.thumbnail || item.cover_url || item.image_url || '').replace(/`/g, ''),
    };

    // 更新
    this._updateHighlight();
    this._updateMentionedItems();
    textarea.focus();
  }

  // ============ 显示/隐藏搜索下拉 ============
  _showSearchDropdown() {
    if (this.els.searchDropdown) {
      this.els.searchDropdown.classList.add('visible');
      this._searchActive = true;
    }
  }

  _hideSearchDropdown() {
    if (this.els.searchDropdown) this.els.searchDropdown.classList.remove('visible');
    this._searchActive = false;
    this._searchType = null;
    this._searchTriggerChar = null;
  }

  // ============ 更新高亮层 ============
  _updateHighlight() {
    const textarea = this.els.prompt;
    const highlight = this.els.promptHighlight;
    if (!textarea || !highlight) return;

    const val = textarea.value;
    // 先提取 @角色 /元素 (权重) 的内容，做标记替换
    let html = val;
    // 用占位符保护特殊内容
    const tokens = [];
    html = html.replace(/(@[^\s@\/]+)/g, (match) => {
      tokens.push(`<span class="prompt-hl-character">${match}</span>`);
      return `__TOKEN_${tokens.length - 1}__`;
    });
    html = html.replace(/(\/[^\s@\/]+)/g, (match) => {
      tokens.push(`<span class="prompt-hl-element">${match}</span>`);
      return `__TOKEN_${tokens.length - 1}__`;
    });
    html = html.replace(/(\([^)]+\))/g, (match) => {
      tokens.push(`<span class="prompt-hl-weight">${match}</span>`);
      return `__TOKEN_${tokens.length - 1}__`;
    });
    // 转义 HTML
    html = html.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // 还原占位符
    html = html.replace(/__TOKEN_(\d+)__/g, (_, idx) => tokens[parseInt(idx)]);
    // 换行
    html = html.replace(/\n/g, '<br>');

    highlight.innerHTML = html + '<br><br>'; // 额外行防止高度不够
  }

  // ============ 同步滚动 ============
  _syncHighlightScroll() {
    if (this.els.prompt && this.els.promptHighlight) {
      this.els.promptHighlight.scrollTop = this.els.prompt.scrollTop;
      this.els.promptHighlight.scrollLeft = this.els.prompt.scrollLeft;
    }
  }

  // ============ 解析已提及的项 ============
  _updateMentionedItems() {
    const textarea = this.els.prompt;
    if (!textarea) return;

    const val = textarea.value;
    this.mentionedItems = [];

    // 匹配 @角色名
    const charRegex = /@([^\s@\/]+)/g;
    let match;
    while ((match = charRegex.exec(val)) !== null) {
      const name = match[1];
      const saved = this._selectedItemsMap[name];
      this.mentionedItems.push({
        type: 'character',
        name: name,
        uuid: saved?.uuid || '',
        triggerChar: '@',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // 匹配 /元素名
    const elemRegex = /\/([^\s@\/]+)/g;
    while ((match = elemRegex.exec(val)) !== null) {
      const name = match[1];
      const saved = this._selectedItemsMap[name];
      this.mentionedItems.push({
        type: saved?.type === 'character' ? 'character' : 'elementum',
        name: name,
        uuid: saved?.uuid || '',
        triggerChar: '/',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  // ============ 模式切换 ============
  _switchMode(mode) {
    this.mode = mode;

    // 更新所有模式按钮
    this.els.modeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const isImage = mode === 'image';
    const isVideo = mode === 'video';
    const isMusic = mode === 'music';

    // 行显示/隐藏
    this.els.rowImageModel.classList.toggle('hidden', !isImage);
    this.els.rowVideoModel.classList.toggle('hidden', !isVideo);
    this.els.rowVideoDuration.classList.toggle('hidden', !isVideo);
    this.els.rowVideoResolution.classList.toggle('hidden', !isVideo);

    this.els.rowMusicLyrics.classList.toggle('hidden', !isMusic);

    // 宽高比在音乐模式下隐藏
    this.els.ratioGroup.closest('.gen-option-row').classList.toggle('hidden', isMusic);
    // 缩放和数量仅在图片模式显示
    if (this.els.rowScale) this.els.rowScale.classList.toggle('hidden', !isImage);

    // 更新 placeholder
    if (isMusic) {
      this.els.prompt.placeholder = '描述你想要的音乐风格（如：轻快的流行曲、悲伤的钢琴曲）';
    } else {
      this.els.prompt.placeholder = '描述你想生成的画面...';
    }
  }

  // ============ 加载 AP ============
  async _loadAPInfo() {
    try {
      const data = await API.User.getAPInfo();
      this.apInfo = data;
      const ap = data?.ap ?? data?.balance ?? '--';
      const apText = typeof ap === 'number' ? ap.toLocaleString() : ap;

      // 移动端 AP 显示（在 index.html 的 mobile-header 中）
      if (this.els.apValueMobile) this.els.apValueMobile.textContent = apText;
    } catch {
      if (this.els.apValueMobile) this.els.apValueMobile.textContent = '--';
    }
  }

  // ============ 构建 rawPrompt 数组 ============
  _buildRawPrompt(text) {
    const items = [];
    const regex = /(@[^\s@\/]+)|(\s*\/[^\s@\/]+)|([^@\/]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const chunk = match[0].trim();
      if (!chunk) continue;

      if (match[1]) {
        // @角色
        const name = chunk.slice(1);
        const saved = this._selectedItemsMap[name];
        if (saved && saved.uuid) {
          // 使用原始网站的正确类型和完整字段
          const charType = saved.isOfficial ? 'official_character_vtoken_adaptor' : 'oc_vtoken_adaptor';
          items.push({
            type: charType,
            uuid: saved.uuid,
            name: saved.name,
            value: saved.uuid,
            domain: '',
            parent: '',
            img_url: saved.img_url || '',
            label: null,
            sort_index: 0,
            weight: 1,
            status: 'IN_USE',
            polymorphi_values: {},
          });
        } else {
          items.push({ type: 'freetext', value: chunk, weight: 1 });
        }
      } else if (match[2]) {
        // /元素（风格/姿态/场景）
        const name = chunk.slice(1).trim();
        const saved = this._selectedItemsMap[name];
        if (saved && saved.uuid) {
          items.push({
            type: 'elementum',
            uuid: saved.uuid,
            name: saved.name,
            value: saved.uuid,
            domain: '',
            sub_type: saved.sub_type || 'elementum-style',
            parent: '',
            img_url: saved.img_url || '',
            label: null,
            sort_index: 0,
            weight: 1,
            status: 'IN_USE',
            polymorphi_values: {},
          });
        } else {
          items.push({ type: 'freetext', value: chunk, weight: 1 });
        }
      } else if (match[3] && match[3].trim()) {
        items.push({ type: 'freetext', value: match[3].trim(), weight: 1 });
      }
    }

    // 保底：如果解析后为空，把整个文本作为 freetext
    if (items.length === 0 && text.trim()) {
      items.push({ type: 'freetext', value: text.trim(), weight: 1 });
    }

    // API 要求 rawPrompt 中至少有一个 freetext
    const hasFreetext = items.some(item => item.type === 'freetext');
    if (!hasFreetext) {
      items.unshift({ type: 'freetext', value: 'masterpiece, best quality', weight: 1 });
    }

    return items;
  }

  // ============ 构建生成数据 ============
  _buildGenerateData() {
    const prompt = (this.els.prompt ? this.els.prompt.value : '').trim();
    const rawPrompt = this._buildRawPrompt(prompt);

    // 宽高映射（与原网站一致，64的倍数）
    const ratioMap = {
      '1:1': [576, 576],
      '3:4': [576, 768],
      '4:3': [768, 576],
      '9:16': [576, 1024],
      '16:9': [1024, 576],
      '21:9': [1024, 448],
    };
    let [w, h] = ratioMap[this.params.ratio] || [576, 768];

    // 缩放比例：实际尺寸 = round(scale * baseSize / 64) * 64
    const scale = this.els.scaleInput ? parseFloat(this.els.scaleInput.value) : 1;
    if (scale && scale !== 1) {
      w = Math.round(scale * w / 64) * 64;
      h = Math.round(scale * h / 64) * 64;
    }

    // 模型 series（空字符串表示自动，API 传 null）
    const modelSeries = this.params.imageModel || null;

    const base = {
      storyId: '',
      jobType: 'universal',
      rawPrompt,
      width: w,
      height: h,
      seed: (this.els.seedInput && this.els.seedInput.value) ? parseInt(this.els.seedInput.value, 10) : Date.now(),
      meta: {
        entrance: this.mode === 'image' ? 'PICTURE,PURE' : 'VERSE,PURE',
      },
      context_model_series: modelSeries || null,
      negative_freetext: this.params.negative || '',
      advanced_translator: false,
    };

    if (this.mode === 'video') {
      base.duration = parseInt(this.params.videoDuration, 10) || 5;
    }

    return base;
  }

  // ============ 提交生成 ============
  async _handleSubmit() {
    if (this.isGenerating) {
      Components.Toast.info('正在生成中，请稍候...');
      return;
    }

    const prompt = (this.els.prompt ? this.els.prompt.value : '').trim();
    if (!prompt) {
      Components.Toast.error('请输入 Prompt');
      if (this.els.prompt) this.els.prompt.focus();
      return;
    }

    this.isGenerating = true;
    this._setSubmitLoading(true);

    try {
      let response;

      if (this.mode === 'image') {
        const data = this._buildGenerateData();
        console.log('[Nieta] 生成请求:', JSON.stringify(data).slice(0, 500));
        response = await API.Artifact.makeImage(data);
      } else if (this.mode === 'music') {
        const lyrics = this.els.musicLyrics ? this.els.musicLyrics.value.trim() : '';
        console.log('[Nieta] 音乐请求:', JSON.stringify({ prompt, lyrics }));
        response = await API.Audio.makeSong(prompt, lyrics, { entrance: 'VERSE' });
      } else {
        const data = this._buildGenerateData();
        // 视频模式：使用视频模型，移除图片专属字段
        delete data.context_model_series;
        data.video_model = this.params.videoModel || 'seedance_2_0';
        console.log('[Nieta] 视频请求:', JSON.stringify(data).slice(0, 500));
        response = await API.Artifact.makeVideo(data);
      }

        const tasks = this._parseTaskResponse(response);

      if (tasks.length === 0) {
        Components.Toast.error('未获取到生成任务');
        return;
      }

      Components.Toast.success(`已提交 ${tasks.length} 个生成任务`);

      tasks.forEach(task => {
        this._addPendingResult(task);
        this._startPolling(task.uuid, task.type || this.mode);
      });

      this._loadAPInfo();
    } catch (err) {
      console.error('生成失败:', err);
      const msg = err?.data?.detail || err?.message || '生成失败，请重试';
      Components.Toast.error(msg);
    } finally {
      this.isGenerating = false;
      this._setSubmitLoading(false);
    }
  }

  // ============ 解析任务响应 ============
  _parseTaskResponse(response) {
    const tasks = [];
    if (!response) return tasks;

    // API 可能直接返回 UUID 字符串
    if (typeof response === 'string' && response.length > 0) {
      tasks.push({ uuid: response, type: this.mode });
      return tasks;
    }

    const inner = response.data || response;

    if (Array.isArray(inner)) {
      inner.forEach(item => {
        if (typeof item === 'string') {
          tasks.push({ uuid: item, type: this.mode });
        } else if (item.uuid) {
          tasks.push({ uuid: item.uuid, type: this.mode });
        }
      });
    } else if (typeof inner === 'string' && inner.length > 0) {
      tasks.push({ uuid: inner, type: this.mode });
    } else if (inner.uuid) {
      tasks.push({ uuid: inner.uuid, type: this.mode });
    } else if (inner.task_uuid) {
      tasks.push({ uuid: inner.task_uuid, type: this.mode });
    }
    if (inner.uuids && Array.isArray(inner.uuids)) {
      inner.uuids.forEach(uuid => tasks.push({ uuid, type: this.mode }));
    }
    return tasks;
  }

  // ============ 添加待处理结果 ============
  _addPendingResult(task) {
    this.results.unshift({
      uuid: task.uuid,
      type: task.type,
      status: 'pending',
      url: null,
      thumbnail: null,
      isStar: false,
    });
    this._renderResults();
  }

  // ============ 轮询任务 ============
  _startPolling(uuid, type) {
    if (this.pollTimers.has(uuid)) clearInterval(this.pollTimers.get(uuid));

    const poll = async () => {
      try {
        const taskData = type === 'video'
          ? await API.Artifact.getVideoTask(uuid)
          : await API.Artifact.getTask(uuid);

        const result = this.results.find(r => r.uuid === uuid);
        if (!result) { this._stopPolling(uuid); return; }

        const status = taskData?.data?.status || taskData?.status || 'PROCESSING';
        result.status = status;

        if (status === 'SUCCESS' || status === 'completed' || status === 'success' || status === 'done') {
          this._handleTaskCompleted(uuid, taskData, type);
          this._stopPolling(uuid);
        } else if (status === 'FAILURE' || status === 'failed' || status === 'error') {
          result.status = 'failed';
          this._renderResults();
          this._stopPolling(uuid);
          Components.Toast.error('生成失败');
        } else {
          result.progress = taskData?.data?.progress || taskData?.progress || null;
          this._updateResultCard(uuid);
        }
      } catch {
        // 网络错误继续轮询
      }
    };

    poll();
    this.pollTimers.set(uuid, setInterval(poll, 3000));
  }

  _stopPolling(uuid) {
    if (this.pollTimers.has(uuid)) {
      clearInterval(this.pollTimers.get(uuid));
      this.pollTimers.delete(uuid);
    }
  }

  // ============ 任务完成处理 ============
  _handleTaskCompleted(uuid, taskData, type) {
    const result = this.results.find(r => r.uuid === uuid);
    if (!result) return;
    const data = taskData?.data || taskData;

    // /v3/task 返回格式: { status, artifacts: [{ url, modality, detail_url }], progress }
    const artifacts = data?.artifacts || [];

    if (type === 'video') {
      const video = artifacts.find(a => a.modality === 'VIDEO' || a.type === 'video') || artifacts[0];
      result.url = video?.url || video?.detail_url || data?.url || data?.video_url || '';
      result.thumbnail = video?.first_frame || data?.thumbnail || data?.cover_url || '';
    } else if (type === 'music') {
      // 音乐结果：可能是 audio URL 或 artifact
      const audio = artifacts.find(a => a.modality === 'AUDIO' || a.type === 'audio' || a.modality === 'MUSIC') || artifacts[0];
      result.url = audio?.url || data?.url || data?.audio_url || '';
      result.type = 'music';
    } else {
      const img = artifacts.find(a => a.modality === 'PICTURE' || a.type === 'picture') || artifacts[0];
      result.url = img?.url || data?.url || '';
      result.thumbnail = result.url; // 图片缩略图就是原图
    }

    if (!result.url) {
      result.status = 'failed';
      Components.Toast.error('生成完成但未获取到结果');
      this._renderResults();
      return;
    }

    result.isStar = data?.is_star || false;
    result.status = 'completed';
    this._renderResults();
    Components.Toast.success('生成完成');
    this._loadAPInfo();
  }

  // ============ 渲染结果（水平 Swiper） ============
  _renderResults() {
    const container = this.els.resultsArea;
    if (!container) return;

    if (this.results.length === 0) {
      container.innerHTML = `
        <div class="gen-welcome">
          <div class="gen-welcome-avatar">N</div>
          <h3>开始创作</h3>
          <p>输入描述文字，选择角色和风格，一键生成精美图片或视频</p>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="gen-swiper">${this.results.map(r => this._renderSwiperCard(r)).join('')}</div>`;
    this._bindResultEvents();

    // 自动滚动到最新结果（最左侧）
    requestAnimationFrame(() => {
      const swiper = container.querySelector('.gen-swiper');
      if (swiper) {
        swiper.scrollLeft = 0;
      }
    });
  }

  // ============ Swiper 结果卡片 ============
  _renderSwiperCard(result) {
    const isVideo = result.type === 'video';
    const isMusic = result.type === 'music';
    const isCompleted = result.status === 'completed';
    const isFailed = result.status === 'failed';

    let mediaHtml = '';
    if (isCompleted && result.url) {
      if (isVideo) {
        mediaHtml = `<video src="${result.url}" poster="${result.thumbnail || ''}" muted loop playsinline preload="metadata"></video>
          <div class="gen-result-play-btn"><svg width="40" height="40" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="8 5 20 12 8 19"/></svg></div>`;
      } else if (isMusic) {
        mediaHtml = `<div class="gen-swiper-card-loading" style="aspect-ratio:auto;min-height:160px;flex-direction:column;gap:16px">
          <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--brand-pink),var(--brand-purple));display:flex;align-items:center;justify-content:center;animation:pulse 2s infinite">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <audio src="${result.url}" controls preload="metadata" style="width:90%;max-width:280px"></audio>
          <span style="color:var(--text-secondary);font-size:13px">🎵 音乐生成完成</span>
        </div>`;
      } else {
        mediaHtml = `<img src="${result.url}" alt="生成结果" loading="lazy" />`;
      }
    } else if (isFailed) {
      mediaHtml = `<div class="gen-swiper-card-loading"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-red)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg><span style="color:var(--brand-red)">生成失败</span></div>`;
    } else {
      const progress = result.progress ? `${result.progress}%` : '';
      mediaHtml = `<div class="gen-swiper-card-loading"><div class="spinner spinner-lg"></div><span class="gen-result-status-text">${result.status === 'pending' ? '排队中...' : '生成中...'}</span>${progress ? `<div class="task-progress-bar"><div class="task-progress-fill" style="width:${progress}"></div></div>` : ''}</div>`;
    }

    const starIcon = result.isStar
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="var(--brand-pink)" stroke="var(--brand-pink)" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    return `
      <div class="gen-swiper-card" data-uuid="${result.uuid}" data-status="${result.status}">
        ${mediaHtml}
        ${isCompleted ? `
          <div class="gen-swiper-actions">
            <div class="gen-swiper-action-wrap gen-action-preview" data-uuid="${result.uuid}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span class="gen-action-label">预览</span>
            </div>
            <div class="gen-swiper-action-wrap gen-action-download" data-uuid="${result.uuid}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span class="gen-action-label">下载</span>
            </div>
            <div class="gen-swiper-action-wrap gen-action-star" data-uuid="${result.uuid}">${starIcon}<span class="gen-action-label">收藏</span></div>
            <div class="gen-swiper-action-wrap gen-action-publish" data-uuid="${result.uuid}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              <span class="gen-action-label">发布</span>
            </div>
            <div class="gen-swiper-action-wrap gen-action-delete" data-uuid="${result.uuid}" style="color:var(--brand-red)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              <span class="gen-action-label">删除</span>
            </div>
          </div>` : ''}
      </div>`;
  }

  _updateResultCard(uuid) {
    const container = this.els.resultsArea;
    if (!container) return;
    const card = container.querySelector(`[data-uuid="${uuid}"]`);
    if (!card) return;
    const result = this.results.find(r => r.uuid === uuid);
    if (!result) return;
    const statusText = card.querySelector('.gen-result-status-text');
    const progressBar = card.querySelector('.task-progress-fill');
    if (statusText) statusText.textContent = result.status === 'pending' ? '排队中...' : '生成中...';
    if (progressBar && result.progress) progressBar.style.width = `${result.progress}%`;
  }

  // ============ 结果事件绑定 ============
  _bindResultEvents() {
    const container = this.els.resultsArea;
    if (!container) return;

    // 预览
    container.querySelectorAll('.gen-action-preview').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const result = this.results.find(r => r.uuid === btn.dataset.uuid);
        if (!result?.url) return;
        if (result.type === 'video') this._previewVideo(result);
        else Components.ImageViewer.show(result.url);
      });
    });

    // 下载
    container.querySelectorAll('.gen-action-download').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const result = this.results.find(r => r.uuid === btn.dataset.uuid);
        if (!result?.url) return;
        try {
          let url = result.url;
          if (result.type === 'video') {
            try {
              const s = await API.Artifact.getVideoStreamUrl(result.url, result.uuid);
              url = s?.data?.url || s?.url || result.url;
            } catch { /* use original */ }
            this._downloadFile(url, `nieta-video-${result.uuid}.mp4`);
          } else {
            this._downloadFile(url, `nieta-image-${result.uuid}.png`);
          }
          Components.Toast.success('开始下载');
        } catch { Components.Toast.error('下载失败'); }
      });
    });

    // 收藏
    container.querySelectorAll('.gen-action-star').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const result = this.results.find(r => r.uuid === btn.dataset.uuid);
        if (!result) return;
        try {
          await API.Artifact.star(result.uuid, result.isStar);
          result.isStar = !result.isStar;
          this._renderResults();
          Components.Toast.success(result.isStar ? '已收藏' : '已取消收藏');
        } catch { Components.Toast.error('操作失败'); }
      });
    });

    // 发布
    container.querySelectorAll('.gen-action-publish').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const result = this.results.find(r => r.uuid === btn.dataset.uuid);
        if (!result?.url) return;
        this._publishResult(result);
      });
    });

    // 删除
    container.querySelectorAll('.gen-action-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const uuid = btn.dataset.uuid;
        const confirmed = await Components.Modal.confirm({ title: '删除确认', message: '确定要删除这个作品吗？', confirmText: '删除', type: 'danger' });
        if (!confirmed) return;
        try {
          await API.Artifact.delete(uuid);
          this._stopPolling(uuid);
          this.results = this.results.filter(r => r.uuid !== uuid);
          this._renderResults();
          Components.Toast.success('已删除');
        } catch { Components.Toast.error('删除失败'); }
      });
    });

    // 卡片点击预览
    container.querySelectorAll('.gen-swiper-card[data-uuid]').forEach(card => {
      card.addEventListener('click', () => {
        const result = this.results.find(r => r.uuid === card.dataset.uuid);
        if (!result || result.status !== 'completed' || !result.url) return;
        if (result.type === 'video') this._previewVideo(result);
        else Components.ImageViewer.show(result.url);
      });
    });

    // 视频播放按钮
    container.querySelectorAll('.gen-result-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('[data-uuid]');
        const video = card?.querySelector('video');
        if (!video) return;
        if (video.paused) { video.play(); btn.style.opacity = '0'; }
        else { video.pause(); btn.style.opacity = '1'; }
      });
    });

    // 视频点击播放/暂停
    container.querySelectorAll('video').forEach(video => {
      video.addEventListener('click', (e) => {
        e.stopPropagation();
        const playBtn = video.parentElement.querySelector('.gen-result-play-btn');
        if (video.paused) { video.play(); if (playBtn) playBtn.style.opacity = '0'; }
        else { video.pause(); if (playBtn) playBtn.style.opacity = '1'; }
      });
      video.addEventListener('ended', () => {
        const playBtn = video.parentElement.querySelector('.gen-result-play-btn');
        if (playBtn) playBtn.style.opacity = '1';
      });
    });
  }

  // ============ 发布结果 ============
  _publishResult(result) {
    const modal = Components.Modal.create({
      title: '发布作品',
      content: `
        <div class="publish-form">
          <div class="publish-preview">
            <div class="publish-images-row">
              <img class="publish-thumb" src="${result.url}" alt="预览" />
            </div>
          </div>
          <div class="form-group" style="margin-top:12px">
            <label class="form-label">标题 <span style="color:var(--brand-red)">*</span></label>
            <input type="text" class="form-input" id="publish-title" placeholder="请输入作品标题" maxlength="100" />
          </div>
          <div class="form-group" style="margin-top:12px">
            <label class="form-label">描述</label>
            <textarea class="form-input" id="publish-desc" placeholder="添加作品描述（可选）" rows="3" maxlength="500" style="resize:vertical"></textarea>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary modal-close-inner">取消</button>
        <button class="btn btn-primary modal-publish-inner">发布</button>
      `,
      width: '480px',
    });

    const titleInput = modal.el.querySelector('#publish-title');
    const descInput = modal.el.querySelector('#publish-desc');
    const publishBtn = modal.el.querySelector('.modal-publish-inner');
    const closeBtn = modal.el.querySelector('.modal-close-inner');

    closeBtn.addEventListener('click', () => modal.close());

    publishBtn.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      if (!title) {
        Components.Toast.error('请输入标题');
        titleInput.focus();
        return;
      }

      publishBtn.disabled = true;
      publishBtn.textContent = '发布中...';

      try {
        // 正确的发布流程：创建空故事 → 保存内容 → 发布
        // Step 1: 创建空故事
        const createRes = await API.Story.createEmpty();
        const storyId = createRes?.data?.storyId || createRes?.data?.uuid || createRes?.storyId || createRes?.uuid || '';
        if (!storyId) {
          throw new Error('创建故事失败，未获取到故事ID');
        }

        // Step 2: 保存故事内容（标题、描述、封面）
        await API.Story.save({
          uuid: storyId,
          name: title,
          description: descInput.value.trim(),
          coverUrl: result.url || '',
          status: 'PUBLISHED',
          displayData: { source: 'neta-studio', type: result.type || 'picture' },
        });

        // Step 3: 发布故事（query parameter，不是 body）
        await API.Story.publish(storyId);

        modal.close();
        Components.Toast.success('发布成功');
      } catch (err) {
        console.error('发布失败:', err);
        const msg = err?.data?.detail || err?.message || '发布失败，请重试';
        Components.Toast.error(msg);
        publishBtn.disabled = false;
        publishBtn.textContent = '发布';
      }
    });
  }

  // ============ Quick Pick Panel（快速选取） ============
  _openQuickPick() {
    if (this._quickPickActive) {
      this._closeQuickPick();
      return;
    }

    this._quickPickActive = true;
    this._quickPickTab = 'my-characters';
    this._quickPickSearchQuery = '';
    this._quickPickItems = [];

    const panel = document.createElement('div');
    panel.className = 'quick-pick-panel';
    panel.innerHTML = `
      <div class="quick-pick-header">
        <h3>快速选取</h3>
        <button class="quick-pick-close" id="quick-pick-close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="quick-pick-tabs" id="quick-pick-tabs">
        <button class="quick-pick-tab active" data-tab="my-characters">我的角色</button>
        <button class="quick-pick-tab" data-tab="fav-characters">收藏角色</button>
        <button class="quick-pick-tab" data-tab="style">风格</button>
        <button class="quick-pick-tab" data-tab="pose">姿势</button>
        <button class="quick-pick-tab" data-tab="scene">场景</button>
        <button class="quick-pick-tab" data-tab="create-element" style="color:var(--brand-pink)">+ 创建元素</button>
      </div>
      <div class="quick-pick-search">
        <input type="text" class="form-input" id="quick-pick-search-input" placeholder="搜索..." />
      </div>
      <div class="quick-pick-content" id="quick-pick-content">
        <div class="quick-pick-grid" id="quick-pick-grid"></div>
      </div>
    `;

    document.body.appendChild(panel);
    this._quickPickPanel = panel;

    // 触发 reflow 后添加 open class 以启动动画
    requestAnimationFrame(() => {
      panel.classList.add('open');
    });

    // 绑定关闭
    panel.querySelector('#quick-pick-close').addEventListener('click', () => this._closeQuickPick());

    // 绑定 Tab 切换
    panel.querySelectorAll('.quick-pick-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        panel.querySelectorAll('.quick-pick-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._quickPickTab = tab.dataset.tab;
        this._quickPickSearchQuery = '';
        const searchInput = panel.querySelector('#quick-pick-search-input');
        if (searchInput) searchInput.value = '';
        // 恢复 grid 显示（创建元素表单会隐藏它）
        const gridEl = panel.querySelector('#quick-pick-grid');
        if (gridEl) gridEl.style.display = '';
        this._loadQuickPickItems();
      });
    });

    // 绑定搜索
    const searchInput = panel.querySelector('#quick-pick-search-input');
    let searchDebounce = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        this._quickPickSearchQuery = searchInput.value.trim();
        this._loadQuickPickItems();
      }, 300);
    });

    // 加载初始数据
    this._loadQuickPickItems();
  }

  _renderCreateElementForm(container) {
    // 创建元素表单：名称 + prompt + 从已有生成结果选择
    const completedResults = this.results.filter(r => r.status === 'completed' && r.url);

    const resultOptions = completedResults.length > 0
      ? completedResults.map((r, i) => `<option value="${i}">图片 ${i + 1}</option>`).join('')
      : '<option value="">暂无已生成的图片</option>';

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;padding:4px 0">
        <!-- 预览图选择 -->
        <div>
          <label class="form-label" style="margin-bottom:8px;display:block">选择预览图 *</label>
          ${completedResults.length > 0
            ? `<div class="publish-images-row" id="create-element-thumbs">
                ${completedResults.map((r, i) => `
                  <div class="publish-thumb ${i === 0 ? 'selected' : ''}" data-index="${i}">
                    <img src="${r.url}" alt="图片${i+1}" />
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="create-element-artifact" value="0" />`
            : `<div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:13px">请先生成一张图片</div>
               <input type="hidden" id="create-element-artifact" value="" />`
          }
        </div>

        <!-- 元素名称 -->
        <div>
          <label class="form-label" style="margin-bottom:6px;display:block">元素名称 *</label>
          <input type="text" class="form-input" id="create-element-name" placeholder="给元素起个名字" maxlength="50" style="font-size:15px" />
        </div>

        <!-- 描述 Prompt -->
        <div>
          <label class="form-label" style="margin-bottom:6px;display:block">描述 Prompt *</label>
          <textarea class="form-input" id="create-element-prompt" placeholder="描述这个元素的特征" rows="2" style="min-height:50px;resize:vertical;font-size:14px"></textarea>
        </div>

        <!-- 可见性 -->
        <div>
          <label class="form-label" style="margin-bottom:6px;display:block">可见性</label>
          <div style="display:flex;gap:6px">
            <button class="ratio-btn active" data-access="PUBLIC" style="flex:1;font-size:13px">公开</button>
            <button class="ratio-btn" data-access="PRIVATE" style="flex:1;font-size:13px">私密</button>
          </div>
        </div>

        <!-- 提交按钮 -->
        <button class="btn btn-primary w-full" id="create-element-submit" ${completedResults.length === 0 ? 'disabled' : ''} style="padding:12px;font-size:15px;border-radius:var(--radius-lg)">
          创建元素
        </button>
      </div>
    `;

    // 缩略图点击选择
    const thumbs = container.querySelectorAll('#create-element-thumbs .publish-thumb');
    const hiddenInput = container.querySelector('#create-element-artifact');
    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        thumbs.forEach(t => t.classList.remove('selected'));
        thumb.classList.add('selected');
        if (hiddenInput) hiddenInput.value = thumb.dataset.index;
      });
    });

    // 可见性切换
    const accessBtns = container.querySelectorAll('[data-access]');
    let accessibility = 'PUBLIC';
    accessBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        accessBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        accessibility = btn.dataset.access;
      });
    });

    // 提交
    container.querySelector('#create-element-submit').addEventListener('click', async () => {
      const name = container.querySelector('#create-element-name').value.trim();
      const prompt = container.querySelector('#create-element-prompt').value.trim();
      const artifactIdx = container.querySelector('#create-element-artifact').value;
      const submitBtn = container.querySelector('#create-element-submit');

      if (!name) { Components.Toast.error('请输入元素名称'); return; }
      if (!prompt) { Components.Toast.error('请输入描述 Prompt'); return; }
      if (artifactIdx === '') { Components.Toast.error('请先生成一张图片'); return; }

      const result = completedResults[parseInt(artifactIdx)];
      if (!result?.uuid) { Components.Toast.error('所选图片无效'); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = '创建中...';

      try {
        const res = await API.Elementum.create({
          name,
          prompt,
          artifact_uuid: result.uuid,
          description: prompt,
          accessibility,
        });

        const elem = res?.data || res;
        if (elem?.uuid) {
          Components.Toast.success(`元素「${name}」创建成功！`);
          // 自动插入到 prompt
          const trigger = '/';
          const insertText = `${trigger}${name}`;
          if (this.els.prompt) {
            const start = this.els.prompt.selectionStart;
            const end = this.els.prompt.selectionEnd;
            const text = this.els.prompt.value;
            this.els.prompt.value = text.slice(0, start) + insertText + text.slice(end);
            this.els.prompt.focus();
            this.els.prompt.setSelectionRange(start + insertText.length, start + insertText.length);
            this._handlePromptInput();
          }
          // 保存到 map
          this._selectedItemsMap[name] = {
            uuid: elem.uuid,
            name: elem.name || name,
            img_url: elem.avatar || result.url || '',
            sub_type: elem.sub_type || 'elementum-style',
            isOfficial: false,
          };
          this._closeQuickPick();
        } else {
          Components.Toast.error('创建成功但未获取到元素信息');
        }
      } catch (err) {
        console.error('创建元素失败:', err);
        Components.Toast.error(`创建失败: ${err?.message || '未知错误'}`);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> 创建元素';
      }
    });
  }

  _closeQuickPick() {
    this._quickPickActive = false;
    if (this._quickPickPanel) {
      this._quickPickPanel.remove();
      this._quickPickPanel = null;
    }
  }

  // 从 API 响应中提取列表（兼容多种嵌套格式）
  _extractList(res) {
    if (!res) return [];
    // 直接是数组
    if (Array.isArray(res)) return res;
    // { data: [...] } 或 { data: { list: [...] } }
    const d = res.data;
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.list)) return d.list;
    if (d && Array.isArray(d.items)) return d.items;
    // { list: [...] }
    if (Array.isArray(res.list)) return res.list;
    if (Array.isArray(res.items)) return res.items;
    return [];
  }

  async _loadQuickPickItems() {
    const grid = this._quickPickPanel?.querySelector('#quick-pick-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="quick-pick-empty"><div class="spinner spinner-lg"></div></div>';

    try {
      let items = [];
      const query = this._quickPickSearchQuery;

      switch (this._quickPickTab) {
        case 'my-characters': {
          const res = await API.Character.typeahead(query);
          const list = this._extractList(res);
          items = list.map(item => ({
            ...item,
            name: item.name || item.short_name || '',
            avatar: item.config?.avatar_img || item.avatar || item.thumbnail || '',
            _pickType: 'character',
            _pickTrigger: '@',
          }));
          break;
        }
        case 'fav-characters': {
          const res = await API.Character.typeahead(query);
          const list = this._extractList(res);
          items = list.map(item => ({
            ...item,
            name: item.name || item.short_name || '',
            avatar: item.config?.avatar_img || item.avatar || item.thumbnail || '',
            _pickType: 'character',
            _pickTrigger: '@',
          }));
          break;
        }
        case 'style':
        case 'pose':
        case 'scene': {
          const subTypeMap = {
            style: 'elementum-style',
            pose: 'elementum-pose',
            scene: 'elementum-scene',
          };
          const res = await API.Elementum.typeahead(query, 'elementum');
          const list = this._extractList(res);
          const targetSubType = subTypeMap[this._quickPickTab] || this._quickPickTab;
          items = list
            .filter(item => {
              const sub = item.sub_type || item.type || '';
              return sub.includes(targetSubType) || sub.includes(this._quickPickTab);
            })
            .map(item => ({
              ...item,
              name: item.name || item.short_name || '',
              avatar: item.config?.avatar_img || item.config?.cover_img || item.avatar || item.thumbnail || '',
              _pickType: item.sub_type || item.type || 'element',
              _pickTrigger: '/',
            }));
          break;
        }
        case 'create-element': {
          // 显示创建元素表单（渲染到 content 而非 grid）
          const content = this._quickPickPanel?.querySelector('#quick-pick-content');
          const grid = this._quickPickPanel?.querySelector('#quick-pick-grid');
          if (grid) grid.style.display = 'none';
          this._renderCreateElementForm(content || grid);
          return;
        }
      }

      this._quickPickItems = items;
      this._renderQuickPickItems(items);
    } catch (err) {
      console.warn('快速选取加载失败:', err);
      const isAuth = err?.status === 403 || err?.status === 401;
      grid.innerHTML = `<div class="quick-pick-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        <span>${isAuth ? '请先设置 Token 后查看' : '加载失败，请重试'}</span>
      </div>`;
    }
  }

  _renderQuickPickItems(items) {
    const grid = this._quickPickPanel?.querySelector('#quick-pick-grid');
    if (!grid) return;

    if (!items || items.length === 0) {
      grid.innerHTML = '<div class="quick-pick-empty">暂无数据</div>';
      return;
    }

    grid.innerHTML = items.map((item, i) => {
      const name = item.name || '未知';
      const avatar = item.avatar || '';
      return `
        <div class="quick-pick-item" data-index="${i}">
          ${avatar
            ? `<img class="quick-pick-item-avatar" src="${avatar}" alt="${name}" onerror="this.outerHTML='<div class=\\'quick-pick-item-avatar-placeholder\\'>${name.charAt(0)}</div>'" />`
            : `<div class="quick-pick-item-avatar-placeholder">${name.charAt(0)}</div>`
          }
          <div class="quick-pick-item-name">${name}</div>
        </div>
      `;
    }).join('');

    // 绑定点击事件
    grid.querySelectorAll('.quick-pick-item').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index);
        const item = this._quickPickItems[index];
        if (!item) return;

        const name = item.name || '';
        const trigger = item._pickTrigger || '@';

        // 保存到 _selectedItemsMap
        this._selectedItemsMap[name] = {
          uuid: item.uuid || item.id || '',
          name: name,
          short_name: item.short_name || item.title || '',
          type: item._pickType || 'character',
          cover_url: item.cover_url || item.image_url || '',
          img_url: (item.avatar || item.config?.avatar_img || item.config?.cover_img || item.thumbnail || item.cover_url || item.image_url || '').replace(/`/g, ''),
          sub_type: item.sub_type || '',
        };

        // 插入到 prompt
        const textarea = this.els.prompt;
        if (textarea) {
          const insertText = `${trigger}${name} `;
          const pos = textarea.selectionStart;
          const val = textarea.value;
          // 在光标位置前确保有空格分隔
          const before = val.substring(0, pos);
          const after = val.substring(pos);
          const needSpace = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
          textarea.value = before + needSpace + insertText + after;
          const newPos = before.length + needSpace + insertText.length;
          textarea.setSelectionRange(newPos, newPos);
          this._updateHighlight();
          this._updateMentionedItems();
        }

        this._closeQuickPick();
      });
    });
  }

  // ============ 视频预览 ============
  _previewVideo(result) {
    const modal = Components.Modal.create({
      title: '视频预览',
      content: `<div style="display:flex;justify-content:center;background:#000;border-radius:var(--radius-md);overflow:hidden"><video src="${result.url}" controls autoplay style="max-width:100%;max-height:70vh"></video></div>`,
      footer: `<button class="btn btn-secondary modal-close-inner">关闭</button><button class="btn btn-primary modal-download-inner">下载视频</button>`,
      width: '720px',
    });
    modal.el.querySelector('.modal-close-inner').addEventListener('click', () => modal.close());
    modal.el.querySelector('.modal-download-inner').addEventListener('click', async () => {
      try {
        let url = result.url;
        try { const s = await API.Artifact.getVideoStreamUrl(result.url, result.uuid); url = s?.data?.url || s?.url || result.url; } catch { /* */ }
        this._downloadFile(url, `nieta-video-${result.uuid}.mp4`);
        Components.Toast.success('开始下载');
      } catch { Components.Toast.error('下载失败'); }
    });
  }

  // ============ 下载文件 ============
  _downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'download'; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 100);
  }

  // ============ 设置提交按钮加载状态 ============
  _setSubmitLoading(loading) {
    const btn = this.els.sendBtn;
    if (loading) {
      btn.disabled = true;
      btn.innerHTML = `<div class="spinner spinner-sm" style="border-top-color:#fff;width:20px;height:20px"></div>`;
    } else {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>`;
    }
  }

  // ============ 销毁 ============
  destroy() {
    this.pollTimers.forEach(t => clearInterval(t));
    this.pollTimers.clear();
    this._closeQuickPick();
    if (this.container) this.container.innerHTML = '';
    this.results = [];
  }
}
