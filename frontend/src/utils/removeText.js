/**
 * Helper function to remove "Remove this section" text from the mining pool chart
 */

export const removeUnwantedText = () => {
  // This function will be called to clean up any "Remove this section" text
  const removeTextFromPoolChart = () => {
    // Use various selector approaches to find and remove the text
    // Text could be in different elements or as a direct text node
    
    // Option 1: Direct text nodes containing the phrase
    document.querySelectorAll('*').forEach(element => {
      if (element.childNodes && element.childNodes.length) {
        element.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('Remove this section')) {
            node.textContent = '';
          }
        });
      }
    });
    
    // Option 2: Elements with class/id that might contain the text
    const possibleElements = [
      ...document.querySelectorAll('.pool-stat-item'),
      ...document.querySelectorAll('.pool-stat-grid'),
      ...document.querySelectorAll('.pool-stat-summary'),
      ...document.querySelectorAll('.chart-3d-container')
    ];
    
    possibleElements.forEach(element => {
      if (element && element.innerHTML && element.innerHTML.includes('Remove this section')) {
        element.innerHTML = element.innerHTML.replace('Remove this section', '');
        element.innerHTML = element.innerHTML.replace('Remove this section:', '');
      }
    });
  };

  // Run cleanup when document is ready
  if (document.readyState === 'complete') {
    removeTextFromPoolChart();
  } else {
    window.addEventListener('load', removeTextFromPoolChart);
  }
  
  // Also run it after a short delay to catch dynamically added content
  setTimeout(removeTextFromPoolChart, 500);
  setTimeout(removeTextFromPoolChart, 1500);
};

export default removeUnwantedText;