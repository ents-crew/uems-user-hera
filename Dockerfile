FROM node:current-alpine

WORKDIR /user/app
CMD ["npm", "run", "start:dev"]

COPY package*.json ./

ENV NODE_ENV=dev

RUN npm install

COPY . .
