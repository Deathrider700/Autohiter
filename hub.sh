#!/bin/bash

# Check which shell is being used and add the 'thehub' alias to the shell config file
if [ "$SHELL" = "/bin/bash" ]; then
    config_file="$HOME/.bashrc"
    echo "Using bash shell"
elif [ "$SHELL" = "/bin/zsh" ]; then
    config_file="$HOME/.zshrc"
    echo "Using zsh shell"
else
    echo "Unsupported shell. Please use bash or zsh."
    exit 1
fi

# Add thehub command alias to the config file
if ! grep -q "alias thehub" "$config_file"; then
    echo "alias thehub='node --max-old-space-size=4096 autopay.js'" >> "$config_file"
    echo "Added 'thehub' command to your $config_file."
else
    echo "'thehub' command is already added to your $config_file."
fi

# Apply the changes
source "$config_file"
echo "Setup complete. You can now run the 'thehub' command to execute autopay.js."

# Optionally, run thehub after setup
echo "Running 'thehub' now..."
thehub
