#!/bin/bash

cd /app/backend
pip install -r requirements.txt
python main.py &

cd /app/frontend
npm install
npm run dev &
