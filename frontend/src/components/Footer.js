import React from 'react';
import { Link } from 'react-router-dom';
import { FaGithub, FaTwitter, FaDiscord } from 'react-icons/fa';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative text-white py-8 z-10 mt-12">
      {/* Background gradient with animated overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 opacity-90"></div>
      
      {/* Animated light waves overlay */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-full" style={{ 
          height: '80px', 
          top: '0', 
          background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 100%)',
          transform: 'translateY(-40px) rotate(-2deg)',
          transformOrigin: 'center',
          animation: 'wave 15s infinite linear'
        }}></div>
        <div className="absolute w-full" style={{ 
          height: '50px', 
          top: '20px', 
          background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.08) 100%)',
          transform: 'translateY(-20px) rotate(1deg)',
          transformOrigin: 'center',
          animation: 'wave 12s infinite linear reverse'
        }}></div>
      </div>
      
      <style jsx>{`
        @keyframes wave {
          0% { transform: translateX(-50%) rotate(-1deg); }
          50% { transform: translateX(0%) rotate(1deg); }
          100% { transform: translateX(50%) rotate(-1deg); }
        }
      `}</style>
      
      <div className="container-custom relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-bold mb-4">BitcoinZ Explorer</h3>
            <p className="text-white text-opacity-90 text-sm">
              A modern, open-source block explorer for the BitcoinZ community.
              Explore blocks, transactions, and addresses on the BitcoinZ blockchain.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-white text-opacity-90 hover:text-opacity-100 text-sm">Home</Link>
              </li>
              <li>
                <Link to="/blocks" className="text-white text-opacity-90 hover:text-opacity-100 text-sm">Latest Blocks</Link>
              </li>
              <li>
                <Link to="/transactions" className="text-white text-opacity-90 hover:text-opacity-100 text-sm">Latest Transactions</Link>
              </li>
              <li>
                <Link to="/stats" className="text-white text-opacity-90 hover:text-opacity-100 text-sm">Network Statistics</Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-lg font-bold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://bitcoinz.global" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white text-opacity-90 hover:text-opacity-100 text-sm"
                >
                  BitcoinZ Website
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/btcz/bitcoinz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white text-sm"
                >
                  BitcoinZ GitHub
                </a>
              </li>
              <li>
                <a 
                  href="https://getbtcz.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white text-sm"
                >
                  Get BitcoinZ
                </a>
              </li>
              <li>
                <a 
                  href="https://wiki.btcz.rocks" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white text-sm"
                >
                  BitcoinZ Wiki
                </a>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-lg font-bold mb-4">Connect</h3>
            <div className="flex space-x-4">
              <a 
                href="https://github.com/btcz" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white text-opacity-90 hover:text-opacity-100"
              >
                <FaGithub size={20} />
              </a>
              <a 
                href="https://twitter.com/BTCZOfficial" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white"
              >
                <FaTwitter size={20} />
              </a>
              <a 
                href="https://discordapp.com/invite/u3dkbFs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white"
              >
                <FaDiscord size={20} />
              </a>
            </div>
            <p className="mt-4 text-white text-opacity-90 text-sm">
              Join the community to stay updated with the latest news and developments.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white border-opacity-30 text-center text-white text-sm">
          <p>© {currentYear} BitcoinZ Explorer. All rights reserved.</p>
          <p className="mt-2">
            BitcoinZ - Community driven development, Decentralized Cryptocurrency
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
