import React from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import './styles/loading-effects.css'; // Import loading effects
import './styles/transaction-tiles.css'; // Import transaction tile styles
import './styles/transaction-section.css'; // Import transaction section styles
import './styles/forced-blur.css'; // Import forced blur styles (applied last)
import App from './App';
import reportWebVitals from './reportWebVitals';

// Configure future flags for React Router
const router = createHashRouter(
  [
    {
      path: "*",
      element: <App />
    }
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }
  }
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <RouterProvider router={router} />
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
