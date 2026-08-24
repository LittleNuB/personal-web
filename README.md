# LittleNuB 个人网站

当前视觉方向已经确定为 **Internet Playground**：年轻、外向、有活人感，同时允许玩具式原型与严肃作品共存。

## 一条命令启动

```powershell
python -m http.server 4173
```

然后打开 `http://localhost:4173/`。

## 当前页面结构

- Hero：曹弘霖的 AI 创作工作台与四个快速入口
- Selected Work：三个较严肃的公开项目
- Toy Shelf：可试玩原型与仍在制作中的小玩具
- About：简短的创作动机与 GitHub 入口

## 可试玩子页面

- `/zhiyin/`：知音本地模拟 Demo。使用本地 React 状态与模拟素材，不调用真实 AI、提醒或外部服务。
- `/body-inc/`：Body Inc. 90 秒可玩实验。规则与结果保持本地确定性；静态站点使用本地预案，不包含 AI 密钥或服务端代理。

两个子页面都提供返回首页 Toy Shelf 的入口。留言能力和云端接口尚未加入。
