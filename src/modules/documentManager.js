/* --- Document Manager module --- */

const STORAGE_KEY = 'md2pdf_documents';
const ACTIVE_KEY = 'md2pdf_active_id';

const DEFAULT_MARKDOWN = `---
title: Signal Markdown Studio Guide
author: Signal Studio
template: signal
pageSize: A4
orientation: portrait
margins: normal
showPageNumbers: true
headerText: Signal Design System
footerText: Reference Manual
---

# Signal Markdown Studio.

I built **MD-2-PDF** as a plain-text document studio with a Swiss typographic structure: visible rules, flush-left type, zero ornament, and print-ready pagination.

Write standard Markdown on the left; inspect live HTML or paginated print sheets on the right.

[[TOC]]

---

## 01 — Core workflow

1. **Dual preview modes**:
   - **Draft mode**: Instant HTML rendering while you write.
   - **Print layout**: Full Paged.js pagination showing exact sheet breaks, running headers, and margins.
2. **Typographic templates**: Defaults to **Signal** (Geist + Geist Mono, 2px ink rules, Signal green accents), with Academic, Tech Report, Elegant CV, and Letter presets included.
3. **Structured blocks**: Supports GFM tables, checklists, syntax-highlighted code, custom CSS overrides, and **Mermaid** diagrams.
4. **Local persistence**: Documents save automatically to browser storage.

---

## 02 — Typography & callouts

Formatting stays direct and readable:

- **Semibold headings** with tight negative tracking.
- *Italic emphasis* and ~~struck text~~ where needed.
- Inline monospace tokens like \`--accent: #1FE070\`.

### Callout block

> **Print note**: Switch to **Print layout** before exporting to verify page breaks. Insert manual sheet breaks anywhere with \`[[page-break]]\`.

---

## 03 — Code syntax highlighting

Code blocks render in **Geist Mono** under a 2px ink top rule:

\`\`\`javascript
// Calculate A4 sheet aspect ratio
function calculatePageRatio(widthMm, heightMm) {
  const ratio = widthMm / heightMm;
  console.log(\`Ratio: \${ratio.toFixed(4)}\`);
  return ratio;
}

calculatePageRatio(210, 297);
\`\`\`

---

## 04 — Tables & checklists

Tables follow the Signal ruled specification — uppercase monospace headers, 2px ink rules, and 1px row hairlines:

| Mode | Engine | Output |
| :--- | :--- | :--- |
| Draft preview | Markdown-it | Instant HTML |
| Print layout | Paged.js | Paginated sheets |
| Export PDF | Browser print | Vector PDF |

### Release checklist

- [x] Define YAML frontmatter metadata
- [x] Apply Signal document template
- [x] Inspect paginated sheets in Print layout
- [ ] Export vector PDF

---

## 05 — Diagrams

Mermaid flowcharts render inline from fenced \`mermaid\` blocks:

\`\`\`mermaid
graph LR
    A[Markdown Source] --> B[AST Parser]
    B --> C{Preview Mode}
    C -->|Draft| D[Live HTML]
    C -->|Print| E[Paged.js Sheets]
    E --> F[Vector PDF]
\`\`\`
`;

class DocumentManager {
  constructor() {
    this.documents = [];
    this.activeId = null;
    this.init();
  }

  init() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.documents = JSON.parse(data);
        // Backfill missing fields
        this.documents.forEach(doc => {
          if (!doc.textSize) {
            doc.textSize = 'medium';
          }
          if (!doc.customTextScale) {
            doc.customTextScale = 1.0;
          }
          if (!doc.template) {
            doc.template = 'signal';
          }
        });
      }
      
      const activeId = localStorage.getItem(ACTIVE_KEY);
      if (activeId && this.documents.some(d => d.id === activeId)) {
        this.activeId = activeId;
      }
    } catch (e) {
      console.error('Failed to load documents from localStorage:', e);
      this.documents = [];
    }

    // If empty workspace, create initial document
    if (this.documents.length === 0) {
      this.createDocument('Reference manual', DEFAULT_MARKDOWN);
    } else if (!this.activeId) {
      this.activeId = this.documents[0].id;
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.documents));
      if (this.activeId) {
        localStorage.setItem(ACTIVE_KEY, this.activeId);
      } else {
        localStorage.removeItem(ACTIVE_KEY);
      }
    } catch (e) {
      console.error('Failed to save documents to localStorage:', e);
    }
  }

  getAll() {
    return [...this.documents].sort((a, b) => b.lastModified - a.lastModified);
  }

  get(id) {
    return this.documents.find(doc => doc.id === id) || null;
  }

  getActive() {
    if (!this.activeId) return null;
    return this.get(this.activeId);
  }

  setActive(id) {
    if (this.documents.some(d => d.id === id)) {
      this.activeId = id;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  createDocument(title = 'Untitled document', content = '') {
    const id = 'doc_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    const newDoc = {
      id,
      title: title.trim() || 'Untitled document',
      content,
      customCss: '',
      template: 'signal',
      textSize: 'medium',
      customTextScale: 1.0,
      pageSize: 'A4',
      orientation: 'portrait',
      margins: 'normal',
      showPageNumbers: true,
      headerText: '',
      footerText: '',
      tableBorders: 'charcoal-0.5',
      tablePadding: 'normal',
      tableStripes: true,
      lastModified: Date.now()
    };
    
    this.documents.push(newDoc);
    this.activeId = id;
    this.saveToStorage();
    return newDoc;
  }

  updateActive(fields) {
    const active = this.getActive();
    if (!active) return null;

    Object.assign(active, fields, { lastModified: Date.now() });
    this.saveToStorage();
    return active;
  }

  deleteDocument(id) {
    const index = this.documents.findIndex(doc => doc.id === id);
    if (index === -1) return false;

    this.documents.splice(index, 1);
    
    if (this.activeId === id) {
      this.activeId = this.documents.length > 0 ? this.documents[0].id : null;
    }
    
    this.saveToStorage();
    
    // Re-create a simple blank document if empty
    if (this.documents.length === 0) {
      this.createDocument('Untitled document', '# Untitled document.\n\nWrite your markdown here.');
    }
    return true;
  }

  search(query) {
    if (!query) return this.getAll();
    const q = query.toLowerCase();
    return this.documents
      .filter(doc => doc.title.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q))
      .sort((a, b) => b.lastModified - a.lastModified);
  }
}

export const documentManager = new DocumentManager();
