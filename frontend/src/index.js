import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Wrap the entire app in a static header component
const AppWithStaticHeader = () => {
  // Create a modern, sleek header directly in HTML without React components
  const headerHtml = `
    <header class="bg-gradient-to-r from-blue-900 to-blue-700 shadow-lg" style="position: static; z-index: 1000;">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo and Title -->
          <div class="flex items-center">
            <div class="flex-shrink-0 w-10">
              <img 
                src="/logo.png" 
                alt="BitcoinZ" 
                class="h-10 w-10"
                onerror="this.onerror=null; this.src='https://bitcoinz.global/wp-content/uploads/branding/btcz-website-logo.png';"
              />
            </div>
            <div class="ml-3 flex flex-col">
              <span class="font-bold text-xl text-white tracking-wide">BitcoinZ</span>
              <span class="text-xs text-blue-200 tracking-wider">Explorer</span>
            </div>
          </div>

          <!-- Navigation Links -->
          <nav class="flex space-x-8">
            <a href="/" class="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition hover:bg-blue-800">
              Home
            </a>
            <a href="/blocks" class="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition hover:bg-blue-800">
              Blocks
            </a>
            <a href="/transactions" class="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition hover:bg-blue-800">
              Transactions
            </a>
            <a href="/stats" class="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition hover:bg-blue-800">
              Statistics
            </a>
          </nav>
        </div>
      </div>
    </header>
  `;

  // Insert the static header directly into the DOM
  React.useEffect(() => {
    // Get the root element
    const root = document.getElementById('root');
    
    // Check if a header already exists
    if (!document.querySelector('#static-header')) {
      // Create a new div for the header
      const headerDiv = document.createElement('div');
      headerDiv.id = 'static-header';
      headerDiv.innerHTML = headerHtml;
      
      // Insert the header at the beginning of the root element
      if (root.firstChild) {
        root.insertBefore(headerDiv, root.firstChild);
      } else {
        root.appendChild(headerDiv);
      }
    }
    
    return () => {
      // Clean up on unmount
      const headerDiv = document.getElementById('static-header');
      if (headerDiv) {
        headerDiv.remove();
      }
    };
  }, []);

  // Return the App component without a header
  return <App skipHeader={true} />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <AppWithStaticHeader />
  </BrowserRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
