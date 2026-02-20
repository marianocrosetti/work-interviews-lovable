FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Expose port
EXPOSE 8080

# Start the app in development mode
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]