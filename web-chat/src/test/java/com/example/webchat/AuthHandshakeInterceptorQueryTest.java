package com.example.webchat;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuthHandshakeInterceptorQueryTest {

    @Test
    void extractsTokenWhenNotFirstParameter() {
        assertThat(AuthHandshakeInterceptor.extractTokenFromQuery("foo=1&token=abc123")).isEqualTo("abc123");
    }

    @Test
    void extractsUrlEncodedToken() {
        assertThat(AuthHandshakeInterceptor.extractTokenFromQuery("token=hello%2Bworld")).isEqualTo("hello+world");
    }

    @Test
    void returnsNullWhenMissing() {
        assertThat(AuthHandshakeInterceptor.extractTokenFromQuery("foo=bar")).isNull();
        assertThat(AuthHandshakeInterceptor.extractTokenFromQuery(null)).isNull();
    }
}
