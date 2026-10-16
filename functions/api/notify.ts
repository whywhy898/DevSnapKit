// Cloudflare Pages Function helper: Notification Dispatcher
// Automatically alerts the founder (whywhy898@163.com) when an order is received or key events occur

export interface OrderNotificationPayload {
  orderId: string;
  txnId?: string;
  payerEmail: string;
  amount: string;
  currency?: string;
  licenseKey: string;
  timestamp?: string;
}

export interface NotifyEnv {
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL?: string;
  NOTIFICATION_WEBHOOK?: string;
}

export async function sendOrderNotification(payload: OrderNotificationPayload, env: NotifyEnv): Promise<{ success: boolean; message: string }> {
  const recipientEmail = env.NOTIFICATION_EMAIL || 'whywhy898@163.com';
  const timeStr = payload.timestamp || new Date().toISOString();
  
  console.log(`[Order Notification Triggered] Order: ${payload.orderId}, Txn: ${payload.txnId}, Payer: ${payload.payerEmail}, Amount: $${payload.amount}`);

  const results: string[] = [];

  // 1. Resend Email Dispatch (if RESEND_API_KEY is configured in Cloudflare Pages)
  if (env.RESEND_API_KEY) {
    try {
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
          <div style="background: linear-gradient(135deg, #6366f1, #a855f7); padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff;">🎉 DevSnapKit 收到新订单！</h1>
            <p style="margin: 6px 0 0; color: #e0e7ff; font-size: 14px;">恭喜！又有一位海外用户购买了 DevSnapKit Pro</p>
          </div>
          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="border-bottom: 1px solid #334155;">
                <td style="padding: 12px 0; color: #94a3b8;">支付金额:</td>
                <td style="padding: 12px 0; font-weight: 700; color: #34d399; font-size: 18px;">$${payload.amount} ${payload.currency || 'USD'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #334155;">
                <td style="padding: 12px 0; color: #94a3b8;">买家邮箱:</td>
                <td style="padding: 12px 0; font-weight: 600; color: #f8fafc;">${payload.payerEmail}</td>
              </tr>
              <tr style="border-bottom: 1px solid #334155;">
                <td style="padding: 12px 0; color: #94a3b8;">PayPal 交易单号:</td>
                <td style="padding: 12px 0; font-family: monospace; color: #cbd5e1;">${payload.txnId || payload.orderId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #334155;">
                <td style="padding: 12px 0; color: #94a3b8;">发放激活码:</td>
                <td style="padding: 12px 0; font-family: monospace; font-weight: 700; color: #818cf8;">${payload.licenseKey}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; color: #94a3b8;">支付时间:</td>
                <td style="padding: 12px 0; color: #94a3b8;">${timeStr}</td>
              </tr>
            </table>
            <div style="margin-top: 24px; text-align: center;">
              <a href="https://devsnapkit.com/admin" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">进入管理后台查看</a>
            </div>
          </div>
          <div style="background: #090d16; padding: 14px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b;">
            DevSnapKit Automation • <a href="https://devsnapkit.com" style="color: #64748b;">devsnapkit.com</a>
          </div>
        </div>
      `;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'DevSnapKit <orders@devsnapkit.com>',
          to: [recipientEmail],
          subject: `🎉 [DevSnapKit] 收到新订单！$${payload.amount} USD 来自 ${payload.payerEmail}`,
          html: emailHtml,
        }),
      });

      if (res.ok) {
        results.push('Email dispatched via Resend');
      } else {
        const errText = await res.text();
        console.warn('[Resend API Error]', errText);
        results.push(`Resend failed: ${errText}`);
      }
    } catch (e: any) {
      console.error('[Email Dispatch Error]', e);
      results.push(`Email error: ${e.message}`);
    }
  }

  // 2. Generic Webhook (ServerChan / Bark / Feishu / Telegram / Custom Webhook)
  if (env.NOTIFICATION_WEBHOOK) {
    try {
      const webhookRes = await fetch(env.NOTIFICATION_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: {
            content: `🎉 DevSnapKit 收到新订单！\n金额: $${payload.amount} ${payload.currency || 'USD'}\n买家: ${payload.payerEmail}\n订单号: ${payload.txnId || payload.orderId}\n激活码: ${payload.licenseKey}`,
          },
          title: '🎉 DevSnapKit 收到新订单！',
          content: `金额: $${payload.amount} USD | 买家: ${payload.payerEmail}`,
        }),
      });
      if (webhookRes.ok) {
        results.push('Webhook delivered');
      }
    } catch (e: any) {
      console.warn('[Webhook Delivery Error]', e);
    }
  }

  return {
    success: true,
    message: results.length > 0 ? results.join('; ') : 'Logged locally (No email provider configured)',
  };
}
