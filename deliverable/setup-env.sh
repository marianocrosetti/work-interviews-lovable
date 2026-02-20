#!/bin/bash

# Setup environment variables for Code Agent

echo "Setting up environment variables for Code Agent..."

# Check if .env file exists
if [ -f .env ]; then
  echo ".env file already exists. Do you want to overwrite it? (y/n)"
  read -r answer
  if [ "$answer" != "y" ]; then
    echo "Setup canceled. Existing .env file preserved."
    exit 0
  fi
fi

# Prompt for Anthropic API key
echo "Please enter your Anthropic API key:"
read -r api_key

# Create .env file
cat > .env << EOF
# API Keys
ANTHROPIC_API_KEY=${api_key}

# Environment
ENV=development

# Other configuration
WORKSPACE_PATH=/workspace
DEFAULT_MODEL=claude-3-opus-20240229
DEFAULT_LLM_URL=https://api.anthropic.com
EOF

echo ".env file created successfully!"
echo "You can now run 'docker compose up' to start the application."

chmod +x setup-env.sh 