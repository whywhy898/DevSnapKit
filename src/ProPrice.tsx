import { proPricing, type ProPricing } from '../shared/pricing';

export function ProPrice({ pricing = proPricing }: { pricing?: Pick<ProPricing, 'displayPrice'> }) {
  return <>
    <span className="text-3xl sm:text-4xl font-black text-white">{pricing.displayPrice}</span>
    <span className="text-xs font-medium text-slate-300">Early bird</span>
  </>;
}
