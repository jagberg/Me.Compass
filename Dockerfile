FROM node:24-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:24-slim AS backend-build
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

FROM node:24-slim
WORKDIR /app
COPY --from=backend-build /app/backend/package.json ./
RUN npm install --omit=dev
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/src/db/migrations ./dist/db/migrations
COPY --from=frontend-build /app/frontend/dist ./public
EXPOSE 3000
CMD ["node", "dist/main.js"]
