import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Users, Activity, ShoppingCart, 
  RefreshCw, Globe, 
  Search, Shield, Check, Copy, ExternalLink,
  Lock, Eye, EyeOff, BarChart3, AlertTriangle,
  Sparkles, Database, Layers, Upload,
  Settings, X, Tag, Palette, CreditCard, Download, Trash2
} from 'lucide-react';

interface StatsData {
  timestamp: string;
  system: {
    storageEngine: string;
    isD1Connected: boolean;
    isKvConnected: boolean;
    isEmailConfigured: boolean;
    notificationRecipient: string;
  };
  overview: {
    todayPv: number;
    todayUv: number;
    todayUploads: number;
    todayTrials: number;
    todayExports: number;
    todayOrders: number;
    todayRevenue: number;
    totalPv: number;
    totalUv: number;
    totalUploads: number;
    totalTrials: number;
    totalExports: number;
    totalOrders: number;
    totalRevenue: number;
    conversionRate: string;
  };
  dailyTrends: Array<{
    date: string;
    pv: number;
    uv: number;
    uploads: number;
    trials: number;
    exports: number;
    orders: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    orderId: string;
    txnId: string;
    payerEmail: string;
    amount: string;
    currency: string;
    status: string;
    licenseKey: string;
    createdAt: string;
  }>;
  topCountries: Array<{ country: string; count: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
  recentVisits?: Array<{
    id: number;
    event_type: string;
    session_id: string;
    path: string;
    referrer: string;
    country: string;
    device_type: string;
    browser: string;
    created_at: string;
  }>;
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [secretInput, setSecretInput] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const [orderSearch, setOrderSearch] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'setup'>('overview');

  // Check saved admin token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('devsnapkit_admin_token');
    localStorage.removeItem('devsnapkit_admin_secret');
    if (savedToken) {
      setIsAuthenticated(true);
      fetchStats(savedToken);
    }
  }, []);

  // Periodic auto-refresh (silent background sync)
  useEffect(() => {
    if (!isAuthenticated || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchStats(undefined, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, autoRefresh]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretInput.trim()) {
      setLoginError('Please enter the Admin Secret Key.');
      return;
    }
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: secretInput.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('devsnapkit_admin_token', data.token || '');
        localStorage.removeItem('devsnapkit_admin_secret');
        setSecretInput('');
        fetchStats(data.token);
      } else {
        setLoginError(data.error || 'Authentication failed. Please verify your secret key.');
      }
    } catch (err: any) {
      setLoginError('Network error connecting to /api/admin/auth: ' + err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('devsnapkit_admin_token');
    localStorage.removeItem('devsnapkit_admin_secret');
    setIsAuthenticated(false);
    setStats(null);
  };

  const fetchStats = async (tokenOverride?: string, isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
      setLoadError('');
    } else {
      setSyncStatus('syncing');
    }

    const token = tokenOverride || localStorage.getItem('devsnapkit_admin_token') || '';

    const executeFetch = async (attempt = 1): Promise<boolean> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/admin/stats', { 
          headers,
          signal: controller.signal 
        });
        clearTimeout(timeoutId);

        const data = await res.json();

        if (data.success) {
          setStats(data);
          setLoadError('');
          setSyncStatus('synced');
          return true;
        } else {
          if (!isBackground) {
            setLoadError(data.error || 'Failed to load stats');
          }
          if (res.status === 401) {
            handleLogout();
          }
          return false;
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        // On network error or timeout, auto-retry once
        if (attempt === 1) {
          await new Promise(r => setTimeout(r, 1500));
          return executeFetch(2);
        }

        if (isBackground) {
          setSyncStatus('offline');
        } else {
          setLoadError('Failed to fetch dashboard data: ' + (err.name === 'AbortError' ? 'Connection timed out' : err.message));
        }
        return false;
      }
    };

    try {
      await executeFetch(1);
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const [isClearing, setIsClearing] = useState<boolean>(false);

  const handleClearVisits = async () => {
    if (!window.confirm('确定要清空所有的历史访问与行为数据吗？\n\n注意：此操作将清空 PV、UV、试用与导出等所有统计记录（不会影响真实付费订单）。')) {
      return;
    }

    setIsClearing(true);
    try {
      const token = localStorage.getItem('devsnapkit_admin_token') || '';
      const res = await fetch('/api/admin/stats', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        await fetchStats();
        alert('已成功清空所有访问记录！');
      } else {
        alert('清空失败: ' + (data.error || '未知错误'));
      }
    } catch (err: any) {
      alert('清空请求出错: ' + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  const toggleRevealKey = (id: string) => {
    setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // If not logged in, render Secure Login Portal
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">DevSnapKit Admin</h1>
              <p className="text-xs text-slate-400">Founder Analytics & Order Center</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Admin Secret Key (管理口令)
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  placeholder="Enter your configured admin secret key"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Use the admin secret configured on your server. There is no default password.
              </p>
            </div>

            {loginError && (
              <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Enter Dashboard</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <a 
              href="/" 
              className="text-xs text-slate-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
            >
              ← Back to DevSnapKit App
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Filter orders
  const filteredOrders = (stats?.recentOrders || []).filter(order => {
    const q = orderSearch.toLowerCase();
    return (
      order.payerEmail.toLowerCase().includes(q) ||
      order.orderId.toLowerCase().includes(q) ||
      order.txnId.toLowerCase().includes(q) ||
      order.licenseKey.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-black text-sm tracking-wide text-white">DevSnapKit</span>
              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700/60 text-indigo-300">
                ADMIN CONSOLE
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 ml-6 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Overview & Traffic</span>
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Orders & Revenue ({stats?.overview?.totalOrders || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('setup')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'setup'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Cloudflare / Email Guide</span>
            </button>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="hidden lg:flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <div className={`w-2 h-2 rounded-full ${stats?.system?.isD1Connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300">
              {stats?.system?.isD1Connected ? 'D1 Database Online' : stats?.system?.isKvConnected ? 'KV Cache Online' : 'Standalone Mode'}
            </span>
          </div>

          {syncStatus === 'offline' && (
            <span className="hidden xl:inline-flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>网络稍有波动，下次将自动同步</span>
            </span>
          )}

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              autoRefresh 
                ? 'bg-indigo-950/40 border-indigo-700/50 text-indigo-300' 
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle auto-refresh every 30s"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-indigo-400' : 'bg-slate-600'}`} />
            <span>Auto (30s)</span>
          </button>

          <button
            onClick={() => fetchStats()}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-lg transition-colors border border-slate-700/50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            onClick={handleClearVisits}
            disabled={isClearing || isLoading}
            className="p-2 text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 rounded-lg transition-colors border border-rose-800/50"
            title="清空历史访问记录 (Clear Visit Logs)"
          >
            <Trash2 className={`w-4 h-4 ${isClearing ? 'animate-pulse' : ''}`} />
          </button>

          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 px-3 py-1.5 rounded-lg transition-colors border border-slate-700/50"
          >
            <span>Live Site</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={handleLogout}
            className="text-xs text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loadError && (
          <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-sm text-red-200 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{loadError}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchStats()}
                disabled={isLoading}
                className="text-xs bg-red-900/80 px-3 py-1.5 rounded-lg font-semibold hover:bg-red-800 transition-colors"
              >
                {isLoading ? '重试中...' : '点击重试 (Retry)'}
              </button>
              <button
                onClick={() => setLoadError('')}
                className="text-xs text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                title="关闭提示"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* System Notification Banner if D1 not yet bound */}
        {stats && !stats.system.isD1Connected && !stats.system.isKvConnected && (
          <div className="p-4 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-700/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-200">Cloudflare D1 数据库尚未绑定到当前 Pages 项目</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  目前运行在独立前端模式。要启用永久 SQL 统计存储，只需在 Cloudflare 控制台将 D1 绑定为变量名 <code className="bg-slate-800 text-amber-300 px-1 py-0.5 rounded">DB</code>。
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('setup')}
              className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl transition-colors shrink-0 shadow-sm"
            >
              查看 1 分钟绑定教程 →
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW & TRAFFIC */}
        {activeTab === 'overview' && (
          <>
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Card 1: Revenue */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Total Revenue (总营收)</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    ${(stats?.overview?.totalRevenue || 0).toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400">USD</span>
                </div>
                <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                  <span>Today: +${(stats?.overview?.todayRevenue || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Card 2: Orders */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Paid Orders (付款订单)</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    {stats?.overview?.totalOrders || 0}
                  </span>
                  <span className="text-xs text-slate-400">orders</span>
                </div>
                <div className="mt-2 text-xs text-indigo-400 flex items-center gap-1">
                  <span>Today: +{stats?.overview?.todayOrders || 0} new</span>
                </div>
              </div>

              {/* Card 3: Unique Visitors */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Daily Active (今日独立访客 UV)</span>
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    {stats?.overview?.todayUv || 0}
                  </span>
                  <span className="text-xs text-slate-400">UV today</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Total views: {stats?.overview?.totalPv || 0} PV
                </div>
              </div>

              {/* Card 4: Image Uploads */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Uploads (图片上传数)</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400">
                    <Upload className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    {stats?.overview?.totalUploads || 0}
                  </span>
                  <span className="text-xs text-slate-400">uploads</span>
                </div>
                <div className="mt-2 text-xs text-blue-400">
                  Today: +{stats?.overview?.todayUploads || 0} (截图 & Logo)
                </div>
              </div>

              {/* Card 5: Trials & Exports */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Exports (导出与试用)</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    {stats?.overview?.totalExports || 0}
                  </span>
                  <span className="text-xs text-slate-400">exports</span>
                </div>
                <div className="mt-2 text-xs text-purple-400">
                  Trials: {stats?.overview?.totalTrials || 0} (试用交互)
                </div>
              </div>
            </div>

            {/* 14-Day Traffic & Activity Trend Visualizer */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <span>Daily Traffic & Exports Trend (近14天每日活跃与使用趋势)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    青色: 独立访客 (UV) • 蓝色: 浏览 (PV) • 琥珀色: 功能试用 • 天蓝: 图片上传 • 紫色: 导出量 • 金色: 订单数
                  </p>
                </div>
              </div>

              {stats?.dailyTrends && stats.dailyTrends.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-2 text-center text-[10px] text-slate-500 font-semibold uppercase tracking-wider pb-1 border-b border-slate-800">
                    <div className="col-span-3 text-left">Date (日期)</div>
                    <div className="col-span-1 text-cyan-400">UV</div>
                    <div className="col-span-1 text-indigo-400">PV</div>
                    <div className="col-span-2 text-amber-400">Trials (试用)</div>
                    <div className="col-span-2 text-blue-400">Uploads (上传)</div>
                    <div className="col-span-2 text-purple-400">Exports (导出)</div>
                    <div className="col-span-1 text-emerald-400">Orders</div>
                  </div>

                  {stats.dailyTrends.map((day, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs py-2 px-1 hover:bg-slate-800/40 rounded-lg transition-colors border-b border-slate-800/40">
                      <div className="col-span-3 font-medium text-slate-300 font-mono text-[11px] truncate">
                        {day.date}
                      </div>
                      <div className="col-span-1 text-center font-bold text-cyan-300">
                        {day.uv}
                      </div>
                      <div className="col-span-1 text-center font-bold text-indigo-300">
                        {day.pv}
                      </div>
                      <div className="col-span-2 text-center font-semibold text-amber-300">
                        {day.trials || 0}
                      </div>
                      <div className="col-span-2 text-center font-semibold text-blue-300">
                        {day.uploads || 0}
                      </div>
                      <div className="col-span-2 text-center font-semibold text-purple-300">
                        {day.exports}
                      </div>
                      <div className="col-span-1 text-center font-bold text-emerald-300">
                        {day.orders > 0 ? (
                          <span className="bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-800 font-bold text-[10px]">
                            +{day.orders}
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  暂无历史趋势数据。一旦有海外用户访问或使用软件，数据将实时展示在这里。
                </div>
              )}
            </div>

            {/* Two Column Grid: Top Countries & Funnel Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Geographic Distribution */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>Top Visitor Countries (海外访客国家分布)</span>
                </h3>
                {stats?.topCountries && stats.topCountries.length > 0 ? (
                  <div className="space-y-2.5">
                    {stats.topCountries.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-500 font-bold w-4">{i + 1}.</span>
                          <span className="font-bold text-slate-200 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{c.country}</span>
                          </span>
                        </div>
                        <span className="font-semibold text-cyan-400">{c.count} visits</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    暂无国家访问数据（等待访客上报）。
                  </div>
                )}
              </div>

              {/* Conversion Funnel */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>Conversion Funnel (5阶转化漏斗分析)</span>
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-200">1. 访问网页 (Page Views / UV)</div>
                      <div className="text-[11px] text-slate-400">进入 DevSnapKit 首页</div>
                    </div>
                    <span className="font-mono font-bold text-cyan-400 text-sm">
                      {stats?.overview?.totalPv || 0} PV ({stats?.overview?.totalUv || 0} UV)
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-200">2. 试用预设与调色 (Feature Trials)</div>
                      <div className="text-[11px] text-slate-400">切换演示图、渐变与背景</div>
                    </div>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {stats?.overview?.totalTrials || 0}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-200">3. 上传图片或截图 (Image Uploads)</div>
                      <div className="text-[11px] text-slate-400">用户主动上传本地图片或品牌Logo</div>
                    </div>
                    <span className="font-mono font-bold text-blue-400 text-sm">
                      {stats?.overview?.totalUploads || 0}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-200">4. 制作并导出图片 (Mockup Exports)</div>
                      <div className="text-[11px] text-slate-400">下载高清图片或复制到剪贴板</div>
                    </div>
                    <span className="font-mono font-bold text-purple-400 text-sm">
                      {stats?.overview?.totalExports || 0}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-200">5. 付费购买 Pro (Paid Orders)</div>
                      <div className="text-[11px] text-slate-400">完成 PayPal 结账并获取终身授权</div>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {stats?.overview?.totalOrders || 0}
                    </span>
                  </div>

                  <div className="mt-3 p-2.5 bg-indigo-950/30 border border-indigo-800/40 rounded-xl text-center">
                    <span className="text-slate-400">访客到付费整体转化率: </span>
                    <span className="font-bold text-indigo-300 ml-1">{stats?.overview?.conversionRate || '0.00%'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Visitor Activity Stream (实时访客流明细) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Live Visitor Feed (实时访客事件明细流)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    展示最近访问你网站的真实访客事件、国家、设备与来源明细
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Recent {stats?.recentVisits?.length || 0} events
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">Time (时间)</th>
                      <th className="px-4 py-2.5">Country (国家)</th>
                      <th className="px-4 py-2.5">Event (行为)</th>
                      <th className="px-4 py-2.5">Device / Browser</th>
                      <th className="px-4 py-2.5">Source (来源)</th>
                      <th className="px-4 py-2.5">Session ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {stats?.recentVisits && stats.recentVisits.length > 0 ? (
                      stats.recentVisits.map((v, i) => (
                        <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-2.5 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                            {v.created_at ? new Date(v.created_at).toLocaleTimeString() : 'Just now'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-bold text-slate-200">
                              <Globe className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{v.country || 'Unknown'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                              v.event_type === 'page_view'
                                ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
                                : v.event_type === 'upload_image'
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                                : v.event_type === 'upload_logo'
                                ? 'bg-teal-950/80 text-teal-300 border border-teal-800/60'
                                : v.event_type === 'preset_change'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                                : v.event_type === 'theme_change'
                                ? 'bg-pink-950/80 text-pink-300 border border-pink-800/60'
                                : v.event_type === 'export_image'
                                ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                                : v.event_type === 'copy_image'
                                ? 'bg-violet-950/80 text-violet-300 border border-violet-800/60'
                                : v.event_type === 'checkout_click'
                                ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {v.event_type === 'page_view' ? <><Eye className="w-3 h-3" /><span>Page View</span></> :
                               v.event_type === 'upload_image' ? <><Upload className="w-3 h-3" /><span>Upload Image</span></> :
                               v.event_type === 'upload_logo' ? <><Tag className="w-3 h-3" /><span>Upload Logo</span></> :
                               v.event_type === 'preset_change' ? <><Palette className="w-3 h-3" /><span>Try Sample</span></> :
                               v.event_type === 'theme_change' ? <><Sparkles className="w-3 h-3" /><span>Switch Theme</span></> :
                               v.event_type === 'export_image' ? <><Download className="w-3 h-3" /><span>Export Mockup</span></> :
                               v.event_type === 'copy_image' ? <><Copy className="w-3 h-3" /><span>Copy Image</span></> :
                               v.event_type === 'checkout_click' ? <><CreditCard className="w-3 h-3" /><span>PayPal Click</span></> :
                               <span>{v.event_type}</span>}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-300 text-[11px] whitespace-nowrap">
                            {v.device_type || 'desktop'} • {v.browser || 'browser'}
                          </td>
                          <td className="px-4 py-2.5 text-slate-400 text-[11px] whitespace-nowrap">
                            {v.referrer || 'direct'}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                            {v.session_id ? v.session_id.slice(0, 14) + '...' : 'anon'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-slate-500 text-xs">
                          暂无访客明细流数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: ORDERS MANAGEMENT */}
        {activeTab === 'orders' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-indigo-400" />
                  <span>Real-Time PayPal Orders (实时订单与授权码发放记录)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  记录每笔真实 PayPal 付款流水，包括付款人邮箱、实付金额、交易单号与 Pro 授权密钥
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search email, order ID, txn ID..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Time (时间)</th>
                    <th className="px-4 py-3">Customer Email (买家)</th>
                    <th className="px-4 py-3">Amount (金额)</th>
                    <th className="px-4 py-3">Txn ID (交易号)</th>
                    <th className="px-4 py-3">License Key (激活码)</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order, i) => (
                      <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                          {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                          {order.payerEmail}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-400 whitespace-nowrap">
                          ${order.amount} {order.currency || 'USD'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          <button
                            onClick={() => copyToClipboard(order.txnId, `txn-${i}`)}
                            className="inline-flex items-center gap-1 hover:text-white"
                            title="Click to copy"
                          >
                            <span>{order.txnId.slice(0, 12)}...</span>
                            {copiedKey === `txn-${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-indigo-300 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>
                              {revealedKeys[order.orderId] 
                                ? order.licenseKey 
                                : (order.licenseKey ? order.licenseKey.slice(0, 8) + '••••••••' : 'N/A')}
                            </span>
                            <button
                              onClick={() => toggleRevealKey(order.orderId)}
                              className="text-slate-500 hover:text-slate-300"
                              title={revealedKeys[order.orderId] ? 'Hide' : 'Reveal'}
                            >
                              {revealedKeys[order.orderId] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => copyToClipboard(order.licenseKey, `key-${i}`)}
                              className="text-slate-500 hover:text-indigo-400"
                              title="Copy License"
                            >
                              {copiedKey === `key-${i}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-400">
                            {order.status || 'COMPLETED'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        {orderSearch ? '未匹配到包含搜索词的订单' : '暂无订单记录。一旦有买家在 devsnapkit.com 付款，订单将立即展示在此处并推送邮件。'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CLOUDFLARE & EMAIL SETUP GUIDE */}
        {activeTab === 'setup' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>系统配置与出海基础设施状态 (Setup & Health)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                详细配置指南：Cloudflare 原生 D1 绑定、Cloudflare Web Analytics 以及出单邮件通知
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Box 1: Cloudflare D1 */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-200">1. Cloudflare D1</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    stats?.system?.isD1Connected ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {stats?.system?.isD1Connected ? '已绑定 (Active)' : '待绑定 (Pending)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  用于持久化存储每日访问事件与真实订单。
                </p>
                <div className="pt-2 text-[11px] text-slate-400 space-y-1">
                  <div>1. 登录 <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">dash.cloudflare.com</a></div>
                  <div>2. 进入 <b>Workers & Pages</b> → <b>D1</b> → 创建 <code>devsnapkit-db</code></div>
                  <div>3. 进入 Pages 项目 <code>devsnapkit</code> → <b>Settings</b> → <b>Functions</b></div>
                  <div>4. <b>D1 database bindings</b>: 变量名填 <code>DB</code></div>
                </div>
              </div>

              {/* Box 2: Cloudflare Web Analytics */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-200">2. Web Analytics</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
                    Cloudflare 原生
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  官方免费零 Cookie 流量分析（访客国家、设备、页面加载性能）。
                </p>
                <div className="pt-2 text-[11px] text-slate-400 space-y-1">
                  <div>在 Cloudflare Pages 项目设置中：</div>
                  <div>进入 <b>Settings</b> → <b>Web Analytics</b> → 点击 <b>Enable Web Analytics</b> 即可自动注入探针！</div>
                </div>
              </div>

              {/* Box 3: Email Alerts */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-200">3. 出单邮件通知</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-indigo-950 text-indigo-400 border border-indigo-800">
                    目标: whywhy898@163.com
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  买家完成 PayPal 支付时，系统自动发送邮件到你的邮箱。
                </p>
                <div className="pt-2 text-[11px] text-slate-400 space-y-1">
                  <div>推荐在 Pages 环境变量配置 <code>RESEND_API_KEY</code>（来自 resend.com，免费注册即可每月发 3000 封）。</div>
                  <div>若未配置密钥，订单仍会在控制台与当前管理面板安全存储。</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
        DevSnapKit Admin Suite • Private & Secure • <a href="https://devsnapkit.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">devsnapkit.com</a>
      </footer>
    </div>
  );
}
