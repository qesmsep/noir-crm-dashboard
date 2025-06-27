#!/bin/bash

echo "🚀 Setting up Ollama for local AI SMS parsing..."

# Check if Ollama is already installed
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is already installed"
else
    echo "📥 Installing Ollama..."
    
    # Install Ollama (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        curl -fsSL https://ollama.ai/install.sh | sh
    else
        echo "❌ Please install Ollama manually from https://ollama.ai/install"
        exit 1
    fi
fi

# Start Ollama service
echo "🔄 Starting Ollama service..."
ollama serve &

# Wait for service to start
sleep 5

# Download the model
echo "📦 Downloading Llama 3.1 8B model (this may take a few minutes)..."
ollama pull llama3.1:8b

echo "✅ Setup complete!"
echo ""
echo "🎯 Your SMS parser now supports:"
echo "   • Fast regex parsing for common formats"
echo "   • AI fallback for complex/natural language"
echo "   • Local processing (no API costs)"
echo "   • Caching for performance"
echo ""
echo "📱 Try texting:"
echo "   RESERVATION 2 guests on 6/27/25 at 6:30pm"
echo "   RESERVATION for 4 people tomorrow at 8pm"
echo "   RESERVATION party of 6 next Friday 7:30pm"
echo ""
echo "🔧 To use a faster model, run: ollama pull mistral:7b"
echo "   Then update the model name in the code to 'mistral:7b'" 