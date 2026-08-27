# LittleNuB 个人网站

曹弘霖 / LittleNuB 的个人网站。这里展示 AI 产品项目，也放了一些能试玩的小玩具。

首页使用原生 HTML、CSS 和 JavaScript，保留 Internet Playground 的配色与窗口设计。

## 在另一台机器上打开

仓库为 `LittleNuB/personal-web`，默认分支沿用 `master`。私有仓库需要先用有访问权限的 GitHub 账号登录。

```powershell
gh repo clone LittleNuB/personal-web
cd personal-web
python -m http.server 4173 --bind 127.0.0.1
```

然后打开 `http://127.0.0.1:4173/`。预览和修改首页只需要 Python，无需安装前端依赖。简历下载文件和选定头像都在仓库中。

## 准备站内试玩页

`zhiyin/` 和 `body-inc/` 是本地生成目录，不随 Git 克隆。刚克隆的首页仍可预览，但这两个试玩入口需要准备完成后才能打开。

拿到两份源仓库后，按 [PLAYABLE_ROUTES.md](PLAYABLE_ROUTES.md) 中记录的固定提交检出，再运行下面的脚本。知音还需要 Node.js/npm 和对应的前端依赖。

```powershell
.\scripts\Prepare-PlayableRoutes.ps1 `
  -ZhiyinSourceRoot "<知音仓库路径>" `
  -BodyIncSourceRoot "<Body Inc. 仓库路径>"
```

脚本会核对源仓库提交及相关文件状态，再重新生成两个目录。不要在生成目录中手改源码，调整网站入口请修改 `scripts/playables/` 中的模板。

Body Inc. 的固定提交 `4cae0dac9c2b4a9f470f95a3285d3be9451b723b` 在本次同步前尚不能从源项目 GitHub 获取。另一台主机需要先由站主提供这份源码，或另行确认同步该源提交。准备脚本会拒绝使用别的版本，不会自动换成较旧的公开分支。

Momentum Planet 目前链接外部试玩地址，没有迁入本站。

## 让另一台主机上的 Codex 接着改

先读根目录 `AGENTS.md`，再检查当前分支与工作区。工作区干净时可以用 `git pull --ff-only` 同步；若有未提交修改或分支分叉，先保留现场，不重置或强推。

主要文件是 `index.html`、`styles.css` 和 `app.js`。中文保持短句、口语化，不增加没有事实依据的功能或成绩。可见改动至少检查桌面和手机布局，提交时只暂存本轮相关文件。

GitHub 同步不等于发布网站。ECS 上传、Nginx、DNS、HTTPS、备案和安全组仍须逐项获得用户确认。不要从旧机器复制凭证、私钥或浏览器登录状态。

## 当前页面结构

- Hero：曹弘霖的 AI 创作工作台与四个快速入口
- Selected Work：TrainPal、AI Job Copilot、Bili-Bill、LY-LLM Wiki
- Toy Shelf：可试玩原型与仍在制作中的小玩具
- About：简短的创作动机与 GitHub 入口

## 可试玩子页面

- `/zhiyin/`：知音本地模拟 Demo。使用本地 React 状态与模拟素材，不调用真实 AI、提醒或外部服务。
- `/body-inc/`：Body Inc. 90 秒可玩实验。规则与结果保持本地确定性；静态站点使用本地预案，不包含 AI 密钥或服务端代理。

两个子页面都提供返回首页 Toy Shelf 的入口。留言能力和云端接口尚未加入。
