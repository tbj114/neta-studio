/* ============================================
   Nieta Studio - 作品管理页面
   WorksPage 类
   ============================================ */

class WorksPage {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) throw new Error('WorksPage: 容器不存在');

    // 状态
    this.activeTab = 'mine'; // 'mine' | 'favorites' | 'likes'
    this.activeFilter = 'all'; // 'all' | 'image' | 'video'
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalPages = 1;
    this.isLoading = false;
    this.artifacts = [];
    this.selectedUuids = new Set();

    // 组件实例
    this.pagination = null;

    // DOM 引用
    this.els = {};

    this._init();
  }

  // ============ 初始化 ============
  async _init() {
    this.container.innerHTML = this._renderTemplate();
    this._cacheElements();
    this._bindEvents();
    this._initPagination();
    await this._loadData();
  }

  // ============ HTML 模板 ============
  _renderTemplate() {
    return `
      <div class="works-page">
        <!-- 顶部工具栏 -->
        <div class="works-toolbar">
          <div class="works-tabs">
            <button class="works-tab active" data-tab="mine">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              <span>我的作品</span>
            </button>
            <button class="works-tab" data-tab="favorites">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>收藏的作品</span>
            </button>
            <button class="works-tab" data-tab="likes">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              <span>点赞的作品</span>
            </button>
          </div>
          <div class="works-filters">
            <button class="works-filter active" data-filter="all">全部</button>
            <button class="works-filter" data-filter="image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              图片
            </button>
            <button class="works-filter" data-filter="video">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              视频
            </button>
          </div>
        </div>

        <!-- 批量操作栏 -->
        <div class="works-bulk-bar hidden" id="works-bulk-bar">
          <span class="works-bulk-count">已选择 <strong id="bulk-count">0</strong> 项</span>
          <div class="works-bulk-actions">
            <button class="btn btn-sm btn-secondary" id="bulk-publish">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>
              发布为作品集
            </button>
            <button class="btn btn-sm btn-danger" id="bulk-delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              删除选中
            </button>
            <button class="btn btn-sm btn-ghost" id="bulk-cancel">取消选择</button>
          </div>
        </div>

        <!-- 作品网格 -->
        <div class="works-content" id="works-content">
          ${Components.loadingState('加载作品中...')}
        </div>

        <!-- 分页 -->
        <div class="works-pagination" id="works-pagination"></div>
      </div>
    `;
  }

  // ============ 缓存 DOM 引用 ============
  _cacheElements() {
    this.els = {
      tabs: this.container.querySelectorAll('.works-tab'),
      filters: this.container.querySelectorAll('.works-filter'),
      content: this.container.querySelector('#works-content'),
      pagination: this.container.querySelector('#works-pagination'),
      bulkBar: this.container.querySelector('#works-bulk-bar'),
      bulkCount: this.container.querySelector('#bulk-count'),
      bulkPublish: this.container.querySelector('#bulk-publish'),
      bulkDelete: this.container.querySelector('#bulk-delete'),
      bulkCancel: this.container.querySelector('#bulk-cancel'),
    };
  }

  // ============ 初始化分页 ============
  _initPagination() {
    this.pagination = new Components.Pagination({
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      onPageChange: (page) => {
        this.currentPage = page;
        this._loadData();
      },
    });
    this.els.pagination.innerHTML = '';
    this.els.pagination.appendChild(this.pagination.render());
  }

  // ============ 事件绑定 ============
  _bindEvents() {
    // Tab 切换
    this.els.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const t = tab.dataset.tab;
        if (t === this.activeTab) return;
        this.activeTab = t;
        this.currentPage = 1;
        this.selectedUuids.clear();
        this._updateBulkBar();
        this.els.tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === t));
        this._loadData();
      });
    });

    // 筛选切换
    this.els.filters.forEach(filter => {
      filter.addEventListener('click', () => {
        const f = filter.dataset.filter;
        if (f === this.activeFilter) return;
        this.activeFilter = f;
        this.currentPage = 1;
        this.els.filters.forEach(b => b.classList.toggle('active', b.dataset.filter === f));
        this._loadData();
      });
    });

    // 批量操作
    this.els.bulkPublish.addEventListener('click', () => this._bulkPublish());
    this.els.bulkDelete.addEventListener('click', () => this._bulkDelete());
    this.els.bulkCancel.addEventListener('click', () => {
      this.selectedUuids.clear();
      this._updateBulkBar();
      this._renderGrid();
    });
  }

  // ============ 加载数据 ============
  async _loadData() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.els.content.innerHTML = Components.loadingState('加载中...');

    try {
      switch (this.activeTab) {
        case 'mine':
          await this._loadMyWorks();
          break;
        case 'favorites':
          await this._loadFavorites();
          break;
        case 'likes':
          await this._loadLikes();
          break;
      }
    } catch (err) {
      console.error('加载作品失败:', err);
      this.els.content.innerHTML = Components.emptyState(
        Components.Icons.empty,
        '加载失败',
        '请稍后重试'
      );
    } finally {
      this.isLoading = false;
    }
  }

  // ============ 加载我的作品 ============
  async _loadMyWorks() {
    const query = {
      page_index: this.currentPage,
      page_size: this.pageSize,
    };

    // 按类型筛选
    if (this.activeFilter === 'image') {
      query.modality = 'image';
    } else if (this.activeFilter === 'video') {
      query.modality = 'video';
    }

    const data = await API.Artifact.list(query);
    const items = data?.data || data?.list || data?.items || [];
    const total = data?.total || data?.total_count || 0;

    this.artifacts = items.map(item => this._normalizeArtifact(item));
    this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.pagination.setTotalPages(this.totalPages);
    this.pagination.setPage(this.currentPage);
    this._renderGrid();
  }

  // ============ 加载收藏的作品 ============
  async _loadFavorites() {
    const query = {
      page_index: this.currentPage,
      page_size: this.pageSize,
    };

    if (this.activeFilter === 'image') {
      query.type = 'image';
    } else if (this.activeFilter === 'video') {
      query.type = 'video';
    }

    const data = await API.Artifact.list(query);
    const items = (data?.data || data?.list || data?.items || []).filter(
      item => item.is_star || item.is_favor
    );

    this.artifacts = items.map(item => this._normalizeArtifact(item));
    this.totalPages = Math.max(1, Math.ceil((data?.total || 0) / this.pageSize));
    this.pagination.setTotalPages(this.totalPages);
    this.pagination.setPage(this.currentPage);
    this._renderGrid();
  }

  // ============ 加载点赞的作品 ============
  async _loadLikes() {
    const data = await API.Story.likedStories(this.currentPage, this.pageSize);
    const items = data?.data || data?.list || data?.items || [];

    // 点赞列表返回的是作品集(story)，需要提取其中的图片/视频
    this.artifacts = items.map(item => ({
      uuid: item.uuid || item.id,
      type: item.type || 'image',
      url: item.cover_url || item.thumbnail || item.cover || '',
      thumbnail: item.cover_url || item.thumbnail || item.cover || '',
      title: item.title || '',
      isStar: item.is_favor || false,
      isLike: true,
      isVideo: item.type === 'video',
      storyUuid: item.uuid || item.id,
      storyData: item,
    }));

    this.totalPages = Math.max(1, Math.ceil((data?.total || 0) / this.pageSize));
    this.pagination.setTotalPages(this.totalPages);
    this.pagination.setPage(this.currentPage);
    this._renderGrid();
  }

  // ============ 标准化作品数据 ============
  _normalizeArtifact(item) {
    const isVideo = item.modality === 'video' || item.type === 'video' || item.is_video;
    const url = isVideo
      ? (item.video_url || item.url || item.output?.url || '')
      : (item.image_url || item.url || item.thumbnail || item.output?.url || item.output?.images?.[0]?.url || '');

    return {
      uuid: item.uuid || item.id,
      type: isVideo ? 'video' : 'image',
      url: url,
      thumbnail: item.thumbnail || item.cover_url || url || '',
      title: item.title || item.prompt || '',
      isStar: item.is_star || item.is_favor || false,
      isLike: item.is_like || false,
      isVideo: isVideo,
      prompt: item.prompt || '',
      raw: item,
    };
  }

  // ============ 渲染网格 ============
  _renderGrid() {
    if (this.artifacts.length === 0) {
      const emptyMessages = {
        mine: { title: '暂无作品', desc: '去创作你的第一个作品吧' },
        favorites: { title: '暂无收藏', desc: '收藏喜欢的作品，方便随时查看' },
        likes: { title: '暂无点赞', desc: '点赞你喜欢的作品集' },
      };
      const msg = emptyMessages[this.activeTab];
      this.els.content.innerHTML = Components.emptyState(
        Components.Icons.empty,
        msg.title,
        msg.desc
      );
      return;
    }

    this.els.content.innerHTML = `
      <div class="works-grid">
        ${this.artifacts.map(item => this._renderCard(item)).join('')}
      </div>
    `;

    this._bindCardEvents();
  }

  // ============ 渲染单个卡片 ============
  _renderCard(item) {
    const isSelected = this.selectedUuids.has(item.uuid);
    const isVideo = item.isVideo || item.type === 'video';

    let mediaHtml;
    if (item.thumbnail || item.url) {
      if (isVideo) {
        mediaHtml = `
          <img src="${item.thumbnail || item.url}" alt="${item.title}" loading="lazy" />
          <div class="works-card-play">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="8 5 20 12 8 19"/></svg>
          </div>
        `;
      } else {
        mediaHtml = `<img src="${item.thumbnail || item.url}" alt="${item.title}" loading="lazy" />`;
      }
    } else {
      mediaHtml = `
        <div class="works-card-placeholder">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
          </svg>
        </div>
      `;
    }

    const starClass = item.isStar ? 'works-action-active' : '';
    const starIcon = item.isStar
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--brand-pink)" stroke="var(--brand-pink)" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    return `
      <div class="works-card ${isSelected ? 'works-card-selected' : ''}" data-uuid="${item.uuid}">
        <div class="works-card-checkbox ${isSelected ? 'checked' : ''}" data-uuid="${item.uuid}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <div class="works-card-media">
          ${mediaHtml}
          <div class="works-card-overlay">
            <div class="works-card-type-badge ${isVideo ? 'badge-video' : 'badge-image'}">
              ${isVideo ? '视频' : '图片'}
            </div>
          </div>
        </div>
        <div class="works-card-actions">
          <button class="btn btn-icon btn-ghost works-action-preview" title="预览" data-uuid="${item.uuid}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn btn-icon btn-ghost works-action-download" title="下载" data-uuid="${item.uuid}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="btn btn-icon btn-ghost works-action-star ${starClass}" title="收藏" data-uuid="${item.uuid}">
            ${starIcon}
          </button>
          <button class="btn btn-icon btn-ghost works-action-publish" title="发布为作品集" data-uuid="${item.uuid}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
          <button class="btn btn-icon btn-ghost works-action-delete" title="删除" data-uuid="${item.uuid}" style="color:var(--brand-red)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  // ============ 绑定卡片事件 ============
  _bindCardEvents() {
    // 点击卡片预览
    this.els.content.querySelectorAll('.works-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // 如果点击的是按钮或复选框，不触发预览
        if (e.target.closest('.works-card-actions') || e.target.closest('.works-card-checkbox')) return;
        const uuid = card.dataset.uuid;
        const item = this.artifacts.find(a => a.uuid === uuid);
        if (!item) return;
        this._previewItem(item);
      });
    });

    // 复选框选择
    this.els.content.querySelectorAll('.works-card-checkbox').forEach(cb => {
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        const uuid = cb.dataset.uuid;
        if (this.selectedUuids.has(uuid)) {
          this.selectedUuids.delete(uuid);
        } else {
          this.selectedUuids.add(uuid);
        }
        this._updateBulkBar();
        this._renderGrid();
      });
    });

    // 预览
    this.els.content.querySelectorAll('.works-action-preview').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uuid = btn.dataset.uuid;
        const item = this.artifacts.find(a => a.uuid === uuid);
        if (item) this._previewItem(item);
      });
    });

    // 下载
    this.els.content.querySelectorAll('.works-action-download').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const uuid = btn.dataset.uuid;
        const item = this.artifacts.find(a => a.uuid === uuid);
        if (!item) return;

        try {
          let downloadUrl = item.url;
          if (item.isVideo) {
            try {
              const streamData = await API.Artifact.getVideoStreamUrl(item.url, uuid);
              downloadUrl = streamData?.data?.url || streamData?.url || item.url;
            } catch {
              downloadUrl = item.url;
            }
            this._downloadFile(downloadUrl, `nieta-video-${uuid}.mp4`);
          } else {
            this._downloadFile(downloadUrl, `nieta-image-${uuid}.png`);
          }
          Components.Toast.success('开始下载');
        } catch (err) {
          Components.Toast.error('下载失败');
        }
      });
    });

    // 收藏/取消收藏
    this.els.content.querySelectorAll('.works-action-star').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const uuid = btn.dataset.uuid;
        const item = this.artifacts.find(a => a.uuid === uuid);
        if (!item) return;

        try {
          await API.Artifact.star(uuid, item.isStar);
          item.isStar = !item.isStar;
          this._renderGrid();
          Components.Toast.success(item.isStar ? '已收藏' : '已取消收藏');
        } catch (err) {
          Components.Toast.error('操作失败');
        }
      });
    });

    // 发布为作品集（单个）
    this.els.content.querySelectorAll('.works-action-publish').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const uuid = btn.dataset.uuid;
        await this._publishAsStory([uuid]);
      });
    });

    // 删除
    this.els.content.querySelectorAll('.works-action-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const uuid = btn.dataset.uuid;

        const confirmed = await Components.Modal.confirm({
          title: '删除确认',
          message: '确定要删除这个作品吗？此操作不可撤销。',
          confirmText: '删除',
          type: 'danger',
        });

        if (!confirmed) return;

        try {
          await API.Artifact.delete(uuid);
          this.artifacts = this.artifacts.filter(a => a.uuid !== uuid);
          this.selectedUuids.delete(uuid);
          this._updateBulkBar();
          this._renderGrid();
          Components.Toast.success('已删除');
        } catch (err) {
          Components.Toast.error('删除失败');
        }
      });
    });
  }

  // ============ 预览作品 ============
  _previewItem(item) {
    if (item.isVideo || item.type === 'video') {
      this._previewVideo(item);
    } else {
      const previewUrl = item.url || item.thumbnail;
      if (previewUrl) {
        Components.ImageViewer.show(previewUrl);
      }
    }
  }

  // ============ 视频预览弹窗 ============
  _previewVideo(item) {
    const videoUrl = item.url || '';
    if (!videoUrl) {
      Components.Toast.error('无法获取视频地址');
      return;
    }

    Components.Modal.create({
      title: '视频预览',
      content: `
        <div style="display:flex;justify-content:center;background:#000;border-radius:var(--radius-md);overflow:hidden">
          <video
            src="${videoUrl}"
            controls
            autoplay
            style="max-width:100%;max-height:70vh"
          ></video>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary modal-close-btn-inner">关闭</button>
        <button class="btn btn-primary modal-download-btn">下载视频</button>
      `,
      width: '720px',
    });

    // 需要在 DOM 渲染后绑定事件，使用 setTimeout
    setTimeout(() => {
      const modal = document.querySelector('.modal-overlay:last-of-type');
      if (!modal) return;
      const modalEl = modal.querySelector('.modal');
      if (!modalEl) return;

      modalEl.querySelector('.modal-close-btn-inner')?.addEventListener('click', () => {
        modal.classList.remove('open');
        setTimeout(() => modal.remove(), 250);
      });

      modalEl.querySelector('.modal-download-btn')?.addEventListener('click', async () => {
        try {
          let downloadUrl = videoUrl;
          try {
            const streamData = await API.Artifact.getVideoStreamUrl(videoUrl, item.uuid);
            downloadUrl = streamData?.data?.url || streamData?.url || videoUrl;
          } catch {
            downloadUrl = videoUrl;
          }
          this._downloadFile(downloadUrl, `nieta-video-${item.uuid}.mp4`);
          Components.Toast.success('开始下载');
        } catch {
          Components.Toast.error('下载失败');
        }
      });
    }, 50);
  }

  // ============ 发布为作品集 ============
  async _publishAsStory(uuids) {
    if (!uuids || uuids.length === 0) {
      Components.Toast.error('请选择要发布的作品');
      return;
    }

    Components.Toast.info('正在创建作品集...');

    try {
      // 1. 创建空白作品集
      const storyData = await API.Story.createEmpty();
      const storyUuid = storyData?.data?.uuid || storyData?.uuid || storyData?.story_uuid;

      if (!storyUuid) {
        Components.Toast.error('创建作品集失败');
        return;
      }

      // 2. 获取作品详情
      const detailData = await API.Artifact.getArtifactDetail(uuids);
      const artifacts = detailData?.data || detailData || [];

      // 3. 构建作品集数据
      const pictureUuids = [];
      const videoUuids = [];

      (Array.isArray(artifacts) ? artifacts : [artifacts]).forEach(a => {
        const uuid = a.uuid || a.id;
        if (a.modality === 'video' || a.type === 'video') {
          videoUuids.push(uuid);
        } else {
          pictureUuids.push(uuid);
        }
      });

      // 4. 保存作品集
      await API.Story.save({
        uuid: storyUuid,
        title: `我的作品集 - ${new Date().toLocaleDateString('zh-CN')}`,
        picture_uuids: pictureUuids,
        video_uuids: videoUuids,
      });

      // 5. 发布
      await API.Story.publish({
        uuid: storyUuid,
        is_public: true,
      });

      Components.Toast.success('作品集已发布');

      // 清除选择
      this.selectedUuids.clear();
      this._updateBulkBar();
      this._renderGrid();
    } catch (err) {
      console.error('发布作品集失败:', err);
      Components.Toast.error('发布失败，请重试');
    }
  }

  // ============ 批量发布 ============
  async _bulkPublish() {
    const uuids = Array.from(this.selectedUuids);
    if (uuids.length === 0) {
      Components.Toast.error('请先选择作品');
      return;
    }
    await this._publishAsStory(uuids);
  }

  // ============ 批量删除 ============
  async _bulkDelete() {
    const uuids = Array.from(this.selectedUuids);
    if (uuids.length === 0) {
      Components.Toast.error('请先选择作品');
      return;
    }

    const confirmed = await Components.Modal.confirm({
      title: '批量删除确认',
      message: `确定要删除选中的 ${uuids.length} 个作品吗？此操作不可撤销。`,
      confirmText: '全部删除',
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      await API.Artifact.delete(uuids);
      this.artifacts = this.artifacts.filter(a => !this.selectedUuids.has(a.uuid));
      this.selectedUuids.clear();
      this._updateBulkBar();
      this._renderGrid();
      Components.Toast.success(`已删除 ${uuids.length} 个作品`);
    } catch (err) {
      Components.Toast.error('删除失败');
    }
  }

  // ============ 更新批量操作栏 ============
  _updateBulkBar() {
    const count = this.selectedUuids.size;
    if (count > 0) {
      this.els.bulkBar.classList.remove('hidden');
      this.els.bulkCount.textContent = count;
    } else {
      this.els.bulkBar.classList.add('hidden');
    }
  }

  // ============ 下载文件 ============
  _downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
  }

  // ============ 销毁 ============
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.artifacts = [];
    this.selectedUuids.clear();
    this.pagination = null;
  }
}
