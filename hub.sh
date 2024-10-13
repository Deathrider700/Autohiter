#!/bin/bash

# Always use bash for setup
echo "Adding 'thehub' command to your /root/.bashrc..."
echo "alias thehub='node /path/to/your/script/autopay.js'" >> ~/.bashrc
source ~/.bashrc  # Apply changes to current session

echo "Setup complete. You can now run the 'thehub' command to execute autopay.js."
