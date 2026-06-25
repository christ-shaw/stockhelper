#!/bin/bash

# 部署 phoneModels 云函数脚本

echo "正在部署 phoneModels 云函数..."
echo "环境 ID: cloud1-8gvbotkt966e5e19"
echo ""

# 使用 expect 自动处理交互式提示
if command -v expect &> /dev/null; then
    expect << EOF
    set timeout 60
    spawn tcb fn deploy phoneModels --dir ./cloudfunctions/phoneModels -e cloud1-8gvbotkt966e5e19
    expect {
        "是否覆盖更新" { send "y\r"; exp_continue }
        "请选择操作" { send "\r"; exp_continue }
        "部署成功" { exit 0 }
        timeout { exit 1 }
    }
EOF
else
    echo "未安装 expect 工具，请手动选择:"
    echo "1. 是否覆盖: 选择 'y'"
    echo "2. 请选择操作: 选择 '使用合并配置更新' (默认)"
    echo ""
    tcb fn deploy phoneModels --dir ./cloudfunctions/phoneModels -e cloud1-8gvbotkt966e5e19
fi

echo ""
echo "部署完成！"
