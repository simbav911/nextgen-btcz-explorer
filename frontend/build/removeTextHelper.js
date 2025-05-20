/**
 * This script removes any "Remove this section" text from the page
 * It runs periodically to catch dynamically added content
 */

(function() {
  // Function to remove unwanted text
  function removeUnwantedText() {
    // Target text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const nodesToModify = [];
    let node;
    while (node = walker.nextNode()) {
      if (node.nodeValue && (
        node.nodeValue.includes('Remove this section') ||
        node.nodeValue.includes('Remove this section:')
      )) {
        nodesToModify.push(node);
      }
    }

    // Replace text in the collected nodes
    nodesToModify.forEach(node => {
      node.nodeValue = node.nodeValue
        .replace('Remove this section', '')
        .replace('Remove this section:', '');
    });

    // Target elements by their innerHTML
    document.querySelectorAll('div, span, p').forEach(element => {
      if (element.innerHTML && (
        element.innerHTML.includes('Remove this section') ||
        element.innerHTML.includes('Remove this section:')
      )) {
        element.innerHTML = element.innerHTML
          .replace('Remove this section', '')
          .replace('Remove this section:', '');
      }
    });
  }

  // Run immediately 
  removeUnwantedText();
  
  // Run after DOM is fully loaded
  document.addEventListener('DOMContentLoaded', removeUnwantedText);
  
  // Run periodically to catch dynamically inserted content
  setInterval(removeUnwantedText, 1000);
})();