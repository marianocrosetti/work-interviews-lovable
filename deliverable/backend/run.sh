#!/bin/bash

# Set environment variables
export FLASK_APP=wsgi.py
export FLASK_ENV=development
export FLASK_DEBUG=1

echo "Starting development server..."
python wsgi.py 