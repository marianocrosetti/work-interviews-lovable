# Backend

A Flask-based backend API for code generation and management.

## Features

- RESTful API for code generation and management
- Dockerized for easy deployment
- Flask-based architecture
- CORS support
- Versioned API structure

## Development

### Prerequisites

- Python 3.9+
- Docker and Docker Compose (for containerized development)

### Setup (Local Development)

1. Clone the repository
2. Navigate to the backend directory: `cd backend`
3. Install dependencies: `pip install -r requirements.txt`
4. Run the application: `./run.sh`

### Docker Development

The application can be run as part of the Docker Compose setup:

```bash
docker-compose up backend
```

## Project Structure

```
.
├── app/                  # Application package
│   ├── __init__.py       # Application factory
│   ├── config.py         # Configuration settings
│   └── api/              # API package
│       └── v1/           # API v1 endpoints
│           ├── __init__.py
│           ├── routes.py
│           └── README.md # API documentation
├── tests/                # Test package
├── Dockerfile            # Docker configuration
├── requirements.txt      # Python dependencies
├── run.sh                # Development runner
└── wsgi.py               # WSGI entry point
```

## API Endpoints

- `GET /`: Root endpoint with application information
- `GET /health`: Health check endpoint
- `GET /api/v1/hello`: Test endpoint returning a greeting message

See the [API documentation](app/api/v1/README.md) for more details.

## Testing

Run tests with pytest:

```bash
pytest
``` 