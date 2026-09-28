/* --- CodeMirror 6 Editor Module (Signal Design System) --- */
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';

// Signal Design System syntax highlighting using CSS custom properties
// Adapts automatically to both [data-theme="light"] and [data-theme="dark"]
const signalHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', color: 'var(--fg-1)', textDecoration: 'underline', textDecorationColor: 'var(--accent)' },
  { tag: [tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: 'var(--fg-1)' },
  { tag: tags.strong, fontWeight: '700', color: 'var(--fg-1)' },
  { tag: tags.emphasis, fontStyle: 'italic', color: 'var(--fg-1)' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--fg-3)' },
  { tag: [tags.monospace, tags.processingInstruction, tags.string, tags.inserted], color: 'var(--accent-text)' },
  { tag: [tags.link, tags.url], color: 'var(--accent-2-text)', textDecoration: 'underline' },
  { tag: [tags.meta, tags.comment, tags.quote], color: 'var(--fg-2)' },
  { tag: [tags.keyword, tags.operator, tags.atom, tags.bool, tags.number], color: 'var(--accent-2-text)' }
]);

const signalEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--surface)',
    color: 'var(--fg-1)'
  },
  '.cm-content': {
    caretColor: 'var(--accent-press)'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--accent-press)',
    borderLeftWidth: '2px'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--selection)'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg)',
    color: 'var(--fg-3)',
    borderRight: '1px solid var(--hairline)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--fg-1)'
  }
});

export class MarkdownEditor {
  constructor(containerEl, options = {}) {
    this.containerEl = containerEl;
    this.onChange = options.onChange || (() => {});
    this.onSave = options.onSave || (() => {});
    this.onSelectionChange = options.onSelectionChange || (() => {});
    this.editorView = null;
    
    this.init();
  }

  init() {
    // Clear container
    this.containerEl.innerHTML = '';

    // Create Update Listener for changes
    const changeListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        this.onChange(content);
      }
      if (update.selectionSet || update.docChanged) {
        const selectionInfo = this.getSelectionInfo();
        this.onSelectionChange(selectionInfo);
      }
    });

    // Custom Save Hotkey extension (Ctrl+S / Cmd+S)
    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          this.onSave(this.getContent());
          return true; // prevent default browser behavior
        }
      }
    ]);

    // Create Editor State
    const state = EditorState.create({
      doc: '',
      extensions: [
        basicSetup,
        markdown(),
        signalEditorTheme,
        syntaxHighlighting(signalHighlightStyle),
        EditorView.lineWrapping, // Enable word wrapping
        changeListener,
        saveKeymap,
        keymap.of([indentWithTab]) // Enable standard tab key indentation
      ]
    });

    // Mount Editor View
    this.editorView = new EditorView({
      state,
      parent: this.containerEl
    });
  }

  getContent() {
    if (!this.editorView) return '';
    return this.editorView.state.doc.toString();
  }

  setContent(content) {
    if (!this.editorView) return;
    
    const currentContent = this.getContent();
    if (currentContent === content) return;

    // Dispatch a transaction to replace the entire document content
    this.editorView.dispatch({
      changes: {
        from: 0,
        to: this.editorView.state.doc.length,
        insert: content || ''
      }
    });
  }

  getSelectionInfo() {
    if (!this.editorView) return { hasSelection: false, text: '', from: 0, to: 0, lineCount: 0 };
    
    const { state } = this.editorView;
    const { from, to } = state.selection.main;
    
    if (from === to) {
      return { hasSelection: false, text: '', from, to, lineCount: 0 };
    }
    
    const text = state.sliceDoc(from, to);
    
    const startLine = state.doc.lineAt(from).number;
    const endLine = state.doc.lineAt(to).number;
    const lineCount = endLine - startLine + 1;
    
    return {
      hasSelection: true,
      text,
      from,
      to,
      lineCount
    };
  }

  replaceSelection(newText) {
    if (!this.editorView) return;
    
    const { state } = this.editorView;
    const { from, to } = state.selection.main;
    
    this.editorView.dispatch({
      changes: { from, to, insert: newText },
      selection: { anchor: from + newText.length }
    });
  }

  focus() {
    if (this.editorView) {
      this.editorView.focus();
    }
  }

  getWordCount() {
    const text = this.getContent().trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
}
