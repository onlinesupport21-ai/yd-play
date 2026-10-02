FROM node:22-alpine AS build
WORKDIR /app
COPY apps/admin/package.json ./package.json
RUN npm install --no-audit --no-fund
COPY apps/admin/ ./
ARG NEXT_PUBLIC_YD_API_URL=http://localhost:3000/v1
ENV NEXT_PUBLIC_YD_API_URL=$NEXT_PUBLIC_YD_API_URL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm","run","start","--","-p","3000"]
