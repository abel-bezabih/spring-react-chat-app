package com.example.webchat;

import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
public class AuthHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;
    private final ChannelRepository channelRepository;

    public AuthHandshakeInterceptor(JwtUtil jwtUtil, ChannelRepository channelRepository) {
        this.jwtUtil = jwtUtil;
        this.channelRepository = channelRepository;
    }

    @Override
    public boolean beforeHandshake(
            @NonNull org.springframework.http.server.ServerHttpRequest request,
            @NonNull org.springframework.http.server.ServerHttpResponse response,
            @NonNull WebSocketHandler wsHandler,
            @NonNull Map<String, Object> attributes
    ) {
        String query = request.getURI().getQuery();
        String token = extractParamFromQuery(query, "token");
        if (token == null || token.isEmpty()) {
            return false;
        }
        if (!jwtUtil.validateToken(token)) {
            return false;
        }
        String username = jwtUtil.extractUsername(token);
        attributes.put("username", username);

        String channelIdRaw = extractParamFromQuery(query, "channelId");
        if (channelIdRaw == null || channelIdRaw.isEmpty()) {
            return false;
        }
        long channelId;
        try {
            channelId = Long.parseLong(channelIdRaw.trim());
        } catch (NumberFormatException e) {
            return false;
        }
        if (!channelRepository.existsById(channelId)) {
            return false;
        }
        attributes.put("channelId", channelId);
        return true;
    }

    @Nullable
    static String extractParamFromQuery(@Nullable String query, String paramName) {
        if (query == null || query.isEmpty()) {
            return null;
        }
        for (String part : query.split("&")) {
            int eq = part.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            String key = part.substring(0, eq);
            if (!paramName.equals(key)) {
                continue;
            }
            String raw = part.substring(eq + 1);
            return URLDecoder.decode(raw, StandardCharsets.UTF_8);
        }
        return null;
    }

    /**
     * @deprecated use {@link #extractParamFromQuery(String, String)}
     */
    @Deprecated
    @Nullable
    static String extractTokenFromQuery(@Nullable String query) {
        return extractParamFromQuery(query, "token");
    }

    @Override
    public void afterHandshake(
            @NonNull org.springframework.http.server.ServerHttpRequest request,
            @NonNull org.springframework.http.server.ServerHttpResponse response,
            @NonNull WebSocketHandler wsHandler,
            @Nullable Exception exception
    ) {
        // no-op
    }
}
