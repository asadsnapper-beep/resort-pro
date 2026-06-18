#!/usr/bin/env node
// Run: node plan/serve.js
// Then open: http://localhost:4242

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 4242
const PLAN_DIR = '/Users/parthohore/Hotel management/plan'

function getAllMdFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...getAllMdFiles(path.join(dir, entry.name), rel))
    } else if (entry.name.endsWith('.md')) {
      files.push(rel)
    }
  }
  return files.sort()
}

const HTML = (files, selected, content) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ResortPro Plans</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; height: 100vh; background: #0f1117; color: #e2e8f0; }

  /* Sidebar */
  #sidebar { width: 280px; min-width: 280px; background: #161b27; border-right: 1px solid #2d3748; overflow-y: auto; display: flex; flex-direction: column; }
  #sidebar-header { padding: 18px 16px 12px; border-bottom: 1px solid #2d3748; }
  #sidebar-header h1 { font-size: 14px; font-weight: 700; color: #1a6b5e; letter-spacing: 0.05em; text-transform: uppercase; }
  #sidebar-header p { font-size: 11px; color: #718096; margin-top: 3px; }
  #file-list { padding: 8px 0; flex: 1; }
  .section-label { padding: 10px 16px 4px; font-size: 10px; font-weight: 600; color: #4a5568; text-transform: uppercase; letter-spacing: 0.08em; }
  .file-link { display: block; padding: 7px 16px; font-size: 13px; color: #a0aec0; text-decoration: none; cursor: pointer; border-left: 3px solid transparent; transition: all 0.15s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .file-link:hover { background: #1e2533; color: #e2e8f0; }
  .file-link.active { background: #1a2635; color: #68d391; border-left-color: #1a6b5e; }
  .file-link.readme { color: #d4a853; }
  .file-link.readme.active { color: #f6d070; border-left-color: #d4a853; }

  /* Content */
  #content-area { flex: 1; overflow-y: auto; padding: 40px 48px; max-width: 900px; }
  #content-area h1 { font-size: 28px; font-weight: 700; color: #f7fafc; margin-bottom: 8px; padding-bottom: 12px; border-bottom: 2px solid #1a6b5e; }
  #content-area h2 { font-size: 20px; font-weight: 600; color: #e2e8f0; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #2d3748; }
  #content-area h3 { font-size: 16px; font-weight: 600; color: #cbd5e0; margin: 24px 0 8px; }
  #content-area p { line-height: 1.75; color: #a0aec0; margin: 10px 0; }
  #content-area a { color: #68d391; text-decoration: none; }
  #content-area a:hover { text-decoration: underline; }
  #content-area ul, #content-area ol { padding-left: 24px; margin: 10px 0; color: #a0aec0; line-height: 1.8; }
  #content-area li { margin: 3px 0; }
  #content-area code { background: #1e2533; color: #68d391; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; }
  #content-area pre { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 8px; padding: 20px; overflow-x: auto; margin: 16px 0; }
  #content-area pre code { background: none; padding: 0; color: #a8d8b9; font-size: 13px; line-height: 1.65; }
  #content-area table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
  #content-area th { background: #1e2533; color: #e2e8f0; padding: 10px 14px; text-align: left; border: 1px solid #2d3748; font-weight: 600; }
  #content-area td { padding: 9px 14px; border: 1px solid #2d3748; color: #a0aec0; }
  #content-area tr:nth-child(even) td { background: #141820; }
  #content-area blockquote { border-left: 3px solid #1a6b5e; padding: 4px 16px; margin: 12px 0; color: #718096; }
  #content-area hr { border: none; border-top: 1px solid #2d3748; margin: 28px 0; }
  #content-area strong { color: #e2e8f0; }

  /* Empty state */
  #empty { display: flex; align-items: center; justify-content: center; flex: 1; color: #4a5568; font-size: 14px; }

  /* Refresh indicator */
  #refresh-dot { width: 7px; height: 7px; background: #1a6b5e; border-radius: 50%; display: inline-block; margin-left: 6px; animation: pulse 3s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  #sidebar-footer { padding: 10px 16px; border-top: 1px solid #2d3748; font-size: 11px; color: #4a5568; display: flex; align-items: center; }
</style>
</head>
<body>

<div id="sidebar">
  <div id="sidebar-header">
    <h1>ResortPro Plans</h1>
    <p>plan/ directory</p>
  </div>
  <div id="file-list">
    ${buildFileTree(files, selected)}
  </div>
  <div id="sidebar-footer">
    Auto-refresh every 3s <span id="refresh-dot"></span>
  </div>
</div>

<div id="content-area">
  ${content ? `<div id="md-output"></div>` : `<div id="empty">← Select a file to view</div>`}
</div>

<script>
const raw = ${JSON.stringify(content || '')};
if (raw) {
  document.getElementById('md-output').innerHTML = marked.parse(raw);
}

// Auto-refresh: check if file list changed
let currentFiles = ${JSON.stringify(files.join(','))};
let currentSelected = ${JSON.stringify(selected || '')};

setInterval(async () => {
  try {
    const res = await fetch('/api/files');
    const data = await res.json();
    const newFiles = data.files.join(',');
    if (newFiles !== currentFiles) {
      // New file added — reload page keeping selection
      window.location.reload();
    }
  } catch(e) {}
}, 3000);

function navigate(file) {
  window.location.href = '/?f=' + encodeURIComponent(file);
}
</script>
</body>
</html>`

function buildFileTree(files, selected) {
  const tree = {}
  for (const f of files) {
    const parts = f.split('/')
    if (parts.length === 1) {
      tree['_root'] = tree['_root'] || []
      tree['_root'].push(f)
    } else {
      const folder = parts[0]
      tree[folder] = tree[folder] || []
      tree[folder].push(f)
    }
  }

  let html = ''
  // Root files first
  if (tree['_root']) {
    for (const f of tree['_root']) {
      const name = f.replace('.md', '')
      const isActive = f === selected
      const isReadme = f.toLowerCase().includes('readme')
      html += `<a class="file-link${isActive ? ' active' : ''}${isReadme ? ' readme' : ''}" onclick="navigate('${f}')">${name}</a>`
    }
  }
  // Folders
  for (const [folder, folderFiles] of Object.entries(tree)) {
    if (folder === '_root') continue
    html += `<div class="section-label">${folder}/</div>`
    for (const f of folderFiles) {
      const name = path.basename(f, '.md')
      const isActive = f === selected
      const isReadme = name.toLowerCase() === 'readme'
      html += `<a class="file-link${isActive ? ' active' : ''}${isReadme ? ' readme' : ''}" onclick="navigate('${f}')">${name}</a>`
    }
  }
  return html
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // API: file list for polling
  if (url.pathname === '/api/files') {
    const files = getAllMdFiles(PLAN_DIR)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ files }))
    return
  }

  // Main page
  const files = getAllMdFiles(PLAN_DIR)
  const selected = url.searchParams.get('f') || null

  let content = null
  if (selected) {
    const filePath = path.join(PLAN_DIR, selected)
    // Security: make sure it's inside PLAN_DIR
    if (filePath.startsWith(PLAN_DIR) && filePath.endsWith('.md') && fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8')
    }
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(HTML(files, selected, content))
})

server.listen(PORT, () => {
  console.log(`\n  ResortPro Plan Viewer`)
  console.log(`  ─────────────────────`)
  console.log(`  http://localhost:${PORT}\n`)
  console.log(`  plans/ folder থেকে সব .md file দেখাবে`)
  console.log(`  নতুন file add হলে auto-refresh হবে`)
  console.log(`\n  বন্ধ করতে: Ctrl+C\n`)
})
