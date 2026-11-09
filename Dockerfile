FROM node:22-alpine
WORKDIR /app

# deps root + workspaces
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

RUN npm install

# código-fonte
COPY . .

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=server"]
