# Frontend Mini-Program Dockerfile
# Note: This is for development/testing only
# Production mini-programs should be built and uploaded via WeChat DevTools

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build mini-program
RUN npm run build:weapp

# Expose port for development server
EXPOSE 10086

# Default command (development)
CMD ["npm", "run", "dev:weapp", "--", "--host", "0.0.0.0"]
