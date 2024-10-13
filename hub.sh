#!/bin/bash

# Define the path to the autopay.js script
AUTOPAY_SCRIPT="/home/kali/Autohiter/autopay.js"

# Check if autopay.js is present in the specified directory
if [ ! -f "$AUTOPAY_SCRIPT" ]; then
    echo "Error: autopay.js not found in $AUTOPAY_SCRIPT."
    exit 1
fi

# Ask the user which shell they are using
echo "Which shell are you using? (bash/zsh)"
read -r shell_choice

# Choose the appropriate shell configuration file
if [[ "$shell_choice" == "bash" ]]; then
    shell_config_file="$HOME/.bashrc"
elif [[ "$shell_choice" == "zsh" ]]; then
    shell_config_file="$HOME/.zshrc"
else
    echo "Unsupported shell. Please choose 'bash' or 'zsh'."
    exit 1
fi

# Add the alias to the shell configuration file
echo "Adding 'thehub' command to your $shell_config_file..."
echo "alias thehub='node --max-old-space-size=8192 --expose-gc $AUTOPAY_SCRIPT'" >> "$shell_config_file"

# Apply the changes to the current terminal session
echo "Applying changes..."
source "$shell_config_file"

# Confirmation
echo "Setup complete. You can now run the 'thehub' command to execute autopay.js."

# Test by running the thehub command
echo "Running 'thehub' now..."
thehub

