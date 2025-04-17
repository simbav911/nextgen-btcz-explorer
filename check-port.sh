#!/bin/bash
echo "Checking what process is using port 3000..."
lsof -i :3000
