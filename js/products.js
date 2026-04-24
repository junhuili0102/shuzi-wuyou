/* ================================================
   数字无忧 — Product Data
   ================================================ */

const PRODUCTS = [
  {
    id: 1,
    name: "脸书FB",
    description: "脸书FB 美国号 原始老白号 uid1000x 邮箱登入 mail.com 开通 2fa 售后 24h 包30天找回 好友0-30 带cookie 可cookie登入",
    shortDesc: "包首登，使用2FA登陆，特价脸书美国老白号，邮箱登陆地址mail.com",
    price: 10.99,
    category: "数字身份",
    image: "https://www.humkt.com/assets/images/product/69e868feaa9c41776838910.webp",
    badge: "hot",
    badgeText: "热门",
    featured: true,
    tags: ["数字身份", "API", "SDK", "安全"]
  },
  {
    id: 2,
    name: "Twitter(x) 一年老号",
    description: "Twitter(x) 老号，随机地区，开启2FA",
    shortDesc: "用户名:密码:邮箱:邮箱密码:手机号:ct0:auth_token:2FA:日期:",
    price: 2,
    category: "在线课程",
    image: "https://www.humkt.com/assets/images/product/698b3e9e1e6d51770733214.webp",
    badge: "new",
    badgeText: "新品",
    featured: true,
    tags: ["区块链", "Solidity", "Web3", "课程"]
  },
  {
    id: 3,
    name: "Telegram 乌克兰 | 手机登录 | Email + 密码 | 附带1个号码",
    description: "📱 使用手机号码登录 注册国家：乌克兰 购买后根据申请发放代码。 重要提示： ❗ 请使用官方 Telegram 应用程序（Nicegram、Telegram X 等不支持通过邮箱登录）。 ❗ 我们建议：仅使用注册账号国家的代理服务器登录账号！  ❗ 未使用代理登录将导致店铺保修失效。 账号格式：number|email|password|2fa 示例： 09712312351| borada@hotmail.com|YZfWCemYtyL0|qwerty   ✉店铺规则 购买后6小时内可检查商品。 禁止使用 VPN/家庭 IP/免费代理登录。 仅接受提供从购买到账号检查期间的屏幕录像的投诉。 录像需从下单开始到账号启动结束，不能中断或停止录制。 购买即表示您同意店铺规则。不知晓规则不免除责任。",
    shortDesc: "Telegram 乌克兰 | 手机登录 | Email + 密码 | 附带1个号码",
    price: 5,
    category: "电子书",
    image: "https://www.humkt.com/assets/images/product/69df21cfb7a421776230863.webp",
    badge: "hot",
    badgeText: "热门",
    featured: true,
    tags: ["安全", "钱包", "加密货币", "电子书"]
  },
  {
    id: 4,
    name: "TikTok，附带邮箱访问 - 1到50个真实粉丝，账号年龄：1-2年",
    description: "账户格式 用户名, TikTok密码, 邮箱, 邮箱访问信息 邮箱访问信息 您可以使用 Fakemailo 授权邮箱访问。请按照 Fakemailo 提供的三步操作。所有账户均使用随机住宅代理注册。 检查账户状态 在登录前，请访问：https://www.tiktok.com/@Username（将 Username 替换为实际购买的 TikTok 用户名）检查账户状态。或者，您可以使用此工具：Bulk TikTok Username Checker。如果个人资料网址存在，则账户活跃且未被封禁。如果个人资料网址不存在，请联系我更换。 登录问题 如果登录时出现“尝试次数已达上限”错误，说明您的IP或设备已被TikTok标记。 解决方法： 清除浏览器缓存或TikTok应用缓存。 更换IP（使用不同的代理或连接）。 再次尝试登录。 ⚠️ 重要：如果您多次尝试使用被标记的IP或设备登录，即使更换IP或清除缓存后，可能需要等待最多24小时才能再次登录。",
    shortDesc: "老账号TikTok，附带邮箱访问 - 1到50个真实粉丝，账号年龄：1-2年",
    price: 20,
    category: "专业服务",
    image: "https://www.humkt.com/assets/images/product/6911da5fbd0ce1762777695.webp",
    badge: "recommend",
    badgeText: "推荐",
    featured: true,
    tags: ["智能合约", "安全", "审计", "Web3"]
  },
  {
    id: 5,
    name: "美国 Snapchat 账号 - 使用 Gmail 注册，账号年龄：1-2 年",
    description: "账户详情格式：用户名、Snapchat密码、邮箱、邮箱访问信息、个人资料链接 邮箱访问信息：用于接收验证码的邮箱访问API — https://fakemailo.com/partner-authorized-emails 所有账户均使用美国住宅IP地址注册的Gmail邮箱。所有账户均为西方姓名。 登录前验证 在登录前，请访问个人资料链接：https://www.snapchat.com/@Username（将Username替换为购买的Snapchat用户名）。如果个人资料加载正常，说明账户活跃且未被限制。如果个人资料不存在，请联系我们更换。 重要提示：如果在登录前未验证个人资料链接，将不提供更换、退款或保证。 保证政策 交付后24小时内对无效账户或登录问题提供保证。一旦成功登录，不再适用任何保证。",
    shortDesc: "美国 Snapchat 账号 - 使用 Gmail 注册，账号年龄：1-2 年",
    price: 59.99,
    category: "工具包",
    image: "https://www.humkt.com/assets/images/product/697ed7121b07f1769920274.webp",
    badge: "hot",
    badgeText: "热门",
    featured: true,
    tags: ["Web3", "DApp", "NFT", "工具包"]
  },
  {
    id: 6,
    name: "国内微信号购买批发_一年号_实名认证_可收付款_带圈_带账单",
    description: "实名认证账号（推荐用于支付、营销等场景），格式：账号----密码----支付密码----姓名----sfz号码---专属接码链接，特点：信息完整，已绑卡实名，可直接进行支付操作，权限更高，稳定性极佳。",
    shortDesc: "微信号购买批发_一年号_实名认证_可收付款_带圈_带账单",
    price: 29.99,
    category: "软件",
    image: "https://www.tengxuanw.com/content/uploadfile/202302/16682315656656004.png",
    badge: "new",
    badgeText: "新品",
    featured: true,
    tags: ["资产管理", "DeFi", "多链", "软件"]
  }
];

const WALLET_ADDRESS = "";

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
