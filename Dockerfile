FROM node:24-alpine
RUN apk add --no-cache tzdata
ENV TZ=America/New_York
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN mkdir -p /app/data
CMD ["npm", "start"]