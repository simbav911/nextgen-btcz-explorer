import React from 'react';
import { Link } from 'react-router-dom';
import { FaGithub, FaTwitter, FaDiscord } from 'react-icons/fa';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-800 text-white py-8">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-bold mb-4">BitcoinZ Explorer</h3>
            <p className="text-gray-300 text-sm">
              A modern, open-source block explorer for the BitcoinZ community.
              Explore blocks, transactions, and addresses on the BitcoinZ blockchain.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-300 hover:text-white text-sm">Home</Link>
              </li>
              <li>
                <Link to="/blocks" className="text-gray-300 hover:text-white text-sm">Latest Blocks</Link>
              </li>
              <li>
                <Link to="/transactions" className="text-gray-300 hover:text-white text-sm">Latest Transactions</Link>
              </li>
              <li>
                <Link to="/stats" className="text-gray-300 hover:text-white text-sm">Network Statistics</Link>
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
                  className="text-gray-300 hover:text-white text-sm"
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
                className="text-gray-300 hover:text-white"
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
            <p className="mt-4 text-gray-300 text-sm">
              Join the community to stay updated with the latest news and developments.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-700 text-center text-gray-400 text-sm">
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
