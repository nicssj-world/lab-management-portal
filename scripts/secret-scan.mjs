import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { scanText } from './secret-scan-core.mjs'

const staged = process.argv.includes('--staged')

function git(args, encoding = 'utf8') {
  return execFileSync('git', args, {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function nulSeparated(output) {
  return output.split('\0').filter(Boolean)
}

function pathsToScan() {
  if (staged) {
    return nulSeparated(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']))
  }
  return nulSeparated(git(['ls-files', '-z']))
}

function readContent(path) {
  if (staged) {
    return git(['show', `:${path}`], null)
  }
  return existsSync(path) ? readFileSync(path) : null
}

const findings = []
for (const path of pathsToScan()) {
  const content = readContent(path)
  if (!content || content.includes(0)) continue
  findings.push(...scanText(content.toString('utf8'), path))
}

if (findings.length > 0) {
  console.error('Secret scan blocked this change. Credential values are intentionally hidden.')
  for (const finding of findings) {
    console.error(`- ${finding.source}:${finding.line} — ${finding.kind}`)
  }
  process.exit(1)
}

console.log(`secret-scan: no secrets found in ${staged ? 'staged files' : 'tracked files'}`)
