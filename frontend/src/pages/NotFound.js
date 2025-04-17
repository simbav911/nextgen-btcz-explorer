import React from 'react';
import { Link } from 'react-router-dom';
import { FaExclamationTriangle, FaHome, FaSearch } from 'react-icons/fa';

// Components
import SearchBox from '../components/SearchBox';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <FaExclamationTriangle className="text-yellow-500" size={64} />
      
      <h1 className="text-4xl font-bold mt-6 mb-2">404</h1>
      <h2 className="text-2xl font-medium mb-6">Page Not Found</h2>
      
      <p className="text-gray-600 text-center max-w-md mb-8">
        The page you are looking for doesn't exist or has been moved.
        Try searching for something else or go back to the homepage.
      </p>
      
      <div className="w-full max-w-md mb-6">
        <SearchBox placeholder="Search blocks, transactions, addresses..." />
      </div>
      
      <Link to="/" className="btn btn-primary flex items-center">
        <FaHome className="mr-2" />
        Back to Home
      </Link>
    </div>
  );
};

export default NotFound;
