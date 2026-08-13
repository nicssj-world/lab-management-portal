import { execFileSync } from 'node:child_process'

try {
  execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' })
  execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], { stdio: 'ignore' })
  console.log('git-hooks: using .githooks')
} catch {
  console.log('git-hooks: skipped (not a Git working tree)')
}
