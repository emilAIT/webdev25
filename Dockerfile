FROM python:3.11.9-slim

# Set working directory
WORKDIR /app

# Copy and install requirements first (for better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create uploads directory with proper permissions
RUN mkdir -p static/uploads && chown -R appuser:appuser /app

# Copy application code
COPY . .

# Set ownership of all files
RUN chown -R appuser:appuser /app

# Set environment variables - исправление формата для ENV
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PORT=8080

# Switch to non-root user
USER appuser

# Expose port - this is informational only, Cloud Run will use the PORT env var
EXPOSE 8080

# Run the application with the PORT from environment variable - исправление формата для CMD
CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=${PORT}"]