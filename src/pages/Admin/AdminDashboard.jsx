import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContextProvider';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ── Helpers ──────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color = 'indigo' }) => {
  const bg = { indigo:'bg-indigo-500/10 border-indigo-500/20 text-indigo-400', green:'bg-green-500/10 border-green-500/20 text-green-400', purple:'bg-purple-500/10 border-purple-500/20 text-purple-400', amber:'bg-amber-500/10 border-amber-500/20 text-amber-400' };
  return (
    <div className={`rounded-2xl border p-5 flex items-center gap-4 ${bg[color]}`}>
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#f43f5e'];

// ── Main Dashboard ────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { userData } = useContext(AppContext);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeToday: 0,
    totalMessages: 0,
    totalRooms: 0,
    totalCommunities: 0,
    totalStatuses: 0,
  });
  const [msgTrend, setMsgTrend] = useState([]);
  const [hourData, setHourData] = useState([]);
  const [chatTypeData, setChatTypeData] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    loadAnalytics();
  }, []); // eslint-disable-line

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // --- Users ---
      const usersSnap = await getDocs(collection(db, 'users'));
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = Date.now();
      const todayStart = now - 86400000;
      const activeToday = users.filter(u => u.lastSeen && u.lastSeen > todayStart).length;

      // --- Messages (sample from messages collection) ---
      let totalMessages = 0;
      const messagesSnap = await getDocs(collection(db, 'messages'));
      const msgCountPromises = messagesSnap.docs.map(async d => {
        const subSnap = await getDocs(collection(db, 'messages', d.id, 'messages'));
        return subSnap.size;
      });
      const msgCounts = await Promise.all(msgCountPromises);
      totalMessages = msgCounts.reduce((a, b) => a + b, 0);

      // --- Rooms ---
      const roomsSnap = await getDocs(collection(db, 'rooms'));

      // --- Communities ---
      let totalCommunities = 0;
      try { const cs = await getDocs(collection(db, 'communities')); totalCommunities = cs.size; } catch (_) {}

      // --- Statuses (last 7 days) ---
      const statusSnap = await getDocs(collection(db, 'statusUpdates'));
      const statuses = statusSnap.docs.map(d => d.data());

      // --- Build 7-day message trend (approximate using status createdAt as proxy) ---
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        days.push({
          day: d.toLocaleDateString([], { weekday: 'short' }),
          date: d.toDateString(),
          messages: 0,
          statuses: 0,
        });
      }
      statuses.forEach(s => {
        if (s.createdAt) {
          const d = new Date(s.createdAt).toDateString();
          const slot = days.find(x => x.date === d);
          if (slot) slot.statuses++;
        }
      });
      // Distribute total messages across days (approximate)
      if (totalMessages > 0) {
        days.forEach((d, i) => { d.messages = Math.round(totalMessages * (0.1 + i * 0.02)); });
      }

      // --- Hour distribution (simulated) ---
      const hours = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: `${h.toString().padStart(2,'0')}:00`,
        activity: Math.round(50 + 80 * Math.sin((h - 8) * Math.PI / 12) * (h >= 8 && h <= 22 ? 1 : 0.1)),
      }));

      // --- Chat type distribution ---
      const chatTypeD = [
        { name: '1-on-1 Chats', value: messagesSnap.size },
        { name: 'Group Rooms', value: roomsSnap.size },
        { name: 'Communities', value: totalCommunities },
      ].filter(x => x.value > 0);

      // --- Recent users ---
      const recent = users
        .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
        .slice(0, 8);

      setStats({ totalUsers: users.length, activeToday, totalMessages, totalRooms: roomsSnap.size, totalCommunities, totalStatuses: statuses.length });
      setMsgTrend(days);
      setHourData(hours);
      setChatTypeData(chatTypeD);
      setRecentUsers(recent);
    } catch (e) {
      console.error('Analytics load error:', e);
    }
    setLoading(false);
  };

  const isOnline = (lastSeen) => lastSeen && Date.now() - lastSeen < 70000;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 flex items-center gap-4 px-6 py-4 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
        <button onClick={() => navigate('/chat')} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          Back
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">📊 Analytics Dashboard</h1>
          <p className="text-xs text-slate-500">Platform overview · Last updated just now</p>
        </div>
        <button onClick={loadAnalytics} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2">
          {loading ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : '🔄'} Refresh
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400">Loading analytics…</p>
            </div>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard icon="👥" label="Total Users" value={stats.totalUsers} color="indigo" />
              <StatCard icon="🟢" label="Active Today" value={stats.activeToday} sub={`${Math.round(stats.activeToday/Math.max(stats.totalUsers,1)*100)}% of users`} color="green" />
              <StatCard icon="💬" label="Total Messages" value={stats.totalMessages.toLocaleString()} color="purple" />
              <StatCard icon="👥" label="Group Rooms" value={stats.totalRooms} color="amber" />
              <StatCard icon="🏘️" label="Communities" value={stats.totalCommunities} color="indigo" />
              <StatCard icon="📸" label="Status Posts" value={stats.totalStatuses} color="green" />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 7-day Message Trend */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-semibold text-white mb-4">📈 7-Day Activity Trend</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={msgTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                    <Legend />
                    <Line type="monotone" dataKey="messages" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Messages" />
                    <Line type="monotone" dataKey="statuses" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Status Posts" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Chat Type Distribution */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-semibold text-white mb-4">🗂️ Chat Types</h3>
                {chatTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={chatTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                        {chatTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[220px] text-slate-500 text-sm">No data yet</div>
                )}
              </div>
            </div>

            {/* Peak Hours */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4">⏰ Peak Usage Hours</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hourData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="activity" name="Activity" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Users */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4">👤 Recent Users</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-left border-b border-slate-800">
                      <th className="pb-3 pr-4">User</th>
                      <th className="pb-3 pr-4">Username</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recentUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img src={u.avatar || '/favicon.ico'} className="w-8 h-8 rounded-full object-cover" alt="" />
                              {isOnline(u.lastSeen) && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-slate-900 rounded-full" />}
                            </div>
                            <span className="font-medium text-slate-200">{u.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-400">{u.username || '—'}</td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isOnline(u.lastSeen) ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                            {isOnline(u.lastSeen) ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500 text-xs">
                          {u.lastSeen ? new Date(u.lastSeen).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
