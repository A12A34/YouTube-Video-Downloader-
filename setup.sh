#!/bin/bash

echo "🚀 YouTube Video Downloader - Setup Script"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Installation complete!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Start the server: npm start"
    echo "   2. Open index.html in your browser"
    echo ""
    echo "🎉 Ready to download videos!"
else
    echo ""
    echo "❌ Installation failed. Please check the error messages above."
    exit 1
fi
