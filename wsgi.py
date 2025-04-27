from app import create_app

# Create application instance
application = create_app()

# For render and other WSGI servers
app = application

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8000) 
    