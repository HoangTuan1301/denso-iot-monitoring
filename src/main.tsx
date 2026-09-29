import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { HeroUIProvider } from '@heroui/react';
import App from './App';
import './index.css';

// Điểm khởi chạy ứng dụng với Theme HeroUI Dark Mode mặc định
ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeroUIProvider>
      <main className="text-foreground bg-factory-bg min-h-screen">
        <App />
      </main>
    </HeroUIProvider>
  </StrictMode>
);
