import { productCopy } from './productCopy';

export function ProUpsellContent() {
  return <section data-pro-benefits className="md:col-span-7 rounded-2xl border border-slate-800 bg-slate-950 p-3.5 sm:p-4 text-xs text-slate-300">
    <h4 className="text-sm font-bold text-white mb-3">Pro includes</h4>
    <ul className="space-y-3">
      {productCopy.benefits.map(benefit => <li key={benefit.title}>
        <p className="font-semibold text-white">{benefit.title}</p>
        <p className="text-[11px] leading-relaxed mt-0.5">{benefit.detail}</p>
      </li>)}
    </ul>
    <p className="text-[11px] leading-relaxed text-emerald-300 mt-3 pt-3 border-t border-slate-800">{productCopy.free}</p>
  </section>;
}
