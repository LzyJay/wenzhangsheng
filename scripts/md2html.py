# -*- coding: utf-8 -*-
"""md2html.py —— 把设计/开发文档的 Markdown 转成"自包含预览版" HTML（双击即看，零依赖）。
------------------------------------------------------------------
用法:
    python scripts/md2html.py <输入.md> [输出.html]
说明:
    · 只支持本设计库文档实际用到的语法：标题 / 表格 / 有序无序列表 / 引用 /
      分隔线 / 行内 **粗体** `代码` [链接](url) / 段落换行（两个以上空格）。
    · Markdown 中单独一行写 <!-- TOC --> 时，自动展开为 h2/h3 目录；
      各级标题自带锚点 id，点目录即可跳转。
    · 注意：表格**不要写在引用块（>）内部**，转换器不解析引用块里的表格。
    · 输出为单文件：样式内联，无外部依赖，可离线打开。
    · 中文字体优先 Microsoft YaHei / 楷体，深墨金主题（与游戏视觉一致）。
"""

import html
import os
import re
import sys

CSS = """
:root{
  --ink:#14111a; --ink2:#1c1826; --line:rgba(232,185,106,.22);
  --gold:#e8b96a; --goldl:#ffe3a8; --jade:#7fd6a8; --text:#e8e2d6; --dim:#a49c92;
}
*{box-sizing:border-box}
body{
  margin:0; padding:0 20px 80px;
  background:var(--ink); color:var(--text);
  font-family:"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif;
  font-size:15px; line-height:1.85;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:940px;margin:0 auto}
h1{
  font-family:"KaiTi","STKaiti","Microsoft YaHei",serif;
  font-size:30px;color:var(--goldl);letter-spacing:2px;
  margin:48px 0 6px;padding-bottom:14px;border-bottom:1px solid var(--line);
}
h1+h2{color:var(--dim);font-size:15px;font-weight:400;letter-spacing:1px;margin:0 0 30px}
h2{
  font-size:20px;color:var(--gold);margin:44px 0 14px;
  padding-left:12px;border-left:4px solid var(--gold);
  letter-spacing:1px;
}
h3{font-size:16px;color:var(--goldl);margin:28px 0 10px}
h4{font-size:14.5px;color:var(--gold);margin:24px 0 8px;letter-spacing:.5px}
h2,h3,h4{scroll-margin-top:24px}
p{margin:12px 0}
strong{color:var(--goldl)}
em{color:var(--jade);font-style:normal}
a{color:var(--jade);text-decoration:none;border-bottom:1px dashed rgba(127,214,168,.5)}
a:hover{color:var(--goldl)}
code{
  font-family:Consolas,"Courier New",monospace;font-size:13px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.10);
  border-radius:4px;padding:1px 5px;color:#ffd9a8;
}
blockquote{
  margin:18px 0;padding:12px 18px;
  border-left:3px solid var(--gold);border-radius:0 8px 8px 0;
  background:rgba(232,185,106,.07);color:#d8d2c6;
}
blockquote p{margin:6px 0}
hr{border:none;border-top:1px solid var(--line);margin:40px 0}
table{
  width:100%;border-collapse:collapse;margin:18px 0;font-size:13.5px;
  border:1px solid var(--line);border-radius:10px;overflow:hidden;
}
thead th{
  background:rgba(232,185,106,.14);color:var(--goldl);
  font-weight:600;text-align:left;padding:9px 11px;
  border-bottom:1px solid var(--line);white-space:nowrap;
}
tbody td{
  padding:9px 11px;border-top:1px solid rgba(255,255,255,.06);
  vertical-align:top;
}
tbody tr:nth-child(even){background:rgba(255,255,255,.028)}
tbody td:first-child{color:var(--gold);white-space:nowrap}
ul,ol{margin:12px 0 12px 6px;padding-left:22px}
li{margin:6px 0}
li::marker{color:var(--gold)}
pre{
  background:var(--ink2);border:1px solid var(--line);border-radius:10px;
  padding:14px 16px;overflow-x:auto;
}
pre code{background:none;border:none;padding:0;color:#e6dccb;font-size:13px;line-height:1.7}
nav.toc{
  margin:26px 0;padding:16px 22px;border:1px solid var(--line);
  border-radius:12px;background:rgba(255,255,255,.025);
}
nav.toc h4{margin:0 0 10px;color:var(--goldl);font-size:14px;letter-spacing:2px}
nav.toc ol{margin:0;padding-left:20px}
nav.toc>ol>li{margin:5px 0;font-size:14px}
nav.toc ol.sub{margin:3px 0 6px;padding-left:18px}
nav.toc ol.sub li{margin:2px 0;font-size:12.8px}
nav.toc a{border-bottom:none;color:var(--text)}
nav.toc ol.sub a{color:var(--dim)}
nav.toc a:hover,nav.toc ol.sub a:hover{color:var(--goldl)}
blockquote table{margin:12px 0}
footer{margin-top:60px;padding-top:18px;border-top:1px solid var(--line);color:var(--dim);font-size:12.5px}
"""


def inline(text):
    """行内格式：先转义，再处理 粗体 / 代码 / 链接。"""
    out = html.escape(text, quote=False)
    out = re.sub(r'`([^`]+)`', r'<code>\1</code>', out)
    out = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', out)
    out = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', out)
    out = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', out)
    return out


def split_row(line):
    return [c.strip() for c in line.strip().strip('|').split('|')]


def plain(text):
    """目录用纯文本：剥掉行内标记后转义。"""
    t = re.sub(r'`([^`]+)`', r'\1', text)
    t = re.sub(r'\*\*([^*]+)\*\*', r'\1', t)
    t = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', t)
    return html.escape(t, quote=False)


def build_toc(heads):
    """由 h2 / h3 生成目录（h3 嵌在其上级 h2 内）；跳过副标题（以 — 开头）。"""
    items = [(lv, plain(t), hid) for lv, t, hid in heads
             if 2 <= lv <= 3 and not t.startswith('—')]
    if not items:
        return ''
    parts = ['<nav class="toc"><h4>目录</h4><ol>']
    i, n = 0, len(items)
    while i < n:
        lv, text, hid = items[i]
        if lv != 2:
            i += 1
            continue
        subs = []
        j = i + 1
        while j < n and items[j][0] == 3:
            subs.append(items[j])
            j += 1
        if subs:
            parts.append(f'<li><a href="#{hid}">{text}</a><ol class="sub">')
            parts += [f'<li><a href="#{h}">{t}</a></li>' for _, t, h in subs]
            parts.append('</ol></li>')
        else:
            parts.append(f'<li><a href="#{hid}">{text}</a></li>')
        i = j
    parts.append('</ol></nav>')
    return '\n'.join(parts)


def convert(md):
    lines = md.split('\n')
    out = []
    heads = []            # [(level, text, id)]
    i = 0
    n = len(lines)
    list_open = None      # 'ul' | 'ol'
    in_code = False

    def close_list():
        nonlocal list_open
        if list_open:
            out.append(f'</{list_open}>')
            list_open = None
    while i < n:
        line = lines[i]
        stripped = line.strip()

        # 代码块
        if stripped.startswith('```'):
            if in_code:
                out.append('</code></pre>')
                in_code = False
            else:
                close_list()
                out.append('<pre><code>')
                in_code = True
            i += 1
            continue
        if in_code:
            out.append(html.escape(line))
            i += 1
            continue

        # 空行
        if not stripped:
            close_list()
            i += 1
            continue

        # 分隔线
        if re.fullmatch(r'-{3,}|\*{3,}', stripped):
            close_list()
            out.append('<hr />')
            i += 1
            continue

        # 表格
        if stripped.startswith('|') and i + 1 < n and re.match(r'^\|[\s:\-|]+\|$', lines[i + 1].strip()):
            close_list()
            head = split_row(lines[i])
            i += 2
            body = []
            while i < n and lines[i].strip().startswith('|'):
                body.append(split_row(lines[i]))
                i += 1
            out.append('<table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr></thead><tbody>')
            for row in body:
                out.append('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in row) + '</tr>')
            out.append('</tbody></table>')
            continue

        # 标题（登记进目录，并给锚点 id）
        m = re.match(r'^(#{1,6})\s+(.*)$', stripped)
        if m:
            close_list()
            lv = len(m.group(1))
            hid = f'sec{len(heads) + 1}'
            heads.append((lv, m.group(2), hid))
            out.append(f'<h{lv} id="{hid}">{inline(m.group(2))}</h{lv}>')
            i += 1
            continue

        # 引用
        if stripped.startswith('>'):
            close_list()
            buf = []
            while i < n and lines[i].strip().startswith('>'):
                buf.append(lines[i].strip().lstrip('>').strip())
                i += 1
            out.append('<blockquote>' + ''.join(f'<p>{inline(b)}</p>' for b in buf if b) + '</blockquote>')
            continue

        # 列表
        m = re.match(r'^[-*]\s+(.*)$', stripped)
        if m:
            if list_open != 'ul':
                close_list()
                out.append('<ul>')
                list_open = 'ul'
            out.append(f'<li>{inline(m.group(1))}</li>')
            i += 1
            continue
        m = re.match(r'^\d+\.\s+(.*)$', stripped)
        if m:
            if list_open != 'ol':
                close_list()
                out.append('<ol>')
                list_open = 'ol'
            out.append(f'<li>{inline(m.group(1))}</li>')
            i += 1
            continue

        # 目录占位（稍后由 build_toc 展开）
        if stripped == '<!-- TOC -->':
            close_list()
            out.append('<!--TOC-->')
            i += 1
            continue

        # 段落（同段内单换行 → 空格；行尾两空格 → <br/>）
        close_list()
        buf = [stripped]
        i += 1
        while i < n and lines[i].strip() and not re.match(r'^(#|>|[-*]\s|\d+\.\s|\||```)', lines[i].strip()):
            buf.append(lines[i].strip())
            i += 1
        joined = ''
        for k, seg in enumerate(buf):
            br = seg.endswith('  ')
            seg = seg.rstrip()
            joined += inline(seg) + ('<br />' if br else (' ' if k < len(buf) - 1 else ''))
        out.append(f'<p>{joined}</p>')

    if in_code:
        out.append('</code></pre>')
    close_list()
    return '\n'.join(out), heads


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(src)[0] + '.html'
    md = open(src, encoding='utf-8').read()
    title = '文档'
    for line in md.split('\n'):
        if line.startswith('# '):
            title = line[2:].strip()
            break
    body, heads = convert(md)
    body = body.replace('<!--TOC-->', build_toc(heads))
    doc = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{html.escape(title)}</title>
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
{body}
<footer>自包含预览版 · 由 scripts/md2html.py 从 Markdown 生成 · 修改请改 .md 后重跑脚本</footer>
</div>
</body>
</html>
"""
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(doc)
    print(f'[OK] {dst}  ({len(doc)} 字符, 源 {os.path.getsize(src)} 字节)')


if __name__ == '__main__':
    main()
