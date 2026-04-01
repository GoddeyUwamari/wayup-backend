#!/bin/bash
echo "�� Deploying backend with status fix to production..."

# Upload files to server
echo "📤 Uploading backend files..."
rsync -av --exclude node_modules --exclude .git . root@162.0.233.208:/opt/wayuptech-backend/

# SSH and restart the backend
echo "🔄 Restarting backend service..."
ssh root@162.0.233.208 << 'ENDSSH'
cd /opt/wayuptech-backend
npm install --production
pm2 restart wayuptech-backend
echo "✅ Backend restarted with status fix"
pm2 logs wayuptech-backend --lines 5
ENDSSH

echo "🎉 Backend deployment complete!"
echo "🧪 Test the fix: curl http://162.0.233.208:8000/api/health"
