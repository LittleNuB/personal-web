"""Assemble only public website assets, with a verified playable release archive."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def build(archive, output, base):
    manifest = json.loads((ROOT / 'scripts/playables-release.json').read_text(encoding='utf-8'))
    if hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['sha256']:
        raise ValueError('Playable archive checksum mismatch')
    if output.exists():
        raise ValueError('Output directory must be new; use a new build directory')
    output.mkdir(parents=True)
    for name in ('index.html', 'styles.css', 'app.js', 'assets/profile-chibi-lightblue-v5.png', 'assets/cao-honglin-resume.pdf'):
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    allowed = {'.html', '.css', '.js', '.mjs', '.png', '.webp', '.mp4', '.txt'}
    with zipfile.ZipFile(archive) as bundle:
        for info in bundle.infolist():
            path = PurePosixPath(info.filename)
            if path.is_absolute() or '..' in path.parts or '\\' in info.filename or not path.parts or path.parts[0] not in ('zhiyin', 'body-inc'):
                raise ValueError('Unexpected archive path')
            if info.is_dir():
                continue
            if path.suffix not in allowed or any(part.startswith('.') for part in path.parts):
                raise ValueError('Unexpected archive file')
            target = output.joinpath(*path.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            data = bundle.read(info)
            if path.suffix in ('.html', '.js', '.css'):
                data = data.decode('utf-8').replace('/zhiyin/assets/', base + 'zhiyin/assets/').encode('utf-8')
            target.write_bytes(data)
    for route in ('zhiyin', 'body-inc'):
        if not (output / route / 'index.html').is_file():
            raise ValueError('Playable entry missing')
    (output / '.nojekyll').touch()
    (output / '404.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>页面没找到</title><p>这个页面还不存在。</p><a href="' + base + '">返回个人网站</a></html>', encoding='utf-8')
    print(f'Pages ready: {output} ({sum(p.is_file() for p in output.rglob("*"))} files)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'dist')
    parser.add_argument('--base', default='/personal-web/')
    args = parser.parse_args()
    if not args.base.startswith('/') or not args.base.endswith('/') or '..' in args.base or '"' in args.base:
        parser.error('base must be a safe absolute directory path ending in /')
    build(args.archive, args.output, args.base)
