# Komodo CLI Docker Image
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Create package.json for local installation
RUN echo '{"type": "module"}' > package.json

# Install komodo_client and dotenv locally in the working directory
RUN npm install komodo_client dotenv

# Set default command to show help
CMD ["node", "-e", "console.log('Komodo CLI ready')"]

# Add labels for metadata
LABEL org.opencontainers.image.title="Komodo CLI"
LABEL org.opencontainers.image.description="Pre-built Komodo CLI with komodo_client npm package"
LABEL org.opencontainers.image.source="https://github.com/tobiasmllr/komodo-pr-deploy"