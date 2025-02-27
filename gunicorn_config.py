import os

# Gunicorn configuration file
bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"
workers = 1  # Gradio works best with a single worker
worker_class = "uvicorn.workers.UvicornWorker"  # Use Uvicorn worker for ASGI compatibility
timeout = 300  # Increased timeout for longer operations
