import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { notify } from '../../lib/notify';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui-boundary]', error, info.componentStack);
    notify.error('El módulo se detuvo de forma segura', error.message);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-boundary">
        <span><AlertTriangle size={28} /></span>
        <p className="eyebrow">Recuperación de interfaz</p>
        <h1>Este módulo encontró un problema.</h1>
        <p>{this.state.error.message}</p>
        <button type="button" className="button button--primary" onClick={() => this.setState({ error: null })}><RefreshCw size={17} /> Reintentar módulo</button>
      </main>
    );
  }
}
