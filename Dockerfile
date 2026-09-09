FROM node:20-alpine

WORKDIR /app

# Sao chép package.json và cài đặt dependencies
COPY package*.json ./
RUN npm install --production

# Sao chép toàn bộ mã nguồn
COPY . .

# Mở cổng cho Health Check
ENV PORT=3000
EXPOSE 3000

# Khởi chạy bot
CMD ["node", "src/index.js"]
