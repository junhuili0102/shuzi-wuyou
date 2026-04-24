/* ================================================
   数字无忧 — Product Data
   ================================================ */

const PRODUCTS = [
  {
    id: 1,
    name: "数字身份认证套装",
    description: "包含完整的数字身份认证流程文档、实名认证API接口规范、身份验证SDK以及企业级安全解决方案。适用于Web3平台、金融科技应用和数字资产管理平台。",
    shortDesc: "完整的数字身份认证解决方案，含文档与SDK",
    price: 49.99,
    category: "数字身份",
    image: "https://picsum.photos/seed/digital-id/800/450",
    badge: "hot",
    badgeText: "热门",
    featured: true,
    tags: ["数字身份", "API", "SDK", "安全"]
  },
  {
    id: 2,
    name: "区块链开发入门课程",
    description: "从零开始学习区块链技术，涵盖以太坊智能合约开发、Solidity编程语言、Web3.js交互、Hardhat测试框架以及真实项目实战。配套完整课件与代码仓库。",
    shortDesc: "零基础到实战，完整课程体系与代码示例",
    price: 99.99,
    category: "在线课程",
    image: "https://picsum.photos/seed/blockchain-course/800/450",
    badge: "new",
    badgeText: "新品",
    featured: true,
    tags: ["区块链", "Solidity", "Web3", "课程"]
  },
  {
    id: 3,
    name: "加密资产安全管理指南",
    description: "专业级加密资产管理手册，涵盖冷热钱包配置、多签策略、风险控制框架、资产恢复方案以及主流交易所安全操作规范。保护您的数字资产安全。",
    shortDesc: "专业级加密资产管理与安全策略指南",
    price: 29.99,
    category: "电子书",
    image: "https://picsum.photos/seed/crypto-security/800/450",
    badge: null,
    badgeText: null,
    featured: false,
    tags: ["安全", "钱包", "加密货币", "电子书"]
  },
  {
    id: 4,
    name: "智能合约安全审计服务",
    description: "由资深安全专家提供的智能合约全面审计服务，包括代码漏洞扫描、重入攻击检测、权限控制审查、经济模型分析以及详细的安全报告与修复建议。",
    shortDesc: "资深专家团队，全方位智能合约安全审计",
    price: 299.99,
    category: "专业服务",
    image: "https://picsum.photos/seed/audit-service/800/450",
    badge: "recommend",
    badgeText: "推荐",
    featured: true,
    tags: ["智能合约", "安全", "审计", "Web3"]
  },
  {
    id: 5,
    name: "Web3.0入门工具包",
    description: "快速上手Web3开发的必备工具包，内含MetaMask配置指南、DApp开发模板、NFT铸造教程、DeFi协议交互示例以及常用开发工具集合。",
    shortDesc: "Web3开发入门必备，工具模板一站式集合",
    price: 19.99,
    category: "工具包",
    image: "https://picsum.photos/seed/web3-tools/800/450",
    badge: "hot",
    badgeText: "热门",
    featured: true,
    tags: ["Web3", "DApp", "NFT", "工具包"]
  },
  {
    id: 6,
    name: "数字资产组合管理器",
    description: "专业的数字资产投资组合管理工具，支持多链资产聚合、实时行情追踪、收益分析报告、风险评估模型以及自动化策略提醒。数据本地加密存储。",
    shortDesc: "多链资产管理，实时行情与智能分析",
    price: 59.99,
    category: "软件",
    image: "https://picsum.photos/seed/portfolio/800/450",
    badge: "new",
    badgeText: "新品",
    featured: true,
    tags: ["资产管理", "DeFi", "多链", "软件"]
  }
];

const WALLET_ADDRESS = "TJYs7oS9oULBp8WXGzLGGnGihJ3wN5VvJ";

const CATEGORIES = ["全部", "数字身份", "在线课程", "电子书", "专业服务", "工具包", "软件"];

function getProductById(id) {
  return PRODUCTS.find(p => p.id === parseInt(id)) || null;
}

function getFeaturedProducts() {
  return PRODUCTS.filter(p => p.featured);
}

function getProductsByCategory(category) {
  if (category === "全部" || !category) return PRODUCTS;
  return PRODUCTS.filter(p => p.category === category);
}

function renderBadge(badge) {
  if (!badge) return "";
  const classMap = { hot: "badge-hot", new: "badge-new", recommend: "badge-recommend" };
  const textMap = { hot: "热门", new: "新品", recommend: "推荐" };
  return `<span class="product-badge ${classMap[badge]}">${textMap[badge]}</span>`;
}

function createProductCard(product) {
  return `
    <article class="product-card" onclick="goToPayment(${product.id})">
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        ${renderBadge(product.badge)}
      </div>
      <div class="product-body">
        <div class="product-category">${product.category}</div>
        <h3 class="product-name">${product.name}</h3>
        <p class="product-desc">${product.shortDesc}</p>
        <div class="product-footer">
          <div class="product-price">
            <span>USDT</span> ${product.price.toFixed(2)}
          </div>
          <button class="btn btn-primary btn-sm">立即购买</button>
        </div>
      </div>
    </article>
  `;
}
