package com.example.webchat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ChatIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    /** Does not throw on 4xx/5xx (for endpoints that are not 401 with WWW-Authenticate quirks). */
    private RestTemplate tolerantRestTemplate() {
        RestTemplate rt = new RestTemplate();
        rt.setErrorHandler(new DefaultResponseErrorHandler() {
            @Override
            public boolean hasError(ClientHttpResponse response) {
                return false;
            }
        });
        return rt;
    }

    private String baseUrl() {
        return "http://127.0.0.1:" + port;
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }

    private String registerAndGetToken() {
        String username = "u_" + UUID.randomUUID().toString().substring(0, 8);
        ResponseEntity<String> response = restTemplate.exchange(
                baseUrl() + "/api/register",
                HttpMethod.POST,
                new HttpEntity<>(
                        Map.of("username", username, "password", "secret12"),
                        jsonHeaders()
                ),
                String.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        try {
            JsonNode root = objectMapper.readTree(response.getBody());
            return root.get("token").asText();
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }

    private HttpHeaders bearerHeaders(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return h;
    }

    /** Default #general channel from {@link com.example.webchat.ChannelDataInitializer}. */
    private long generalChannelId(String token) throws Exception {
        ResponseEntity<String> res = restTemplate.exchange(
                baseUrl() + "/api/channels",
                HttpMethod.GET,
                new HttpEntity<>(bearerHeaders(token)),
                String.class
        );
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode arr = objectMapper.readTree(res.getBody());
        assertThat(arr.isArray()).isTrue();
        assertThat(arr.size()).isGreaterThanOrEqualTo(1);
        for (JsonNode n : arr) {
            if ("general".equals(n.get("slug").asText())) {
                return n.get("id").asLong();
            }
        }
        throw new AssertionError("expected #general channel from ChannelDataInitializer");
    }

    @Test
    void registerReturnsCreatedAndToken() {
        String username = "u_" + UUID.randomUUID().toString().substring(0, 8);
        ResponseEntity<String> response = restTemplate.exchange(
                baseUrl() + "/api/register",
                HttpMethod.POST,
                new HttpEntity<>(
                        Map.of("username", username, "password", "secret12"),
                        jsonHeaders()
                ),
                String.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).contains("\"token\"");
    }

    @Test
    void registerDuplicateUsernameReturnsConflict() throws Exception {
        String username = "dup_" + UUID.randomUUID().toString().substring(0, 8);
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(
                Map.of("username", username, "password", "secret12"),
                jsonHeaders()
        );
        assertThat(restTemplate.exchange(baseUrl() + "/api/register", HttpMethod.POST, entity, String.class)
                .getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(restTemplate.exchange(baseUrl() + "/api/register", HttpMethod.POST, entity, String.class)
                .getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void loginSucceedsAfterRegister() throws Exception {
        String username = "login_" + UUID.randomUUID().toString().substring(0, 8);
        restTemplate.exchange(
                baseUrl() + "/api/register",
                HttpMethod.POST,
                new HttpEntity<>(Map.of("username", username, "password", "secret12"), jsonHeaders()),
                String.class
        );
        ResponseEntity<String> login = restTemplate.exchange(
                baseUrl() + "/api/login",
                HttpMethod.POST,
                new HttpEntity<>(Map.of("username", username, "password", "secret12"), jsonHeaders()),
                String.class
        );
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode root = objectMapper.readTree(login.getBody());
        assertThat(root.get("token").asText()).isNotBlank();
    }

    @Test
    void loginWithWrongPasswordReturns401() throws Exception {
        String username = "bad_" + UUID.randomUUID().toString().substring(0, 8);
        restTemplate.exchange(
                baseUrl() + "/api/register",
                HttpMethod.POST,
                new HttpEntity<>(Map.of("username", username, "password", "secret12"), jsonHeaders()),
                String.class
        );
        // HttpURLConnection avoids JDK+RestTemplate issues with 401 + WWW-Authenticate.
        URL url = new URL(baseUrl() + "/api/login");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        byte[] body = objectMapper.writeValueAsBytes(Map.of("username", username, "password", "wrongpass"));
        try (OutputStream os = conn.getOutputStream()) {
            os.write(body);
        }
        assertThat(conn.getResponseCode()).isEqualTo(401);
        conn.disconnect();
    }

    @Test
    void messagesRequiresBearerToken() {
        ResponseEntity<String> response = tolerantRestTemplate().getForEntity(
                baseUrl() + "/api/messages?channelId=1",
                String.class
        );
        assertThat(response.getStatusCode().value()).isIn(401, 403);
    }

    @Test
    void messagesWithTokenReturnsOk() throws Exception {
        String token = registerAndGetToken();
        long chId = generalChannelId(token);
        ResponseEntity<String> response = restTemplate.exchange(
                baseUrl() + "/api/messages?channelId=" + chId,
                HttpMethod.GET,
                new HttpEntity<>(bearerHeaders(token)),
                String.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).startsWith("[");
    }

    @Test
    void websocketRequiresValidToken() {
        StandardWebSocketClient client = new StandardWebSocketClient();
        String badUrl = "ws://127.0.0.1:" + port + "/chat?token=not-a-valid-jwt&channelId=1";
        var future = client.execute(new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                // should not receive with bad token
            }
        }, null, URI.create(badUrl));
        try {
            future.get(5, TimeUnit.SECONDS);
            org.junit.jupiter.api.Assertions.fail("Handshake should have failed for invalid JWT");
        } catch (ExecutionException | InterruptedException | java.util.concurrent.TimeoutException e) {
            assertThat(e).isNotNull();
        }
    }

    @Test
    void websocketSendMessageBroadcastsJson() throws Exception {
        String token = registerAndGetToken();
        long chId = generalChannelId(token);
        String wsUrl = "ws://127.0.0.1:" + port + "/chat?token="
                + URLEncoder.encode(token, StandardCharsets.UTF_8)
                + "&channelId=" + chId;

        StandardWebSocketClient client = new StandardWebSocketClient();
        BlockingQueue<String> inbound = new LinkedBlockingQueue<>();
        String clientMsgId = "it-" + UUID.randomUUID();

        TextWebSocketHandler handler = new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                inbound.offer(message.getPayload());
            }
        };

        WebSocketSession session = client.execute(handler, null, URI.create(wsUrl)).get(15, TimeUnit.SECONDS);

        String payload = "{\"type\":\"MESSAGE\",\"content\":\"hello-integration\",\"clientMessageId\":\"" + clientMsgId + "\"}";
        session.sendMessage(new TextMessage(payload));

        String line = null;
        for (int i = 0; i < 30; i++) {
            line = inbound.poll(1, TimeUnit.SECONDS);
            if (line != null && line.contains("hello-integration")) {
                break;
            }
        }
        session.close();

        assertThat(line).isNotNull();
        JsonNode node = objectMapper.readTree(line);
        assertThat(node.get("type").asText()).isEqualTo("MESSAGE");
        assertThat(node.get("content").asText()).isEqualTo("hello-integration");
    }
}
