// Import chart configuration first to ensure Chart.js is properly initialized
import './chartConfig';

import Charts from './Charts';
import ChartSidebar from './ChartSidebar';
import TimeFilter from './TimeFilter';
import ChartContainer from './ChartContainer';
import LineChartDisplay from './LineChartDisplay';
import PieChartDisplay from './PieChartDisplay';
import ChartTheme from './ChartTheme';
import { 
  chartTypes, 
  getChartTitle, 
  getYAxisTitle, 
  formatDate, 
  getDaysFromRange, 
  getChartValue, 
  getChartColors,
  formatNumber,
  formatLargeNumber
} from './chartUtils';

export {
  Charts,
  ChartSidebar,
  TimeFilter,
  ChartContainer,
  LineChartDisplay,
  PieChartDisplay,
  ChartTheme,
  chartTypes,
  getChartTitle,
  getYAxisTitle,
  formatDate,
  getDaysFromRange,
  getChartValue,
  getChartColors,
  formatNumber,
  formatLargeNumber
};

export default Charts;