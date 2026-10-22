/**
 * 红队 preset 离线体检（只读，不改任何文件）。
 *
 * 为什么需要：`presets/redteam/agent.cordis.yml` 的行配置如果带了当前 DSH 版本已经不接受的
 * 字段（如 `toolFilter` / `persona`），预设激活是 fail-closed —— 整个 preset 在模式下拉里
 * 显示"加载失败"，而不是只有某一行动不了。这种失败只在 DSH 启动时才暴露，不适合每次改完
 * 预设都重启去试。
 *
 * 本脚本与线上同一条解析路径：直接调用本仓库的 `lib/redteam/preset-composition.js`
 * （dsh-purge 把 preset 注册进 agent-presets registry 时用的就是它），然后：
 *   1. 解析 YAML → 行列表（含 group 的嵌套 config）；
 *   2. 深扫禁用字段 `persona` / `toolFilter`；
 *   3. 用 Node 真实解析去 resolve 每一行的 `name`（`@deepseek-ai/*` 走宿主应用目录，
 *      `dsh-purge/*` 走 profile 的 node_modules）；
 *   4. import 每个解析到的模块，确认它有插件导出；
 *   5. 读插件导出的 schemastery `Config`，列出"配置里写了但 schema 没声明"的死字段
 *      （这类字段会被静默丢弃，是 toolFilter 那次 bug 的土壤）。
 *
 * 用法：
 *   node scripts/check-redteam-preset.mjs [预设目录]     # 默认本仓库 presets/redteam
 *
 * 环境变量：
 *   DSH_HOME     默认 ~/.dsh
 *   DSH_PROFILE  默认 desktop（用于解析 dsh-purge/* 的 profile node_modules）
 *   DSH_APP_DIR  DeepSeek Harness 的应用目录（可给安装根目录、资源目录或 .../resources/app/dsh）
 *                不给时按常见安装位置探测；探测不到只影响 `@deepseek-ai/*` 行的解析，会计为 SKIP。
 *
 * 退出码：0 = 无 FAIL；1 = 有 FAIL。
 *
 * SKIP 与 FAIL 的区别：SKIP = 本机没装宿主/插件，解析不了，不代表预设有问题；
 * FAIL = 预设本身的问题（禁用字段、或模块能解析却在 import 时抛错）。
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')

const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const PROFILE = process.env.DSH_PROFILE ?? 'desktop'
const PROFILE_DIR = join(DSH_HOME, 'profiles', PROFILE)

/** 当前 DSH 版本已在行配置里拒收的字段（出现即整份预设挂载失败）。 */
const FORBIDDEN_CONFIG_KEYS = ['persona', 'toolFilter']

/** 一行一条：`name` 前缀 → 从哪一侧解析。其余按应用侧优先、profile 侧兜底。 */
const presetDir = resolve(process.argv[2] ?? join(REPO, 'presets', 'redteam'))
const PRESET_ID = 'redteam'

/** 把 DSH_APP_DIR 归一化到 `<安装目录>/resources/app/dsh`。 */
function normalizeAppDir(candidate) {
  if (!candidate) return ''
  const forms = [
    candidate,
    join(candidate, 'resources', 'app', 'dsh'),
    join(candidate, 'app', 'dsh'),
  ]
  for (const form of forms) {
    if (existsSync(join(form, 'node_modules', '@deepseek-ai'))) return form
  }
  return ''
}

/** 按常见安装位置探测应用目录。 */
function detectAppDir() {
  const explicit = normalizeAppDir(process.env.DSH_APP_DIR)
  if (explicit) return explicit
  const candidates = []
  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness'))
    candidates.push('C:/Program Files/DeepSeek Harness')
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/DeepSeek Harness.app/Contents/Resources')
  } else {
    candidates.push('/opt/DeepSeek Harness', '/usr/lib/deepseek-harness')
  }
  for (const candidate of candidates) {
    const found = normalizeAppDir(candidate)
    if (found) return found
  }
  return ''
}

const APP_DIR = detectAppDir()
// `dsh-purge/redteam/tools` 在 import 时自己找宿主的 `@deepseek-ai/dsh-tools`：它按
// process.argv[1] / DSH_HOME / cwd 依次试。把 cwd 切到应用目录，与宿主启动时的解析基准
// 一致；否则这一行会被误报成"import 抛错"。
if (APP_DIR) {
  try {
    process.chdir(APP_DIR)
  } catch (error) {
    console.warn(`警告：无法切到应用目录 ${APP_DIR}（${error.code ?? error.message}），dsh-purge 行可能被误报`)
  }
}
const RESOLVERS = []
if (APP_DIR) RESOLVERS.push({ how: 'app', require: createRequire(join(APP_DIR, '__resolve-base__.cjs')) })
if (existsSync(PROFILE_DIR)) RESOLVERS.push({ how: 'profile', require: createRequire(join(PROFILE_DIR, '__resolve-base__.cjs')) })

/** resolve 一个行 `name`；本地环境缺件时返回 skip 而不是失败。 */
function resolveRowName(name) {
  if (name.startsWith('file:')) return { url: name, how: 'preset-relative' }
  const reasons = []
  for (const resolver of RESOLVERS) {
    try {
      return { url: pathToFileURL(resolver.require.resolve(name)).href, how: resolver.how }
    } catch (error) {
      reasons.push(`${resolver.how}: ${error.code ?? error.message}`)
    }
  }
  const hint = RESOLVERS.length === 0
    ? '本机未定位到 DSH 应用目录或 profile，可用 DSH_APP_DIR / DSH_HOME 指定'
    : '该模块未安装在本机（预设本身没问题）'
  return { skip: `${reasons.join(' / ') || '无可用解析基准'} —— ${hint}` }
}

/** 递归摊平 group 行里的子行。 */
function walkRows(rows, depth = 0, out = []) {
  for (const row of rows) {
    out.push({ row, depth })
    if (row?.group === true && Array.isArray(row.config)) walkRows(row.config, depth + 1, out)
  }
  return out
}

const fail = []
const skip = []
const note = []

const reader = pathToFileURL(join(REPO, 'lib', 'redteam', 'preset-composition.js')).href
const { readPresetDefinition } = await import(reader)

if (!existsSync(join(presetDir, 'agent.cordis.yml'))) {
  console.error(`FAIL 找不到 ${join(presetDir, 'agent.cordis.yml')}`)
  process.exit(1)
}

const definition = readPresetDefinition(PRESET_ID, presetDir)
console.log(`预设: id=${definition.id} name=${definition.name ?? '(无)'} order=${definition.order ?? '(无)'}`)
console.log(`目录: ${presetDir}`)
console.log(`宿主: app=${APP_DIR || '(未定位)'}  profile=${existsSync(PROFILE_DIR) ? PROFILE_DIR : '(不存在)'}`)

const flat = walkRows(definition.plugins)
console.log(`行数: ${flat.length}（其中 group 行 ${flat.filter((e) => e.row.group === true).length}）\n`)

/** 同一 specifier 只 import 一次。 */
const moduleCache = new Map()
async function loadModule(name) {
  if (moduleCache.has(name)) return moduleCache.get(name)
  const entry = { name, ok: false, skip: '', url: '', how: '', error: '', plugin: '', declared: null }
  moduleCache.set(name, entry)
  try {
    const resolved = resolveRowName(name)
    if (resolved.skip) {
      entry.skip = resolved.skip
      return entry
    }
    entry.url = resolved.url
    entry.how = resolved.how
    const mod = await import(resolved.url)
    entry.ok = true
    const def = mod.default
    entry.plugin = def === undefined
      ? `命名导出（${Object.keys(mod).join(', ') || '无'}）`
      : typeof def === 'function' ? 'default 是函数' : `default 是对象（name=${def.name ?? '?'}）`
    const schema = mod.Config ?? mod.Schema
    if (schema?.meta?.dict) entry.declared = Object.keys(schema.meta.dict)
    else if (schema?.dict) entry.declared = Object.keys(schema.dict)
  } catch (error) {
    entry.error = error?.message ?? String(error)
  }
  return entry
}

console.log('— 逐行检查 —')
for (const { row, depth } of flat) {
  const indent = '  '.repeat(depth)
  const label = `${indent}- id: ${row.id ?? '(无)'}  [${row.name}]${row.disabled === true ? '  (disabled)' : ''}`
  const config = row.config && typeof row.config === 'object' && !Array.isArray(row.config) ? row.config : {}

  // cordis 不加载 disabled 行：它的 apply() 不执行，配置也就不会触发拒收。
  if (row.disabled === true) {
    console.log(`${label}\n     – 已禁用，宿主不加载这一行，跳过检查`)
    continue
  }

  const bad = FORBIDDEN_CONFIG_KEYS.filter((key) => Object.hasOwn(config, key))
  if (bad.length > 0) {
    fail.push(`${row.id}: 配置含当前版本已拒收的字段 ${bad.join(', ')} → 整份预设会挂载失败`)
    console.log(`${label}\n     ✗ 禁用字段: ${bad.join(', ')}`)
    continue
  }

  if (row.name.startsWith('cordis:')) {
    console.log(`${label}\n     ✓ loader 内置（不解析模块）`)
    continue
  }

  const mod = await loadModule(row.name)
  if (mod.skip) {
    skip.push(`${row.id}: ${mod.skip}`)
    console.log(`${label}\n     – SKIP ${mod.skip}`)
    continue
  }
  if (!mod.ok) {
    fail.push(`${row.id}: 模块能解析但 import 抛错 ${row.name} → ${mod.error}`)
    console.log(`${label}\n     ✗ ${mod.error}`)
    continue
  }

  const extra = mod.declared === null ? [] : Object.keys(config).filter((key) => !mod.declared.includes(key))
  const bits = [mod.plugin, `解析: ${mod.how}`]
  if (mod.declared !== null) bits.push(`schema 字段 ${mod.declared.length} 个`)
  console.log(`${label}\n     ✓ ${bits.join(' / ')}`)
  if (extra.length > 0) {
    note.push(`${row.id}: 写了 schema 未声明的字段 ${extra.join(', ')}（会被静默丢弃）`)
    console.log(`     ! 死字段: ${extra.join(', ')}`)
  }
}

console.log('\n— 汇总 —')
if (fail.length === 0) console.log('✓ 无致命问题：无禁用字段，全部可解析的行都能加载')
for (const line of fail) console.log(`✗ ${line}`)
for (const line of note) console.log(`! ${line}`)
for (const line of skip) console.log(`– SKIP ${line}`)
console.log(`\nFAIL ${fail.length} / NOTE ${note.length} / SKIP ${skip.length}`)
process.exit(fail.length === 0 ? 0 : 1)
