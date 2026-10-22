# 红队预设与 DSH 0.2.1 的兼容性修复（`toolFilter` / `backgroundMode`）

> **本文件是本次存档唯一的源码改动记录。** 仓库其余部分仍为 dsh-purge v1.1.71 原样源码，
> 版权与署名见 `ARCHIVE-NOTICE.md`。改动清单见文末。

| 项 | 内容 |
|---|---|
| 日期 | 2026-10-22 |
| 插件版本 | dsh-purge **1.1.71** |
| 宿主版本 | DeepSeek Harness **0.2.1-rc.2**（桌面端 / win32 x64） |
| 影响文件 | `presets/redteam/agent.cordis.yml` |
| 症状 | 设置 → Agent 预设 → 自定义 →「红队模式」显示 **加载失败**，模式下拉里选不了 |
| 性质 | 上游模板未跟宿主新版 API 同步导致的**配置级不兼容**，不是逻辑缺陷 |

---

## 1. 现象

预设卡片上挂 `加载失败` 标签，**整份** preset 不可选——不是"某一个工具用不了"，而是红队模式整个拉不起来。

dsh-purge 自己会把注册结果写到 `$DSH_HOME/redteam/preset-declare.json`，修复前的内容是：

```json
{
  "ok": false,
  "phase": "registered-broken",
  "id": "redteam",
  "name": "红队模式",
  "plugins": 19,
  "broken": "tool-subagent (@deepseek-ai/dsh-tool-subagent): tool-subagent: toolFilter is no longer supported; configure persona and tool plugins in an Agent Preset and select it with agentPreset (spawn only)"
}
```

`broken` 那一行就是根因，其余全是它的后果。

## 2. 根因

`presets/redteam/agent.cordis.yml` 的 `tool-subagent` 行还带着旧版 API 的 `toolFilter`：

```yaml
    - id: tool-subagent
      name: '@deepseek-ai/dsh-tool-subagent'
      disabled: false
      config:
        provider: spawn
        toolName: subagent
        modelSelectionSettings: true
        backgroundMode: continuable        # ← 0.2.1 已无读取方
        maxDepth: 1
        toolFilter:                        # ← 0.2.1 直接拒收，整份预设因此挂掉
          deny:
            - subagent_fork
            - workflow
            - ralph
```

`@deepseek-ai/dsh-tool-subagent@0.2.1-rc.2` 在 `apply()` 的第一步就把这两个字段判死
（`lib/index.js`）：

```js
for (const field of ["persona", "toolFilter"])
  if (Object.hasOwn(config, field))
    throw new Error(`tool-subagent: ${field} is no longer supported; configure persona and tool
plugins in an Agent Preset and select it with agentPreset (spawn only)`);
```

**为什么是"整份预设加载失败"**：Agent preset 的激活是 fail-closed。
`@deepseek-ai/dsh-agent-preset-registry` 的 `activate()` 调 `mountPreset()`，只要抛错就把
**整份**定义记为 `broken` 并丢掉这一代（`record.broken = error.message`），而不是只让出错的
那一行失效。所以一个字段写老，代价是整个模式消失。

**为什么插件自愈没救回来**：`lib/redteam/index.js` 里的 `repairDelegation()` 只处理
`disabled:` 行与"指挥职责"标题，`renderSkillsDir()` / `renderToolsPackage()` 只处理技能路径与
工具包名——三者都不认 `toolFilter`，所以每次启动都会把这份带毒模板原样注册一遍。

## 3. 修复

删掉两个字段，其余一字不动（`maxDepth: 1` 保留，理由见第 4 节）。

```diff
       config:
         provider: spawn
         toolName: subagent
         modelSelectionSettings: true
-        backgroundMode: continuable
         maxDepth: 1
-        # 注意：不能 deny `subagent` —— …（原注释描述的是 toolFilter 的做法）
-        toolFilter:
-          deny:
-            - subagent_fork
-            - workflow
-            - ralph
+        # 叶子约束现在只由 maxDepth 执行：这是运行时硬拦（到深度上限的委派直接出错），
+        # 模型无视提示词也照样派不动；旧的两道保险里只有这一道还在。
+        # ── 2026-10-22 迁移：删掉 toolFilter（原先 deny subagent_fork / workflow / ralph）──
+        # DSH 0.2.1 的 @deepseek-ai/dsh-tool-subagent 已不接受 `toolFilter`（也不接受更早的
+        # `persona`）：行配置里只要出现这两个字段，apply() 立刻抛错，而预设激活是 fail-closed，
+        # 所以症状是整份 preset "加载失败"、模式下拉里选不了。
```

同时删掉 `tool-subagent-fork` / `-codex` / `-claude-code` 三行的 `backgroundMode`：
在 `resources/app/dsh/node_modules/@deepseek-ai/**/*.js` 全树 grep **零个读取方**
（continuable 现在由 provider 的 `prepareContinuable` 决定）。属于同一类死字段，留着就是下一次
"宿主改成严格 schema 就炸"的地雷。

## 4. 取舍：叶子约束没有被放松

子智能体（信息收集 / 资产梳理 / 漏洞发现 / 漏洞利用 / 内网渗透）**必须是叶子节点**，原本有两道保险：

| 保险 | 机制 | 0.2.1 状态 |
|---|---|---|
| `toolFilter.deny` | 把委派工具从子会话工具目录里摘掉，子会话**看不到** | ❌ 已被 API 移除 |
| `maxDepth: 1` | 运行时硬拦：达到深度上限的委派调用直接出错 | ✅ **保留** |

所以"子会话还能不能再派活"的答案仍然是**不能**——只是从"看不见工具"退化成"看得见但调用必失败"，
`maxDepth` 这道是运行时强制的，模型无视提示词也没用。

想恢复"连看都看不到"的效果，新机制是给子会话指定独立 Agent Preset
（`agentPreset` / `allowedAgentPresets`，仅进程内 spawn 支持）。本次**有意不做**：那需要再声明
一份子 preset，而子会话当前靠"加入父方 preset 代际"继承 persona 与 `redteamRole` 角色稿的注入
位置，换成独立 preset 会改掉这条链路——为一个可见性优化去动派活主链路，不划算。

## 5. 验证

### 5.1 离线体检 + 回归对照

`scripts/check-redteam-preset.mjs` 走的是**线上同一条解析路径**：直接调用本仓库
`lib/redteam/preset-composition.js`（即 `registry.register()` 用的那个读取器），然后逐行
扫禁用字段 → 真实 ESM 解析 → import → 比对 schemastery 声明字段。

修复后（仓库内默认跑 `presets/redteam`）：

```
$ node scripts/check-redteam-preset.mjs
预设: id=redteam name=红队模式 order=10
目录: …/dsh-purge/presets/redteam
宿主: app=…/resources/app/dsh  profile=…/.dsh/profiles/desktop
行数: 33（其中 group 行 3）
— 汇总 —
✓ 无致命问题：无禁用字段，全部可解析的行都能加载
FAIL 0 / NOTE 0 / SKIP 0
```

拿改动前的文件跑同一条（回归对照，证明这个体检抓得住原故障）：

```
- id: tool-subagent  [@deepseek-ai/dsh-tool-subagent]
   ✗ 禁用字段: toolFilter
- id: tool-subagent-fork  [@deepseek-ai/dsh-tool-subagent]
   ! 死字段: backgroundMode
✗ tool-subagent: 配置含当前版本已拒收的字段 toolFilter → 整份预设会挂载失败
FAIL 2 / NOTE 1
```

### 5.2 启动自愈不会覆盖手改

`scripts/check-preset-install.mjs` 调用**真实的** `installPreset()`（不是复刻逻辑），前后取哈希：

```
$ node scripts/check-preset-install.mjs
  [plugin] 已存在用户自己的预设 …/.dsh/.agent-presets/redteam，保留不动
action      : kept
repaired    : (无)
哈希 before : dd3c2d68…
哈希 after  : dd3c2d68…      ← 一致
✓ 预设文件未被改动：手改内容在下次启动时保留
```

### 5.3 端到端：重启宿主后真的好了

预设只在插件 `apply()` 时注册一次，没有热重载入口，所以必须重启 DSH。重启后同一个状态文件：

```json
{
  "ok": true,
  "phase": "registered",
  "id": "redteam",
  "name": "红队模式",
  "plugins": 19,
  "broken": null
}
```

`ok` 由 `false → true`、`broken` 由报错字符串变成 `null`，模式下拉里「红队模式」可选。

## 6. 复查命令

```powershell
# 改完预设随手体检（离线，不需要重启）
node scripts/check-redteam-preset.mjs

# 确认下次启动的自愈不会覆盖你的手改
node scripts/check-preset-install.mjs

# 重启 DSH 之后看注册结果：期望 ok:true / phase:registered
Get-Content "$env:USERPROFILE\.dsh\redteam\preset-declare.json"
```

两个脚本都支持 `DSH_HOME` / `DSH_APP_DIR` / `DSH_PROFILE` 覆盖，未定位到宿主目录时相关行计为
`SKIP`（而不是误报 `FAIL`）。

## 7. 给上游的建议

`lib/redteam/index.js` 的 `repairDelegation()` 已经承担"把老写法的预设就地修好"的职责，建议把
这两个字段也纳入自愈：

```js
// 与 repairDelegation 同级：删掉当前 DSH 已拒收的行配置字段
const DROPPED_ROW_FIELDS = ['toolFilter', 'backgroundMode']   // persona 同理（老版本写法）
```

理由：这两个字段的错误形态特别恶劣——**整份预设失效、错误信息只出现在启动日志和
`preset-declare.json` 里**，用户看到的是下拉框里一个"加载失败"，很难自己定位到是行配置字段过时。

---

## English summary

**Symptom.** The bundled `redteam` agent preset failed to mount; the settings page showed
"加载失败" and the mode dropdown refused to select it.

**Root cause.** `presets/redteam/agent.cordis.yml` still carried the pre-0.2.1 `toolFilter` field on
its `tool-subagent` row. `@deepseek-ai/dsh-tool-subagent@0.2.1-rc.2` rejects `persona` and
`toolFilter` outright in `apply()`. Because agent-preset activation is fail-closed
(`agent-preset-registry.activate()` → `mountPreset()` — any throw marks the **whole** definition
`broken`), one stale field took down the entire mode rather than one tool row.

**Fix.** Delete `toolFilter` (and the dead `backgroundMode`, which has no reader anywhere in the
0.2.1 tree) from the `tool-subagent` rows. `maxDepth: 1` is kept, so subagents remain leaf nodes:
delegation at the depth limit still fails at runtime.

**Verified.** An offline harness that reuses the plugin's own preset reader reports 0 failures and
reproduces the original failure on the pre-fix file; the real `installPreset()` leaves the file
byte-identical; and after restarting the host, `preset-declare.json` flips to
`ok: true / phase: registered / broken: null`.

## 改动清单

| 文件 | 改动 |
|---|---|
| `presets/redteam/agent.cordis.yml` | 删 `tool-subagent` 行的 `toolFilter` 块与 `backgroundMode`；删 `-fork` / `-codex` / `-claude-code` 三行的 `backgroundMode`；原地加迁移注释 |
| `docs/redteam-preset-dsh-0.2.1-compat.md` | 新增：本文件 |
| `scripts/check-redteam-preset.mjs` | 新增：预设离线体检（含禁用字段扫描、模块解析、schema 漂移） |
| `scripts/check-preset-install.mjs` | 新增：验证启动自愈不覆盖手改 |
| `ARCHIVE-NOTICE.md` | 新增一行：说明本仓库不再是"零源码改动"，并指向本文件 |
