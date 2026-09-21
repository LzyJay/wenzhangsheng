# -*- coding: utf-8 -*-
"""html2md.py —— 从 md2html.py 生成的 HTML **反向重建** Markdown（应急恢复用）。
------------------------------------------------------------------
用法:
    python scripts/html2md.py <输入.html> <输出.md>

说明:
    · 仅支持本设计库用到的语法（标题 / 表格 / 有序无序列表 / 引用 / 分隔线 /
      行内 **粗体** `代码` *斜体* [链接](url) / <!-- TOC --> 占位）。
    · 自动跳过自动生成的目录 nav 与页脚，目录段还原为 `<!-- TOC -->`。
    · 段落内的单换行在原转换中已合成空格，故还原后段落为单行（语义等价）。
    · ⚠ 这是**恢复工具**，正常流程仍应「改 .md → 重跑 md2html.py」。
"""

import html
import re
import sys
from html.parser import HTMLParser


class Recon(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.lines = []          # 输出行
        self.buf = ''            # 行内累积
        self.mode = None         # 'h'|'p'|'li'|'quote'|'th'|'td'|'pre'
        self.hlevel = 0
        self.list_stack = []     # ['ul'|'ol', ...]
        self.ol_count = []
        self.skip_depth = 0      # >0 时忽略（nav / footer）
        self.row = []
        self.rows = []
        self.in_head = False
        self._last_href = ''

    # ── 工具 ────────────────────────────────────────────────────────────
    def _flush_line(self, text):
        if text.strip():
            self.lines.append(text.rstrip())

    def _close_block(self):
        """收束当前块，把 buf 落盘。"""
        if self.mode in ('h', 'p', 'quote', 'pre'):
            txt = self.buf
            if self.mode == 'h':
                self._flush_line('#' * self.hlevel + ' ' + txt.strip())
            elif self.mode == 'quote':
                self._flush_line('> ' + txt.strip())
            elif self.mode == 'pre':
                self._flush_line('```')
                self.lines.extend(txt.split('\n'))
                self._flush_line('```')
            else:
                self._flush_line(txt.strip())
            self.buf = ''
            self.mode = None

    # ── 标签 ────────────────────────────────────────────────────────────
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'nav' and 'toc' in (a.get('class') or ''):
            self._close_block()
            self.skip_depth = 1
            return
        if tag == 'footer':
            self._close_block()
            self.skip_depth = 1
            return
        if self.skip_depth:
            if tag in ('nav', 'footer'):
                self.skip_depth += 1
            return

        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self._close_block()
            self.mode = 'h'
            self.hlevel = int(tag[1])
        elif tag == 'p':
            # 引用块内的多个 <p> 各自成行（见 endtag 的 p 分支）；其余位置进入段落模式
            if self.mode is None:
                self.mode = 'p'
            elif self.mode not in ('quote', 'li', 'th', 'td'):
                self._close_block()
                self.mode = 'p'
        elif tag == 'blockquote':
            self._close_block()
            self.mode = 'quote'
        elif tag in ('ul', 'ol'):
            self._close_block()
            self.list_stack.append(tag)
            self.ol_count.append(0)
        elif tag == 'li':
            self._close_block()
            depth = max(0, len(self.list_stack) - 1)
            indent = '  ' * depth
            if self.list_stack and self.list_stack[-1] == 'ol':
                self.ol_count[-1] += 1
                self.buf = f'{indent}{self.ol_count[-1]}. '
            else:
                self.buf = f'{indent}- '
            self.mode = 'li'
        elif tag == 'table':
            self._close_block()
            self.rows = []
            self.row = []
        elif tag == 'thead':
            self.in_head = True
        elif tag == 'tr':
            self.row = []
        elif tag in ('th', 'td'):
            self._close_block()
            self.mode = 'th' if tag == 'th' else 'td'
        elif tag == 'pre':
            self._close_block()
            self.mode = 'pre'
        elif tag == 'br':
            self.buf += '  \n'
        elif tag == 'hr':
            self._close_block()
            self._flush_line('---')
        elif tag == 'strong':
            self.buf += '**'
        elif tag == 'em':
            self.buf += '*'
        elif tag == 'code' and self.mode != 'pre':
            self.buf += '`'
        elif tag == 'a':
            self._last_href = a.get('href') or ''
            self.buf += '['

    def handle_endtag(self, tag):
        if self.skip_depth:
            if tag in ('nav', 'footer'):
                self.skip_depth -= 1
            return
        if tag == 'p':
            if self.mode == 'quote':
                # 引用块内换段：落成一行 `> …`
                if self.buf.strip():
                    self._flush_line('> ' + self.buf.strip())
                self.buf = ''
            else:
                self._close_block()
        elif tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'):
            self._close_block()
        elif tag == 'li':
            self._flush_line(self.buf)
            self.buf = ''
            self.mode = None
        elif tag in ('ul', 'ol'):
            self._close_block()
            if self.list_stack:
                self.list_stack.pop()
                self.ol_count.pop()
        elif tag == 'thead':
            self.in_head = False
        elif tag == 'tr':
            if self.row:
                self.rows.append(self.row)
            self.row = []
        elif tag in ('th', 'td'):
            self.row.append(self.buf.strip())
            self.buf = ''
            self.mode = None
        elif tag == 'table':
            if self.rows:
                ncol = max(len(r) for r in self.rows)
                self.lines.append('')
                self.lines.append('| ' + ' | '.join(self.rows[0] + [''] * (ncol - len(self.rows[0]))) + ' |')
                self.lines.append('|' + '|'.join([' --- '] * ncol) + '|')
                for r in self.rows[1:]:
                    self.lines.append('| ' + ' | '.join(r + [''] * (ncol - len(r))) + ' |')
                self.lines.append('')
        elif tag == 'strong':
            self.buf += '**'
        elif tag == 'em':
            self.buf += '*'
        elif tag == 'code' and self.mode != 'pre':
            self.buf += '`'
        elif tag == 'a':
            self.buf += '](' + self._last_href + ')'
        elif tag == 'br':
            self.buf += '  \n'

    def handle_startendtag(self, tag, attrs):
        if tag == 'br':
            self.buf += '  \n'
        elif tag == 'hr':
            self._flush_line('---')

    def handle_data(self, data):
        if self.skip_depth:
            return
        self.buf += data

    def handle_entityref(self, name):
        if not self.skip_depth:
            self.buf += html.unescape('&' + name + ';')

    def handle_charref(self, name):
        if not self.skip_depth:
            self.buf += html.unescape('&#' + name + ';')

    # 记录 a 的 href（用于还原链接）
    def handle_starttag_hook(self):
        pass


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    doc = open(src, encoding='utf-8').read()
    m = re.search(r'<div class="wrap">(.*)</div>\s*</body>', doc, flags=re.S)
    body = m.group(1) if m else doc
    # 目录 nav → 占位符
    body = re.sub(r'<nav class="toc">.*?</nav>', '<p><!--TOC--></p>', body, flags=re.S)

    p = Recon()
    p.feed(body)
    p._close_block()
    text = '\n'.join(p.lines)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.replace('<!--TOC-->', '<!-- TOC -->')
    if not text.endswith('\n'):
        text += '\n'
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'[OK] {dst}  ({len(text)} 字符)')


if __name__ == '__main__':
    main()
