/* --- Markdown Parser Module --- */
import MarkdownIt from 'markdown-it';
import { full as emojiPlugin } from 'markdown-it-emoji';
import yaml from 'js-yaml';

class MarkdownParser {
  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: true
    });

    this.md.use(emojiPlugin);
    this.setupHeadingRenderer();
    this.setupFenceRenderer();
  }

  setupFenceRenderer() {
    const defaultFence = this.md.renderer.rules.fence;
    this.md.renderer.rules.fence = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const info = token.info ? token.info.trim() : '';
      if (info === 'mermaid') {
        // Return raw mermaid wrapper
        return `<div class="mermaid">${token.content}</div>`;
      }
      return defaultFence(tokens, idx, options, env, self);
    };
  }

  setupHeadingRenderer() {
    // Override markdown-it heading_open renderer to assign unique IDs to headings
    // and collect them for outline/TOC generation.
    this.md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      const level = token.tag;
      const nextToken = tokens[idx + 1];
      const text = nextToken ? this.getInlineText(nextToken) : '';
      
      // Generate standard URL slug
      let slug = text.toLowerCase()
        .replace(/[^\w\s-]/g, '') // remove special chars
        .replace(/\s+/g, '-') // spaces to dashes
        .replace(/-+/g, '-'); // collapse multiple dashes
      
      if (!slug) slug = 'section';
      
      // Make unique in this render cycle
      if (!env.slugs) env.slugs = [];
      let uniqueSlug = slug;
      let counter = 1;
      while (env.slugs.includes(uniqueSlug)) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }
      env.slugs.push(uniqueSlug);

      // Collect headings for environment
      if (!env.headings) env.headings = [];
      env.headings.push({
        level: parseInt(level.substring(1)),
        text: text,
        id: uniqueSlug
      });

      return `<${level} id="${uniqueSlug}">`;
    };
  }

  // Helper to extract text content from inline tokens
  getInlineText(token) {
    if (!token.children) return token.content;
    return token.children
      .filter(t => t.type === 'text' || t.type === 'code_inline')
      .map(t => t.content)
      .join('');
  }

  parseFrontmatter(markdown) {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const match = markdown.match(frontmatterRegex);

    if (match) {
      try {
        const yamlContent = match[1];
        const metadata = yaml.load(yamlContent) || {};
        const content = markdown.replace(frontmatterRegex, '').trim();
        return { metadata, content };
      } catch (e) {
        console.error('YAML frontmatter parsing failed:', e);
        return { metadata: {}, content: markdown };
      }
    }

    return { metadata: {}, content: markdown };
  }

  render(markdown) {
    // 1. Extract frontmatter
    const { metadata, content } = this.parseFrontmatter(markdown);
    
    // 2. Prep environment variables for heading collector
    const env = {
      headings: [],
      slugs: []
    };

    // 3. Process custom page break markdown extensions (ignoring fenced code blocks and inline code spans)
    let processedContent = content;
    const pagebreakWithCodeSkipRegex = /((?:^|\r?\n)[ \t]*(?:`{3,}|~{3,})[\s\S]*?(?:\r?\n[ \t]*(?:`{3,}|~{3,})[ \t]*(?=\r?\n|$)|$)|`+[^`\r\n]*?`+)|(?:\[\[page-?break\]\]|\[page-?break\]|\\pagebreak|<!--\s*page-?break\s*-->)/gi;
    processedContent = processedContent.replace(pagebreakWithCodeSkipRegex, (match, codeSegment) => {
      if (codeSegment) return match;
      return '\n\n<div class="page-break-before"></div>\n\n';
    });

    // 4. Render content to HTML
    let renderedHtml = this.md.render(processedContent, env);

    // 5. Inject Table of Contents if requested (ignoring <pre> and <code> blocks, and unwrapping standalone <p>[[TOC]]</p>)
    const tocPlaceholderRegex = /\[\[TOC\]\]|\[toc\]/i;
    if (tocPlaceholderRegex.test(renderedHtml)) {
      const tocHtml = this.generateTocHtml(env.headings);
      const tocWithCodeSkipRegex = /(<pre\b[^>]*>[\s\S]*?<\/pre>|<code\b[^>]*>[\s\S]*?<\/code>)|<p>\s*(?:\[\[TOC\]\]|\[toc\])\s*<\/p>|(?:\[\[TOC\]\]|\[toc\])/gi;
      renderedHtml = renderedHtml.replace(tocWithCodeSkipRegex, (match, codeHtml) => {
        if (codeHtml) return match;
        return tocHtml;
      });
    }

    return {
      html: renderedHtml,
      metadata: metadata,
      headings: env.headings
    };
  }

  generateTocHtml(headings) {
    if (!headings || headings.length === 0) return '';

    let html = `
      <div class="toc-block">
        <h2 class="toc-header" id="table-of-contents">Table of Contents</h2>
        <ul class="toc-list">
    `;

    headings.forEach(heading => {
      // Indent based on heading level
      html += `
        <li class="toc-item toc-level-${heading.level}">
          <a href="#${heading.id}" class="toc-link">${heading.text}</a>
        </li>
      `;
    });

    html += `
        </ul>
      </div>
    `;

    return html;
  }
}

export const markdownParser = new MarkdownParser();
