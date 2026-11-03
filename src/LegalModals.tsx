import React from 'react';
import { ShieldCheck, Mail, CheckCircle2, X } from 'lucide-react';
import legal from './legal/legalContent.json';
import { LegalSections } from './legal/LegalDocument';

export type LegalModalType = 'terms' | 'privacy' | 'refund' | 'contact' | null;

interface LegalModalsProps {
  activeModal: LegalModalType;
  onClose: () => void;
}

export const LegalModals: React.FC<LegalModalsProps> = ({ activeModal, onClose }) => {
  if (!activeModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Privacy Policy & Terms of Service: text lives in ./legal/legalContent.json, shared with /privacy/ and /terms/ */}
        {activeModal === 'privacy' && (
          <div className="space-y-4 text-slate-300 text-sm">
            <div className="flex items-center gap-2 text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
              <h2 className="text-xl font-black text-white">{legal.privacy.title}</h2>
            </div>
            <p className="text-xs text-slate-400">{legal.privacy.date}</p>

            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>{legal.privacy.callout.label}</strong> {legal.privacy.callout.text}
              </div>
            </div>

            <LegalSections sections={legal.privacy.sections} />
          </div>
        )}

        {activeModal === 'terms' && (
          <div className="space-y-4 text-slate-300 text-sm">
            <h2 className="text-xl font-black text-white">{legal.terms.title}</h2>
            <p className="text-xs text-slate-400">{legal.terms.date}</p>

            <LegalSections sections={legal.terms.sections} />
          </div>
        )}

        {/* Refund Policy */}
        {activeModal === 'refund' && (
          <div className="space-y-4 text-slate-300 text-sm">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
              <h2 className="text-xl font-black text-white">30-Day Money-Back Guarantee</h2>
            </div>
            <p className="text-xs text-slate-400">Zero Risk • 100% Satisfaction Guarantee</p>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <p className="font-semibold text-white">We want you to be 100% delighted with DevSnapKit.</p>
              <p>
                If DevSnapKit does not save you hours of design time or make your product look significantly more professional, simply email us within <strong>30 days of purchase</strong> and we will issue a full 100% refund to your original PayPal or Card payment method.
              </p>
            </div>

            <h3 className="text-base font-bold text-white pt-2">How to Request a Refund</h3>
            <p>
              Send an email to <a href="mailto:support@devsnapkit.com" className="text-indigo-400 underline font-mono">support@devsnapkit.com</a> with:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
              <li>Your PayPal Transaction ID or Payer Email</li>
              <li>Optional: A brief sentence on how we can improve (appreciated, but not required)</li>
            </ul>
            <p className="text-xs text-slate-400">
              Refunds are processed within 12 business hours.
            </p>
          </div>
        )}

        {/* Contact Support */}
        {activeModal === 'contact' && (
          <div className="space-y-4 text-slate-300 text-sm">
            <div className="flex items-center gap-2 text-indigo-400">
              <Mail className="w-6 h-6" />
              <h2 className="text-xl font-black text-white">Contact & Founder Support</h2>
            </div>
            <p className="text-slate-400">
              DevSnapKit is crafted and maintained with care. Have feedback, a feature request, or need help with your license?
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Official Support & Founder Email</span>
                <a href="mailto:support@devsnapkit.com" className="text-indigo-400 font-bold hover:underline">support@devsnapkit.com</a>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Response Guarantee</span>
                <span className="text-slate-300">Within 12 hours (7 days a week)</span>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
