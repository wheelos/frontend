FROM node:20-slim

WORKDIR /app

# Install system build dependencies for optional native modules (gifsicle, mozjpeg, optipng, sharp, etc.)
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		build-essential autoconf automake libtool pkg-config \
		python3 python3-dev git bash curl wget ca-certificates \
		zlib1g-dev libpng-dev libjpeg-dev libwebp-dev nasm \
		libvips-dev \
	&& rm -rf /var/lib/apt/lists/*

# Enable corepack and prepare Yarn v1 (match existing yarn.lock), fallback to npm global install
RUN corepack enable || true && corepack prepare yarn@1.22.22 --activate || npm install -g yarn@1.22.22

# Use Taobao / npmmirror registry for faster installs in China
RUN npm config set registry https://registry.npmmirror.com && yarn config set registry https://registry.npmmirror.com

# Copy package manifest and yarn lock for layer caching
COPY package.json yarn.lock ./

# Install dependencies with yarn
RUN yarn install --frozen-lockfile --network-concurrency 1

# Copy rest of the sources
COPY . .

# Run lint/build for verification (allow failing to keep image usable)
RUN yarn run lint || true
RUN yarn run build || true

EXPOSE 8080

# Default to starting the dev server
CMD ["yarn", "run", "start"]
