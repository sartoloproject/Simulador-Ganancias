import React from 'react'
import ReactDOM from 'react-dom/client'
import CategorizationTable from './CategorizationTable.jsx'

// Inyección dinámica y forzada de Tailwind CSS
if (!document.getElementById('tailwind-cdn')) {
  const script = document.createElement('script');
  script.id = 'tailwind-cdn';
  script.src = 'https://tailwindcss.com';
  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CategorizationTable />
  </React.StrictMode>,
)
