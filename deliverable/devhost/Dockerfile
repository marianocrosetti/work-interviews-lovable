FROM python:3.9-slim

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    lsb-release \
    git \
    gcc \
    python3-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node --version && npm --version

# Install Vite globally
RUN npm install -g vite

# Set up working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install Flask-Cors==3.0.10

# Copy application code
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Set environment variable
ENV WORKSPACE_DIR=/workspace_data

# Command to run the application
CMD ["python", "app.py"] 