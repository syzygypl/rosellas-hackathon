FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

COPY apps/examples/backend/dist ./dist

EXPOSE 8080

USER node

CMD ["node", "dist/main.js"]
