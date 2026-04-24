# 数字无忧 (Digital Worry-Free)

专业的数字商品交易平台，基于 GitHub Pages 托管。

[在线预览](https://你的用户名.github.io/数字无忧)

## 功能特性

- **首页** — 品牌展示、精选商品、信任信号、功能介绍
- **商品列表** — 分类筛选、产品卡片、即时购买入口
- **付款页面** — 商品详情、三大钱包支付（TP Wallet、imToken、TronLink）、钱包地址复制

## 技术栈

- HTML5 + CSS3 + Vanilla JavaScript
- 深色主题设计
- 响应式布局
- 无需构建，开箱即用

## 快速开始

### 本地预览

```bash
# 使用 Python
python -m http.server 8000

# 或使用 npx
npx serve .

# 或直接在浏览器打开 index.html
```

### 部署到 GitHub Pages

1. 在 GitHub 创建新仓库
2. 将本项目所有文件 push 到 `main` 分支
3. 进入仓库 **Settings → Pages**
4. Source 选择 **Deploy from a branch**, Branch 选择 **main / (root)**
5. 等待部署完成，访问 `https://你的用户名.github.io/仓库名`

## 项目结构

```
/
├── index.html         # 首页
├── products.html      # 商品列表
├── payment.html       # 付款页面
├── css/
│   └── style.css     # 全局样式
├── js/
│   ├── main.js        # 通用逻辑
│   └── products.js    # 商品数据
├── .github/
│   └── workflows/
│       └── deploy.yml # GitHub Actions 自动部署
├── SPEC.md            # 设计规范文档
└── README.md
```

## 自定义商品

编辑 `js/products.js` 中的 `PRODUCTS` 数组即可添加/修改商品：

```javascript
{
  id: 7,
  name: "新商品名称",
  description: "商品详细描述",
  shortDesc: "简短描述（卡片显示）",
  price: 39.99,
  category: "软件",
  image: "https://picsum.photos/seed/your-image/800/450",
  badge: "new",       // "hot" | "new" | "recommend" | null
  badgeText: "新品",   // 显示标签文字
  featured: true,      // 是否在首页展示
  tags: ["标签1", "标签2"]
}
```

## 更换为真实图片

将 `products.js` 中的 `image` 字段替换为您自己的图片 URL，或将图片放入项目目录后使用相对路径引用。

## 钱包配置

在 `js/products.js` 中修改钱包收款地址：

```javascript
const WALLET_ADDRESS = "你的TRON钱包地址";
```
