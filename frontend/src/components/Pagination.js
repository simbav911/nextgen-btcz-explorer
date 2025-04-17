import React from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  // Don't render pagination if there's only one page
  if (totalPages <= 1) return null;
  
  // Create array of page numbers to display
  const getPageNumbers = () => {
    const pageNumbers = [];
    
    // Logic to determine which page numbers to show
    // Always show first and last page, and pages around current page
    const showMax = 5; // Maximum number of pages to show at once
    
    if (totalPages <= showMax) {
      // If we have fewer pages than our max, show all
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always add first page
      pageNumbers.push(1);
      
      // Calculate range around current page
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if we're at the beginning
      if (currentPage <= 2) {
        endPage = Math.min(totalPages - 1, showMax - 1);
      }
      
      // Adjust if we're at the end
      if (currentPage >= totalPages - 1) {
        startPage = Math.max(2, totalPages - showMax + 2);
      }
      
      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pageNumbers.push('...');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pageNumbers.push('...');
      }
      
      // Always add last page
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };
  
  return (
    <div className="flex justify-center items-center mt-8 space-x-2">
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`btn ${
          currentPage === 1 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'btn-secondary'
        }`}
        aria-label="Previous page"
      >
        <FaChevronLeft size={14} />
      </button>
      
      {/* Page Numbers */}
      {getPageNumbers().map((page, index) => (
        <button
          key={index}
          onClick={() => typeof page === 'number' ? onPageChange(page) : null}
          disabled={page === '...'}
          className={`px-3 py-2 rounded ${
            page === currentPage 
              ? 'bg-bitcoinz-600 text-white' 
              : page === '...' 
                ? 'text-gray-500 cursor-default' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {page}
        </button>
      ))}
      
      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`btn ${
          currentPage === totalPages 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'btn-secondary'
        }`}
        aria-label="Next page"
      >
        <FaChevronRight size={14} />
      </button>
    </div>
  );
};

export default Pagination;
