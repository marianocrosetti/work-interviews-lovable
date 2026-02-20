FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .
COPY user-app-template /app/user-app-template

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Default to development environment if not specified
ARG ENVIRONMENT=development
ENV ENV=${ENVIRONMENT}

# Expose the port the app runs on
EXPOSE 3001

# Set entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Command to run the application
ENTRYPOINT ["/entrypoint.sh"]
#CMD ["gunicorn", "--bind", "0.0.0.0:3001", "wsgi:app"] 
CMD ["gunicorn", "--bind", "0.0.0.0:3001", "--timeout", "300", "wsgi:app"] 