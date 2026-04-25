#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components', 'lib', 'hooks', 'pages', 'src', 'public']
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.mjs', '.cjs'])
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.turbo', 'attached_assets'])

const REPLACEMENT_CHAR = '\uFFFD'
const failures = []

function walk(dir) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) walk(full)
    else if (st.isFile() && EXTS.has(extname(name))) scan(full)
  }
}

function scan(file) {
  let buf
  try { buf = readFileSync(file) } catch { return }
  // Detect raw 0xEF 0xBF 0xBD bytes (UTF-8 replacement char)
  for (let i = 0; i < buf.length - 2; i++) {
    if (buf[i] === 0xef && buf[i + 1] === 0xbf && buf[i + 2] === 0xbd) {
      const text = buf.toString('utf8')
      const lines = text.split('\n')
      lines.forEach((line, idx) => {
        if (line.includes(REPLACEMENT_CHAR)) {
          failures.push({ file, line: idx + 1, content: line.trim().slice(0, 200) })
        }
      })
      return
    }
  }
}

for (const d of SCAN_DIRS) walk(join(ROOT, d))

if (failures.length === 0) {
  console.log('✓ encoding check passed — no corrupted characters found')
  process.exit(0)
}

console.error('\n✗ encoding check FAILED — found corrupted characters (U+FFFD) in source files:\n')
for (const f of failures) {
  const rel = f.file.replace(ROOT + '/', '')
  console.error(`  ${rel}:${f.line}`)
  console.error(`    → ${f.content}\n`)
}
console.error(`Total: ${failures.length} corrupted line(s) across ${new Set(failures.map(x => x.file)).size} file(s).`)
console.error('Fix the broken characters before building.\n')
process.exit(1)
