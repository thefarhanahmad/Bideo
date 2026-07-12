# Stage 1: Build Vite frontend
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies (needed to build)
RUN npm install

# Copy source files
COPY . .

# Declare build arguments
ARG VITE_API_URL=https://bideo.in/api
ARG VITE_APP_DOWNLOAD_URL

# Set environment variables for build step
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_DOWNLOAD_URL=$VITE_APP_DOWNLOAD_URL

# Build the project
RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:1.25-alpine

# Copy build output to Nginx public folder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
