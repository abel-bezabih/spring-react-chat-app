package com.example.webchat;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.*;
//import com.example.webchat.ChatHandler;
//import com.example.webchat.AuthHandshakeInterceptor;
import org.springframework.lang.NonNull;

@Configuration
@EnableWebSocket
public class ChatWebSocketConfig implements WebSocketConfigurer {

    @Autowired
    private ChatHandler chatHandler;

    @Autowired
    private AuthHandshakeInterceptor authInterceptor;

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        registry.addHandler(chatHandler, "/chat")
                .addInterceptors(authInterceptor)
                .setAllowedOrigins("*");
    }
}
