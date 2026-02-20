#!/bin/bash
set -e

# Print environment information
echo "Starting Backend in ${ENV} environment"

# Check if environment file exists
ENV_FILE=".env.${ENV}"
if [ -f "$ENV_FILE" ]; then
    echo "Loading environment from $ENV_FILE"
else
    echo "Warning: Environment file $ENV_FILE not found. Using default values."
fi

# Print configuration
python -c "from app.config import configs; print(configs)"

# Run the command provided as arguments
exec "$@" 