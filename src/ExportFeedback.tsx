import { useEffect, useState } from 'react';

const dismissedKey = 'dsk_feedback_dismissed';
let dismissedInMemory = false;
export function ExportFeedback() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  useEffect(() => {
    let enabled = false, active = true;
    // Collection stays off unless the server confirms storage and deletion access.
    void fetch('/api/feedback', { credentials: 'omit' }).then(response => response.ok ? response.json() : null)
      .then(data => { if (active) enabled = data?.enabled === true; }).catch(() => {});
    const show = () => {
      if (!enabled) return;
      if (dismissedInMemory) return;
      try { if (sessionStorage.getItem(dismissedKey)) return; } catch {}
      setVisible(true);
    };
    window.addEventListener('dsk:download-started', show);
    return () => { active = false; window.removeEventListener('dsk:download-started', show); };
  }, []);
  const dismiss = () => {
    dismissedInMemory = true;
    try { sessionStorage.setItem(dismissedKey, '1'); } catch {}
    setVisible(false);
  };
  if (!visible) return null;
  return <aside className="export-feedback" aria-label="Export feedback" data-export-feedback>
    <button type="button" className="export-feedback-close" aria-label="Dismiss export feedback" onClick={dismiss}>×</button>
    <p className="export-feedback-kicker">DOWNLOAD STARTED ✓</p>
    <h2>What would make this better?</h2>
    <p>Share an idea or hear about what’s next. Both are optional.</p>
    {status === 'sent' ? <p role="status">Thanks for helping shape DevSnapKit.</p> : <form onSubmit={async event => {
      event.preventDefault(); if ((!email.trim() && !message.trim()) || status === 'sending') return;
      setStatus('sending');
      try {
        const url = window.DevSnapKitAnalytics?.endpoint('/api/feedback') || '/api/feedback';
        const response = await fetch(url, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), message: message.trim() }) });
        if (!response.ok) throw new Error('Unavailable');
        setStatus('sent');
      } catch { setStatus('error'); }
    }}>
      <label>Email <span>(optional)</span><input type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} aria-describedby="feedback-email-notice" placeholder="you@example.com" /></label>
      <small id="feedback-email-notice">Email is only used for product update notices and can be deleted on request anytime. <a href="mailto:support@devsnapkit.com">Request deletion</a>.</small>
      <label>I want this feature <span>(optional)</span><input type="text" maxLength={500} value={message} onChange={e => setMessage(e.target.value)} placeholder="One thing you wish you could do…" /></label>
      {status === 'error' && <p role="status">Couldn’t send that. Your download is unaffected. You can retry anytime.</p>}
      <div className="export-feedback-actions"><button type="button" onClick={dismiss}>No thanks</button><button type="submit" disabled={status === 'sending' || (!email.trim() && !message.trim())}>{status === 'sending' ? 'Sending…' : 'Send feedback'}</button></div>
    </form>}
  </aside>;
}
