import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG as QRCode } from 'qrcode.react'; // Librería para dibujar el QR


import { Smartphone, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

//Boton para probar los envios de wp
import { Send, Phone } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import axios from 'axios';

const socket = io('http://localhost:3001'); // Conecta al backend

export default function WhatsAppPage() {
  const [qrCode, setQrCode] = useState<string>('');
  const [status, setStatus] = useState<'disconnected' | 'authenticated' | 'connected'>('disconnected');



  useEffect(() => {
    // Escuchar eventos del servidor
    socket.on('qr_code', (qr) => {
      setQrCode(qr);
      setStatus('disconnected');
    });

    socket.on('whatsapp_status', (newStatus) => {
      setStatus(newStatus);
      if (newStatus === 'connected') setQrCode('');
    });

    return () => {
      socket.off('qr_code');
      socket.off('whatsapp_status');
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-heading font-bold text-white">CONEXIÓN WHATSAPP</h2>
        <p className="text-[#a1a1aa] font-mono text-sm max-w-md mx-auto">
          Escanea el código para habilitar el bot de notificaciones automáticas de Goliat.
        </p>
      </div>

      <div className="relative group">
        {/* Contenedor del QR con diseño Cyberpunk */}
        <div className="relative p-8 bg-white rounded-2xl shadow-[0_0_40px_rgba(212,255,0,0.15)] border-2 border-[#D4FF00]/20 flex flex-col items-center gap-6">
          
          {/* Esquinas decorativas (Se mantienen igual) */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#D4FF00] -mt-1 -ml-1"></div>
          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#D4FF00] -mt-1 -mr-1"></div>
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#D4FF00] -mb-1 -ml-1"></div>
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#D4FF00] -mb-1 -mr-1"></div>

          {status === 'connected' ? (
            <div className="flex flex-col items-center justify-center w-[256px] h-[256px]">
              <div className="w-20 h-20 bg-[#D4FF00]/20 rounded-full flex items-center justify-center mb-4 text-[#D4FF00] animate-pulse">
                <CheckCircle size={48} />
              </div>
              <p className="font-bold text-black text-lg">SISTEMA ONLINE</p>
              <p className="text-xs text-gray-500 mt-2 font-mono">Listo para enviar mensajes</p>
            </div>
          ) : qrCode ? (
            <>
                <QRCode value={qrCode} size={256} className="rounded-lg" />
                <div className="bg-gray-100 p-3 rounded-lg w-full text-center">
                    <p className="text-xs text-gray-600 font-bold mb-1">CÓMO ESCANEAR:</p>
                    <ol className="text-[10px] text-gray-500 text-left list-decimal pl-4 space-y-1 font-mono">
                        <li>Abre WhatsApp en tu celular</li>
                        <li>Menú (⋮) o Configuración ⚙️</li>
                        <li>Dispositivos vinculados {'>'} Vincular</li>
                    </ol>
                </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center w-[256px] h-[256px] bg-gray-100 rounded-lg">
              <Loader2 className="w-10 h-10 text-gray-400 animate-spin mb-4" />
              <p className="text-sm text-gray-500 font-mono">Generando QR...</p>
            </div>
          )}
        </div>
      </div>


      <div className="flex items-center gap-3 bg-bg-[#18181b] px-6 py-3 rounded-full border border-[#27272a]">
        <Smartphone size={20} className={status === 'connected' ? 'text-[#D4FF00]' : 'text-[#a1a1aa]'} />
        <span className="font-mono text-sm uppercase">
            Estado: <span className={status === 'connected' ? 'text-[#D4FF00] font-bold' : 'text-[#a1a1aa]'}>
                {status === 'connected' ? 'CONECTADO' : 'ESPERANDO VINCULACIÓN...'}
            </span>
        </span>
      </div>
    </div>
  );
}