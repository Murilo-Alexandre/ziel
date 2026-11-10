import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('Ziel: erro de renderização', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-bold text-ziel-danger">Algo deu errado</h1>
        <p className="text-sm text-ziel-muted">Seus dados continuam salvos neste aparelho. Reabra a tela para tentar de novo.</p>
        <p className="break-words rounded-chip bg-ziel-raised px-3 py-2 text-xs text-ziel-sub">{this.state.error.message}</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
