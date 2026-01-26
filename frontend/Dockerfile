# Stage 1: Build dependencies
FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

# Stage 2: Create the final image
FROM node:18-alpine as runner

WORKDIR /app

# Copy only necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Run the app
CMD ["npm", "run", "dev", "--", "--host"]