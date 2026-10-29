import type { SeoFunnelData } from '../functions/lib/seo-funnel';

export default function SeoFunnel({ data }: { data?: SeoFunnelData }) {
  return (
    <section data-seo-funnel className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <h3 className="text-base font-bold text-white">SEO entry → first export · 30 days</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        按首次工具落地页统计匿名会话，包含搜索、社交及直接访问。每一步只计一次，且须完成前一步；导出包含生成下载图片或复制图片。
      </p>
      {!data?.available ? (
        <p role="status" className="mt-4 text-sm text-amber-300">入口归因数据暂不可用，需要 D1 统计连接。此处不会以零转化代替缺失数据。</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>{['首次入口', '访问', '进入编辑器', '上传截图', '成功导出', '导出率', '打开 Pro', '点击结账'].map(label => <th key={label} scope="col" className="py-3 pr-4 font-medium">{label}</th>)}</tr>
              </thead>
              <tbody>
                {data.rows.map(row => (
                  <tr key={row.entry} className="border-b border-slate-800/60 text-slate-200">
                    <th scope="row" className="py-4 pr-4 font-medium"><a href={row.entry} className="text-indigo-300 hover:text-indigo-200">{row.label}</a></th>
                    <td className="pr-4">{row.landings}</td><td className="pr-4">{row.editorOpens}</td>
                    <td className="pr-4">{row.uploads}</td><td className="pr-4">{row.exports}</td>
                    <td className="pr-4">{row.landings ? `${(100 * row.exports / row.landings).toFixed(1)}%` : '—'}</td>
                    <td className="pr-4">{row.proOpens}</td><td className="pr-4">{row.checkoutClicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            上线后开始累积；匿名会话不是独立人数。仅统计可保留会话的访问，关闭存储的访问不纳入此漏斗。打开 Pro 与结账点击为辅助指标，均不代表付款。
          </p>
        </>
      )}
    </section>
  );
}
