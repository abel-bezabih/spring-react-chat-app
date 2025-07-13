package com.example.webchat;

import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;

import java.util.Map;

@Component
public class AuthHandshakeInterceptor implements HandshakeInterceptor {

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    public boolean beforeHandshake(
        @org.springframework.lang.NonNull ServerHttpRequest request,
        @org.springframework.lang.NonNull ServerHttpResponse response,
        @org.springframework.lang.NonNull WebSocketHandler wsHandler,
        @org.springframework.lang.NonNull Map<String, Object> attributes
    ) {
        // Extract token from query string
        String query = request.getURI().getQuery(); // e.g., "token=abc123"
        if (query != null && query.startsWith("token=")) {
            String token = query.substring("token=".length());
            if (jwtUtil.validateToken(token)) {
                String username = jwtUtil.extractUsername(token);
                attributes.put("username", username);
                return true;
            }
        }
        return false;
    }

    @Override
    public void afterHandshake(
        @org.springframework.lang.NonNull ServerHttpRequest request,
        @org.springframework.lang.NonNull ServerHttpResponse response,
        @org.springframework.lang.NonNull WebSocketHandler wsHandler,
        @org.springframework.lang.Nullable Exception exception
    ) {
        // no-op for now
    }
}
