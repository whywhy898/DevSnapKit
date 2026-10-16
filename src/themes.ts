// Curated Background Gradients & Themes for DevSnapKit (32 Total Themes)

export interface PresetGradient {
  id: string;
  name: string;
  className: string;
  isPro?: boolean;
}

export const GRADIENTS: PresetGradient[] = [
  // Free Base Themes (12 themes)
  { id: 'aurora', name: 'Aurora Borealis', className: 'bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400' },
  { id: 'sunset', name: 'Sunset Coral', className: 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600' },
  { id: 'cyber', name: 'Cyberpunk', className: 'bg-gradient-to-tr from-fuchsia-600 via-purple-700 to-blue-600' },
  { id: 'emerald', name: 'Emerald Glow', className: 'bg-gradient-to-tr from-emerald-500 via-teal-600 to-sky-600' },
  { id: 'slate', name: 'Deep Slate', className: 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950' },
  { id: 'mesh-dark', name: 'Midnight Neon', className: 'bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950' },
  { id: 'atlantic', name: 'Atlantic Deep', className: 'bg-gradient-to-tr from-blue-950 via-indigo-900 to-slate-900' },
  { id: 'nordic', name: 'Nordic Glacier', className: 'bg-gradient-to-tr from-sky-500 via-teal-400 to-cyan-200 text-slate-900' },
  { id: 'tokyo', name: 'Tokyo Dusk', className: 'bg-gradient-to-tr from-indigo-950 via-purple-900 to-pink-600' },
  { id: 'forest', name: 'Forest Mist', className: 'bg-gradient-to-tr from-emerald-900 via-teal-800 to-slate-900' },
  { id: 'studio-dark', name: 'Studio Obsidian', className: 'bg-[#0b0f19] border border-slate-800/80' },
  { id: 'studio-light', name: 'Studio Silver', className: 'bg-gradient-to-b from-slate-100 to-slate-200 text-slate-800' },

  // Pro Premium Themes (20 themes)
  { id: 'peach', name: 'Warm Peach', className: 'bg-gradient-to-tr from-rose-400 via-orange-300 to-amber-200 text-slate-900', isPro: true },
  { id: 'ocean', name: 'Bioluminescence', className: 'bg-gradient-to-tr from-blue-900 via-cyan-800 to-emerald-500', isPro: true },
  { id: 'lava', name: 'Solar Flare', className: 'bg-gradient-to-tr from-red-600 via-amber-600 to-yellow-500', isPro: true },
  { id: 'minimal-dark', name: 'Onyx Carbon', className: 'bg-[#0f1117] border border-slate-800', isPro: true },
  { id: 'hyperion', name: 'Hyperion Gold', className: 'bg-gradient-to-tr from-amber-400 via-yellow-500 to-orange-600 text-slate-900', isPro: true },
  { id: 'velvet', name: 'Velvet Noir', className: 'bg-gradient-to-b from-zinc-900 via-neutral-900 to-black', isPro: true },
  { id: 'electric', name: 'Electric Violet', className: 'bg-gradient-to-tr from-violet-700 via-purple-600 to-fuchsia-500', isPro: true },
  { id: 'mojave', name: 'Mojave Dunes', className: 'bg-gradient-to-tr from-orange-500 via-amber-600 to-red-700', isPro: true },
  { id: 'synthwave', name: 'Retro Synthwave', className: 'bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-400', isPro: true },
  { id: 'mint-frost', name: 'Mint Frost', className: 'bg-gradient-to-tr from-teal-300 via-emerald-200 to-cyan-100 text-slate-900', isPro: true },
  { id: 'crimson', name: 'Crimson Nebula', className: 'bg-gradient-to-tr from-red-950 via-rose-900 to-zinc-950', isPro: true },
  { id: 'lavender', name: 'Lavender Cloud', className: 'bg-gradient-to-tr from-purple-200 via-pink-100 to-sky-100 text-slate-900', isPro: true },
  { id: 'lime-energy', name: 'Cyber Lime', className: 'bg-gradient-to-tr from-lime-500 via-emerald-500 to-cyan-500 text-slate-900', isPro: true },
  { id: 'beverly', name: 'Beverly Sunset', className: 'bg-gradient-to-tr from-rose-500 via-pink-600 to-violet-700', isPro: true },
  { id: 'amethyst', name: 'Royal Amethyst', className: 'bg-gradient-to-tr from-purple-950 via-violet-900 to-fuchsia-950', isPro: true },
  { id: 'laguna', name: 'Laguna Beach', className: 'bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-700', isPro: true },
  { id: 'champagne', name: 'Champagne Luxe', className: 'bg-gradient-to-tr from-amber-100 via-yellow-100 to-orange-50 text-slate-900', isPro: true },
  { id: 'carbon-mesh', name: 'Titanium Slate', className: 'bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950', isPro: true },
  { id: 'neon-matrix', name: 'Neon Matrix', className: 'bg-gradient-to-tr from-emerald-950 via-green-900 to-teal-950', isPro: true },
  { id: 'deep-space', name: 'Cosmic Void', className: 'bg-gradient-to-br from-black via-slate-950 to-indigo-950', isPro: true },
];
