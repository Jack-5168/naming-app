#!/bin/bash

# =============================================================================
# 文昌赐名 - 服务器部署脚本
# =============================================================================
# 使用方法:
#   ./deploy.sh
#   或 ./deploy.sh production (指定环境)
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置（请根据实际情况修改）
DEPLOY_ENV="${1:-production}"

# 服务器配置（从配置文件读取或默认值）
if [ -f ".deploy.config" ]; then
    source .deploy.config
else
    # 默认配置（首次使用时修改）
    SERVER_USER="root"
    SERVER_HOST="your-server-ip"
    SERVER_PORT="22"
    SERVER_PATH="/var/www/naming-app"
    echo -e "${YELLOW}⚠️  未找到配置文件 .deploy.config${NC}"
    echo -e "${YELLOW}请创建并配置该文件，参考 .deploy.config.example${NC}"
    exit 1
fi

# 本地配置
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
EXCLUDE_FILE="$LOCAL_DIR/.deployignore"

# =============================================================================
# 函数定义
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v rsync &> /dev/null; then
        log_error "rsync 未安装，请先安装：brew install rsync (Mac) 或 apt install rsync (Linux)"
        exit 1
    fi
    
    if ! command -v ssh &> /dev/null; then
        log_error "ssh 未安装，请先安装 openssh"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

check_ssh_connection() {
    log_info "测试 SSH 连接..."
    
    if ssh -p "$SERVER_PORT" -o ConnectTimeout=5 -o BatchMode=yes "$SERVER_USER@$SERVER_HOST" "echo '连接成功'" &> /dev/null; then
        log_success "SSH 连接正常"
    else
        log_error "无法连接到服务器，请检查："
        echo "  - 服务器 IP/域名：$SERVER_HOST"
        echo "  - SSH 端口：$SERVER_PORT"
        echo "  - SSH 密钥配置"
        echo "  - 防火墙设置"
        exit 1
    fi
}

create_remote_directory() {
    log_info "创建远程目录..."
    
    ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "mkdir -p $SERVER_PATH"
    
    log_success "远程目录已创建：$SERVER_PATH"
}

sync_files() {
    log_info "同步文件到服务器..."
    
    # 构建 rsync 排除参数
    EXCLUDE_ARGS=""
    if [ -f "$EXCLUDE_FILE" ]; then
        while IFS= read -r pattern || [ -n "$pattern" ]; do
            # 跳过注释和空行
            [[ "$pattern" =~ ^#.*$ ]] && continue
            [[ -z "$pattern" ]] && continue
            EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude '$pattern'"
        done < "$EXCLUDE_FILE"
    fi
    
    # 默认排除
    DEFAULT_EXCLUDES="--exclude '.git/' --exclude '.github/' --exclude 'node_modules/' --exclude '.DS_Store'"
    
    # 执行同步
    rsync -avz --delete \
        $DEFAULT_EXCLUDES \
        $EXCLUDE_ARGS \
        -e "ssh -p $SERVER_PORT" \
        --progress \
        "$LOCAL_DIR/" \
        "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/"
    
    log_success "文件同步完成"
}

set_permissions() {
    log_info "设置文件权限..."
    
    ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" << EOF
        # 设置目录权限
        find $SERVER_PATH -type d -exec chmod 755 {} \;
        
        # 设置文件权限
        find $SERVER_PATH -type f -exec chmod 644 {} \;
        
        # 设置可执行文件权限
        find $SERVER_PATH -name "*.sh" -exec chmod 755 {} \;
        
        # 设置所有者（如果可能）
        chown -R $SERVER_USER:$SERVER_USER $SERVER_PATH 2>/dev/null || true
        
        echo "权限设置完成"
EOF
    
    log_success "权限设置完成"
}

verify_deployment() {
    log_info "验证部署..."
    
    # 检查关键文件是否存在
    FILES_TO_CHECK=("index.html" "mobile.html" "css/style.css" "js/main.js")
    
    for file in "${FILES_TO_CHECK[@]}"; do
        if ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "test -f $SERVER_PATH/$file && echo 'exists'"; then
            log_success "✓ $file 存在"
        else
            log_warning "✗ $file 不存在"
        fi
    done
    
    log_success "部署验证完成"
}

print_summary() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}          🎉 部署成功完成！                    ${GREEN}║${NC}"
    echo -e "${GREEN}╠════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  服务器：$SERVER_USER@$SERVER_HOST:$SERVER_PORT                     ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  路径：$SERVER_PATH"
    echo -e "${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  访问地址:"
    echo -e "${GREEN}║${NC}    - PC 版：http://$SERVER_HOST/"
    echo -e "${GREEN}║${NC}    - 移动端：http://$SERVER_HOST/mobile.html"
    echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# =============================================================================
# 主流程
# =============================================================================

main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}        文昌赐名 - 服务器部署脚本 v1.0          ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_info "部署环境：$DEPLOY_ENV"
    log_info "本地目录：$LOCAL_DIR"
    log_info "目标服务器：$SERVER_USER@$SERVER_HOST:$SERVER_PORT"
    log_info "目标路径：$SERVER_PATH"
    echo ""
    
    # 确认部署
    read -p "确认部署到服务器？(y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "部署已取消"
        exit 0
    fi
    
    # 执行部署步骤
    check_dependencies
    check_ssh_connection
    create_remote_directory
    sync_files
    set_permissions
    verify_deployment
    print_summary
    
    log_success "✅ 所有部署步骤完成！"
}

# 执行主流程
main
