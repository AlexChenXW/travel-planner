FROM node:22-slim

WORKDIR /app

# Copy standalone build
COPY .fc-deploy ./

# Copy static assets
COPY .next/static ./.next/static
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
