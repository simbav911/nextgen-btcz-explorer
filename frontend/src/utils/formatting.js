import moment from 'moment';

// Format timestamp to local date and time
export const formatTimestamp = (timestamp) => {
  return moment.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');
};

// Format timestamp as relative time (e.g., 5 hours ago)
export const formatRelativeTime = (timestamp) => {
  return moment.unix(timestamp).fromNow();
};

// Format a value as BitcoinZ currency (8 decimal places)
export const formatBTCZ = (value) => {
  if (value === undefined || value === null) return '0 BTCZ';
  
  // Format with thousands separator and 8 decimal places
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8
  }).format(value);
  
  return `${formatted} BTCZ`;
};

// Format a large number with thousand separators
export const formatNumber = (number) => {
  if (number === undefined || number === null) return '0';
  return new Intl.NumberFormat('en-US').format(number);
};

// Format bytes to human-readable format (KB, MB, GB)
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Format hash for display (truncate in the middle)
export const formatHash = (hash, length = 10) => {
  if (!hash) return '';
  
  if (hash.length <= length * 2) {
    return hash;
  }
  
  return `${hash.substring(0, length)}...${hash.substring(hash.length - length)}`;
};

// Format difficulty to readable format
export const formatDifficulty = (difficulty) => {
  if (difficulty === undefined || difficulty === null) return '0';
  
  // Use scientific notation for very large numbers
  if (difficulty > 1000000) {
    return difficulty.toExponential(2);
  }
  
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2
  }).format(difficulty);
};

// Format confirmations with appropriate labels
export const formatConfirmations = (confirmations) => {
  if (confirmations === 0) {
    return { text: 'Unconfirmed', class: 'badge-warning' };
  } else if (confirmations === 1) {
    return { text: '1 Confirmation', class: 'badge-info' };
  } else if (confirmations < 6) {
    return { text: `${confirmations} Confirmations`, class: 'badge-info' };
  } else {
    return { text: `${confirmations}+ Confirmations`, class: 'badge-success' };
  }
};
