#!/bin/bash
# =============================================================================
# deploy.sh — 本地一键部署前端到 Vultr Ubuntu 服务器
#
# 使用方法：在本地 Git Bash / MINGW64 终端运行
#   bash deploy.sh
#
# 认证方式（自动优先顺序）：
#   1. SSH 密钥免密码登录（推荐，首次运行自动配置）
#   2. 交互式输入密码（密钥未配置时fallback）
# =============================================================================

# ============================== 配置区（修改这里） ==============================
SERVER_IP="45.32.51.77"
SERVER_USER="root"
SERVER_PORT="22"
SERVER_PASSWORD=""                   # 留空，或填入密码（填了优先用密码认证）
LOCAL_PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ============================== 颜色定义 =====================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ============================== 日志函数 =====================================
log_info()    { echo -e "${CYAN}[INFO]${NC}    $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}     $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    {
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════${NC}"
    echo -e "${BOLD}  $1${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════${NC}"
}

# ============================== 工具检测 =====================================
has_command() { command -v "$1" &> /dev/null; }

# ============================== SSH 连接辅助 =================================
# 自动选择认证方式：优先 sshpass（密码），无则用 SSH 密钥
_use_password_auth() {
    # 如果有 sshpass，直接用
    has_command sshpass && return 0
    # 否则必须用密钥
    return 1
}

_ssh_cmd() {
    local cmd="$1"; shift
    if _use_password_auth; then
        sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
            -o ConnectTimeout=10 "$@" "$cmd"
    else
        ssh -o StrictHostKeyChecking=no \
            -o ConnectTimeout=10 "$@" "$cmd"
    fi
}

_scp_cmd() {
    if _use_password_auth; then
        sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no "$@"
    else
        scp -o StrictHostKeyChecking=no "$@"
    fi
}

# ============================== 步骤 0：检测连通性 ==========================
step0_check_connectivity() {
    log_step "步骤 0/5 — 检测服务器连通性"

    log_info "正在 Ping $SERVER_IP ..."
    if has_command ping; then
        if PING_OUT=$(ping -c 3 "$SERVER_IP" 2>&1); then
            PING_RC=$?
        elif PING_OUT=$(ping -n 3 "$SERVER_IP" 2>&1); then
            PING_RC=$?
        else
            PING_RC=1
        fi
        PING_GOOD=0
        if echo "$PING_OUT" | grep -qE "ms TTL="; then
            PING_GOOD=1
        elif echo "$PING_OUT" | grep -qE "icmp_seq="; then
            PING_GOOD=1
        fi
        if [[ $PING_RC -eq 0 ]] || [[ $PING_GOOD -eq 1 ]]; then
            log_success "服务器在线！"
        else
            log_error "无法 Ping 通服务器，请检查："
            echo -e "  ${RED}→${NC}  服务器是否已开机（Vultr 后台查看状态）"
            echo -e "  ${RED}→${NC}  防火墙是否放行了 ICMP"
            exit 1
        fi
    fi

    log_info "检测 SSH 端口 $SERVER_IP:$SERVER_PORT 是否开放 ..."
    if has_command nc; then
        if nc -z -w 5 "$SERVER_IP" "$SERVER_PORT" 2>/dev/null; then
            log_success "SSH 端口开放！"
        else
            log_error "SSH 端口无法连接，请检查："
            echo -e "  ${RED}→${NC}  Vultr 后台 → Firewall，开放 TCP 22 端口"
            exit 1
        fi
    else
        log_warn "未检测到 nc 命令，跳过端口检测"
    fi
}

# ============================== SSH 密钥设置 ==================================
setup_ssh_key() {
    log_step "设置 SSH 公钥免密码登录"

    local SSH_KEY="$HOME/.ssh/id_ed25519"
    local SSH_PUB="${SSH_KEY}.pub"

    # 生成密钥（如果不存在）
    if [[ ! -f "$SSH_KEY" ]]; then
        log_info "生成 SSH 密钥 ($SSH_KEY) ..."
        ssh-keygen -t ed25519 -C "deploy@localhost" -f "$SSH_KEY" -N ""
        log_success "密钥已生成"
    else
        log_info "SSH 密钥已存在: $SSH_KEY"
    fi

    # 复制公钥到服务器
    local PUB_KEY
    PUB_KEY=$(cat "$SSH_PUB" 2>/dev/null)
    if [[ -z "$PUB_KEY" ]]; then
        log_error "无法读取公钥文件: $SSH_PUB"
        exit 1
    fi

    # 方法1：直接用 ssh-copy-id（最简单）
    if has_command ssh-copy-id; then
        log_info "使用 ssh-copy-id 复制公钥到服务器 ..."
        if [[ -n "$SERVER_PASSWORD" ]]; then
            SSH_ASKPASS_REQUIRE=never ssh-copy-id -o StrictHostKeyChecking=no \
                -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" 2>/dev/null
        else
            echo -e "${YELLOW}请输入服务器密码来完成公钥复制（输入时无回显）：${NC}"
            ssh-copy-id -o StrictHostKeyChecking=no \
                -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}"
        fi
        if _test_key_auth; then
            log_success "SSH 公钥已配置，可免密码登录！"
            return 0
        fi
    fi

    # 方法2：手动通过 SSH 命令复制（ssh-copy-id 失败时的后备）
    log_info "通过 SSH 命令手动配置公钥 ..."
    if [[ -z "$SERVER_PASSWORD" ]]; then
        echo -e "${YELLOW}请输入服务器密码（用于复制公钥，输入时无回显）：${NC}"
        read -rsp "  密码: " SERVER_PASSWORD
        echo ""
    fi

    if has_command sshpass; then
        sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
            -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" \
            "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${PUB_KEY}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'done'" 2>/dev/null
    else
        # 用 ssh with StrictHostKeyChecking=no + expect-like workaround
        # 通过 ssh 交互式输入密码
        log_error "无 sshpass 且无法自动复制公钥，请手动执行："
        echo ""
        echo -e "  ${CYAN}复制以下公钥，粘贴到服务器 ~/.ssh/authorized_keys：${NC}"
        echo -e "  ${GREEN}${PUB_KEY}${NC}"
        echo ""
        read -rp "  按回车继续 ..."
    fi

    if _test_key_auth; then
        log_success "SSH 公钥已配置成功！"
    else
        log_error "公钥配置失败，请手动配置后重试"
        exit 1
    fi
}

_test_key_auth() {
    ssh -o StrictHostKeyChecking=no \
        -o ConnectTimeout=10 \
        -o BatchMode=yes \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" \
        "echo 'KEY_AUTH_OK'" 2>/dev/null | grep -q "KEY_AUTH_OK"
}

# ============================== 测试 SSH 连接 ===============================
test_ssh_connection() {
    log_info "测试 SSH 连接 ..."
    if _test_key_auth; then
        log_success "SSH 连接成功（公钥认证）！"
        return 0
    fi
    if [[ -n "$SERVER_PASSWORD" ]] && has_command sshpass; then
        if sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
            -o ConnectTimeout=10 -o BatchMode=yes \
            -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" \
            "echo 'PASSWORD_AUTH_OK'" 2>/dev/null | grep -q "PASSWORD_AUTH_OK"; then
            log_success "SSH 连接成功（密码认证）！"
            return 0
        fi
    fi
    log_error "SSH 连接失败！"
    echo -e "  ${RED}→${NC}  建议运行脚本设置 SSH 公钥免密码登录"
    echo -e "  ${RED}→${NC}  或者在脚本顶部填入 SERVER_PASSWORD 后重试"
    exit 1
}

# ============================== 步骤 1：更新系统 + 安装 Nginx ============
step1_prepare_server() {
    log_step "步骤 1/5 — 服务器环境准备（更新系统 + 安装 Nginx）"

    log_info "更新软件包列表 ..."
    _ssh_cmd "apt-get update -qq 2>/dev/null || apt-get update" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}"
    log_success "软件包更新完成"

    log_info "安装 Nginx ..."
    _ssh_cmd "apt-get install -y nginx 2>/dev/null || apt-get install -y nginx" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}"
    log_success "Nginx 安装完成"
}

# ============================== 步骤 2：配置 Nginx =========================
step2_configure_nginx() {
    log_step "步骤 2/5 — 配置 Nginx"

    log_info "上传 Nginx 配置文件 ..."
    NGINX_CONFIG_TMP="/tmp/nginx_site_config_$$.conf"
    cat > "$NGINX_CONFIG_TMP" << 'NGINXCONF'
server {
    listen 80;
    listen [::]:80;
    server_name _;

    root /var/www/html;
    index index.html index.htm;

    charset utf-8;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location /contracts {
        deny all;
    }
}
NGINXCONF

    _scp_cmd -P "$SERVER_PORT" "$NGINX_CONFIG_TMP" \
        "${SERVER_USER}@${SERVER_IP}:/tmp/nginx_site_config.conf"
    rm -f "$NGINX_CONFIG_TMP"

    log_info "服务器端应用 Nginx 配置 ..."
    _ssh_cmd "cp /tmp/nginx_site_config.conf /etc/nginx/sites-available/default && \
        rm -f /tmp/nginx_site_config.conf && \
        nginx -t && \
        systemctl restart nginx && \
        systemctl enable nginx && \
        echo 'Nginx 配置完成'" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}"

    log_success "Nginx 配置并启动完成"

    log_info "开放防火墙 80 端口（HTTP）..."
    _ssh_cmd "ufw allow 80/tcp && ufw reload && echo 'FIREWALL_OK'" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" | grep -q "FIREWALL_OK"
    log_success "防火墙 80 端口已开放"
}

# ============================== 步骤 3：上传文件 ============================
step3_upload_files() {
    log_step "步骤 3/6 — 上传前端文件（排除 contracts / config / .github）"

    log_info "本地项目目录: $LOCAL_PROJECT_DIR"
    log_info "目标路径: ${SERVER_USER}@${SERVER_IP}:/var/www/html"
    echo -e "  ${YELLOW}排除目录：${NC} .github / contracts / config / .git / deploy.sh / *.md"

    if [[ -d "${LOCAL_PROJECT_DIR}/contracts" ]]; then
        log_warn "检测到 contracts 目录，将被排除（不会被上传）"
    fi

    log_info "开始上传 ..."

    TEMP_TAR="/tmp/deploy_html_$$.tar.gz"
    tar -czf "$TEMP_TAR" \
        --exclude='.github' \
        --exclude='contracts' \
        --exclude='config' \
        --exclude='.git' \
        --exclude='deploy.sh' \
        --exclude='check_ssh.py' \
        --exclude='*.md' \
        --exclude='.DS_Store' \
        --exclude='node_modules' \
        -C "$LOCAL_PROJECT_DIR" .

    log_info "传输文件到服务器 ..."
    _scp_cmd -P "$SERVER_PORT" "$TEMP_TAR" \
        "${SERVER_USER}@${SERVER_IP}:/tmp/deploy_html.tar.gz"

    log_info "解压文件到网站目录 ..."
    _ssh_cmd "tar -xzf /tmp/deploy_html.tar.gz -C /var/www/html && rm /tmp/deploy_html.tar.gz && echo 'UNPACK_OK'" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" | grep -q "UNPACK_OK"
    UPLOAD_EXIT=$?

    rm -f "$TEMP_TAR"

    if [[ $UPLOAD_EXIT -eq 0 ]]; then
        log_success "文件上传完成！"
    else
        log_error "文件上传失败（exit code: $UPLOAD_EXIT）"
        echo -e "  ${YELLOW}常见原因：${NC}"
        echo -e "  → 网络不稳定，可重试"
        exit 1
    fi
}

# ============================== 步骤 3b：创建服务器端 Token 配置 ==============
step3b_create_secrets() {
    log_step "步骤 3b/6 — 创建 Telegram Token 配置（服务器端）"

    # 读取本地 Token（来自 config/telegram-secrets.txt，格式: TOKEN\nCHATID）
    local SECRETS_TXT="${LOCAL_PROJECT_DIR}/config/telegram-secrets.txt"
    if [[ ! -f "$SECRETS_TXT" ]]; then
        log_error "未找到 Token 配置文件: $SECRETS_TXT"
        echo -e "  ${RED}→${NC}  请创建 config/telegram-secrets.txt，格式："
        echo -e "       第一行：Telegram Bot Token"
        echo -e "       第二行：Telegram Chat ID"
        exit 1
    fi

    local BOT_TOKEN_LINE=$(sed -n '1p' "$SECRETS_TXT" | tr -d '\r\n')
    local CHAT_ID_LINE=$(sed -n '2p' "$SECRETS_TXT" | tr -d '\r\n')

    if [[ -z "$BOT_TOKEN_LINE" || "$BOT_TOKEN_LINE" == "YOUR_BOT_TOKEN" ]]; then
        log_error "config/telegram-secrets.txt 第一行为空或仍是占位符。"
        exit 1
    fi

    log_info "在服务器上创建 config 目录和 secrets 文件 ..."
    _ssh_cmd "mkdir -p /var/www/html/config && \
        echo '<?php' > /var/www/html/config/telegram-secrets.php && \
        echo 'return [' >> /var/www/html/config/telegram-secrets.php && \
        echo '  \"bot_token\" => \"${BOT_TOKEN_LINE}\",' >> /var/www/html/config/telegram-secrets.php && \
        echo '  \"chat_id\"  => \"${CHAT_ID_LINE}\",' >> /var/www/html/config/telegram-secrets.php && \
        echo '];' >> /var/www/html/config/telegram-secrets.php && \
        echo 'SECRETS_OK'" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" | grep -q "SECRETS_OK"

    if [[ $? -eq 0 ]]; then
        log_success "Telegram Token 配置已写入服务器（config/telegram-secrets.php）"
    else
        log_error "Token 配置写入失败"
        exit 1
    fi
}

# ============================== 步骤 4：设置权限 ============================
step4_set_permissions() {
    log_step "步骤 4/6 — 设置目录权限"

    log_info "设置 /var/www/html 权限 ..."
    _ssh_cmd "chown -R www-data:www-data /var/www/html && \
         chmod -R 755 /var/www/html && \
         chmod 600 /var/www/html/config/telegram-secrets.php 2>/dev/null; \
         echo 'PERM_OK'" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" | grep -q "PERM_OK"
    log_success "权限设置完成（www-data 用户，755 权限，secrets 文件 600）"
}

# ============================== 步骤 5：配置 Nginx + PHP =========================
step5_configure_php() {
    log_step "步骤 5/6 — 配置 Nginx 支持 PHP"

    log_info "安装 PHP-FPM + curl 扩展 ..."
    _ssh_cmd "apt-get install -y php-fpm php-curl 2>/dev/null || apt-get install -y php-fpm php-curl" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" > /dev/null 2>&1
    log_success "PHP-FPM 安装完成"

    log_info "写入 Nginx + PHP 配置 ..."
    NGINX_PHP_TMP="/tmp/nginx_php_$$.conf"
    cat > "$NGINX_PHP_TMP" << 'NGINXPHPCONF'
server {
    listen 80;
    listen [::]:80;
    server_name _;

    root /var/www/html;
    index index.html index.htm;

    charset utf-8;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    }

    location /api/ {
        limit_except POST { deny all; }
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location /contracts { deny all; }
    location /config     { deny all; }
}
NGINXPHPCONF

    _scp_cmd -P "$SERVER_PORT" "$NGINX_PHP_TMP" \
        "${SERVER_USER}@${SERVER_IP}:/tmp/nginx_php.conf" 2>/dev/null
    rm -f "$NGINX_PHP_TMP"

    _ssh_cmd "cp /tmp/nginx_php.conf /etc/nginx/sites-available/default && \
        rm -f /tmp/nginx_php.conf && \
        nginx -t && systemctl restart nginx && \
        echo 'NGINX_PHP_OK'" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}" | grep -q "NGINX_PHP_OK"

    [[ $? -eq 0 ]] && log_success "Nginx + PHP-FPM 配置完成" \
                    || log_warn "Nginx/PHP 配置可能有误，请手动检查"
}

# ============================== 步骤 6：验证部署 ============================
step6_verify() {
    log_step "步骤 6/6 — 验证部署结果"

    log_info "查看服务器文件列表："
    echo -e "  ${CYAN}─────────────────────────────────────────${NC}"
    _ssh_cmd "ls -lh /var/www/html/ | head -20" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}"
    echo -e "  ${CYAN}─────────────────────────────────────────${NC}"

    log_info "contracts 目录检查（不应存在）："
    HAS_CONTRACTS=$(_ssh_cmd "test -d /var/www/html/contracts && echo YES || echo NO" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}")
    [[ "$HAS_CONTRACTS" == "YES" ]] \
        && log_error "contracts 目录存在！" \
        || log_success "contracts 目录不存在，安全！"

    log_info "config 目录访问检查（应为 403）："
    HTTP_CONFIG=$(_ssh_cmd "curl -s -o /dev/null -w '%{http_code}' http://localhost/config/" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}")
    [[ "$HTTP_CONFIG" == "403" ]] \
        && log_success "config 目录已禁止外部访问（403）！" \
        || log_warn "config 目录状态码: $HTTP_CONFIG，建议确认为 403"

    log_info "Nginx 首页检查："
    HTTP_CODE=$(_ssh_cmd "curl -s -o /dev/null -w '%{http_code}' http://localhost/" \
        -p "$SERVER_PORT" "${SERVER_USER}@${SERVER_IP}")
    [[ "$HTTP_CODE" == "200" ]] \
        && log_success "HTTP 200，Nginx 正常！" \
        || log_warn "HTTP $HTTP_CODE，请检查配置"
}

# ============================== 完成提示 =====================================
show_summary() {
    echo ""
    echo "╔════════════════════════════════════════════════╗"
    echo "║              部署完成！                          ║"
    echo "╚════════════════════════════════════════════════╝"
    echo ""
    echo -e "  在浏览器中访问你的网站："
    echo -e "  ${GREEN}http://45.32.51.77${NC}"
    echo ""
    echo -e "  ${BOLD}常用服务器管理命令：${NC}"
    echo "  systemctl restart nginx   # 重启 Nginx"
    echo "  systemctl status nginx     # 查看 Nginx 状态"
    echo "  nginx -t                   # 检查 Nginx 配置"
    echo "  ls /var/www/html/          # 查看已部署文件"
    echo ""
    echo -e "  ${BOLD}后续更新：${NC} 修改本地代码后，直接运行 ${CYAN}bash deploy.sh${NC}"
}

# ============================== 主流程 ========================================
main() {
    echo ""
    echo "╔════════════════════════════════════════════════╗"
    echo "║    本地一键部署脚本 — Vultr Ubuntu 服务器        ║"
    echo "╚════════════════════════════════════════════════╝"
    echo ""
    log_info "目标服务器: ${SERVER_USER}@${SERVER_IP}:${SERVER_PORT}"
    log_info "本地项目:   $LOCAL_PROJECT_DIR"
    echo ""

    step0_check_connectivity

    # 优先尝试 SSH 密钥认证
    if ! _test_key_auth; then
        setup_ssh_key
    fi

    test_ssh_connection

    step1_prepare_server
    step2_configure_nginx
    step3_upload_files
    step3b_create_secrets
    step4_set_permissions
    step5_configure_php
    step6_verify

    show_summary
}

main "$@"
