import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {withCredentials: true});

    socketRef.current.on('expiring_alert', (data: {name: string, daysLeft: number, plan: string}) => {
        toast.warning(`${data.name}'s ${data.plan} plan is expiring in ${data.daysLeft} day(s)!`, {
            duration: 6000,
            position: 'top-right',
        });
    });
    return () => {
        socketRef.current?.disconnect();
            socketRef.current = null;
    };
    }, []); 
    return socketRef.current;
  }