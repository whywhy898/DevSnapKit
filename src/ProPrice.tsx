import { proPricing, type ProPricing } from '../shared/pricing';

export function ProPrice({ pricing = proPricing }: { pricing?: Pick<ProPricing, 'displayPrice' | 'compareAtPrice'> }) {
  return <>
    <span className="text-3xl sm:text-4xl font-black text-white">{pricing.displayPrice}</span>
    {pricing.compareAtPrice && <span className="text-sm text-slate-500 line-through">{pricing.compareAtPrice}</span>}
  </>;
}
