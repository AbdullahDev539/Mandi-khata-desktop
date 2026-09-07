import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <main style={{ padding: '32px', fontFamily: 'system-ui' }}>
        <h1>Mandi Khata could not load</h1>
        <p>{this.state.error.message}</p>
      </main>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <AppErrorBoundary><App /></AppErrorBoundary>
);
