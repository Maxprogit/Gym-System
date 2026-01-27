import { Link, Outlet } from 'react-router-dom';
import { Dumbbell, Users, CreditCard, LogOut } from 'lucide-react';
import { MessageCircle } from 'lucide-react';

export default function DashboardLayout() {

  const handleLogout = () => {
  localStorage.removeItem('goliat_session'); 
  window.location.reload(); 
};
  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 border-r border-[#27272a] bg-bg/95 backdrop-blur flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-3 mb-10 px-2">
            <img className="h-8 w-8 bg-[#D4FF00] rounded-sm shadow-[0_0_15px_#D4FF00]" src="https://thispersondoesnotexist.com/" alt="Logo"></img>
            <h1 className="hidden lg:block font-bold text-xl tracking-tighter text-white">GOLIAT</h1>
          </div>
          
          <nav className="space-y-2">
            <NavItem to="/" icon={<Dumbbell />} label="Panel Principal" />
            <NavItem to="/members" icon={<Users />} label="Atletas" />
            <NavItem to="/payments" icon={<CreditCard />} label="Caja" />
            <NavItem to="/whatsapp" icon={<MessageCircle />} label="Conexión WhatsApp" />
          </nav>
        </div>  
        
        <button onClick={handleLogout} className="flex items-center gap-3 text-[#a1a1aa] hover:text-red-500 transition-colors px-2">
          <LogOut size={20} />
          <span className="hidden lg:block font-mono text-sm">SALIR</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-lg text-[#a1a1aa] hover:bg-bg-[#18181b] hover:text-[#D4FF00] transition-all group">
      <span className="group-hover:drop-shadow-[0_0_8px_#D4FF00]">{icon}</span>
      <span className="hidden lg:block font-medium text-sm">{label}</span>
    </Link>
  );
}