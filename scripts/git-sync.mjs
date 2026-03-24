/**
 * Jedna komanda: git add → commit (ako ima promjena) → push.
 * Pokretanje: npm run sync
 *           npm run sync -- "Tvoja poruka za commit"
 */
import { spawnSync } from 'node:child_process'

function runGit(args) {
  const r = spawnSync('git', args, { stdio: 'inherit', shell: false })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const message =
  process.argv.slice(2).join(' ').trim() ||
  `chore: sync ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`

runGit(['add', '-A'])

const st = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
if (!st.stdout?.trim()) {
  console.log('Nema promjena za commit.')
  process.exit(0)
}

runGit(['commit', '-m', message])
runGit(['push'])
