import React from 'react';
import { Link } from 'react-router-dom';
import { FaGithub, FaTwitter, FaDiscord, FaTelegramPlane, FaReddit } from 'react-icons/fa';

// Import the animation styles
import '../styles/animatedHeader.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative text-white py-8 z-10 mt-32">
      {/* Content container */}
      <div className="container-custom relative z-10 pt-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-bold mb-4 header-text">BitcoinZ Explorer</h3>
            <p className="text-white text-sm header-text">
              A modern, open-source block explorer for the BitcoinZ community.
              Explore blocks, transactions, and addresses on the BitcoinZ blockchain.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-4 header-text">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-white hover:text-blue-200 text-sm nav-item-hover px-2 py-1 rounded-md">Home</Link>
              </li>
              <li>
                <Link to="/blocks" className="text-white hover:text-blue-200 text-sm nav-item-hover px-2 py-1 rounded-md">Latest Blocks</Link>
              </li>
              <li>
                <Link to="/transactions" className="text-white hover:text-blue-200 text-sm nav-item-hover px-2 py-1 rounded-md">Latest Transactions</Link>
              </li>
              <li>
                <Link to="/stats" className="text-white hover:text-blue-200 text-sm nav-item-hover px-2 py-1 rounded-md">Network Statistics</Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-lg font-bold mb-4 header-text">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://getbtcz.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-blue-200 text-sm nav-item-hover px-2 py-1 rounded-md"
                >
                  BitcoinZ Website
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/btcz/bitcoinz" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-blue-200 text-sm nav-item-hover px-2 py-1 rounded-md"
                >
                  BitcoinZ GitHub
                </a>
              </li>
              <li>
                <a 
                  href="https://getbtcz.com/learn/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-blue-200 text-sm nav-item-hover px-2 py-1 rounded-md"
                >
                  BitcoinZ Wiki
                </a>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-lg font-bold mb-4 header-text">Connect</h3>
            <div className="flex space-x-4">
              <a 
                href="https://github.com/btcz" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-blue-200 nav-item-hover p-2 rounded-full"
              >
                <FaGithub size={20} />
              </a>
              <a 
                href="https://twitter.com/BTCZOfficial" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-blue-200 nav-item-hover p-2 rounded-full"
              >
                <FaTwitter size={20} />
              </a>
              <a 
                href="https://discordapp.com/invite/u3dkbFs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:text-blue-200 nav-item-hover p-2 rounded-full"
              >
                <FaDiscord size={20} />
              </a>
              <a 
                href="https://t.me/btczofficialgroup" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-white hover:text-blue-200 nav-item-hover p-2 rounded-full"
              >
                <FaTelegramPlane size={20} />
              </a>
              <a
                href="https://www.reddit.com/r/BTCZCommunity/hot/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-blue-200 nav-item-hover p-2 rounded-full"
              >
                <FaReddit size={20} />
              </a>
            </div>
            <p className="mt-4 text-white text-sm header-text">
              Join the community to stay updated with the latest news and developments.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white border-opacity-20 text-center">
          <p className="text-white text-sm header-text">&copy; {currentYear} BitcoinZ Explorer. All rights reserved.</p>
          <p className="mt-2 text-white text-sm header-text">
            BitcoinZ - Community driven development, Decentralized Cryptocurrency
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
