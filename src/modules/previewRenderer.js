/* --- Preview Renderer Module --- */
import { Previewer } from 'pagedjs';
import mermaid from 'mermaid';
import Prism from 'prismjs';

// Import Prism language components
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-markdown.js';

// Import CSS as inline strings using Vite ?inline query
import previewCss from '../styles/preview.css?inline';
import signalTheme from '../styles/themes/signal.css?inline';
import gossamerTheme from '../styles/themes/gossamer.css?inline';
import defaultTheme from '../styles/themes/default.css?inline';
import resumeTheme from '../styles/themes/resume.css?inline';
import academicTheme from '../styles/themes/academic.css?inline';
import reportTheme from '../styles/themes/report.css?inline';
import letterTheme from '../styles/themes/letter.css?inline';

const THEMES = {
  signal: signalTheme,
  gossamer: gossamerTheme,
  default: defaultTheme,
  resume: resumeTheme,
  academic: academicTheme,
  report: reportTheme,
  letter: letterTheme
};

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'neutral',
  logLevel: 5
});

export class PreviewRenderer {
  constructor(options = {}) {
    this.draftContainer = document.getElementById('draft-content');
    this.printContainer = document.getElementById('print-preview-target');
    this.printSource = document.getElementById('print-content-source');
    this.loadingOverlay = document.getElementById('print-loading');
    this.statusText = document.getElementById('preview-status-text');

    this.activeMode = 'draft'; // 'draft' or 'print'
    this.renderPromise = Promise.resolve();
    
    this.renderDebounceTimer = null;
    this.currentDoc = null;
    this.currentRenderId = 0;

    // Listen to print events to temporarily set title to document title for clean PDF filename
    window.addEventListener('beforeprint', () => {
      if (this.currentDoc && this.currentDoc.title) {
        this.originalDocumentTitle = document.title;
        document.title = this.currentDoc.title;
      }
    });

    window.addEventListener('afterprint', () => {
      if (this.originalDocumentTitle) {
        document.title = this.originalDocumentTitle;
        this.originalDocumentTitle = null;
      }
    });
  }

  setMode(mode) {
    if (mode === this.activeMode) return;
    this.activeMode = mode;

    const draftView = document.getElementById('draft-view');
    const printView = document.getElementById('print-view-container');
    const tabDraft = document.getElementById('tab-draft');
    const tabPrint = document.getElementById('tab-print');
    const zoomWrapper = document.getElementById('zoom-control-wrapper');

    if (mode === 'draft') {
      // Invalidate any in-flight print renders immediately
      this.currentRenderId++;

      draftView.classList.add('active');
      printView.classList.remove('active');
      tabDraft.classList.add('active');
      tabPrint.classList.remove('active');
      this.statusText.textContent = 'Draft live HTML';
      if (zoomWrapper) zoomWrapper.style.display = 'none';
      this.renderDraft();
    } else {
      draftView.classList.remove('active');
      printView.classList.add('active');
      tabDraft.classList.remove('active');
      tabPrint.classList.add('active');
      this.statusText.textContent = 'Print layout (Paged.js)';
      if (zoomWrapper) zoomWrapper.style.display = 'flex';
      this.renderPrint(true); // force update when switching
    }
  }

  update(doc) {
    this.currentDoc = doc;
    if (this.activeMode === 'draft') {
      this.renderDraft();
    } else {
      this.renderPrint(false); // debounced
    }
  }

  // Render Draft View (Instant HTML)
  renderDraft() {
    if (!this.currentDoc) return;

    // Render markdown to HTML
    const parseResult = this.currentDoc.rendered;
    if (!parseResult) return;

    const activeTemplate = parseResult.metadata.template || this.currentDoc.template || 'signal';
    
    // Calculate Scale Factor
    let scaleFactor = 1.0;
    const fmTextSize = parseResult.metadata.textSize;
    let activeTextSize = 'medium';
    if (fmTextSize) {
      const numericScale = parseFloat(fmTextSize);
      if (!isNaN(numericScale)) {
        activeTextSize = 'custom';
        scaleFactor = numericScale;
      } else {
        activeTextSize = String(fmTextSize).toLowerCase();
        if (activeTextSize === 'small') scaleFactor = 0.85;
        else if (activeTextSize === 'large') scaleFactor = 1.15;
        else if (activeTextSize === 'medium') scaleFactor = 1.0;
      }
    } else {
      activeTextSize = String(this.currentDoc.textSize || 'medium').toLowerCase();
      if (activeTextSize === 'small') scaleFactor = 0.85;
      else if (activeTextSize === 'large') scaleFactor = 1.15;
      else if (activeTextSize === 'custom') scaleFactor = parseFloat(this.currentDoc.customTextScale || 1.0);
    }
    
    this.draftContainer.className = `markdown-body theme-${activeTemplate} text-size-${activeTextSize}`;
    this.draftContainer.style.setProperty('--pdf-font-size-scale', scaleFactor.toString());
    this.draftContainer.innerHTML = parseResult.html;

    // Highlight code blocks
    Prism.highlightAllUnder(this.draftContainer);

    // Render Mermaid diagrams matching Signal UI theme
    const isDark = document.documentElement.dataset.theme === 'dark';
    this.renderMermaid(this.draftContainer, isDark ? 'dark' : 'neutral');

    // Generate draft table style override to match configuration
    let borderStyle = '1px solid var(--hairline)';
    const tableBorders = this.currentDoc.tableBorders || 'charcoal-0.5';
    if (tableBorders === 'charcoal-1.0') borderStyle = '1px solid var(--fg-2)';
    else if (tableBorders === 'gray-0.5') borderStyle = '1px solid var(--hairline)';
    else if (tableBorders === 'black-1.0') borderStyle = '2px solid var(--rule)';
    else if (tableBorders === 'none') borderStyle = 'none';

    let paddingStyle = '8px 10px';
    const tablePadding = this.currentDoc.tablePadding || 'normal';
    if (tablePadding === 'compact') paddingStyle = '4px 6px';
    else if (tablePadding === 'spacious') paddingStyle = '12px 14px';

    const tableStripes = this.currentDoc.tableStripes !== false;
    const stripeStyle = tableStripes 
      ? 'tr:nth-child(even) { background-color: var(--bg) !important; }' 
      : 'tr { background-color: transparent !important; }';

    const draftStyle = document.createElement('style');
    draftStyle.id = 'draft-table-styles';
    draftStyle.textContent = `
      #draft-content table {
        border-collapse: collapse !important;
        width: 100% !important;
        margin: 12pt 0 !important;
      }
      #draft-content table th,
      #draft-content table td {
        border-bottom: ${borderStyle} !important;
        padding: ${paddingStyle} !important;
      }
      #draft-content table th {
        border-top: var(--border-rule) solid var(--rule) !important;
        border-bottom: var(--border-rule) solid var(--rule) !important;
        background-color: var(--bg) !important;
      }
      #draft-content table ${stripeStyle}
    `;
    this.draftContainer.appendChild(draftStyle);
  }

  // Update Zoom scale factor for Print Layout preview
  updateZoom() {
    if (this.activeMode !== 'print') return;

    const zoomSelect = document.getElementById('preview-zoom');
    if (!zoomSelect) return;
    const zoomVal = zoomSelect.value;

    const target = this.printContainer;
    if (!target) return;

    if (zoomVal === 'auto') {
      const viewport = document.getElementById('print-view-container');
      if (!viewport) return;

      const page = target.querySelector('.pagedjs_page');
      if (!page) {
        if ('zoom' in document.body.style) {
          target.style.zoom = '1';
        } else {
          target.style.transform = 'scale(1)';
        }
        target.style.setProperty('--preview-zoom', '1');
        return;
      }

      const padding = 48; // Total horizontal padding
      const viewportWidth = viewport.clientWidth - padding;
      const pageWidth = page.offsetWidth || 794;

      let scale = viewportWidth / pageWidth;
      // Clamp scale to reasonable limits
      scale = Math.max(0.3, Math.min(1.2, scale));

      const scaleStr = scale.toString();
      if ('zoom' in document.body.style) {
        target.style.zoom = scaleStr;
        target.style.transform = '';
      } else {
        target.style.transform = `scale(${scaleStr})`;
        target.style.zoom = '';
      }
      target.style.setProperty('--preview-zoom', scaleStr);
    } else {
      if ('zoom' in document.body.style) {
        target.style.zoom = zoomVal;
        target.style.transform = '';
      } else {
        target.style.transform = `scale(${zoomVal})`;
        target.style.zoom = '';
      }
      target.style.setProperty('--preview-zoom', zoomVal);
    }
  }

  // Render Print Layout (Paged.js Pagination)
  renderPrint(force = false) {
    if (!this.currentDoc) return;

    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }

    // Increment immediately to invalidate any previously running/in-flight render
    const renderId = ++this.currentRenderId;

    // Set a 100ms delay instead of 0ms when forced/switching to let browser complete layout paints
    const delay = force ? 100 : 1000; 

    this.renderDebounceTimer = setTimeout(() => {
      // Chain the rendering to serialize execution (guarantees at most one Paged.js run is active)
      this.renderPromise = (async () => {
        try {
          await this.renderPromise;
        } catch (e) {
          // Ignore errors from previous obsolete renders
        }

        // Check if we are still the active render session and in print mode
        if (renderId !== this.currentRenderId || this.activeMode !== 'print') {
          return;
        }

        // Check if preview container is visible
        const isVisible = this.printContainer.getBoundingClientRect().width > 0;
        if (!isVisible) {
          this.statusText.textContent = 'Print layout paused';
          return;
        }

        this.loadingOverlay.classList.add('active');
        this.statusText.textContent = 'Generating layout...';

        try {
          const parseResult = this.currentDoc.rendered;
          if (!parseResult) return;

          const fm = parseResult.metadata;
          const template = this.currentDoc.template || 'signal';
          const templateVal = fm.template || template;
          
          // Calculate Scale Factor
          let scaleFactor = 1.0;
          const fmTextSize = fm.textSize;
          let textSizeVal = 'medium';
          if (fmTextSize) {
            const numericScale = parseFloat(fmTextSize);
            if (!isNaN(numericScale)) {
              textSizeVal = 'custom';
              scaleFactor = numericScale;
            } else {
              textSizeVal = String(fmTextSize).toLowerCase();
              if (textSizeVal === 'small') scaleFactor = 0.85;
              else if (textSizeVal === 'large') scaleFactor = 1.15;
              else if (textSizeVal === 'medium') scaleFactor = 1.0;
            }
          } else {
            textSizeVal = String(this.currentDoc.textSize || 'medium').toLowerCase();
            if (textSizeVal === 'small') scaleFactor = 0.85;
            else if (textSizeVal === 'large') scaleFactor = 1.15;
            else if (textSizeVal === 'custom') scaleFactor = parseFloat(this.currentDoc.customTextScale || 1.0);
          }

          // Clear print source and populate it
          this.printSource.className = `theme-${templateVal} text-size-${textSizeVal}`;
          this.printSource.style.setProperty('--pdf-font-size-scale', scaleFactor.toString());
          this.printSource.innerHTML = parseResult.html;

          // Run Prism highlighting in source first
          Prism.highlightAllUnder(this.printSource);

          // Run Mermaid diagrams in source first with 'default' (light) theme for print
          await this.renderMermaid(this.printSource, 'default');

          // Compile Stylesheet custom variables and rules
          const styleEl = document.createElement('style');
          styleEl.id = 'pagedjs-compiled-styles';

          // Read variables from document config or YAML frontmatter
          const size = this.currentDoc.pageSize || 'A4';
          const orientation = this.currentDoc.orientation || 'portrait';
          const margin = this.currentDoc.margins || 'normal';
          const customCss = this.currentDoc.customCss || '';
          const tableBorders = this.currentDoc.tableBorders || 'charcoal-0.5';
          const tablePadding = this.currentDoc.tablePadding || 'normal';
          const tableStripes = this.currentDoc.tableStripes !== false;
          
          let headerText = this.currentDoc.headerText || fm.headerText || '';
          let footerText = this.currentDoc.footerText || fm.footerText || '';
          let docTitle = this.currentDoc.title || fm.title || '';
          
          const sizeVal = fm.pageSize || size;
          const orientationVal = fm.orientation || orientation;
          const marginTopVal = fm.marginTop || (margin === 'narrow' ? '10mm' : margin === 'wide' ? '30mm' : '20mm');
          const marginRightVal = fm.marginRight || (margin === 'narrow' ? '10mm' : margin === 'wide' ? '30mm' : '20mm');
          const marginBottomVal = fm.marginBottom || (margin === 'narrow' ? '10mm' : margin === 'wide' ? '30mm' : '20mm');
          const marginLeftVal = fm.marginLeft || (margin === 'narrow' ? '10mm' : margin === 'wide' ? '30mm' : '20mm');

          // Compile absolute page rules (without CSS variables to prevent Paged.js evaluation failures)
          const escapedHeader = headerText.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const escapedTitle = docTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const escapedFooter = footerText.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const pageNumVal = this.currentDoc.showPageNumbers !== false && fm.showPageNumbers !== false ? '"Page " counter(page) " / " counter(pages)' : '""';
          const fontVal = templateVal === 'signal'
            ? "'Geist Mono', monospace"
            : (templateVal === 'academic' || templateVal === 'letter' ? "'Playfair Display', serif" : "'Inter', sans-serif");

          const absolutePageRules = `
            @page {
              size: ${sizeVal} ${orientationVal};
              margin: ${marginTopVal} ${marginRightVal} ${marginBottomVal} ${marginLeftVal};
              
              @top-left {
                content: "${escapedHeader}";
                font-family: ${fontVal};
              }
              @top-right {
                content: "${escapedTitle}";
                font-family: ${fontVal};
              }
              @bottom-left {
                content: "${escapedFooter}";
                font-family: ${fontVal};
              }
              @bottom-right {
                content: ${pageNumVal};
                font-family: ${fontVal};
              }
            }
          `;

          let borderStyle = '0.5pt solid #444444';
          if (tableBorders === 'charcoal-1.0') borderStyle = '1pt solid #444444';
          else if (tableBorders === 'gray-0.5') borderStyle = '0.5pt solid #cbd5e1';
          else if (tableBorders === 'black-1.0') borderStyle = '1pt solid #0e0e0c';
          else if (tableBorders === 'none') borderStyle = 'none';

          let paddingStyle = '8px 10px';
          if (tablePadding === 'compact') paddingStyle = '4px 6px';
          else if (tablePadding === 'spacious') paddingStyle = '12px 14px';

          const stripeStyle = tableStripes 
            ? 'tr:nth-child(even) { background-color: #f5f5f2 !important; }' 
            : 'tr { background-color: transparent !important; }';

          const tableRules = templateVal === 'signal' ? `
            table {
              border-collapse: collapse !important;
              width: 100% !important;
              margin: 12pt 0 !important;
            }
            table th, table td {
              padding: ${paddingStyle} !important;
            }
            table td {
              border-bottom: ${borderStyle} !important;
            }
            table th {
              border-top: 2px solid #0e0e0c !important;
              border-bottom: 2px solid #0e0e0c !important;
              background-color: #f5f5f2 !important;
            }
            table ${stripeStyle}
          ` : `
            table {
              border-collapse: collapse !important;
              width: 100% !important;
              margin: 12pt 0 !important;
            }
            table th, table td {
              border: ${borderStyle} !important;
              padding: ${paddingStyle} !important;
            }
            table th {
              font-weight: 600 !important;
              background-color: #f1f5f9 !important;
            }
            table ${stripeStyle}
          `;

          styleEl.textContent = `
            ${previewCss}
            ${absolutePageRules}
            ${THEMES[templateVal] || signalTheme}
            ${tableRules}
            ${customCss}
          `;

          // Discard if obsolete or no longer in print mode
          if (renderId !== this.currentRenderId || this.activeMode !== 'print') return;

          // Clean up any previously inserted Paged.js styles to avoid style leakage and cascade pollution
          document.head.querySelectorAll('[data-pagedjs-inserted-styles]').forEach(el => el.remove());

          // Clear target container and apply theme class before pagination
          this.printContainer.className = `theme-${templateVal} text-size-${textSizeVal}`;
          this.printContainer.style.setProperty('--pdf-font-size-scale', scaleFactor.toString());
          this.printContainer.innerHTML = '';

          // Instantiate a fresh Previewer on every render to avoid concurrency/state conflicts
          const previewer = new Previewer();

          // Prepare stylesheet object for Paged.js to parse and apply
          const stylesheetObj = {};
          stylesheetObj[window.location.href] = styleEl.textContent;

          // Run Paged.js previewer with explicit stylesheet list to prevent fallback to 1-inch default margins
          await previewer.preview(
            this.printSource.innerHTML,
            [stylesheetObj],
            this.printContainer
          );

          // Discard if obsolete or no longer in print mode
          if (renderId !== this.currentRenderId || this.activeMode !== 'print') return;

          this.statusText.textContent = 'Print layout ready';
          this.updateZoom();
        } catch (err) {
          if (renderId === this.currentRenderId && this.activeMode === 'print') {
            console.error('Paged.js layout error:', err);
            this.statusText.textContent = 'Layout error';
          }
        } finally {
          if (renderId === this.currentRenderId) {
            this.loadingOverlay.classList.remove('active');
          }
        }
      })();
    }, delay);
  }

  async renderMermaid(container, theme) {
    const mermaidNodes = container.querySelectorAll('.mermaid');
    if (mermaidNodes.length === 0) return;

    // Reset mermaid theme
    mermaid.initialize({
      startOnLoad: false,
      theme: theme
    });

    for (let i = 0; i < mermaidNodes.length; i++) {
      const node = mermaidNodes[i];
      const code = node.textContent.trim();
      const id = `mermaid-svg-${i}-${Math.random().toString(36).substr(2, 5)}`;
      
      try {
        node.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:auto;"></div>';
        const { svg } = await mermaid.render(id, code);
        node.innerHTML = svg;
      } catch (err) {
        console.error('Individual Mermaid rendering failed:', err);
        node.innerHTML = `<div class="mermaid-error sg-tag sg-tag--danger"><span class="sg-tag__dot"></span>Mermaid syntax error</div>`;
        // Clear badge from body if mermaid inserted error nodes
        const errorEl = document.getElementById(`d${id}`);
        if (errorEl) errorEl.remove();
      }
    }
  }

  print() {
    // Before printing, force a print layout render synchronously
    if (this.activeMode !== 'print') {
      this.setMode('print');
    }
    
    // Trigger browser print dialog
    window.print();
  }
}
export const previewRenderer = new PreviewRenderer();
