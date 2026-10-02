# Obsidian 竞品深度横向调研：护城河在“可迁移的个人系统”，不在功能数量

## 摘要：Obsidian 赢得个人系统，但云端协作、治理与托管 AI 仍是其结构性弱项

截至 2026 年 9 月 30 日，Obsidian 的核心竞争力仍是本地 Markdown、开放文件、插件生态和用户付费模式，而不是原生多人协作、企业治理或托管 AI。其直接替代关系应按场景拆分，不能笼统定义为“另一个笔记应用”：Logseq 最接近其本地优先与网络化思考定位，Anytype 挑战其对象化知识模型，Notion 替代其文档、数据库和协作层，Craft 替代其写作和分享层，Roam Research 仍是块级大纲思考的原型参照。真正的竞争已从“谁有双链”转向“谁能在开放文件、实时协作、AI 语义检索和治理之间取得平衡”。

场景适配呈现清晰分界。Obsidian、Logseq、Capacities、Recall 与 Craft 更适合个人知识管理；Notion、Confluence、Coda、ClickUp Docs 和 Slite 更适合团队知识库；Anytype 适合把隐私、对象结构和协作同时置于重要位置的团队，但企业治理能力尚未得到充分验证。若工作流高度依赖块引用、每日日志和树状重组，Roam 仍是直接替代品；若需求是可验证来源、关系模型、模板和写作，Logseq、Capacities 或 Obsidian 通常更完整。

定价结构同样体现产品哲学差异：Obsidian、Logseq、Zettlr 和 Joplin 的个人使用成本很低；Notion Plus、Confluence Standard、Coda Pro、Slite Basic 等云端产品则按席位或创作者收费。Obsidian Sync 年付为 4 美元/用户/月，可选 Catalyst 为一次性 25 美元，公开商业许可为 50 美元/用户/年；但团队若需要 SAML、SCIM、审计、细粒度行权限和正式支持，Obsidian 不是低成本替代方案，反而会因补件、维护和培训增加隐性成本。[1]

对产品经理和创业者而言，最可行的差异化机会，是构建“本地语义层、跨工具知识图谱、可验证 AI、对象与文件双模型、渐进式协作”的产品，而不是继续复制双链、看板或通用 AI 聊天。与此同时，需要正视数据索引质量、权限继承、冲突解决、AI 成本和信任建立的难度。Obsidian 的历史地位意味着新进入者不能仅靠兼容 Markdown 或加入 AI 取胜；必须证明其在组织知识复用、协作安全和退出能力上更优。

## 研究边界与结论口径

**本报告以可验证的当前产品能力为准，不把历史名气、旧版本体验或停止更新的项目当作现存竞品。** 候选产品划分为本地优先个人知识管理、大纲与对象模型、云端协作工作区、AI 知识库与写作工具五组。时间基准为 2026 年 9 月 30 日；价格、计划名称和配额均注明“公开起始价”和计费口径，实际报价会随币种、税费、地区、企业合同和 AI 用量变化。

产品状态和价格应被视为一个观察时点，而非永久承诺。Mem 的公开官网曾存在注册入口、产品介绍和定价信息，但本次检索未稳定获得可逐字核验的官方当前价格页，因此不将其列入核心采购比较。Recall 同时存在 `getrecall.ai` 与 `recallnotes.io` 两个对外入口，且价格与 AI 配额表述在不同页面有所变化；本报告采用可明确核验的官方页价格，并提示其价格可能处于调整期。[15][16]

评分、推荐和决策矩阵均为分析性判断，不是厂商性能测试，也不是市场份额统计。评分用于产品经理快速筛选择优，不能替代 PoC、安全评审和迁移演练。对无法用统一口径比较的“用户规模、收入、性能、稳定性、活跃度”，本报告不作伪精确排名；Notion 公开声称超过 1 亿用户，但不同站点的统计定义并不一致，不能与社区下载量直接比较。[7]

数据来源方面，优先采用产品官网、定价页、帮助文档和安全说明，其次是可信技术资料及长期产品资料；二手媒体的功能判断只用于补足用户体验，不单独支撑核心结论。部分官方页面会通过脚本动态渲染，搜索索引可能比实时页面滞后；因此，涉及“当前是否可用”的结论会在本章和后续场景章节反复提示核验。

[定价与产品状态数据下载](/data/workspace/dr:ce8897e6/数据_产品定价与状态.csv)

## 市场不是单一赛道，而是围绕用户、文件与团队控制权的五条竞争线

**知识管理市场的表面功能是笔记，实际竞争的是知识的最小单元、存储位置和治理责任。** Obsidian 把文件作为最小单元，Notion 把块、页面和数据库作为最小单元，Roam 强调块和每日日志，Anytype 与 Capacities 强调对象和关系，Recall 与 Mem 则更接近“内容捕获后由 AI 检索”。这五种模型无法按同一张功能表简单相加：文件模型强调退出权和长期保存，块模型强调重组和复用，对象模型强调语义和模板，AI 模型强调降低组织成本。

| 类别 | 代表产品 | 核心心智 | 最佳替代对象 | 不可替代价值 |
|---|---|---|---|---|
| 本地优先 PKM | Obsidian、Logseq、Joplin、Zettlr | 用户拥有文件，离线优先 | 各自的数据模型不同，并非完全互相替代 | 开放文件、离线、长期保存、可自托管同步 |
| 大纲与对象模型 | Roam、Anytype、Capacities | 块、对象、关系和时间线 | 双链笔记、对象库 | 思维过程、模板化对象和语义关联 |
| 云端协作工作区 | Notion、Confluence、Coda、ClickUp Docs、Slite | 共享工作 OS | 团队文档、数据库、知识维护 | 实时编辑、权限、自动化、SSO/SCIM/审计 |
| AI 知识库 | Mem、Capacities、Recall | 捕获、摘要、语义召回 | 搜索和阅读工作流 | 低摩擦组织、跨来源问答、AI 代理连接 |
| 写作优先 | Craft、Zettlr、Bear | 文档、排版、写作心流 | 长期写作和分享 | 编辑器质量、引注、排版、跨端呈现 |

**“免费”不是同一类价格。** Obsidian 核心免费，但官方同步按 4 美元/用户/月年付，Publish 按站点收费；Logseq 核心和 Sync 在官方公开页中分别呈现，但二手资料显示 Sync 的可访问性仍可能受 beta 或邀请条件影响；Joplin 应用可以免费使用，Cloud Basic 公开历史口径约 2.99 欧元/月；Anytype 核心可免费使用，付费模式更多体现名称、网络空间和协作额度。[2][3][4][5] Zettlr 和 Bear 分别采用开源与 Apple 生态收费模式。团队产品则普遍按席位、创作者或 AI 使用量收费。价格只能用于初筛，不能代替三年总拥有成本测算。

![本地工具与对象型产品更适合个人知识管理](https://raw.githubusercontent.com/riverzhou/rustmd/master/examples/assets/fig1-adaptation-score.png)

*图 1：个人知识管理场景的加权决策分。数据来源：本报告基于官方功能资料的分析评分，5 分制。*

**公开价格已经反映不同商业模式，但不能直接代表使用总成本。** 本地工具把成本留在设备、同步、备份和用户维护上；云端工具把成本转化为席位、存储、集成和 AI 用量。Confluence 的公开起始价为 5.42 美元/用户/月，Notion Plus 为 10 美元/用户/月，Coda Pro 为 12 美元/Doc Maker/月，Slite Basic 为 10 美元/用户/月；Coda 的 Editor 与 Viewer 免费，因此其结果不能与普通全员付费产品直接比较。[9][10][11][12]

![最低持续付费方案的价格分野](https://raw.githubusercontent.com/riverzhou/rustmd/master/examples/assets/fig2-pricing.png)

*图 2：各产品公开最低持续付费方案，统一按公开月付或年付月均换算。数据来源：各产品官方定价页，信息截至 2026 年 9 月 30 日；不含税费与 AI 用量。*

## 直接替代关系按场景拆分，而不是按“同为笔记软件”定义

**Obsidian 的替代关系必须分功能层和场景层，不存在单一完全替代品。** Logseq 是本地优先 PKM 层面最接近的对手，Anytype 是对象模型和加密同步层面的挑战者，Notion 覆盖文档、数据库和团队空间，Craft 更像写作和分享替代方案，Roam 则保持块级大纲思考的独特位置。

| 产品 | 定位与目标用户 | 真实直接替代对象 | 主要不直接替代 |
|---|---|---|---|
| Obsidian | 个人与专业用户的本地 Markdown 知识库 | Logseq、Joplin、Anytype、Zettlr 的部分场景 | Notion、Confluence 的企业协作与治理 |
| Logseq | 以大纲、日记、块和查询组织信息 | Roam、Obsidian 的部分本地工作流 | 传统页面写作、成熟企业多人协作 |
| Joplin | 笔记、待办、剪藏、E2EE 与自管同步 | Evernote、Simplenote、基础 Markdown 笔记 | 强结构化数据库和实时协作 |
| Anytype | 本地优先的对象、类型、关系与 P2P 同步 | Notion 的个人版、Obsidian 的对象化用法 | Notion 的完整数据库和 Confluence 的企业控制 |
| Zettlr | 研究者与作者的桌面 Markdown 写作台 | 学术写作、长文和引注工作流 | 云同步、多人协作、轻量随手记 |
| Bear | Apple 用户的极简 Markdown 写作 | Apple Notes、Ulysses 类写作体验 | 非 Apple 平台、多人工作区 |
| Roam Research | 网络化思考、每日笔记和块图 | Logseq、Obsidian 的大纲用法 | 开放文件导出、轻量协作和低价 |
| Capacities | 以对象、关系和时间线组织个人知识 | Notion 个人版、Obsidian 的关系型用法 | 大型团队治理和强权限需求 |
| Notion | 个人到企业的文档、数据库、AI 工作区 | Confluence、Coda、ClickUp Docs、Slite 的部分场景 | 纯本地、强离线文件归档 |
| Confluence | 企业级团队 Wiki 与 Atlassian 体系 | Notion Business/Enterprise、SharePoint | 个人 Zettelkasten、端到端加密个人库 |
| Coda | 文档与连接表融合、公式和自动化 | Notion、Airtable、轻量内部工具 | 企业 Wiki、纯个人写作 |
| ClickUp Docs | 项目管理套件中的文档层 | Notion、Confluence 的项目场景 | 独立知识库、低复杂写作 |
| Slite | AI 知识库、文档核验与搜索 | Notion AI、Confluence、企业知识搜索 | 结构化应用构建、本地文件归档 |
| Craft | 高质感跨端文档、任务、分享与写作 | Bear、Notion 的个人版、文档协作 | 开放文件和对象关系模型 |
| Recall | 网页、视频、PDF 与笔记的 AI 摘要和图谱 | Pocket/Readwise 类阅读库、AI 检索层 | 团队 Wiki、企业治理 |
| Mem | AI 自动组织与跨笔记聊天 | 搜索优先、低组织负担的个人知识库 | 强结构团队数据库、完整企业治理 |

这一分类的直接含义是：产品经理不应再问“Obsidian 的替代品是谁”，而应问“用户在替代哪个工作单元”。如果一个团队实际购买的是版本治理、权限体系和 AI 代理，Obsidian 并不能替代 Notion；如果一个研究者需要长期保存、引注和写作，Notion 也不能自然替代 Zettlr。产品定位决定了候选集，数据模型决定了迁移成本。

## Obsidian 的差异化来自文件自由，其代价是协作和治理需要用户自建

**Obsidian 的核心单位仍是用户控制的 Markdown 文件，这构成其最大护城河，也构成其协作上限。** 官方将核心定位为本地优先的 Markdown 知识库；同步、发布和支持属于可选付费项。核心应用免费，Sync 年付 4 美元/用户/月，采用端到端加密；Publish 年付 8 美元/站点/月；Catalyst 为一次性 25 美元，公开商业许可为 50 美元/用户/年。[1]

这种架构把数据所有权、版本管理、备份和退出权交给用户。标准 Markdown、YAML frontmatter、附件目录和 Wiki 链接共同构成开放表面。用户可以用任意编辑器打开文件，也可以通过 Git、Rsync、iCloud、Syncthing 等机制组织同步。相比完全托管型产品，Obsidian 退出时的损失主要是插件生成的结构、模板和自定义查询，而不是原始正文本身。

**插件生态把 Obsidian 从笔记应用变成可组装的个人工作系统，但维护成本也随之升高。** 社区插件覆盖 Dataview 类查询、Canvas、任务、卡片、模板、Excalidraw、AI 和学术引用等工作流。用户通过组合插件获得数据库视图、看板、重复记忆、项目管理和 AI 问答，不必等待官方统一产品。

这正是 Obsidian 相比 Notion、Confluence 等“集成平台”的结构性差异：平台通过产品团队统一功能，Obsidian 通过用户和插件组合系统。前者更稳定、更可采购，后者更灵活、更可演化。其代价是版本依赖、插件质量不一、升级风险、脚本安全和跨设备配置同步。如果关键流程高度依赖某个不再维护的社区插件，系统韧性会明显下降。

**Obsidian 的护城河不是双链，而是“开放文件、低门槛、插件组合和长期可用性”的飞轮。** 新用户可以从免费核心开始；有能力的用户用插件增加数据库、AI、绘图和项目管理能力；重度用户持续贡献模板、主题、教程和内容；生态扩大后又降低新用户的迁移成本。官方不通过限制核心功能获得收入，而是依靠可选同步、发布和自愿支持，这降低了个人用户的决策风险。

**Obsidian 的主要短板集中在多人协作、企业治理和托管 AI。** 官方 Sync 支持共享库和版本历史，但原生多人实时协作、细粒度行权限、企业身份和审计能力仍弱于 Notion、Confluence 和 Slite。官方安全文档明确说明，端到端加密只保护远程库，不会加密设备上的本地库；若用户忘记密码，官方无法恢复加密数据。[13]

由此，Obsidian 更适合个人长期知识、程序员配置和小型信任团队；对需要正式数据治理、跨部门权限和集中支持的企业，它更适合作为“个人思考层”，而不是唯一的企业知识源。强行在 Obsidian 中复刻 Notion 的数据库、看板和自动化，通常会导致插件债和培训成本上升，而不会形成同等稳定的协作平台。

## Logseq 是最接近 Obsidian 的直接挑战者，但胜在块级重组而非完整替代

**Logseq 与 Obsidian 都强调本地文件和知识关联，却选择了不同的最小思考单元。** Logseq 以块、每日日志、缩进大纲、块引用、PDF 批注和查询为核心；Obsidian 默认以页面、文件夹、属性和双链为中心，块级能力更多依赖插件或新版本功能。若用户先写子弹，随后通过缩进、块引用和查询重组，Logseq 更符合思维节奏；若用户先写页面并管理文件和文件夹，Obsidian 更自然。

官方定位将 Logseq 描述为隐私优先的开源知识库，免费个人使用、本地拥有数据，支持 iOS 与 Android、Markdown 文件、150 多个插件，以及 Beta 阶段的 Logseq Sync 加密文件同步。[2] 这使其能覆盖学生、学术用户、作者、项目经理和开发者，但官方并未把产品定义成成熟的企业协作套件。

**Logseq 的优势来自低摩擦捕获和块级复用，而不是面面俱到的块编辑器。** 每日笔记作为默认入口，适合会议、阅读和任务流；子弹天然成为可引用对象；PDF 批注可转化为链接笔记；查询能够动态汇总任务、引用和标签。对研究型大纲和渐进式写作，块级引用比复制内容更有价值。

相较之下，Obsidian 的页面文件更容易被普通编辑器和脚本处理，原始文件兼容性也更高。Logseq 的块引用增加表达力，但底层数据、查询语法和潜在的新存储格式也会增加长期维护成本。产品选择因此不是“谁的功能更多”，而是“用户能否长期接受块 ID、查询和潜在存储变更”。

**同步与性能仍是 Logseq 的相对风险。** 官方公开页确认了 Beta 同步，但公开访问条件、价格稳定性及企业支持不透明。历史公开口径约 5 美元/月，但该信息不能视为当前稳定报价。官方仍以 Markdown/Org 和开源作为核心承诺，若迁移时主要依赖块引用、查询和数据库结构，不能把导出 Markdown 等同于无损迁移。

Logseq 是从 Roam 式大纲走向开放文件的典型产品，但在实时协作、企业治理和复杂数据库方面，尚不能与 Notion、Confluence 相提并论。它最接近 Obsidian 的本地优先心智，却不能直接替代 Obsidian 的完整插件生态，也不能覆盖云端协作工作区。

## Joplin、Anytype、Zettlr 和 Bear 分别占据加密归档、对象知识、学术写作与极简写作

**四款本地优先产品并非彼此的完整替代品，分别解决了同步加密、语义结构、学术输出和写作心流问题。** Joplin 的核心价值是加密和自管同步，Anytype 是对象与 P2P，Zettlr 面向学术写作，Bear 强调 Apple 平台上的快速写作。

### Joplin：E2EE 与自管同步强，结构化与协作较弱

Joplin 把 E2EE、Joplin Cloud、Dropbox、OneDrive、Nextcloud、WebDAV/S3 等多种同步后端以及开源可扩展性置于核心位置，适用于笔记、待办、Web Clipper、PDF、图片、视频和跨平台使用。官方定位强调用户拥有开放格式数据，并支持扩展、主题和自定义编辑器。[3]

Joplin 适合重视端到端加密、历史归档和自托管的人，尤其接近 Evernote 式笔记本工作流。但它缺少 Notion 类关系数据库、实时协作和成熟的看板应用层。其同步是文件同步模型，而非 Confluence、Notion 式的实时协同；冲突处理、历史版本和附件管理都需要用户更主动地维护。公开历史口径下，Joplin Cloud Basic 约 2.99 欧元/月，自管同步可以免费，但真正的自管成本应计入服务器、备份和运维。

### Anytype：对象模型与 P2P 最强，但企业成熟度未经验证

Anytype 把页面、类型、关系和集合组织为对象系统，目标是通过本地优先、P2P 同步和零知识加密挑战 Notion 的中心化模型。官方定价资料显示，用户可拥有无限本地存储、P2P 同步、零知识加密和每个共享空间的无限查看者；Starter 提供 100MB 网络存储、3 个共享空间和每空间 3 名编辑者。Builder 年付 99 美元，提供 128GB 网络存储、每空间 10 名编辑者、个性化发布域名和优先支持；Co-Creator 为 299 美元/3 年；Business 为定制。[4]

Anytype 适合重视对象、关系、离线访问、加密和自托管的人。其对象模型比 Obsidian 文件夹和属性更统一，也比 Notion 的个人工作区更具隐私属性。但它仍未证明企业治理能力、规模性能和长期数据互操作。迁移时，应实际验证对象、类型、关系、附件、模板和共享权限能否完整导出或转化为标准格式，不能把“对象可以导出”理解为所有语义都无损保留。

### Zettlr：最像研究工作站，但不适合作为团队 Wiki

Zettlr 定位于研究者、记者和作者，强调 Markdown 文件、Zettelkasten、引注、参考文献库、Pandoc/LaTeX/TextBundle 导出，以及多语言桌面应用。它更接近研究工作站，而非全功能 PKM 或团队 Wiki。[6]

Zettlr 的优势是引注、导出和长期写作，而不是云端协作。它适合论文、报告和图书，并可与 Zotero、JabRef 等参考文献工作流结合。其开放文件和 GPL 属性降低了格式锁定风险，但没有大型商业云服务、SSO、细粒度团队权限或托管 AI。组织采购时还需注意，开源项目不等同于有 SLA、DPA 或企业支持，设备加密、备份和访问控制仍由组织自行负责。

### Bear：写作体验强，但 Apple 生态与封闭同步形成边界

Bear 定位为 Markdown 笔记、标签组织、图片和待办、PDF/图像 OCR、iCloud 同步，以及多格式导出。免费版支持本地访问和 TXT、Markdown、TextBundle、RTF、PDF、JPG、HTML、DOCX、ePub 导出；Pro 为 2.99 美元/月或 29.99 美元/年，支持 iCloud 同步、笔记锁定、28 个以上主题、15 个应用图标和 OCR。[5]

Bear 是最纯粹的 Apple 写作工具之一，适合作家、轻量笔记者和追求界面质量的人，但不是通用 PKM。它只覆盖 Apple 设备，依赖 iCloud 同步；缺少成熟插件市场、对象关系、团队空间和原生 AI 平台。其优势在于低维护，代价是跨平台和协作封闭性。对于需要 Windows、Linux 或 Android 的团队，Bear 不宜进入短名单。

## Roam 与 Capacities 分别代表块大纲和对象知识，但都不能同时替代 Obsidian 与 Notion

**Roam 的价值集中在块级大纲，Capacities 的价值集中在对象、关系和时间线；两者都解决了“结构化输入”，却未同时解决开放文件和团队治理。** 因此，它们可以作为部分工作流的直接替代，但不能成为 Obsidian、Notion 和企业 Wiki 的全量替代品。

### Roam Research：块引用仍不可替代，但成本与开放性构成约束

Roam 把自己定义为网络化思考工具，以每日笔记、双向链接、块引用、查询和图谱为核心。官方公开 Pro 为 15 美元/月或 165 美元/年，Believer 为 500 美元/5 年；历史公开信息还包括 31 天试用和 API/Apps。[7]

Roam 最直接替代的是“Roam 式块工作流”。块引用、日期页、大纲输入和关系图形成连贯心智模型，适合研究、写作和知识密集型工作。Obsidian 或 Logseq 能够复制部分功能，但若用户依赖稳定块 ID、块转写和自然的大纲重组，切换后的摩擦仍然明显。

Roam 的短板是成本、封闭云和持续创新预期。相比 Logseq，其数据不是本地开放文件；相比 Notion，其协作和结构化应用能力较弱；相比 Obsidian，插件规模小得多。因此，Roam 可以作为历史标杆和重度大纲用户的备选，却不应被包装成通用团队 Wiki。

### Capacities：对象与关系体验完整，但“个人优先”限制企业使用

Capacities 主张从每日笔记开始，把人物、会议、书籍、项目等内容创建为对象，再通过关系形成图谱。官方强调个人思维空间，而不是团队和企业膨胀，同时承诺完整标准格式导出。[8]

官方 Basic 永久免费，包括无限空间、对象、块、跨设备同步、无限自定义对象类型、导入导出、只读访问、全文搜索和离线支持。Pro 公开月付为 9.99 美元，年付约 8.33 美元/月，官方功能还包括 AI、查询、日历、任务和 API 等。Capacities 更适合创作者、研究者、学生和创始人。

Capacities 最直接替代的是 Notion 个人版和 Obsidian 的关系型用法。其对象模型减少“文件应该放在哪个文件夹”的决策负担，时间线和自动关联更接近个人第二大脑。但它不是大型团队治理工具，也不以端到端加密作为本地模型承诺。迁移时应测试对象、模板、关系、附件和任务能否完整往返，而不能只验证页面正文能否导出。

## 云端协作工作区已分化为 Wiki、文档应用、项目文档与知识维护四类

**Notion、Confluence、Coda、ClickUp Docs 和 Slite 都做团队知识，但控制的资源不同：Notion 控制工作空间，Confluence 控制企业 Wiki，Coda 控制文档应用，ClickUp 控制项目流程，Slite 控制知识质量和搜索。** 它们都能部分替代 Obsidian 的共享笔记功能，却不能替代本地文件的退出权和离线独立性。

### Notion：综合工作空间最强，但复杂数据库和 AI 成本上升

Notion 定位为个人与企业共同使用 AI 的工作空间，整合页面、块、数据库、团队空间、表单、项目和 AI Agent。免费个人层可用于页面、评论、基础数据库和发布；Plus 为 10 美元/用户/月，Business 为 20 美元/用户/月，Enterprise 为定制。[9]

Business 包含 SAML SSO、细粒度数据库行权限、私有团队空间、企业搜索和 AI 会议记录；Enterprise 包含 SCIM、审计、DLP/SIEM 连接和高级安全控制。Notion AI 官方承诺不将客户数据用于训练，采用 TLS 加密；Enterprise 使用零数据保留的 LLM 接口，并支持 HIPAA。[17]

Notion 最适合需要共同编辑、数据库、模板、自动化和 AI Agent 的 5 人以上团队。它直接替代 Confluence、Coda、ClickUp Docs 和 Slite 的部分工作，但会反向引入复杂权限、AI 成本和数据库性能风险。Notion 导出可以包含 Markdown、CSV 和 HTML，但关系、视图、按钮、公式、自动化和权限并非都能无损迁移。其云端离线下载也不等于完整本地工作副本。

### Confluence：企业治理最强，但产品重量和集成成本更高

Confluence 更适合已有 Atlassian 环境的企业。10 名用户以内免费；Standard 公开起始价为 5.42 美元/用户/月；Premium 为 10.44 美元/用户/月；Enterprise 按年定制。[10]

Standard 已包含页面、空间、模板、自动化、存储和 9/5 区域支持；Premium 增加管理洞察、无限白板、250 个自动化步骤/用户/月、无限存储、24/7 关键支持和 99.9% 正常运行时间 SLA；Enterprise 增加 SCIM、SSO、高级加密、150 个站点和 99.95% SLA。它最适合作为研发 Wiki、项目文档、政策库和合规知识库。

Confluence 的直接优势是 Jira 集成、组织级权限、审计和管理员控制，而不是个人第二大脑。对强监管企业，这些能力构成不可轻易替换的采购基础；对小企业，重量、复杂权限和迁移成本可能高于收益。Confluence 可以替代 Obsidian 的团队文档层，却不能替代本地 Markdown 长期档案。

### Coda：文档与连接表适合自动化，但公式学习曲线更陡

Coda 定位为文档、连接表、公式、自动化、Packs 和 AI 的组合。Free 层可用于协作文档、Docs AI、连接表、视图、表单、自动化和集成；Pro 为 12 美元/Doc Maker/月年付，Business 为 33 美元/Doc Maker/月年付；Editor 和 Viewer 免费。[11]

Coda 更适合运营、产品、项目和数据团队构建轻量内部工具、Tracker 和自动化报告。它直接替代 Notion 的结构化工作，也可替代 Airtable 的轻量应用；但普通文档协作的学习曲线高于 Notion，离线能力也不构成产品核心。

AI 和跨文档连接能力是 Coda 的差异化，但权限、公式、跨文档关系和自动化会增加迁移难度。组织应采购前定义“Doc Maker”数量，否则按创建者计费的优势可能被实际使用方式削弱。

### ClickUp Docs：项目工作流更完整，但通用写作并非重点

ClickUp 把 Docs 置于项目、任务、聊天、冲刺、时间追踪、白板、自动化和仪表板的工作套件中，公开 Free 层长期可用。[14] 因此，ClickUp 的直接替代对象是项目管理环境中的文档协作，而不是独立个人 PKM。

如果团队已经使用 ClickUp 管理项目和任务，把会议纪要、需求、决策记录和操作项留在同一套权限和自动化环境中具有明显价值。其风险是产品复杂度、通知过载和文档质量依赖组织规范。ClickUp Docs 能替代 Confluence 和 Notion 的一部分工作流，但不能简单替代它们作为独立企业知识库。

### Slite：知识质量和 AI 搜索更聚焦，但结构化应用能力有限

Slite 聚焦知识库维护、AI 搜索、文档核验、知识管理面板、Agent、API/MCP 和协作治理。Basic 为 10 美元/用户/月年付，Pro 为 20 美元/用户/月年付，Enterprise 为定制。[12]

Basic 包括无限文档、AI 搜索与回答、文档核验和 MCP/API；Pro 增加 Agent、连接工具搜索、文档事实核查、OpenID SSO、自定义域名和 50 个月度积分/席位；Enterprise 包括只读席位、SCIM、审计、SLA 和迁移支持。Slite 更适合需要文档所有者、核验周期、过期提醒、AI 问答和跨工具检索的知识管理员。

与 Notion、Confluence 相比，Slite 更聚焦知识质量与检索，而不是构建复杂应用。其公开页称拥有 3000 多家企业客户，但这一数字不能替代对具体迁移成本的验证。组织若核心痛点是知识过期、找不到文档和 AI 回答缺乏来源，应把 Slite 与 Notion Business、Confluence 和专用企业搜索并列评估。

![团队能力呈现云端与本地两极分化](https://raw.githubusercontent.com/riverzhou/rustmd/master/examples/assets/fig3-team-radar.png)

*图 3：协作、搜索/AI、开放性与生态的加权比较。数据来源：本报告基于官方功能资料的分析评分，非性能或市场份额。*

## AI 产品正在把竞争焦点从“保存笔记”转向“降低组织负担”

**Mem、Capacities 和 Recall 的共同方向，是用 AI 降低保存、分类、搜索和复用知识的成本。** 但三者解决的问题不同：Mem 强调自动组织，Capacities 强调对象与 AI 协同，Recall 强调跨内容源的阅读、摘要和图谱。

### Mem：低组织负担突出，但价格、状态和开放性需要重新核验

Mem 的历史定位是以 AI 自动标记、连接和检索笔记，减少用户决定文件夹和标签的负担。其核心假设是：当内容被充分向量化和语义索引后，手动分类的价值会下降。

但截至本报告时点，官方公开价格页无法稳定核验。历史二手资料曾出现 Pro 12 美元/月、14.99 美元/月或更高价格，以及 25 条笔记的免费额度，不同时间点的资料相互矛盾。因此，Mem 可以列入产品监测清单，却不应进入正式采购短名单，除非重新确认当前开放注册、价格、数据导出、模型提供方和停止服务政策。

Mem 的最大风险不是某一项功能不足，而是产品连续性。AI 知识库需要持续承担推理、索引和存储成本，若用户增长与收入不能匹配，低价额度可能调整，甚至服务方向发生变化。对组织而言，采购 AI 产品时必须同时检查数据导出和停止服务承诺，不能只看当前模型效果。

### Capacities：对象结构降低分类摩擦，但 AI 与治理仍不对称

Capacities 通过对象、关系和每日笔记降低手动组织成本，同时提供 AI 聊天、自动填充、查询和 API。相比 Mem，它更强调可验证的对象语义；相比 Notion，它更强调个人思维而不是企业协作。[8]

其结构使 AI 更容易理解项目、人物、来源和任务之间的关系，但这种优势依赖对象模型被持续使用。若团队只创建普通笔记而不维护类型与关系，AI 召回仍会接近普通向量搜索。Capacities 的短板是团队权限和企业治理尚未得到充分证明，因此适合个人与小型信任团队，不适合直接承担企业级知识库。

### Recall：阅读型 AI 层更清晰，但企业和价格透明度有限

Recall 强调保存文章、YouTube、播客、PDF 和笔记，再通过 AI 摘要、自动标签、图谱、聊天、空间重复和学习测验形成跨来源知识库。官方一个价格页给出免费层、10 美元/月年付的 Plus，以及 38 美元/月年付的 Max；免费层可以保存无限内容，但每月只有 10 次 AI 摘要。[15]

另一官方页面曾称 Recall 处于 early access，产品免费，并将在推出后让大多数用户继续免费；页面还称数据保存在 Recall 私有云，通过 OAuth 与 MCP 连接外部 AI。[16] 两种表述不能直接拼接为统一价格承诺，更适合解读为产品正在调整商业化路径。

Recall 适合研究者、学习者和个人内容策展，而不是企业 Wiki。它最接近“个人内容的语义索引层”，能替代一部分 Readwise/Read-it-later 与 AI 问答组合，却不能替代 Confluence 的治理。使用前应明确数据保存位置、模型选择、跨助手访问、API 定价和停止服务导出条款。

## Craft 的差异化是写作质量，而不是成为 Obsidian 的本地替代品

**Craft 将文档写作、排版、任务、跨端和分享置于中心，与 Obsidian 在部分功能上重叠，却不是开放文件系统的直接复制品。** 它适合创作者、顾问、学生、小团队和个人档案，而不是以 Git、纯文本和插件组合为优先的用户。

Craft 官方支持 macOS、iOS、Windows、Web 和 Android，跨平台离线，并提供 API、MCP 与自动化。[18] 官方帮助页列出 Starter 免费层：最多 1500 个内容块、1GB 空间、7 天版本历史、15 个 AI 积分和单用户使用；Plus 为 96 美元/年或 10 美元/月，提供无限文档、最多 5 个空间、每空间 1TB、每文件 5GB、30 天版本历史、50 个 AI 积分和自定义域名等；Team 为 600 美元/年，最多覆盖 10 名成员，共享空间最多 25 个，并提供 Plus 权益。[19]

Craft 的优势是排版、跨端体验和分享。对重视文档成品、设计质量和低维护的人，它比需要配置 Obsidian 主题、插件和同步更符合直觉。其 AI、任务、API/MCP 和协作能力也在扩展，但关系模型、插件规模、开放文件表达和高级查询仍不如 Obsidian。

迁移到或迁出 Craft 时，应测试 Markdown、附件、块、数据库和分享权限能否完整保留。文档成品和文件目录可能顺利迁移，但语义关系、任务状态和自动化不一定能够无损转移。对 Obsidian 用户而言，Craft 是“写作与分享替代品”；对 Notion 团队而言，它是“轻量文档替代品”；对隐私敏感用户而言，则不是完全本地、端到端加密的等价方案。

## 综合能力与迁移成本共同决定真实可替代性

**产品能力不能只看功能数量，迁移成本决定一个产品是否真的可以替代现有系统。** Markdown 文件只能保证正文可读，不能保证链接、元数据、插件结构、视图、权限和自动化无损。协作系统则相反：原始正文可能容易迁移，但关系、公式、权限和历史版本才是真正的锁定来源。

| 产品 | 知识关联 | 结构化/DB | 白板多媒体 | 搜索/AI | 协作权限 | 开放迁移 | 上手 | 性能口碑 |
|---|---|---|---|---|---|---|---|---|
| Obsidian | 强 | 中，插件强 | Canvas、插件 | 快；原生 AI 弱 | 弱至中 | 强，依赖插件 | 中高 | 大库可快，插件影响稳定性 |
| Logseq | 强，块优先 | 中强查询 | 白板 | 基础；AI 多插件 | 中，Beta | 中强，块语义难保真 | 中 | 大图与同步有风险 |
| Joplin | 中 | 弱至中 | 中 | 中 | 中，非实时 | 中强 | 低至中 | 稳定但移动端体验不一 |
| Anytype | 强对象关系 | 中强 | 中 | 中 | 中 | 中，对象语义需验证 | 中高 | P2P 同步稳定性需 PoC |
| Zettlr | 中 | 中，学术元数据 | 弱 | 中，文献检索强 | 弱 | 强，标准文件 | 低至中 | 桌面稳定 |
| Bear | 弱至中 | 弱 | 弱 | 弱 | 弱 | 中强，Apple 封闭同步 | 低 | 轻快 |
| Roam | 强，块图 | 中查询 | 弱 | 弱至中 | 中 | 中，云导出 | 中高 | 大图偶有性能顾虑 |
| Capacities | 强，对象关系 | 中强 | 中 | 中强 AI | 中 | 中强，完整导出承诺 | 中 | 云同步质量需实测 |
| Mem | AI 驱动 | 弱至中 | 弱 | 强语义搜索 | 弱至中 | 未稳定验证 | 低 | 历史有云速度争议 |
| Recall | AI 图谱 | 弱至中 | 弱 | 强摘要/检索 | 弱 | 中强 | 低 | 网络依赖，性能需实测 |
| Notion | 中强 | 强 | 中强 | 强 AI/Agent | 强 | 中，DB 视图难迁移 | 中 | 大库性能与离线需验证 |
| Confluence | 中 | 中 | 强白板 | 中强 AI 搜索 | 很强 | 中，Wiki 历史难保真 | 中高 | 企业稳定但复杂 |
| Coda | 中 | 很强 | 中 | 强，公式/AI/MCP | 强 | 中低，公式复杂 | 高 | 文档复杂时性能风险 |
| ClickUp Docs | 中 | 中强 | 强白板 | 强 AI/Agent | 强项目协作 | 中低 | 高 | 功能重，性能不一 |
| Slite | 中 | 中 | 中 | 很强知识搜索 | 强治理 | 中，知识维护优于格式锁定 | 低至中 | 团队场景稳定，需 PoC |
| Craft | 中 | 中 Collections | 中 | 中强 AI | 中强 | 中强 | 低 | 跨端体验较一致 |

### 迁移难度应按四层验证

| 迁移层次 | 可迁移内容 | 主要风险 | 验证重点 |
|---|---|---|---|
| 第一层 | 标题、正文、附件 | 格式差异、图片和文件丢失 | 导入后随机抽样比较 |
| 第二层 | Wiki 链接、双链、块引用 | 链接失效、块 ID 无法映射 | 关系图重建率、反链完整率 |
| 第三层 | 属性、数据库、模板、查询 | 关系、视图、公式和聚合丢失 | 关键视图能否重建 |
| 第四层 | 版本、权限、自动化、AI | 账号映射、权限继承和历史断裂 | 权限测试、审计演练、流程回放 |

Markdown 的开放表面只解决第一层问题。双链文件可以打开，不代表插件元数据、自定义查询和模板仍有效；云端数据库可以导出，也不代表关系、视图和权限能够重建。组织迁移应以真实空间进行四周试点，并分别记录导入成功率、链接恢复率、视图重建工时、权限覆盖率和用户返工率，而不是只检查“是否支持导入”。

## 场景推荐应围绕工作单元，而不是产品功能数量

**最优产品取决于知识的存储单元、共享边界和长期价值，而不是谁的功能列表更长。** 个人知识管理优先开放文件，学术工作优先引注和导出，团队优先协作与治理，AI 工作流优先来源和权限，隐私用户则必须在同步、备份和开放文件之间明确取舍。

### 个人知识管理：优先 Obsidian、Logseq 或 Capacities

个人知识管理优先考虑开放文件、关联和长期保存。Obsidian 在文件开放、插件和写作之间最均衡；Logseq 更适合大纲和每日笔记；Capacities 更适合对象和关系；Joplin 更适合重视 E2EE 的归档型用户；Bear 和 Craft 更适合追求低维护写作的人。

![个人知识管理适配评分](https://raw.githubusercontent.com/riverzhou/rustmd/master/examples/assets/fig1-adaptation-score.png)

*图 1：个人知识管理场景的加权决策分。数据来源：本报告基于官方功能资料的分析评分，5 分制。*

若用户的核心资产是“多年积累的 Markdown 与 PDF”，Obsidian 应优先测试；若核心是“每天先记录、随后重组”，Logseq 更适合；若希望减少文件夹和标签决策，Capacities 的对象模型更有吸引力。单纯追求“AI 自动整理”而不验证数据保留权，不应成为更换基础系统的唯一理由。

### 研究者与学术：Obsidian、Zettlr 和 Logseq 形成互补

研究者应优先测试 Obsidian、Zettlr 和 Logseq。Zettlr 在引注、参考文献、Pandoc/LaTeX 和长文导出方面更专门；Obsidian 更适合建立双链研究库，并可通过插件连接 Zotero 等工作流；Logseq 适合处理阅读摘录、每日笔记和块级引用。

对于需要 Word、PDF 或期刊排版的交付物，应优先验证引用风格、书目生成、附件链接和 PDF 批注。Obsidian 与 Zettlr 都不能仅凭“支持 Markdown”替代完整学术工作流。若研究者既需要文献管理又需要长期笔记，更合理的方式是明确主档案工具，而不是把多个应用配置成完全双向同步。

### 程序员：Obsidian 与 Anytype 各有优势，Craft 侧重写作

程序员优先选择 Obsidian、Anytype 和 Craft。Obsidian 的优势包括纯文本、Git、代码块、插件、本地文件和脚本能力；Anytype 适合管理对象化架构知识，但需验证 API、CLI 和导出；Craft 更适合设计、文档和技术写作。

对代码片段、配置、故障复盘和 API 笔记，Obsidian 与 Git 组合在可检索性和退出权方面优势明显。Anytype 的对象和关系模型适合描述服务、组件、负责人和文档之间的联系，但 CLI、批处理和自动化成熟度仍应实测。Craft 更适合面向人的技术写作，而不是作为代码和配置的主要归档层。

### 小团队：按知识单元选择，而不是统一更换

5—20 人的小团队不应默认统一使用 Obsidian。若核心是文档、任务、会议记录和共享数据库，Notion、Craft 或 Slite 通常比插件组合更高效；若核心是研发文档并与 Jira 绑定，Confluence 更合适；若核心是可复用内部工具，Coda 更有优势；若团队已有 ClickUp，Docs 的边际成本较低。

Obsidian 可以在小团队中用于个人或敏感资料，也可以作为少数信任用户之间的共享库，但不应承担全公司的细粒度权限。其低成本只体现在核心应用和可选官方同步，不包括备份、版本治理、故障支持、插件维护和用户培训。

### 企业知识库：Confluence、Notion、Coda 与 Slite 需联合评估

企业知识库必须分别评估身份、权限、数据驻留、审计、DLP、正常运行时间、迁移、支持和 AI 数据保留。Confluence 最适合 Atlassian 研发环境；Notion Business/Enterprise 最适合一体化工作空间；Coda 最适合文档应用；Slite 最适合知识质量和 AI 搜索。

企业不应把 Obsidian 作为唯一 Wiki，但可以允许其在受控边界内作为个人笔记工具。决策顺序应是“治理先行，再选内容模型”：先确定谁拥有页面、谁可以阅读、谁能导出、离职后如何处理，再决定采用 Wiki、文档数据库还是对象知识库。

### AI 工作流：Recall 和 Mem 适合个人，Notion、Coda、Slite 更适合企业

个人 AI 知识流可测试 Recall、Mem、Capacities 和带 AI 插件的 Obsidian；企业 AI 工作流应优先选择 Notion、Coda、Slite，以及具有正式 AI 治理、来源控制和审计能力的工具。

采购时必须确认五件事：索引数据范围、模型提供方、数据是否用于训练、企业层数据保留、删除和导出策略。Recall 和 Mem 更适合个人跨来源问答；Notion、Coda 和 Slite 更适合需要身份、权限和来源控制的组织 AI。AI 的准确率不是唯一指标，系统还必须证明回答来自正确版本、正确权限和最新知识。

### 隐私敏感用户：开放文件不是充分安全条件

隐私敏感用户必须在端到端加密、本地存储和开放文件之间明确选择。Joplin、Obsidian Sync E2EE、Anytype 和本地 Obsidian 更接近这一目标，但各有边界。

| 方案 | 隐私优势 | 主要边界 |
|---|---|---|
| Joplin | 开源、E2EE、支持自管同步 | 文件同步而非实时协作，冲突管理更复杂 |
| Obsidian 本地库 | 数据默认留在设备 | 本地库默认不加密，E2EE 只覆盖 Sync |
| Obsidian Sync E2EE | 远程库和通信加密 | 忘记密码无法恢复，本地文件仍需设备加密 |
| Anytype | 本地优先、零知识与 P2P | 企业成熟度、恢复机制和数据语义仍需验证 |

设备丢失、备份、共享链接和 AI 上传都可能形成新的暴露面。真正的安全设计应覆盖静态加密、传输加密、备份、密钥管理、账户恢复、删除流程和离职流程，而不是只判断“是否端到端加密”。

[场景决策矩阵下载](/data/workspace/dr:ce8897e6/数据_场景决策矩阵.csv)

## Obsidian 的护城河来自长期系统，竞争风险来自结构性替代

**Obsidian 最深的护城河不是双链、Canvas 或 2000 多个插件中的某一个，而是开放文件、低门槛、组合生态和长期可用性共同形成的系统价值。** Markdown 保证用户即使离开 Obsidian，仍可读取原始正文；插件生态使系统能够随用户技能增长；免费核心降低采用门槛；第三方同步和本地文件又减少厂商锁定的感知风险。

这种组合尤其适合研究者、程序员和长期知识管理者。它不是营销概念上的“第二大脑”，而是可以通过文件目录、frontmatter、脚本、Git 和插件进行工程化管理的个人系统。只要开放文件与插件组合仍具成本优势，Obsidian 就能持续保持对 Roam 式云端产品的吸引力。

**结构性替代有三种，而不是一款直接竞品。** 第一，Logseq 与 Anytype 通过开放、对象或 P2P 替代 Obsidian 的存储心智；第二，Notion、Craft、Coda、Confluence 和 Slite 通过托管协作、数据库、AI 和治理替代其团队价值；第三，Recall、Mem 和 Capacities 通过 AI 自动组织与检索，削弱手动双链的管理价值。

前两类替代分别针对文件模型和团队价值，第三类则直接挑战 Obsidian 的核心假设：如果 AI 能够自动生成关系、摘要和答案，用户是否仍愿意手动维护双链、模板、属性和插件。Obsidian 的回应是插件化 AI，但原生体验、模型治理和默认 AI 能力仍是短板。

**最危险的新进入者不会从“另一个 Markdown 编辑器”发起，而会从 AI 语义层、跨工具治理和企业数据生命周期发起。** 本地优先与 AI 并不矛盾。更有威胁的方向，是在设备本地保存原始文件，在用户同意下建立向量索引，把图谱、对象、来源和权限统一起来，并为个人、团队和企业提供不同的控制面。

Obsidian 的主要风险则在于插件碎片化、核心与第三方功能边界模糊、协作非原生，以及用户配置随时间形成隐性技术债。随着 AI 工具能够自动整理、总结和连接知识，手动维护双链和模板的边际收益可能下降。若 Obsidian 不能提高原生 AI、基础协作和默认安全体验，它可能被定位为“高级用户工具”，而非大众知识操作系统。

## 新产品应聚焦数据语义、可信 AI 与渐进式协作

**创业机会不在复制双链和块编辑器，而在把开放文件、对象语义、跨工具检索和可信 AI 合并为更可验证的系统。** 可行的产品方向应保留本地或用户控制的数据层，同时减少用户维护链接、标签、模板和数据库的成本。

### 机会一：开放文件、对象模型和双向语义层

新产品可以在本地保存开放 Markdown、附件和元数据，同时维护对象、关系和图谱索引。用户可以选择文件优先、对象优先或混合模式，并将对象与文件映射。退出时同时导出可读正文和标准结构化数据。

真正的差异化不是“也支持 Markdown”，而是让用户看到文件与对象如何对应、关系如何生成、哪些字段由 AI 推断、哪些字段由用户确认。相比只提供双链的应用，这种双向语义层能够同时保留开放文件的可读性和对象模型的检索能力。

### 机会二：本地优先的可审计 AI

AI 可以负责摘要、自动标记、链接建议、过期检测和跨来源问答，但必须展示来源、版本、置信度和处理位置。默认可采用本地嵌入或隐私模型，企业层可提供可配置模型与数据处理协议。

这类产品应让用户随时撤销 AI 写入、删除嵌入、查看索引范围并验证输出来源。与 Obsidian 插件拼装相比，统一 AI 权限、缓存、引用和模型治理可以降低非技术用户的使用成本；与纯云 AI 相比，开放文件与本地处理又能降低厂商锁定。

### 机会三：从个人系统渐进升级到小团队协作

个人用户可以独立使用，随后选择性邀请协作者。权限可以从“整库—文件夹—文档—块—对象”逐步升级，而不是直接要求用户迁移到重型企业平台。冲突解决应同时保留文件层、对象层和关系层的语义。

这种路径能够覆盖 Obsidian 最薄弱的个人到团队过渡，也可以避开 Confluence 和 Notion 对轻量用户而言过重的问题。关键是在不破坏本地离线体验的前提下增加协作，而不是要求用户先把数据迁移到云端。

### 机会四：跨工具知识索引

多数团队知识分散在本地笔记、Notion、Confluence、Google Drive、Slack、邮件和 Git 中。新产品可以作为只读、受权限控制的语义索引层，通过连接器、MCP 和连接器缓存，统一搜索与知识维护，而不是要求团队迁移所有内容。

Slite、Notion Enterprise Search 和 Recall 已在分别探索搜索、维护和跨助手记忆。这一方向的进入门槛是连接器质量、权限继承、版本处理和企业信任，而不是再次构建一个文档编辑器。

### 机会五：以知识健康度而非笔记数量作为核心指标

产品可以跟踪过期文档、未验证事实、无负责人页面、死链、重复笔记、未引用来源和知识复用率，并为团队提供维护建议。这直接解决企业知识库的核心失败：不是缺少一个编辑页面，而是旧内容不断累积、无人负责。

这一方向将产品从“内容容器”升级为“知识运营系统”。其价值也更接近企业预算：用户不仅购买存储和编辑功能，还购买内容可靠性、检索效率和治理可视性。

### 差异化优先级：先解决迁移与协作，再扩展 AI

| 优先级 | 产品能力 | 解决的问题 | 与现有产品的差异 |
|---|---|---|---|
| 1 | 完整迁移与恢复演练 | 关系、对象、权限和自动化无法导出 | 从文件迁移升级为语义与流程迁移 |
| 2 | 个人到小团队的渐进权限 | 本地系统直接跃迁到企业平台 | 保留离线，同时提供渐进治理 |
| 3 | 可验证 AI 与来源控制 | 黑箱回答和数据处理不透明 | 统一模型、索引、权限和引用 |
| 4 | 对象与文件双向映射 | 开放性与结构化难以兼得 | 原始正文与语义关系同时可导出 |
| 5 | 知识健康度运营 | 内容增长快于维护和复用 | 从存储量转向知识可用性 |

### 主要风险与反方判断

**开放文件不等于可用性。** 用户可以打开纯文本，却可能失去关系、查询、模板和附件映射。因此，迁移能力必须覆盖元数据、对象语义和自动化流程。

**本地优先不等于同步可靠。** P2P、文件冲突、离线编辑和附件复制都可能形成实际可用性风险。新产品必须提供可验证的恢复机制，而不是只声明“数据在本地”。

**AI 自动关联可能形成幻觉。** 自动链接和摘要若没有来源、版本和置信度，可能比手动整理产生更多错误。AI 功能越自动化，对验证机制和人工确认的要求越高。

**隐私产品的采用取决于密钥与恢复体验。** 端到端加密若导致忘记密码即无法恢复，会降低普通用户接受度；若提供托管恢复，又会削弱隐私承诺。产品必须在自主托管恢复与易用性之间明确取舍。

**生态无法在短期复制。** Obsidian 插件、主题、教程和内容社区共同降低采用成本。新工具若只复制功能，没有迁移工具、稳定 API、开发者激励和企业支持，很难形成持续飞轮。

**团队市场已被平台锁定。** Notion、Confluence 和 Microsoft 365 的优势来自既有工作流、身份体系、集成和采购关系。新产品不能依靠单点功能取胜，必须从治理、数据生命周期或跨工具知识图谱切入。

因此，更现实的策略不是挑战所有类别，而是先成为某一类知识的权威层。个人市场可以从开放文件和 AI 语义切入；团队市场可以从跨工具搜索和知识质量切入；企业市场则必须先解决身份、权限、审计和采购。

## 最终判断：真正的胜负手是退出权、组织复用与 AI 信任

Obsidian 最值得创业者学习的地方，不是插件数量，而是把不可逆资产交给用户：文件可读、同步可选、核心能力免费、用户能够逐步定制。其商业模式与产品哲学一致，这使它在个人知识管理领域具备长期稳定性。

但 Obsidian 并非所有知识场景的默认答案。它最适合重视开放文件、长期保存、离线访问和高度自定义的个人与专业用户。Logseq 直接挑战其大纲与本地模型，Anytype 挑战其对象与加密同步模型，Notion 挑战其文档协作，Craft 挑战其写作体验，Confluence 挑战其企业治理，Slite 挑战其 AI 知识维护。它们替代的是不同工作单元，而不是整个 Obsidian。

对产品经理而言，产品决策应分为四步：

1. **先判断数据模型。** 文件、块、对象、页面或语义记录，哪一种最贴近用户的思考和工作单元。
2. **再判断存储与退出权。** 数据是否可以下载、原始正文是否可读、语义和权限能否迁移。
3. **随后判断协作边界。** 是个人、小团队、跨部门还是企业，以及需要哪些身份、权限和审计控制。
4. **最后判断 AI 价值。** AI 能否生成来源、处理版本、尊重权限，并在停止使用时完整删除或导出。

组织 PoC 不应只测试“能否创建页面”。最低验收范围应包括 1000 条以上真实笔记、1000 条 PDF/网页链接、100 个数据库行、10 个协作者、离线冲突、移动端、导出恢复、AI 问答、权限变更和停用恢复。只有这些环节同时成立，一个产品才真正具备替换资格。

竞争格局因此没有单一赢家：Obsidian 赢得个人系统，Notion 与 Coda 赢得可组合协作，Confluence 赢得企业治理，Slite 赢得知识质量和检索，Recall 与 Mem 赢得低摩擦 AI 捕获，Craft、Zettlr 与 Bear 赢得写作心流。未来胜出的产品，最可能同时满足“文件可带走、知识可连接、团队可治理、AI 可验证”四项要求。

## 数据来源

[1] https://obsidian.md/zh/pricing
> “Free without limits… Sync $4 USD Per user, per month, billed annually… Publish $8 USD Per site, per month, billed annually.”

[2] https://logseq.com/
> “Designed to store your interests, questions, ideas, favorite quotes, reminders, reading and meeting notes easily and future-proof: Open source Free forever for personal use Privacy first You own your data locally forever.”

[3] http://joplinapp.org/fr
> “L’application est open source et vos notes sont enregistrées dans un format ouvert… Elle utilise le chiffrement de bout en bout (E2EE) pour sécuriser vos notes.”

[4] https://doc.anytype.io/anytype-docs/miscellaneous?fallback=true
> “All Members have unrestricted access to the following: Unlimited local storage; P2P synchronization; Zero-knowledge encryption.”

[5] https://bear.app/faq/features-and-price-of-bear-pro
> “Bear Pro unlocks: iCloud sync for all your notes and TagCons across all devices… Encrypt individual notes and lock Bear.”

[6] https://opensourcetools.org/tools/zettlr
> “Zettlr Markdown publication workbench for researchers, journalists, and writers with citations and Pandoc exports.”

[7] https://roamresearch.com/
> “A note-taking tool for networked thought… Pro $15 / month… $165 / year… Unlimited Private or Public Roam Graphs Unlimited Collaborators API access and Apps.”

[8] https://capacities.io/
> “Export everything. Always. Your notes are yours. Full export to standard formats. No lock-in. Ever.”

[9] https://www.notion.com/pricing
> “Plus $10 per member / month… Business Recommended $20 per member / month… Enterprise Custom pricing.”

[10] https://www.atlassian.com/software/confluence/pricing
> “Free forever for 10 users… Standard… $5.42 per user / month… Premium… $10.44 per user / month.”

[11] https://coda.io/pricing
> “Free… Pro $12 USD / month per Doc Maker, billed annually… Business $33 USD / month per Doc Maker, billed annually.”

[12] https://slite.com/pricing
> “Basic… $10 per user/month Billed yearly… Pro… $20 per user/month Billed yearly… Enterprise… Custom pricing.”

[13] https://obsidian.md/help/Security+and+privacy
> “Obsidian Sync encrypts your remote vault and all communication with Obsidian's servers… Your choice only affects your remote vault. Obsidian doesn't encrypt your local vault.”

[14] https://clickup.com/#features
> “It's FREE Free forever. No credit card. Projects Brain Agents Chat Sprints Time Tracking Calendar Docs Whiteboards Automations Dashboards and more.”

[15] https://getrecall.ai/pricing
> “Free… Plus $10 per month, billed yearly… Max $38 per month, billed yearly.”

[16] https://recallnotes.io/
> “Recall runs as an MCP server… Your data lives securely in your Recall account, and you decide exactly what gets saved or cleared.”

[17] https://notion.so/en-gb/product/ai
> “No training on your data… SOC 2 Type 2 & ISO 27001… Zero data retention for Enterprise.”

[18] https://support.craft.do/en/introduction/platforms
> “Craft is available on macOS, iOS, Windows, Web app, and Android… Craft works offline across all platforms.”

[19] https://support.craft.do/en/account-and-subscription/subscription-plans/plans-and-pricing
> “Starter Plan (Free)… up to 1,500 content blocks… Plus Plan… $96 annually or $10 monthly… Team… $600 annually or $60 monthly.”

[20] https://unil.ink/blog/notion-alternatives-2026
> “Best for Personal Knowledge Obsidian — personal use forever free. Anytype — open source, P2P. Best for teams: Coda for formulas, ClickUp for PM, Confluence for enterprise.”

[21] https://www.cloudyunicorn.com/review/obsidian
> “Obsidian is a markdown-first, local-first knowledge base… Notes live as plain-text .md files… Data never leaves the machine unless Sync or Publish are enabled.”

[22] https://www.notion.com/zh-cn
> “让团队和代理在这里共同思考。借助为你的团队打造的 AI，获取背景信息、查找答案，并自动执行任务。”

[23] https://support.craft.do/zh-Hans/account-and-subscription/subscription-plans/plans-and-pricing
> “Starter 方案（免费）…最多 1,500 个内容块…Plus 方案…每年 $96 或每月 $10…Team 方案…每年 $600 或每月 $60。”

[24] https://versustool.com/tool/obsidian
> “Free local-first Markdown notes app… Community plugins & themes… Local Markdown vaults… Plugin ecosystem.”

[25] https://www.aipedia.wiki/tools/logseq/
> “Core app free under AGPL-3.0… Local-first by default: files live in a folder you control.”

[26] https://opensourcedrop.com/tools/laurent22/joplin
> “The Open Source Drop… Markdown-native note-taking with notebooks, tags, to-dos, and a web clipper.”

[27] https://doc.anytype.io/anytype-docs/miscellaneous
> “Memberships are designed to reflect the same core principles… unrestricted access to our software and an open ecosystem.”

[28] https://handwiki.org/wiki/Software:Zettlr
> “Zettlr… free and open-source note-taking application that works with Markdown files.”

[29] https://bear.app/zh/index.html
> “免费版…PRO…7天免费试用，之后 $2.99 /月… $29.99 /年。”

[30] https://logseq.com/
> “Logseq Sync BETA Always up-to-date notes between all your devices. With encrypted file syncing…”

[31] https://frontdeskreview.com/software/note-taking-apps/roam-research
> “Roam Research starts at $15/mo… Pro… $165/year… Believer… $500 / 5 years.”

[32] https://www.opentechhub.io/zettlr
> “Zettlr is a free, open-source writing and knowledge tool for the desktop, aimed at researchers and long-form authors.”

[33] https://toolchase.com/tool/logseq/
> “Local markdown files… Block References… Whiteboards… Strong community… 30+ Themes.”

[34] https://toolchase.com/tool/anytype
> “Anytype is local-first and end-to-end encrypted… built by the Anytype Foundation, a non-profit organization.”

[35] https://europeanstack.com/software/joplin
> “Open-source note-taking and to-do app with end-to-end encryption.”

[36] https://capacities.io/pricing
> “Capacities Basic… Free… Capacities Pro… $8.33/month billed annually.”

[37] https://capacities.io/pricing?utm_campaign=review_platform&utm_medium=referral&utm_source=app.softwarehope.com
> “The core product of Capacities is and will remain free.”

[38] https://tooliverse.ai/tools/capacities
> “Capacities Basic Unlimited spaces, objects, and blocks… Capacities Pro $9.99/mo.”

[39] https://www.atlasworkspace.ai/blog/obsidian-vs-roam-research
> “Storage and Portability… Obsidian stores notes as plain-text Markdown files… Roam is a cloud-first database.”

[40] https://toolchase.com/tool/mem-ai
> “Mem.ai… cloud-only so no offline AI.”

[41] https://aisotools.com/blog/mem-ai-review-2026
> “Mem.ai… offline access and local storage are not first-class features.”

[42] https://toolchase.com/tool/mem-ai
> “Mem… Official… macOS, Windows, and iOS apps… API access for power users and integrations.”

[43] https://www.usecarly.com/blog/confluence-pricing/
> “Confluence… Free at $0 for up to 10 users, Standard at $5.42 per user/month, Premium at $10.44 per user/month.”

[44] https://saascrmreview.com/?p=4555/
> “Identity and governance by plan… Notion places SAML SSO on Business and above… SCIM provisioning to Enterprise.”

[45] https://theaiagentindex.com/agents/coda-ai
> “Superhuman Docs is the docs-and-tables workspace formerly called Coda, now part of Superhuman.”

[46] https://trackstack.tech/?p=524
> “Nuclino is pages with text, images, and embeds — no databases, formulas, rollups, or relations.”

[47] https://jakeinsight.com/buying-guide/2026-07-05-notion-ai-obsidian-non-techies-2026
> “Use Notion AI if: you need real-time collaboration, want AI that works without configuration.”

[48] https://sotasync.com/reader/2026-05-13-obsidian-plugins-future-community
> “Obsidian 正式发布 Obsidian Community 社区平台和开发者仪表盘。”

[49] https://tech-insider.org/obsidian-vs-notion-2026/
> “Obsidian gives you unlimited local storage, full offline access, and 1,400+ plugins at no cost.”

[50] https://versustool.com/notion-vs-obsidian
> “Notion performance cliff: Big databases with many properties, relations, and rollups get sluggish.”

[51] https://www.aipedia.wiki/tools/logseq/
> “System Verdict… teams should watch DB-version mobile parity, markdown round-trip maturity, sync access, and collaboration limits.”
