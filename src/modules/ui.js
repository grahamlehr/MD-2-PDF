/* --- UI Controller Module --- */
import { documentManager } from './documentManager.js';
import { markdownParser } from './markdownParser.js';
import { previewRenderer } from './previewRenderer.js';
import { MarkdownEditor } from './editor.js';

const UI_THEME_KEY = 'sg-theme';

class UIController {
  constructor() {
    this.editor = null;
    this.saveTimeout = null;
    this.isDraggingGutter = false;

    // DOM Cache
    this.leftSidebar = document.getElementById('left-sidebar');
    this.rightSidebar = document.getElementById('right-sidebar');
    this.workspaceBody = document.getElementById('workspace-body');
    
    this.btnToggleLeft = document.getElementById('toggle-left-sidebar');
    this.btnToggleRight = document.getElementById('toggle-right-sidebar');
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    
    this.activeDocTitle = document.getElementById('active-doc-title');
    this.saveStatus = document.getElementById('save-status');
    this.layoutControl = document.getElementById('layout-control');
    this.printBtn = document.getElementById('print-btn');
    
    this.docSearch = document.getElementById('doc-search');
    this.docList = document.getElementById('doc-list');
    this.newDocBtn = document.getElementById('new-doc-btn');
    this.importBtn = document.getElementById('import-btn');
    this.fileImportInput = document.getElementById('file-import-input');
    this.exportMdBtn = document.getElementById('export-md-btn');
    this.outlineList = document.getElementById('outline-list');
    
    this.themeSelector = document.getElementById('theme-selector');
    this.textSizeSelector = document.getElementById('text-size-control');
    this.customScaleWrapper = document.getElementById('custom-scale-wrapper');
    this.customTextScaleInput = document.getElementById('custom-text-scale');
    this.pageSizeSelect = document.getElementById('page-size');
    this.pageMarginsSelect = document.getElementById('page-margins');
    this.togglePageNumbers = document.getElementById('toggle-page-numbers');
    this.tableBordersSelect = document.getElementById('table-borders');
    this.tablePaddingSelect = document.getElementById('table-padding');
    this.tableStripesToggle = document.getElementById('table-stripes');
    this.pdfHeaderText = document.getElementById('pdf-header-text');
    this.pdfFooterText = document.getElementById('pdf-footer-text');
    this.customCssEditor = document.getElementById('custom-css-editor');
    this.resetCssBtn = document.getElementById('reset-css-btn');
    
    this.splitGutter = document.getElementById('split-gutter');
    this.editorPane = document.getElementById('editor-pane');
    this.previewPane = document.getElementById('preview-pane');

    this.wordCounter = document.getElementById('word-counter');
    this.removeNewlinesBtn = document.getElementById('remove-newlines-btn');
  }

  init() {
    // 0. Initialize Signal Light/Dark UI Theme
    this.initUITheme();

    // 1. Initialize Editor
    this.editor = new MarkdownEditor(document.getElementById('editor-container'), {
      onChange: (content) => this.handleContentChange(content),
      onSave: () => this.triggerImmediateSave(),
      onSelectionChange: (selectionInfo) => this.handleSelectionChange(selectionInfo)
    });

    // 2. Load Active Document
    this.loadActiveDocument();

    // 3. Bind Event Listeners
    this.bindSidebarEvents();
    this.bindHeaderEvents();
    this.bindDocumentListEvents();
    this.bindSettingsEvents();
    this.bindSplitPaneEvents();
    this.bindPreviewTabs();
    this.bindZoomEvents();

    // 4. Initial Render
    this.renderDocumentList();
    this.updatePreview();
  }

  // --- Signal UI Theme (Light warm paper default / Dark ink toggle) ---
  initUITheme() {
    const savedTheme = localStorage.getItem(UI_THEME_KEY) || 'light';
    this.applyUITheme(savedTheme);
  }

  applyUITheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(UI_THEME_KEY, theme);

    if (this.themeToggleBtn) {
      const moonIcon = this.themeToggleBtn.querySelector('.icon-moon');
      const sunIcon = this.themeToggleBtn.querySelector('.icon-sun');
      if (moonIcon && sunIcon) {
        moonIcon.style.display = theme === 'dark' ? 'none' : 'block';
        sunIcon.style.display = theme === 'dark' ? 'block' : 'none';
      }
      this.themeToggleBtn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
  }

  // --- Document Loading ---
  loadActiveDocument() {
    const doc = documentManager.getActive();
    if (!doc) return;

    // Set title and content in UI
    this.activeDocTitle.value = doc.title;
    this.editor.setContent(doc.content);

    // Cancel the autosave timer triggered by programmatic setContent
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.saveStatus.textContent = 'Saved';
    this.saveStatus.classList.remove('saving');

    // Pre-parse markdown so initial preview and outline render immediately
    doc.rendered = markdownParser.render(doc.content || '');
    this.renderOutline(doc.rendered.headings);

    // Update browser tab/window title
    document.title = `${doc.title} — MD-2-PDF`;

    // Update settings panels
    this.updateSettingsPanel(doc);
    
    // Refresh word counter
    this.updateWordCount();
  }

  updateSettingsPanel(doc) {
    // Active template
    const activeTheme = doc.template || 'signal';
    const cards = this.themeSelector.querySelectorAll('.theme-card');
    cards.forEach(card => {
      if (card.dataset.theme === activeTheme) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Active text size
    const sizeBtns = this.textSizeSelector.querySelectorAll('.segmented-btn');
    const activeSize = doc.textSize || 'medium';
    sizeBtns.forEach(btn => {
      if (btn.dataset.size === activeSize) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Custom text scale input visibility & value
    if (activeSize === 'custom') {
      this.customScaleWrapper.style.display = 'flex';
      this.customTextScaleInput.value = doc.customTextScale || 1.0;
    } else {
      this.customScaleWrapper.style.display = 'none';
    }

    // Setup select boxes
    this.pageSizeSelect.value = doc.pageSize || 'A4';
    this.pageMarginsSelect.value = doc.margins || 'normal';
    this.togglePageNumbers.checked = doc.showPageNumbers !== false;
    this.tableBordersSelect.value = doc.tableBorders || 'charcoal-0.5';
    this.tablePaddingSelect.value = doc.tablePadding || 'normal';
    this.tableStripesToggle.checked = doc.tableStripes !== false;
    this.pdfHeaderText.value = doc.headerText || '';
    this.pdfFooterText.value = doc.footerText || '';
    this.customCssEditor.value = doc.customCss || '';

    // Page orientation radio
    const orientation = doc.orientation || 'portrait';
    const radios = document.getElementsByName('page-orientation');
    radios.forEach(radio => {
      radio.checked = radio.value === orientation;
    });
  }

  // --- Change Handlers & Autosave ---
  handleContentChange(content) {
    this.saveStatus.textContent = 'Saving';
    this.saveStatus.classList.add('saving');
    
    this.updateWordCount();

    if (this.saveTimeout) clearTimeout(this.saveTimeout);

    // Autosave after 600ms
    this.saveTimeout = setTimeout(() => {
      this.triggerImmediateSave();
    }, 600);
  }

  triggerImmediateSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    const content = this.editor.getContent();
    const doc = documentManager.getActive();
    if (!doc) return;

    // Parse Markdown to check if YAML Frontmatter overrides layout settings
    const parseResult = markdownParser.render(content);

    // Cache parsing result in memory object to avoid double parsing in renderer
    doc.rendered = parseResult;

    // Save fields
    const fields = {
      content,
      // If Frontmatter title exists, use it to sync UI, otherwise keep active title
      title: parseResult.metadata.title || this.activeDocTitle.value.trim() || 'Untitled document'
    };

    // Keep UI title sync'd with parsed frontmatter title if user typed it
    if (parseResult.metadata.title && this.activeDocTitle.value !== parseResult.metadata.title) {
      this.activeDocTitle.value = parseResult.metadata.title;
    }

    documentManager.updateActive(fields);
    
    // Update Outline TOC sidebar
    this.renderOutline(parseResult.headings);

    // Update preview pane
    this.updatePreview();

    // Visual feedback
    this.saveStatus.textContent = 'Saved';
    this.saveStatus.classList.remove('saving');

    // Update document title list item (in case it renamed)
    this.renderDocumentList();
  }

  updatePreview() {
    const doc = documentManager.getActive();
    if (doc) {
      previewRenderer.update(doc);
    }
  }

  updateWordCount() {
    const words = this.editor.getWordCount();
    this.wordCounter.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
  }

  handleSelectionChange(selectionInfo) {
    if (!this.removeNewlinesBtn) return;
    
    if (selectionInfo.hasSelection && selectionInfo.lineCount >= 2) {
      this.removeNewlinesBtn.style.display = 'inline-flex';
    } else {
      this.removeNewlinesBtn.style.display = 'none';
    }
  }

  handleRemoveNewlines() {
    const selectionInfo = this.editor.getSelectionInfo();
    if (!selectionInfo.hasSelection || selectionInfo.lineCount < 2) return;
    
    const text = selectionInfo.text;
    const cleanLines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    const joinedText = cleanLines.join(' ');
    
    this.editor.replaceSelection(joinedText);
    this.triggerImmediateSave();
    this.editor.focus();
  }

  // --- Sidebar Events ---
  bindSidebarEvents() {
    // Toggle sidebars
    this.btnToggleLeft.addEventListener('click', () => {
      this.leftSidebar.classList.toggle('collapsed');
      this.btnToggleLeft.classList.toggle('active');
      // Recalculate zoom after transition ends
      setTimeout(() => previewRenderer.updateZoom(), 300);
    });

    this.btnToggleRight.addEventListener('click', () => {
      this.rightSidebar.classList.toggle('collapsed');
      this.btnToggleRight.classList.toggle('active');
      // Recalculate zoom after transition ends
      setTimeout(() => previewRenderer.updateZoom(), 300);
    });

    // Sidebar panel switcher tabs
    const tabs = document.querySelectorAll('.sidebar-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabName = tab.dataset.tab;
        const panels = document.querySelectorAll('.sidebar-panel');
        panels.forEach(p => p.classList.remove('active'));
        
        document.getElementById(`panel-${tabName}`).classList.add('active');
      });
    });

    // Search input
    this.docSearch.addEventListener('input', (e) => {
      this.renderDocumentList(e.target.value);
    });
  }

  // --- Header/Toolbar Events ---
  bindHeaderEvents() {
    // UI Theme Toggle (Light / Dark)
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => {
        const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        this.applyUITheme(next);
        if (previewRenderer.activeMode === 'draft') {
          previewRenderer.renderDraft();
        }
      });
    }

    // Document Title Rename
    this.activeDocTitle.addEventListener('input', (e) => {
      const newTitle = e.target.value.trim() || 'Untitled document';
      documentManager.updateActive({ title: newTitle });
      
      // Update browser tab/window title on rename
      document.title = `${newTitle} — MD-2-PDF`;
      
      // debounced update document item label
      this.renderDocumentList();
    });

    // View layout split controls
    const layoutBtns = this.layoutControl.querySelectorAll('.segmented-btn');
    layoutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        layoutBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const layout = btn.dataset.layout;
        this.workspaceBody.className = 'workspace-body'; // clear
        
        if (layout === 'edit') {
          this.workspaceBody.classList.add('edit-only');
        } else if (layout === 'preview') {
          this.workspaceBody.classList.add('preview-only');
        } else {
          this.workspaceBody.classList.add('split-layout');
        }

        // Recalculate zoom after layout transitions
        setTimeout(() => previewRenderer.updateZoom(), 100);
      });
    });

    // Print triggers
    this.printBtn.addEventListener('click', () => {
      previewRenderer.print();
    });

    // Remove newlines action
    if (this.removeNewlinesBtn) {
      this.removeNewlinesBtn.addEventListener('click', () => {
        this.handleRemoveNewlines();
      });
    }
  }

  // --- Document Manager list CRUD ---
  bindDocumentListEvents() {
    // Create new
    this.newDocBtn.addEventListener('click', () => {
      documentManager.createDocument('Untitled document', '# Untitled document.\n\nWrite your markdown here.');
      this.loadActiveDocument();
      this.renderDocumentList();
      this.triggerImmediateSave();
      this.editor.focus();
    });

    // Import markdown
    this.importBtn.addEventListener('click', () => {
      this.fileImportInput.click();
    });

    this.fileImportInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target.result;
        const title = file.name.replace(/\.md$/i, '');
        
        documentManager.createDocument(title, content);
        this.loadActiveDocument();
        this.renderDocumentList();
        this.triggerImmediateSave();
        this.fileImportInput.value = ''; // clear input
      };
      reader.readAsText(file);
    });

    // Export markdown
    this.exportMdBtn.addEventListener('click', () => {
      const doc = documentManager.getActive();
      if (!doc) return;

      const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${doc.title}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  formatISODate(timestamp) {
    const d = new Date(timestamp);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} · ${hh}:${min}`;
  }

  renderDocumentList(query = '') {
    const docs = documentManager.search(query);
    const active = documentManager.getActive();

    this.docList.innerHTML = '';

    if (docs.length === 0) {
      this.docList.innerHTML = '<li class="empty-state">No documents found.</li>';
      return;
    }

    docs.forEach((doc, idx) => {
      const li = document.createElement('li');
      li.className = `doc-item ${active && active.id === doc.id ? 'active' : ''}`;
      
      const indexStr = String(idx + 1).padStart(2, '0');
      const dateString = this.formatISODate(doc.lastModified);

      li.innerHTML = `
        <span class="doc-item-index">${indexStr}</span>
        <div class="doc-item-info">
          <span class="doc-item-title">${doc.title}</span>
          <span class="doc-item-meta">${dateString}</span>
        </div>
        <div class="doc-item-actions">
          <button class="doc-action-btn delete" title="Delete document" aria-label="Delete document" data-id="${doc.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14H5V6m3 0V4h8v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      `;

      // Click event to switch active document
      li.addEventListener('click', (e) => {
        // Prevent trigger switch when clicking delete action
        if (e.target.closest('.delete')) return;
        
        documentManager.setActive(doc.id);
        this.loadActiveDocument();
        this.renderDocumentList();
        this.triggerImmediateSave();
      });

      // Delete action listener
      const deleteBtn = li.querySelector('.delete');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.confirmDelete(doc.id, doc.title);
      });

      this.docList.appendChild(li);
    });
  }

  confirmDelete(id, title) {
    const confirmed = confirm(`Delete "${title}"? This action cannot be undone.`);
    if (confirmed) {
      documentManager.deleteDocument(id);
      this.loadActiveDocument();
      this.renderDocumentList();
      this.triggerImmediateSave();
    }
  }

  // --- Document Outline Render ---
  renderOutline(headings) {
    this.outlineList.innerHTML = '';
    
    if (!headings || headings.length === 0) {
      this.outlineList.innerHTML = '<p class="empty-state">No headers in document.</p>';
      return;
    }

    headings.forEach(heading => {
      const a = document.createElement('a');
      a.className = `outline-item h${heading.level}`;
      a.textContent = heading.text;
      a.href = `#${heading.id}`;

      // Click to scroll both editor & preview to heading
      a.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Scroll in preview
        const targetEl = document.getElementById(heading.id);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      this.outlineList.appendChild(a);
    });
  }

  // --- Settings Panel controls ---
  bindSettingsEvents() {
    // Theme select cards
    const themeCards = this.themeSelector.querySelectorAll('.theme-card');
    themeCards.forEach(card => {
      card.addEventListener('click', () => {
        themeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const theme = card.dataset.theme;
        documentManager.updateActive({ template: theme });
        this.triggerImmediateSave();
      });
    });

    // Text size select
    const sizeBtns = this.textSizeSelector.querySelectorAll('.segmented-btn');
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const size = btn.dataset.size;
        if (size === 'custom') {
          this.customScaleWrapper.style.display = 'flex';
          const customVal = parseFloat(this.customTextScaleInput.value) || 1.0;
          documentManager.updateActive({ textSize: size, customTextScale: customVal });
        } else {
          this.customScaleWrapper.style.display = 'none';
          documentManager.updateActive({ textSize: size });
        }
        this.triggerImmediateSave();
      });
    });

    // Custom text scale input
    this.customTextScaleInput.addEventListener('change', (e) => {
      let val = parseFloat(e.target.value);
      if (isNaN(val)) val = 1.0;
      val = Math.max(0.3, Math.min(3.0, val));
      e.target.value = val;
      
      documentManager.updateActive({ customTextScale: val });
      this.triggerImmediateSave();
    });

    // Page setup select dropdowns
    this.pageSizeSelect.addEventListener('change', (e) => {
      documentManager.updateActive({ pageSize: e.target.value });
      this.triggerImmediateSave();
    });

    this.pageMarginsSelect.addEventListener('change', (e) => {
      documentManager.updateActive({ margins: e.target.value });
      this.triggerImmediateSave();
    });

    this.togglePageNumbers.addEventListener('change', (e) => {
      documentManager.updateActive({ showPageNumbers: e.target.checked });
      this.triggerImmediateSave();
    });

    this.tableBordersSelect.addEventListener('change', (e) => {
      documentManager.updateActive({ tableBorders: e.target.value });
      this.triggerImmediateSave();
    });

    this.tablePaddingSelect.addEventListener('change', (e) => {
      documentManager.updateActive({ tablePadding: e.target.value });
      this.triggerImmediateSave();
    });

    this.tableStripesToggle.addEventListener('change', (e) => {
      documentManager.updateActive({ tableStripes: e.target.checked });
      this.triggerImmediateSave();
    });

    // Orientation radio
    const orientations = document.getElementsByName('page-orientation');
    orientations.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          documentManager.updateActive({ orientation: e.target.value });
          this.triggerImmediateSave();
        }
      });
    });

    // Header / Footer text inputs
    const handleTextInput = (field) => {
      return (e) => {
        documentManager.updateActive({ [field]: e.target.value });
        this.triggerImmediateSave();
      };
    };
    
    this.pdfHeaderText.addEventListener('input', handleTextInput('headerText'));
    this.pdfFooterText.addEventListener('input', handleTextInput('footerText'));

    // Custom CSS Textarea
    this.customCssEditor.addEventListener('input', (e) => {
      documentManager.updateActive({ customCss: e.target.value });
      
      // Update preview (debounced since they type here too)
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        this.triggerImmediateSave();
      }, 500);
    });

    // Reset Custom CSS
    this.resetCssBtn.addEventListener('click', () => {
      this.customCssEditor.value = '';
      documentManager.updateActive({ customCss: '' });
      this.triggerImmediateSave();
    });
  }

  // --- Preview Tab switcher ---
  bindPreviewTabs() {
    const tabDraft = document.getElementById('tab-draft');
    const tabPrint = document.getElementById('tab-print');

    tabDraft.addEventListener('click', () => {
      previewRenderer.setMode('draft');
    });

    tabPrint.addEventListener('click', () => {
      previewRenderer.setMode('print');
    });
  }

  // --- Zoom selector & window resize events ---
  bindZoomEvents() {
    const zoomSelect = document.getElementById('preview-zoom');
    if (zoomSelect) {
      zoomSelect.addEventListener('change', () => {
        previewRenderer.updateZoom();
      });
    }

    // Trigger updateZoom on window resize to keep auto-fit current
    window.addEventListener('resize', () => {
      previewRenderer.updateZoom();
    });
  }

  // --- Split pane dragging ---
  bindSplitPaneEvents() {
    const onMouseDown = (e) => {
      this.isDraggingGutter = true;
      this.splitGutter.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!this.isDraggingGutter) return;
      
      const containerWidth = this.workspaceBody.clientWidth;
      const leftWidth = e.clientX - this.workspaceBody.getBoundingClientRect().left;
      
      let percentage = (leftWidth / containerWidth) * 100;
      
      // Boundary constraints
      if (percentage < 15) percentage = 15;
      if (percentage > 85) percentage = 85;

      this.editorPane.style.width = `${percentage}%`;
      this.previewPane.style.width = `${100 - percentage}%`;

      // Recalculate zoom size dynamically as user resizes panels
      previewRenderer.updateZoom();
    };

    const onMouseUp = () => {
      this.isDraggingGutter = false;
      this.splitGutter.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    this.splitGutter.addEventListener('mousedown', onMouseDown);
  }
}

export const ui = new UIController();
