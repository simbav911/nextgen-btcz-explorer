import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  ArcElement,
  BarElement,
  Title, 
  Tooltip, 
  Legend, 
  Filler 
} from 'chart.js';

// Register all Chart.js components needed for our application
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  ArcElement,  // Required for Pie charts
  BarElement,  // In case we need bar charts
  Title, 
  Tooltip, 
  Legend, 
  Filler
);

export default ChartJS;