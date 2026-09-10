FROM node:20-alpine

WORKDIR /app

# Sao chép package.json và cài đặt dependencies
COPY package*.json ./
RUN npm install --production

# Sao chép toàn bộ mã nguồn
COPY . .

# Mở cổng cho Health Check
ENV PORT=3000
ENV NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"
EXPOSE 3000

# Khởi chạy bot
CMD ["node", "src/index.js"]
