# Base image
FROM node:18

# Create and set app directory
WORKDIR /app

# Copy package.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port 80
EXPOSE 80

# Start script
CMD [ "node", "server.js"]
