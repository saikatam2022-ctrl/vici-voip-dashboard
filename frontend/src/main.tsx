import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // make sure your global Tailwind or CSS is imported

// ✅ Create root and render the app
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
