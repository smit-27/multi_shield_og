FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5174

# Vite requires --host to accept external connections within Docker
CMD ["npm", "run", "dev", "--", "--host"]
