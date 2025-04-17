import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaWallet, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// Register Chart.js components
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Components
import Spinner from '../components/Spinner';
import DetailCard from '../components/DetailCard';
import TransactionCard from '../components/TransactionCard';
import Pagination from '../components/Pagination';

// Services
import { addressService } from '../services/api';

// Utils
import { formatBTCZ, formatNumber } from '../utils/formatting';

const Address = () => {
  const { address } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [addressInfo, setAddressInfo] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txsLoading, setTxsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(null);
  
  const txsPerPage = 10;
  
  // Fetch address info
  useEffect(() => {
    const fetchAddressInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await addressService.getAddressInfo(address);
        setAddressInfo(response.data);
        
        // Calculate total pages based on transaction count
        if (response.data.txCount) {
          setTotalPages(Math.ceil(response.data.txCount / txsPerPage));
        }
        
        // Fetch first page of transactions
        await fetchAddressTransactions(1);
      } catch (error) {
        console.error('Error fetching address info:', error);
        setError('Address not found or not yet indexed');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAddressInfo();
  }, [address]);
  
  // Fetch transactions for the current page
  const fetchAddressTransactions = async (page) => {
    try {
      setTxsLoading(true);
      
      const response = await addressService.getAddressTransactions(
        address, 
        txsPerPage, 
        (page - 1) * txsPerPage
      );
      
      setTransactions(response.data.transactions);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching address transactions:', error);
    } finally {
      setTxsLoading(false);
    }
  };
  
  // Handle page change
  const handlePageChange = (page) => {
    fetchAddressTransactions(page);
    // Scroll to transaction list
    document.getElementById('transactions-list').scrollIntoView({
      behavior: 'smooth'
    });
  };
  
  if (loading) {
    return <Spinner message="Loading address data..." />;
  }
  
  if (error || !addressInfo) {
    return (
      <div className="card text-center py-8">
        <h2 className="text-2xl font-bold mb-4">Address Not Found</h2>
        <p className="text-gray-500 mb-4">
          {error || 'The address you are looking for does not exist or has not been indexed yet.'}
        </p>
        <Link to="/" className="btn btn-primary">Back to Home</Link>
      </div>
    );
  }
  
  // Prepare address details for detail card
  const addressDetails = [
    { label: 'Address', value: address },
    { label: 'Balance', value: formatBTCZ(addressInfo.balance) },
    { label: 'Total Received', value: formatBTCZ(addressInfo.totalReceived) },
    { label: 'Total Sent', value: formatBTCZ(addressInfo.totalSent) },
    { label: 'Unconfirmed Balance', value: formatBTCZ(addressInfo.unconfirmedBalance) },
    { label: 'Transaction Count', value: formatNumber(addressInfo.txCount) }
  ];
  
  // Sample chart data - in a real app, this would come from API
  const chartData = {
    labels: ['7d ago', '6d ago', '5d ago', '4d ago', '3d ago', '2d ago', '1d ago', 'Today'],
    datasets: [
      {
        label: 'Balance Over Time',
        data: [
          addressInfo.balance * 0.7,
          addressInfo.balance * 0.75,
          addressInfo.balance * 0.8,
          addressInfo.balance * 0.82,
          addressInfo.balance * 0.85,
          addressInfo.balance * 0.9,
          addressInfo.balance * 0.95,
          addressInfo.balance
        ],
        borderColor: 'rgba(12, 102, 228, 1)',
        backgroundColor: 'rgba(12, 102, 228, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };
  
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return formatBTCZ(context.raw);
          }
        }
      }
    },
    scales: {
      y: {
        ticks: {
          callback: function(value) {
            return formatBTCZ(value);
          }
        }
      }
    }
  };
  
  return (
    <div>
      <h1 className="text-3xl font-bold flex items-center mb-6">
        <FaWallet className="text-bitcoinz-600 mr-3" />
        Address Details
      </h1>
      
      <DetailCard
        title="Address Information"
        items={addressDetails}
        copyable={['Address']}
      />
      
      {/* Balance Chart */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Balance History</h2>
        <div className="card">
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>
      
      {/* Transaction Summary */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <FaArrowDown className="text-green-600 mr-2" />
            Received
          </h3>
          <div className="text-3xl font-bold text-green-600">
            {formatBTCZ(addressInfo.totalReceived)}
          </div>
        </div>
        
        <div className="card">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <FaArrowUp className="text-red-600 mr-2" />
            Sent
          </h3>
          <div className="text-3xl font-bold text-red-600">
            {formatBTCZ(addressInfo.totalSent)}
          </div>
        </div>
      </div>
      
      {/* Transactions */}
      <div id="transactions-list" className="mt-8">
        <h2 className="text-2xl font-bold mb-4">
          Transactions ({formatNumber(addressInfo.txCount)})
        </h2>
        
        {txsLoading ? (
          <Spinner message="Loading transactions..." />
        ) : transactions.length > 0 ? (
          <>
            <div className="space-y-4 mb-6">
              {transactions.map(tx => (
                <TransactionCard key={tx.txid} transaction={tx} />
              ))}
            </div>
            
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        ) : (
          <div className="card text-center py-8">
            <p className="text-gray-500">No transactions found for this address</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Address;
