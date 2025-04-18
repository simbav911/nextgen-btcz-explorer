import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Wrap the entire app in a static header component
const AppWithStaticHeader = () => {
  // Create static header directly in HTML without React components
  const headerHtml = `
    <header class="bg-white shadow-md" style="position: static; z-index: 1000;">
      <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div class="flex items-center">
          <img 
            src="https://bitcoinz.global/wp-content/uploads/branding/btcz-website-logo.png" 
            alt="BitcoinZ" 
            class="h-10 w-auto mr-3"
          />
          <div class="flex flex-col">
            <span class="font-bold text-xl text-gray-900">BitcoinZ</span>
            <span class="text-sm text-gray-600">Explorer</span>
          </div>
        </div>

        <div class="flex space-x-8">
          <a href="/" class="text-gray-700">Home</a>
          <a href="/blocks" class="text-gray-700">Blocks</a>
          <a href="/transactions" class="text-gray-700">Transactions</a>
          <a href="/stats" class="text-gray-700">Statistics</a>
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
