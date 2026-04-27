/* ============================================
   Nieta Studio - Feed 浏览页面
   FeedPage 类
   ============================================ */

class FeedPage {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container) throw new Error('FeedPage: 容器不存在');

    // 状态
    this.currentPage = 0;
    this.pageSize = 20;
    this.totalPages = 1;
    this.isLoading = false;
    this.isLoadingMore = false;
    this.hasMore = true;
    this.stories = [];
    this.layoutMode = 'grid'; // 'grid' | 'masonry'

    // 无限滚动节流
    this._scrollTimer = null;

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
    this._initInfiniteScroll();
    await this._loadFeeds();
  }

  // ============ HTML 模板 ============
  _renderTemplate() {
    return `
      <div class="feed-page">
        <!-- 顶部工具栏 -->
        <div class="feed-toolbar">
          <div class="feed-toolbar-left">
            <h2 class="feed-title">社区作品集</h2>
            <span class="feed-count" id="feed-count"></span>
          </div>
          <div class="feed-toolbar-right">
            <div class="feed-layout-switch">
              <button class="feed-layout-btn active" data-layout="grid" title="网格布局">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </button>
              <button class="feed-layout-btn" data-layout="masonry" title="瀑布流布局">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="11" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="17" width="7" height="4" rx="1"/><rect x="14" y="13" width="7" height="8" rx="1"/></svg>
              </button>
            </div>
            <button class="btn btn-sm btn-secondary feed-refresh-btn" id="feed-refresh">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
              刷新
            </button>
          </div>
        </div>

        <!-- Feed 内容区域 -->
        <div class="feed-content" id="feed-content">
          ${Components.loadingState('加载 Feed 中...')}
        </div>

        <!-- 加载更多 -->
        <div class="feed-load-more hidden" id="feed-load-more">
          <div class="spinner spinner-sm"></div>
          <span>加载更多...</span>
        </div>

        <!-- 分页 -->
        <div class="feed-pagination" id="feed-pagination"></div>
      </div>
    `;
  }

  // ============ 缓存 DOM 引用 ============
  _cacheElements() {
    this.els = {
      content: this.container.querySelector('#feed-content'),
      pagination: this.container.querySelector('#feed-pagination'),
      loadMore: this.container.querySelector('#feed-load-more'),
      count: this.container.querySelector('#feed-count'),
      refreshBtn: this.container.querySelector('#feed-refresh'),
      layoutBtns: this.container.querySelectorAll('.feed-layout-btn'),
    };
  }

  // ============ 初始化分页 ============
  _initPagination() {
    this.pagination = new Components.Pagination({
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      onPageChange: (page) => {
        this.currentPage = page;
        this._loadFeeds();
      },
    });
    this.els.pagination.innerHTML = '';
    this.els.pagination.appendChild(this.pagination.render());
  }

  // ============ 获取滚动容器 ============
  _getScrollContainer() {
    return this.container.closest('.page-container-mobile')
      || this.container.closest('.page-container')
      || null;
  }

  // ============ 初始化无限滚动 ============
  _initInfiniteScroll() {
    const scrollContainer = this._getScrollContainer() || window;

    const handleScroll = () => {
      if (this._scrollTimer) return;
      this._scrollTimer = setTimeout(() => {
        this._scrollTimer = null;
        if (this.isLoading || this.isLoadingMore || !this.hasMore) return;

        const scrollEl = this._getScrollContainer();
        if (!scrollEl) return;

        const scrollBottom = scrollEl.scrollTop + scrollEl.clientHeight;
        const threshold = scrollEl.scrollHeight - 300;

        if (scrollBottom >= threshold) {
          this._loadMore();
        }
      }, 100);
    };

    const scrollEl = scrollContainer === window ? window : scrollContainer;
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    this._scrollCleanup = () => scrollEl.removeEventListener('scroll', handleScroll);
  }

  // ============ 事件绑定 ============
  _bindEvents() {
    // 布局切换
    this.els.layoutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const layout = btn.dataset.layout;
        if (layout === this.layoutMode) return;
        this.layoutMode = layout;
        this.els.layoutBtns.forEach(b => b.classList.toggle('active', b.dataset.layout === layout));
        this._renderFeed();
      });
    });

    // 刷新
    this.els.refreshBtn.addEventListener('click', () => {
      this.currentPage = 0;
      this.hasMore = true;
      this._loadFeeds();
    });
  }

  // ============ 解析 API 响应中的列表数据 ============
  _extractItems(data) {
    // 模块化响应格式（/v1/home/feed/mainlist 或 interactive）
    if (data?.module_list && Array.isArray(data.module_list)) {
      const items = [];
      for (const mod of data.module_list) {
        const modData = mod?.json_data || mod?.data || {};
        const tpl = mod?.template_id || '';
        // 跳过非内容模块（ACTIVITY 等）
        if (tpl === 'ACTIVITY' || tpl === 'head_filter_module') continue;
        // 每个模块的 json_data 就是一个 story 对象（用 storyId 或 uuid 标识）
        if ((modData.storyId || modData.uuid) && typeof (modData.storyId || modData.uuid) === 'string') {
          items.push(modData);
        }
      }
      if (items.length > 0) return items;
    }
    // 标准响应格式
    if (Array.isArray(data?.data?.list)) return data.data.list;
    if (Array.isArray(data?.data) && data.data.length > 0 && typeof data.data[0] === 'object') return data.data;
    if (Array.isArray(data?.list)) return data.list;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data)) return data;
    return [];
  }

  // ============ 解析 API 响应中的总数 ============
  _extractTotal(data, itemsLength) {
    if (data?.page_data?.has_next_page !== undefined) {
      return data.page_data.has_next_page ? itemsLength + 1 : itemsLength;
    }
    if (typeof data?.data?.total === 'number') return data.data.total;
    if (typeof data?.total === 'number') return data.total;
    if (typeof data?.total_count === 'number') return data.total_count;
    if (typeof data?.data?.total_count === 'number') return data.data.total_count;
    // 如果无法获取 total，根据返回条数推断是否有更多
    return itemsLength;
  }

  // ============ 渲染错误状态 ============
  _renderErrorState(title, message, actionBtnHtml) {
    return `
      <div class="empty-state" style="padding: var(--space-2xl); text-align: center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5" style="margin-bottom: var(--space-md);">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p style="font-size: var(--text-lg); font-weight: 500; color: var(--text-secondary); margin-bottom: var(--space-xs);">${title}</p>
        <p style="font-size: var(--text-sm); color: var(--text-tertiary); margin-bottom: var(--space-md);">${message}</p>
        ${actionBtnHtml || ''}
      </div>
    `;
  }

  // ============ 打开 Token 设置面板 ============
  _openTokenPanel() {
    // 尝试触发全局的设置面板打开（如果有）
    if (typeof window.openSettingsPanel === 'function') {
      window.openSettingsPanel('token');
      return;
    }
    // 尝试通过导航事件触发
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'token' } }));
      return;
    }
    // 回退：提示用户手动设置
    Components.Toast.info('请在设置页面中配置 Token');
  }

  // ============ 加载 Feed ============
  async _loadFeeds() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.els.content.innerHTML = Components.loadingState('加载 Feed 中...');

    try {
      // 加载静态 JSON（由 GitHub Actions 定时更新，绕过 CORS 限制）
      const resp = await fetch('data/feed.json');
      if (!resp.ok) throw new Error(`加载 feed.json 失败: HTTP ${resp.status}`);
      const items = await resp.json();

      console.log('[Feed] 加载 feed.json:', items.length, '条');

      this.stories = items.map(item => this._normalizeStory(item));
      this.totalPages = 1;
      this.hasMore = false;

      this.pagination.setTotalPages(1);
      this.pagination.setPage(1);

      if (this.stories.length > 0) {
        this.els.count.textContent = `共 ${this.stories.length} 个作品集`;
      } else {
        this.els.count.textContent = '';
      }

      this._renderFeed();
    } catch (err) {
      console.error('加载 Feed 失败:', err);

      const status = err?.status || err?.statusCode || err?.response?.status;
      const statusText = err?.statusText || err?.message || '';

      if (status === 403 || status === 401) {
        // 未认证：提示用户设置 Token
        this.els.content.innerHTML = this._renderErrorState(
          '需要登录',
          '请先设置 Token 后查看社区内容',
          `<button class="btn btn-primary btn-sm" id="feed-goto-token">前往设置 Token</button>`
        );
        // 绑定按钮事件
        const tokenBtn = this.els.content.querySelector('#feed-goto-token');
        if (tokenBtn) {
          tokenBtn.addEventListener('click', () => this._openTokenPanel());
        }
      } else {
        // 其他错误：显示具体错误信息并提供重试
        const errorMsg = statusText || '网络异常，请检查网络连接后重试';
        this.els.content.innerHTML = this._renderErrorState(
          '加载失败',
          errorMsg,
          `<button class="btn btn-secondary btn-sm" id="feed-retry-btn">重试</button>`
        );
        // 绑定重试按钮事件
        const retryBtn = this.els.content.querySelector('#feed-retry-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            this.currentPage = 0;
            this.hasMore = true;
            this._loadFeeds();
          });
        }
      }
    } finally {
      this.isLoading = false;
    }
  }

  // ============ 加载更多 ============
  async _loadMore() {
    if (this.isLoadingMore || !this.hasMore) return;
    this.isLoadingMore = true;
    this.els.loadMore.classList.remove('hidden');

    try {
      const nextPage = this.currentPage + 1;
      const data = await API.Story.feeds({
        page_index: nextPage,
        page_size: this.pageSize,
      });

      const items = this._extractItems(data);
      const total = this._extractTotal(data, items.length);

      const hasExplicitTotal = typeof data?.data?.total === 'number'
        || typeof data?.total === 'number'
        || typeof data?.total_count === 'number'
        || typeof data?.data?.total_count === 'number';

      const newStories = items.map(item => this._normalizeStory(item));
      this.stories = [...this.stories, ...newStories];
      this.currentPage = nextPage;

      if (hasExplicitTotal) {
        this.totalPages = Math.max(1, Math.ceil(total / this.pageSize));
      } else {
        this.totalPages = items.length < this.pageSize
          ? this.currentPage
          : this.currentPage + 1;
      }

      this.hasMore = this.currentPage < this.totalPages;

      this.pagination.setTotalPages(this.totalPages);
      this.pagination.setPage(this.currentPage);

      // 追加渲染新卡片
      this._appendCards(newStories);
    } catch (err) {
      console.error('加载更多失败:', err);
      // 加载更多失败时，回退当前页码
      this.hasMore = true;
    } finally {
      this.isLoadingMore = false;
      this.els.loadMore.classList.add('hidden');
    }
  }

  // ============ 标准化作品集数据 ============
  _normalizeStory(item) {
    const creator = item.creator || {};
    const cover = item.coverUrl || item.cover_url || item.thumbnail || item.cover || '';
    const hashtags = item.hashtags || [];

    return {
      uuid: item.storyId || item.uuid || item.id,
      title: item.name || item.title || '未命名作品集',
      cover: cover,
      coverHeight: null,
      description: item.description || item.detail || '',
      authorName: creator.nick_name || creator.nickname || creator.name || '匿名用户',
      authorAvatar: creator.avatar_url || creator.avatar || '',
      authorUuid: creator.uuid || creator.id || '',
      likeCount: item.likeCount || item.like_count || 0,
      favorCount: item.favorCount || item.favor_count || 0,
      viewCount: item.viewCount || item.view_count || 0,
      isLiked: false,
      isFavored: false,
      pictureCount: item.picCount || 0,
      pictures: [],
      videos: [],
      hashtags: hashtags.map(h => typeof h === 'string' ? h : h?.name || '').filter(Boolean),
      shareUrl: item.shareUrl || '',
      aspect: item.aspect || '1:1',
      raw: item,
    };
  }

  // ============ 渲染 Feed ============
  _renderFeed() {
    if (this.stories.length === 0) {
      this.els.content.innerHTML = Components.emptyState(
        `<path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16"/><circle cx="5" cy="19" r="1" fill="currentColor"/>`,
        '暂无社区作品',
        '成为第一个分享作品的人吧'
      );
      return;
    }

    const gridClass = this.layoutMode === 'masonry' ? 'feed-grid-masonry' : 'feed-grid';

    this.els.content.innerHTML = `
      <div class="${gridClass}">
        ${this.stories.map(story => this._renderCard(story)).join('')}
      </div>
    `;

    this._bindCardEvents();
  }

  // ============ 追加新卡片 ============
  _appendCards(newStories) {
    const grid = this.els.content.querySelector('.feed-grid, .feed-grid-masonry');
    if (!grid) return;

    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newStories.map(story => this._renderCard(story)).join('');

    Array.from(tempDiv.children).forEach(child => {
      fragment.appendChild(child);
    });

    grid.appendChild(fragment);
    this._bindCardEvents();
  }

  // ============ 渲染单个卡片 ============
  _renderCard(story) {
    const likeIcon = story.isLiked
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--brand-red)" stroke="var(--brand-red)" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;

    const favorIcon = story.isFavored
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--brand-pink)" stroke="var(--brand-pink)" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    const heightStyle = this.layoutMode === 'masonry' && story.coverHeight
      ? `aspect-ratio: auto; height: ${Math.min(Math.max(story.coverHeight, 200), 400)}px;`
      : '';

    return `
      <div class="feed-card" data-uuid="${story.uuid}">
        <div class="feed-card-cover" style="${heightStyle}">
          ${story.cover
            ? `<img src="${story.cover}" alt="${story.title}" loading="lazy" />`
            : `<div class="feed-card-cover-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                </svg>
              </div>`
          }
          <div class="feed-card-cover-overlay">
            <span class="feed-card-count">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
              ${story.pictureCount} 张
            </span>
          </div>
        </div>
        <div class="feed-card-info">
          <h3 class="feed-card-title">${story.title}</h3>
          <div class="feed-card-author">
            ${story.authorAvatar
              ? `<img class="feed-card-avatar" src="${story.authorAvatar}" alt="${story.authorName}" onerror="this.style.display='none'" />`
              : `<div class="feed-card-avatar feed-card-avatar-placeholder">${(story.authorName || '?')[0]}</div>`
            }
            <span class="feed-card-author-name">${story.authorName}</span>
          </div>
          <div class="feed-card-stats">
            <button class="feed-card-stat feed-card-like ${story.isLiked ? 'feed-card-stat-active' : ''}" data-uuid="${story.uuid}" data-action="like">
              ${likeIcon}
              <span>${this._formatCount(story.likeCount)}</span>
            </button>
            <button class="feed-card-stat feed-card-favor ${story.isFavored ? 'feed-card-stat-active' : ''}" data-uuid="${story.uuid}" data-action="favor">
              ${favorIcon}
              <span>${this._formatCount(story.favorCount)}</span>
            </button>
            <button class="feed-card-stat feed-card-share" data-uuid="${story.uuid}" data-action="share">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              <span>分享</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ============ 格式化计数 ============
  _formatCount(count) {
    if (!count) return '0';
    if (count >= 10000) return (count / 10000).toFixed(1) + 'w';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
    return String(count);
  }

  // ============ 绑定卡片事件 ============
  _bindCardEvents() {
    // 点击卡片进入详情
    this.els.content.querySelectorAll('.feed-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // 如果点击的是操作按钮，不触发详情
        if (e.target.closest('.feed-card-stats')) return;
        const uuid = card.dataset.uuid;
        const story = this.stories.find(s => s.uuid === uuid);
        if (story) this._showStoryDetail(story);
      });
    });

    // 点赞 / 收藏 / 分享
    this.els.content.querySelectorAll('.feed-card-stat').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uuid = btn.dataset.uuid;
        const action = btn.dataset.action;
        const story = this.stories.find(s => s.uuid === uuid);
        if (!story) return;

        switch (action) {
          case 'like':
            this._toggleLike(story, btn);
            break;
          case 'favor':
            this._toggleFavor(story, btn);
            break;
          case 'share':
            this._shareStory(story);
            break;
        }
      });
    });
  }

  // ============ 点赞/取消点赞 ============
  async _toggleLike(story, btn) {
    try {
      if (story.isLiked) {
        await API.Story.unlike(story.uuid);
        story.isLiked = false;
        story.likeCount = Math.max(0, (story.likeCount || 1) - 1);
        Components.Toast.info('已取消点赞');
      } else {
        await API.Story.like(story.uuid);
        story.isLiked = true;
        story.likeCount = (story.likeCount || 0) + 1;
        Components.Toast.success('已点赞');
      }

      // 更新按钮状态
      btn.classList.toggle('feed-card-stat-active', story.isLiked);
      const icon = story.isLiked
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--brand-red)" stroke="var(--brand-red)" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
      btn.innerHTML = `${icon}<span>${this._formatCount(story.likeCount)}</span>`;
    } catch (err) {
      Components.Toast.error('操作失败');
    }
  }

  // ============ 收藏/取消收藏 ============
  async _toggleFavor(story, btn) {
    try {
      await API.Story.favor(story.uuid, story.isFavored);
      story.isFavored = !story.isFavored;
      story.favorCount = story.isFavored
        ? (story.favorCount || 0) + 1
        : Math.max(0, (story.favorCount || 1) - 1);

      Components.Toast.success(story.isFavored ? '已收藏' : '已取消收藏');

      // 更新按钮状态
      btn.classList.toggle('feed-card-stat-active', story.isFavored);
      const icon = story.isFavored
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--brand-pink)" stroke="var(--brand-pink)" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      btn.innerHTML = `${icon}<span>${this._formatCount(story.favorCount)}</span>`;
    } catch (err) {
      Components.Toast.error('操作失败');
    }
  }

  // ============ 分享 ============
  _shareStory(story) {
    const url = `${window.location.origin}/story/${story.uuid}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        Components.Toast.success('链接已复制到剪贴板');
      }).catch(() => {
        this._fallbackCopy(url);
      });
    } else {
      this._fallbackCopy(url);
    }
  }

  _fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      Components.Toast.success('链接已复制到剪贴板');
    } catch {
      Components.Toast.error('复制失败，请手动复制');
    }
    textarea.remove();
  }

  // ============ 作品集详情弹窗 ============
  async _showStoryDetail(story) {
    Components.Toast.info('加载作品集详情...');

    let detailData = null;
    try {
      detailData = await API.Story.getDetail(story.uuid);
    } catch (err) {
      console.error('获取详情失败:', err);
      Components.Toast.error('加载详情失败');
      return;
    }

    const detail = detailData?.data || detailData;
    const pictures = detail?.pictures || detail?.images || story.pictures || [];
    const videos = detail?.videos || story.videos || [];
    const title = detail?.title || story.title;
    const description = detail?.description || detail?.detail || story.description || '';

    // 提取图片 URL
    const imageUrls = pictures.map(p => {
      if (typeof p === 'string') return p;
      return p.image_url || p.url || p.thumbnail || p.src || '';
    }).filter(Boolean);

    // 提取视频 URL
    const videoItems = videos.map(v => {
      if (typeof v === 'string') return { url: v, thumbnail: '' };
      return {
        url: v.video_url || v.url || '',
        thumbnail: v.thumbnail || v.cover_url || '',
      };
    }).filter(v => v.url);

    const allMedia = [
      ...imageUrls.map(url => ({ type: 'image', url })),
      ...videoItems.map(v => ({ type: 'video', url: v.url, thumbnail: v.thumbnail })),
    ];

    // 渲染详情弹窗
    const mediaGridHtml = allMedia.length > 0
      ? `<div class="feed-detail-grid">
          ${allMedia.map((media, idx) => {
            if (media.type === 'video') {
              return `
                <div class="feed-detail-media" data-index="${idx}" data-type="video">
                  <img src="${media.thumbnail || media.url}" alt="视频 ${idx + 1}" loading="lazy" />
                  <div class="feed-detail-play-btn">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="8 5 20 12 8 19"/></svg>
                  </div>
                </div>
              `;
            }
            return `
              <div class="feed-detail-media" data-index="${idx}" data-type="image">
                <img src="${media.url}" alt="图片 ${idx + 1}" loading="lazy" />
              </div>
            `;
          }).join('')}
        </div>`
      : `<div class="empty-state" style="padding:var(--space-2xl)">
          <p>暂无内容</p>
        </div>`;

    const modal = Components.Modal.create({
      title: title,
      content: `
        <div class="feed-detail">
          ${description ? `<p class="feed-detail-desc">${description}</p>` : ''}
          ${mediaGridHtml}
        </div>
      `,
      footer: `
        <button class="btn btn-secondary modal-close-btn-inner">关闭</button>
      `,
      width: '800px',
    });

    // 绑定详情内图片点击预览
    setTimeout(() => {
      const modalEl = modal.el;
      if (!modalEl) return;

      modalEl.querySelector('.modal-close-btn-inner')?.addEventListener('click', () => modal.close());

      modalEl.querySelectorAll('.feed-detail-media').forEach(mediaEl => {
        mediaEl.addEventListener('click', () => {
          const idx = parseInt(mediaEl.dataset.index);
          const media = allMedia[idx];
          if (!media) return;

          if (media.type === 'video') {
            // 视频在弹窗内播放
            this._playVideoInModal(media);
          } else {
            Components.ImageViewer.show(media.url);
          }
        });
      });
    }, 50);
  }

  // ============ 在弹窗内播放视频 ============
  _playVideoInModal(media) {
    Components.Modal.create({
      title: '视频播放',
      content: `
        <div style="display:flex;justify-content:center;background:#000;border-radius:var(--radius-md);overflow:hidden">
          <video
            src="${media.url}"
            controls
            autoplay
            style="max-width:100%;max-height:70vh"
          ></video>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary modal-close-btn-inner">关闭</button>
      `,
      width: '720px',
    });

    setTimeout(() => {
      const modal = document.querySelector('.modal-overlay:last-of-type');
      if (!modal) return;
      const modalEl = modal.querySelector('.modal');
      if (!modalEl) return;

      modalEl.querySelector('.modal-close-btn-inner')?.addEventListener('click', () => {
        modal.classList.remove('open');
        setTimeout(() => modal.remove(), 250);
      });
    }, 50);
  }

  // ============ 销毁 ============
  destroy() {
    if (this._scrollCleanup) {
      this._scrollCleanup();
      this._scrollCleanup = null;
    }
    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
      this._scrollTimer = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.stories = [];
    this.pagination = null;
  }
}
