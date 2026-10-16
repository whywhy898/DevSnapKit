# DevSnapKit

> Transform raw screenshots into studio-grade product visuals in seconds.

DevSnapKit is a modern web studio for developers, designers, and indie hackers to create high-converting product announcement graphics, Twitter/X banners, LinkedIn carousels, and Product Hunt launch cards.

## ✨ Features

- **Device Mockups**: MacBook Pro, Studio Display, iPhone 17 Pro, Clay Phone, Safari Browser, macOS Window, and Borderless.
- **3D Angles & Projections**: Front Flat, Isometric Left/Right, Dynamic Skew, Floating Tilt, and 3D Horizon.
- **Adaptive Canvas Engine**: Smart automatic content bounds calculation with stable logical resolution across all viewport sizes.
- **Custom Aspect Ratios**: Auto, Twitter/OG (1200×630), 16:9, 1:1 Square, 4:3, Instagram Post/Story, YouTube Thumbnail, plus Custom W/H (200–8000px).
- **Pro Exporting**: Multi-scale 1x Web, 2x HD, and 4K Ultra HD in PNG, WebP, and JPEG formats, plus batch multi-size export.
- **Brand Identity**: Add custom brand logos, dynamic QR codes, and watermarks.
- **VFX & Styling**: Ambient backlight glow, organic film grain, frosted glass, gradients, patterns, and card stacking.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone git@github.com:whywhy898/DevSnapKit.git
cd DevSnapKit

# Install dependencies
npm install
```

### Local Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
```

The production assets will be output to the `dist/` directory.

### Preview Build

```bash
npm run preview
```

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Export Engine**: html-to-image
- **Deployment**: Cloudflare Pages + Pages Functions
- **Database**: Cloudflare D1 (Serverless SQL)

## 📄 License

Private & Proprietary. All rights reserved.
