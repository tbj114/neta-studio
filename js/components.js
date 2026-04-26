/* ============================================
   Nieta Studio - 核心组件（移动端优先设计系统）
   Toast, Modal, 图片预览, 搜索, 角色选择器等
   ============================================ */

const Components = (() => {

  // ============ Toast 系统 ============
  const Toast = (() => {
    let container = null;
    function getContainer() {
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
      }
      return container;
    }

    function show(message, type = 'info', duration = 3000) {
      const c = getContainer();
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      const icons = {
        success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
        error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF5757" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
        info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00A3FF" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
      };
      toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
      c.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 250);
      }, duration);
    }

    return { show, success: (m, d) => show(m, 'success', d), error: (m, d) => show(m, 'error', d), info: (m, d) => show(m, 'info', d) };
  })();

  // ============ Modal 系统 ============
  const Modal = (() => {
    function create({ title, content, footer, width, onClose }) {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="${width ? 'width:' + width : ''}">
          <div class="modal-header">
            <h3>${title || ''}</h3>
            <button class="btn btn-icon btn-ghost modal-close-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="modal-body">${content || ''}</div>
          ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        </div>
      `;

      function close() {
        overlay.classList.remove('open');
        setTimeout(() => { overlay.remove(); onClose && onClose(); }, 250);
      }

      overlay.querySelector('.modal-close-btn').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));
      return { close, overlay, el: overlay.querySelector('.modal') };
    }

    function confirm({ title, message, confirmText = '确认', cancelText = '取消', type = 'danger' }) {
      return new Promise((resolve) => {
        const modal = create({
          title,
          content: `<p style="color:var(--text-secondary);font-size:var(--text-base)">${message}</p>`,
          footer: `
            <button class="btn btn-secondary modal-cancel">${cancelText}</button>
            <button class="btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'} modal-confirm">${confirmText}</button>
          `,
          onClose: () => resolve(false),
        });
        modal.el.querySelector('.modal-cancel').addEventListener('click', () => { modal.close(); resolve(false); });
        modal.el.querySelector('.modal-confirm').addEventListener('click', () => { modal.close(); resolve(true); });
      });
    }

    return { create, confirm };
  })();

  // ============ 图片预览 / Lightbox ============
  const ImageViewer = (() => {
    let _instance = null;

    class Lightbox {
      constructor({ images = [], startIndex = 0 }) {
        this.images = Array.isArray(images) ? images : [images];
        this.currentIndex = startIndex;
        this.overlay = null;
        this.imgEl = null;
        this.counterEl = null;
        this._touchStartX = 0;
        this._touchStartY = 0;
        this._touchDeltaX = 0;
        this._isSwiping = false;
        this._isDragging = false;
        this._scale = 1;
        this._translateX = 0;
        this._translateY = 0;
        this._pinchStartDist = 0;
        this._pinchStartScale = 1;
      }

      show() {
        // 如果已有实例，先关闭
        if (_instance) {
          _instance.close();
        }
        _instance = this;

        this.overlay = document.createElement('div');
        this.overlay.className = 'lightbox-overlay';

        const hasMultiple = this.images.length > 1;

        this.overlay.innerHTML = `
          <div class="lightbox-header">
            ${hasMultiple ? `<span class="lightbox-counter"></span>` : ''}
            <button class="btn btn-icon btn-ghost lightbox-close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="lightbox-body">
            <div class="lightbox-img-wrap">
              <img class="lightbox-img" src="${this.images[this.currentIndex]}" alt="" draggable="false" />
            </div>
            ${hasMultiple ? `
              <button class="btn btn-icon btn-ghost lightbox-nav lightbox-prev">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button class="btn btn-icon btn-ghost lightbox-nav lightbox-next">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ` : ''}
          </div>
          <div class="lightbox-footer">
            <button class="btn btn-sm btn-secondary lightbox-download">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              保存图片
            </button>
          </div>
        `;

        this.imgEl = this.overlay.querySelector('.lightbox-img');
        this.counterEl = this.overlay.querySelector('.lightbox-counter');

        if (hasMultiple) {
          this._updateCounter();
        }

        // 绑定事件
        this._bindEvents();

        document.body.appendChild(this.overlay);
        // 阻止背景滚动
        document.body.style.overflow = 'hidden';

        // 触发入场动画
        requestAnimationFrame(() => {
          this.overlay.classList.add('open');
        });
      }

      _bindEvents() {
        // 关闭按钮
        this.overlay.querySelector('.lightbox-close').addEventListener('click', () => this.close());

        // 点击背景关闭
        this.overlay.addEventListener('click', (e) => {
          if (e.target === this.overlay || e.target.classList.contains('lightbox-body')) {
            this.close();
          }
        });

        // 下载按钮
        this.overlay.querySelector('.lightbox-download').addEventListener('click', () => {
          const a = document.createElement('a');
          a.href = this.images[this.currentIndex];
          a.download = '';
          a.target = '_blank';
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
        });

        // 前后导航
        const prevBtn = this.overlay.querySelector('.lightbox-prev');
        const nextBtn = this.overlay.querySelector('.lightbox-next');
        if (prevBtn) prevBtn.addEventListener('click', () => this.prev());
        if (nextBtn) nextBtn.addEventListener('click', () => this.next());

        // 键盘导航
        this._onKeydown = (e) => {
          if (e.key === 'Escape') this.close();
          if (e.key === 'ArrowLeft') this.prev();
          if (e.key === 'ArrowRight') this.next();
        };
        document.addEventListener('keydown', this._onKeydown);

        // 触摸手势：滑动切换 + 双指缩放
        this.imgEl.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        this.imgEl.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        this.imgEl.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });

        // 鼠标滚轮缩放（桌面端）
        this.imgEl.addEventListener('wheel', (e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.15 : 0.15;
          this._scale = Math.max(0.5, Math.min(5, this._scale + delta));
          this._applyTransform();
        }, { passive: false });

        // 双击还原/放大
        let lastTap = 0;
        this.imgEl.addEventListener('touchend', (e) => {
          const now = Date.now();
          if (now - lastTap < 300) {
            e.preventDefault();
            if (this._scale > 1) {
              this._scale = 1;
              this._translateX = 0;
              this._translateY = 0;
            } else {
              this._scale = 2.5;
            }
            this._applyTransform();
          }
          lastTap = now;
        });
      }

      _onTouchStart(e) {
        if (e.touches.length === 1) {
          this._touchStartX = e.touches[0].clientX;
          this._touchStartY = e.touches[0].clientY;
          this._touchDeltaX = 0;
          this._isSwiping = false;
          this._isDragging = this._scale > 1;
        } else if (e.touches.length === 2) {
          // 双指缩放
          this._pinchStartDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          this._pinchStartScale = this._scale;
        }
      }

      _onTouchMove(e) {
        if (e.touches.length === 1) {
          const dx = e.touches[0].clientX - this._touchStartX;
          const dy = e.touches[0].clientY - this._touchStartY;

          if (this._isDragging) {
            // 缩放状态下拖拽图片
            e.preventDefault();
            this._translateX += dx;
            this._translateY += dy;
            this._touchStartX = e.touches[0].clientX;
            this._touchStartY = e.touches[0].clientY;
            this._applyTransform();
          } else if (!this._isSwiping && Math.abs(dx) > 10) {
            this._isSwiping = true;
          }

          if (this._isSwiping && this._scale <= 1) {
            e.preventDefault();
            this._touchDeltaX = dx;
            this.imgEl.style.transition = 'none';
            this.imgEl.style.transform = `translateX(${dx}px) scale(${this._scale})`;
          }
        } else if (e.touches.length === 2) {
          e.preventDefault();
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          this._scale = Math.max(0.5, Math.min(5, this._pinchStartScale * (dist / this._pinchStartDist)));
          this._applyTransform();
        }
      }

      _onTouchEnd(e) {
        if (this._isSwiping && this._scale <= 1) {
          const threshold = window.innerWidth * 0.25;
          this.imgEl.style.transition = 'transform 0.3s ease';
          if (this._touchDeltaX < -threshold && this.currentIndex < this.images.length - 1) {
            this.next();
          } else if (this._touchDeltaX > threshold && this.currentIndex > 0) {
            this.prev();
          } else {
            this.imgEl.style.transform = `translateX(0) scale(${this._scale})`;
          }
          this._isSwiping = false;
          this._touchDeltaX = 0;
        }
      }

      _applyTransform() {
        this.imgEl.style.transition = 'transform 0.15s ease';
        this.imgEl.style.transform = `translate(${this._translateX}px, ${this._translateY}px) scale(${this._scale})`;
      }

      _updateCounter() {
        if (this.counterEl) {
          this.counterEl.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
        }
      }

      _navigateTo(index) {
        if (index < 0 || index >= this.images.length) return;
        this.currentIndex = index;
        this._scale = 1;
        this._translateX = 0;
        this._translateY = 0;

        // 切换动画
        this.imgEl.style.transition = 'opacity 0.15s ease, transform 0.3s ease';
        this.imgEl.style.opacity = '0';
        this.imgEl.style.transform = 'scale(0.95)';

        setTimeout(() => {
          this.imgEl.src = this.images[this.currentIndex];
          this.imgEl.onload = () => {
            this.imgEl.style.opacity = '1';
            this.imgEl.style.transform = 'scale(1)';
          };
          // 如果图片已缓存，onload 可能不触发
          if (this.imgEl.complete) {
            this.imgEl.style.opacity = '1';
            this.imgEl.style.transform = 'scale(1)';
          }
        }, 150);

        this._updateCounter();
      }

      prev() {
        this._navigateTo(this.currentIndex - 1);
      }

      next() {
        this._navigateTo(this.currentIndex + 1);
      }

      close() {
        if (!this.overlay) return;
        this.overlay.classList.remove('open');
        document.removeEventListener('keydown', this._onKeydown);
        document.body.style.overflow = '';

        setTimeout(() => {
          if (this.overlay && this.overlay.parentNode) {
            this.overlay.remove();
          }
          if (_instance === this) {
            _instance = null;
          }
        }, 300);
      }
    }

    // 便捷方法：显示单张图片
    function show(src) {
      new Lightbox({ images: [src] }).show();
    }

    // 显示图片画廊（支持滑动切换）
    function showGallery(images, startIndex = 0) {
      new Lightbox({ images, startIndex }).show();
    }

    return { show, showGallery, Lightbox };
  })();

  // ============ 搜索组件（模糊搜索） ============
  class SearchComponent {
    constructor({ placeholder = '搜索...', onSearch, onSelect, renderItem, minLength = 1, debounceMs = 300 }) {
      this.placeholder = placeholder;
      this.onSearch = onSearch;
      this.onSelect = onSelect;
      this.renderItem = renderItem;
      this.minLength = minLength;
      this.debounceMs = debounceMs;
      this._timer = null;
      this._isOpen = false;
      this.el = null;
      this._dropdown = null;
      this._input = null;
    }

    render() {
      this.el = document.createElement('div');
      this.el.className = 'search-box';
      this.el.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input type="text" placeholder="${this.placeholder}" autocomplete="off" />
        <div class="search-dropdown"></div>
      `;
      this._input = this.el.querySelector('input');
      this._dropdown = this.el.querySelector('.search-dropdown');

      this._input.addEventListener('input', () => {
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this._handleInput(), this.debounceMs);
      });

      this._input.addEventListener('focus', () => {
        if (this._dropdown.children.length > 0) this._showDropdown();
      });

      document.addEventListener('click', (e) => {
        if (this.el && !this.el.contains(e.target)) this._hideDropdown();
      });

      return this.el;
    }

    async _handleInput() {
      const q = this._input.value.trim();
      if (q.length < this.minLength) { this._hideDropdown(); return; }
      try {
        const results = await this.onSearch(q);
        this._renderResults(results);
      } catch (err) {
        console.error('Search error:', err);
      }
    }

    _renderResults(results) {
      if (!results || results.length === 0) {
        this._dropdown.innerHTML = '<div class="search-dropdown-empty">未找到结果</div>';
        this._showDropdown();
        return;
      }
      this._dropdown.innerHTML = results.map((item, i) => {
        const content = this.renderItem ? this.renderItem(item) : `
          <div class="search-dropdown-item-info">
            <div class="search-dropdown-item-name">${item.name || item.title || '未知'}</div>
            ${item.description ? `<div class="search-dropdown-item-desc">${item.description}</div>` : ''}
          </div>
        `;
        return `<div class="search-dropdown-item" data-index="${i}">${content}</div>`;
      }).join('');

      this._dropdown.querySelectorAll('.search-dropdown-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          this.onSelect && this.onSelect(results[i]);
          this._input.value = results[i].name || results[i].title || '';
          this._hideDropdown();
        });
      });
      this._showDropdown();
    }

    _showDropdown() { this._dropdown.classList.add('visible'); this._isOpen = true; }
    _hideDropdown() { this._dropdown.classList.remove('visible'); this._isOpen = false; }

    getValue() { return this._input ? this._input.value.trim() : ''; }
    setValue(v) { if (this._input) this._input.value = v; }
    clear() { if (this._input) this._input.value = ''; this._hideDropdown(); }
    focus() { if (this._input) this._input.focus(); }
  }

  // ============ 角色选择器 ============
  class CharacterSelector {
    constructor({ onAdd, onRemove }) {
      this.onAdd = onAdd;
      this.onRemove = onRemove;
      this.selected = [];
      this.el = null;
      this._search = null;
    }

    render() {
      this.el = document.createElement('div');
      this.el.className = 'character-selector';
      this.el.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="form-label">角色</span>
          <div class="selected-chips flex gap-xs flex-wrap" style="max-width:300px"></div>
        </div>
        <div class="search-container"></div>
      `;

      this._chipsContainer = this.el.querySelector('.selected-chips');
      this._searchContainer = this.el.querySelector('.search-container');

      this._search = new SearchComponent({
        placeholder: '搜索角色...',
        onSearch: async (q) => {
          const data = await API.Character.typeahead(q);
          return (data && data.data) ? data.data.slice(0, 10) : [];
        },
        onSelect: (item) => this._addCharacter(item),
        renderItem: (item) => `
          <img src="${item.avatar || item.thumbnail || ''}" alt="" onerror="this.style.display='none'" />
          <div class="search-dropdown-item-info">
            <div class="search-dropdown-item-name">${item.name || item.title}</div>
            <div class="search-dropdown-item-desc">${item.description || item.style || ''}</div>
          </div>
        `,
      });
      this._searchContainer.appendChild(this._search.render());

      return this.el;
    }

    _addCharacter(item) {
      if (this.selected.find(c => (c.uuid || c.id) === (item.uuid || item.id))) {
        Toast.info('该角色已选择');
        return;
      }
      this.selected.push(item);
      this._renderChips();
      this.onAdd && this.onAdd(item);
    }

    _removeCharacter(item) {
      this.selected = this.selected.filter(c => (c.uuid || c.id) !== (item.uuid || item.id));
      this._renderChips();
      this.onRemove && this.onRemove(item);
    }

    _renderChips() {
      this._chipsContainer.innerHTML = this.selected.map(item => `
        <span class="tag tag-removable" data-id="${item.uuid || item.id}">
          ${item.name || item.title}
        </span>
      `).join('');
      this._chipsContainer.querySelectorAll('.tag-removable').forEach(el => {
        el.addEventListener('click', () => {
          const item = this.selected.find(c => (c.uuid || c.id) === el.dataset.id);
          if (item) this._removeCharacter(item);
        });
      });
    }

    getSelected() { return this.selected; }
    setSelected(items) { this.selected = items; this._renderChips(); }
    clear() { this.selected = []; this._renderChips(); }
  }

  // ============ 元素选择器（风格/姿势/场景等） ============
  class ElementSelector {
    constructor({ type = 'style', onAdd, onRemove, placeholder }) {
      this.type = type;
      this.onAdd = onAdd;
      this.onRemove = onRemove;
      this.selected = [];
      this.placeholder = placeholder || `搜索${type === 'style' ? '风格' : type === 'pose' ? '姿势' : type === 'scene' ? '场景' : '元素'}...`;
      this.el = null;
    }

    render() {
      this.el = document.createElement('div');
      this.el.className = 'character-selector';
      this.el.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="form-label">${this.type === 'style' ? '风格' : this.type === 'pose' ? '姿势' : this.type === 'scene' ? '场景' : '元素'}</span>
          <div class="selected-chips flex gap-xs flex-wrap" style="max-width:300px"></div>
        </div>
        <div class="search-container"></div>
      `;

      this._chipsContainer = this.el.querySelector('.selected-chips');
      this._searchContainer = this.el.querySelector('.search-container');

      this._search = new SearchComponent({
        placeholder: this.placeholder,
        onSearch: async (q) => {
          const data = await API.Elementum.typeahead(q, this.type);
          return (data && data.data) ? data.data.slice(0, 10) : [];
        },
        onSelect: (item) => this._addElement(item),
        renderItem: (item) => `
          <div class="search-dropdown-item-info">
            <div class="search-dropdown-item-name">${item.name || item.title}</div>
            <div class="search-dropdown-item-desc">${item.description || ''}</div>
          </div>
        `,
      });
      this._searchContainer.appendChild(this._search.render());
      return this.el;
    }

    _addElement(item) {
      if (this.selected.find(e => (e.uuid || e.id) === (item.uuid || item.id))) {
        Toast.info('已选择');
        return;
      }
      this.selected.push(item);
      this._renderChips();
      this.onAdd && this.onAdd(item);
    }

    _removeElement(item) {
      this.selected = this.selected.filter(e => (e.uuid || e.id) !== (item.uuid || item.id));
      this._renderChips();
      this.onRemove && this.onRemove(item);
    }

    _renderChips() {
      const tagClass = this.type === 'style' ? 'prompt-tag-style' : 'prompt-tag-element';
      this._chipsContainer.innerHTML = this.selected.map(item => `
        <span class="tag tag-removable ${tagClass}" data-id="${item.uuid || item.id}">
          ${item.name || item.title}
        </span>
      `).join('');
      this._chipsContainer.querySelectorAll('.tag-removable').forEach(el => {
        el.addEventListener('click', () => {
          const item = this.selected.find(e => (e.uuid || e.id) === el.dataset.id);
          if (item) this._removeElement(item);
        });
      });
    }

    getSelected() { return this.selected; }
    setSelected(items) { this.selected = items; this._renderChips(); }
    clear() { this.selected = []; this._renderChips(); }
  }

  // ============ 分页组件 ============
  class Pagination {
    constructor({ currentPage = 1, totalPages = 1, onPageChange }) {
      this.currentPage = currentPage;
      this.totalPages = totalPages;
      this.onPageChange = onPageChange;
      this.el = null;
    }

    render() {
      this.el = document.createElement('div');
      this.el.className = 'pagination';
      this._update();
      return this.el;
    }

    _update() {
      const p = this.currentPage, t = this.totalPages;
      let html = `<button class="pagination-btn" data-page="prev" ${p <= 1 ? 'disabled' : ''}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>`;

      const range = [];
      range.push(1);
      if (p > 3) range.push('...');
      for (let i = Math.max(2, p - 1); i <= Math.min(t - 1, p + 1); i++) range.push(i);
      if (p < t - 2) range.push('...');
      if (t > 1) range.push(t);

      range.forEach(v => {
        if (v === '...') {
          html += `<span class="pagination-btn" style="cursor:default;opacity:0.5">...</span>`;
        } else {
          html += `<button class="pagination-btn ${v === p ? 'active' : ''}" data-page="${v}">${v}</button>`;
        }
      });

      html += `<button class="pagination-btn" data-page="next" ${p >= t ? 'disabled' : ''}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>`;

      this.el.innerHTML = html;
      this.el.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          const v = btn.dataset.page;
          let np = this.currentPage;
          if (v === 'prev') np--;
          else if (v === 'next') np++;
          else np = parseInt(v);
          if (np >= 1 && np <= this.totalPages && np !== this.currentPage) {
            this.currentPage = np;
            this._update();
            this.onPageChange && this.onPageChange(np);
          }
        });
      });
    }

    setPage(p) { this.currentPage = p; this._update(); }
    setTotalPages(t) { this.totalPages = Math.max(1, t); this._update(); }
  }

  // ============ 空状态 ============
  function emptyState(icon, title, desc) {
    return `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${icon}</svg>
      <h4>${title}</h4>
      <p>${desc || ''}</p>
    </div>`;
  }

  // ============ 加载状态 ============
  function loadingState(text = '加载中...') {
    return `<div class="loading-overlay"><div class="spinner spinner-lg"></div><span class="loading-text">${text}</span></div>`;
  }

  // ============ SVG 图标 ============
  const Icons = {
    generate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
    works: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    feed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16"/><circle cx="5" cy="19" r="1" fill="currentColor"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
    image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
    video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
    star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    starFill: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    empty: `<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>`,
    token: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
    AP: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
  };

  return {
    Toast, Modal, SearchComponent, CharacterSelector, ElementSelector,
    ImageViewer, Pagination, emptyState, loadingState, Icons,
  };
})();
