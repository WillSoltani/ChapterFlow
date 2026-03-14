# Stage 1: bundle TypeScript -> single JS file
FROM node:20-slim AS builder
WORKDIR /app
COPY index.ts package*.json ./
COPY lib ./lib
RUN npm install -g esbuild
RUN esbuild index.ts \
    --bundle --platform=node --target=node20 \
    --external:"@aws-sdk/*" \
    --external:sharp \
    --external:heic-convert \
    --outfile=dist/index.js

# Stage 2: production node dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 3: python packages (Debian/glibc compatible with final stage)
FROM python:3.11-slim AS python-deps
RUN pip install --no-cache-dir --target /python-packages \
    "PyMuPDF>=1.23.0" \
    "Pillow>=10.0.0" \
    "pillow-avif-plugin>=1.4.0" \
    "pillow-heif>=0.16.0"

# Stage 4: custom Lambda runtime image (Debian + aws-lambda-ric)
FROM node:20-slim
WORKDIR /var/task

ENV DEBIAN_FRONTEND=noninteractive

# High-fidelity DOCX rendering stack:
# - LibreOffice writer/headless conversion
# - font packages for Word-compatible substitution
# - librsvg2-2: required by sharp for SVG rasterization (not bundled in @img/sharp-linux-x64)
# - build tools only for aws-lambda-ric native install (removed afterwards)
# NOTE: python3-pip is NOT purged here so we can install pillow-avif-plugin below
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libheif1 \
    librsvg2-2 \
    libreoffice-writer \
    fontconfig \
    fonts-dejavu-core \
    fonts-liberation2 \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-noto-core \
    fonts-noto-cjk \
    cmake \
    g++ \
    make \
    autoconf \
    automake \
    libtool \
    && npm install -g aws-lambda-ric \
    && apt-get purge -y --auto-remove \
      cmake \
      g++ \
      make \
      autoconf \
      automake \
      libtool \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist/index.js ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=python-deps /python-packages /var/task/python-packages

ENV PYTHONPATH=/var/task/python-packages

# Install image codec plugins using Stage 4's exact python3 binary to guarantee ABI match.
# Pillow is already present in /var/task/python-packages (from Stage 3), so --no-deps is safe.
# This must run AFTER the python-packages COPY so the target directory exists.
RUN pip3 install --no-cache-dir --no-deps --break-system-packages \
      --target /var/task/python-packages \
      "pillow-avif-plugin>=1.4.0" \
      "pillow-heif>=0.16.0" \
    && pip3 cache purge

COPY fonts/local.conf /etc/fonts/local.conf
RUN fc-cache -f

# Converter scripts called from Node via subprocess.
COPY docx_sanitize.py /var/task/docx_sanitize.py
COPY docx_to_pdf.py /var/task/docx_to_pdf.py
COPY pages_to_pdf.py /var/task/pages_to_pdf.py
COPY document_to_images_zip.py /var/task/document_to_images_zip.py
COPY image_to_pdf.py /var/task/image_to_pdf.py
COPY image_special_convert.py /var/task/image_special_convert.py

ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]
CMD ["index.handler"]
