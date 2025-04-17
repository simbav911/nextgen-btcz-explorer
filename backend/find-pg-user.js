const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Try to determine PostgreSQL user
function findPostgresUser() {
  console.log('Trying to detect PostgreSQL user...');
  
  // Options to try in order
  const options = [
    // Try system username first (common on macOS)
    os.userInfo().username,
    // Standard PostgreSQL user
    'postgres',
    // Other common users
    'admin',
    'root'
  ];
  
  console.log(`Will try these usernames: ${options.join(', ')}`);
  
  for (const user of options) {
    try {
      console.log(`Testing connection with user: ${user}`);
      
      // Try to connect to PostgreSQL with this user
      const command = `psql -U ${user} -c "SELECT 1" postgres`;
      
      try {
        execSync(command, { stdio: 'ignore' });
        console.log(`✅ Success! User "${user}" can connect to PostgreSQL`);
        return user;
      } catch (err) {
        console.log(`❌ User "${user}" failed: ${err.message}`);
      }
    } catch (err) {
      console.log(`Error testing ${user}: ${err.message}`);
    }
  }
  
  console.log('Could not automatically determine PostgreSQL user.');
  console.log('Please check your PostgreSQL installation and update the DB_USER in .env manually.');
  return null;
}

// Main function
async function main() {
  const user = findPostgresUser();
  
  if (user) {
    // Update .env file
    const envPath = path.join(__dirname, '.env');
    
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Replace DB_USER line
      envContent = envContent.replace(
        /DB_USER=.*/,
        `DB_USER=${user}`
      );
      
      fs.writeFileSync(envPath, envContent);
      console.log(`Updated .env file with DB_USER=${user}`);
    } else {
      console.log('.env file not found. Please update manually.');
    }
  }
}

main().catch(console.error);
