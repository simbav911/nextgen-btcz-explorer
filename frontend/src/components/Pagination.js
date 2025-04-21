import React, { useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaAngleDoubleLeft, FaAngleDoubleRight } from 'react-icons/fa';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const [jumpToPage, setJumpToPage] = useState('');
  
  // Don't render pagination if there's only one page
  if (totalPages <= 1) return null;
  
  // Handle direct page number input
  const handleJumpToPage = (e) => {
    e.preventDefault();
    const pageNum = parseInt(jumpToPage);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpToPage('');
    }
  };
  
  // Create array of page numbers to display
  const getPageNumbers = () => {
    const pageNumbers = [];
    
    // Logic to determine which page numbers to show
    // Always show first and last page, and pages around current page
    const showMax = totalPages > 1000 ? 3 : 5; // Show fewer buttons for very large page counts
    
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
      
      // Adjust for very first pages
      if (currentPage <= 2) {
        endPage = Math.min(totalPages - 1, showMax - 1);
      }
      
      // Adjust for very last pages
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
    <div className="flex flex-col items-center mt-8 space-y-3">
      <div className="flex items-center space-x-2">
        {/* Jump to First Page */}
        {totalPages > 10 && (
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className={`btn ${
              currentPage === 1 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'btn-secondary'
            }`}
            aria-label="First page"
          >
            <FaAngleDoubleLeft size={14} />
          </button>
        )}
        
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
                ? 'bg-blue-500 text-white' 
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
        
        {/* Jump to Last Page */}
        {totalPages > 10 && (
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={`btn ${
              currentPage === totalPages 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'btn-secondary'
            }`}
            aria-label="Last page"
          >
            <FaAngleDoubleRight size={14} />
          </button>
        )}
      </div>
      
      {/* Jump to page form - only show for large page counts */}
      {totalPages > 20 && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
          <form onSubmit={handleJumpToPage} className="flex items-center space-x-2">
            <input
              type="text"
              value={jumpToPage}
              onChange={(e) => setJumpToPage(e.target.value)}
              placeholder="Go to page"
              className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-sm"
            >
              Go
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Pagination;
