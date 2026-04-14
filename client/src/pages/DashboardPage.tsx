import { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, TrendingUp, AlertTriangle, Activity, DollarSign } from 'lucide-react';
import { cn } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  activeMembers: number;
  expiringSoon: number;
  monthlyRevenue: number;
  expiringList: Array<{ FullName: string, PlanName: string, DaysLeft: number }>;
  revenueHistory: Array<{ MonthName: string, Total: number }>; 
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/stats`)
      .then(res => setStats(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-[#D4FF00] font-mono animate-pulse">Cargando Panel de Control...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Título */}
      <div>
        <h2 className="text-3xl font-heading font-bold text-white uppercase tracking-tight">Panel de Mando</h2>
        <p className="text-[#e4e4e7] font-mono text-sm">Resumen de actividad en tiempo real</p>
      </div>

      {/* Grid de KPIs (Indicadores Clave) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Activos */}
        <StatCard 
          title="Atletas Activos" 
          value={stats?.activeMembers} 
          icon={<Users className="text-blue-400" />} 
          trend="+5% vs mes anterior"
        />

        {/* Card 2: Ingresos (Mes) */}
        <StatCard 
          title="Ingresos (30d)" 
          value={`$${stats?.monthlyRevenue}`} 
          icon={<DollarSign className="text-[#D4FF00]" />} 
          isPrimary
        />

        {/* Card 3: Riesgo */}
        <StatCard 
          title="Por Vencer (5 días)" 
          value={stats?.expiringSoon} 
          icon={<AlertTriangle className="text-red-500" />} 
          className="border-red-500/30 bg-red-500/5"
        />
      </div>

      {/* Sección Inferior: Lista de Urgencia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        
        {/* Tabla de Vencimientos */}
        <div className="bg-bg-[#18181b]/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
          <h3 className="text-white font-bold flex items-center gap-2 mb-4">
            <Activity size={18} className="text-orange-400" /> Vencimientos Próximos
          </h3>
          
          <div className="space-y-3">
            {stats?.expiringList.length === 0 ? (
                <p className="text-[#e4e4e7] text-sm">Todo en orden. Nadie vence pronto.</p>
            ) : (
                stats?.expiringList.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-black/40 rounded-lg border border-white/5 hover:border-white/20 transition-colors">
                    <div>
                        <p className="text-white font-medium text-sm">{item.FullName}</p>
                        <p className="text-xs text-[#e4e4e7]">{item.PlanName}</p>
                    </div>
                    <div className="text-right">
                        <span className={cn(
                            "text-xs font-mono font-bold px-2 py-1 rounded",
                            item.DaysLeft <= 1 ? "bg-red-500/20 text-red-500" : "bg-orange-500/20 text-orange-400"
                        )}>
                            {item.DaysLeft} días
                        </span>
                    </div>
                </div>
                ))
            )}
          </div>
        </div>

        {/* Gráfica de Rendimiento */}
    <div className="bg-bg-[#18181b]/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm min-h-[350px] flex flex-col">
        <h3 className="text-white font-bold flex items-center gap-2 mb-6">
            <TrendingUp size={18} className="text-[#D4FF00]" /> Tendencia de Ingresos
        </h3>

        <div className="flex-1 w-full min-h-[250px]">
            {stats?.revenueHistory && stats.revenueHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.revenueHistory}>
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#D4FF00" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#D4FF00" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                        <XAxis 
                            dataKey="MonthName" 
                            stroke="#666" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false}
                            tick={{fill: '#a1a1aa'}} 
                        />
                        <YAxis 
                            stroke="#666" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `$${value}`} 
                            tick={{fill: '#a1a1aa'}}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#fff', borderRadius: '8px' }}
                            itemStyle={{ color: '#D4FF00' }}
                            formatter={(value: number | undefined) => [`$${value ?? 0}`, "Ingresos"]}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="Total" 
                            stroke="#D4FF00" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorTotal)" 
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-[#e4e4e7] text-sm font-mono">
                    Insuficientes datos para graficar
                </div>
            )}
        </div>
    </div>

      </div>
    </div>
  );
}

// Subcomponente de Tarjeta KPI
function StatCard({ title, value, icon, trend, isPrimary, className }: any) {
  return (
    <div className={cn(
        "p-6 rounded-xl border flex flex-col justify-between h-32 relative overflow-hidden group transition-all",
        isPrimary ? "bg-[#D4FF00] text-black border-[#D4FF00]" : "bg-bg-[#18181b] border-white/10",
        className
    )}>
      {/* Fondo decorativo */}
      <div className="absolute right-[-20px] top-[-20px] opacity-10 group-hover:scale-110 transition-transform duration-500">
        {icon && <div className="scale-[3]">{icon}</div>}
      </div>

      <div className="flex justify-between items-start z-10">
        <span className={cn("text-xs font-mono uppercase tracking-wider font-bold", isPrimary ? "text-black/70" : "text-[#e4e4e7]")}>
            {title}
        </span>
        <div className="p-2 bg-black/10 rounded-full backdrop-blur-sm">{icon}</div>
      </div>
      
      <div className="z-10">
        <h3 className={cn("text-3xl font-heading font-bold tracking-tighter", isPrimary ? "text-black" : "text-white")}>
            {value}
        </h3>
        {trend && <p className="text-[10px] mt-1 opacity-70 font-mono">{trend}</p>}
      </div>
    </div>
  );
}