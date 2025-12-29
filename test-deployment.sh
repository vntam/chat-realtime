#!/bin/bash
# ============================================================
# Test Deployment Script - Check All Services
# ============================================================

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Service URLs (RENDER)
GATEWAY_URL="https://chat-api-gateway-ahun.onrender.com"
CHAT_SERVICE_URL="https://chat-chat-service-ahun.onrender.com"
NOTIF_SERVICE_URL="https://chat-notification-service-ahun.onrender.com"
USER_SERVICE_URL="https://chat-user-service-ahun.onrender.com"

# Frontend URL (S3)
FRONTEND_URL="http://chatrealtime-frontend-s3-2025.s3-website-ap-southeast-1.amazonaws.com"

echo "=========================================="
echo "   TESTING DEPLOYMENT"
echo "=========================================="
echo ""

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local endpoint=$3

    echo -n "Testing $name... "

    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url$endpoint")

    if [ "$response" = "200" ] || [ "$response" = "401" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
        return 1
    fi
}

# 1. Test Health Endpoints
echo "=== 1. HEALTH CHECKS ==="
test_endpoint "API Gateway" "$GATEWAY_URL" "/health"
test_endpoint "User Service" "$USER_SERVICE_URL" "/health"
test_endpoint "Chat Service" "$CHAT_SERVICE_URL" "/health"
test_endpoint "Notification Service" "$NOTIF_SERVICE_URL" "/health"
echo ""

# 2. Test Public Endpoints
echo "=== 2. PUBLIC ENDPOINTS ==="
test_endpoint "Gateway - Login" "$GATEWAY_URL" "/auth/login"
test_endpoint "Gateway - Register" "$GATEWAY_URL" "/auth/register"
echo ""

# 3. Test Protected Endpoints (should return 401 without auth)
echo "=== 3. PROTECTED ENDPOINTS (expect 401) ==="
test_endpoint "Conversations" "$GATEWAY_URL" "/conversations"
test_endpoint "Notifications" "$GATEWAY_URL" "/notifications"
test_endpoint "Users" "$GATEWAY_URL" "/users"
echo ""

# 4. Test Frontend
echo "=== 4. FRONTEND (S3) ==="
echo -n "Testing Frontend... "
response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$FRONTEND_URL")
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
else
    echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
fi
echo ""

# 5. Display URLs
echo "=== 5. SERVICE URLs ==="
echo "Frontend (S3):"
echo "  $FRONTEND_URL"
echo ""
echo "Backend (Render):"
echo "  API Gateway: $GATEWAY_URL"
echo "  User Service: $USER_SERVICE_URL"
echo "  Chat Service: $CHAT_SERVICE_URL"
echo "  Notification Service: $NOTIF_SERVICE_URL"
echo ""

echo "=========================================="
echo "   TEST COMPLETE"
echo "=========================================="
