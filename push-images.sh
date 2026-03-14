#!/bin/bash
set -e

DOCKERHUB_USER="max246"
PROJECT="map-the-mess"

echo "Building images..."
docker compose build --build-arg VITE_API_URL=https://api.mapthemess.uk

echo "Tagging images..."
docker tag ${PROJECT}-backend ${DOCKERHUB_USER}/${PROJECT}-backend:latest
docker tag ${PROJECT}-frontend ${DOCKERHUB_USER}/${PROJECT}-frontend:latest

echo "Pushing images..."
docker push ${DOCKERHUB_USER}/${PROJECT}-backend:latest
docker push ${DOCKERHUB_USER}/${PROJECT}-frontend:latest

echo "Done!"
