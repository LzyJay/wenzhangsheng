# -*- coding: utf-8 -*-
"""图标生成器（一次性可重跑）：产出多尺寸 build/icon.ico 与 build/icon.png，并打印托盘图标 base64。
------------------------------------------------------------------
用法: python scripts/gen_icon.py
产物: build/icon.ico（16~256 全尺寸，PNG 内嵌式 ICO）、build/icon.png（512）、
      stdout 里的 32×32 data URL（内嵌进 electron/main.js 作托盘图标）
设计: 金色外环 + 墨色内环 + 橙金珠心（"金丹/灵珠"意象）——
      高对比、无细碎线条，保证在 Windows 托盘 16px 与浅色/深色任务栏上都看得清。
"""

import base64
import math
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
TRAY_SIZE = 32
SS = 4  # 超采样倍数

# 调色（与 index.html 主题一致）
GOLD_LIGHT = (255, 226, 168)
GOLD = (232, 185, 106)
GOLD_DARK = (198, 138, 58)
INK = (36, 28, 46)
ORANGE = (255, 138, 43)
ORANGE_HOT = (255, 196, 96)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def shade(nx, ny):
    """返回单个采样点的 RGBA（nx/ny ∈ [0,1)）。r 为归一化半径：1.0 = 外缘。"""
    dx, dy = nx - 0.5, ny - 0.5
    r = math.hypot(dx, dy) * 2.0

    if r > 0.985:
        return (0, 0, 0, 0)

    # 左上受光：整体明暗
    light = 1.0 - 0.32 * ((dx * 0.7 + dy * 0.7) / 0.5)

    if r <= 0.36:
        # 珠心：亮橙 → 高光
        t = r / 0.36
        rgb = lerp(ORANGE_HOT, ORANGE, t)
    elif r <= 0.64:
        # 内环：墨（制造对比环）
        rgb = lerp(INK, (58, 46, 74), (r - 0.36) / 0.28)
    else:
        # 外环：金
        t = (r - 0.64) / 0.345
        rgb = lerp(GOLD_LIGHT, GOLD_DARK, t)

    rgb = tuple(max(0, min(255, int(c * light))) for c in rgb)

    # 边缘羽化 1px 级
    a = 255
    if r > 0.94:
        a = int(255 * (0.985 - r) / 0.045)

    # 左上高光点（珠子反光）
    glint = math.hypot(nx - 0.34, ny - 0.30)
    if glint < 0.10 and r <= 0.36:
        k = 1.0 - glint / 0.10
        rgb = tuple(min(255, int(c + (255 - c) * k * 0.75)) for c in rgb)

    return (rgb[0], rgb[1], rgb[2], max(0, min(255, a)))


def render(size):
    """渲染一张 size×size 的 RGBA 原始位图（返回 rows: bytes）"""
    rows = []
    for y in range(size):
        row = bytearray(b'\x00')  # PNG 每行的 filter 字节
        for x in range(size):
            pr = pg = pb = pa = 0
            for sy in range(SS):
                for sx in range(SS):
                    nx = (x + (sx + 0.5) / SS) / size
                    ny = (y + (sy + 0.5) / SS) / size
                    r, g, b, a = shade(nx, ny)
                    pr += r * a
                    pg += g * a
                    pb += b * a
                    pa += a
            n = SS * SS
            if pa == 0:
                row += bytes((0, 0, 0, 0))
            else:
                row += bytes((round(pr / pa), round(pg / pa), round(pb / pa), round(pa / n)))
        rows.append(bytes(row))
    return b''.join(rows)


def png_chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)


def make_png(size):
    raw = render(size)
    return (b'\x89PNG\r\n\x1a\n'
            + png_chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + png_chunk(b'IDAT', zlib.compress(raw, 9))
            + png_chunk(b'IEND', b''))


def make_ico(sizes):
    """PNG 内嵌式 ICO（Vista+ 支持，Windows 10/11 原生渲染）"""
    images = [(s, make_png(s)) for s in sizes]
    header = struct.pack('<HHH', 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries = b''
    for size, blob in images:
        entries += struct.pack('<BBBBHHII',
                               0 if size >= 256 else size,
                               0 if size >= 256 else size,
                               0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
    return header + entries + b''.join(b for _, b in images)


def inspect_png(blob):
    """解析 PNG 返回 (宽, 高, 不透明像素数, 平均RGB) —— 用于自检图标是否真的可见"""
    if blob[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    pos, w, h, idat = 8, 0, 0, b''
    while pos < len(blob):
        ln = struct.unpack('>I', blob[pos:pos + 4])[0]
        tag = blob[pos + 4:pos + 8]
        data = blob[pos + 8:pos + 8 + ln]
        if tag == b'IHDR':
            w, h = struct.unpack('>II', data[:8])
        elif tag == b'IDAT':
            idat += data
        pos += 12 + ln
    raw = zlib.decompress(idat)
    opaque = 0
    rs = gs = bs = 0
    stride = w * 4 + 1
    for y in range(h):
        line = raw[y * stride + 1:(y + 1) * stride]
        for x in range(w):
            r, g, b, a = line[x * 4:x * 4 + 4]
            if a > 128:
                opaque += 1
                rs += r
                gs += g
                bs += b
    if opaque == 0:
        return (w, h, 0, (0, 0, 0))
    return (w, h, opaque, (rs // opaque, gs // opaque, bs // opaque))


def main():
    build_dir = os.path.join(ROOT, 'build')
    assets_dir = os.path.join(ROOT, 'assets')
    os.makedirs(build_dir, exist_ok=True)
    os.makedirs(assets_dir, exist_ok=True)

    ico_path = os.path.join(build_dir, 'icon.ico')
    with open(ico_path, 'wb') as f:
        f.write(make_ico(ICO_SIZES))

    png_path = os.path.join(build_dir, 'icon.png')
    with open(png_path, 'wb') as f:
        f.write(make_png(512))

    # 运行期真正使用的图标：放 assets/（非 buildResources 目录，打包时随 files 一起进 asar）
    tray_path = os.path.join(assets_dir, 'tray.png')
    tray_blob = make_png(TRAY_SIZE)
    with open(tray_path, 'wb') as f:
        f.write(tray_blob)

    app_png_path = os.path.join(assets_dir, 'icon.png')
    with open(app_png_path, 'wb') as f:
        f.write(make_png(256))

    print('[OK] ico   %s  (%d bytes, %d sizes) —— electron-builder 自动取用' % (ico_path, os.path.getsize(ico_path), len(ICO_SIZES)))
    print('[OK] png   %s  (%d bytes)' % (png_path, os.path.getsize(png_path)))
    print('[OK] tray  %s  (%d bytes) —— 主进程运行期读它' % (tray_path, len(tray_blob)))
    print('[OK] app   %s' % app_png_path)

    # 自检：各尺寸的不透明像素占比（太小说明图标"看不见"）
    print('\n[自检] 各尺寸可见性（不透明像素占比 / 均值 RGB）')
    for s in [16, 20, 32, 48, 256]:
        w, h, op, rgb = inspect_png(make_png(s))
        print('  %3dpx  覆盖 %5.1f%%   平均色 rgb%s' % (s, 100.0 * op / (w * h), rgb))

    print('\n[TRAY PNG 校验]')
    w, h, op, rgb = inspect_png(tray_blob)
    print('  %dx%d 覆盖 %.1f%% 平均色 rgb%s  → %s' % (
        w, h, 100.0 * op / (w * h), rgb,
        '可见' if op > w * h * 0.4 else '覆盖过低，可能看不清'))


if __name__ == '__main__':
    main()
