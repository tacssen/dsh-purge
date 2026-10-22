# 归档说明 / Archive Notice

## 中文

**这不是本仓库作者的原创项目，而是一份为防丢失而做的源码存档。**

| 项 | 内容 |
|---|---|
| 项目名 | `dsh-purge` — DeepSeek Harness 网络安全红队工具 / 破甲插件 |
| 版本 | **1.1.71** |
| 原作者 | **小杨**（`@YuJunZhiXue`），见 `LICENSE`：`Copyright (c) 2026 小杨` |
| 原仓库 | https://github.com/YuJunZhiXue/dsh-purge |
| 原仓库状态 | **已不可访问**（GitHub 返回 `Could not resolve to a Repository`，作者已删除或转为私有） |
| 许可 | MIT（`LICENSE`，原文完整保留，未作任何修改） |
| 存档来源 | 本机已安装的插件目录 `C:\Users\23090\.dsh\plugins\dsh-purge`（v1.1.71，即上游最后一次发布版本） |
| 存档时间 | 2026-10-21 |
| 存档范围 | 该目录下全部 106 个文件，3.31 MB（`lib/`、`bin/`、`presets/`、`skills/`、`scripts/`、`docs/`、`client.js`、`cordis.patch.yml`、README、release-notes、LICENSE 等） |

### 署名

依据原作者在 `README.zh-CN.md`「署名要求」一节的要求：

> 借用本项目的名称、思路、代码或提示词，必须署名，并写明来源仓库：YuJunZhiXue/dsh-purge。

本仓库照此执行：

- 全部源码、文档、提示词、技能文件**版权归原作者 小杨（YuJunZhiXue）所有**。
- 本仓库**未修改任何源代码**，仅新增本说明文件，并在两个 README 顶部加了一行指向本说明的存档横幅。
  （2026-10-22 起有一处例外，见下文「后续改动」，仅删两个已失效的配置字段。）
- 本仓库**不主张任何著作权**，也不以任何形式商业售卖。
- 如原作者要求下架，删除即可，无需理由。

### 后续改动

v1.1.71 归档之后，本仓库只做过下面这一处改动，且**只删字段、不改逻辑**：

| 日期 | 文件 | 改动 |
|---|---|---|
| 2026-10-22 | `presets/redteam/agent.cordis.yml` | 删掉 `tool-subagent` 行的 `toolFilter`（宿主 0.2.1 已拒收，不删则整份红队预设"加载失败"）与 `backgroundMode`（0.2.1 全树已无读取方），同删 `-fork` / `-codex` / `-claude-code` 三行的 `backgroundMode` |
| 2026-10-22 | `docs/redteam-preset-dsh-0.2.1-compat.md` | 新增：现象 / 根因 / 修复 / 验证的完整记录 |
| 2026-10-22 | `scripts/check-redteam-preset.mjs`、`scripts/check-preset-install.mjs` | 新增：预设离线体检、启动自愈检查 |

除上述文件外，**未改动任何其它源码文件**。原作者的版权与署名要求不因这些改动而改变。

### 为什么会有这个仓库

上游仓库被删除后，这份代码在公网上已无任何可获取的副本。存档目的仅为**保留可复现的技术资料**（含 `release-notes.md` 里 1.1.x 全量变更记录），供原作者或后来者查阅，不构成对原作者任何权利的侵犯或主张。

### 免责

原项目自带的「严正法律免责与合规使用声明」在 `README.zh-CN.md` 中原样保留，其约束力不因本存档而改变。使用本项目代码即表示接受该声明。存档者不对任何第三方使用行为负责。

---

## English

**This is not the original work of this repository's owner — it is a preservation copy of source code that disappeared upstream.**

| Field | Value |
|---|---|
| Project | `dsh-purge` — DeepSeek Harness cybersecurity red-team / prompt-patch plugin |
| Version | **1.1.71** |
| Original author | **小杨 (Xiao Yang)**, GitHub `@YuJunZhiXue` — see `LICENSE`: `Copyright (c) 2026 小杨` |
| Upstream | https://github.com/YuJunZhiXue/dsh-purge |
| Upstream status | **Gone** — GitHub returns `Could not resolve to a Repository`; deleted or made private by the author |
| License | MIT — `LICENSE` kept byte-for-byte, unmodified |
| Source of this copy | The locally installed plugin at `C:\Users\23090\.dsh\plugins\dsh-purge` (v1.1.71, the last published upstream release) |
| Archived on | 2026-10-21 |
| Scope | All 106 files, 3.31 MB: `lib/`, `bin/`, `presets/`, `skills/`, `scripts/`, `docs/`, `client.js`, `cordis.patch.yml`, READMEs, `release-notes.md`, `LICENSE` |

### Attribution

The original `README.zh-CN.md` requires attribution and a link to the source repository for anyone reusing the name, ideas, code, or prompts. This archive complies:

- All source code, docs, prompts and skill files remain **copyright © 小杨 (YuJunZhiXue)**.
- **No source file was modified.** The only additions are this notice and a one-line archive banner at
  the top of both READMEs. (One exception since 2026-10-22 — see *Later changes* below; it deletes two
  obsolete config fields.)
- No copyright is claimed here, and nothing is sold.
- The author may request removal at any time; it will be deleted without argument.

### Later changes

Since the v1.1.71 archive, exactly one change has been made, and it **only deletes fields — no logic
was touched**:

| Date | File | Change |
|---|---|---|
| 2026-10-22 | `presets/redteam/agent.cordis.yml` | Removed `tool-subagent`'s `toolFilter` (rejected by host 0.2.1 — without this the whole redteam preset fails to mount) and `backgroundMode` (no reader left anywhere in 0.2.1); also removed `backgroundMode` from the `-fork` / `-codex` / `-claude-code` rows |
| 2026-10-22 | `docs/redteam-preset-dsh-0.2.1-compat.md` | Added: full record of symptom / root cause / fix / verification |
| 2026-10-22 | `scripts/check-redteam-preset.mjs`, `scripts/check-preset-install.mjs` | Added: offline preset health check and startup self-heal check |

No other source file was touched. The original author's copyright and attribution requirements are
unaffected by these changes.

### Why this exists

With the upstream repository deleted, no public copy of this code remained. The sole purpose is to preserve reproducible technical material — including the complete 1.1.x changelog in `release-notes.md` — for the original author and for anyone studying the implementation.

### Disclaimer

The original project's legal/compliance statement in `README.zh-CN.md` is preserved verbatim and remains in force. Using this code means accepting it. The archivist is not responsible for third-party use.
