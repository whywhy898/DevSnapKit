// High-Conversion Built-in Mockup Templates for DevSnapKit

export interface MockupPreset {
  id: string;
  name: string;
  badge: string;
  title: string;
  svgDataUri: string;
}

// 1. Sleek Modern SaaS Analytics Dashboard (Default)
const SAAS_DASHBOARD_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="860" height="520" viewBox="0 0 860 520">
  <defs>
    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="%236366F1" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="%236366F1" stop-opacity="0.0"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="%236366F1"/>
      <stop offset="100%" stop-color="%2306B6D4"/>
    </linearGradient>
  </defs>
  
  <!-- Canvas Base -->
  <rect width="860" height="520" fill="%23090D16"/>
  
  <!-- Top App Bar -->
  <rect x="0" y="0" width="860" height="54" fill="%230F172A" stroke="%231E293B" stroke-width="1"/>
  <circle cx="28" cy="27" r="10" fill="url(%23accentGrad)"/>
  <text x="48" y="32" fill="%23FFFFFF" font-family="-apple-system, sans-serif" font-size="14" font-weight="700">PulseSaaS</text>
  <text x="125" y="32" fill="%2364748B" font-family="-apple-system, sans-serif" font-size="13">/ Analytics</text>
  
  <!-- Search Mockup -->
  <rect x="240" y="12" width="280" height="30" rx="8" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
  <text x="256" y="31" fill="%2364748B" font-family="-apple-system, sans-serif" font-size="11">Search metrics, customers, logs... (⌘K)</text>
  
  <!-- User Profile Badge -->
  <circle cx="820" cy="27" r="14" fill="%23312E81"/>
  <text x="814" y="31" fill="%23C7D2FE" font-family="-apple-system, sans-serif" font-size="11" font-weight="bold">JD</text>

  <!-- Metric Card 1: MRR -->
  <rect x="36" y="80" width="240" height="100" rx="12" fill="%230F172A" stroke="%231E293B" stroke-width="1.5"/>
  <text x="56" y="108" fill="%2394A3B8" font-family="-apple-system, sans-serif" font-size="12" font-weight="600">Monthly Recurring Revenue</text>
  <text x="56" y="146" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="28" font-weight="800">$38,420</text>
  <rect x="186" y="126" width="70" height="22" rx="6" fill="%23064E3B"/>
  <text x="194" y="141" fill="%2334D399" font-family="-apple-system, sans-serif" font-size="11" font-weight="bold">+24.8% ↑</text>

  <!-- Metric Card 2: Active Subscribers -->
  <rect x="300" y="80" width="240" height="100" rx="12" fill="%230F172A" stroke="%231E293B" stroke-width="1.5"/>
  <text x="320" y="108" fill="%2394A3B8" font-family="-apple-system, sans-serif" font-size="12" font-weight="600">Active Paid Customers</text>
  <text x="320" y="146" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="28" font-weight="800">2,845</text>
  <rect x="450" y="126" width="70" height="22" rx="6" fill="%23064E3B"/>
  <text x="458" y="141" fill="%2334D399" font-family="-apple-system, sans-serif" font-size="11" font-weight="bold">+12.4% ↑</text>

  <!-- Metric Card 3: Avg Order Value -->
  <rect x="564" y="80" width="260" height="100" rx="12" fill="%230F172A" stroke="%231E293B" stroke-width="1.5"/>
  <text x="584" y="108" fill="%2394A3B8" font-family="-apple-system, sans-serif" font-size="12" font-weight="600">Net Conversion Rate</text>
  <text x="584" y="146" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="28" font-weight="800">4.82%</text>
  <rect x="734" y="126" width="70" height="22" rx="6" fill="%231E1B4B"/>
  <text x="742" y="141" fill="%23818CF8" font-family="-apple-system, sans-serif" font-size="11" font-weight="bold">+0.8% ↑</text>

  <!-- Main Analytics Area Chart -->
  <rect x="36" y="200" width="788" height="290" rx="14" fill="%230F172A" stroke="%231E293B" stroke-width="1.5"/>
  <text x="60" y="234" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="15" font-weight="700">Revenue Velocity</text>
  <text x="60" y="254" fill="%2364748B" font-family="-apple-system, sans-serif" font-size="12">Daily real-time subscriber payment velocity (USD)</text>
  
  <!-- Chart Grid Lines -->
  <line x1="60" y1="290" x2="800" y2="290" stroke="%231E293B" stroke-dasharray="4"/>
  <line x1="60" y1="350" x2="800" y2="350" stroke="%231E293B" stroke-dasharray="4"/>
  <line x1="60" y1="410" x2="800" y2="410" stroke="%231E293B" stroke-dasharray="4"/>
  
  <!-- Chart Path Fill -->
  <path d="M60 410 C160 380, 220 390, 300 320 C380 250, 440 310, 520 270 C600 230, 680 250, 750 220 C770 212, 790 210, 800 210 L800 450 L60 450 Z" fill="url(%23chartGrad)"/>
  
  <!-- Glowing Chart Stroke -->
  <path d="M60 410 C160 380, 220 390, 300 320 C380 250, 440 310, 520 270 C600 230, 680 250, 750 220 C770 212, 790 210, 800 210" fill="none" stroke="%236366F1" stroke-width="3.5" stroke-linecap="round"/>
  
  <!-- Glowing Target Pulse Point -->
  <circle cx="750" cy="220" r="7" fill="%236366F1" stroke="%23FFFFFF" stroke-width="2"/>
  <rect x="710" y="174" width="80" height="28" rx="6" fill="%231E1B4B" stroke="%236366F1" stroke-width="1"/>
  <text x="724" y="193" fill="%23A5B4FC" font-family="-apple-system, sans-serif" font-size="11" font-weight="bold">$38,420</text>
  
  <!-- Date Axis Labels -->
  <text x="60" y="465" fill="%23475569" font-family="-apple-system, sans-serif" font-size="11">Sep 01</text>
  <text x="240" y="465" fill="%23475569" font-family="-apple-system, sans-serif" font-size="11">Sep 08</text>
  <text x="420" y="465" fill="%23475569" font-family="-apple-system, sans-serif" font-size="11">Sep 15</text>
  <text x="600" y="465" fill="%23475569" font-family="-apple-system, sans-serif" font-size="11">Sep 22</text>
  <text x="760" y="465" fill="%23475569" font-family="-apple-system, sans-serif" font-size="11">Sep 29</text>
</svg>`;

// 2. Clean Mobile FinTech / Banking Screen Mockup (393 x 852 - iPhone 16/17 Retina)
const MOBILE_APP_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="393" height="852" viewBox="0 0 393 852">
  <defs>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="%236366F1"/>
      <stop offset="45%" stop-color="%238B5CF6"/>
      <stop offset="100%" stop-color="%23EC4899"/>
    </linearGradient>
    <linearGradient id="chipGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="%23FCD34D"/>
      <stop offset="100%" stop-color="%23F59E0B"/>
    </linearGradient>
  </defs>
  <rect width="393" height="852" fill="%230B0F19"/>
  <circle cx="200" cy="180" r="160" fill="%236366F1" opacity="0.12"/>
  
  <!-- Header Bar -->
  <text x="24" y="90" fill="%2394A3B8" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" font-size="13" font-weight="500">Good morning,</text>
  <text x="24" y="116" fill="%23FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" font-size="22" font-weight="800">Sarah Chen</text>
  <circle cx="345" cy="102" r="19" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
  <circle cx="345" cy="102" r="7" fill="%2310B981"/>

  <!-- Titanium Black Card -->
  <rect x="24" y="142" width="345" height="195" rx="20" fill="url(%23cardGrad)" stroke="%23FFFFFF" stroke-opacity="0.2" stroke-width="1.5"/>
  <path d="M24 220 Q 180 180 369 240" stroke="%23FFFFFF" stroke-opacity="0.08" stroke-width="2" fill="none"/>
  <path d="M24 260 Q 180 220 369 280" stroke="%23FFFFFF" stroke-opacity="0.06" stroke-width="2" fill="none"/>
  <text x="46" y="176" fill="%23FFFFFF" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="1.5" opacity="0.85">FOUNDER PASS • INFINITE</text>
  <rect x="46" y="190" width="32" height="22" rx="5" fill="url(%23chipGrad)" opacity="0.9"/>
  <text x="46" y="252" fill="%23FFFFFF" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="32" font-weight="900">$142,850.00</text>
  <text x="46" y="306" fill="%23FFFFFF" font-family="monospace" font-size="14" opacity="0.9" font-weight="600">•••• •••• •••• 9428</text>
  <text x="312" y="306" fill="%23FFFFFF" font-family="-apple-system, sans-serif" font-size="16" font-weight="900" font-style="italic">VISA</text>

  <!-- Quick Action Row -->
  <rect x="24" y="356" width="76" height="56" rx="14" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
  <path d="M62 376 L62 390 M56 382 L62 376 L68 382" stroke="%23818CF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <text x="48" y="403" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="11" font-weight="600">Send</text>

  <rect x="112" y="356" width="76" height="56" rx="14" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
  <path d="M145 378 L155 378 M151 374 L155 378 L151 382 M155 388 L145 388 M149 384 L145 388 L149 392" stroke="%23A855F7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <text x="136" y="403" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="11" font-weight="600">Swap</text>

  <rect x="202" y="356" width="76" height="56" rx="14" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
  <path d="M240 376 L240 390 M234 384 L240 390 L246 384" stroke="%2334D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <text x="221" y="403" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="11" font-weight="600">Deposit</text>

  <rect x="293" y="356" width="76" height="56" rx="14" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
  <circle cx="321" cy="383" r="2.5" fill="%23CBD5E1"/>
  <circle cx="331" cy="383" r="2.5" fill="%23CBD5E1"/>
  <circle cx="341" cy="383" r="2.5" fill="%23CBD5E1"/>
  <text x="320" y="403" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="11" font-weight="600">More</text>

  <!-- Recent Activity Header -->
  <text x="24" y="445" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="15" font-weight="700">Recent Transactions</text>
  <text x="335" y="445" fill="%23818CF8" font-family="-apple-system, sans-serif" font-size="12" font-weight="600">See All</text>

  <!-- Item 1 -->
  <rect x="24" y="462" width="345" height="58" rx="14" fill="%231E293B" fill-opacity="0.6" stroke="%23334155" stroke-width="0.8"/>
  <circle cx="53" cy="491" r="16" fill="%23312E81"/>
  <path d="M48 491 L58 491 M54 487 L58 491 L54 495" stroke="%23818CF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <text x="80" y="486" fill="%23FFFFFF" font-family="-apple-system, sans-serif" font-size="13" font-weight="600">Stripe Payout</text>
  <text x="80" y="503" fill="%2394A3B8" font-family="-apple-system, sans-serif" font-size="11">SaaS Subscriptions</text>
  <text x="296" y="495" fill="%2334D399" font-family="-apple-system, sans-serif" font-size="14" font-weight="bold">+$4,250.00</text>

  <!-- Item 2 -->
  <rect x="24" y="528" width="345" height="58" rx="14" fill="%231E293B" fill-opacity="0.6" stroke="%23334155" stroke-width="0.8"/>
  <circle cx="53" cy="557" r="16" fill="%230F766E"/>
  <text x="49" y="562" fill="%232DD4BF" font-family="-apple-system, sans-serif" font-size="13" font-weight="800">F</text>
  <text x="80" y="552" fill="%23FFFFFF" font-family="-apple-system, sans-serif" font-size="13" font-weight="600">Figma Professional</text>
  <text x="80" y="569" fill="%2394A3B8" font-family="-apple-system, sans-serif" font-size="11">Design Tools</text>
  <text x="325" y="561" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="14" font-weight="bold">-$15.00</text>

  <!-- Item 3 -->
  <rect x="24" y="594" width="345" height="58" rx="14" fill="%231E293B" fill-opacity="0.6" stroke="%23334155" stroke-width="0.8"/>
  <circle cx="53" cy="623" r="16" fill="%234338CA"/>
  <path d="M53 615 C50 615 48 618 48 622 C48 627 53 630 53 630 C53 630 58 627 58 622 C58 618 56 615 53 615 Z" fill="%23A5B4FC"/>
  <text x="80" y="618" fill="%23FFFFFF" font-family="-apple-system, sans-serif" font-size="13" font-weight="600">Apple Developer</text>
  <text x="80" y="635" fill="%2394A3B8" font-family="-apple-system, sans-serif" font-size="11">Annual Membership</text>
  <text x="325" y="627" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="14" font-weight="bold">-$99.00</text>

  <!-- Item 4 -->
  <rect x="24" y="660" width="345" height="58" rx="14" fill="%231E293B" fill-opacity="0.6" stroke="%23334155" stroke-width="0.8"/>
  <circle cx="53" cy="689" r="16" fill="%23065F46"/>
  <circle cx="53" cy="689" r="6" fill="%2334D399"/>
  <text x="80" y="684" fill="%23FFFFFF" font-family="-apple-system, sans-serif" font-size="13" font-weight="600">OpenAI Platform</text>
  <text x="80" y="701" fill="%2394A3B8" font-family="-apple-system, sans-serif" font-size="11">API Usage Bill</text>
  <text x="325" y="693" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="14" font-weight="bold">-$42.50</text>

  <!-- iOS Bottom Tab Bar -->
  <rect x="0" y="766" width="393" height="86" fill="%230F172A" fill-opacity="0.95" stroke="%231E293B" stroke-width="1"/>
  <circle cx="54" cy="796" r="14" fill="%236366F1" fill-opacity="0.2"/>
  <path d="M47 799 L54 792 L61 799 L61 804 L47 804 Z" fill="%23818CF8"/>
  <text x="44" y="814" fill="%23818CF8" font-family="-apple-system, sans-serif" font-size="9" font-weight="700">Home</text>
  <rect x="133" y="792" width="16" height="11" rx="2" stroke="%2394A3B8" stroke-width="1.5" fill="none"/>
  <text x="130" y="814" fill="%2394A3B8" font-family="-apple-system, sans-serif" font-size="9" font-weight="600">Cards</text>
  <path d="M222 801 L226 794 L230 799 L234 792" stroke="%2394A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <text x="219" y="814" fill="%2394A3B8" font-family="-apple-system, sans-serif" font-size="9" font-weight="600">Stats</text>
  <circle cx="316" cy="797" r="5" stroke="%2394A3B8" stroke-width="1.5" fill="none"/>
  <text x="307" y="814" fill="%2394A3B8" font-family="-apple-system, sans-serif" font-size="9" font-weight="600">Profile</text>
</svg>`;

// 3. Code Window Preset (For Developers)
const CODE_WINDOW_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="460" viewBox="0 0 800 460">
  <rect width="800" height="460" fill="%230B0F19"/>
  <rect x="24" y="24" width="752" height="412" rx="12" fill="%23111827" stroke="%231F2937" stroke-width="1.5"/>
  <circle cx="48" cy="48" r="6" fill="%23F43F5E"/>
  <circle cx="68" cy="48" r="6" fill="%23F59E0B"/>
  <circle cx="88" cy="48" r="6" fill="%2310B981"/>
  <text x="48" y="100" fill="%23E2E8F0" font-family="monospace" font-size="15"><tspan fill="%23818CF8">const</tspan> projects = [</text>
  <text x="72" y="130" fill="%23CBD5E1" font-family="monospace" font-size="15">{ name: <tspan fill="%2334D399">'Orbit'</tspan>, shipped: true },</text>
  <text x="72" y="160" fill="%23CBD5E1" font-family="monospace" font-size="15">{ name: <tspan fill="%2334D399">'Signal'</tspan>, shipped: false },</text>
  <text x="48" y="190" fill="%23E2E8F0" font-family="monospace" font-size="15">];</text>
  <text x="48" y="235" fill="%23E2E8F0" font-family="monospace" font-size="15"><tspan fill="%23818CF8">const</tspan> shipped = projects</text>
  <text x="72" y="265" fill="%23CBD5E1" font-family="monospace" font-size="15">.<tspan fill="%23FBBF24">filter</tspan>(project =&gt; project.shipped)</text>
  <text x="72" y="295" fill="%23CBD5E1" font-family="monospace" font-size="15">.<tspan fill="%23FBBF24">map</tspan>(project =&gt; project.name);</text>
  <text x="48" y="340" fill="%23E2E8F0" font-family="monospace" font-size="15"><tspan fill="%23818CF8">const</tspan> count = new Intl.NumberFormat(<tspan fill="%2334D399">'en-US'</tspan>);</text>
  <text x="48" y="375" fill="%23CBD5E1" font-family="monospace" font-size="15">console.<tspan fill="%2338BDF8">log</tspan>(shipped.join(<tspan fill="%2334D399">', '</tspan>));</text>
  <text x="48" y="405" fill="%23CBD5E1" font-family="monospace" font-size="15">console.<tspan fill="%2338BDF8">log</tspan>(count.format(shipped.length));</text>
</svg>`;

// 4. Viral Social Announcement / Creator Launch Card
const SOCIAL_LAUNCH_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="820" height="480" viewBox="0 0 820 480">
  <defs>
    <linearGradient id="badgeGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="%23EC4899"/>
      <stop offset="100%" stop-color="%238B5CF6"/>
    </linearGradient>
    <linearGradient id="glowGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="%236366F1" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="%23EC4899" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <rect width="820" height="480" fill="%230B0F19"/>
  <rect x="24" y="24" width="772" height="432" rx="16" fill="%23111827" stroke="%231F2937" stroke-width="1.5"/>
  <rect x="24" y="24" width="772" height="432" rx="16" fill="url(%23glowGrad)"/>
  
  <!-- Top Category Tag -->
  <rect x="52" y="56" width="138" height="28" rx="14" fill="url(%23badgeGrad)"/>
  <text x="70" y="75" fill="%23FFFFFF" font-family="-apple-system, sans-serif" font-size="11" font-weight="800" letter-spacing="1">NEW LAUNCH</text>
  <text x="202" y="75" fill="%2394A3B8" font-family="-apple-system, sans-serif" font-size="12">October 2026 Edition</text>
  
  <!-- Headline -->
  <text x="52" y="142" fill="%23FFFFFF" font-family="-apple-system, sans-serif" font-size="34" font-weight="900" letter-spacing="-0.5">Turn Raw Screenshots Into</text>
  <text x="52" y="184" fill="%2338BDF8" font-family="-apple-system, sans-serif" font-size="34" font-weight="900" letter-spacing="-0.5">Studio-Grade Product Visuals</text>
  
  <!-- Subtitle -->
  <text x="52" y="232" fill="%23CBD5E1" font-family="-apple-system, sans-serif" font-size="15">Create professional Twitter/X announcement graphics, LinkedIn carousels, and</text>
  <text x="52" y="258" fill="%23CBD5E1" font-family="-apple-system, sans-serif" font-size="15">Product Hunt launch cards in seconds. Zero design skills required.</text>
  
  <!-- Benefit Pills Row -->
  <rect x="52" y="306" width="200" height="40" rx="10" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
  <text x="68" y="331" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="12" font-weight="600">Instant Generation</text>
  
  <rect x="264" y="306" width="220" height="40" rx="10" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
  <text x="280" y="331" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="12" font-weight="600">Custom Brand Watermark</text>
  
  <rect x="496" y="306" width="190" height="40" rx="10" fill="%231E293B" stroke="%23334155" stroke-width="1"/>
  <text x="512" y="331" fill="%23F8FAFC" font-family="-apple-system, sans-serif" font-size="12" font-weight="600">Scan-To-Visit QR</text>
  
  <!-- Footer Social Proof -->
  <line x1="52" y1="382" x2="768" y2="382" stroke="%231F2937" stroke-width="1"/>
  <circle cx="68" cy="414" r="14" fill="%23312E81"/>
  <text x="63" y="419" fill="%23C7D2FE" font-family="-apple-system, sans-serif" font-size="11" font-weight="bold">DS</text>
  <text x="92" y="413" fill="%23F1F5F9" font-family="-apple-system, sans-serif" font-size="12" font-weight="700">DevSnapKit Creator Studio</text>
  <text x="92" y="429" fill="%2364748B" font-family="-apple-system, sans-serif" font-size="11">@DevSnapKit • 100% Client-Side Privacy</text>
  
  <text x="640" y="420" fill="%2334D399" font-family="-apple-system, sans-serif" font-size="13" font-weight="bold">Studio Quality</text>
</svg>`;

export const MOCKUP_PRESETS: MockupPreset[] = [
  {
    id: 'social',
    name: 'Social Launch',
    badge: 'Creator',
    title: 'feature_announcement.png — Social Card',
    svgDataUri: SOCIAL_LAUNCH_SVG
  },
  {
    id: 'saas',
    name: 'SaaS Dashboard',
    badge: 'Popular',
    title: 'dashboard.analytics — PulseSaaS',
    svgDataUri: SAAS_DASHBOARD_SVG
  },
  {
    id: 'mobile',
    name: 'Mobile App',
    badge: 'iOS 18',
    title: 'WalletApp • iOS',
    svgDataUri: MOBILE_APP_SVG
  },
  {
    id: 'code',
    name: 'Code Terminal',
    badge: 'Dev',
    title: 'App.tsx — DevSnapKit',
    svgDataUri: CODE_WINDOW_SVG
  }
];
