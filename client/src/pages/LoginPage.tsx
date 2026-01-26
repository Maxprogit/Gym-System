import { useState } from 'react';
import axios from 'axios';
import { Lock, ArrowRight, AlertCircle, User, Key } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginProps) {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validación básica de campos vacíos
    if (!formData.username.trim() || !formData.password.trim()) {
        setError('Por favor ingresa usuario y contraseña');
        setLoading(false);
        return;
    }

    try {
      // 1. Petición real al Backend
      const res = await axios.post('http://localhost:3001/api/login', {
        username: formData.username,
        password: formData.password
      });

      if (res.data.success) {
        // 2. Si el servidor (y bcrypt) dicen que sí:
        // Guardamos la sesión real con los datos que devolvió la BD
        localStorage.setItem('goliat_session', JSON.stringify(res.data.user));
        
        // 3. Notificamos a la App para que desbloquee las rutas
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error("Error de login:", err);
      // 4. Manejo de Errores Reales (Backend 401, 500, o Red)
      if (err.response) {
        // El servidor respondió con un error (ej: "Credenciales inválidas")
        setError(err.response.data.error || 'Acceso denegado');
      } else if (err.request) {
        // El servidor no responde (está apagado o sin red)
        setError('No se puede conectar con el servidor. Verifica que esté encendido.');
      } else {
        setError('Ocurrió un error inesperado. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-bg selection:bg-primary selection:text-black">
      
      {/* Fondo decorativo Cyber-Industrial */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-sm p-8 bg-[#121212]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_50px_-10px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header del Login */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-black/50 rounded-2xl border border-white/5 shadow-[0_0_30px_rgba(212,255,0,0.1)] mb-6 ring-1 ring-white/10">
            <Lock className="text-primary w-8 h-8" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-heading font-black text-white tracking-tighter mb-2">
            GOLIAT <span className="text-primary">SYSTEM</span>
          </h1>
          <p className="text-text-muted text-xs font-mono uppercase tracking-widest opacity-70">Acceso Administrativo Seguro</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input 
                    placeholder="Usuario" 
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="bg-black/50 border-white/10 pl-10 focus:border-primary/50 transition-all"
                    autoFocus
                    autoComplete="username"
                />
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative">
                <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input 
                    type="password"
                    placeholder="Contraseña" 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="bg-black/50 border-white/10 pl-10 focus:border-primary/50 transition-all"
                    autoComplete="current-password"
                />
            </div>
          </div>
          
          {/* Mensaje de Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs font-mono bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-in slide-in-from-top-2">
                <AlertCircle size={14} />
                <span>{error}</span>
            </div>
          )}

          <Button 
            className="w-full h-12 text-sm font-bold tracking-wide uppercase shadow-[0_0_20px_rgba(212,255,0,0.15)] hover:shadow-[0_0_30px_rgba(212,255,0,0.3)] transition-all duration-300" 
            isLoading={loading}
          >
            {loading ? 'Verificando...' : 'Iniciar Sesión'} 
            {!loading && <ArrowRight size={16} className="ml-2" />}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] text-text-muted font-mono opacity-50">
            <span>Server: ONLINE</span>
            <span>SECURE CONNECTION v1.0</span>
        </div>
      </div>
    </div>
  );
}