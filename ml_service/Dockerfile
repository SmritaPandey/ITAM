# Multi-stage build for optimized production image

FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt* ./

# Create requirements.txt if it doesn't exist
RUN if [ ! -f requirements.txt ]; then \
    echo "flask==2.3.0" > requirements.txt && \
    echo "scikit-learn==1.3.0" >> requirements.txt && \
    echo "pandas==2.0.3" >> requirements.txt && \
    echo "numpy==1.24.3" >> requirements.txt && \
    echo "scipy==1.11.1" >> requirements.txt; \
    fi

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p models logs && \
    chmod -R 755 models logs

# Create non-root user
RUN useradd -m -u 1001 mluser && \
    chown -R mluser:mluser /app

USER mluser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["python", "standalone_ml_service.py"]
