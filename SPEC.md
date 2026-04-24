# 数字无忧 (Digital Worry-Free) — Specification

## 1. Concept & Vision

数字无忧 is a premium dark-themed digital goods storefront — think a sleek, modern storefront for digital services and virtual products. The site exudes trust and professionalism through a clean dark palette, subtle glowing accents, and smooth micro-interactions. Every page feels fast, responsive, and safe. The goal is to make visitors feel confident purchasing digital products with crypto wallet integration.

## 2. Design Language

### Aesthetic Direction
Minimalist dark tech — clean surfaces, restrained glow effects, crisp typography. Inspired by modern fintech/crypto platforms (e.g., Stripe, Binance dark mode). Not cluttered; every element has purpose.

### Color Palette
- **Background**: `#0a0a0f` (near-black with blue undertone)
- **Surface**: `#111118` (card backgrounds)
- **Surface Elevated**: `#1a1a24` (hover states, modals)
- **Border**: `#2a2a3a` (subtle dividers)
- **Primary**: `#6c5ce7` (brand purple — CTAs, accents)
- **Primary Glow**: `#a29bfe` (hover glow, highlights)
- **Accent**: `#00cec9` (teal — success states, secondary accents)
- **Text Primary**: `#f0f0f5` (headings, important text)
- **Text Secondary**: `#8888a0` (body, descriptions)
- **Text Muted**: `#55556a` (placeholders, disabled)

### Typography
- **Headings**: `"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif` — weight 700
- **Body**: `"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif` — weight 400/500
- **Monospace** (prices, IDs): `"JetBrains Mono", "Fira Code", monospace`

### Spatial System
- Base unit: 8px
- Content max-width: 1200px
- Card padding: 24px
- Section gaps: 80px
- Border radius: 12px (cards), 8px (buttons), 6px (inputs)

### Motion Philosophy
- Page load: staggered fade-in + translateY(20px) → translateY(0), 400ms ease-out, 80ms stagger
- Hover: scale(1.02) + shadow lift, 200ms ease
- Button press: scale(0.97), 100ms
- Page transitions: opacity fade, 300ms
- No excessive animation — motion serves clarity, not decoration

### Visual Assets
- Icons: Lucide icons via CDN (consistent stroke style)
- Images: Placeholder product images using picsum.photos (will be replaced with real images)
- Decorative: Subtle radial gradient glow behind hero section

## 3. Layout & Structure

### Pages
1. **Homepage** (`index.html`) — Hero banner, featured products, trust signals
2. **Products Page** (`products.html`) — Full product grid with filtering
3. **Product Detail / Payment Page** (`payment.html`) — Product info + wallet payment options

### Homepage Structure
1. **Navbar** — Logo, nav links, theme stays dark
2. **Hero Section** — Large headline, subtitle, CTA button, background glow
3. **Trust Bar** — Key stats/features (secure payments, instant delivery, etc.)
4. **Featured Products** — 3-6 product cards in a grid
5. **Features Section** — Why choose us (3-column grid)
6. **Footer** — Links, contact, copyright

### Products Page Structure
1. **Navbar** (same)
2. **Page Header** — Title + breadcrumb
3. **Filter/Sort Bar** — Category filters
4. **Product Grid** — All products, responsive 3-column → 2-column → 1-column
5. **Footer** (same)

### Payment Page Structure
1. **Navbar** (same)
2. **Product Summary** — Image, name, price, description
3. **Wallet Selection** — Three prominent wallet options:
   - TP Wallet (TokenPocket)
   - imToken
   - TronLink
4. **Each wallet button** — Opens wallet deep link / shows instructions
5. **Footer** (same)

### Responsive Strategy
- Desktop: 1200px max-width, 3-column product grid
- Tablet (768px): 2-column grid, adjusted spacing
- Mobile (480px): 1-column grid, hamburger nav, full-width cards

## 4. Features & Interactions

### Navigation
- Sticky navbar with blur backdrop
- Active page indicator
- Mobile: hamburger menu slides in from right

### Product Cards
- Hover: lift effect (translateY(-4px), shadow increase)
- Click: navigates to payment page with product ID in URL param
- Badge for "Featured" or "New" items

### Wallet Payment Flow
- Three wallet options displayed as large clickable cards
- Each wallet card shows: wallet icon, name, "Pay with [Wallet]" label
- Click triggers `tokenpocket://`, `imtoken://`, or `tronlink://` deep link
- Fallback: shows copy-to-clipboard for wallet address if deep link fails

### Homepage CTA
- "浏览商品" button scrolls to featured products
- "立即购买" button navigates to products page

### Error/Empty States
- If no products match filter: "未找到相关商品" with illustration
- Loading state: skeleton cards with shimmer animation

## 5. Component Inventory

### Navbar
- Logo (text-based: "数字无忧" with icon)
- Nav links: 首页, 商品, 关于
- CTA button: "开始使用"
- Mobile: hamburger icon, slide-out drawer
- States: default, scrolled (adds backdrop blur + border)

### Hero Section
- Large heading with gradient text accent
- Subtitle paragraph
- Two CTAs: primary (filled) + secondary (outlined)
- Background: radial gradient glow

### Product Card
- Image (16:9 aspect ratio, rounded top)
- Category badge (top-left overlay)
- Product name
- Short description (2 lines max, ellipsis)
- Price display (large, monospace)
- "立即购买" button
- States: default, hover (lifted), loading (skeleton)

### Wallet Payment Card
- Large wallet icon (48px)
- Wallet name
- "Pay with [Wallet]" CTA
- States: default, hover (glow border), active (pressed)

### Trust Badge
- Icon + number/stat
- Label text
- Subtle glow on hover

### Footer
- Logo
- Link columns (Product, Support, Legal)
- Social icons
- Copyright

## 6. Technical Approach

### Stack
- **Single-page application pattern** using vanilla HTML/CSS/JS
- All three "pages" live in one HTML file using hash-based routing (`#home`, `#products`, `#payment`)
- Alternatively: three separate HTML files sharing the same CSS/JS
- **Decision**: Three separate HTML files for clarity and ease of deployment to GitHub Pages

### File Structure
```
/
├── index.html          # Homepage
├── products.html       # Product listing
├── payment.html       # Payment page
├── css/
│   └── style.css       # Shared styles
├── js/
│   ├── main.js         # Shared logic (nav, routing)
│   └── products.js     # Product data and rendering
├── SPEC.md
└── README.md
```

### Product Data
- 6 products defined in `js/products.js`
- Each product: `{ id, name, description, price, category, image, featured, badge }`
- Images sourced from `picsum.photos` (replaceable)

### Wallet Deep Links
- **TP Wallet**: `tokenpocket://`
- **imToken**: `imtokenv2://`
- **TronLink**: `tronlink://`
- Fallback: copy USDT/TRON address to clipboard

### Deployment
- GitHub Pages (user/site pages)
- Deploy via GitHub Actions workflow

### External Dependencies (CDN)
- Google Fonts: Noto Sans SC, JetBrains Mono
- Lucide Icons: via unpkg CDN

## 7. Products (Sample Data — 6 Items)

| # | Name | Category | Price (USDT) | Badge |
|---|------|----------|-------------|-------|
| 1 | 数字身份认证套装 | 数字身份 | 49.99 | 热门 |
| 2 | 区块链开发入门课程 | 在线课程 | 99.99 | 新品 |
| 3 | 加密资产安全管理指南 | 电子书 | 29.99 | — |
| 4 | 智能合约安全审计服务 | 专业服务 | 299.99 | 推荐 |
| 5 | Web3.0入门工具包 | 工具包 | 19.99 | 热门 |
| 6 | 数字资产组合管理器 | 软件 | 59.99 | 新品 |

*Note: These are sample placeholder products. The user will replace images and content with their actual product catalog.*
