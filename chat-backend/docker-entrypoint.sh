#!/bin/sh
set -e

# Run the application with APP_NAME expanded
exec node "./dist/apps/${APP_NAME}/main.js"
