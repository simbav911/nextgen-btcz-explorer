/**
 * Simplified 3D pie chart enhancement
 */

(function() {
  function enhancePieChart() {
    // Find all pie chart canvases
    const pieCharts = document.querySelectorAll('.pie-chart-container canvas');
    
    pieCharts.forEach(canvas => {
      // Apply simple 3D transform
      canvas.style.transform = 'rotateX(12deg)';
      canvas.style.transition = 'all 0.3s ease';
      canvas.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
      
      // Add hover effect
      canvas.addEventListener('mouseover', function() {
        canvas.style.transform = 'rotateX(15deg)';
        canvas.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.2)';
      });
      
      canvas.addEventListener('mouseout', function() {
        canvas.style.transform = 'rotateX(12deg)';
        canvas.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
      });
      
      // Make sure parent container has proper styling
      const parent = canvas.parentNode;
      if (parent) {
        parent.style.overflow = 'visible';
      }
    });
  }

  // Run when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(enhancePieChart, 500);
    });
  } else {
    // DOM already loaded, run after a delay
    setTimeout(enhancePieChart, 500);
  }
  
  // Also run periodically to catch dynamically created charts
  setInterval(enhancePieChart, 3000);
})();