/**
 * 检查 dsh-purge 的启动自愈会不会覆盖掉用户预设里的手改内容。
 *
 * 启动链路：`lib/redteam/index.js` 的 apply() → installPreset({ force: REDTEAM_PRESET_REFRESH === '1'
 * || needsCompositionRepair(...) })。force=false 时它只做"就地自愈"（技能目录路径、工具包名、
 * 派活约束、锚点门），其余内容原样保留。
 *
 * 本脚本调用**本仓库真实的** installPreset()（不是复刻逻辑），在调用前后各取一次
 * SHA-256，用来判断"我给用户预设做的手改，下次启动会不会被覆盖"。
 *
 * 注意副作用（与插件启动时完全一致，不是本脚本额外做的事）：
 *   · 目标不存在时会把 `presets/redteam/` 装到 `$DSH_HOME/.agent-presets/redteam/`；
 *   · 会把 `skills/redteam/*.md` 同步到 `$DSH_HOME/redteam/skills`；
 *   · 目标已存在时**只做自愈**，不覆盖用户内容（本次要验证的就是这一点）。
 *
 * 用法：
 *   node scripts/check-preset-install.mjs [目标目录]
 *
 * 环境变量：
 *   DSH_HOME  默认 ~/.dsh
 *
 * 退出码：0 = 文件未被改动（手改会保留）；2 = 被启动自愈改写了（看 repaired 列表）。
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')

const targetDir = resolve(process.argv[2] ?? join(DSH_HOME, '.agent-presets', 'redteam'))
const target = join(targetDir, 'agent.cordis.yml')

if (!existsSync(target)) {
  console.log(`目标还不存在：${target}`)
  console.log('（首次安装的情况：installPreset 会从本仓库 presets/redteam/ 完整落地一份，无"覆盖"可言。）')
}

const digest = () => (existsSync(target) ? createHash('sha256').update(readFileSync(target)).digest('hex') : '(不存在)')

const before = digest()
const { installPreset } = await import(pathToFileURL(join(REPO, 'lib', 'redteam', 'index.js')).href)
const result = installPreset({ force: false, log: (msg) => console.log(`  [plugin] ${msg}`) })
const after = digest()

console.log(`目标        : ${target}`)
console.log(`action      : ${result.action}`)
console.log(`repaired    : ${result.repaired?.length ? result.repaired.join(', ') : '(无)'}`)
console.log(`skillsDir   : ${result.skillsDir}`)
console.log(`哈希 before : ${before}`)
console.log(`哈希 after  : ${after}`)
console.log(after === before
  ? '\n✓ 预设文件未被改动：手改内容在下次启动时保留'
  : '\n✗ 预设文件被启动自愈改写了，请检查上面的 repaired 列表')

process.exit(after === before ? 0 : 2)
