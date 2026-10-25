# ⚠️ UNTESTED: this Dockerfile has not been executed/verified (no Docker daemon
# available at time of writing). Treat it as a starting point, not a validated
# build. If `npm run build && npm start` works for you locally (it is verified),
# this image should behave the same — but please smoke-test before relying on it.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
