#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================================${NC}"
echo -e "${GREEN}    Saving BitcoinZ Modern Explorer to Git${NC}"
echo -e "${GREEN}=========================================================${NC}"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}Git is not installed. Please install git first.${NC}"
    exit 1
fi

# Initialize git repository if not already initialized
if [ ! -d ".git" ]; then
    echo -e "${BLUE}[1/4]${NC} Initializing git repository..."
    git init
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to initialize git repository. Exiting.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Git repository initialized.${NC}"
else
    echo -e "${BLUE}[1/4]${NC} Git repository already exists."
fi

# Create .gitignore file
echo -e "${BLUE}[2/4]${NC} Creating .gitignore file..."
cat > .gitignore << EOL
# Node.js
node_modules/
npm-debug.log
yarn-debug.log
yarn-error.log
.pnp/
.pnp.js

# Build outputs
/build
/dist
/out

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor directories and files
.idea
.vscode
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Database files
*.sqlite
*.db
EOL
echo -e "${GREEN}.gitignore file created.${NC}"

# Add all files to git
echo -e "${BLUE}[3/4]${NC} Adding files to git..."
git add .
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to add files to git. Exiting.${NC}"
    exit 1
fi
echo -e "${GREEN}All files added to git.${NC}"

# Commit changes
echo -e "${BLUE}[4/4]${NC} Committing changes..."
git commit -m "Initial commit of BitcoinZ Modern Explorer"
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to commit changes. Exiting.${NC}"
    exit 1
fi
echo -e "${GREEN}Changes committed successfully.${NC}"

echo -e "${GREEN}=========================================================${NC}"
echo -e "${GREEN}    Git Repository Created Successfully${NC}"
echo -e "${GREEN}=========================================================${NC}"
echo -e "You can now push your repository to GitHub or another Git hosting service."
echo -e "To push to GitHub, create a new repository and then run:"
echo -e "${YELLOW}git remote add origin https://github.com/yourusername/your-repo-name.git${NC}"
echo -e "${YELLOW}git branch -M main${NC}"
echo -e "${YELLOW}git push -u origin main${NC}"
echo -e "${GREEN}=========================================================${NC}"
