package com.example.webchat;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // ← Important to allow frontend requests
public class UserController {

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/login")
    public Map<String, String> login(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        // TEMP: Accept any non-empty username/password for testing
        if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
            String token = jwtUtil.generateToken(username);
            return Map.of("token", token);
        }

        throw new RuntimeException("Invalid credentials");
    }
}
