# 部署流程（Docker）

架构：**Nginx** 对外 `:80` 提供静态前端 + 反代 `/api` → **Go API**（内网 `:8080`）；**SQLite** 持久化在命名卷 `composer_data`。

## 服务器准备（Ubuntu）

1. 安装 Docker 与 Compose 插件（[官方文档](https://docs.docker.com/engine/install/ubuntu/)）。
2. **权限**：非 root 用户若出现 `permission denied` 访问 `/var/run/docker.sock`，任选其一：
   - **推荐**：把当前用户加入 `docker` 组后重新登录 SSH（或执行 `newgrp docker`）：
     ```bash
     sudo usermod -aG docker "$USER"
     newgrp docker   # 或退出 SSH 再连一次
     docker ps       # 应不再报错
     ```
   - **临时**：所有 `docker` / `docker compose` / `deploy.sh` 前加 `sudo`，例如 `sudo bash configurable/deploy/deploy.sh up -d --build`。
3. 安全组 / 防火墙放行 **TCP 80**（HTTPS 时再开 443）。
4. 仓库放到服务器，例如：`~/music`（需包含 `src/`、`public/`、`configurable/`，与本地一致）。

## 一键从本机部署（推荐）

在**仓库根** `music/`：

```bash
cp configurable/deploy/.env.deploy.example configurable/deploy/.env.deploy
# 编辑 .env.deploy：至少填 DEPLOY_HOST，DEPLOY_PATH 建议用绝对路径如 /home/ubuntu/music
bash configurable/deploy/push-deploy.sh
```

脚本会做：`rsync` 同步代码（排除 `node_modules`、`release`、`electron`、`.git`、本地 `*.db` 等）→ SSH 远端执行 `deploy.sh up -d --build`。

可选：在 `.env.deploy` 里设 `DEPLOY_RSYNC_DELETE=1` 启用 `rsync --delete`（会按本地目录裁剪远端同名目录内多余文件，**慎用**）。

---

## 首次 / 更新部署（仅服务器上操作）

在**仓库根目录** `music/` 执行：

```bash
docker compose -f configurable/deploy/docker-compose.yml up -d --build
```

或使用脚本（等价）：

```bash
bash configurable/deploy/deploy.sh up -d --build
```

访问：`http://<服务器公网IP>/`（例：`http://124.222.39.165/`）。

## 环境变量（可选）

在 `configurable/deploy/` 下创建 `.env`：

```env
HTTP_PORT=80
# 仅当前后端与前端不同域时需要，同源可不设
# CORS_ORIGIN=http://124.222.39.165
```

## 常用命令

```bash
# 查看日志
docker compose -f configurable/deploy/docker-compose.yml logs -f

# 停止
docker compose -f configurable/deploy/docker-compose.yml down

# 仅停服务保留数据卷
docker compose -f configurable/deploy/docker-compose.yml stop
```

## 数据备份

数据库文件在卷 `composer_data` 内（容器内路径 `/data/pieces.db`）：

```bash
docker run --rm -v composer-config_composer_data:/data -v $(pwd):/backup alpine \
  cp /data/pieces.db /backup/pieces-backup.db
```

（卷名前缀以 `docker volume ls` 为准，一般为 `<项目目录名>_composer_data`。）

## 从本机推送到服务器（手动，等价于 push-deploy.sh）

```bash
rsync -avz --exclude node_modules --exclude .git --exclude release --exclude electron \
  ./ ubuntu@124.222.39.165:~/music/
ssh ubuntu@124.222.39.165 'cd /home/ubuntu/music && bash configurable/deploy/deploy.sh up -d --build'
```

（已加入 `docker` 组则不需要 `sudo`。优先用上一节 **`push-deploy.sh`**。）

### 构建「像卡住」时

1. **不要用 `ssh ... | tail -80`**：`tail` 会等整条命令结束才输出，构建十几分钟期间**屏幕可能一直空白**，看起来像死机。应直接看完整日志，或去掉管道。
2. **首次构建很慢**：拉基础镜像、`apt`、`npm ci`、`go mod download` 在弱网下各需数分钟属正常。
3. **推荐在服务器上用 tmux 跑**（断线不中断构建）：

```bash
ssh ubuntu@124.222.39.165
sudo apt-get install -y tmux   # 若未安装
tmux new -s build
cd ~/music && sudo docker compose -f configurable/deploy/docker-compose.yml up -d --build
# Ctrl+B D 脱离；tmux attach -t build 再连上
```

4. 国内已配置：`Dockerfile.api` 使用 `GOPROXY=https://goproxy.cn`；`Dockerfile.web` 使用 `npmmirror` 的 npm 源；宿主机 Docker 已加 `mirror.ccs.tencentyun.com` 加速拉镜像。

## HTTPS（后续）

在宿主机或独立容器使用 Caddy / certbot + Nginx，前端反代与证书终止按惯例配置即可。
