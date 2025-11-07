#!/bin/bash

echo "Starting ITAM Scanner..."
echo

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed or not in PATH"
    echo "Please install Python 3.7 or higher"
    exit 1
fi

# Check if required packages are installed
echo "Checking dependencies..."
python3 -c "import schedule, requests, psutil" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing required packages..."
    pip3 install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install required packages"
        exit 1
    fi
fi

# Make the script executable
chmod +x itam_scanner.py

# Run the scanner
echo "Starting ITAM Scanner..."
echo "Press Ctrl+C to stop"
echo
python3 itam_scanner.py
