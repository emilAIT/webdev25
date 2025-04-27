# This afile makes the app directory a Python pckage


# Function to run the application
def run_app():
    import uvicorn
    import os
    import sys

    # Add the project root to the path to ensure imports work correctly
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, project_root)

    # Run the FastAPI application
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)


# Allow running directly as a script
if __name__ == "__main__":
    run_app()

# Usage instructions that remain visible in the file
"""
To run the application directly from this file:
1. Navigate to the app directory
2. Run: python __init__.py

Or from anywhere, import and call:
   from app import run_app
   run_app()
"""
